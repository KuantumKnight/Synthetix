---
workflowType: 'epics-and-stories'
workflowPhase: 'Phase 3'
workflowStep: 'Step 2 (Create Epics & Stories)'
documentStatus: 'DRAFT - MAPPING 70 REQUIREMENTS TO IMPLEMENTATION STORIES'
inputDocuments:
  - 'prd.md (70 requirements: 50 FR + 20 NFR)'
  - 'architecture.md (15 sections, 5-phase critical path)'
mappingStatus: 'In Progress'
totalRequirements: 70
totalFunctionalRequirements: 50
totalNonFunctionalRequirements: 20
epicCount: 9
estimatedStoryCount: 40
date: '2026-03-05'
author: 'Sarvesh M'
---

# Epics & Stories — Synthetix Phase 3, Step 2

**Project:** Synthetix AI-Driven Defect Triage & Enrichment  
**Timeline:** 30-hour critical path  
**Status:** ✅ Mapping 70 Requirements → 40 Implementation Stories → 5-Phase Execution

---

## MAPPING STRATEGY

This document maps all 70 requirements (50 FR + 20 NFR) to **Epics organized by capability**, then breaks each epic into **User Stories aligned to the 5-phase critical path**:

**5 Implementation Phases (30 hours total):**
1. **Skeleton (0-4h)** — FastAPI app skeleton, config, models, routers
2. **Brain (5-10h)** — Data loading, embeddings, FAISS indexing
3. **Judge (11-18h)** — Cross-Encoder re-ranking, scoring, duplicate detection
4. **Clerk (19-24h)** — DBSCAN clustering, cluster quality validation
5. **Enhancer (25-30h)** — Field extraction, enrichment, audit logging, documentation

**Story Assignment Logic:**
- Phase assignment based on service dependency chains
- Stories within a phase are independent and can execute in parallel
- Cross-phase dependencies clearly marked

---

## EPICS (9 CAPABILITY AREAS, 70 REQUIREMENTS)

### EPIC 1: Defect Data Management — FR1-4 (4 Requirements)

**Epic Goal:** Ingest, store, and embed defect data in a queryable, embeddable format.

**Ownership:** Services: `preprocessor.py`, `embedder.py`, `vector_store.py`  
**Phase:** Skeleton (init) + Brain (implementation)

#### Story 1.1: Ingest Defect Data from CSV/JSON — FR1
**Phase:** Skeleton (4h) + Brain (extension)  
**As a** QA lead  
**I want to** upload bulk defect data (CSV/JSON with title, description, environment, error logs, module, component)  
**So that** the system has a populated database to analyze against

**Acceptance Criteria:**
- ✅ `POST /api/v1/ingest` endpoint accepts files up to 50MB
- ✅ Parses CSV and JSON formats correctly
- ✅ Returns success/error report with defect count processed and errors per defect
- ✅ Integration: `routers/ingest.py` + `services/preprocessor.py`
- ✅ Validates all required fields present (title, description at minimum)
- ✅ Test: `tests/test_api.py::test_ingest_csv`, `test_ingest_json`

**Inputs from Architecture:**
- Config: `backend/config.py` (batch size)
- Exception handling: `backend/utils/exceptions.py`

---

#### Story 1.2: Store Defects with Unique Identifiers — FR2
**Phase:** Skeleton (4h)  
**As a** developer  
**I want to** unique identifiers for every defect so that references are unambiguous  
**So that** audit trails and citations trace back to correct defects

**Acceptance Criteria:**
- ✅ Every defect assigned UUID-4 identifier (defect_id)
- ✅ Defects stored in JSON file: `data/defects.jsonl` (append-only)
- ✅ Lookup by defect_id returns defect in <100ms
- ✅ Identifier stable across sessions (stored, not recomputed)
- ✅ Test: `tests/test_api.py::test_defect_id_uniqueness`

**Inputs from Architecture:**
- Data store: `backend/services/vector_store.py`
- Response model: `backend/models/defect.py`

---

#### Story 1.3: Generate Semantic Embeddings (384-dim) — FR3
**Phase:** Brain (5-10h)  
**As a** developer  
**I want** every defect converted to a 384-dimensional embedding  
**So that** semantic similarity can be computed (FAISS retrieval)

**Acceptance Criteria:**
- ✅ Uses `sentence-transformers/all-MiniLM-L6-v2` model (384-dim)
- ✅ Embedding generation: <100ms per defect (batch_size=32)
- ✅ Embeddings stored alongside defects in `data/models/faiss.index`
- ✅ Batch ingestion: ≥100 defects/second with batching
- ✅ Integration: `services/embedder.py` + `services/vector_store.py`
- ✅ Test: `tests/test_embedder.py::test_embedding_generation`, `test_batch_embedding`

**Inputs from Architecture:**
- Model path: `backend/config.py` (MODEL_NAME)
- Embedding dimension: 384 (non-negotiable)
- Latency budget: 40ms (FAISS) + 40ms (embedding) = 80ms combined prep

---

#### Story 1.4: Preserve Original Defect Data for Citation — FR4
**Phase:** Skeleton (4h)  
**As a** judge (auditor)  
**I want to** see original defect text in audit trails and evidence  
**So that** I can verify that citations are accurate and not hallucinated

**Acceptance Criteria:**
- ✅ Full original defect stored alongside embeddings
- ✅ Response includes `original_defect` field with unmodified text
- ✅ Citation references point to exact text snippets
- ✅ Original data never lossy-transformed for display
- ✅ Test: `tests/test_api.py::test_original_data_preservation`

**Inputs from Architecture:**
- Response model: `backend/models/response.py` (AnalysisResponse)
- Audit logging: `backend/services/enhancer.py`

---

### EPIC 2: Semantic Analysis & Matching — FR5-8 (4 Requirements)

**Epic Goal:** Retrieve and re-rank semantically similar defects using FAISS + Cross-Encoder.

**Ownership:** Services: `embedder.py`, `detector.py`, `vector_store.py`  
**Phase:** Brain (5-10h) + Judge (11-18h)

#### Story 2.1: Retrieve Top-5 Candidates (FAISS) ≤500ms — FR5
**Phase:** Brain (5-10h)  
**As a** developer  
**I want to** get the top 5 most similar defects for a new bug report  
**So that** I can see potential duplicates in sub-millisecond time

