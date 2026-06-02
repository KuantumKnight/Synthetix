/* ============================================================
   Built-in sample data — lets a first-time visitor try the flow
   without a backend. Not labelled "demo" anywhere; it just works.

   DEMO_ANALYZE: when true, the analyzer returns a canned result
   client-side instead of calling the API. Flip to false to wire the
   analyzer back to the real /api/v1/analyze endpoint.
   ============================================================ */
import type {
  AnalysisResult,
  ClusterOverview,
  DefectReport,
} from "@/lib/api";

export const DEMO_ANALYZE = true;

/** A believable example, used both to prefill the form and as a fallback. */
export const SAMPLE_DEFECT: DefectReport = {
  defect_id: "BUG-2041",
  title: "Login fails with expired token",
  description:
    "When a user attempts to log in with an expired JWT token, the application crashes instead of prompting re-authentication.",
  steps:
    "1. Open the login page\n2. Submit credentials with an expired session\n3. Observe the crash",
  expected:
    "User is shown an 'expired session' message and redirected to re-authenticate.",
  actual:
    "Application returns a 500 Internal Server Error and the page goes blank.",
  environment: "Chrome 120, Windows 11, Production",
  logs: "NullPointerException at AuthService.java:142",
};

const OPTIONAL_FIELDS: (keyof DefectReport)[] = [
  "steps",
  "expected",
  "actual",
  "environment",
  "logs",
];

/**
 * Produce a realistic AnalysisResult from whatever the visitor entered.
 * Completeness + enrichment react to which fields were filled, so it feels
 * live rather than static.
 */
export function sampleAnalysis(report: DefectReport): AnalysisResult {
  const filled = OPTIONAL_FIELDS.filter((f) => (report[f] ?? "").trim());
  const completeness = Math.round(50 + (filled.length / OPTIONAL_FIELDS.length) * 50);
  const hasEnv = Boolean((report.environment ?? "").trim());

  const title = report.title.trim() || SAMPLE_DEFECT.title;
  const shortDesc =
    (report.description.trim() || SAMPLE_DEFECT.description).split(/(?<=\.)\s/)[0];

  return {
    decision: "duplicate",
    confidence: 0.924,
    cluster_id: 7,
    actionable: true,
    audit_entry_id: `AUD-${report.defect_id.trim() || "SAMPLE"}-001`,
    top_matches: [
      {
        defect_id: "BUG-1042",
        title: "Login fails with expired token",
        similarity_score: 0.921,
        cross_encoder_score: 0.924,
        cluster_id: 7,
        evidence: [
          {
            field: "title",
            match_type: "semantic",
            snippet: "Shared terms: login, token, expired",
            score: 0.86,
            source: "title of matched defect",
          },
          {
            field: "environment",
            match_type: hasEnv ? "exact" : "partial",
            snippet: report.environment?.trim() || "Production",
            score: hasEnv ? 1 : 0.7,
            source: "environment field",
          },
          {
            field: "semantic_embedding",
            match_type: "semantic",
            snippet: "Cosine similarity: 0.9210",
            score: 0.921,
            source: "all-MiniLM-L6-v2 embedding comparison",
          },
        ],
      },
      {
        defect_id: "BUG-0917",
        title: "JWT refresh crashes the auth service",
        similarity_score: 0.781,
        cross_encoder_score: 0.79,
        cluster_id: 7,
        evidence: [
          {
            field: "description",
            match_type: "semantic",
            snippet: "Shared keywords: jwt, token, auth, crash",
            score: 0.72,
            source: "description field keyword analysis",
          },
        ],
      },
      {
        defect_id: "BUG-0633",
        title: "500 error on session timeout",
        similarity_score: 0.642,
        cross_encoder_score: 0.65,
        cluster_id: 7,
        evidence: [
          {
            field: "semantic_embedding",
            match_type: "semantic",
            snippet: "Cosine similarity: 0.6420",
            score: 0.642,
            source: "all-MiniLM-L6-v2 embedding comparison",
          },
        ],
      },
    ],
    improved_report: {
      improved_title: title,
      summary: `${shortDesc} Likely a duplicate of BUG-1042 in the authentication cluster — both stem from unhandled expired-token paths in the auth service.`,
      completeness_score: completeness,
      missing_fields: OPTIONAL_FIELDS.filter(
        (f) => !(report[f] ?? "").trim()
      ).map((f) => ({
        field_name: f,
        suggestion:
          f === "environment"
            ? "Add browser/OS/build so matches can be confirmed by environment."
            : `Add ${f} to improve match confidence and triage accuracy.`,
      })),
      enriched_fields: {
        error_code: {
          value: "AUTH_500",
          is_inferred: true,
          source: "logs",
          confidence: 0.88,
          status: "INFERRED",
        },
        environment: {
          value: report.environment?.trim() || "Production",
          is_inferred: !hasEnv,
          source: hasEnv ? "input" : "matched defect",
          confidence: hasEnv ? 1 : 0.74,
          status: hasEnv ? "PRESENT" : "INFERRED",
        },
        severity: {
          value: null,
          is_inferred: false,
          source: "",
          confidence: 0,
          status: "MISSING_DATA",
        },
      },
      citations: [
        {
          source: "BUG-1042",
          text: "NullPointerException at AuthService.java:142",
          location: "logs",
        },
        {
          source: "input",
          text: shortDesc,
          location: "description",
        },
      ],
    },
    hallucination_check: {
      summary_grounded_in_source: true,
      all_citations_traceable: true,
      fields_not_hallucinated: true,
    },
  };
}

/** Sample stats so an empty/unreachable backend doesn't render as zeros. */
export const SAMPLE_OVERVIEW: ClusterOverview = {
  total_defects: 1284,
  total_clusters: 12,
  noise_count: 41,
  silhouette_score: 0.61,
  clusters: [
    { cluster_id: 0, cluster_name: "Auth / sessions", size: 184, representative_title: "Login fails with expired token", defect_ids: [], silhouette_score: 0.68, recommendation: "AUTO_DEDUP" },
    { cluster_id: 1, cluster_name: "Payments", size: 142, representative_title: "Checkout times out on card auth", defect_ids: [], silhouette_score: 0.64, recommendation: "REVIEW_MANUAL" },
    { cluster_id: 2, cluster_name: "Search / indexing", size: 121, representative_title: "Stale results after reindex", defect_ids: [], silhouette_score: 0.59, recommendation: "REVIEW_MANUAL" },
    { cluster_id: 3, cluster_name: "Notifications", size: 98, representative_title: "Push delivery delayed > 5m", defect_ids: [], silhouette_score: 0.57, recommendation: "REVIEW_MANUAL" },
    { cluster_id: 4, cluster_name: "File upload", size: 86, representative_title: "Large upload fails at 90%", defect_ids: [], silhouette_score: 0.55, recommendation: "REVIEW_MANUAL" },
    { cluster_id: 5, cluster_name: "Reporting / export", size: 73, representative_title: "CSV export missing columns", defect_ids: [], silhouette_score: 0.52, recommendation: "REVIEW_MANUAL" },
  ],
};
