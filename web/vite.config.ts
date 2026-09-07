import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Self-contained. src/lib/ holds a copy of the retrieval + core modules shared with the
// pipeline (../src) so this app deploys anywhere with no path aliases. In production the
// two would be one package.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