**Acceptance Criteria:**
- ✅ FAISS index created with all ingested defects
- ✅ Query time: <50ms for typical queries (p95)
- ✅ Returns exactly 5 results (or fewer if <5 defects in system)
- ✅ Results ranked by cosine similarity (highest first)
- ✅ Integration: `services/vector_store.py` (FAISS wrapper)
- ✅ Test: `tests/test_detector.py::test_faiss_retrieval_latency`

**Inputs from Architecture:**
- FAISS configuration: `backend/config.py`
- Embedding dimension: 384-dim
- Latency budget: 40ms for FAISS operations

---

#### Story 2.2: Re-rank with Cross-Encoder (Fine-Tuned Re-ranker) — FR6
**Phase:** Judge (11-18h)  
**As a** developer  
**I want to** re-rank the top 5 candidates using a trained model  
**So that** I get the most semantically accurate match (not just embedding-space closest)

**Acceptance Criteria:**
- ✅ Uses `cross-encoder/ms-marco-TinyBERT-L-2-v2` model
- ✅ Re-ranking latency: <300ms for top 5 candidates
- ✅ Returns re-ranked list with updated scores
- ✅ Integration: `services/detector.py` (call cross-encoder on top-5)
- ✅ Test: `tests/test_detector.py::test_cross_encoder_reranking`

**Inputs from Architecture:**
- Cross-Encoder model path: `backend/config.py`
- Latency budget: 250ms (design allows 300ms)
- Input: FAISS top-5 results

---

#### Story 2.3: Calculate Semantic Similarity Scores (0.0-1.0) — FR7
**Phase:** Judge (11-18h)  
**As a** developer  
**I want to** see confidence scores on each potential duplicate  
**So that** I know how much to trust the match

**Acceptance Criteria:**
- ✅ Cross-Encoder output normalized to 0.0-1.0 confidence range
- ✅ Scores returned in JSON response
- ✅ Scores interpretable: 0.85+ is high confidence, 0.70-0.84 is medium, <0.70 is low
- ✅ Integration: `services/detector.py::score_matches()`
- ✅ Test: `tests/test_detector.py::test_similarity_score_range`

**Inputs from Architecture:**
- Confidence thresholds: `backend/config.py`
- Model output: Cross-Encoder logits → softmax normalization

---

#### Story 2.4: Compare Defects Across Multiple Dimensions — FR8
**Phase:** Judge (11-18h)  
**As a** developer  
**I want to** understand why two defects were matched  
**So that** I can trust the system's reasoning

**Acceptance Criteria:**
- ✅ Response includes match explanation covering: title similarity, error codes, stack trace, environment, logs
- ✅ Evidence field shows which attributes contributed to match
- ✅ Integration: `services/detector.py` (field comparison logic)
- ✅ Test: `tests/test_detector.py::test_multi_dimension_comparison`

**Inputs from Architecture:**
- Evidence extraction: `services/enhancer.py`
- Response model: Includes `evidence` field with dimension breakdown

---

### EPIC 3: Defect Enrichment & Field Extraction — FR9-14 (6 Requirements)

**Epic Goal:** Automatically detect missing fields and extract them from text using extractive NLP (no hallucinations).

**Ownership:** Services: `enhancer.py`, `preprocessor.py`  
**Phase:** Enhancer (25-30h)

#### Story 3.1: Detect Missing Structured Fields — FR9
**Phase:** Enhancer (25-30h)  
**As a** developer  
**I want to** know which fields (error_code, environment, timestamp) are missing  
**So that** I can decide whether to auto-extract or mark as missing

**Acceptance Criteria:**
- ✅ Ingest flow checks for: error_code, environment, timestamp, module, component fields
- ✅ Response includes `missing_fields` list
- ✅ Integration: `services/enhancer.py::detect_missing_fields()`
- ✅ Test: `tests/test_enhancer.py::test_missing_field_detection`

**Inputs from Architecture:**
- Defect model schema: `backend/models/defect.py`
- Response model: `backend/models/response.py` (includes missing_fields)

---

#### Story 3.2: Extract Missing Fields from Unstructured Text (Extractive NLP) — FR10
**Phase:** Enhancer (25-30h)  
**As a** developer  
**I want to** extract missing field values from error logs, stack traces, and descriptions  
**So that** incomplete bug reports become complete without hallucination

**Acceptance Criteria:**
- ✅ Uses regex patterns + NER (Named Entity Recognition) only — NO language model generation
- ✅ Extracts: error codes (E\d{4,5}), environment (Windows/Linux, version), timestamps (ISO 8601), module/component from file paths
- ✅ Integration: `services/enhancer.py::extract_fields()`
- ✅ Test: `tests/test_enhancer.py::test_field_extraction`, `test_no_hallucination`

**Inputs from Architecture:**
- Extraction rules: Documented in `services/enhancer.py` (regex patterns)
- Confidence scoring: Next story (FR11)

---

#### Story 3.3: Assign Confidence Scores to Extracted Fields — FR11
**Phase:** Enhancer (25-30h)  
**As a** developer  
**I want to** see confidence scores on extracted fields  
**So that** only high-confidence extractions are auto-populated (≥85%)

**Acceptance Criteria:**
- ✅ Every extracted field gets confidence score (0.0-1.0)
- ✅ Auto-populate only if confidence ≥0.85
- ✅ Flag lower-confidence extractions for manual review (0.70-0.84)
- ✅ Mark very-low-confidence as MISSING_DATA, not inferred (<0.70)
- ✅ Integration: `services/enhancer.py::score_extraction()`
- ✅ Test: `tests/test_enhancer.py::test_confidence_threshold`

**Inputs from Architecture:**
- Confidence thresholds: `backend/config.py` (MIN_EXTRACTION_CONFIDENCE=0.85)
- Response model: Includes confidence scores on inferred fields

---

#### Story 3.4: Mark Extracted Fields with Metadata — FR12
**Phase:** Enhancer (25-30h)  
**As a** judge  
**I want to** see which fields were inferred and how confident the system is  
**So that** I can audit enrichment decisions

**Acceptance Criteria:**
- ✅ Every inferred field marked with: `is_inferred: true`, source_reference, confidence_score
- ✅ Example: `{ "error_code": "E1234", "is_inferred": true, "source": "stack_trace_line_5", "confidence": 0.92 }`
- ✅ Integration: Response model includes `enriched_fields` dict with metadata
- ✅ Test: `tests/test_api.py::test_enrichment_metadata`

**Inputs from Architecture:**
- Response model: `backend/models/response.py` (AnalysisResponse.enriched_fields)
- Audit logging: `services/enhancer.py`

---

