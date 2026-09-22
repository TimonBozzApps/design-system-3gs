import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "@3gs/ui/styles.css";
import "./site.css";
import "./analytics"; // optional PostHog; no-op without VITE_POSTHOG_KEY

/**
 * Two pages, one bundle entry: `/p/<site>` is the standalone share poster
 * (see `api/share.ts` for its meta tags), everything else is the docs site.
 * Each is imported on demand so the poster doesn't ship the whole showcase.
 */
const isSharePage = /^\/p(\/|$)/.test(window.location.pathname);

const page: Promise<ReactNode> = isSharePage
  ? import("./Share/SharePage").then(({ SharePage }) => <SharePage />)
  : import("./App").then(({ App }) => <App />);

const root = createRoot(document.getElementById("root")!);
void page.then((node) => root.render(<StrictMode>{node}</StrictMode>));
