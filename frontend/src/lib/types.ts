import type { Decision } from "@/lib/api";

/** A locally-tracked analysis, surfaced in the dashboard's recent list. */
export interface RecentAnalysis {
  defect_id: string;
  title: string;
  decision: Decision;
  confidence: number;
  cluster_id: number;
  at: number; // epoch ms
}
