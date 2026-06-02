import { useState } from "react";
import { ScanSearch, AlertTriangle, FileText, Quote, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pipeline, PIPELINE_STEPS } from "@/components/pipeline";
import {
  api,
  ApiError,
  DECISION_META,
  type AnalysisResult,
  type DefectReport,
} from "@/lib/api";
import type { RecentAnalysis } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY: DefectReport = {
  defect_id: "",
  title: "",
  description: "",
  steps: "",
  expected: "",
  actual: "",
  environment: "",
  logs: "",
};

const SAMPLE: DefectReport = {
  defect_id: "BUG-2041",
  title: "Login fails with expired token",
  description:
    "When a user attempts to log in with an expired JWT token, the application crashes instead of prompting re-authentication.",
  steps: "1. Open login page\n2. Submit credentials with an expired session\n3. Observe crash",
  expected: "User is shown an 'expired session' message and redirected to re-auth.",
  actual: "Application returns a 500 Internal Server Error and the page goes blank.",
  environment: "Chrome 120, Windows 11, Production",
  logs: "NullPointerException at AuthService.java:142",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tone = (t: "primary" | "warning" | "success") =>
  t === "success" ? "success" : t === "warning" ? "warning" : "default";

export function Analyzer({
  onAnalyzed,
}: {
  onAnalyzed: (a: RecentAnalysis) => void;
}) {
  const [form, setForm] = useState<DefectReport>(EMPTY);
  const [step, setStep] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof DefectReport) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.defect_id.trim() && form.title.trim() && form.description.trim();

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);

    const payload: DefectReport = {
      ...form,
      steps: form.steps?.trim() || null,
      expected: form.expected?.trim() || null,
      actual: form.actual?.trim() || null,
      environment: form.environment?.trim() || null,
      logs: form.logs?.trim() || null,
    };

    try {
      // animate first three steps, fire request, then finish
      setStep(0);
      await sleep(400);
      setStep(1);
      await sleep(550);
      setStep(2);
      const req = api.analyze(payload);
      await sleep(500);
      setStep(3);
      await sleep(350);
      setStep(4);
      const res = await req;
      setStep(PIPELINE_STEPS.length);
      await sleep(250);
      setResult(res);
      onAnalyzed({
        defect_id: payload.defect_id,
        title: payload.title,
        decision: res.decision,
        confidence: res.confidence,
        cluster_id: res.cluster_id,
        at: Date.now(),
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Could not reach the analysis service.";
      setError(msg);
      setStep(-1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pb-28 pt-28 md:pt-32">
      <header className="mb-10 max-w-2xl animate-fade-up">
        <Badge variant="outline" className="mb-4">
          <ScanSearch className="size-3.5" />
          Analyze
        </Badge>
        <h1 className="font-serif text-4xl font-medium tracking-tight md:text-5xl">
          Submit a defect for triage
        </h1>
        <p className="mt-4 text-muted-foreground">
          Synthetix retrieves similar defects, re-ranks them, assigns a cluster,
          and enriches your report — with evidence for every step.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ── Form ── */}
        <Card glass className="animate-fade-up">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Defect report</CardTitle>
              <CardDescription>Fields marked * are required.</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setForm(SAMPLE)}
            >
              Load sample
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={analyze} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Defect ID *" htmlFor="defect_id">
                  <Input
                    id="defect_id"
                    placeholder="BUG-1042"
                    value={form.defect_id}
                    onChange={(e) => set("defect_id")(e.target.value)}
                  />
                </Field>
                <Field label="Environment" htmlFor="environment">
                  <Input
                    id="environment"
                    placeholder="Chrome 120, Windows 11, Prod"
                    value={form.environment ?? ""}
                    onChange={(e) => set("environment")(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Title *" htmlFor="title">
                <Input
                  id="title"
                  placeholder="Login fails with expired token"
                  value={form.title}
                  onChange={(e) => set("title")(e.target.value)}
                />
              </Field>

              <Field label="Description *" htmlFor="description">
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="Describe the defect…"
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Steps to reproduce" htmlFor="steps">
                  <Textarea
                    id="steps"
                    rows={3}
                    placeholder={"1. …\n2. …"}
                    value={form.steps ?? ""}
                    onChange={(e) => set("steps")(e.target.value)}
                  />
                </Field>
                <Field label="Expected behavior" htmlFor="expected">
                  <Textarea
                    id="expected"
                    rows={3}
                    placeholder="What should happen"
                    value={form.expected ?? ""}
                    onChange={(e) => set("expected")(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Actual behavior" htmlFor="actual">
                  <Textarea
                    id="actual"
                    rows={3}
                    placeholder="What actually happened"
                    value={form.actual ?? ""}
                    onChange={(e) => set("actual")(e.target.value)}
                  />
                </Field>
                <Field label="Logs" htmlFor="logs">
                  <Textarea
                    id="logs"
                    rows={3}
                    className="font-mono text-xs"
                    placeholder="Stack trace / log output"
                    value={form.logs ?? ""}
                    onChange={(e) => set("logs")(e.target.value)}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button type="submit" disabled={!valid || busy}>
                  {busy ? "Analyzing…" : "Analyze defect"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setForm(EMPTY);
                    setResult(null);
                    setError(null);
                    setStep(-1);
                  }}
                  disabled={busy}
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Pipeline + Results ── */}
        <div className="space-y-6">
          <Card glass className="animate-fade-up">
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>
                {busy
                  ? "Running…"
                  : result
                    ? "Complete"
                    : "Idle — submit a defect to begin."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Pipeline step={step} />
            </CardContent>
          </Card>

          {error && (
            <Card glass className="border-destructive/40 animate-fade-up">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">Analysis failed</p>
                  <p className="mt-1 text-muted-foreground">{error}</p>
                  <p className="mt-3 text-muted-foreground">
                    Ensure the backend is running:
                  </p>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-secondary px-3 py-2 font-mono text-xs">
                    uvicorn backend.main:app --reload --port 8000
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {result && <Result result={result} />}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Result({ result }: { result: AnalysisResult }) {
  const meta = DECISION_META[result.decision];
  const ir = result.improved_report;
  const checks = result.hallucination_check;
  const allClear =
    checks.summary_grounded_in_source &&
    checks.all_citations_traceable &&
    checks.fields_not_hallucinated;
  const comp = ir.completeness_score;
  const compTone =
    comp >= 80 ? "var(--success)" : comp >= 50 ? "var(--warning)" : "var(--destructive)";

  return (
    <Card glass className="animate-fade-up overflow-hidden">
      <CardContent className="space-y-6 pt-6">
        {/* Decision header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={tone(meta.tone)} className="text-sm">
              {meta.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Cluster <span className="font-mono text-foreground">#{result.cluster_id}</span>
            </span>
          </div>
          <div className="text-right">
            <div className="font-serif text-3xl font-medium tracking-tight text-primary">
              {(result.confidence * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Confidence
            </div>
          </div>
        </div>

        <Separator />

        {/* Matches */}
        <div>
          <h4 className="mb-3 text-sm font-medium">
            Top matches{" "}
            <span className="text-muted-foreground">
              ({result.top_matches.length})
            </span>
          </h4>
          {result.top_matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No similar defects found in the database.
            </p>
          ) : (
            <div className="space-y-2.5">
              {result.top_matches.map((m) => {
                const pct = Math.round(m.similarity_score * 100);
                return (
                  <div
                    key={m.defect_id}
                    className="rounded-xl border border-border/60 p-3 transition-colors hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {m.defect_id}
                      </span>
                      <span className="text-xs font-medium">{pct}%</span>
                    </div>
                    <div className="mt-0.5 truncate text-sm">{m.title}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {m.evidence.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.evidence.slice(0, 4).map((ev, i) => (
                          <span
                            key={i}
                            title={ev.snippet}
                            className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {ev.field}
                            <span className="text-foreground/50"> · {ev.match_type}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Enhanced report */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-primary" />
            Enhanced report
          </h4>
          <p className="font-serif text-lg font-medium tracking-tight">
            {ir.improved_title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {ir.summary}
          </p>

          {/* Completeness */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Completeness</span>
              <span className="font-medium" style={{ color: compTone }}>
                {comp.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${comp}%`, background: compTone }}
              />
            </div>
          </div>

          {/* Enriched fields */}
          {Object.keys(ir.enriched_fields).length > 0 && (
            <div className="mt-4 space-y-2">
              {Object.entries(ir.enriched_fields).map(([k, f]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                >
                  <span className="font-mono text-xs text-muted-foreground">{k}</span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="max-w-[14rem] truncate">
                      {f.value ?? "—"}
                    </span>
                    <EnrichBadge status={f.status} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Missing fields */}
          {ir.missing_fields.length > 0 && (
            <div className="mt-4 space-y-2">
              {ir.missing_fields.map((f) => (
                <div
                  key={f.field_name}
                  className="flex items-start gap-2.5 rounded-lg border border-[color-mix(in_oklch,var(--warning)_30%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] px-3 py-2"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" />
                  <div>
                    <div className="text-sm font-medium">{f.field_name}</div>
                    <div className="text-xs text-muted-foreground">{f.suggestion}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Citations */}
          {ir.citations.length > 0 && (
            <div className="mt-4">
              <h5 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Quote className="size-3.5" /> Citations
              </h5>
              <ul className="space-y-1.5">
                {ir.citations.slice(0, 5).map((c, i) => (
                  <li
                    key={i}
                    className="rounded-lg border-l-2 border-primary/50 bg-secondary/50 px-3 py-1.5 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">{c.source}</span>
                    {c.location && (
                      <span className="text-muted-foreground"> · {c.location}</span>
                    )}
                    <p className="mt-0.5 text-foreground/80">{c.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Hallucination check */}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm",
            allClear
              ? "border-[color-mix(in_oklch,var(--success)_30%,var(--border))] bg-[color-mix(in_oklch,var(--success)_8%,transparent)]"
              : "border-[color-mix(in_oklch,var(--warning)_30%,var(--border))] bg-[color-mix(in_oklch,var(--warning)_8%,transparent)]"
          )}
        >
          <ShieldCheck
            className={cn(
              "size-4 shrink-0",
              allClear ? "text-[var(--success)]" : "text-[var(--warning)]"
            )}
          />
          <span className="text-muted-foreground">
            {allClear
              ? "Verified — summary grounded, citations traceable, no invented fields."
              : "Review recommended — one or more grounding checks did not pass."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EnrichBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PRESENT:
      "bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[var(--success)]",
    INFERRED: "bg-primary/12 text-primary",
    MISSING_DATA: "bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        map[status] ?? "bg-secondary text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}
