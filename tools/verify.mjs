#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { createValidationPlan } from "./release-gate.mjs";

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
for (const step of createValidationPlan({root,npmCli,release,live})) check(step.name,step.command,step.args);
console.log("\nVerification PASS for the selected checks. Human security/UI/release review remains required.");
