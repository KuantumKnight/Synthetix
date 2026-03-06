---
project_name: 'Synthetix'
user_name: 'Sarvesh M'
date: '2026-03-05'
sections_completed: ['technology_stack', 'project_overview', 'discovered_patterns']
existing_patterns_found: 12
discovery_status: 'in_progress'
next_step: 'user_approval'
---

# Project Context for AI Agents — Synthetix

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Language & Runtime**
- Python 3.12
- Platform: Windows (cross-platform compatible)

**Core Framework**
- FastAPI 0.115.0 (async web framework)
- Uvicorn 0.30.0 (ASGI server)
- Starlette 0.38.6 (underlying async framework)

**Machine Learning & NLP**
- PyTorch 2.3.1 (deep learning, downgraded for Windows DLL compatibility)
- sentence-transformers 3.0.0 (embeddings model: `sentence-transformers/all-MiniLM-L6-v2`)
  - Embedding dimension: 384 (DO NOT CHANGE - hardcoded in services)
- transformers 4.44.0 (HuggingFace models)
- spaCy 3.7.5 (NLP utilities, optional integration)

**Vector Database & Data**
- ChromaDB 0.5.5 (vector DB) — BUT with fallback: in-memory JSON persistence if ChromaDB unavailable
  - Collection name: `defect_reports`
  - Persistence path: `./chroma_db/`
- Pandas 2.2.2 (data processing)
- NumPy 1.26.4 (numerical operations)
- scikit-learn 1.5.1 (clustering: DBSCAN)

**API & Data Validation**
- Pydantic 2.8.0 (request/response validation, Settings)
- python-multipart 0.0.9 (file upload handling)

**Utilities**
- python-dotenv 1.0.1 (environment variables)
- loguru 0.7.2 (structured logging)

**Testing**
- pytest 8.3.2 (test framework)
- pytest-asyncio 0.23.8 (async test support)
- httpx 0.27.0 (async HTTP client for testing)

---

## Project Overview & Architecture

**Purpose**
Synthetix is a Duplicate Defect Finder & Bug Report Enhancer. It:
- Detects duplicate defect reports using semantic embeddings
- Assigns cluster IDs using DBSCAN clustering
- Suggests missing fields in bug reports
- Generates enhanced summaries (via BART model)

**Core Components**

| Component | File | Responsibility |
|-----------|------|---|
| **EmbeddingService** | `backend/services/embedder.py` | Generate embeddings using sentence-transformers, batch processing |
| **VectorStore** | `backend/services/vector_store.py` | Store/search embeddings (ChromaDB + in-memory fallback) |
| **DuplicateDetector** | `backend/services/detector.py` | Classify matches (duplicate vs possible vs new) |
| **ClusteringService** | `backend/services/clusterer.py` | Run DBSCAN clustering on all defects |
| **TextNormalizer** | `backend/services/preprocessor.py` | Normalize text (lowercase, remove URLs, stop words, etc.) |
| **API Routes** | `backend/routers/` | expose /ingest, /analyze, /clusters endpoints |

**Configuration**
- Central: `backend/config.py` → `Settings` class (Pydantic)
- Key thresholds:
  - `DUPLICATE_THRESHOLD: 0.90` (similarity score ≥ 0.90 = duplicate)
  - `POSSIBLE_DUPLICATE_THRESHOLD: 0.75` (0.75-0.89 = possible duplicate)
  - `TOP_K_MATCHES: 5` (return top 5 similar defects)
  - `DBSCAN_EPS: 0.35` (clustering distance threshold)
  - `DBSCAN_MIN_SAMPLES: 2` (min samples for a cluster core point)

**Data Model**
- `DefectReport` (Pydantic model): `defect_id`, `title`, `description`, `steps`, `expected`, `actual`, `environment`, `logs`
- Required: `defect_id`, `title`, `description`
- Optional: `steps`, `expected`, `actual`, `environment`, `logs`

