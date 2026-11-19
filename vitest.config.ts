import { defineConfig } from "vitest/config";

// One test run for the whole monorepo: each package with a vitest config is its own project.
export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "packages/plate/*/vitest.config.ts",
      "apps/*/vitest.config.ts",
    ],
    passWithNoTests: true,
  },
});
