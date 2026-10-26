#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, lstatSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SECRET_PATTERNS = [
  ["Cloudflare token", /\bcfat_[A-Za-z0-9_-]{32,}\b/g],
  ["GitHub token", /\b(?:gh[pors]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ["npm token", /\bnpm_[A-Za-z0-9]{30,}\b/g],
  ["provider key", /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}\b/g],
  ["private key", /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g],
];

export function findSecrets(content, file) {
  return SECRET_PATTERNS.flatMap(([kind, pattern]) => [...content.matchAll(new RegExp(pattern.source, "g"))]
    .map(match => ({ file, line: content.slice(0, match.index).split("\n").length, kind })));
}
export function isPrivateProjectPath(file) {
  file = file.replaceAll("\\", "/");
  if (file === ".env.example") return false;
  return /^(?:\.ecc|\.codex|\.agents|memory-bank|dist|node_modules|test-results|playwright-report|coverage)(?:\/|$)/.test(file) ||
    /(?:^|\/)(?:AGENTS\.md|\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(file) || /\.zip$/i.test(file);
}
export function findMutableActions(content, file) {
  return [...content.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)]
    .filter(match => !match[1].startsWith("./") && !/@[a-f0-9]{40}$/.test(match[1]))
    .map(match => ({ file, line: content.slice(0, match.index).split("\n").length, kind: "mutable remote action" }));
}

export function runSecurityChecks({ root = ROOT, history = false } = {}) {
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const files = [...new Set([...tracked, ...git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)])];
  const findings = [];
  for (const file of tracked) if (isPrivateProjectPath(file)) findings.push({ file, kind: "private project file tracked by Git" });
  let scannedFiles = 0;
  for (const file of files) {
    const path = resolve(root, file);
    const rel = relative(root, path);
    if (rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("Refusing out-of-workspace scan");
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Refusing non-regular tracked source");
    const data = readFileSync(path);
    if (data.includes(0)) continue; // Binary assets, not credentials or source text.
    if (data.byteLength > 5 * 1024 * 1024) throw new Error("Source file exceeds bounded scan size");
    const content = data.toString("utf8");
    scannedFiles++;
    findings.push(...findSecrets(content, file));
    if (/^\.github\/workflows\/.*\.ya?ml$/.test(file)) findings.push(...findMutableActions(content, file));
  }
  let historyCommits = 0;
  if (history) {
    const commits = git(["rev-list", "--all"]).trim().split(/\r?\n/).filter(Boolean);
    const expression = "cfat_[A-Za-z0-9_-]{32,}|gh[pors]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|npm_[A-Za-z0-9]{30,}|sk-(proj-|ant-)?[A-Za-z0-9_-]{32,}|-----BEGIN ([A-Z0-9 ]+ )?PRIVATE KEY-----";
    for (let index = 0; index < commits.length; index += 25) {
      const batch = commits.slice(index, index + 25);
      let output = "";
      try { output = git(["grep", "-I", "-l", "-E", "-e", expression, ...batch, "--"]); }
      catch (error) { if (error.status !== 1) throw new Error("Git history scan failed"); }
      for (const file of output.trim().split(/\r?\n/).filter(Boolean)) findings.push({ file, kind: "suspected secret in historical snapshot" });
    }
    historyCommits = commits.length;
  }
  return { ok: findings.length === 0, scannedFiles, historyCommits, findings };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const report = runSecurityChecks({ history: process.argv.includes("--history") });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch (_error) {
    console.error("Security scan incomplete; inspect the local repository and Git state.");
    process.exitCode = 1;
  }
}
