import { useEffect, useRef, useState } from "react";
import { Database, Boxes, Copy, Activity, Inbox } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClusterViz } from "@/components/cluster-viz";
import {
  api,
  DECISION_META,
  type ClusterOverview,
  type HealthResponse,
} from "@/lib/api";
import type { RecentAnalysis } from "@/lib/types";
import type { View } from "@/components/nav";

function useCountUp(target: number, run: boolean) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) return;
    const start = performance.now();
    const from = 0;
    const dur = 800;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, run]);
  return v;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Database;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card glass className="transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <span className="grid size-8 place-items-center rounded-lg bg-primary/12 text-primary">
            <Icon className="size-4" />
          </span>
        </div>
        <div className="mt-3 font-serif text-4xl font-medium tracking-tight">
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function Dashboard({
  recent,
  onNavigate,
}: {
  recent: RecentAnalysis[];
  onNavigate: (v: View) => void;
}) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [overview, setOverview] = useState<ClusterOverview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [h, c] = await Promise.allSettled([api.health(), api.clusters()]);
      if (!alive) return;
      if (h.status === "fulfilled") setHealth(h.value);
      if (c.status === "fulfilled") setOverview(c.value);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const totalDefects = health?.total_defects ?? overview?.total_defects ?? 0;
  const totalClusters = health?.total_clusters ?? overview?.total_clusters ?? 0;
  const dupes = recent.filter((r) => r.decision !== "new_defect").length;
  const avgConf =
    recent.length > 0
      ? recent.reduce((a, r) => a + r.confidence, 0) / recent.length
      : 0;

  const defects = useCountUp(totalDefects, loaded);
  const clusters = useCountUp(totalClusters, loaded);

  return (
    <div className="mx-auto max-w-6xl px-6 pb-28 pt-28 md:pt-32">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <Badge variant="outline" className="mb-4">
            <Activity className="size-3.5" />
            Overview
          </Badge>
          <h1 className="font-serif text-4xl font-medium tracking-tight md:text-5xl">
            Triage dashboard
          </h1>
          <p className="mt-3 text-muted-foreground">
            {health
              ? `Live · ${health.embedding_model.split("/").pop()}`
              : "Backend statistics and your recent analyses."}
          </p>
        </div>
        <Button onClick={() => onNavigate("analyzer")}>New analysis</Button>
      </header>

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up">
        <StatCard
          icon={Database}
          label="Defects indexed"
          value={defects.toLocaleString()}
          hint="In the vector store"
        />
        <StatCard
          icon={Boxes}
          label="Clusters"
          value={clusters}
          hint={
            overview ? `${overview.noise_count} noise points` : "DBSCAN groups"
          }
        />
        <StatCard
          icon={Copy}
          label="Dupes (session)"
          value={dupes}
          hint={`${recent.length} analyzed this session`}
        />
        <StatCard
          icon={Activity}
          label="Avg confidence"
          value={recent.length ? `${(avgConf * 100).toFixed(0)}%` : "—"}
          hint="Across your analyses"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Cluster viz */}
        <Card glass className="animate-fade-up">
          <CardHeader>
            <CardTitle>Cluster map</CardTitle>
            <CardDescription>
              {overview
                ? `${overview.total_clusters} clusters · silhouette ${overview.silhouette_score.toFixed(2)}`
                : "Semantic grouping of indexed defects"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background/40">
              <ClusterViz
                totalDefects={totalDefects}
                totalClusters={totalClusters}
                clusters={overview?.clusters}
              />
            </div>
            {overview && overview.clusters.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {overview.clusters.slice(0, 4).map((c) => (
                  <div
                    key={c.cluster_id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="truncate text-sm">
                      {c.cluster_name || c.representative_title || `Cluster ${c.cluster_id}`}
                    </span>
                    <Badge variant="secondary">{c.size}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent */}
        <Card glass className="animate-fade-up">
          <CardHeader>
            <CardTitle>Recent analyses</CardTitle>
            <CardDescription>This session</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Inbox className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No analyses yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("analyzer")}
                >
                  Analyze a defect
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {recent.slice(0, 8).map((r, i) => {
                  const meta = DECISION_META[r.decision];
                  return (
                    <li
                      key={`${r.defect_id}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 transition-colors hover:border-border"
                    >
                      <Badge
                        variant={
                          meta.tone === "success"
                            ? "success"
                            : meta.tone === "warning"
                              ? "warning"
                              : "default"
                        }
                        className="shrink-0"
                      >
                        {meta.label}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {r.title}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {(r.confidence * 100).toFixed(0)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
