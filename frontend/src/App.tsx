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
