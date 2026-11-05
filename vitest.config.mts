import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // tsconfig's "@/*" path, which Vitest doesn't read on its own.
      "@": path.resolve(import.meta.dirname, "./src"),
      // The "server-only" guard throws outside a server; tests are plain Node.
      "server-only": path.resolve(import.meta.dirname, "./src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
