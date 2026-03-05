"""
Synthetix – POST /api/analyze
Full defect analysis endpoint: duplicate detection + clustering + enhancement.
"""
from fastapi import APIRouter, HTTPException
from backend.models.defect import DefectReport, AnalysisResult
from backend.services.detector import DuplicateDetector
from backend.services.clusterer import ClusteringService
from backend.services.enhancer import ReportEnhancer
from backend.utils.logger import get_logger
from backend.utils.exceptions import SynthetixException, handle_synthetix_error

log = get_logger("router.analyze")
router = APIRouter()


@router.post(
    "/analyze",
    response_model=AnalysisResult,
    summary="Analyze a defect report",
    description=(
        "Submit a new defect report for full analysis. "
        "Returns duplicate detection result, cluster assignment, "
        "top matches, and an enhanced version of the report."
    ),
)
async def analyze_defect(report: DefectReport) -> AnalysisResult:
    """
    Full defect analysis pipeline:
    1. Duplicate detection (similarity search + threshold classification)
    2. Cluster assignment (nearest DBSCAN cluster)
    3. Report enhancement (missing fields + AI summary)
    """
    try:
        log.info(f"📋 Analyzing defect: {report.defect_id} - '{report.title}'")

        # 1. Detect duplicates
        detector = DuplicateDetector()
        detection_result = detector.analyze(report)

        # 2. Assign cluster
        clusterer = ClusteringService()
        embedding = detection_result.get("embedding", [])
        cluster_id = clusterer.assign_cluster(embedding) if embedding else -1

        # 3. Enhance report
        enhancer = ReportEnhancer()
        improved_report = enhancer.enhance(
            report=report,
            top_matches=detection_result["top_matches"],
        )

        result = AnalysisResult(
            decision=detection_result["decision"],
            top_matches=detection_result["top_matches"],
            cluster_id=cluster_id,
            improved_report=improved_report,
            confidence=detection_result["confidence"],
        )

        log.info(
            f"✅ Analysis complete: {result.decision} "
            f"(confidence={result.confidence}, cluster={cluster_id})"
        )

        return result

    except SynthetixException as e:
        raise handle_synthetix_error(e)
    except Exception as e:
        log.error(f"Unexpected error in analyze: {e}")
        raise HTTPException(status_code=500, detail=str(e))
