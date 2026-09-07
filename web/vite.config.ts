import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The retrieval + core modules are shared with the pipeline (../src). esbuild resolves
// their `.js` import specifiers to the `.ts` sources; fs.allow lets Vite read them.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] } },
  resolve: { alias: { "@compass": fileURLToPath(new URL("../src", import.meta.url)) } },
  base: "./",
});
