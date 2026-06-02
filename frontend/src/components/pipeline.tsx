import {
  Eraser,
  Binary,
  Search,
  Network,
  Sparkles,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const PIPELINE_STEPS = [
  { id: "normalize", label: "Normalize", detail: "Strip noise, combine fields", icon: Eraser },
  { id: "embed", label: "Embed", detail: "Bi-encoder 384-dim vector", icon: Binary },
  { id: "search", label: "Retrieve", detail: "Top-K semantic candidates", icon: Search },
  { id: "cluster", label: "Cluster", detail: "DBSCAN assignment", icon: Network },
  { id: "enhance", label: "Enhance", detail: "Extract fields + citations", icon: Sparkles },
] as const;

/**
 * `step`: -1 idle · 0..n active index · steps.length = all complete.
 */
export function Pipeline({ step }: { step: number }) {
  return (
    <ol className="space-y-2.5">
      {PIPELINE_STEPS.map((s, i) => {
        const done = step > i;
        const active = step === i;
        const Icon = s.icon;
        return (
          <li
            key={s.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ease-in-out",
              active && "border-primary/40 bg-primary/[0.06] shadow-sm",
              done && "border-border bg-card",
              !active && !done && "border-border/60 bg-card/40 opacity-60"
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                done && "bg-[color-mix(in_oklch,var(--success)_18%,transparent)] text-[var(--success)]",
                active && "bg-primary/15 text-primary",
                !active && !done && "bg-secondary text-muted-foreground"
              )}
            >
              {done ? (
                <Check className="size-4" />
              ) : active ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  "text-sm font-medium",
                  active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </div>
              <div className="truncate text-xs text-muted-foreground">{s.detail}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
