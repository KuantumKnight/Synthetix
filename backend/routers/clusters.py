"""
Synthetix – GET /api/clusters & GET /api/health
Cluster overview and health check endpoints.
"""
from fastapi import APIRouter, HTTPException
from backend.models.defect import ClusterOverview, ClusterInfo, HealthResponse
from backend.services.clusterer import ClusteringService
from backend.services.vector_store import VectorStore
from backend.config import settings
from backend.utils.logger import get_logger
from backend.utils.exceptions import SynthetixException, handle_synthetix_error

log = get_logger("router.clusters")
router = APIRouter()


@router.get(
    "/clusters",
    response_model=ClusterOverview,
    summary="Get cluster overview",
    description="Returns an overview of all defect clusters with their IDs and member defects.",
)
async def get_clusters() -> ClusterOverview:
    """Get overview of all defect clusters."""
    try:
        clusterer = ClusteringService()
        overview = clusterer.get_cluster_overview()

        clusters = [
            ClusterInfo(
                cluster_id=c["cluster_id"],
                size=c["size"],
                representative_title=c["representative_title"],
                defect_ids=c["defect_ids"],
            )
            for c in overview.get("clusters", [])
        ]

        return ClusterOverview(
            total_defects=overview["total_defects"],
            total_clusters=overview["total_clusters"],
            noise_count=overview["noise_count"],
            clusters=clusters,
        )

    except SynthetixException as e:
        raise handle_synthetix_error(e)
    except Exception as e:
        log.error(f"Failed to get clusters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Returns service health status and basic statistics.",
)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    try:
        vector_store = VectorStore()
        total_defects = vector_store.count()

        clusterer = ClusteringService()
        overview = clusterer.get_cluster_overview()

        return HealthResponse(
            status="healthy",
            version=settings.API_VERSION,
            total_defects=total_defects,
            total_clusters=overview["total_clusters"],
            embedding_model=settings.EMBEDDING_MODEL,
        )
    except Exception as e:
        log.warning(f"Health check partial failure: {e}")
        return HealthResponse(
            status="degraded",
            version=settings.API_VERSION,
            total_defects=0,
            total_clusters=0,
            embedding_model=settings.EMBEDDING_MODEL,
        )
