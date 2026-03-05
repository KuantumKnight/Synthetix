"""
Synthetix Embedding Service
HuggingFace sentence-transformers for defect report embeddings.
"""
import numpy as np
from sentence_transformers import SentenceTransformer
from backend.config import settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import EmbeddingError

log = get_logger("embedder")


class EmbeddingService:
    """Generate embeddings using sentence-transformers."""

    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _ensure_model(self):
        """Lazy-load the embedding model."""
        if self._model is None:
            try:
                log.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
                self._model = SentenceTransformer(settings.EMBEDDING_MODEL)
                log.info("✅ Embedding model loaded successfully")
            except Exception as e:
                log.error(f"Failed to load embedding model: {e}")
                raise EmbeddingError(
                    message="Failed to load embedding model",
                    detail=str(e),
                )

    def encode(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Normalized text to encode.

        Returns:
            Embedding vector as a list of floats.
        """
        self._ensure_model()

        if not text or not text.strip():
            log.warning("Empty text provided for encoding, returning zero vector")
            return [0.0] * settings.EMBEDDING_DIMENSION

        try:
            embedding = self._model.encode(
                text,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            return embedding.tolist()
        except Exception as e:
            log.error(f"Embedding generation failed: {e}")
            raise EmbeddingError(
                message="Failed to generate embedding",
                detail=str(e),
            )

    def encode_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts: List of normalized texts.

        Returns:
            List of embedding vectors.
        """
        self._ensure_model()

        if not texts:
            return []

        # Replace empty texts with placeholder
        processed = [t if t and t.strip() else "empty" for t in texts]

        try:
            log.info(f"Encoding batch of {len(processed)} texts...")
            embeddings = self._model.encode(
                processed,
                show_progress_bar=True,
                normalize_embeddings=True,
                batch_size=32,
            )
            log.info(f"✅ Batch encoding complete: {len(embeddings)} embeddings")
            return [e.tolist() for e in embeddings]
        except Exception as e:
            log.error(f"Batch embedding generation failed: {e}")
            raise EmbeddingError(
                message="Batch embedding generation failed",
                detail=str(e),
            )

    @staticmethod
    def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        a = np.array(vec_a)
        b = np.array(vec_b)
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))
