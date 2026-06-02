import { BookText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/v1/analyze",
    desc: "Full analysis of one defect — duplicate detection, clustering, enrichment, hallucination check.",
    body: `{
  "defect_id": "BUG-1042",
  "title": "Login fails with expired token",
  "description": "App crashes on expired JWT…",
  "environment": "Chrome 120, Prod"
}`,
  },
  {
    method: "POST",
    path: "/api/v1/ingest",
    desc: "Bulk ingest a CSV/JSON dataset, then embed, index, and re-cluster.",
    body: `# multipart/form-data
file=@defects.csv`,
  },
  {
    method: "GET",
    path: "/api/v1/clusters",
    desc: "Overview of all clusters with sizes, names, and triage recommendations.",
    body: `# → ClusterOverview
{ "total_clusters": 12, "clusters": [ … ] }`,
  },
  {
    method: "GET",
    path: "/api/v1/health",
    desc: "Service status, indexed-defect count, and the active embedding model.",
    body: `# → HealthResponse
{ "status": "healthy", "total_defects": 0 }`,
  },
];

const TIERS = [
  {
    name: "Duplicate",
    range: "≥ 0.85",
    tone: "default" as const,
    action: "Auto-resolve candidate — high-confidence match.",
  },
  {
    name: "Possible duplicate",
    range: "0.70 – 0.84",
    tone: "warning" as const,
    action: "Flag for human review.",
  },
  {
    name: "New defect",
    range: "< 0.70",
    tone: "success" as const,
    action: "Index as a novel defect.",
  },
];

function MethodPill({ method }: { method: string }) {
  return (
    <span
      className={
        "rounded-md px-2 py-0.5 font-mono text-xs font-semibold " +
        (method === "POST"
          ? "bg-primary/12 text-primary"
          : "bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[var(--success)]")
      }
    >
      {method}
    </span>
  );
}

export function Docs() {
  return (
    <div className="mx-auto max-w-4xl px-6 pb-28 pt-28 md:pt-32">
      <header className="mb-10 animate-fade-up">
        <Badge variant="outline" className="mb-4">
          <BookText className="size-3.5" />
          Documentation
        </Badge>
        <h1 className="font-serif text-4xl font-medium tracking-tight md:text-5xl">
          How Synthetix works
        </h1>
        <p className="mt-4 text-muted-foreground">
          A hybrid retrieval pipeline: bi-encoder embeddings for fast candidate
          search, cross-encoder re-ranking for precision, DBSCAN for clustering,
          and extractive enrichment with full citations.
        </p>
      </header>

      <Tabs defaultValue="pipeline" className="animate-fade-up">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="tiers">Decision tiers</TabsTrigger>
        </TabsList>

        {/* Pipeline */}
        <TabsContent value="pipeline">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Preprocessing", "Strip HTML/markdown, normalize, combine fields.", "~30ms"],
              ["Embeddings", "all-MiniLM-L6-v2 → 384-dim semantic vectors.", "~40ms"],
              ["Re-ranking", "ms-marco-TinyBERT cross-encoder over top-K.", "~250ms"],
              ["Clustering", "DBSCAN (eps 0.35) auto-groups related defects.", "~100ms"],
              ["Enrichment", "Rule-based extraction of structured fields.", "~100ms"],
              ["Evidence", "Citation engine traces every decision to source.", "incl."],
            ].map(([t, d, lat]) => (
              <Card glass key={t}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-medium tracking-tight">
                      {t}
                    </h3>
                    <span className="font-mono text-xs text-muted-foreground">
                      {lat}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* API */}
        <TabsContent value="api">
          <div className="space-y-4">
            {ENDPOINTS.map((e) => (
              <Card glass key={e.path}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2.5 text-base">
                    <MethodPill method={e.method} />
                    <span className="font-mono text-sm">{e.path}</span>
                  </CardTitle>
                  <CardDescription>{e.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-x-auto rounded-xl bg-secondary p-4 font-mono text-xs leading-relaxed">
                    {e.body}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tiers */}
        <TabsContent value="tiers">
          <div className="space-y-3">
            {TIERS.map((t) => (
              <Card glass key={t.name}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
                  <div className="flex items-center gap-3">
                    <Badge variant={t.tone}>{t.name}</Badge>
                    <span className="text-sm text-muted-foreground">{t.action}</span>
                  </div>
                  <span className="font-mono text-sm font-medium">{t.range}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
