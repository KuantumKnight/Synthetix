"""
Synthetix Clustering Service
DBSCAN-based clustering for defect report embeddings.
"""
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_distances
from backend.config import settings
from backend.services.vector_store import VectorStore
from backend.utils.logger import get_logger
from backend.utils.exceptions import ClusteringError

log = get_logger("clusterer")


class ClusteringService:
    """DBSCAN clustering for defect reports."""

    def __init__(self):
        self.vector_store = VectorStore()
        self._labels = None
        self._ids = None

    def run_clustering(self) -> dict:
        """
        Run DBSCAN clustering on all stored embeddings.

        Returns:
            {
                "total_defects": int,
                "total_clusters": int,
                "noise_count": int,
                "cluster_assignments": {defect_id: cluster_id},
            }
        """
        try:
            ids, embeddings = self.vector_store.get_all_embeddings()

            if not ids or not embeddings:
                log.warning("No embeddings found for clustering")
                return {
                    "total_defects": 0,
                    "total_clusters": 0,
                    "noise_count": 0,
                    "cluster_assignments": {},
                }

            embeddings_array = np.array(embeddings)
            log.info(f"Running DBSCAN on {len(ids)} embeddings...")

            # Use cosine distance for DBSCAN
            distance_matrix = cosine_distances(embeddings_array)

            dbscan = DBSCAN(
                eps=settings.DBSCAN_EPS,
                min_samples=settings.DBSCAN_MIN_SAMPLES,
                metric="precomputed",
            )

            labels = dbscan.fit_predict(distance_matrix)
            self._labels = labels
            self._ids = ids

            # Build cluster assignments
            cluster_assignments = {}
            for i, defect_id in enumerate(ids):
                cluster_assignments[defect_id] = int(labels[i])

            # Update metadata in vector store
            metadatas = []
            existing_meta = self.vector_store.get_all_metadata()
            for i, defect_id in enumerate(ids):
                meta = existing_meta[i] if i < len(existing_meta) and existing_meta[i] else {}
                meta["cluster_id"] = int(labels[i])
                metadatas.append(meta)

            self.vector_store.update_metadata(ids=ids, metadatas=metadatas)

            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            noise_count = int(np.sum(labels == -1))

            log.info(
                f"✅ Clustering complete: {n_clusters} clusters, "
                f"{noise_count} noise points, {len(ids)} total defects"
            )

            return {
                "total_defects": len(ids),
                "total_clusters": n_clusters,
                "noise_count": noise_count,
                "cluster_assignments": cluster_assignments,
            }

        except Exception as e:
            log.error(f"Clustering failed: {e}")
            raise ClusteringError(
                message="DBSCAN clustering failed",
                detail=str(e),
            )

    def assign_cluster(self, query_embedding: list[float]) -> int:
        """
        Assign a cluster ID to a new defect by finding the nearest cluster.

        Returns:
            cluster_id (int), or -1 if no close cluster found.
        """
        try:
            ids, embeddings = self.vector_store.get_all_embeddings()

            if not ids or not embeddings:
                return -1

            embeddings_array = np.array(embeddings)
            query_array = np.array(query_embedding).reshape(1, -1)

            # Compute cosine distances to all stored embeddings
            distances = cosine_distances(query_array, embeddings_array)[0]

            # Find nearest neighbor
            nearest_idx = int(np.argmin(distances))
            nearest_distance = distances[nearest_idx]

            # Get cluster of nearest neighbor
            metadata = self.vector_store.get_all_metadata()
            if nearest_idx < len(metadata) and metadata[nearest_idx]:
                nearest_cluster = metadata[nearest_idx].get("cluster_id", -1)
            else:
                nearest_cluster = -1

            # Only assign if within reasonable distance
            if nearest_distance <= settings.DBSCAN_EPS * 1.5:
                log.info(f"Assigned to cluster {nearest_cluster} (distance={nearest_distance:.4f})")
                return nearest_cluster
            else:
                log.info(f"No close cluster found (nearest distance={nearest_distance:.4f})")
                return -1

        except Exception as e:
            log.error(f"Cluster assignment failed: {e}")
            return -1

    def get_cluster_overview(self) -> dict:
        """Get overview of all clusters with defect IDs."""
        try:
            ids, _ = self.vector_store.get_all_embeddings()
            metadata = self.vector_store.get_all_metadata()

            if not ids:
                return {"total_defects": 0, "total_clusters": 0, "noise_count": 0, "clusters": []}

            # Group by cluster
            clusters = {}
            noise_ids = []

            for i, defect_id in enumerate(ids):
                meta = metadata[i] if i < len(metadata) and metadata[i] else {}
                cluster_id = meta.get("cluster_id", -1)

                if cluster_id == -1:
                    noise_ids.append(defect_id)
                else:
                    if cluster_id not in clusters:
                        clusters[cluster_id] = {
                            "cluster_id": cluster_id,
                            "defect_ids": [],
                            "representative_title": meta.get("title", "Unknown"),
                        }
                    clusters[cluster_id]["defect_ids"].append(defect_id)

            cluster_list = []
            for cid, info in sorted(clusters.items()):
                cluster_list.append({
                    "cluster_id": cid,
                    "size": len(info["defect_ids"]),
                    "representative_title": info["representative_title"],
                    "defect_ids": info["defect_ids"],
                })

            return {
                "total_defects": len(ids),
                "total_clusters": len(clusters),
                "noise_count": len(noise_ids),
                "clusters": cluster_list,
            }

        except Exception as e:
            log.error(f"Failed to get cluster overview: {e}")
            raise ClusteringError(
                message="Failed to get cluster overview",
                detail=str(e),
            )
