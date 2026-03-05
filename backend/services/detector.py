"""
Synthetix Duplicate Detection Engine
Threshold-based duplicate classification with evidence grounding.
"""
from backend.config import settings
from backend.services.embedder import EmbeddingService
from backend.services.vector_store import VectorStore
from backend.services.preprocessor import TextNormalizer
from backend.models.defect import DefectReport, MatchResult
from backend.utils.logger import get_logger
from backend.utils.exceptions import DetectionError

log = get_logger("detector")


class DuplicateDetector:
    """Detect duplicate defect reports using semantic similarity."""

    def __init__(self):
        self.embedder = EmbeddingService()
        self.vector_store = VectorStore()
        self.normalizer = TextNormalizer()

    def analyze(self, report: DefectReport) -> dict:
        """
        Analyze a defect report for duplicates.

        Returns:
            {
                "decision": "duplicate" | "possible_duplicate" | "new_defect",
                "top_matches": [...],
                "confidence": float,
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
                }

            # 2. Generate embedding
            embedding = self.embedder.encode(combined_text)

            # 3. Search for similar defects in the vector store
            raw_matches = self.vector_store.search_similar(
                query_embedding=embedding,
                top_k=settings.TOP_K_MATCHES,
            )

            # 4. Build structured match results
            top_matches = []
            for match in raw_matches:
                metadata = match.get("metadata", {})
                top_matches.append(
                    MatchResult(
                        defect_id=match["id"],
                        title=metadata.get("title", "Unknown"),
                        similarity_score=match["similarity_score"],
                        cluster_id=metadata.get("cluster_id", -1),
                    )
                )

            # 5. Classify based on highest similarity
            max_similarity = top_matches[0].similarity_score if top_matches else 0.0

            if max_similarity >= settings.DUPLICATE_THRESHOLD:
                decision = "duplicate"
            elif max_similarity >= settings.POSSIBLE_DUPLICATE_THRESHOLD:
                decision = "possible_duplicate"
            else:
                decision = "new_defect"

            confidence = round(max_similarity, 4)

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
