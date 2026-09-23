import { defineConfig } from "vitest/config";

// Testes de banco (RLS, RPCs, views) em PGlite — Postgres em WASM, sem Docker.
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
