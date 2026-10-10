import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)));
const srcDir = path.resolve(rootDir, "src");

const proxy = { "/functions/v1/app": "http://127.0.0.1:8000" };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/lib\/utils$/, replacement: `${rootDir}/lib/utils.ts` },
      { find: /^@\/components\/ui\//, replacement: `${rootDir}/components/ui/` },
      { find: /^@\/hooks\//, replacement: `${rootDir}/hooks/` },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
  server: { host: "127.0.0.1", proxy },
  preview: { host: "127.0.0.1", proxy },
  build: { outDir: "dist" },
});
