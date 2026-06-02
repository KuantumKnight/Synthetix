import { LayoutGrid, ScanSearch, Upload, BookText, Home } from "lucide-react";
import { GlassSurface } from "@/components/glass/glass-surface";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export type View = "landing" | "dashboard" | "analyzer" | "ingest" | "docs";

const ITEMS: { id: View; label: string; icon: typeof Home }[] = [
  { id: "landing", label: "Home", icon: Home },
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "analyzer", label: "Analyze", icon: ScanSearch },
  { id: "ingest", label: "Ingest", icon: Upload },
  { id: "docs", label: "Docs", icon: BookText },
];

export function Nav({
  view,
  onNavigate,
  healthy,
}: {
  view: View;
  onNavigate: (v: View) => void;
  healthy: boolean | null;
}) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <GlassSurface
        distort={false}
        className="glass pointer-events-auto w-full max-w-5xl items-center justify-between rounded-2xl px-3 py-2"
      >
        <div className="flex w-full items-center justify-between">
          {/* Brand */}
          <button
            onClick={() => onNavigate("landing")}
            className="group flex items-center gap-2.5 rounded-xl px-2 py-1 transition-all duration-300 hover:-translate-y-0.5"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <svg viewBox="0 0 24 24" className="size-4" fill="none">
                <path d="M12 4 L19 17 H5 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-serif text-base font-semibold tracking-tight">
              Synthetix
            </span>
          </button>

          {/* Center nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {ITEMS.map(({ id, label, icon: Icon }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300 ease-in-out",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-1.5">
            <span
              className="hidden items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex"
              title={
                healthy === null
                  ? "Checking backend…"
                  : healthy
                    ? "Backend connected"
                    : "Backend offline"
              }
            >
              <span
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  healthy === null
                    ? "bg-muted-foreground animate-pulse"
                    : healthy
                      ? "bg-[var(--success)]"
                      : "bg-destructive"
                )}
              />
              {healthy === null ? "…" : healthy ? "Live" : "Offline"}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </GlassSurface>
    </header>
  );
}

/** Mobile bottom dock — same items, glass treatment. */
export function MobileDock({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (v: View) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:hidden">
      <GlassSurface
        distort={false}
        className="glass pointer-events-auto rounded-2xl px-2 py-1.5"
      >
        <div className="flex items-center gap-1">
          {ITEMS.map(({ id, label, icon: Icon }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                aria-label={label}
                className={cn(
                  "grid size-11 place-items-center rounded-xl transition-all duration-300",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>
      </GlassSurface>
    </div>
  );
}
