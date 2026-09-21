import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { generatePreview } from "../../api/_lib/preview";

const ERROR_STATUS: Record<string, number> = {
  invalid_url: 400, blocked: 400, rate_limited: 429, timeout: 504,
  fetch_failed: 502, too_large: 413, not_html: 415,
};

/** Serves /api/preview in `vite dev` the way the Vercel function does in prod. */
function previewApi(): Plugin {
  return {
    name: "3gs-preview-api",
    configureServer(server) {
      server.middlewares.use("/api/preview", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost").searchParams.get("url") ?? "";
        const result = await generatePreview(url);
        res.statusCode = result.ok ? 200 : ERROR_STATUS[result.code] ?? 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify(result));
      });
    },
  };
}

// The site consumes the library from source so edits hot-reload without a lib build.
export default defineConfig({
  plugins: [react(), previewApi()],
  resolve: {
    alias: {
      "@3gs/ui/styles.css": resolve(__dirname, "../../packages/ui/src/styles.css"),
      "@3gs/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: { port: 5173 },
});