#### Story 3.5: Mark Unreliable Extractions as MISSING_DATA — FR13
**Phase:** Enhancer (25-30h)  
**As a** developer  
**I want to** see a clear "MISSING_DATA" status for fields I can't reliably extract  
**So that** I mark them for manual attention instead of inferring wrong values

**Acceptance Criteria:**
- ✅ Confidence <0.70 → field marked as MISSING_DATA with explanation
- ✅ Never invent plausible-sounding values (zero hallucination)
- ✅ Response includes: `{ "error_code": "MISSING_DATA", "reason": "Could not find pattern in logs" }`
- ✅ Integration: `services/enhancer.py::mark_missing_data()`
- ✅ Test: `tests/test_enhancer.py::test_missing_data_marker`

**Inputs from Architecture:**
- Response status field: Part of enriched_fields model
- Hallucination check: FR30 enforcement

---

#### Story 3.6: Sanitize Sensitive Data (PII Scrubbing) — FR14
**Phase:** Enhancer (25-30h)  
**As a** security officer  
**I want to** mask credit card numbers, customer names, emails before embedding  
**So that** sensitive data doesn't leak into embeddings or logs

**Acceptance Criteria:**
- ✅ Pre-processor detects and masks: credit cards (\d{4}-\d{4}-\d{4}-\d{4}), emails ([a-z]+@[a-z]+), phone numbers (\d{3}-\d{3}-\d{4})
- ✅ Masked patterns replaced with [REDACTED_CC], [REDACTED_EMAIL], etc.
- ✅ Integration: `services/preprocessor.py::scrub_pii()`
- ✅ Applied BEFORE embedding generation
- ✅ Test: `tests/test_preprocessor.py::test_pii_scrubbing`

**Inputs from Architecture:**
- Preprocessing pipeline: `services/preprocessor.py` (called by embedder)
- Config: Regex patterns in `backend/config.py`

---

### EPIC 4: Duplicate Detection & Decision Making — FR15-19 (5 Requirements)

**Epic Goal:** Classify defects as DUPLICATE, POSSIBLE_DUPLICATE, or NEW with confidence and evidence.

**Ownership:** Services: `detector.py`, `enhancer.py`  
**Phase:** Judge (11-18h) + Enhancer (25-30h)

#### Story 4.1: Classify Defects into Three Categories — FR15
**Phase:** Judge (11-18h)  
**As a** developer  
**I want to** know if a new defect is a duplicate, possible duplicate, or new issue  
**So that** I can decide on next action

**Acceptance Criteria:**
- ✅ Classification logic: score ≥0.85 → DUPLICATE, 0.70-0.84 → POSSIBLE_DUPLICATE, <0.70 → NEW
- ✅ Response includes: `decision: "DUPLICATE" | "POSSIBLE_DUPLICATE" | "NEW"`
- ✅ Integration: `services/detector.py::classify()`
- ✅ Test: `tests/test_detector.py::test_classification`

**Inputs from Architecture:**
- Thresholds: `backend/config.py`
- Cross-Encoder score: From Story 2.2

---

#### Story 4.2: Provide Confidence Level for Decision — FR16
**Phase:** Judge (11-18h)  
**As a** developer  
**I want to** see how confident the system is in its decision  
**So that** I know whether to trust it

**Acceptance Criteria:**
- ✅ Response includes `confidence` field (0.0-1.0)
- ✅ Confidence = mean of all matched scores (or 0 if NEW)
- ✅ Integration: `services/detector.py::calculate_confidence()`
- ✅ Test: `tests/test_detector.py::test_confidence_calculation`

**Inputs from Architecture:**
- Score aggregation logic: `services/detector.py`
- Response model: Includes confidence field

---

#### Story 4.3: Calibrate Confidence to Actionability Thresholds — FR17
**Phase:** Judge (11-18h)  
**As a** developer  
**I want to** know whether to act immediately, review manually, or discard  
**So that** I have clear guidance on next action

**Acceptance Criteria:**
- ✅ Thresholds defined: High ≥0.90 (auto-act), Medium 0.70-0.89 (review), Low <0.70 (discard)
- ✅ Response includes actionability flag: `actionable: true|false`
- ✅ Integration: `services/detector.py::determine_actionability()`
- ✅ Test: `tests/test_detector.py::test_actionability_thresholds`

**Inputs from Architecture:**
- Thresholds: `backend/config.py` (HIGH_CONFIDENCE=0.90, MEDIUM_CONFIDENCE=0.70)
- Decision logic: `services/detector.py`

---

#### Story 4.4: Return Top-5 Matched Defects — FR18
**Phase:** Judge (11-18h)  
**As a** developer  
**I want to** see the top 5 most similar existing defects when a match is found  
**So that** I can verify the decision and look for edge cases

**Acceptance Criteria:**
- ✅ Response includes `matches` array with up to 5 defects
- ✅ Each match includes: defect_id, title, similarity score, confidence
- ✅ Integration: Direct result from Story 2.2 (Cross-Encoder re-ranking)
- ✅ Test: `tests/test_detector.py::test_top_5_matches`

**Inputs from Architecture:**
- Match data: From FAISS retrieval + Cross-Encoder re-ranking
- Response model: `backend/models/response.py` (matches field)

---

#### Story 4.5: Generate Match Explanation Summary — FR19
**Phase:** Enhancer (25-30h)  
**As a** developer  
**I want to** understand why defects were matched  
**So that** I can evaluate match quality

**Acceptance Criteria:**
- ✅ Summary includes matching attributes: shared error codes, similar titles, same environment, common stack trace patterns
- ✅ Uses extractive approach (cites actual text, not generated)
- ✅ Integration: `services/enhancer.py::generate_summary()`
- ✅ Test: `tests/test_enhancer.py::test_match_summary`

**Inputs from Architecture:**
- Evidence extraction: `services/enhancer.py`
- Response model: Includes summary field

---

### EPIC 5: Intelligent Clustering — FR20-25 (6 Requirements)

**Epic Goal:** Discover natural groupings of related defects using DBSCAN with quality validation.

**Ownership:** Services: `clusterer.py`  
**Phase:** Clerk (19-24h)

#### Story 5.1: Discover Natural Groupings (DBSCAN) — FR20
**Phase:** Clerk (19-24h)  
**As a** QA lead  
**I want to** find groups of related defects automatically  
**So that** I can bulk-triage similar issues together

