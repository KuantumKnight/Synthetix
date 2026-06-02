# Synthetix Frontend

A React + TypeScript + Vite single-page app built on **shadcn/ui** (Radix +
Tailwind v4), with an Anthropic-inspired warm palette, light/dark theming, and
liquid-glass surfaces.

## Stack

- **Vite 6** + **React 18** + **TypeScript** (strict)
- **Tailwind v4** via `@tailwindcss/vite` — tokens in `src/index.css`
- **shadcn/ui** primitives in `src/components/ui` (add more with `npx shadcn@latest add <name>`)
- **three.js** (animated hero terrain), **gsap** (cinematic footer),
  **framer-motion** (scroll-reveal sections) — all code-split & lazy-loaded
- **lucide-react** icons

## Design system

Strict **60-30-10**: warm canvas (`--background`, 60%), ink structure
(`--foreground`, 30%), **clay accent** (`--primary`, ~`#CC785C`, 10%) reserved
for CTAs and active states. Fonts: **Fraunces** (display serif, `tracking-tight`)
+ **Inter** (body). One unified radius (`--radius`), `shadow-sm` on cards /
`shadow-xl` on overlays, `transition-all duration-300 ease-in-out` micro-
interactions with subtle hover lift.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 — proxies /api -> FastAPI :8000
```

Start the backend separately so the proxy has a target:

```bash
uvicorn backend.main:app --reload --port 8000
```

## Production

```bash
npm run build      # emits ./dist
```

FastAPI auto-serves `frontend/dist` at `/` when it exists (see
`backend/main.py`), so a built SPA is served same-origin — no CORS needed.

## Layout

```
src/
  components/
    ui/            shadcn primitives (button, card, input, tabs, …)
    glass/         liquid-glass surface + SVG distortion filter
    backgrounds/   GLSL hills (three.js)
    sections/      scroll-reveal feature section (framer-motion)
    cinematic-footer.tsx, nav.tsx, pipeline.tsx, cluster-viz.tsx, theme-toggle.tsx
  pages/           landing, dashboard, analyzer, ingest, docs
  hooks/           use-theme
  lib/             api client (typed), utils, shared types
```
