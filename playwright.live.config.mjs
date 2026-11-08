import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir:"tests/live-e2e",testMatch:"**/*.spec.js",timeout:90000,globalTimeout:5*60*1000,
  fullyParallel:false,workers:1,retries:0,forbidOnly:true,
  outputDir:"test-results/live-browser",
  reporter:[["line"],["html",{open:"never",outputFolder:"test-results/live-browser-report"}],["json",{outputFile:"test-results/live-browser-results.json"}]],
});
