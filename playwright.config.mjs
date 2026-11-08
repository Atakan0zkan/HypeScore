import { defineConfig } from "@playwright/test";
import { browserLaunchOptions } from "./tests/browser/unpacked-extension.mjs";

const launch = browserLaunchOptions();
if (launch.executablePath && !process.env.E2E_BROWSER_PATH) process.env.E2E_BROWSER_PATH = launch.executablePath;

// Real-browser E2E for the unpacked extension. API is mocked at the network
// layer (context.route), so runs are deterministic and offline-safe.
// Headed mode is required for --load-extension; CI runs under xvfb-run.
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/browser",
  testMatch: "**/*.spec.js",
  timeout: 90000,
  globalTimeout: 12 * 60 * 1000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [["line"], ["html", { open: "never" }], ["json", { outputFile: "test-results/browser-results.json" }]],
});
