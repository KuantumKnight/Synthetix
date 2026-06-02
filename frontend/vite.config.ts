import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev: proxy /api -> FastAPI on :8000 (single origin, no CORS needed).
// Prod: `npm run build` emits ./dist which FastAPI serves via StaticFiles.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // split heavy, route-specific libs so the initial payload stays lean
        manualChunks: {
          three: ["three"],
          motion: ["framer-motion"],
          gsap: ["gsap"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
