#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = fileURLToPath(new URL("../", import.meta.url));
const release = process.argv.includes("--release");
const live = process.argv.includes("--live");
if (process.argv.slice(2).some(arg => !["--release", "--live"].includes(arg))) {
  console.error("Usage: npm run verify -- [--release] [--live]");
  process.exit(2);
}
const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli)) {
  console.error("Run this verifier through npm run verify so npm's CLI path is explicit.");
  process.exit(2);
}
function check(name, command, args) {
  console.log(`\n--- ${name} ---`);
  const result = spawnSync(command, args, {
    cwd: root, stdio: "inherit", windowsHide: true,
  });
  if (result.status !== 0) {
    console.error(`Verification stopped: ${name}`);
    process.exit(result.status || 1);
  }
}
const npmCheck = (name, args) => check(name, process.execPath, [npmCli, ...args]);
for (const file of ["worker/index.js", "extension/popup.js", "analytics-dashboard/server.mjs", "analytics-dashboard/public/app.js"]) {
  check(`Syntax: ${file}`, process.execPath, ["--check", file]);
}
npmCheck("Regression suites", ["test"]);
npmCheck("Secrets, private files, immutable CI actions", ["run", "security:check"]);
npmCheck("Development dependency audit", ["audit", "--audit-level=moderate"]);
check("Diff whitespace", "git", ["diff", "--check"]);
check("Worker deployment bundle", process.execPath,
  ["node_modules/wrangler/bin/wrangler.js", "deploy", "--dry-run", "--outdir", "dist/worker-dry-run"]);
if (release) {
  npmCheck("Source coverage measurement", ["run", "test:coverage"]);
  npmCheck("Browser extension E2E", ["run", "test:e2e"]);
  check("Historical secret scan", process.execPath, ["tools/security-check.mjs", "--history"]);
}
if (live) npmCheck("Production API smoke", ["run", "smoke"]);
console.log("\nVerification PASS for the selected checks. Human security/UI/release review remains required.");
