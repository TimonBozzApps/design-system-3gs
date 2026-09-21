import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@3gs/ui/styles.css";
import "./site.css";
import "./analytics"; // optional PostHog; no-op without VITE_POSTHOG_KEY
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
