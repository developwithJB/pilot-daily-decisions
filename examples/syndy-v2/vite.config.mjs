import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const backend = new URL(
  process.env.PILOT_BACKEND_ORIGIN || "http://127.0.0.1:3000",
);
if (!["http:", "https:"].includes(backend.protocol))
  throw new Error("PILOT_BACKEND_ORIGIN must be an HTTP(S) origin");
const proxy = {
  "/api/calendar": { target: backend.origin, changeOrigin: true },
};
export default defineConfig({
  define: { __PILOT_ORIGIN__: JSON.stringify(backend.origin) },
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.STUDIO_PORT || 4175),
    strictPort: true,
    proxy,
    fs: { strict: true },
  },
  preview: {
    host: "127.0.0.1",
    port: Number(process.env.STUDIO_PORT || 4175),
    proxy,
  },
  build: { outDir: "../../work/syndy-v2/build", emptyOutDir: true },
});
