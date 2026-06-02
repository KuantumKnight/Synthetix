import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Nav, MobileDock, type View } from "@/components/nav";
import { GlassFilter } from "@/components/glass/glass-surface";
import { Landing } from "@/pages/landing";
import { Dashboard } from "@/pages/dashboard";
import { Analyzer } from "@/pages/analyzer";
import { Ingest } from "@/pages/ingest";
import { Docs } from "@/pages/docs";
import { api } from "@/lib/api";
import type { RecentAnalysis } from "@/lib/types";

// gsap-powered footer — only on landing, load lazily.
const CinematicFooter = lazy(() =>
  import("@/components/cinematic-footer").then((m) => ({
    default: m.CinematicFooter,
  }))
);

// three.js terrain — sitewide ambient backdrop so glass surfaces refract it.
const GLSLHills = lazy(() =>
  import("@/components/backgrounds/glsl-hills").then((m) => ({
    default: m.GLSLHills,
  }))
);

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [recent, setRecent] = useState<RecentAnalysis[]>([]);

  // poll health on mount + every 30s
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try {
        const h = await api.health();
        if (alive) setHealthy(h.status !== "degraded");
      } catch {
        if (alive) setHealthy(false);
      }
    };
    ping();
    const id = setInterval(ping, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const navigate = useCallback((v: View) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const onAnalyzed = useCallback((a: RecentAnalysis) => {
    setRecent((prev) => [a, ...prev].slice(0, 24));
  }, []);

  return (
    <div className="relative min-h-screen">
      <GlassFilter />

      {/* Sitewide ambient backdrop — faint animated terrain + readability wash.
          Glass panels above refract this; the wash keeps plain text legible. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <Suspense fallback={null}>
          <GLSLHills className="opacity-[0.35] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,black,transparent)]" />
        </Suspense>
        <div className="absolute inset-0 bg-gradient-to-b from-background/65 via-background/45 to-background/75" />
      </div>

      <Nav view={view} onNavigate={navigate} healthy={healthy} />

      <main>
        {view === "landing" && <Landing onNavigate={navigate} />}
        {view === "dashboard" && (
          <Dashboard recent={recent} onNavigate={navigate} />
        )}
        {view === "analyzer" && <Analyzer onAnalyzed={onAnalyzed} />}
        {view === "ingest" && <Ingest />}
        {view === "docs" && <Docs />}
      </main>

      {/* Cinematic footer only on the landing page (it's a full-height reveal) */}
      {view === "landing" && (
        <Suspense fallback={null}>
          <CinematicFooter onCta={() => navigate("analyzer")} />
        </Suspense>
      )}

      <MobileDock view={view} onNavigate={navigate} />
    </div>
  );
}
