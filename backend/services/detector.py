"""
Synthetix Duplicate Detection Engine
Hybrid Bi-Encoder (FAISS) + Cross-Encoder re-ranking with evidence grounding.
"""
from sentence_transformers import CrossEncoder
from backend.config import settings
from backend.services.embedder import EmbeddingService
from backend.services.vector_store import VectorStore
from backend.services.preprocessor import TextNormalizer
from backend.models.defect import DefectReport, MatchResult, MatchEvidence
from backend.utils.logger import get_logger
from backend.utils.exceptions import DetectionError

log = get_logger("detector")


class DuplicateDetector:
    """Detect duplicate defect reports using hybrid semantic similarity."""

    _cross_encoder = None

    def __init__(self):
        self.embedder = EmbeddingService()
        self.vector_store = VectorStore()
        self.normalizer = TextNormalizer()

    def _ensure_cross_encoder(self):
        """Lazy-load the Cross-Encoder re-ranking model."""
        if DuplicateDetector._cross_encoder is None:
            try:
                log.info(f"Loading Cross-Encoder: {settings.RERANKER_MODEL}")
                DuplicateDetector._cross_encoder = CrossEncoder(
                    settings.RERANKER_MODEL, max_length=512
                )
                log.info("✅ Cross-Encoder loaded successfully")
            except Exception as e:
                log.warning(f"Cross-Encoder unavailable, using cosine-only: {e}")
                DuplicateDetector._cross_encoder = "fallback"

    def _rerank_with_cross_encoder(
        self, query_text: str, candidates: list[dict]
    ) -> list[dict]:
        """
        Re-rank FAISS candidates using Cross-Encoder for higher accuracy.
        Returns candidates with updated cross_encoder_score.
        """
        self._ensure_cross_encoder()

        if (
            DuplicateDetector._cross_encoder is None
            or DuplicateDetector._cross_encoder == "fallback"
        ):
            # Fallback: use cosine similarity as-is
            for c in candidates:
                c["cross_encoder_score"] = c.get("similarity_score", 0.0)
            return candidates

        try:
            pairs = []
            for c in candidates:
                candidate_text = c.get("document", c.get("metadata", {}).get("title", ""))
                pairs.append([query_text, candidate_text])

            if not pairs:
                return candidates

            scores = DuplicateDetector._cross_encoder.predict(pairs)

            # Normalize scores to 0.0–1.0 using sigmoid
            import numpy as np
            normalized = 1.0 / (1.0 + np.exp(-np.array(scores)))

            for i, c in enumerate(candidates):
                c["cross_encoder_score"] = float(normalized[i])

            # Sort by cross-encoder score (descending)
            candidates.sort(key=lambda x: x["cross_encoder_score"], reverse=True)

            log.info(
                f"Cross-Encoder re-ranked {len(candidates)} candidates "
                f"(top score: {candidates[0]['cross_encoder_score']:.4f})"
            )
            return candidates

        except Exception as e:
            log.warning(f"Cross-Encoder re-ranking failed, using cosine: {e}")
            for c in candidates:
                c["cross_encoder_score"] = c.get("similarity_score", 0.0)
            return candidates

    def _build_evidence(
        self, report: DefectReport, match_metadata: dict, similarity: float
    ) -> list[MatchEvidence]:
        """Build evidence trail explaining why two defects matched."""
        evidence = []

        match_title = match_metadata.get("title", "")
        match_desc = match_metadata.get("description", "")

        # 1. Title similarity
        if match_title and report.title:
            # Find shared meaningful words
            report_words = set(report.title.lower().split())
            match_words = set(match_title.lower().split())
            shared = report_words & match_words - {"the", "a", "an", "is", "in", "on", "at", "to", "for", "of"}
            if shared:
                evidence.append(MatchEvidence(
                    field="title",
                    match_type="semantic" if len(shared) >= 2 else "partial",
                    snippet=f"Shared terms: {', '.join(sorted(shared))}",
                    score=min(len(shared) / max(len(report_words), 1), 1.0),
                    source=f"title of matched defect",
                ))

        # 2. Environment match
        match_env = match_metadata.get("environment", "")
        if match_env and report.environment:
            if match_env.lower() == report.environment.lower():
                evidence.append(MatchEvidence(
                    field="environment",
                    match_type="exact",
                    snippet=match_env,
                    score=1.0,
                    source="environment field",
                ))
            elif match_env.lower() in report.environment.lower() or report.environment.lower() in match_env.lower():
                evidence.append(MatchEvidence(
                    field="environment",
                    match_type="partial",
                    snippet=match_env,
                    score=0.7,
                    source="environment field",
                ))

        # 3. Semantic similarity
        evidence.append(MatchEvidence(
            field="semantic_embedding",
            match_type="semantic",
            snippet=f"Cosine similarity: {similarity:.4f}",
            score=similarity,
            source="all-MiniLM-L6-v2 embedding comparison",
        ))

        # 4. Description keyword overlap
        if match_desc and report.description:
            report_kw = set(self.normalizer.normalize(report.description).split())
            match_kw = set(self.normalizer.normalize(match_desc).split())
            desc_shared = report_kw & match_kw
            if len(desc_shared) >= 3:
                top_shared = sorted(desc_shared)[:5]
                evidence.append(MatchEvidence(
                    field="description",
                    match_type="semantic",
                    snippet=f"Shared keywords: {', '.join(top_shared)}",
                    score=min(len(desc_shared) / max(len(report_kw), 1), 1.0),
                    source="description field keyword analysis",
                ))

        return evidence

    def analyze(self, report: DefectReport) -> dict:
        """
        Analyze a defect report for duplicates using hybrid retrieval.

        Pipeline:
        1. Normalize text → combine fields
        2. Generate embedding (Bi-Encoder)
        3. FAISS top-K retrieval (fast)
        4. Cross-Encoder re-ranking (accurate)
        5. Build evidence trail
        6. Classify decision

        Returns:
            {
                "decision": "duplicate" | "possible_duplicate" | "new_defect",
                "top_matches": [MatchResult(...)],
                "confidence": float,
                "embedding": list[float],
            }

        All evidence is grounded in the dataset — no hallucinated results.
        """
        try:
            # 1. Normalize and combine fields
            combined_text = self.normalizer.combine_fields(
                title=report.title,
                description=report.description,
                steps=report.steps,
                expected=report.expected,
                actual=report.actual,
            )

            if not combined_text:
                log.warning(f"Defect {report.defect_id} produced empty normalized text")
                return {
                    "decision": "new_defect",
                    "top_matches": [],
                    "confidence": 0.0,
                    "embedding": [],
                }

            # 2. Generate embedding (Bi-Encoder)
            embedding = self.embedder.encode(combined_text)

            # 3. FAISS top-K retrieval (fast candidate search)
            raw_matches = self.vector_store.search_similar(
                query_embedding=embedding,
                top_k=settings.TOP_K_MATCHES,
            )

            if not raw_matches:
                return {
                    "decision": "new_defect",
                    "top_matches": [],
                    "confidence": 0.0,
                    "embedding": embedding,
                }

            # 4. Cross-Encoder re-ranking (accurate judgment)
            reranked = self._rerank_with_cross_encoder(combined_text, raw_matches)

            # 5. Build structured match results with evidence
            top_matches = []
            for match in reranked:
                metadata = match.get("metadata", {})
                cosine_sim = match.get("similarity_score", 0.0)
                ce_score = match.get("cross_encoder_score", cosine_sim)

                # Use the better of cosine or cross-encoder score
                final_score = max(cosine_sim, ce_score)

                evidence = self._build_evidence(report, metadata, cosine_sim)

                top_matches.append(
                    MatchResult(
                        defect_id=match["id"],
                        title=metadata.get("title", "Unknown"),
                        similarity_score=cosine_sim,
                        cross_encoder_score=ce_score,
                        cluster_id=metadata.get("cluster_id", -1),
                        evidence=evidence,
                    )
                )

            # 6. Classify based on best score
            best_score = top_matches[0].cross_encoder_score if top_matches else 0.0

            if best_score >= settings.DUPLICATE_THRESHOLD:
                decision = "duplicate"
            elif best_score >= settings.POSSIBLE_DUPLICATE_THRESHOLD:
                decision = "possible_duplicate"
            else:
                decision = "new_defect"

            confidence = round(best_score, 4)

            log.info(
                f"Defect {report.defect_id} → {decision} "
                f"(confidence={confidence}, matches={len(top_matches)})"
            )

            return {
                "decision": decision,
                "top_matches": top_matches,
                "confidence": confidence,
                "embedding": embedding,
            }

        except Exception as e:
            log.error(f"Duplicate detection failed for {report.defect_id}: {e}")
            raise DetectionError(
                message=f"Duplicate detection failed for defect {report.defect_id}",
                detail=str(e),
            )
