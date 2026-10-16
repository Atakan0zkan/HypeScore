#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function waitForWorkerBuild({
  repository, sha, token, fetchImpl = globalThis.fetch,
  now = Date.now, sleep = pause, timeoutMs = 300000, pollMs = 10000,
}) {
  if (!token || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(repository || "") ||
      !/^[a-f0-9]{40}$/i.test(sha || "")) throw new Error("Invalid deployment-check configuration");
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/commits/${sha}/check-runs?per_page=100`, {
      redirect: "error", signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - now()))),
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (!response.ok) throw new Error(`Deployment-check API returned HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.check_runs)) throw new Error("Invalid deployment-check response");
    const build = data.check_runs.find(check => check.name === "Workers Builds: live-score-football" && check.head_sha === sha);
    if (build?.status === "completed") {
      if (build.conclusion !== "success") throw new Error(`Cloudflare build did not succeed: ${build.conclusion}`);
      console.log("Cloudflare Worker build completed successfully for this commit");
      return;
    }
    await sleep(Math.max(0, Math.min(pollMs, deadline - now())));
  }
  throw new Error("Timed out waiting for this commit's Cloudflare Worker build; smoke test was not run against an older deployment");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  waitForWorkerBuild({ repository: process.env.GITHUB_REPOSITORY, sha: process.env.GITHUB_SHA,
    token: process.env.GITHUB_TOKEN }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
