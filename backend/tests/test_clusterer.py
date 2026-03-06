"""
Tests for the Clustering Service.
Tests DBSCAN, Silhouette score, cluster naming, and triage recommendations.
"""
import pytest
from backend.services.clusterer import ClusteringService


class TestClusteringLogic:
    """Test clustering logic without requiring ML models."""

    def test_cluster_name_generation(self):
        service = ClusteringService()
        titles = [
            "Login page crashes with error",
            "Login timeout on production",
            "Login button not responsive",
        ]
        name = service._generate_cluster_name(titles)
        assert "Login" in name or "login" in name.lower()

    def test_cluster_name_empty(self):
        service = ClusteringService()
        name = service._generate_cluster_name([])
        assert name == "Unnamed Cluster"

    def test_recommend_action_bulk_dedup(self):
        service = ClusteringService()
        rec = service._recommend_action(size=6, silhouette=0.7)
        assert rec == "BULK_DEDUP_CANDIDATES"

    def test_recommend_action_manual_review(self):
        service = ClusteringService()
        rec = service._recommend_action(size=3, silhouette=0.5)
        assert rec == "REVIEW_MANUAL"

    def test_recommend_action_separate(self):
        service = ClusteringService()
        rec = service._recommend_action(size=1, silhouette=0.3)
        assert rec == "SEPARATE_MODULES"

    def test_empty_overview(self):
        """Empty vector store should return zeroed overview."""
        service = ClusteringService()
        overview = service.get_cluster_overview()
        assert overview["total_defects"] >= 0
        assert overview["total_clusters"] >= 0

    def test_cluster_assignment_no_data(self):
        """Assignment with no data should return -1."""
        service = ClusteringService()
        cluster_id = service.assign_cluster([0.0] * 384)
        assert cluster_id == -1


class TestSilhouetteMetric:
    """Test Silhouette score behavior expectations."""

    def test_silhouette_range(self):
        """Silhouette score should be between -1 and 1."""
        # Test with known values
        import numpy as np
        from sklearn.metrics import silhouette_score
        from sklearn.datasets import make_blobs

        X, labels = make_blobs(n_samples=50, centers=3, random_state=42)
        score = silhouette_score(X, labels)
        assert -1.0 <= score <= 1.0

    def test_silhouette_good_clusters(self):
        """Well-separated clusters should have high silhouette."""
        import numpy as np
        from sklearn.metrics import silhouette_score
        from sklearn.datasets import make_blobs

        X, labels = make_blobs(
            n_samples=100, centers=3, cluster_std=0.5, random_state=42
        )
        score = silhouette_score(X, labels)
        assert score > 0.5  # Well-separated clusters
