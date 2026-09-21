import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// The site consumes the library from source so edits hot-reload without a lib build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@3gs/ui/styles.css": resolve(__dirname, "../../packages/ui/src/styles.css"),
      "@3gs/ui": resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: { port: 5173 },
});
