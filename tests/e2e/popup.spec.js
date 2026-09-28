import { test, expect, chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

// Test-only manifest key: pins a deterministic extension ID for the suite.
// NOT a secret (local test ID derivation only, never shipped).
const TEST_KEY_B64 =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArCNyjzFSMwVpOyTorAhxcenmenBDK1679y5WVovURgCfEWyb7t+esq+L3s8KC+ELqSvuFiNGK1dVgvtj+cA5fr7pLY39yJ2N6Z2XIGB88zd8d/qKyZ0isuyZ9tn4/jYQNcCTpmM9Dldn/8T+e3ld2JaEv5+13WHJursI3MML+xGwd6csBXn7KP9HuSPePi9VSCOy7aXHyQpEfqMl5Hz1jVF3B7CD5gFd7oLik1XQ+bAvDCHvC91zJwvh/xoZxMDXRvmLS0OUBy1URkpU5NpnA60M1fxHw49aRKPnUxelAXuQtqteDEUWo6IOuDlnRG5htk5Ob+VOtcmu6FQ2pqgjzQIDAQAB";

function extensionIdFromKey(base64Key) {
  const der = Buffer.from(base64Key, "base64");
  const hash = crypto.createHash("sha256").update(der).digest().subarray(0, 16);
  let id = "";
  for (const byte of hash) {
    id += String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 15));
  }
  return id;
}

const EXT_ID = extensionIdFromKey(TEST_KEY_B64);
const POPUP_URL = `chrome-extension://${EXT_ID}/popup.html`;

const now = Date.now();
const LEAGUES = [
  {
    code: "eng.1", name: "Premier League", logoTone: "dark",
    matches: [
      { id: "e2e1", leagueCode: "eng.1", homeTeam: "Arsenal", awayTeam: "Chelsea", homeScore: 2, awayScore: 1, state: "live", status: "2H", minute: "67'", kickoff: new Date(now).toISOString(), venue: "Emirates" },
      { id: "e2e2", leagueCode: "eng.1", homeTeam: "Spurs", awayTeam: "Villa", homeScore: 0, awayScore: 0, state: "scheduled", status: "Scheduled", kickoff: new Date(now + 2 * 3600 * 1000).toISOString(), venue: "" },
      { id: "e2e4", leagueCode: "eng.1", homeTeam: "Liverpool", awayTeam: "City", homeScore: 1, awayScore: 1, state: "finished", status: "FT", kickoff: new Date(now - 3 * 3600 * 1000).toISOString(), venue: "Anfield" },
    ],
  },
  { code: "esp.1", name: "LaLiga", logoTone: "dark", matches: [] },
  {
    code: "ita.1", name: "Serie A", logoTone: "dark",
    matches: [
      { id: "e2e3", leagueCode: "ita.1", homeTeam: "Inter", awayTeam: "Milan", homeScore: 1, awayScore: 1, state: "finished", status: "FT", kickoff: new Date(now - 3 * 3600 * 1000).toISOString(), venue: "San Siro" },
    ],
  },
];
const ALL_MATCHES = LEAGUES.flatMap((l) => l.matches);
const STANDINGS = [
  { position: 1, team: "Arsenal", logo: null, played: 10, wins: 8, draws: 1, losses: 1, goalsFor: 20, goalsAgainst: 8, goalDifference: "+12", points: 25 },
  { position: 2, team: "Chelsea", logo: null, played: 10, wins: 7, draws: 2, losses: 1, goalsFor: 18, goalsAgainst: 9, goalDifference: "+9", points: 23 },
];
const DETAIL = {
  id: "e2e1", leagueCode: "eng.1", title: "Arsenal vs Chelsea",
  teams: { home: { name: "Arsenal" }, away: { name: "Chelsea" } },
  timeline: [
    { minute: "0'", type: "Kickoff", kind: "kickoff" },
    { minute: "23'", type: "Goal", kind: "goal", team: "Arsenal", players: ["Home Forward"], text: "Home Forward scores from inside the penalty area." },
    { minute: "45'+3'", type: "Yellow Card", kind: "yellow-card", team: "Chelsea", players: ["Away Defender"] },
  ],
  stats: [{ label: "Shots", homeValue: "5", awayValue: "10" }, { label: "Possession", homeValue: "35%", awayValue: "65%" }],
  lineups: ["Arsenal", "Chelsea"].map((team, index) => ({
    team, homeAway: index ? "away" : "home", formation: "4-2-3-1",
    players: ["G", "LB", "CD-L", "CD-R", "RB", "LM", "RM", "AM-L", "AM", "AM-R", "F"].map((position, i) => ({
      id: `${index}-${i}`, name: ["Antonín Kinsky", "Destiny Udogie", "Micky van de Ven", "Kevin Danso", "Pedro Porro", "Conor Gallagher", "João Palhinha", "Mathys Tel", "Rodrigo Bentancur", "Randal Kolo Muani", "Dominic Calvert-Lewin"][i], jersey: String(i + 1), position, starter: true,
    })),
  })), news: [{ title: "Match report", url: "https://www.espn.com/soccer/report/_/gameId/740954" }],
  videos: [{ title: "Watch the match highlights", url: "https://www.espn.com/video/clip/_/id/12345" }], links: [],
};

