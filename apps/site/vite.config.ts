import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generatePreview } from "../../api/_lib/preview";
import imageHandler from "../../api/image";
import { renderSharePage, siteFromUrl } from "../../api/share";

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

/**
 * Dev parity for the share link: `/p/<site>` (the `/p/(.*)` → `/api/share`
 * rewrite in vercel.json) and `/api/image`. The page is the *source*
 * index.html run through Vite's HTML transform — so HMR works — with the very
 * same meta injection the function does in production.
 */
function shareApi(): Plugin {
  return {
    name: "3gs-share-api",
    configureServer(server) {
      // The function reads req.url itself, so mounting strips only the prefix it ignores.
      server.middlewares.use("/api/image", (req, res) => void imageHandler(req, res));

      server.middlewares.use(async (req, res, next) => {
        const raw = (req as { originalUrl?: string }).originalUrl ?? req.url ?? "/";
        const path = raw.split("?")[0];
        if (path !== "/p" && !path.startsWith("/p/")) return next();
        try {
          const source = await readFile(resolve(__dirname, "index.html"), "utf8");
          const template = await server.transformIndexHtml(raw, source, req.originalUrl);
          const origin = `http://${req.headers.host ?? "localhost:5173"}`;
          const { html } = await renderSharePage(template, siteFromUrl(raw), origin);
          res.statusCode = 200;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.setHeader("cache-control", "no-store");
          res.end(html);
        } catch (e) {
          next(e as Error);
        }
      });
    },
  };
}

// The site consumes the library from source so edits hot-reload without a lib build.
export default defineConfig({
  plugins: [react(), previewApi(), shareApi()],
  resolve: {
    alias: {
      "@3gs/ui/styles.css": resolve(__dirname, "../../packages/ui/src/styles.css"),
      "@3gs/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: { port: 5173 },
});
