"""
Synthetix Vector Store
Fallback in-memory vector database for defect report embeddings.
(Tries to use ChromaDB, falls back to in-memory implementation if unavailable)
"""
import json
import numpy as np
from pathlib import Path
from backend.config import settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import VectorStoreError

log = get_logger("vector_store")

# Try to import chromadb, but make it optional
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    HAS_CHROMADB = True
except ImportError:
    HAS_CHROMADB = False
    log.warning("ChromaDB not available, using in-memory fallback vector store")


class VectorStore:
    """Hybrid vector store: uses ChromaDB if available, falls back to in-memory implementation."""

    _instance = None
    _client = None
    _collection = None
    _use_chromadb = False
    # Fallback in-memory storage
    _memory_store = {}  # {id: {embedding, document, metadata}}
    _store_path = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _ensure_collection(self):
        """Lazy-initialize vector store (ChromaDB or in-memory fallback)."""
        if self._collection is None and not self._memory_store:
            try:
                if HAS_CHROMADB:
                    log.info("Initializing ChromaDB...")
                    settings.CHROMA_DIR.mkdir(parents=True, exist_ok=True)

                    self._client = chromadb.PersistentClient(
                        path=str(settings.CHROMA_DIR),
                    )

                    self._collection = self._client.get_or_create_collection(
                        name=settings.COLLECTION_NAME,
                        metadata={"hnsw:space": "cosine"},
                    )
                    self._use_chromadb = True
                    count = self._collection.count()
                    log.info(f"✅ ChromaDB ready — collection '{settings.COLLECTION_NAME}' has {count} documents")
                else:
                    log.info("Using in-memory vector store (ChromaDB unavailable)")
                    self._use_chromadb = False
                    self._store_path = settings.CHROMA_DIR / "vector_store.json"
                    self._load_from_disk()
            except Exception as e:
                log.warning(f"ChromaDB initialization failed: {e}. Using in-memory fallback.")
                self._use_chromadb = False
                self._store_path = settings.CHROMA_DIR / "vector_store.json"
                self._load_from_disk()

    def _load_from_disk(self):
        """Load in-memory store from disk (for persistence)."""
        if self._store_path and self._store_path.exists():
            try:
                with open(self._store_path, 'r') as f:
                    self._memory_store = json.load(f)
                log.info(f"Loaded {len(self._memory_store)} vectors from disk")
            except Exception as e:
                log.warning(f"Failed to load store from disk: {e}")
                self._memory_store = {}
        else:
            self._memory_store = {}

    def _save_to_disk(self):
        """Save in-memory store to disk."""
        if not self._use_chromadb and self._store_path:
            try:
                self._store_path.parent.mkdir(parents=True, exist_ok=True)
                with open(self._store_path, 'w') as f:
                    json.dump(self._memory_store, f)
            except Exception as e:
                log.warning(f"Failed to save store to disk: {e}")

    def _cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        v1 = np.array(vec1, dtype=np.float32)
        v2 = np.array(vec2, dtype=np.float32)
        dot_product = np.dot(v1, v2)
        magnitude = np.linalg.norm(v1) * np.linalg.norm(v2)
        if magnitude == 0:
            return 0.0
        return float(dot_product / magnitude)

    def add_defects(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict] | None = None,
    ) -> int:
        """
        Add defect embeddings to the vector store.

        Returns:
            Number of defects added.
        """
        self._ensure_collection()

        if not ids:
            return 0

        try:
            if self._use_chromadb:
                # ChromaDB path with batching to prevent timeouts/memory errors
                batch_size = 5000
                total_added = 0
                
                # Check for existing IDs in the whole set first (caution: might be slow for huge sets)
                # For 250k, we split the check as well
                existing = set()
                for i in range(0, len(ids), batch_size):
                    batch_ids = ids[i : i + batch_size]
                    try:
                        result = self._collection.get(ids=batch_ids)
                        if result and result["ids"]:
                            existing.update(result["ids"])
                    except Exception:
                        pass

                new_indices = [i for i, id_ in enumerate(ids) if id_ not in existing]
                if not new_indices:
                    log.info("All defects already exist in vector store")
                    return 0

                new_ids_all = [ids[i] for i in new_indices]
                new_embeddings_all = [embeddings[i] for i in new_indices]
                new_documents_all = [documents[i] for i in new_indices]
                new_metadatas_all = [metadatas[i] for i in new_indices] if metadatas else [{}] * len(new_indices)

                for i in range(0, len(new_ids_all), batch_size):
                    batch_ids = new_ids_all[i : i + batch_size]
                    batch_embeddings = new_embeddings_all[i : i + batch_size]
                    batch_documents = new_documents_all[i : i + batch_size]
                    batch_metadatas = new_metadatas_all[i : i + batch_size]

                    self._collection.add(
                        ids=batch_ids,
                        embeddings=batch_embeddings,
                        documents=batch_documents,
                        metadatas=batch_metadatas,
                    )
                    total_added += len(batch_ids)
                    log.info(f"Progress: Added {total_added}/{len(new_ids_all)} new defects...")

                log.info(f"✅ Added {total_added} defects to vector store (skipped {len(existing)} existing)")
                return total_added
            else:
                # In-memory fallback path
                added = 0
                for idx, id_ in enumerate(ids):
                    if id_ not in self._memory_store:
                        self._memory_store[id_] = {
                            "embedding": embeddings[idx],
                            "document": documents[idx],
                            "metadata": metadatas[idx] if metadatas else {},
                        }
                        added += 1
                
                self._save_to_disk()
                log.info(f"✅ Added {added} defects to in-memory vector store")
                return added

        except Exception as e:
            log.error(f"Failed to add defects to vector store: {e}")
            raise VectorStoreError(
                message="Failed to add defects to vector store",
                detail=str(e),
            )

    def search_similar(
        self,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        """
        Search for similar defects using cosine similarity.

        Returns:
            List of {id, document, metadata, distance, similarity_score} dicts.
        """
        self._ensure_collection()

        try:
            if self._use_chromadb:
                # ChromaDB path
                count = self._collection.count()
                if count == 0:
                    log.warning("Vector store is empty, no results to return")
                    return []

                actual_k = min(top_k, count)

                results = self._collection.query(
                    query_embeddings=[query_embedding],
                    n_results=actual_k,
                    include=["documents", "metadatas", "distances"],
                )

                matches = []
                if results and results["ids"] and results["ids"][0]:
                    for i, id_ in enumerate(results["ids"][0]):
                        # ChromaDB cosine distance = 1 - similarity
                        distance = results["distances"][0][i] if results["distances"] else 0
                        similarity = max(0.0, 1.0 - distance)

                        matches.append({
                            "id": id_,
                            "document": results["documents"][0][i] if results["documents"] else "",
                            "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                            "distance": distance,
                            "similarity_score": round(similarity, 4),
                        })

                log.info(f"Found {len(matches)} similar defects")
                return matches
            else:
                # In-memory fallback path
                if not self._memory_store:
                    return []

                # Compute similarities with all items
                similarities = []
                for id_, item in self._memory_store.items():
                    similarity = self._cosine_similarity(query_embedding, item["embedding"])
                    similarities.append({
                        "id": id_,
                        "document": item["document"],
                        "metadata": item["metadata"],
                        "similarity_score": round(similarity, 4),
                        "distance": round(1.0 - similarity, 4),
                    })

                # Sort by similarity (descending) and return top-k
                similarities.sort(key=lambda x: x["similarity_score"], reverse=True)
                matches = similarities[:min(top_k, len(similarities))]
                log.info(f"Found {len(matches)} similar defects")
                return matches

        except Exception as e:
            log.error(f"Similarity search failed: {e}")
            raise VectorStoreError(
                message="Similarity search failed",
                detail=str(e),
            )

    def get_all_embeddings(self) -> tuple[list[str], list[list[float]]]:
        """Get all defect IDs and their embeddings for clustering."""
        self._ensure_collection()

        try:
            if self._use_chromadb:
                count = self._collection.count()
                if count == 0:
                    return [], []

                result = self._collection.get(
                    include=["embeddings"],
                )

                return result["ids"], result["embeddings"]
            else:
                # In-memory path
                ids = []
                embeddings = []
                for id_, item in self._memory_store.items():
                    ids.append(id_)
                    embeddings.append(item["embedding"])
                return ids, embeddings

        except Exception as e:
            log.error(f"Failed to retrieve embeddings: {e}")
            raise VectorStoreError(
                message="Failed to retrieve embeddings for clustering",
                detail=str(e),
            )

    def get_all_metadata(self) -> list[dict]:
        """Get all defect metadata."""
        self._ensure_collection()
        try:
            if self._use_chromadb:
                result = self._collection.get(include=["metadatas"])
                return result["metadatas"] if result["metadatas"] else []
            else:
                # In-memory path
                return [item["metadata"] for item in self._memory_store.values()]
        except Exception as e:
            log.error(f"Failed to retrieve metadata: {e}")
            return []

    def update_metadata(self, ids: list[str], metadatas: list[dict]):
        """Update metadata (e.g., cluster_id) for existing defects."""
        self._ensure_collection()
        try:
            if self._use_chromadb:
                self._collection.update(ids=ids, metadatas=metadatas)
            else:
                # In-memory path
                for id_, metadata in zip(ids, metadatas):
                    if id_ in self._memory_store:
                        self._memory_store[id_]["metadata"].update(metadata)
                self._save_to_disk()
            log.info(f"Updated metadata for {len(ids)} defects")
        except Exception as e:
            log.error(f"Failed to update metadata: {e}")
            raise VectorStoreError(
                message="Failed to update metadata",
                detail=str(e),
            )

    def count(self) -> int:
        """Get total number of defects in the store."""
        self._ensure_collection()
        if self._use_chromadb:
            return self._collection.count()
        else:
            return len(self._memory_store)

    def reset(self):
        """Delete and recreate the collection. USE WITH CAUTION."""
        self._ensure_collection()
        try:
            if self._use_chromadb:
                self._client.delete_collection(settings.COLLECTION_NAME)
                self._collection = self._client.get_or_create_collection(
                    name=settings.COLLECTION_NAME,
                    metadata={"hnsw:space": "cosine"},
                )
            else:
                self._memory_store = {}
                self._save_to_disk()
            log.warning("⚠️ Vector store has been reset")
        except Exception as e:
            log.error(f"Failed to reset vector store: {e}")
            raise VectorStoreError(message="Failed to reset vector store", detail=str(e))