**Acceptance Criteria:**
- ✅ DBSCAN algorithm with eps=0.35, min_samples=2
- ✅ Clustering runs on all embeddings in vector store
- ✅ Returns cluster assignments for every defect
- ✅ Integration: `services/clusterer.py::cluster_defects()`
- ✅ Test: `tests/test_clusterer.py::test_dbscan_clustering`

**Inputs from Architecture:**
- DBSCAN hyperparameters: `backend/config.py` (DBSCAN_EPS=0.35)
- Embedding dimension: 384-dim
- Clustering latency budget: ~100ms

---

#### Story 5.2: Assign Cluster IDs and Names — FR21
**Phase:** Clerk (19-24h)  
**As a** QA lead  
**I want to** see human-readable cluster names  
**So that** I can reference clusters in conversation

**Acceptance Criteria:**
- ✅ Each cluster assigned UUID cluster_id
- ✅ Human-readable name auto-generated: e.g., "Payment Timeout Cascade", "Database Connection Pool Exhaustion"
- ✅ Name derived from most common error code or dominant module
- ✅ Integration: `services/clusterer.py::assign_cluster_names()`
- ✅ Test: `tests/test_clusterer.py::test_cluster_naming`

**Inputs from Architecture:**
- Cluster model: `backend/models/defect.py` (cluster_id, cluster_name)
- Name generation: Extract from defect titles + error codes

---

#### Story 5.3: Weight Functional Context (No False Positives) — FR22
**Phase:** Clerk (19-24h)  
**As a** QA lead  
**I want to** prevent false-positive clusters where unrelated modules get grouped  
**So that** clusters are meaningful and not noise

**Acceptance Criteria:**
- ✅ Clustering weights functional context: title, module, component get higher importance
- ✅ Raw log similarity alone doesn't create cluster (avoid noise)
- ✅ Test case: Two "timeout" bugs from different modules should NOT cluster
- ✅ Integration: `services/clusterer.py` (distance metric weighting)
- ✅ Test: `tests/test_clusterer.py::test_contextual_clustering`

**Inputs from Architecture:**
- Feature weighting: Custom distance metric in clusterer
- Embedding construction: Title + module Context encoded together

---

#### Story 5.4: Generate Cluster Quality Metric (Silhouette Score) — FR23
**Phase:** Clerk (19-24h)  
**As a** ML engineer  
**I want to** see cluster quality metrics  
**So that** I know which clusters are trustworthy and which are noisy

**Acceptance Criteria:**
- ✅ Calculate Silhouette Score for every clustering result
- ✅ Target: Silhouette ≥0.6 indicates good separation
- ✅ Warn if Silhouette <0.6 (clusters may be noisy)
- ✅ Integration: `services/clusterer.py::validate_clusters()`
- ✅ Test: `tests/test_clusterer.py::test_silhouette_score`

**Inputs from Architecture:**
- Silhouette method: scikit-learn `silhouette_score()`
- Target threshold: ≥0.6 (documented in architecture)

---

#### Story 5.5: Retrieve Clusters with Metadata — FR24
**Phase:** Clerk (19-24h)  
**As a** QA lead  
**I want to** view all discovered clusters  
**So that** I can review groupings and make triage decisions

**Acceptance Criteria:**
- ✅ `GET /api/v1/clusters` endpoint returns all clusters
- ✅ Response includes: cluster_id, cluster_name, defect_count, sample_titles, Silhouette score, quality_indicator
- ✅ Pagination support: `?limit=50&offset=100`
- ✅ Integration: `routers/clusters.py` (endpoint) + `services/clusterer.py` (data)
- ✅ Test: `tests/test_api.py::test_clusters_endpoint`

**Inputs from Architecture:**
- Router: `backend/routers/clusters.py`
- Response model: `backend/models/response.py` (ClusterResponse)

---

#### Story 5.6: Recommend Triage Actions for Clusters — FR25
**Phase:** Clerk (19-24h)  
**As a** QA lead  
**I want to** get recommendations on how to handle each cluster  
**So that** I know what action to take

