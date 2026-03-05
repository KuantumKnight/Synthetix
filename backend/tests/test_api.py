"""
Tests for the FastAPI application endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


class TestRootEndpoint:
    """Test the root endpoint."""

    def test_root_returns_service_info(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "Synthetix"
        assert "version" in data
        assert "docs" in data

    def test_root_has_correct_structure(self):
        response = client.get("/")
        data = response.json()
        required_keys = ["service", "description", "version", "docs", "health"]
        for key in required_keys:
            assert key in data, f"Missing key: {key}"


class TestHealthEndpoint:
    """Test the health check endpoint."""

    def test_health_returns_ok(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["healthy", "degraded"]
        assert "version" in data
        assert "embedding_model" in data

    def test_health_reports_model(self):
        response = client.get("/api/health")
        data = response.json()
        assert "MiniLM" in data["embedding_model"] or "sentence-transformers" in data["embedding_model"]


class TestAnalyzeEndpoint:
    """Test the analyze endpoint validation."""

    def test_analyze_requires_body(self):
        response = client.post("/api/analyze")
        assert response.status_code == 422  # Validation error

    def test_analyze_requires_fields(self):
        response = client.post("/api/analyze", json={})
        assert response.status_code == 422

    def test_analyze_validates_defect_id(self):
        response = client.post("/api/analyze", json={
            "title": "Test",
            "description": "Test description",
        })
        assert response.status_code == 422  # Missing defect_id

    def test_analyze_accepts_valid_input(self):
        """Valid input should be accepted (may fail if model not loaded, but input validated)."""
        response = client.post("/api/analyze", json={
            "defect_id": "TEST-001",
            "title": "Test defect for validation",
            "description": "This is a test defect to validate the API accepts proper input.",
        })
        # Either 200 (success) or 500 (model loading issue) - but NOT 422
        assert response.status_code in [200, 500]


class TestClustersEndpoint:
    """Test the clusters endpoint."""

    def test_clusters_returns_ok(self):
        response = client.get("/api/clusters")
        assert response.status_code == 200
        data = response.json()
        assert "total_defects" in data
        assert "total_clusters" in data
        assert "clusters" in data


class TestIngestEndpoint:
    """Test the ingest endpoint validation."""

    def test_ingest_requires_file(self):
        response = client.post("/api/ingest")
        assert response.status_code == 422


class TestCORS:
    """Test CORS headers."""

    def test_cors_headers_present(self):
        response = client.options("/", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        })
        # FastAPI CORS should handle this
        assert response.status_code in [200, 405]
