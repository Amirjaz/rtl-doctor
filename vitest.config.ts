import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Compiling Tailwind and running the CLI on fixtures takes a few seconds each, and the
    // Tailwind 3 compile in a beforeAll hook can pass 10s on a loaded machine.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: [["text", { skipFull: false }], "html"],
    },
  },
});
