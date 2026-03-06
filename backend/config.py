"""
Synthetix Configuration
Central configuration for the Duplicate Defect Finder & Bug Report Enhancer.
"""
from pathlib import Path
from pydantic import BaseModel


class Settings(BaseModel):
    """Application settings."""

    # Project paths
    PROJECT_ROOT: Path = Path(__file__).parent.parent
    DATA_DIR: Path = PROJECT_ROOT / "data"
    CHROMA_DIR: Path = PROJECT_ROOT / "chroma_db"

    # API settings
    API_TITLE: str = "Synthetix – Duplicate Defect Finder & Bug Report Enhancer"
    API_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Embedding model
    # Use locally fine-tuned weights if available, otherwise fallback to baseline
    EMBEDDING_MODEL: str = str(PROJECT_ROOT / "models" / "synthetix-finetuned-latest")
    if not (PROJECT_ROOT / "models" / "synthetix-finetuned-latest").exists():
        EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    
    EMBEDDING_DIMENSION: int = 384

    # Cross-Encoder reranker model
    RERANKER_MODEL: str = "cross-encoder/ms-marco-TinyBERT-L-2-v2"

    # Summarization model
    SUMMARIZATION_MODEL: str = "facebook/bart-large-cnn"

    # ChromaDB
    COLLECTION_NAME: str = "defect_reports"

    # Duplicate detection thresholds
    DUPLICATE_THRESHOLD: float = 0.85
    POSSIBLE_DUPLICATE_THRESHOLD: float = 0.70
    TOP_K_MATCHES: int = 5

    # DBSCAN clustering
    DBSCAN_EPS: float = 0.35
    DBSCAN_MIN_SAMPLES: int = 2

    # Field extraction confidence tiers
    CONFIDENCE_HIGH: float = 0.85
    CONFIDENCE_MEDIUM: float = 0.70

    # Audit logging
    AUDIT_LOG_FILE: str = "logs/audit.jsonl"

    # Required defect fields
    REQUIRED_FIELDS: list[str] = [
        "title",
        "description",
        "steps",
        "expected",
        "actual",
        "environment",
    ]

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )


settings = Settings()
