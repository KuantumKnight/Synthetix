import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* Theme-adaptive footer styles (shadcn oklch tokens) — adapted from needs/5.txt */
const STYLES = `
.cinematic-footer-wrapper {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  --pill-bg-1: color-mix(in oklch, var(--foreground) 3%, transparent);
  --pill-bg-2: color-mix(in oklch, var(--foreground) 1%, transparent);
  --pill-shadow: color-mix(in oklch, var(--background) 50%, transparent);
  --pill-highlight: color-mix(in oklch, var(--foreground) 10%, transparent);
  --pill-inset-shadow: color-mix(in oklch, var(--background) 80%, transparent);
  --pill-border: color-mix(in oklch, var(--foreground) 8%, transparent);
  --pill-bg-1-hover: color-mix(in oklch, var(--foreground) 8%, transparent);
  --pill-bg-2-hover: color-mix(in oklch, var(--foreground) 2%, transparent);
  --pill-border-hover: color-mix(in oklch, var(--foreground) 20%, transparent);
  --pill-shadow-hover: color-mix(in oklch, var(--background) 70%, transparent);
  --pill-highlight-hover: color-mix(in oklch, var(--foreground) 20%, transparent);
}
@keyframes footer-breathe { 0% { transform: translate(-50%,-50%) scale(1); opacity:.6 } 100% { transform: translate(-50%,-50%) scale(1.1); opacity:1 } }
@keyframes footer-scroll-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes footer-heartbeat { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 5px color-mix(in oklch, var(--primary) 50%, transparent)) } 15%,45% { transform: scale(1.2); filter: drop-shadow(0 0 10px color-mix(in oklch, var(--primary) 80%, transparent)) } 30% { transform: scale(1) } }
.animate-footer-breathe { animation: footer-breathe 8s ease-in-out infinite alternate }
.animate-footer-scroll-marquee { animation: footer-scroll-marquee 40s linear infinite }
.animate-footer-heartbeat { animation: footer-heartbeat 2s cubic-bezier(.25,1,.5,1) infinite }
.footer-bg-grid {
  background-size: 60px 60px;
  background-image:
    linear-gradient(to right, color-mix(in oklch, var(--foreground) 3%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 3%, transparent) 1px, transparent 1px);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}
.footer-aurora {
  background: radial-gradient(circle at 50% 50%,
    color-mix(in oklch, var(--primary) 16%, transparent) 0%,
    color-mix(in oklch, var(--secondary) 14%, transparent) 40%, transparent 70%);
}
.footer-glass-pill {
  background: linear-gradient(145deg, var(--pill-bg-1) 0%, var(--pill-bg-2) 100%);
  box-shadow: 0 10px 30px -10px var(--pill-shadow), inset 0 1px 1px var(--pill-highlight), inset 0 -1px 2px var(--pill-inset-shadow);
  border: 1px solid var(--pill-border);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  transition: all .4s cubic-bezier(.16,1,.3,1);
}
.footer-glass-pill:hover {
  background: linear-gradient(145deg, var(--pill-bg-1-hover) 0%, var(--pill-bg-2-hover) 100%);
  border-color: var(--pill-border-hover);
  box-shadow: 0 20px 40px -10px var(--pill-shadow-hover), inset 0 1px 1px var(--pill-highlight-hover);
  color: var(--foreground);
}
.footer-giant-bg-text {
  font-size: 26vw; line-height: .75; font-weight: 900; letter-spacing: -.05em; color: transparent;
  font-family: var(--font-serif);
  -webkit-text-stroke: 1px color-mix(in oklch, var(--foreground) 6%, transparent);
  background: linear-gradient(180deg, color-mix(in oklch, var(--foreground) 10%, transparent) 0%, transparent 60%);
  -webkit-background-clip: text; background-clip: text;
}
.footer-text-glow {
  background: linear-gradient(180deg, var(--foreground) 0%, color-mix(in oklch, var(--foreground) 40%, transparent) 100%);
  font-family: var(--font-serif);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  filter: drop-shadow(0 0 20px color-mix(in oklch, var(--foreground) 15%, transparent));
}
`;

type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { as?: React.ElementType };

