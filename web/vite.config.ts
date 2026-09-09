import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The app imports the retrieval + core modules straight from the pipeline (`../src`) via
// the `@compass/*` alias — one source of truth, no copy to keep in sync. The only Node-only
// dependency in that closure is `@huggingface/transformers`, reached solely through
// dynamic imports that never fire in the browser (the web index is tf-idf, and
// COMPASS_RERANK is never set client-side); it's aliased to a stub so the bundler is happy.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: [
      { find: "@huggingface/transformers", replacement: r("./src/shims/transformers.ts") },
      { find: /^@compass\/(.*)$/, replacement: r("../src/$1") },
    ],
  },
});
