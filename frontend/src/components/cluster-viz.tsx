import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { ClusterInfo } from "@/lib/api";

/** Warm, on-brand cluster palette (clay-anchored) — replaces the old rainbow. */
const PALETTE = [
  "#CC785C", // clay
  "#C2A678", // sand
  "#7C8B6F", // sage
  "#A85C44", // terracotta
  "#8C7A9C", // muted plum
  "#B8924A", // ochre
  "#6E8AA0", // slate blue
];

interface Props {
  totalDefects: number;
  totalClusters: number;
  clusters?: ClusterInfo[];
  height?: number;
}

export function ClusterViz({
  totalDefects,
  totalClusters,
  clusters,
  height = 320,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : 600;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // sizing — prefer real cluster sizes, else synthesize from counts
      const clusterCount = Math.max(
        clusters?.length ?? totalClusters ?? 0,
        4
      );
      const nodeCount = Math.min(Math.max(totalDefects, 24), 220);

      // deterministic pseudo-random so it doesn't reshuffle every paint
      let seed = 1337 + clusterCount * 7 + nodeCount;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      const centers = Array.from({ length: clusterCount }, (_, c) => ({
        x: 70 + rand() * (width - 140),
        y: 50 + rand() * (height - 100),
        color: PALETTE[c % PALETTE.length],
        label: clusters?.[c]?.cluster_name || `Cluster ${c}`,
      }));

      const weights =
        clusters && clusters.length
          ? clusters.map((c) => c.size)
          : centers.map(() => 1);
      const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

      const nodes: { x: number; y: number; r: number; color: string; cluster: number }[] = [];
      for (let i = 0; i < nodeCount; i++) {
        // pick cluster weighted by size
        let pick = rand() * totalWeight;
        let c = 0;
        for (; c < weights.length; c++) {
          pick -= weights[c];
          if (pick <= 0) break;
        }
        c = Math.min(c, centers.length - 1);
        const center = centers[c];
        nodes.push({
          x: center.x + (rand() - 0.5) * 90,
          y: center.y + (rand() - 0.5) * 64,
          r: 2 + rand() * 3,
          color: center.color,
          cluster: c,
        });
      }

      // intra-cluster connections
      ctx.lineWidth = 0.6;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].cluster !== nodes[j].cluster) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (Math.sqrt(dx * dx + dy * dy) < 52) {
            ctx.globalAlpha = 0.12;
            ctx.strokeStyle = nodes[i].color;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // nodes with soft glow
      for (const n of nodes) {
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // labels
      ctx.font = "600 10px Inter, sans-serif";
      for (const c of centers) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = c.color;
        ctx.fillText(c.label, c.x - 22, c.y - 38);
      }
      ctx.globalAlpha = 1;
    };

    draw();
    if (reduced) return;
    const ro = new ResizeObserver(draw);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [totalDefects, totalClusters, clusters, height, theme]);

  return <canvas ref={canvasRef} className="block w-full" />;
}
