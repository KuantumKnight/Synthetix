"""
Synthetix Pydantic Models – Defect Reports
Input/output schemas for defect analysis, evidence, audit, and enrichment.
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class DefectReport(BaseModel):
    """Input model for a single defect report."""

    defect_id: str = Field(..., description="Unique defect identifier", examples=["BUG-1042"])
    title: str = Field(..., description="Defect title/summary", examples=["Login fails with expired token"])
    description: str = Field(
        ...,
        description="Detailed defect description",
        examples=["When a user attempts to log in with an expired JWT token, the application crashes."],
    )
    steps: Optional[str] = Field(
        None,
        description="Steps to reproduce",
        examples=["1. Open login page\n2. Enter credentials\n3. Click submit"],
    )
    expected: Optional[str] = Field(
        None,
        description="Expected behavior",
        examples=["User should see an error message about expired token"],
    )
    actual: Optional[str] = Field(
        None,
        description="Actual behavior",
        examples=["Application crashes with a 500 Internal Server Error"],
    )
    environment: Optional[str] = Field(
        None,
        description="Environment details",
        examples=["Chrome 120, Windows 11, Production"],
    )
    logs: Optional[str] = Field(
        None,
        description="Relevant log output",
        examples=["NullPointerException at AuthService.java:142"],
    )


# --- Evidence & Citation Models ---

class Citation(BaseModel):
    """Source citation for traceability."""
    source: str = Field(..., description="Source defect ID or input field")
    text: str = Field(..., description="Cited text snippet")
    location: str = Field("", description="Location reference (e.g., 'line 12')")


class MatchEvidence(BaseModel):
    """Evidence for why two defects match."""
    field: str = Field(..., description="Field that contributed to match")
    match_type: str = Field(..., description="Type of match (semantic, exact, partial)")
    snippet: str = Field("", description="Matched text snippet")
    score: float = Field(0.0, description="Match score for this field")
    source: str = Field("", description="Source reference")


class MatchResult(BaseModel):
    """A single matched defect from similarity search."""

    defect_id: str = Field(..., description="ID of the matched defect")
    title: str = Field(..., description="Title of the matched defect")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score")
    cross_encoder_score: float = Field(0.0, ge=0.0, le=1.0, description="Cross-Encoder re-ranking score")
    cluster_id: int = Field(..., description="Cluster ID of the matched defect")
    evidence: list[MatchEvidence] = Field(default_factory=list, description="Evidence for the match")


# --- Enrichment Models ---

class EnrichedField(BaseModel):
    """An auto-extracted/enriched field with metadata."""
    value: Optional[str] = Field(None, description="Extracted value")
    is_inferred: bool = Field(False, description="Whether value was inferred")
    source: str = Field("", description="Source of inference")
    confidence: float = Field(0.0, ge=0.0, le=1.0, description="Extraction confidence")
    status: str = Field("PRESENT", description="PRESENT | INFERRED | MISSING_DATA")


class HallucinationCheck(BaseModel):
    """Hallucination verification flags."""
    summary_grounded_in_source: bool = Field(True, description="Summary uses only source text")
    all_citations_traceable: bool = Field(True, description="All citations trace to real data")
    fields_not_hallucinated: bool = Field(True, description="No fields were invented")


class MissingFieldInfo(BaseModel):
    """Information about a missing field and suggestion."""

    field_name: str = Field(..., description="Name of the missing field")
    suggestion: str = Field(..., description="Suggestion for what to include")


class ImprovedReport(BaseModel):
    """Enhanced version of the original defect report."""

    improved_title: str = Field(..., description="AI-improved defect title")
    summary: str = Field(..., description="AI-generated comprehensive summary")
    missing_fields: list[MissingFieldInfo] = Field(
        default_factory=list, description="List of missing/incomplete fields"
    )
    completeness_score: float = Field(..., ge=0.0, le=100.0, description="Report completeness percentage")
    enriched_fields: dict[str, EnrichedField] = Field(
        default_factory=dict, description="Auto-extracted fields with metadata"
    )
    citations: list[Citation] = Field(
        default_factory=list, description="Source citations for traceability"
    )


class AnalysisResult(BaseModel):
    """Full analysis output for a defect report."""

    decision: Literal["duplicate", "possible_duplicate", "new_defect"] = Field(
        ..., description="Classification decision"
    )
    top_matches: list[MatchResult] = Field(
        default_factory=list, description="Top similar defects (up to 5)"
    )
    cluster_id: int = Field(..., description="Assigned cluster ID")
    improved_report: ImprovedReport = Field(..., description="Enhanced bug report")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score of the decision")
    actionable: bool = Field(False, description="Whether the analysis suggests an automated action")
    hallucination_check: HallucinationCheck = Field(
        default_factory=HallucinationCheck, description="Hallucination verification"
    )
    audit_entry_id: str = Field("", description="ID of the audit log entry for this analysis")


class IngestResponse(BaseModel):
    """Response for bulk data ingestion."""

    total_ingested: int = Field(..., description="Number of defects ingested")
    total_skipped: int = Field(0, description="Number of defects skipped")
    clusters_formed: int = Field(..., description="Number of clusters formed")
    silhouette_score: float = Field(0.0, description="Cluster quality metric")
    message: str = Field(..., description="Status message")


class ClusterInfo(BaseModel):
    """Information about a single cluster."""

    cluster_id: int
    cluster_name: str = Field("", description="Human-readable cluster name")
    size: int
    representative_title: str
    defect_ids: list[str]
    silhouette_score: float = Field(0.0, description="Cluster quality score")
    recommendation: str = Field("REVIEW_MANUAL", description="Triage action recommendation")


class ClusterOverview(BaseModel):
    """Overview of all clusters."""

    total_defects: int
    total_clusters: int
    noise_count: int
    silhouette_score: float = Field(0.0, description="Overall silhouette score")
    clusters: list[ClusterInfo]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    version: str
    total_defects: int
    total_clusters: int
    embedding_model: str


# --- Audit & Approval Models ---

class AuditLogEntry(BaseModel):
    """Single audit log entry."""
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    action: str = Field(..., description="Action type (DUPLICATE_DETECTED, FIELD_ENRICHED, etc.)")
    defect_id: str = Field("", description="Related defect ID")
    actor: str = Field("SYNTHETIX_v1", description="Actor (system or user)")
    details: dict = Field(default_factory=dict, description="Action details")
    entry_id: str = Field("", description="Unique entry ID")


class AuditLogResponse(BaseModel):
    """Response for audit log queries."""
    total_entries: int
    entries: list[AuditLogEntry]


class ApprovalRequest(BaseModel):
    """Request to approve bulk deduplication."""
    approver_name: str = Field(..., description="Name of the approving user")
    notes: str = Field("", description="Optional approval notes")


class ApprovalResponse(BaseModel):
    """Response after approval."""
    cluster_id: int
    approved_at: str = Field(..., description="ISO 8601 approval timestamp")
    approver: str
    defects_merged: int
    audit_entry_id: str = Field("", description="Audit log entry ID")
    message: str
