import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || "/tmp/superdoc-jev-tests",
  expect: { timeout: 30000 },
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.DEMO_BASE_URL || "http://localhost:5173",
    viewport: { width: 1440, height: 1100 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: "list",
});