test.describe.configure({ mode: "serial" });

let context;
let page;
let apiCalls;
let extDir;
let profileDir;
const consoleErrors = [];
const pageErrors = [];

test.beforeAll(async () => {
  // Copy to a no-space temp path (spaces break --load-extension handling).
  const runId = `hype-e2e-${process.pid}`;
  const root = path.join(os.tmpdir(), runId).replace(/ /g, "");
  extDir = path.join(root, "ext");
  profileDir = path.join(root, "profile");
  fs.rmSync(root, { recursive: true, force: true });
  fs.cpSync(path.resolve("extension"), extDir, { recursive: true });
  const manifestPath = path.join(extDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.key = TEST_KEY_B64;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  expect(extensionIdFromKey(manifest.key)).toBe(EXT_ID);

  const launchOptions = {
    headless: false,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  };
  if (process.env.E2E_BROWSER_PATH) {
    launchOptions.executablePath = process.env.E2E_BROWSER_PATH;
  } else {
    launchOptions.channel = "chromium";
  }
  context = await chromium.launchPersistentContext(profileDir, launchOptions);
  apiCalls = [];
  await context.route("**://api.atakanozkan.com/**", async (route) => {
    const url = new URL(route.request().url());
    apiCalls.push(url.pathname);
    if (url.pathname === "/live-matches") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: ALL_MATCHES, leagues: LEAGUES }) });
    }
    if (url.pathname === "/league-standings") {
      const code = url.searchParams.get("leagueCode");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leagueCode: code, standings: STANDINGS }) });
    }
    if (url.pathname === "/match-detail") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DETAIL) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  page = await context.newPage();
  await page.setViewportSize({ width: 580, height: 600 });
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(POPUP_URL, { waitUntil: "domcontentloaded" });
  await page.locator(".league-pick-card").first().waitFor({ timeout: 15000 });
});

test.afterAll(async () => {
  await context?.close();
  fs.rmSync(path.dirname(extDir), { recursive: true, force: true });
});

test("renders league cards from the API", async () => {
  await expect(page.locator(".league-pick-card")).toHaveCount(3);
  await expect(page.locator(".league-pick-name", { hasText: "Premier League" })).toBeVisible();
  await expect(page.locator(".league-pick-badge").first()).toBeVisible();
  expect(apiCalls.filter((p) => p === "/live-matches").length).toBeGreaterThanOrEqual(1);
});

test("opens league detail with sections and standings", async () => {
  await page.locator(".league-pick-card", { hasText: "Premier League" }).click();
  await expect(page.locator(".match-section")).toHaveCount(3);
  await expect(page.locator(".match-card")).toHaveCount(3);
  await expect(page.locator(".standings-table")).toBeVisible();
  await expect(page.locator(".standings-team-name", { hasText: "Arsenal" })).toBeVisible();
  await page.locator("#backBtn").click();
  await expect(page.locator(".league-pick-card")).toHaveCount(3);
});

test("opens match detail hero and returns", async () => {
  await page.locator(".league-pick-card", { hasText: "Premier League" }).click();
  await page.locator(".match-card").first().click();
  await expect(page.locator(".match-detail-hero")).toBeVisible();
  await expect(page.locator(".match-detail-hero")).toContainText("Arsenal");
  expect(apiCalls).toContain("/match-detail");
  await page.locator("#backBtn").click();
  await page.locator("#backBtn").click();
  await expect(page.locator(".league-pick-card")).toHaveCount(3);
});