const MagneticButton = React.forwardRef<HTMLElement, MagneticButtonProps>(
  ({ className, children, as: Component = "button", ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement>(null);

    useEffect(() => {
      const element = localRef.current;
      if (!element) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      const ctx = gsap.context(() => {
        const onMove = (e: MouseEvent) => {
          const rect = element.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          gsap.to(element, {
            x: x * 0.4, y: y * 0.4,
            rotationX: -y * 0.15, rotationY: x * 0.15,
            scale: 1.05, ease: "power2.out", duration: 0.4,
          });
        };
        const onLeave = () => {
          gsap.to(element, {
            x: 0, y: 0, rotationX: 0, rotationY: 0, scale: 1,
            ease: "elastic.out(1, 0.3)", duration: 1.2,
          });
        };
        element.addEventListener("mousemove", onMove);
        element.addEventListener("mouseleave", onLeave);
        return () => {
          element.removeEventListener("mousemove", onMove);
          element.removeEventListener("mouseleave", onLeave);
        };
      }, element);
      return () => ctx.revert();
    }, []);

    return (
      <Component
        ref={(node: HTMLElement) => {
          (localRef as React.MutableRefObject<HTMLElement | null>).current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef)
            (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }}
        className={cn("cursor-pointer", className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
MagneticButton.displayName = "MagneticButton";

const MarqueeItem = () => (
  <div className="flex items-center space-x-12 px-6">
    <span>Zero-Hallucination Triage</span> <span className="text-primary/60">·</span>
    <span>Evidence-Grounded Matches</span> <span className="text-primary/50">·</span>
    <span>BFSI-Grade Audit Trails</span> <span className="text-primary/60">·</span>
    <span>Semantic Deduplication</span> <span className="text-primary/50">·</span>
    <span>Auto Field Enrichment</span> <span className="text-primary/60">·</span>
  </div>
);

export function CinematicFooter({ onCta }: { onCta?: () => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: "10vh", scale: 0.8, opacity: 0 },
        {
          y: "0vh", scale: 1, opacity: 1, ease: "power1.out",
          scrollTrigger: { trigger: wrapperRef.current, start: "top 80%", end: "bottom bottom", scrub: 1 },
        }
      );
      gsap.fromTo(
        [headingRef.current, linksRef.current],
        { y: 50, opacity: 0 },
        {
          y: 0, opacity: 1, stagger: 0.15, ease: "power3.out",
          scrollTrigger: { trigger: wrapperRef.current, start: "top 40%", end: "bottom bottom", scrub: 1 },
        }
      );
    }, wrapperRef);
    return () => ctx.revert();
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div
        ref={wrapperRef}
        className="relative h-screen w-full"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
      >
        <footer className="cinematic-footer-wrapper fixed bottom-0 left-0 flex h-screen w-full flex-col justify-between overflow-hidden bg-background text-foreground">
          <div className="footer-aurora pointer-events-none absolute left-1/2 top-1/2 z-0 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 animate-footer-breathe rounded-[50%] blur-[80px]" />
          <div className="footer-bg-grid pointer-events-none absolute inset-0 z-0" />

          <div
            ref={giantTextRef}
            className="footer-giant-bg-text pointer-events-none absolute -bottom-[5vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap"
          >
            SYNTHETIX
          </div>

          {/* Marquee */}
          <div className="absolute left-0 top-16 z-10 w-full -rotate-2 scale-110 overflow-hidden border-y border-border/50 bg-background/60 py-4 shadow-2xl backdrop-blur-md">
            <div className="flex w-max animate-footer-scroll-marquee text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground md:text-sm">
              <MarqueeItem />
              <MarqueeItem />
            </div>
          </div>

          {/* Center */}
          <div className="relative z-10 mx-auto mt-20 flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6">
            <h2
              ref={headingRef}
              className="footer-text-glow mb-12 text-center text-5xl font-medium tracking-tighter md:text-8xl"
            >
              Ready to triage?
            </h2>

            <div ref={linksRef} className="flex w-full flex-col items-center gap-6">
              <div className="flex w-full flex-wrap justify-center gap-4">
                <MagneticButton
                  as="button"
                  onClick={onCta}
                  className="footer-glass-pill group flex items-center gap-3 rounded-full px-10 py-5 text-sm font-bold text-foreground md:text-base"
                >
                  <svg className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  Analyze a defect
                </MagneticButton>
                <MagneticButton
                  as="a"
                  href="https://github.com/KuantumKnight/Synthetix"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-glass-pill group flex items-center gap-3 rounded-full px-10 py-5 text-sm font-bold text-foreground md:text-base"
                >
                  <svg className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 015.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.8 1.08.8 2.18v3.23c0 .31.21.68.8.56A11.5 11.5 0 0023.5 12C23.5 5.73 18.27.5 12 .5z" />
                  </svg>
                  View source
                </MagneticButton>
              </div>

              <div className="mt-2 flex w-full flex-wrap justify-center gap-3 md:gap-6">
                {["Documentation", "API Reference", "Audit Log"].map((l) => (
                  <MagneticButton
                    key={l}
                    as="button"
                    className="footer-glass-pill rounded-full px-6 py-3 text-xs font-medium text-muted-foreground hover:text-foreground md:text-sm"
                  >
                    {l}
                  </MagneticButton>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="relative z-20 flex w-full flex-col items-center justify-between gap-6 px-6 pb-8 md:flex-row md:px-12">
            <div className="order-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground md:order-1 md:text-xs">
              © 2026 Synthetix. All rights reserved.
            </div>
            <div className="footer-glass-pill order-1 flex cursor-default items-center gap-2 rounded-full border-border/50 px-6 py-3 md:order-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:text-xs">Crafted with</span>
              <span className="animate-footer-heartbeat text-sm text-primary md:text-base">♥</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:text-xs">for QA teams</span>
            </div>
            <MagneticButton
              as="button"
              onClick={scrollToTop}
              className="footer-glass-pill group order-3 flex size-12 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Back to top"
            >
              <svg className="size-5 transition-transform duration-300 group-hover:-translate-y-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </MagneticButton>
          </div>
        </footer>
      </div>
    </>
  );
}
