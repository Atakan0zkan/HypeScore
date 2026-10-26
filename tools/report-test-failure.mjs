#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MARKER = "<!-- hype-daily-test:v1 -->";
const TITLE = "[daily-test] Automated validation failed";
export async function reportTestResults({ repository, runId, token, results, fetchImpl = fetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || "") ||
      !/^\d{1,20}$/.test(runId || "") || !token || !results ||
      Object.keys(results).some(key => !["offline", "e2e"].includes(key))) throw new Error("Invalid daily-test context");
  const states = [results.offline, results.e2e];
  if (!states.every(value => ["success", "failure", "cancelled", "skipped"].includes(value))) throw new Error("Invalid job state");
  const failed = states.includes("failure");
  const healthy = states.every(value => value === "success");
  if (!failed && !healthy) return { state: "deferred" };
  const api = async (path, method = "GET", body) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
      method, redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub daily-test reporting failed: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  let issue;
  for (let page = 1; page <= 5; page++) {
    const items = await api(`/issues?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(items)) throw new Error("Invalid issue inventory");
    issue = items.find(item => !item.pull_request && item.title === TITLE &&
      item.user?.login === "github-actions[bot]" && item.body?.includes(MARKER));
    if (issue || items.length < 100) break;
    if (page === 5) throw new Error("Issue inventory incomplete; refusing a duplicate report");
  }
  if (healthy) {
    if (!issue) return { state: "healthy" };
    await api(`/issues/${issue.number}`, "PATCH", { state: "closed", state_reason: "completed" });
    return { state: "closed" };
  }
  const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  if (issue?.body?.includes(runUrl)) return { state: "unchanged" };
  const body = [MARKER, "## Automated validation failed", "",
    `- Offline checks: ${results.offline}`, `- Browser checks: ${results.e2e}`, "",
    `[Inspect the workflow run](${runUrl})`, "",
    "No raw job logs, model-generated instructions, credentials, or source files are copied into this issue.",
    "This reporter does not modify code, deploy, or merge. A fully healthy daily/manual run closes only this bot-managed issue.",
  ].join("\n");
  if (issue) await api(`/issues/${issue.number}`, "PATCH", { body });
  else await api("/issues", "POST", { title: TITLE, body });
  return { state: issue ? "updated" : "opened" };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    console.log(JSON.stringify(await reportTestResults({
      repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID,
      token: process.env.GITHUB_TOKEN, results: JSON.parse(process.env.HYPE_TEST_RESULTS || "{}"),
    })));
  } catch (_error) {
    console.error("Daily-test reporting failed; inspect the workflow run. No log contents were published.");
    process.exitCode = 1;
  }
}