**Acceptance Criteria:**
- ✅ Recommendations include: "BULK_DEDUP_CANDIDATES" (recommend merging N→M), "SEPARATE_MODULES" (don't group), "REVIEW_MANUAL"
- ✅ Based on cluster size, Silhouette score, and dominant defect types
- ✅ Integration: `services/clusterer.py::recommend_actions()`
- ✅ Test: `tests/test_clusterer.py::test_action_recommendations`

**Inputs from Architecture:**
- Cluster analysis: Silhouette score, size, module distribution
- Response model: Includes recommendation field

---

### EPIC 6: Evidence & Citability (Zero-Hallucination Guarantee) — FR26-30 (5 Requirements)

**Epic Goal:** Guarantee zero hallucination by providing extractive summaries with explicit source citations.

**Ownership:** Services: `enhancer.py`, `detector.py`  
**Phase:** Enhancer (25-30h)

#### Story 6.1: Include Source Citations in Responses — FR26
**Phase:** Enhancer (25-30h)  
**As a** judge  
**I want to** verify every system decision by looking at the original source  
**So that** I trust the system's reasoning

**Acceptance Criteria:**
- ✅ Every decision (duplicate, enriched field, summary) includes source citations
- ✅ Citation format: `{ "source": "defect_id: D123", "text": "Error code: E5432", "location": "line 42 of stack trace" }`
- ✅ Integration: `services/enhancer.py::cite_sources()`
- ✅ Test: `tests/test_enhancer.py::test_source_citations`

**Inputs from Architecture:**
- Citation model: Include in response
- Original data: Stored in defect storage (Story 1.4)

---

#### Story 6.2: Provide Traceable References — FR27
**Phase:** Enhancer (25-30h)  
**As a** judge  
**I want to** trace every citation back to original text with line numbers  
**So that** I can verify accuracy

**Acceptance Criteria:**
- ✅ Citations include line numbers or character offsets
- ✅ Text snippets (10-50 chars) showing exact match
- ✅ Example: `"source": "D123", "snippet": "Error code: E5432", "offset": 142-167`
- ✅ Integration: `services/enhancer.py::create_traceable_references()`
- ✅ Test: `tests/test_enhancer.py::test_traceable_references`

**Inputs from Architecture:**
- Original text: From defect storage
- Snippet extraction: Text slicing with offsets

---

#### Story 6.3: Include Hallucination Check Flag — FR28
**Phase:** Enhancer (25-30h)  
**As a** judge  
**I want to** see an explicit "hallucination check" that confirms no values were invented  
**So that** I have confidence in system trustworthiness

**Acceptance Criteria:**
- ✅ Response includes `hallucination_check` field with:
  - `summary_grounded_in_source: true|false`
  - `all_citations_traceable: true|false`
  - `fields_not_hallucinated: true|false`
- ✅ All three must be true for system to approve decision
- ✅ Integration: `services/enhancer.py::validate_hallucination_check()`
- ✅ Test: `tests/test_enhancer.py::test_hallucination_check_always_true`

**Inputs from Architecture:**
- Validation logic: Mandatory before response
- Response model: Includes hallucination_check dict

---

#### Story 6.4: Use Extractive Summaries Only (No Generation) — FR29
**Phase:** Enhancer (25-30h)  
**As a** developer  
**I want** summaries composed of real text snippets, not AI-generated prose  
**So that** I know summaries are accurate, not plausible-sounding fiction

**Acceptance Criteria:**
- ✅ Summary is concatenation of text snippets from source defects
- ✅ Never uses language model to generate new text
- ✅ Each sentence in summary backed by citation
- ✅ Integration: `services/enhancer.py::create_extractive_summary()`
- ✅ Test: `tests/test_enhancer.py::test_extractive_summary_only`

**Inputs from Architecture:**
- Snippet extraction: From original defect text
- Summary model: Concatenate snippets with attributions

---

#### Story 6.5: Never Invent Missing Field Values — FR30
**Phase:** Enhancer (25-30h)  
**As a** developer  
**I want to** see MISSING_DATA instead of hallucinated values  
**So that** incomplete reports aren't silently completed with guesses

**Acceptance Criteria:**
- ✅ If field cannot be reliably extracted, mark as MISSING_DATA (not inferred)
- ✅ Include explanation: "Could not find pattern in error logs"
- ✅ Never return plausible-sounding guesses
- ✅ Integration: `services/enhancer.py::mark_missing_data()`
- ✅ Test: `tests/test_enhancer.py::test_no_hallucinated_fields`
- ✅ Cross-check with FR13 (same intent, different perspective)

**Inputs from Architecture:**
- Confidence thresholds: MIN_EXTRACTION_CONFIDENCE=0.85
- Fallback: MISSING_DATA status code

---

### EPIC 7: Audit Logging & Compliance — FR31-36 (6 Requirements)

**Epic Goal:** Log every decision, enrichment, and approval in compliance-ready format for regulatory audit.

**Ownership:** Services: `enhancer.py`, `routers/*.py`  
**Phase:** Enhancer (25-30h)

#### Story 7.1: Log Decisions with Full Context — FR31
**Phase:** Enhancer (25-30h)  
**As a** compliance officer  
**I want to** audit every system decision  
**So that** I can verify decisions are justified and traceable

**Acceptance Criteria:**
- ✅ Log format (JSONL): `{ "timestamp": "2026-03-05T14:30:00Z", "action": "DUPLICATE_DETECTED", "defect_id": "D123", "matched_defect_id": "D456", "confidence": 0.92, "actor": "SYNTHETIX_v1", "rationale": "..." }`
- ✅ Logged to: `logs/audit.jsonl` (append-only)
- ✅ Integration: `backend/utils/logger.py::log_decision()`
- ✅ Test: `tests/test_api.py::test_decision_logging`

**Inputs from Architecture:**
- Logger: loguru + JSON formatter
- Response timestamp: ISO 8601 format
- Audit file: Docker volume mount `logs/audit.jsonl`

---

#### Story 7.2: Log All Enriched Fields with Metadata — FR32
**Phase:** Enhancer (25-30h)  
**As a** compliance officer  
**I want to** audit every field enrichment  
**So that** I know which fields were inferred and by whom

**Acceptance Criteria:**
- ✅ Log entry for each enriched field: `{ "timestamp": "...", "action": "FIELD_ENRICHED", "defect_id": "D123", "field_name": "error_code", "inferred_value": "E5432", "confidence": 0.92, "source": "stack_trace_line_5", "approval_status": "AUTO_APPROVED", "approver": "SYNTHETIX_v1" }`
- ✅ Integration: `services/enhancer.py::log_field_enrichment()`
- ✅ Test: `tests/test_api.py::test_field_enrichment_logging`

**Inputs from Architecture:**
- Field metadata: From enrichment response
- Logger: `backend/utils/logger.py`

---

#### Story 7.3: Log Bulk Approval Workflows — FR33
**Phase:** Enhancer (25-30h)  
**As a** compliance officer  
**I want to** see who approved which bulk deduplication actions  
**So that** I can audit decision authority

**Acceptance Criteria:**
- ✅ Log entry per bulk approval: `{ "timestamp": "...", "action": "BULK_DEDUP_APPROVED", "cluster_id": "C456", "approver": "qa_lead_john", "defects_to_merge": ["D123", "D124", "D125"], "parent_defect_id": "D123", "notes": "Confirmed identical root cause" }`
- ✅ Integration: `routers/clusters.py::POST /clusters/{clusterId}/approve-dedup`
- ✅ Test: `tests/test_api.py::test_approval_logging`

**Inputs from Architecture:**
- Approval endpoint: `backend/routers/clusters.py`
- Logger: `backend/utils/logger.py`

---

#### Story 7.4: Make Audit Logs Immutable and Queryable — FR34
**Phase:** Enhancer (25-30h)  
**As a** compliance officer  
**I want to** query audit logs by action, defect ID, date range, or approver  
**So that** I can verify compliance during audits

**Acceptance Criteria:**
- ✅ Audit log file is append-only (no DELETE/UPDATE)
- ✅ Query endpoint: `GET /api/v1/audit-log?action=DUPLICATE_DETECTED&date_start=2026-03-05&date_end=2026-03-06&approver=john`
- ✅ Response returns matching audit entries (paginated)
- ✅ Integration: `routers/analyze.py::GET /audit-log`
- ✅ Test: `tests/test_api.py::test_audit_log_query`

**Inputs from Architecture:**
- Audit file: JSONL format (append-only)
- Query logic: Filter in-memory JSON lines
- Router: `backend/routers/analyze.py`

---

#### Story 7.5: Enforce Segregation of Duties — FR35
**Phase:** Enhancer (25-30h)  
**As a** compliance officer  
**I want to** see clear separation between system proposal and human approval  
**So that** no single actor has unchecked authority

**Acceptance Criteria:**
- ✅ System proposes: DBSCAN clusters, bulk merge recommendations
- ✅ QA Lead reviews and approves: `POST /clusters/{clusterId}/approve-dedup`
- ✅ Both actions logged separately with distinct actors
- ✅ Integration: `routers/clusters.py` (two-step flow)
- ✅ Test: `tests/test_api.py::test_segregation_of_duties`

**Inputs from Architecture:**
- Two-step workflow: Proposal (system) + Approval (human)
- Logger tracks both steps

---

#### Story 7.6: Enforce Human Approval Gates — FR36
**Phase:** Enhancer (25-30h)  
**As a** compliance officer  
**I want to** ensure no bulk changes happen without explicit human approval  
**So that** humans retain final control

**Acceptance Criteria:**
- ✅ Bulk deduplication requires human approval via `POST /clusters/{clusterId}/approve-dedup`
- ✅ System cannot auto-execute merges (no background job)
- ✅ Unapproved recommendations stored but not applied
- ✅ Integration: `routers/clusters.py` (approval gate)
- ✅ Test: `tests/test_api.py::test_approval_gate_required`

**Inputs from Architecture:**
- Approval endpoint: Required before any bulk action
- Audit trail: Captures both proposal and approval

---

### EPIC 8: API Access & Integration — FR37-46 (10 Requirements)

**Epic Goal:** Expose 5 RESTful endpoints with validated input, consistent response format, and OpenAPI documentation.

**Ownership:** All routers + `routers/*.py`  
**Phase:** Skeleton (4h) + all phases (integration)

#### Story 8.1: Expose 5 RESTful API Endpoints — FR37
**Phase:** Skeleton (4h) + ongoing integration  
**As a** developer  
**I want to** call REST endpoints with JSON requests  
**So that** I can integrate Synthetix with my tools

**Acceptance Criteria:**
- ✅ 5 endpoints implemented: POST /analyze, POST /ingest, GET /clusters, POST /clusters/{id}/approve-dedup, GET /audit-log
- ✅ Proper HTTP verbs (POST for mutations, GET for queries)
- ✅ Consistent base path: `/api/v1/`
- ✅ Integration: `backend/routers/*.py`
- ✅ Test: `tests/test_api.py::test_endpoint_structure`

**Inputs from Architecture:**
- Router files: analyze.py, ingest.py, clusters.py
- Base path: Configured in `main.py`

---

#### Story 8.2: Implement POST /analyze Endpoint — FR38
**Phase:** Skeleton (4h) + Brain + Judge + Enhancer (all phases)  
**As a** developer  
**I want to** submit a single defect and get back decision + enrichment  
**So that** I can analyze individual bugs

**Acceptance Criteria:**
- ✅ `POST /api/v1/analyze` accepts JSON defect (title, description, etc.)
- ✅ Returns: AnalysisResponse with decision, confidence, matches, enriched_fields, audit_entry_id
- ✅ Latency: <500ms (p95)
- ✅ Integration: `routers/analyze.py` (endpoint) + all 5 services
- ✅ Test: `tests/test_api.py::test_analyze_endpoint`

**Inputs from Architecture:**
- Request model: DefectRequest in models
- Response model: AnalysisResponse in models
- Latency budget: 30+40+250+100+80 = 500ms

---

#### Story 8.3: Implement POST /ingest Endpoint — FR39
**Phase:** Skeleton (4h) + Brain (integration)  
**As a** QA lead  
**I want to** upload bulk defect data (CSV/JSON)  
**So that** I can populate the database

**Acceptance Criteria:**
- ✅ `POST /api/v1/ingest` accepts file upload (CSV or JSON)
- ✅ Returns: IngestResponse with count_success, count_failed, errors list
- ✅ Process up to 1000 defects, support batch continuation
- ✅ Integration: `routers/ingest.py` + services/preprocessor, embedder
- ✅ Test: `tests/test_api.py::test_ingest_endpoint`

**Inputs from Architecture:**
- Request model: FileUpload request
- Response model: IngestResponse (success/error counts)
- Async processing: FastAPI BackgroundTasks

---

#### Story 8.4: Implement GET /clusters Endpoint — FR40
**Phase:** Skeleton (4h) + Clerk (integration)  
**As a** QA lead  
**I want to** retrieve all discovered clusters  
**So that** I can review and manage groupings

**Acceptance Criteria:**
- ✅ `GET /api/v1/clusters?limit=50&offset=100` returns cluster list
- ✅ Response: ClusterList with pagination metadata
- ✅ Latency: <1000ms for 1000 defects
- ✅ Integration: `routers/clusters.py` (endpoint) + services/clusterer
- ✅ Test: `tests/test_api.py::test_clusters_endpoint`

**Inputs from Architecture:**
- Response model: ClusterList with ClusterInfo items
- Pagination: limit, offset parameters

---

#### Story 8.5: Implement POST /clusters/{id}/approve-dedup Endpoint — FR41
**Phase:** Skeleton (4h) + Enhancer (integration)  
**As a** QA lead  
**I want to** approve bulk deduplication recommendations  
**So that** I control when merges happen

**Acceptance Criteria:**
- ✅ `POST /api/v1/clusters/{clusterId}/approve-dedup` with approver name
- ✅ Request: `{ "approver_name": "john", "notes": "..." }`
- ✅ Returns: ApprovalResponse with approval_timestamp, logged_audit_entry_id
- ✅ Integration: `routers/clusters.py` + services/enhancer (logging)
- ✅ Test: `tests/test_api.py::test_approve_dedup_endpoint`

**Inputs from Architecture:**
- Request model: ApprovalRequest
- Response model: ApprovalResponse
- Logging: Audit entry created

---

#### Story 8.6: Implement GET /audit-log Endpoint — FR42
**Phase:** Skeleton (4h) + Enhancer (integration)  
**As a** compliance officer  
**I want to** query audit logs by action, defect, date, approver  
**So that** I can audit system decisions

**Acceptance Criteria:**
- ✅ `GET /api/v1/audit-log?action=DUPLICATE_DETECTED&defect_id=D123&date_start=2026-03-05&approver=john`
- ✅ Returns: AuditLogResponse with matching entries (paginated)
- ✅ Supports filtering by all four attributes (or none = return all)
- ✅ Integration: `routers/analyze.py` + audit log file
- ✅ Test: `tests/test_api.py::test_audit_log_endpoint`

**Inputs from Architecture:**
- Audit file: `logs/audit.jsonl`
- Query logic: Filter JSON lines
- Response model: AuditLogResponse

---

#### Story 8.7: Return Proper HTTP Status Codes — FR43
**Phase:** Skeleton (4h) + all phases (validation)  
**As a** developer  
**I want to** see meaningful HTTP status codes and error messages  
**So that** I know what went wrong

**Acceptance Criteria:**
- ✅ 200 OK: Successful request
- ✅ 400 Bad Request: Malformed JSON
- ✅ 422 Unprocessable Entity: Validation error (field-level details)
- ✅ 500 Server Error: Internal error (with error_code and message)
- ✅ Integration: FastAPI exception handlers
- ✅ Test: `tests/test_api.py::test_http_status_codes`

**Inputs from Architecture:**
- Exception handling: `backend/utils/exceptions.py`
- FastAPI error handlers: Automatic validation responses

---

#### Story 8.8: Validate Request Input with Clear Error Messages — FR44
**Phase:** Skeleton (4h) + all phases  
**As a** developer  
**I want to** see field-level error messages when my request is invalid  
**So that** I can fix it quickly

**Acceptance Criteria:**
- ✅ 422 response includes: `{ "detail": [{ "loc": ["body", "title"], "msg": "field required", "type": "type_error" }] }`
- ✅ Covers: missing fields, wrong types, oversized values
- ✅ Integration: Pydantic validation (automatic)
- ✅ Test: `tests/test_api.py::test_validation_errors`

**Inputs from Architecture:**
- Request models: Pydantic in `backend/models/`
- FastAPI error handling: Automatic

---

#### Story 8.9: Use Consistent JSON Response Schema — FR45
**Phase:** Skeleton (4h) + all phases  
**As a** developer  
**I want to** know the exact response structure for every endpoint  
**So that** I can parse responses reliably

**Acceptance Criteria:**
- ✅ All responses follow consistent format: `{ "status": "success|error", "data": {...}, "metadata": {...} }`
- ✅ All responses include timestamps (ISO 8601)
- ✅ All decision responses include confidence, citations, hallucination_check
- ✅ Integration: Response models in `backend/models/response.py`
- ✅ Test: `tests/test_api.py::test_response_consistency`

**Inputs from Architecture:**
- Base response model: ResponseBase
- Specific models: AnalysisResponse, IngestResponse, ClusterResponse

---

#### Story 8.10: Auto-generate OpenAPI Specification — FR46
**Phase:** Skeleton (4h) + all phases  
**As a** developer  
**I want to** see full API documentation at `/docs` and `/openapi.json`  
**So that** I can explore the API interactively

**Acceptance Criteria:**
- ✅ FastAPI auto-generates OpenAPI at `/openapi.json`
- ✅ Swagger UI at `/docs` with interactive "Try it out"
- ✅ Includes all request/response schemas
- ✅ All endpoints documented with descriptions
- ✅ Integration: FastAPI built-in (automatic with Pydantic models)
- ✅ Test: `tests/test_api.py::test_openapi_generation`

**Inputs from Architecture:**
- FastAPI auto-documentation: Enabled by default
- Model docstrings: Used in OpenAPI spec

---

### EPIC 9: Trust & Regulatory Compliance — FR47-50 (4 Requirements)

**Epic Goal:** Ensure 100% on-premise execution with zero cloud API calls and complete chain-of-evidence traceability.

**Ownership:** Architecture + all services  
**Phase:** Skeleton (4h) + all phases

#### Story 9.1: Ensure On-Premise Execution (Zero External APIs) — FR47
**Phase:** Skeleton (4h) + all phases  
**As a** security officer  
**I want to** ensure all processing stays on-premise  
**So that** no defect data leaves our infrastructure

**Acceptance Criteria:**
- ✅ Embeddings: sentence-transformers (runs locally, no API)
- ✅ Cross-Encoder: runs locally (no API)
- ✅ FAISS: runs locally (no API)
- ✅ Zero egress to OpenAI, HuggingFace, cloud LLMs
- ✅ Integration: All services import local models only
- ✅ Test: `tests/test_api.py::test_no_external_api_calls` (network monitoring)

**Inputs from Architecture:**
- Configuration: No API keys in system
- Models: Downloaded at build time (Dockerfile)
- Deployment: Docker container (isolated)

---

#### Story 9.2: Store All Data Locally — FR48
**Phase:** Skeleton (4h) + all phases  
**As a** security officer  
**I want to** verify defect data never leaves the system  
**So that** PII is protected

**Acceptance Criteria:**
- ✅ Defects stored in: `data/defects.jsonl` (local file)
- ✅ Embeddings stored in: `data/models/faiss.index` (local file)
- ✅ Audit logs stored in: `logs/audit.jsonl` (Docker volume)
- ✅ Zero network transmission of defect content
- ✅ Integration: All data ops use local file I/O
- ✅ Test: Network monitoring during test run (verify no egress)

**Inputs from Architecture:**
- Data directory: `backend/data/`
- Docker volumes: Mount local directories
- No cloud database clients (PostgreSQL, DynamoDB, etc.)

---

#### Story 9.3: Implement PII Scrubbing — FR49
**Phase:** Skeleton (4h) + Enhancer  
**As a** security officer  
**I want to** mask sensitive data before embedding  
**So that** PII doesn't leak into vector store

**Acceptance Criteria:**
- ✅ Pre-processor detects: credit cards, phone numbers, emails, names
- ✅ Masked patterns: [REDACTED_CC], [REDACTED_EMAIL], [REDACTED_PHONE], [REDACTED_NAME]
- ✅ Applied BEFORE embedding generation
- ✅ Original data preserved in defect storage (but not embedded)
- ✅ Integration: `services/preprocessor.py::scrub_pii()` (called by embedder)
- ✅ Test: `tests/test_preprocessor.py::test_pii_scrubbing`

**Inputs from Architecture:**
- Regex patterns: `backend/config.py`
- Preprocessing pipeline: `services/preprocessor.py`

---

#### Story 9.4: Provide Chain-of-Evidence Traceability — FR50
**Phase:** Enhancer (25-30h)  
**As a** auditor  
**I want to** trace every decision through audit logs back to original input  
**So that** no decision is opaque

**Acceptance Criteria:**
- ✅ Every decision has audit log entry with timestamp, actor, rationale
- ✅ Every enriched field has source reference and confidence
- ✅ Every citation points to defect_id + line number + text snippet
- ✅ Audit log accessible via `GET /api/v1/audit-log`
- ✅ Complete chain: Input → Decision → Enrichment → Approval → Log
- ✅ Integration: All services call `logger.py` consistently
- ✅ Test: `tests/test_api.py::test_chain_of_evidence`

**Inputs from Architecture:**
- Audit logging: `backend/utils/logger.py`
- Citation model: Part of AnalysisResponse
- Hallucination check: Mandatory in response

---

## STORY MAPPING TO PHASES

### Phase 1: Skeleton (0-4 hours)

**Goal:** Initialize FastAPI project, define models and routes.

| Story | Epic | Requirement | Effort |
|---|---|---|---|
| 1.1 | Data Mgmt | FR1 - Ingest from CSV/JSON | 2h |
| 1.2 | Data Mgmt | FR2 - Store with unique IDs | 1h |
| 8.1-8.10 | API | FR37-46 - App setup + route stubs | 1h |
| 9.1 | Compliance | FR47 - No external APIs (arch) | 0.5h |
| 9.2 | Compliance | FR48 - Local storage (init) | 0.5h |

**Total:** ~4h  
**Deliverables:** FastAPI app runs, 5 empty routes, Pydantic models, config.py

---

### Phase 2: Brain (5-10 hours)

**Goal:** Data loading, embeddings, FAISS indexing.

| Story | Epic | Requirement | Effort |
|---|---|---|---|
| 1.3 | Data Mgmt | FR3 - Generate embeddings | 3h |
| 2.1 | Semantic | FR5 - FAISS retrieval | 2h |
| 3.1 | Enrichment | FR9 - Detect missing fields (prep) | 1h |

**Total:** ~6h  
**Deliverables:** FAISS index populated, embeddings for all defects, top-5 retrieval working

**Latency Check:** FAISS ≤40ms + Embedding ≤40ms = ✅ Within budget

---

### Phase 3: Judge (11-18 hours)

**Goal:** Cross-Encoder re-ranking, duplicate detection, confidence scoring.

| Story | Epic | Requirement | Effort |
|---|---|---|---|
| 2.2 | Semantic | FR6 - Cross-Encoder re-ranking | 2h |
| 2.3 | Semantic | FR7 - Similarity scores | 1h |
| 2.4 | Semantic | FR8 - Multi-dimension comparison | 1h |
| 4.1 | Detection | FR15 - Classify (DUPLICATE/POSSIBLE/NEW) | 1h |
| 4.2 | Detection | FR16 - Confidence calculation | 1h |
| 4.3 | Detection | FR17 - Actionability thresholds | 1h |
| 4.4 | Detection | FR18 - Top-5 matches | 0.5h |
| 3.2 | Enrichment | FR10 - Extract fields (prep) | 2h |
| 9.3 | Compliance | FR49 - PII scrubbing (implement) | 1.5h |

**Total:** ~11.5h  
**Deliverables:** Cross-Encoder scoring, duplicate classification with confidence, field extraction patterns

**Latency Check:** Cross-Encoder ≤250ms, total pipeline ≤500ms ✅

---

### Phase 4: Clerk (19-24 hours)

**Goal:** DBSCAN clustering, cluster quality validation, triage recommendations.

| Story | Epic | Requirement | Effort |
|---|---|---|---|
| 5.1 | Clustering | FR20 - DBSCAN clustering | 2h |
| 5.2 | Clustering | FR21 - Cluster naming | 1h |
| 5.3 | Clustering | FR22 - Contextual weighting | 1.5h |
| 5.4 | Clustering | FR23 - Silhouette validation | 1h |
| 5.5 | Clustering | FR24 - Cluster retrieval endpoint | 1h |
| 5.6 | Clustering | FR25 - Action recommendations | 1h |

**Total:** ~7.5h  
**Deliverables:** Complete clustering pipeline, quality validation, /clusters endpoint live

---

### Phase 5: Enhancer (25-30 hours)

**Goal:** Field extraction, audit logging, evidence citations, compliance features.

| Story | Epic | Requirement | Effort |
|---|---|---|---|
| 3.2-3.6 | Enrichment | FR10-14 - Extraction, confidence, metadata, missing data, PII | 3h |
| 4.5 | Detection | FR19 - Match summaries | 1.5h |
| 6.1-6.5 | Evidence | FR26-30 - Citations, traceability, hallucination check, extractive summaries, no invented fields | 2.5h |
| 7.1-7.6 | Audit | FR31-36 - Decision logging, field logging, approval logging, queryability, segregation, gates | 2h |
| 8.2-8.10 | API | FR38-46 - Endpoint integration, error handling, consistency | 1.5h |
| 9.1, 9.4 | Compliance | FR47, FR50 - Verify on-premise, chain-of-evidence | 1h |

**Total:** ~11.5h  
**Deliverables:** Complete enrichment pipeline, audit logging, evidence traces, all endpoints live, tests passing

---

## ACCEPTANCE CRITERIA FRAMEWORK

Every story must satisfy:

1. **Functional Completeness** — Feature works as described
2. **Architecture Alignment** — Uses patterns from architecture.md Section 13
3. **Testing** — At least one test in `tests/test_*.py`
4. **Documentation** — Code comments + method docstrings
5. **Logging** — Decision/error logged appropriately
6. **Performance** — Meets latency budget (if applicable)
7. **No Hallucinations** — Evidence-based, extractive only
8. **Audit Trail** — Decision is traceable

---

## STORY DEPENDENCIES & CRITICAL PATH

**Critical Path (Determines Timeline):**

1. **Story 1.1 + 1.2** (Ingest, store) → 0-4h
2. **Story 1.3** (Embeddings) → 5-10h (depends on 1.1)
3. **Story 2.1** (FAISS) → 5-10h (depends on 1.3)
4. **Story 2.2-2.4** (Re-rank, classify) → 11-18h (depends on 2.1)
5. **Story 5.1-5.6** (Clustering) → 19-24h (depends on 1.3)
6. **Story 3.2-3.6, 6.1-6.5, 7.1-7.6** (Enrichment, logging) → 25-30h (depends on 2.2-2.4)

**Parallel Development:**
- Stories within same phase can run in parallel (depend only on upstream phases)
- Phase 1 and Phase 2 stories can overlap slightly (prepare Phase 2 code while Phase 1 executes)

---

## NEXT STEP: SPRINT PLANNING (PHASE 4, STEP 1)

This epic-and-story breakdown is input to Sprint Planning:
- Allocate developer time across 5 phases
- Assign team members to critical-path stories
- Define 30-hour budget allocation
- Identify risks and contingencies

**Ready for Phase 4: Sprint Planning** ✅

---

**Document Status:** ✅ STORIES MAPPED - READY FOR SPRINT PLANNING

Last Updated: 2026-03-05
