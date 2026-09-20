import { defineConfig } from "@playwright/test";

// Real-browser E2E for the unpacked extension. API is mocked at the network
// layer (context.route), so runs are deterministic and offline-safe.
// Headed mode is required for --load-extension; CI runs under xvfb-run.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.js",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
});
