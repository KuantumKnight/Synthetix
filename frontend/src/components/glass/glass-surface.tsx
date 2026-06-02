import React from "react";
import { cn } from "@/lib/utils";

/**
 * Liquid-glass surface — adapted from needs/2.txt.
 * Layered refraction + specular inset highlight, theme-aware via the
 * `.glass` token utilities defined in index.css. Pair once per page with
 * <GlassFilter/> to enable the SVG displacement distortion.
 */
export function GlassSurface({
  children,
  className,
  style,
  distort = true,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  distort?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex overflow-hidden transition-all duration-700",
        className
      )}
      style={{ transitionTimingFunction: "cubic-bezier(0.175,0.885,0.32,2.2)", ...style }}
    >
      {/* refraction layer */}
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
        style={{
          backdropFilter: "blur(8px) saturate(160%)",
          WebkitBackdropFilter: "blur(8px) saturate(160%)",
          filter: distort ? "url(#synthetix-glass)" : undefined,
          isolation: "isolate",
        }}
      />
      {/* tint */}
      <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-[var(--glass-bg)]" />
      {/* specular inset edge */}
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
        style={{
          boxShadow:
            "inset 1.5px 1.5px 0.5px 0 var(--glass-highlight), inset -1px -1px 1px 1px var(--glass-shadow)",
          border: "1px solid var(--glass-border)",
        }}
      />
      <div className="relative z-30 flex w-full">{children}</div>
    </div>
  );
}

/** SVG displacement filter — mount once per page (it's display:none). */
export function GlassFilter() {
  return (
    <svg aria-hidden className="absolute h-0 w-0" style={{ position: "absolute" }}>
      <filter
        id="synthetix-glass"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.001 0.005"
          numOctaves="1"
          seed="17"
          result="turbulence"
        />
        <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softMap"
          scale="60"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
