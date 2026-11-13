import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Compiling Tailwind and running the CLI on fixtures takes a few seconds each.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: [["text", { skipFull: false }], "html"],
    },
  },
});
