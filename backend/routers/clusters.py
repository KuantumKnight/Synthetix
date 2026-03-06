"""
Synthetix – Cluster, Health, Audit-Log, and Approval Endpoints
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from backend.models.defect import (
    ClusterOverview, ClusterInfo, HealthResponse,
    AuditLogEntry, AuditLogResponse,
    ApprovalRequest, ApprovalResponse,
)
from backend.services.clusterer import ClusteringService
from backend.services.vector_store import VectorStore
from backend.config import settings
from backend.utils.logger import get_logger, log_audit_event, query_audit_log
from backend.utils.exceptions import SynthetixException, handle_synthetix_error

log = get_logger("router.clusters")
router = APIRouter()


@router.get(
    "/clusters",
    response_model=ClusterOverview,
    summary="Get cluster overview",
    description="Returns overview of all defect clusters with names, quality scores, and triage recommendations.",
)
async def get_clusters() -> ClusterOverview:
    """Get overview of all defect clusters."""
    try:
        clusterer = ClusteringService()
        overview = clusterer.get_cluster_overview()

        clusters = [
            ClusterInfo(
                cluster_id=c["cluster_id"],
                cluster_name=c.get("cluster_name", ""),
                size=c["size"],
                representative_title=c["representative_title"],
                defect_ids=c["defect_ids"],
                silhouette_score=c.get("silhouette_score", 0.0),
                recommendation=c.get("recommendation", "REVIEW_MANUAL"),
            )
            for c in overview.get("clusters", [])
        ]

        return ClusterOverview(
            total_defects=overview["total_defects"],
            total_clusters=overview["total_clusters"],
            noise_count=overview["noise_count"],
            silhouette_score=overview.get("silhouette_score", 0.0),
            clusters=clusters,
        )

    except SynthetixException as e:
        raise handle_synthetix_error(e)
    except Exception as e:
        log.error(f"Failed to get clusters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/clusters/{cluster_id}/approve-dedup",
    response_model=ApprovalResponse,
    summary="Approve bulk deduplication",
    description="Approve merging duplicate defects within a cluster.",
)
async def approve_dedup(cluster_id: int, request: ApprovalRequest) -> ApprovalResponse:
    """Approve bulk deduplication for a cluster."""
    try:
        clusterer = ClusteringService()
        overview = clusterer.get_cluster_overview()

        # Find the cluster
        target_cluster = None
        for c in overview.get("clusters", []):
            if c["cluster_id"] == cluster_id:
                target_cluster = c
                break

        if not target_cluster:
            raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")

        approved_at = datetime.now(timezone.utc).isoformat()

        # Log the approval in audit trail
        audit_id = log_audit_event(
            action="DEDUP_APPROVED",
            defect_id=f"cluster_{cluster_id}",
            actor=request.approver_name,
            details={
                "cluster_id": cluster_id,
                "defects_merged": len(target_cluster["defect_ids"]),
                "defect_ids": target_cluster["defect_ids"],
                "notes": request.notes,
            },
        )

        return ApprovalResponse(
            cluster_id=cluster_id,
            approved_at=approved_at,
            approver=request.approver_name,
            defects_merged=len(target_cluster["defect_ids"]),
            audit_entry_id=audit_id,
            message=f"Approved deduplication of {len(target_cluster['defect_ids'])} defects in cluster {cluster_id}.",
        )

    except HTTPException:
        raise
    except SynthetixException as e:
        raise handle_synthetix_error(e)
    except Exception as e:
        log.error(f"Approval failed for cluster {cluster_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/audit-log",
    response_model=AuditLogResponse,
    summary="Query audit log",
    description="Retrieve audit trail entries with optional filtering.",
)
async def get_audit_log(
    action: str | None = Query(None, description="Filter by action type"),
    defect_id: str | None = Query(None, description="Filter by defect ID"),
    limit: int = Query(50, ge=1, le=500, description="Max entries"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
) -> AuditLogResponse:
    """Query the immutable audit log."""
    try:
        entries = query_audit_log(
            action=action, defect_id=defect_id,
            limit=limit, offset=offset,
        )

        audit_entries = [
            AuditLogEntry(
                timestamp=e["timestamp"],
                action=e["action"],
                defect_id=e.get("defect_id", ""),
                actor=e.get("actor", "SYNTHETIX_v1"),
                details=e.get("details", {}),
                entry_id=e.get("entry_id", ""),
            )
            for e in entries
        ]

        return AuditLogResponse(
            total_entries=len(audit_entries),
            entries=audit_entries,
        )
    except Exception as e:
        log.error(f"Audit log query failed: {e}")
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
