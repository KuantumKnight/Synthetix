"""
Synthetix Pydantic Models – Defect Reports
Input/output schemas for defect analysis.
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal


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


class MatchResult(BaseModel):
    """A single matched defect from similarity search."""

    defect_id: str = Field(..., description="ID of the matched defect")
    title: str = Field(..., description="Title of the matched defect")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity score")
    cluster_id: int = Field(..., description="Cluster ID of the matched defect")


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


class IngestResponse(BaseModel):
    """Response for bulk data ingestion."""

    total_ingested: int = Field(..., description="Number of defects ingested")
    total_skipped: int = Field(0, description="Number of defects skipped")
    clusters_formed: int = Field(..., description="Number of clusters formed")
    message: str = Field(..., description="Status message")


class ClusterInfo(BaseModel):
    """Information about a single cluster."""

    cluster_id: int
    size: int
    representative_title: str
    defect_ids: list[str]


class ClusterOverview(BaseModel):
    """Overview of all clusters."""

    total_defects: int
    total_clusters: int
    noise_count: int
    clusters: list[ClusterInfo]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    version: str
    total_defects: int
    total_clusters: int
    embedding_model: str