---

## Critical Implementation Rules

### 1. **Embedding & Vector Store**

**⚠️ CRITICAL:**
- Embedding dimension is **384** (from `all-MiniLM-L6-v2`). Hardcoded in multiple services.
- ChromaDB may fail on Windows due to missing C++ build tools. **Always check if HAS_CHROMADB is True** before using ChromaDB APIs.
- If ChromaDB unavailable, system falls back to in-memory JSON store (`vector_store.py` has dual implementation).
- **When adding embeddings:** Always batch them using `encode_batch()` for performance (batch_size=32).
- **Never call:** `_collection.get()` without error handling—ChromaDB can fail silently.

**Cosine Similarity Interpretation:**
- 0.90+ = Definite duplicate (high confidence)
- 0.75-0.89 = Possible duplicate (review recommended)
- <0.75 = New/unique defect

### 2. **Text Normalization Pipeline**

**Order matters:**
1. Lowercase
2. Remove URLs (`http://`, `www.`)
3. Remove file paths (`C:\...`, `/path/to/file`)
4. Remove stack trace line numbers (`at module.py:123`)
5. Remove hex addresses (`0x12ab4def`)
6. Remove email addresses
7. Remove special characters (keep alphanumeric + spaces)
8. Remove stop words (lightweight list in `STOP_WORDS` set)
9. Remove extra whitespace

