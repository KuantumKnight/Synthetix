# 🧬 SYNTHETIX – Duplicate Defect Finder & Bug Report Enhancer

<div align="center">

**AI-Powered defect deduplication, smart clustering, and report enhancement**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-Transformers-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20DB-FF6F00?style=for-the-badge)](https://www.trychroma.com)

</div>

---

## 📋 Overview

**Synthetix** solves the real-world problem of duplicate bug reports flooding defect tracking systems. It uses:

- **Sentence-Transformers** (`all-MiniLM-L6-v2`) for semantic embeddings
- **ChromaDB** for persistent vector similarity search
- **DBSCAN** clustering for automatic defect grouping
- **BART/DistilBART** for AI-powered report summarization
- **FastAPI** for a production-ready REST API
- **Three.js** for a jaw-dropping 3D cyberpunk frontend

### What It Does

| Feature | Description |
|---------|-------------|
| 🔍 **Duplicate Detection** | Semantic similarity search with threshold-based classification |
| 🧬 **Smart Clustering** | DBSCAN groups related defects automatically |
| ✨ **Report Enhancement** | Missing field detection + AI summary generation |
| 🎯 **Zero Hallucination** | All outputs grounded in dataset evidence only |

---

## 🏗️ Architecture

```
synthetix/
├── backend/
│   ├── main.py                 # FastAPI application entry
│   ├── config.py               # Settings & constants
│   ├── models/
│   │   └── defect.py           # Pydantic request/response schemas
│   ├── services/
│   │   ├── preprocessor.py     # Text normalization & field validation
│   │   ├── embedder.py         # HuggingFace sentence-transformers
│   │   ├── vector_store.py     # ChromaDB vector database
│   │   ├── detector.py         # Duplicate detection engine
│   │   ├── clusterer.py        # DBSCAN clustering
│   │   └── enhancer.py         # Report enhancement & AI summary
│   ├── routers/
│   │   ├── analyze.py          # POST /api/analyze
│   │   ├── ingest.py           # POST /api/ingest
│   │   └── clusters.py         # GET /api/clusters + /api/health
│   ├── utils/
│   │   ├── logger.py           # Structured logging (loguru)
│   │   └── exceptions.py       # Custom exception hierarchy
│   └── tests/
│       ├── test_preprocessor.py
│       ├── test_detector.py
│       └── test_api.py
├── frontend/
│   ├── index.html              # SPA with 4 pages
│   ├── styles.css              # Cyberpunk glassmorphism design
│   └── app.js                  # Three.js 3D effects + API integration
├── data/
│   └── sample_defects.json     # 20 realistic sample defects
├── requirements.txt
└── README.md
```

---

## 🚀 Setup & Installation

### Prerequisites
- Python 3.10+
- pip

### Install

```bash
# Clone the repository
git clone <repo-url>
cd Synthetix

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Download spaCy model (optional, for advanced NLP)
python -m spacy download en_core_web_sm
```

### Run

```bash
# Start the FastAPI backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

- **API Docs (Swagger):** http://localhost:8000/docs
- **API Docs (ReDoc):** http://localhost:8000/redoc
- **Frontend:** Open `frontend/index.html` in a browser

---

## 📡 API Reference

### `POST /api/ingest` – Ingest Defect Dataset

Upload a CSV or JSON file to populate the vector database.

```bash
curl -X POST http://localhost:8000/api/ingest \
  -F "file=@data/sample_defects.json"
```

**Response:**
```json
{
  "total_ingested": 20,
  "total_skipped": 0,
  "clusters_formed": 5,
  "message": "Successfully ingested 20 defects into 5 clusters."
}
```

### `POST /api/analyze` – Analyze a Defect Report

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "defect_id": "BUG-2001",
    "title": "Login fails with expired JWT token",
    "description": "When a user tries to log in with an expired token, the app crashes with a 500 error.",
    "steps": "1. Open login page\n2. Use expired token\n3. Submit",
    "expected": "Redirect to login with error message",
    "actual": "500 Internal Server Error",
    "environment": "Chrome 120, Windows 11",
    "logs": "NullPointerException at AuthService:142"
  }'
```

**Response:**
```json
{
  "decision": "duplicate",
  "top_matches": [
    {
      "defect_id": "BUG-1001",
      "title": "Login page crashes with expired JWT token",
      "similarity_score": 0.9234,
      "cluster_id": 0
    },
    {
      "defect_id": "BUG-1002",
      "title": "User authentication fails when token expires",
      "similarity_score": 0.8756,
      "cluster_id": 0
    }
  ],
  "cluster_id": 0,
  "improved_report": {
    "improved_title": "Login fails with expired JWT token - 500 Internal Server Error [Chrome 120, Windows 11]",
    "summary": "Defect 'Login fails with expired JWT token' exhibits behavior: 500 Internal Server Error. Expected: Redirect to login with error message. Observed in: Chrome 120, Windows 11.",
    "missing_fields": [],
    "completeness_score": 90.0
  },
  "confidence": 0.9234
}
```

### `GET /api/clusters` – Cluster Overview

```bash
curl http://localhost:8000/api/clusters
```

### `GET /api/health` – Health Check

```bash
curl http://localhost:8000/api/health
```

---

## 🧪 Testing

```bash
# Run all tests
python -m pytest backend/tests/ -v

# Run specific test module
python -m pytest backend/tests/test_preprocessor.py -v
```

---

## ⚙️ Configuration

All settings are in `backend/config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `DUPLICATE_THRESHOLD` | 0.90 | Similarity ≥ this = "duplicate" |
| `POSSIBLE_DUPLICATE_THRESHOLD` | 0.75 | Similarity ≥ this = "possible_duplicate" |
| `TOP_K_MATCHES` | 5 | Max number of similar matches returned |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | HuggingFace model for embeddings |
| `DBSCAN_EPS` | 0.35 | DBSCAN epsilon parameter |
| `DBSCAN_MIN_SAMPLES` | 2 | Min samples per cluster |

---

## 🎨 Frontend

The frontend is a jaw-dropping cyberpunk-themed SPA with:

- **Three.js 3D particle constellation** background
- **Floating wireframe geometry** (icosahedrons, octahedrons)
- **Glassmorphism** cards with neon glow borders
- **4 Pages:** Landing, Dashboard, Analyzer, API Docs
- **Real-time cluster visualization** canvas
- **Animated analysis pipeline** with step-by-step loading overlay
- **Responsive** dark-mode-first design

---

## 📊 Datasets

Compatible with:
- [Bugzilla Bug Reports](https://www.bugzilla.org/)
- [GitBugs](https://github.com/)
- [Jira Issue Export](https://www.atlassian.com/software/jira)

Dataset format (CSV/JSON) with fields: `defect_id`, `title`, `description`, `steps`, `expected`, `actual`, `environment`, `logs`

---

## 🏆 Evaluation Criteria Alignment

| Criterion | Weight | How We Address It |
|-----------|--------|-------------------|
| Correctness & Functionality | 40% | Full pipeline: normalize → embed → search → classify → cluster → enhance |
| AI/ML Implementation Quality | 30% | HuggingFace transformers, ChromaDB vectors, DBSCAN clustering, BART summarization |
| API Design & Engineering | 20% | FastAPI with Pydantic validation, CORS, error handling, Swagger docs |
| Documentation & README | 10% | This README + inline docs + API reference + example calls |

---

## 📜 License

Built for the AI & Programming Hackathon – 30-Hour Challenge.

---

<div align="center">
<strong>Made with ⚡ by Team Synthetix</strong>
</div>
