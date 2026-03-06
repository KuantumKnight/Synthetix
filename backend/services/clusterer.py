"""
Synthetix Clustering Service
DBSCAN-based clustering with Silhouette validation, naming, and triage recommendations.
"""
import numpy as np
from collections import Counter
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_distances
from sklearn.metrics import silhouette_score as sk_silhouette_score
from backend.config import settings
from backend.services.vector_store import VectorStore
from backend.utils.logger import get_logger
from backend.utils.exceptions import ClusteringError

log = get_logger("clusterer")


class ClusteringService:
    """DBSCAN clustering with quality metrics and triage recommendations."""

    def __init__(self):
        self.vector_store = VectorStore()
        self._labels = None
        self._ids = None
        self._silhouette = 0.0

    def run_clustering(self) -> dict:
        """
        Run DBSCAN clustering on all stored embeddings.

        Returns:
            {
                "total_defects": int,
                "total_clusters": int,
                "noise_count": int,
                "silhouette_score": float,
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
                    "silhouette_score": 0.0,
                    "cluster_assignments": {},
                }

            embeddings_array = np.array(embeddings)
            num_defects = len(ids)
            
            # CRITICAL: Cap clustering at 10k to prevent O(N^2) memory/compute explosion
            # A 250k x 250k matrix would take ~500GB RAM.
            MAX_CLUSTERING = 10000
            if num_defects > MAX_CLUSTERING:
                log.warning(f"⚠️ Dataset too large for detailed clustering ({num_defects} > {MAX_CLUSTERING}). Skipping quadratic distance matrix.")
                return {
                    "total_defects": num_defects,
                    "total_clusters": 0,
                    "noise_count": num_defects,
                    "silhouette_score": 0.0,
                    "cluster_assignments": {did: -1 for did in ids},
                    "message": "Bulk ingestion detected. Clustering deferred to ensure responsiveness."
                }

            log.info(f"Running DBSCAN on {num_defects} embeddings...")

            # Use cosine distance for DBSCAN
            distance_matrix = cosine_distances(embeddings_array)

            # Apply module-level penalty to distance matrix (reduces false positives)
            existing_meta = self.vector_store.get_all_metadata()
            for i in range(num_defects):
                meta_i = existing_meta[i] if i < len(existing_meta) and existing_meta[i] else {}
                module_i = meta_i.get("enriched_fields", {}).get("module")
                if isinstance(module_i, dict):
                    module_i = module_i.get("value")
                
                for j in range(i + 1, len(ids)):
                    meta_j = existing_meta[j] if j < len(existing_meta) and existing_meta[j] else {}
                    module_j = meta_j.get("enriched_fields", {}).get("module")
                    if isinstance(module_j, dict):
                        module_j = module_j.get("value")

                    # If both have different reliable modules, add a distance penalty
                    if module_i and module_j and module_i != module_j:
                        penalty = 0.2  # Increase distance to discourage clustering
                        distance_matrix[i, j] += penalty
                        distance_matrix[j, i] += penalty

            dbscan = DBSCAN(
                eps=settings.DBSCAN_EPS,
                min_samples=settings.DBSCAN_MIN_SAMPLES,
                metric="precomputed",
            )

            labels = dbscan.fit_predict(distance_matrix)
            self._labels = labels
            self._ids = ids

            # Calculate Silhouette score (cluster quality metric)
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            noise_count = int(np.sum(labels == -1))

            silhouette = 0.0
            if n_clusters >= 2 and noise_count < len(labels):
                try:
                    # Only use non-noise points for silhouette
                    mask = labels != -1
                    if np.sum(mask) >= 2:
                        silhouette = float(sk_silhouette_score(
                            embeddings_array[mask], labels[mask], metric="cosine"
                        ))
                        silhouette = round(silhouette, 4)
                except Exception as e:
                    log.warning(f"Silhouette calculation failed: {e}")

            self._silhouette = silhouette

            if silhouette < 0.6 and n_clusters > 0:
                log.warning(
                    f"⚠️ Low silhouette score: {silhouette:.3f}. "
                    f"Clusters may be noisy. Consider tuning eps."
                )

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

            log.info(
                f"✅ Clustering complete: {n_clusters} clusters, "
                f"{noise_count} noise points, {len(ids)} total defects, "
                f"silhouette={silhouette:.4f}"
            )

            return {
                "total_defects": len(ids),
                "total_clusters": n_clusters,
                "noise_count": noise_count,
                "silhouette_score": silhouette,
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

    def _generate_cluster_name(self, titles: list[str]) -> str:
        """Generate a human-readable cluster name from dominant titles."""
        if not titles:
            return "Unnamed Cluster"

        # Extract common words across titles
        all_words = []
        for title in titles:
            words = [w.strip().lower() for w in title.split() if len(w) > 2]
            all_words.extend(words)

        # Find most common meaningful words
        stop = {"the", "and", "for", "with", "when", "from", "error", "bug", "issue", "test"}
        word_counts = Counter(w for w in all_words if w not in stop)
        top_words = [w for w, _ in word_counts.most_common(3)]

        if top_words:
            name = " ".join(w.capitalize() for w in top_words)
            return f"{name} Issues"
        return titles[0][:50] if titles else "Unnamed Cluster"

    def _recommend_action(self, size: int, silhouette: float) -> str:
        """Recommend triage action based on cluster characteristics."""
        if size >= 5 and silhouette >= 0.6:
            return "BULK_DEDUP_CANDIDATES"
        elif size >= 3 and silhouette >= 0.4:
            return "REVIEW_MANUAL"
        elif size >= 2:
            return "REVIEW_MANUAL"
        else:
            return "SEPARATE_MODULES"

    def get_cluster_overview(self) -> dict:
        """Get overview of all clusters with names, quality, and recommendations."""
        try:
            ids, _ = self.vector_store.get_all_embeddings()
            metadata = self.vector_store.get_all_metadata()

            if not ids:
                return {
                    "total_defects": 0, "total_clusters": 0,
                    "noise_count": 0, "silhouette_score": 0.0,
                    "clusters": [],
                }

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
                            "titles": [],
                            "representative_title": meta.get("title", "Unknown"),
                        }
                    clusters[cluster_id]["defect_ids"].append(defect_id)
                    clusters[cluster_id]["titles"].append(meta.get("title", ""))

            cluster_list = []
            for cid, info in sorted(clusters.items()):
                cluster_name = self._generate_cluster_name(info["titles"])
                recommendation = self._recommend_action(
                    len(info["defect_ids"]), self._silhouette
                )
                cluster_list.append({
                    "cluster_id": cid,
                    "cluster_name": cluster_name,
                    "size": len(info["defect_ids"]),
                    "representative_title": info["representative_title"],
                    "defect_ids": info["defect_ids"],
                    "silhouette_score": self._silhouette,
                    "recommendation": recommendation,
                })

            return {
                "total_defects": len(ids),
                "total_clusters": len(clusters),
                "noise_count": len(noise_ids),
                "silhouette_score": self._silhouette,
                "clusters": cluster_list,
            }

        except Exception as e:
            log.error(f"Failed to get cluster overview: {e}")
            raise ClusteringError(
                message="Failed to get cluster overview",
                detail=str(e),
            )