**RULE:** Always normalize input AND query embeddings using the same `TextNormalizer` instance (it's stateless).

### 3. **Pydantic & Validation**

- All request models inherit from `BaseModel` with explicit `Field()` metadata.
- Use `Field(..., description="...", examples=[...])` for FastAPI/OpenAPI docs.
- Response models should include `Field(..., description="...")` even if not required.
- Use `Optional[type]` for nullable fields, not `type | None` (Python 3.10+ syntax may conflict with Pydantic in older versions).

### 4. **Service Architecture**

**Singleton Pattern Used:**
```python
class ServiceName:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

**Do NOT instantiate multiple times in a request.** Reuse singleton instance:
```python
embedder = EmbeddingService()  # Always returns same instance
```

### 5. **Async/Await Patterns**

- All FastAPI route handlers are `async def`
- File upload handled with `async def ingest_dataset(file: UploadFile = File(...))` 
- Do NOT call blocking operations directly—wrap with executor or use async library
- Exception: `sentence_transformers.encode()` is blocking but acceptable in routes (model inference is heavy operation)

### 6. **Logging**

**Use loguru, not print():**
```python
from backend.utils.logger import get_logger
log = get_logger("module_name")
log.info("Message")
log.error("Error", extra={"detail": value})
```

**Log levels:**
- `info()` — normal operation, milestones
- `warning()` — unexpected but recoverable (e.g., ChromaDB fallback)
- `error()` — actual failures, exceptions

### 7. **Error Handling**

- Define custom exceptions in `backend/utils/exceptions.py`
- Inherit from `SynthetixException`
- Always provide:
  - `message` (user-facing)
  - `detail` (technical details)
  - HTTP status code via `handle_synthetix_error()`

**Example:**
```python
raise VectorStoreError(
    message="Failed to add defects",
    detail=str(e),  # Exception details
)
```

### 8. **File Upload & Ingestion**

- Supported formats: CSV, JSON
- CSV parsed with `csv.DictReader` → list of dicts (keys lowercase, trimmed)
- JSON can be array `[{...}]` or object with `defects` key
- **Batch embeddings** after normalization, before storage
- Return `IngestResponse` with counts: `total_ingested`, `total_skipped`, `clusters_formed`

### 9. **Clustering (DBSCAN)**

- Uses sklearn's `DBSCAN` on normalized embeddings
- Parameters: `eps=0.35`, `min_samples=2`
- Returns cluster IDs: -1 = noise/outlier, 0+ = cluster ID
- Always update defect metadata with `cluster_id` after clustering
- RULE: Clustering is optional but recommended for large datasets (100+ defects)

### 10. **API Response Format**

- All responses use Pydantic models with consistent structure
- Include HTTP status codes: 200 (success), 400 (bad request), 500 (server error)
- Error responses: use FastAPI's `HTTPException(status_code=..., detail=...)`
- Success responses: return model directly, FastAPI serializes to JSON

### 11. **Testing Patterns**

- Location: `backend/tests/`
- File naming: `test_*.py` (pytest auto-discovery)
- Class naming: `Test*` (grouping related tests)
- Method naming: `test_*` (each test case)
- Structure:
  ```python
  def test_something(self):
      # Arrange
      input_data = ...
      # Act
      result = function(input_data)
      # Assert
      assert result == expected
  ```
- Use `pytest.mark.parametrize()` for boundary conditions
- Mock external services (embedder, vector store) in unit tests
- Use `TestClient` from FastAPI for API testing

### 12. **Configuration & Environment**

- All configs in `backend/config.py` via `Settings` class
- **NO hardcoded values** in services/routes
- Access via `from backend.config import settings` then `settings.SETTING_NAME`
- Environment variables: use `.env` file (via python-dotenv)
- Paths use `Path` from pathlib (cross-platform)

---

## Code Organization & Conventions

**Directory Structure:**
```
backend/
├── config.py              # Settings (Pydantic)
├── main.py                # FastAPI app + middleware + lifespan
├── models/                # Pydantic request/response schemas
│   └── defect.py
├── routers/               # API route handlers
│   ├── ingest.py
│   ├── analyze.py
│   └── clusters.py
├── services/              # Business logic (singleton services)
│   ├── embedder.py
│   ├── detector.py
│   ├── clusterer.py
│   ├── vector_store.py
│   ├── preprocessor.py
│   └── enhancer.py        # Summarization (optional)
├── utils/                 # Helpers
│   ├── logger.py
│   ├── exceptions.py
│   └── errors.py
└── tests/                 # Test suite
    ├── test_api.py
    ├── test_detector.py
    └── test_preprocessor.py
```

**Naming Conventions:**
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions/methods: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_leading_underscore`
- Pydantic fields: `snake_case` with type hints

**Docstring Style:**
```python
def function(param: str) -> dict:
    """
    Short description (one line).
    
    Longer description if needed (context, purpose).
    
    Args:
        param: Description of param.
    
    Returns:
        Description of return value.
    """
```

---

## Known Issues & Workarounds

1. **ChromaDB Windows DLL Error**
   - Issue: `fbgemm.dll` not found when ChromaDB is unavailable
   - Workaround: Vector store has in-memory fallback. Don't require ChromaDB on first deploy.
   - Fix: Install Microsoft C++ Build Tools if ChromaDB is critical

2. **PyTorch Compatibility**
   - Current version: 2.3.1 (downgraded from 2.4.0 for Windows stability)
   - Keep this version unless you test on target deployment platform

3. **Embedding Model Loading**
   - First call to `EmbeddingService()` downloads model from HuggingFace (~400MB)
   - Subsequent calls reuse cached model (fast)
   - Design: Lazy-load in `_ensure_model()` on first request

---

## Next Steps for Project Context

**To be completed in Step 2:**
- [ ] Database schema & persistence rules
- [ ] API endpoint specifications & response formats (if not auto-documented)
- [ ] Performance targets & optimization rules
- [ ] Security rules (input validation, CORS, auth if any)
- [ ] Deployment & environment-specific rules

---

## Document Metadata

- **Created:** 2026-03-05 (Discovery Phase)
- **Status:** In Progress — ready for user review
- **Next:** Load Step 2 after user approval
- **Sections Completed:** Technology Stack, Project Overview, Discovered Patterns, Critical Rules
- **Patterns Found:** 12 implementation patterns
- **Sections to Generate:** Database, API specifications, Performance, Security
