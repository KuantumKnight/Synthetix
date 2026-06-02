import {
  ShieldCheck,
  FileSearch,
  GitMerge,
  Gauge,
  Quote,
  ArrowRight,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { SectionWithMockup } from "@/components/sections/section-with-mockup";

// three.js is heavy and only used here — load it after first paint.
const GLSLHills = lazy(() =>
  import("@/components/backgrounds/glsl-hills").then((m) => ({
    default: m.GLSLHills,
  }))
);
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { View } from "@/components/nav";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-serif text-3xl font-medium tracking-tight md:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Zero-hallucination",
    body: "Extractive NLP only. Every enriched field traces back to source text — never generated.",
  },
  {
    icon: FileSearch,
    title: "Evidence trails",
    body: "“92% match because of an identical stack trace.” Each decision is grounded and auditable.",
  },
  {
    icon: GitMerge,
    title: "Semantic dedup",
    body: "Bi-encoder retrieval + cross-encoder re-ranking surface true duplicates, not keyword matches.",
  },
  {
    icon: Gauge,
    title: "Confidence tiers",
    body: "Auto-resolve ≥0.85, flag for review 0.70–0.84, mark new below — calibrated to your risk.",
  },
];

export function Landing({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <div className="animate-fade-up">
      {/* ── Hero ── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <Suspense fallback={null}>
          <GLSLHills className="opacity-70 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,black,transparent)]" />
        </Suspense>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />

        <div className="relative z-10 mx-auto max-w-3xl px-6 py-32 text-center">
          <Badge variant="outline" className="mb-6 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-primary" />
            AI-driven defect triage
          </Badge>
          <h1 className="text-balance font-serif text-5xl font-medium leading-[1.02] tracking-tight md:text-7xl">
            Find the duplicate.
            <br />
            <span className="text-primary">Prove the match.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
            Synthetix deduplicates, enriches, and clusters bug reports with
            semantic embeddings — and a full chain of evidence behind every
            decision.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => onNavigate("analyzer")}>
              Analyze a defect
              <ArrowRight />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="backdrop-blur-sm"
              onClick={() => onNavigate("dashboard")}
            >
              View dashboard
            </Button>
          </div>

          <div className="mx-auto mt-16 grid max-w-lg grid-cols-3 gap-8">
            <Stat value="≤500ms" label="API latency" />
            <Stat value="384-dim" label="Embeddings" />
            <Stat value="3-tier" label="Confidence" />
          </div>
        </div>
      </section>

      {/* ── Feature section 1 ── */}
      <SectionWithMockup
        eyebrow="Detection"
        title={<>Duplicates, with the receipts.</>}
        description="Submit a defect and Synthetix retrieves the closest matches, re-ranks them with a cross-encoder, and explains exactly why each one matched — shared stack traces, identical environments, overlapping symptoms."
        mockup={<ResultMockup />}
      />

      {/* ── Feature section 2 ── */}
      <SectionWithMockup
        reverseLayout
        eyebrow="Enrichment"
        title={<>Complete the report automatically.</>}
        description="Missing environment? Unclear repro steps? Synthetix extracts and infers structured fields from the text you already wrote, scores completeness, and flags what's still missing — all extractive, never invented."
        mockup={<EnrichMockup />}
      />

      {/* ── Feature grid ── */}
      <section className="relative w-full py-24 md:py-32">
        <div className="grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-serif text-4xl font-medium tracking-tight md:text-5xl">
              Built for regulated, high-volume QA.
            </h2>
            <p className="mt-5 text-muted-foreground">
              Designed for environments with 500+ engineers and thousands of
              daily defects — where every automated decision must be defensible.
            </p>
          </div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md"
              >
                <span className="mb-4 inline-grid size-10 place-items-center rounded-xl bg-primary/12 text-primary transition-transform duration-300 group-hover:scale-[1.08]">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-serif text-lg font-medium tracking-tight">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="relative w-full py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Quote className="mx-auto mb-6 size-8 text-primary" />
          <p className="text-balance font-serif text-2xl font-medium leading-snug tracking-tight md:text-4xl">
            “Every match comes with a citation. Nothing is auto-resolved on a
            hunch.”
          </p>
          <p className="mt-6 text-sm uppercase tracking-wide text-muted-foreground">
            The Synthetix principle
          </p>
        </div>
      </section>
    </div>
  );
}

/* ── Lightweight live-styled mockups (no external images) ── */

function ResultMockup() {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-medium text-primary">
          Duplicate
        </span>
        <span className="font-serif text-2xl font-medium text-primary">92.4%</span>
      </div>
      {[
        { id: "BUG-1042", t: "Login fails with expired token", s: 92 },
        { id: "BUG-0917", t: "JWT refresh crashes auth service", s: 78 },
        { id: "BUG-0633", t: "500 on session timeout", s: 64 },
      ].map((m) => (
        <div key={m.id} className="rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-muted-foreground">{m.id}</span>
            <span className="font-medium">{m.s}%</span>
          </div>
          <div className="mt-1 truncate text-sm">{m.t}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${m.s}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EnrichMockup() {
  const fields = [
    { k: "environment", v: "Chrome 120 · Win 11 · Prod", status: "INFERRED" },
    { k: "error_code", v: "AUTH_500", status: "PRESENT" },
    { k: "severity", v: "—", status: "MISSING_DATA" },
  ];
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Completeness</span>
        <span className="font-serif text-xl font-medium text-[var(--success)]">82%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-[var(--success)]" style={{ width: "82%" }} />
      </div>
      <div className="space-y-2 pt-1">
        {fields.map((f) => (
          <div key={f.k} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <span className="font-mono text-xs text-muted-foreground">{f.k}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">{f.v}</span>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[10px] font-medium " +
                  (f.status === "PRESENT"
                    ? "bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[var(--success)]"
                    : f.status === "INFERRED"
                      ? "bg-primary/12 text-primary"
                      : "bg-secondary text-muted-foreground")
                }
              >
                {f.status}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
