"""
Synthetix – POST /api/analyze
Full defect analysis: duplicate detection (Cross-Encoder) + clustering + enhancement + audit.
"""
from fastapi import APIRouter, HTTPException
from backend.models.defect import DefectReport, AnalysisResult, HallucinationCheck
from backend.services.detector import DuplicateDetector
from backend.services.clusterer import ClusteringService
from backend.services.enhancer import ReportEnhancer
from backend.config import settings
from backend.utils.logger import get_logger, log_audit_event
from backend.utils.exceptions import SynthetixException, handle_synthetix_error

log = get_logger("router.analyze")
router = APIRouter()


@router.post(
    "/analyze",
    response_model=AnalysisResult,
    summary="Analyze a defect report",
    description=(
        "Submit a new defect report for full analysis. "
        "Returns duplicate detection with Cross-Encoder re-ranking, "
        "cluster assignment, evidence trail, enriched fields, "
        "hallucination check, and an enhanced report."
    ),
)
async def analyze_defect(report: DefectReport) -> AnalysisResult:
    """
    Full defect analysis pipeline:
    1. Duplicate detection (Bi-Encoder + Cross-Encoder re-ranking)
    2. Cluster assignment (nearest DBSCAN cluster)
    3. Report enhancement (field extraction + citations + summary)
    4. Hallucination verification
    5. Audit logging
    """
    try:
        log.info(f"📋 Analyzing defect: {report.defect_id} - '{report.title}'")

        # 1. Detect duplicates (with Cross-Encoder re-ranking)
        detector = DuplicateDetector()
        detection_result = detector.analyze(report)

        # 2. Assign cluster
        clusterer = ClusteringService()
        embedding = detection_result.get("embedding", [])
        cluster_id = clusterer.assign_cluster(embedding) if embedding else -1

        # 3. Enhance report (field extraction + citations + summary)
        enhancer = ReportEnhancer()
        improved_report = enhancer.enhance(
            report=report,
            top_matches=detection_result["top_matches"],
        )

        # 4. Hallucination check
        hallucination_check = enhancer.validate_hallucination_check(
            enriched_fields=improved_report.enriched_fields,
            citations=improved_report.citations,
            summary=improved_report.summary,
        )

        # 5. Audit logging
        actionable_flag = detection_result["confidence"] >= settings.DUPLICATE_THRESHOLD
        
        audit_id = log_audit_event(
            action="DEFECT_ANALYZED",
            defect_id=report.defect_id,
            details={
                "decision": detection_result["decision"],
                "confidence": detection_result["confidence"],
                "cluster_id": cluster_id,
                "num_matches": len(detection_result["top_matches"]),
                "enriched_fields_count": len(
                    [f for f in improved_report.enriched_fields.values()
                     if f.value is not None]
                ),
                "hallucination_check_passed": (
                    hallucination_check.summary_grounded_in_source
                    and hallucination_check.all_citations_traceable
                    and hallucination_check.fields_not_hallucinated
                ),
            },
        )

        result = AnalysisResult(
            decision=detection_result["decision"],
            top_matches=detection_result["top_matches"],
            cluster_id=cluster_id,
            improved_report=improved_report,
            confidence=detection_result["confidence"],
            actionable=actionable_flag,
            hallucination_check=hallucination_check,
            audit_entry_id=audit_id,
        )

        log.info(
            f"✅ Analysis complete: {result.decision} "
            f"(confidence={result.confidence}, cluster={cluster_id}, "
            f"enriched={len(improved_report.enriched_fields)}, "
            f"citations={len(improved_report.citations)})"
        )

        return result

    except SynthetixException as e:
        raise handle_synthetix_error(e)
    except Exception as e:
        log.error(f"Unexpected error in analyze: {e}")
        raise HTTPException(status_code=500, detail=str(e))
