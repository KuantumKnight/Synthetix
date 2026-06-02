import React from "react";
import { cn } from "@/lib/utils";

type Intensity = "chrome" | "panel";

/**
 * Liquid-glass surface — adapted from needs/2.txt.
 *
 * Three stacked layers behind a non-filtered content layer (z-30), so the
 * refraction/distortion only ever warps the *backdrop*, never the text:
 *   z-0  refraction  — backdrop blur + (chrome only) SVG displacement+specular
 *   z-10 tint        — translucent fill; more opaque for readable `panel`s
 *   z-20 specular    — inset highlight + hairline border
 *
 * `chrome`  → full 2.txt fidelity (displacement + specular lighting). For nav,
 *             buttons, hero — decorative surfaces with little text.
 * `panel`   → blur+saturate+tint only (cheaper, crisper text). For content cards.
 *
 * Mount <GlassFilter/> once per page to enable the chrome distortion filter.
 */
export function GlassSurface({
  children,
  className,
  style,
  intensity = "chrome",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  intensity?: Intensity;
}) {
  const refraction: React.CSSProperties =
    intensity === "chrome"
      ? {
          backdropFilter: "blur(6px) saturate(180%)",
          WebkitBackdropFilter: "blur(6px) saturate(180%)",
          filter: "url(#synthetix-glass)",
          isolation: "isolate",
        }
      : {
          backdropFilter: "blur(20px) saturate(185%)",
          WebkitBackdropFilter: "blur(20px) saturate(185%)",
        };

  return (
    <div
      className={cn("relative isolate flex overflow-hidden", className)}
      style={style}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
        style={refraction}
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
        style={{
          background:
            intensity === "panel" ? "var(--glass-panel-bg)" : "var(--glass-bg)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
        style={{
          boxShadow:
            "inset 1.5px 1.5px 0.5px 0 var(--glass-highlight), inset -1px -1px 1px 1px var(--glass-shadow)",
          border: "1px solid var(--glass-border)",
        }}
      />
      <div className="relative z-30 w-full">{children}</div>
    </div>
  );
}

/** Glass card preset — floating content panel. */
export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassSurface
      intensity="panel"
      className={cn("rounded-2xl text-card-foreground shadow-xl", className)}
    >
      {children}
    </GlassSurface>
  );
}

/** Glass CTA button — clay-tinted (`primary`) keeps the 10% accent role. */
export function GlassButton({
  children,
  tone = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "neutral";
}) {
  return (
    <button
      className={cn(
        "group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-7 py-3.5 text-sm font-medium shadow-lg transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        tone === "primary" ? "text-primary-foreground" : "text-foreground",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
        style={{
          backdropFilter: "blur(6px) saturate(180%)",
          WebkitBackdropFilter: "blur(6px) saturate(180%)",
          filter: "url(#synthetix-glass)",
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
        style={{
          background:
            tone === "primary"
              ? "color-mix(in oklch, var(--primary) 88%, transparent)"
              : "var(--glass-bg)",
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit]"
        style={{
          boxShadow:
            "inset 1.5px 1.5px 0.5px 0 var(--glass-highlight), inset -1px -1px 1px 1px var(--glass-shadow)",
          border: "1px solid var(--glass-border)",
        }}
      />
      <span className="relative z-30 inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
}

/**
 * SVG displacement + specular filter — full needs/2.txt fidelity.
 * Mount once per page (renders nothing visible).
 */
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
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
        <feSpecularLighting
          in="softMap"
          surfaceScale="5"
          specularConstant="1"
          specularExponent="100"
          lightingColor="white"
          result="specLight"
        >
          <fePointLight x="-200" y="-200" z="300" />
        </feSpecularLighting>
        <feComposite
          in="specLight"
          operator="arithmetic"
          k1="0"
          k2="1"
          k3="1"
          k4="0"
          result="litImage"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softMap"
          scale="120"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
