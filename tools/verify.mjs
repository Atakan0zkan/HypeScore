#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const release = process.argv.includes("--release");
const live = process.argv.includes("--live");
if (process.argv.slice(2).some(arg => !["--release", "--live"].includes(arg))) {
  console.error("Usage: npm run verify -- [--release] [--live]");
  process.exit(2);
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function check(name, command, args) {
  console.log(`\n--- ${name} ---`);
  // npm.cmd is a fixed trusted command on Windows; no user-controlled shell
  // text is interpolated. Node and git checks use direct process arguments.
  const result = spawnSync(command, args, {
    cwd: root, stdio: "inherit", windowsHide: true,
    shell: process.platform === "win32" && command === npm,
  });
  if (result.status !== 0) {
    console.error(`Verification stopped: ${name}`);
    process.exit(result.status || 1);
  }
}
for (const file of ["worker/index.js", "extension/popup.js", "analytics-dashboard/server.mjs", "analytics-dashboard/public/app.js"]) {
  check(`Syntax: ${file}`, process.execPath, ["--check", file]);
}
check("Regression suites", npm, ["test"]);
check("Secrets, private files, immutable CI actions", npm, ["run", "security:check"]);
check("Development dependency audit", npm, ["audit", "--audit-level=moderate"]);
check("Diff whitespace", "git", ["diff", "--check"]);
if (release) {
  check("Source coverage measurement", npm, ["run", "test:coverage"]);
  check("Browser extension E2E", npm, ["run", "test:e2e"]);
  check("Historical secret scan", process.execPath, ["tools/security-check.mjs", "--history"]);
}
if (live) check("Production API smoke", npm, ["run", "smoke"]);
console.log("\nVerification PASS for the selected checks. Human security/UI/release review remains required.");
