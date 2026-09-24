import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path alias — Vitest doesn't
// read tsconfig paths on its own, so without this, any test file
// importing "@/lib/..." would fail to resolve.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    // No jsdom here on purpose: everything tested in this phase (text
    // parsing, LLM response parsing, section upserts) is plain
    // TypeScript logic, not React components — the default Node
    // environment is faster and simpler when there's no DOM involved.
    environment: "node",
  },
});
