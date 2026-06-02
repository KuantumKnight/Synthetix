/* ============================================================
   Synthetix API client — typed wrapper over the FastAPI backend.
   In dev, Vite proxies /api -> http://localhost:8000.
   In prod, FastAPI serves the built SPA at the same origin.
   ============================================================ */

const API_BASE = "/api/v1";

// ---- Request / response types (mirror backend/models/defect.py) ----

export interface DefectReport {
  defect_id: string;
  title: string;
  description: string;
  steps?: string | null;
  expected?: string | null;
  actual?: string | null;
  environment?: string | null;
  logs?: string | null;
}

export interface MatchEvidence {
  field: string;
  match_type: string;
  snippet: string;
  score: number;
  source: string;
}

export interface MatchResult {
  defect_id: string;
  title: string;
  similarity_score: number;
  cross_encoder_score: number;
  cluster_id: number;
  evidence: MatchEvidence[];
}

export interface EnrichedField {
  value: string | null;
  is_inferred: boolean;
  source: string;
  confidence: number;
  status: string; // PRESENT | INFERRED | MISSING_DATA
}

export interface Citation {
  source: string;
  text: string;
  location: string;
}

export interface MissingFieldInfo {
  field_name: string;
  suggestion: string;
}

export interface ImprovedReport {
  improved_title: string;
  summary: string;
  missing_fields: MissingFieldInfo[];
  completeness_score: number;
  enriched_fields: Record<string, EnrichedField>;
  citations: Citation[];
}

export interface HallucinationCheck {
  summary_grounded_in_source: boolean;
  all_citations_traceable: boolean;
  fields_not_hallucinated: boolean;
}

export type Decision = "duplicate" | "possible_duplicate" | "new_defect";

export interface AnalysisResult {
  decision: Decision;
  top_matches: MatchResult[];
  cluster_id: number;
  improved_report: ImprovedReport;
  confidence: number;
  actionable: boolean;
  hallucination_check: HallucinationCheck;
  audit_entry_id: string;
}

export interface IngestResponse {
  total_ingested: number;
  total_skipped: number;
  clusters_formed: number;
  silhouette_score: number;
  message: string;
}

export interface ClusterInfo {
  cluster_id: number;
  cluster_name: string;
  size: number;
  representative_title: string;
  defect_ids: string[];
  silhouette_score: number;
  recommendation: string;
}

export interface ClusterOverview {
  total_defects: number;
  total_clusters: number;
  noise_count: number;
  silhouette_score: number;
  clusters: ClusterInfo[];
}

export interface HealthResponse {
  status: string;
  version: string;
  total_defects: number;
  total_clusters: number;
  embedding_model: string;
}

// ---- Error handling ----

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (typeof body?.detail?.message === "string") return body.detail.message;
    if (typeof body?.message === "string") return body.message;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<T>;
}

// ---- Endpoints ----

export const api = {
  health: () => getJson<HealthResponse>("/health"),

  clusters: () => getJson<ClusterOverview>("/clusters"),

  analyze: async (report: DefectReport): Promise<AnalysisResult> => {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new ApiError(await parseError(res), res.status);
    return res.json();
  },

  ingest: async (file: File): Promise<IngestResponse> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/ingest`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new ApiError(await parseError(res), res.status);
    return res.json();
  },
};

export const DECISION_META: Record<
  Decision,
  { label: string; tone: "primary" | "warning" | "success" }
> = {
  duplicate: { label: "Duplicate", tone: "primary" },
  possible_duplicate: { label: "Possible Duplicate", tone: "warning" },
  new_defect: { label: "New Defect", tone: "success" },
};
