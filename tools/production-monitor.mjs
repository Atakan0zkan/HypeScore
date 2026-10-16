#!/usr/bin/env node
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runSmokeChecks, printResults } from "./smoke-test.js";

const START = "<!-- hype-availability:v1 -->";
const END = "<!-- /hype-availability -->";
const TITLE = "[availability] Production API unavailable";
export const CONFIRM_DELAY_MS = 30000;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const failed = report => report.checks.filter(check => check.status === "failed");

function readState(body = "") {
  const match = body.match(/<!-- hype-state:(\{[^\n]{1,1024}\}) -->/);
  try {
    const value = match ? JSON.parse(match[1]) : {};
    return /^[a-f0-9]{16}$/.test(value.signature || "") &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.firstSeen || "") ? value : {};
  } catch { return {}; }
}

function block(report, { firstSeen, now, runUrl, recovered = false }) {
  firstSeen = Number.isFinite(Date.parse(firstSeen)) ? new Date(firstSeen).toISOString() : now;
  const failures = failed(report);
  const signature = createHash("sha256")
    .update(JSON.stringify(failures.map(check => [check.name, check.code]).sort()))
    .digest("hex").slice(0, 16);
  const state = { signature, firstSeen };
  const lines = [START, `<!-- hype-state:${JSON.stringify(state)} -->`,
    `## ${recovered ? "Recovered" : "Production API incident"}`,
    `First detected: ${firstSeen}`, `Evidence updated: ${now}`, "",
    recovered ? "Two consecutive healthy checks confirmed recovery." :
      "The same API feature failed two checks 30 seconds apart, after the normal bounded upstream failover.",
    "", "| API check | Result |", "| --- | --- |",
    ...report.checks.map(check => `| ${check.name} | ${check.status === "failed" ? check.code : check.status.toUpperCase()} |`),
    "", "Empty fixture lists are valid; unpublished World Cup 2030 data is not an outage.",
    "No automatic code changes, deployments or merges are performed by this monitor.",
    ...(runUrl ? ["", `[Workflow run](${runUrl})`] : []), END];
  return { text: lines.join("\n"), state };
}

function replaceBlock(body, replacement) {
  const start = body.indexOf(START);
  const end = body.indexOf(END, start);
  if (start < 0 || end < start) throw new Error("Incident is not monitor-managed");
  return body.slice(0, start) + replacement + body.slice(end + END.length);
}

export async function monitorProduction({
  runChecks = runSmokeChecks, github = null, sleep = pause,
  now = () => new Date().toISOString(), runUrl = "",
} = {}) {
  const issue = github ? await github.findIncident() : null;
  const first = await runChecks();
  // A healthy normal run costs one probe; recovery of an open incident needs two.
  if (first.ok && !issue) return { ok: true, state: "healthy", report: first };
  await sleep(CONFIRM_DELAY_MS);
  const second = await runChecks();
  if (second.ok) {
    if (issue && first.ok) {
      const recovered = block(second, { firstSeen: readState(issue.body).firstSeen || issue.created_at,
        now: now(), runUrl, recovered: true });
      await github.updateIssue(issue.number, {
        body: replaceBlock(issue.body, recovered.text), state: "closed", state_reason: "completed",
      });
      return { ok: true, state: "recovered", issue: issue.number, report: second };
    }
    return { ok: true, state: issue ? "awaiting-recovery-confirmation" : "transient-recovered", report: second };
  }
  const firstFailures = new Set(failed(first).map(check => check.name));
  if (!failed(second).some(check => firstFailures.has(check.name))) {
    return { ok: false, state: "unconfirmed", report: second };
  }
  if (!github) return { ok: false, state: "confirmed-outage", report: second };
  const incident = block(second, {
    firstSeen: issue ? readState(issue.body).firstSeen || issue.created_at : now(), now: now(), runUrl,
  });
  if (!issue) {
    const created = await github.createIssue({ title: TITLE, body: incident.text });
    return { ok: false, state: "incident-opened", issue: created.number, report: second };
  }
  // Unchanged failures do not produce repeated comments, notifications or edits.
  if (readState(issue.body).signature !== incident.state.signature) {
    await github.updateIssue(issue.number, { body: replaceBlock(issue.body, incident.text) });
  }
  return { ok: false, state: "incident-ongoing", issue: issue.number, report: second };
}

export function createGithubClient({ token, repository, assignee = "", fetchImpl = globalThis.fetch }) {
  if (!token || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(repository || "")) {
    throw new Error("GitHub token and valid repository are required for incident management");
  }
  if (assignee && !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(assignee)) throw new Error("Invalid incident assignee");
  async function api(path, method = "GET", body) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
      method, redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub incident API returned HTTP ${response.status}`);
    return response.json();
  }
  return {
    async findIncident() {
      for (let page = 1; page <= 5; page += 1) {
        const issues = await api(`/issues?state=open&per_page=100&page=${page}`);
        if (!Array.isArray(issues)) throw new Error("Invalid GitHub issue list");
        const own = issues.find(issue => !issue.pull_request && issue.user?.login === "github-actions[bot]" &&
          typeof issue.body === "string" && issue.body.includes(START) && issue.body.includes(END));
        if (own) return own;
        if (issues.length < 100) return null;
      }
      throw new Error("Issue scan limit reached; refusing to create a possible duplicate");
    },
    createIssue(body) { return api("/issues", "POST", { ...body, ...(assignee ? { assignees: [assignee] } : {}) }); },
    updateIssue(number, body) {
      if (!Number.isSafeInteger(number) || number <= 0) throw new Error("Invalid issue number");
      return api(`/issues/${number}`, "PATCH", body);
    },
  };
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== "--manage-incidents")) throw new Error("Unknown monitor option");
  const manage = args.includes("--manage-incidents");
  const repository = process.env.GITHUB_REPOSITORY;
  const github = manage ? createGithubClient({ token: process.env.GITHUB_TOKEN, repository,
    assignee: process.env.HYPE_MONITOR_ASSIGNEE || "" }) : null;
  const runId = process.env.GITHUB_RUN_ID || "";
  const runUrl = manage && /^\d+$/.test(runId) ? `https://github.com/${repository}/actions/runs/${runId}` : "";
  const result = await monitorProduction({ github, runUrl });
  printResults(result.report.checks);
  console.log(`Production monitor: ${result.state}${result.issue ? ` (#${result.issue})` : ""}`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(String(error.message || "Production monitor failed").slice(0, 240));
    process.exitCode = 1;
  });
}