test("readable stats, event timeline and two starting XIs fit the popup", async () => {
  await page.locator(".league-pick-card", { hasText: "Premier League" }).click();
  await page.locator(".match-card").first().click();
  const pitch = page.locator(".lineup-pitch");
  await expect(pitch).toBeVisible();
  await expect(pitch.locator(".pitch-player")).toHaveCount(22);
  await pitch.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/lineups-horizontal.png" });
  const pitchBox = await pitch.boundingBox();
  expect(pitchBox.height).toBeLessThanOrEqual(302);
  expect(pitchBox.width).toBeGreaterThan(pitchBox.height);
  const goalkeepers = await pitch.locator(".pitch-shirt", { hasText: /^1$/ }).evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
  expect(goalkeepers[1].x - goalkeepers[0].x).toBeGreaterThan(350);
  expect(Math.abs(goalkeepers[1].y - goalkeepers[0].y)).toBeLessThan(2);
  expect(await pitch.evaluate((el) => el.closest("details"))).toBeNull();
  expect(await pitch.locator(".pitch-name").evaluateAll((els) => els.some((el) => el.scrollWidth > el.clientWidth))).toBe(false);
  for (const [title, target] of [["Stats", ".stats-list"], ["Timeline", ".timeline-item"], ["News", ".media-list"]]) {
    const section = page.locator("details").filter({ has: page.locator("summary", { hasText: title }) });
    await section.locator("summary").click();
    await expect(section.locator(target).first()).toBeVisible();
    await section.locator(target).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/${title.toLowerCase()}-presentation.png` });
    const overflow = await section.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflow).toBe(false);
    if (title === "Stats") {
      const widths = await section.locator(".stat-item").first().locator(".stat-bar-fill").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
      expect(widths[1] / widths[0]).toBeCloseTo(2, 1);
      await page.evaluate(() => { document.documentElement.dir = "rtl"; });
      const positions = await section.locator(".stat-item").first().locator(".stat-value").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));
      expect(positions[0]).toBeLessThan(positions[1]);
      await page.evaluate(() => { document.documentElement.dir = "ltr"; });
    }
    if (title === "News") await expect(section.locator(".media-list > :first-child")).toHaveClass(/video-card--highlight/);
    await section.locator("summary").click();
  }
  await expect(page.locator("summary", { hasText: "Commentary" })).toHaveCount(0);
  await page.locator("#backBtn").click();
  await page.locator("#backBtn").click();
});

test("back navigation restores per-view scrolling and open sections", async () => {
  await page.locator(".league-pick-card", { hasText: "Premier League" }).click();
  const scroll = page.locator("#leagueDetailContent");
  await scroll.evaluate((el) => { el.scrollTop = 65; });
  const leaguePosition = await scroll.evaluate((el) => el.scrollTop);
  await page.locator(".match-card").first().click();
  const stats = page.locator('details[data-section-key="stats"]');
  await stats.locator("summary").click();
  await stats.scrollIntoViewIfNeeded();
  const matchPosition = await scroll.evaluate((el) => el.scrollTop);
  await page.locator("#backBtn").click();
  expect(await scroll.evaluate((el) => el.scrollTop)).toBeCloseTo(leaguePosition, 0);
  await page.locator(".match-card").first().click();
  await expect(stats).toHaveAttribute("open", "");
  expect(await scroll.evaluate((el) => el.scrollTop)).toBeCloseTo(matchPosition, 0);
  await page.locator("#backBtn").click();
  await page.locator("#backBtn").click();
});

test("power toggle disables UI and persists", async () => {
  await page.locator("#powerToggle").click();
  await expect(page.locator(".app-shell--disabled")).toBeAttached();
  await page.reload({ waitUntil: "domcontentloaded" });
  // Power off fetches nothing, so no cards: persistence is the assertion.
  await expect(page.locator(".app-shell--disabled")).toBeAttached({ timeout: 15000 });
  await page.locator("#powerToggle").click(); // restore for later tests
  await page.locator(".league-pick-card").first().waitFor({ timeout: 15000 });
});

test("favorites pin leagues to the top", async () => {
  const cards = page.locator(".league-pick-card");
  await cards.filter({ hasText: "LaLiga" }).locator(".favorite-btn").click();
  await expect(cards.first()).toContainText("LaLiga");
});

test("zero console and page errors", async () => {
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
