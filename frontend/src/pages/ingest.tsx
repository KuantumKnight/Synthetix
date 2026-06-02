import { useRef, useState } from "react";
import { UploadCloud, FileJson, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api, ApiError, type IngestResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type Phase = "idle" | "uploading" | "embedding" | "clustering" | "done" | "error";

const PHASE_PCT: Record<Phase, number> = {
  idle: 0,
  uploading: 25,
  embedding: 60,
  clustering: 90,
  done: 100,
  error: 100,
};

export function Ingest() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const busy = phase === "uploading" || phase === "embedding" || phase === "clustering";

  const pick = (f: File | null) => {
    if (!f) return;
    const ok = /\.(csv|json)$/i.test(f.name);
    if (!ok) {
      setError("Unsupported file — use a .csv or .json dataset.");
      setPhase("error");
      return;
    }
    setFile(f);
    setError(null);
    setPhase("idle");
    setResult(null);
  };

  async function run() {
    if (!file || busy) return;
    setError(null);
    setResult(null);
    setPhase("uploading");
    // staged UX while the single request runs
    const t1 = setTimeout(() => setPhase("embedding"), 500);
    const t2 = setTimeout(() => setPhase("clustering"), 1400);
    try {
      const res = await api.ingest(file);
      clearTimeout(t1);
      clearTimeout(t2);
      setResult(res);
      setPhase("done");
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      setError(err instanceof ApiError ? err.message : "Ingestion failed.");
      setPhase("error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-28 pt-28 md:pt-32">
      <header className="mb-10 animate-fade-up">
        <Badge variant="outline" className="mb-4">
          <UploadCloud className="size-3.5" />
          Ingest
        </Badge>
        <h1 className="font-serif text-4xl font-medium tracking-tight md:text-5xl">
          Load a defect dataset
        </h1>
        <p className="mt-4 text-muted-foreground">
          Upload a CSV or JSON file of defect reports. Synthetix normalizes,
          embeds, indexes, and re-clusters them in one pass.
        </p>
      </header>

      <Card className="animate-fade-up">
        <CardHeader>
          <CardTitle>Dataset upload</CardTitle>
          <CardDescription>
            Expected fields: <span className="font-mono text-xs">defect_id</span>,{" "}
            <span className="font-mono text-xs">title</span>,{" "}
            <span className="font-mono text-xs">description</span> (+ optional
            steps, expected, actual, environment).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Dropzone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 ease-in-out",
              dragging
                ? "border-primary bg-primary/[0.06]"
                : "border-border hover:border-primary/50 hover:bg-accent/40"
            )}
          >
            <span className="grid size-12 place-items-center rounded-xl bg-primary/12 text-primary">
              <UploadCloud className="size-6" />
            </span>
            <div>
              <p className="text-sm font-medium">
                {file ? file.name : "Drop a file or click to browse"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : "CSV or JSON · up to a few MB"}
              </p>
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <FileSpreadsheet className="size-3.5" /> .csv
              </span>
              <span className="inline-flex items-center gap-1">
                <FileJson className="size-3.5" /> .json
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </button>

          {/* Progress */}
          {(busy || phase === "done") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {phase === "uploading" && "Uploading dataset…"}
                  {phase === "embedding" && "Generating embeddings…"}
                  {phase === "clustering" && "Running clustering…"}
                  {phase === "done" && "Complete"}
                </span>
                <span className="font-medium">{PHASE_PCT[phase]}%</span>
              </div>
              <Progress
                value={PHASE_PCT[phase]}
                indicatorClassName={phase === "done" ? "bg-[var(--success)]" : undefined}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={!file || busy}>
              {busy ? "Ingesting…" : "Ingest dataset"}
            </Button>
            {file && !busy && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null);
                  setPhase("idle");
                  setResult(null);
                  setError(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="flex items-start gap-3 rounded-xl border border-[color-mix(in_oklch,var(--success)_30%,var(--border))] bg-[color-mix(in_oklch,var(--success)_8%,transparent)] p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--success)]" />
              <div className="text-sm">
                <p className="font-medium">{result.message}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">Ingested {result.total_ingested}</Badge>
                  <Badge variant="secondary">Skipped {result.total_skipped}</Badge>
                  <Badge variant="secondary">Clusters {result.clusters_formed}</Badge>
                  {result.silhouette_score > 0 && (
                    <Badge variant="secondary">
                      Silhouette {result.silhouette_score.toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/[0.06] p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Ingestion failed</p>
                <p className="mt-1 text-muted-foreground">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
