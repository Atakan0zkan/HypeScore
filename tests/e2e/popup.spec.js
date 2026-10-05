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
      goals: i === 1 ? 5 : i === 10 ? 2 : 0, yellowCards: i === 1 ? 2 : 0, redCards: i === 1 ? 1 : 0,
    })).concat([
      { id: `${index}-sub-1`, name: `${team} Substitute One`, jersey: "12", position: "M", starter: false },
      { id: `${index}-sub-2`, name: `${team} Substitute Two`, jersey: "13", position: "F", starter: false },
    ]),
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
  await expect(page.locator(".league-pick-badge")).toHaveCount(0);
  await expect(page.locator(".league-card-actions .favorite-btn")).toHaveCount(3);
  await expect(page.locator(".league-preview-status").first()).toHaveText("67' · Live");
  expect(apiCalls.filter((p) => p === "/live-matches").length).toBeGreaterThanOrEqual(1);
});

test("league previews share the league font and fit all three popup sizes", async ({}, testInfo) => {
  const premier = page.locator(".league-pick-card", { hasText: "Premier League" });
  await expect(premier.locator(".league-preview-team")).toHaveText(["Arsenal", "Chelsea"]);
  await expect(premier.locator(".league-preview-score")).toHaveText("2 – 1");
  await expect(premier.locator(".league-preview-status")).toHaveText("67' · Live");
  await expect(page.locator(".league-pick-card", { hasText: "Serie A" }).locator(".league-preview-status")).toHaveText("Full Time");
  await expect(page.locator(".league-pick-card", { hasText: "LaLiga" }).locator(".league-pick-preview")).toHaveCount(0);
  const type = await premier.evaluate(card => {
    const league = getComputedStyle(card.querySelector(".league-pick-name"));
    const match = getComputedStyle(card.querySelector(".league-pick-preview"));
    return { leagueFont: league.fontFamily, matchFont: match.fontFamily, leagueSize: parseFloat(league.fontSize), matchSize: parseFloat(match.fontSize), leagueColor: league.color, matchColor: match.color };
  });
  expect(type.matchFont).toBe(type.leagueFont);
  expect(type.matchSize).toBe(12);
  expect(type.matchSize).toBeLessThan(type.leagueSize);
  expect(type.matchColor).not.toBe(type.leagueColor);
  const before = apiCalls.length;
  for (const [size, width, height] of [["small", 480, 540], ["big", 720, 600], ["default", 580, 600]]) {
    await page.locator("#settingsToggle").click();
    await page.locator(`input[name="popupSize"][value="${size}"]`).check();
    await page.setViewportSize({ width, height });
    await page.locator("#settingsClose").click();
    expect(await page.locator("#leaguePickList").evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    expect(await page.locator(".league-preview-match").evaluateAll(rows => rows.every(row => row.scrollWidth <= row.clientWidth))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`league-previews-${size}.png`) });
  }
  expect(apiCalls.length).toBe(before);
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
  await expect(page.locator(".lineup-substitutes .lineup-player")).toHaveCount(4);
  await expect(page.locator(".lineup-player--starter")).toHaveCount(0);
  await expect(page.locator("summary", { hasText: "Full squads" })).toHaveCount(0);
  expect(await page.locator(".lineup-substitutes").evaluate(el => el.closest("details"))).toBeNull();
  await expect(pitch.locator(".pitch-goal")).toHaveCount(14);
  await expect(pitch.locator(".pitch-card--yellow")).toHaveCount(4);
  await expect(pitch.locator(".pitch-card--red")).toHaveCount(2);
  const geometry = await pitch.evaluate((el) => {
    const pitch = el.getBoundingClientRect();
    const goals = [...el.querySelectorAll(".pitch-goals")].map((stack) => [...stack.children].map((ball) => {
      const r = ball.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right};
    }));
    return {goals,pitch:{x:pitch.x,y:pitch.y,right:pitch.right}};
  });
  for (const stack of geometry.goals) {
    expect(new Set(stack.map((ball) => ball.x)).size).toBe(1);
    expect(stack.at(-1).y).toBeLessThan(stack[0].y);
    for (const ball of stack) {
      expect(ball.y).toBeGreaterThanOrEqual(geometry.pitch.y);
      expect(ball.x).toBeGreaterThanOrEqual(geometry.pitch.x);
      expect(ball.right).toBeLessThanOrEqual(geometry.pitch.right);
    }
  }
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

test("settings sizes persist and local backup safely round-trips only favorites and size", async ({}, testInfo) => {
  await expect(page.locator("#subtitle")).toHaveCount(0);
  expect(await page.locator(".hero-actions > button").evaluateAll(els => els.map(el => el.id))).toEqual(["englishToggle", "settingsToggle", "powerToggle"]);
  await page.locator("#settingsToggle").click();
  const before = apiCalls.length;
  for (const [size, width, height] of [["small", 480, 540], ["default", 580, 600], ["big", 720, 600]]) {
    await page.setViewportSize({ width, height });
    await page.locator(`input[name="popupSize"][value="${size}"]`).check();
    await expect(page.locator("html")).toHaveAttribute("data-popup-size", size);
    expect(await page.evaluate(() => ({ width: document.body.getBoundingClientRect().width, height: document.body.getBoundingClientRect().height }))).toEqual({ width, height });
    expect(await page.locator("#settingsPanel").evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`settings-${size}.png`) });
  }
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportSettings").click()]);
  expect(download.suggestedFilename()).toBe("hype-settings.json");
  const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(exported).toEqual({ format: "hype-score-preferences", version: 1, favoriteLeagues: ["esp.1"], popupSize: "big" });
  expect(apiCalls.length).toBe(before);
  const privacy = page.locator("#privacyLink");
  await expect(privacy).toHaveAttribute("href", "https://gist.github.com/Atakan0zkan/7767ff31859fa9703b9e851ea5eb9a6d");
  await expect(privacy).toHaveAttribute("rel", "noopener noreferrer");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-popup-size", "big");
  await page.locator(".league-pick-card").first().waitFor();
  await page.locator(".league-pick-card", { hasText: "LaLiga" }).locator(".favorite-btn").click();
  await page.locator("#settingsToggle").click();
  await page.locator('input[name="popupSize"][value="default"]').check();
  const importBefore = apiCalls.length;
  await page.locator("#settingsFile").setInputFiles({ name: "hype-settings.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
  await expect(page.locator("#settingsStatus")).toHaveText("Settings imported.");
  await expect(page.locator("html")).toHaveAttribute("data-popup-size", "big");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hype_favorite_leagues")))).toEqual(["esp.1"]);
  expect(apiCalls.length).toBe(importBefore);
  await page.locator("#settingsFile").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"__proto__":{"polluted":true}}') });
  await expect(page.locator("#settingsStatus")).toHaveClass(/settings-status--error/);
  await expect(page.locator("html")).toHaveAttribute("data-popup-size", "big");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hype_favorite_leagues")))).toEqual(["esp.1"]);
  await page.locator("#settingsFile").setInputFiles({ name: "oversized.json", mimeType: "application/json", buffer: Buffer.alloc(65537, " ") });
  await expect(page.locator("#settingsStatus")).toHaveText("This is not a valid Hype settings file.");
  await page.locator('input[name="popupSize"][value="default"]').check();
  await page.setViewportSize({ width: 580, height: 600 });
  await page.locator("#settingsClose").click();
  await expect(page.locator(".league-pick-card").first()).toContainText("LaLiga");
});

test("settings preserve match navigation and work while power is off", async () => {
  await page.locator(".league-pick-card", { hasText: "Premier League" }).click();
  await page.locator(".match-card").first().click();
  const stats = page.locator('details[data-section-key="stats"]');
  await stats.locator("summary").click();
  await stats.scrollIntoViewIfNeeded();
  const scroll = page.locator("#leagueDetailContent");
  const position = await scroll.evaluate(el => el.scrollTop);
  await page.locator("#settingsToggle").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".match-detail-hero")).toBeVisible();
  await expect(stats).toHaveAttribute("open", "");
  expect(await scroll.evaluate(el => el.scrollTop)).toBeCloseTo(position, 0);
  await page.locator("#backBtn").click();
  await page.locator("#backBtn").click();
  await page.locator("#powerToggle").click();
  const requests = apiCalls.length;
  await page.locator("#settingsToggle").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await page.locator('input[name="popupSize"][value="small"]').check();
  expect(apiCalls.length).toBe(requests);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-popup-size", "small");
  await expect(page.locator(".app-shell--disabled")).toBeAttached();
  await page.locator("#settingsToggle").click();
  await page.locator('input[name="popupSize"][value="default"]').check();
  await page.locator("#settingsClose").click();
  await page.locator("#powerToggle").click();
  await page.locator(".league-pick-card").first().waitFor();
});

test("World Cup opens 2030 data, excludes legacy results, and supports an empty future season", async ({}, testInfo) => {
  const future = { id: "203001", leagueCode: "fifa.world", seasonYear: 2030, homeTeam: "Spain", awayTeam: "England", state: "scheduled", kickoff: "2030-06-15T18:00:00Z" };
  const old = { ...future, id: "760517", seasonYear: 2026, homeTeam: "Old Spain", awayTeam: "Old Argentina", state: "finished", kickoff: "2026-07-19T18:00:00Z" };
  for (const scenario of [
    { name: "legacy-backend", data: { rounds: [{ slug: "final", matches: [old] }], standings: STANDINGS }, count: 0 },
    { name: "unpublished-2030", data: { seasonYear: 2030, rounds: [], standings: [] }, count: 0 },
    { name: "published-2030", data: { seasonYear: 2030, rounds: [{ slug: "group-stage", name: "Group stage", matches: [old, future] }], standings: [] }, count: 1 },
  ]) {
    await test.step(scenario.name, async () => {
      const urls = [];
      const handler = async (route) => {
        const url = new URL(route.request().url());
        urls.push(url);
        const body = url.pathname === "/live-matches"
          ? { matches: [old], leagues: [{ code: "fifa.world", name: "FIFA World Cup", matches: [old] }] }
          : scenario.data;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      };
      await page.route("**://api.atakanozkan.com/**", handler);
      try {
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.getByRole("button", { name: "FIFA World Cup 2030", exact: true }).click();
        await expect(page.locator(".league-detail-title")).toHaveText("FIFA World Cup 2030");
        await expect.poll(() => urls.some((url) => url.pathname === "/tournament-bracket" && url.searchParams.get("season") === "2030")).toBe(true);
        await expect(page.locator(".bracket-message").filter({ hasText: "Loading" })).toHaveCount(0);
        await expect(page.locator(".bracket-match-card")).toHaveCount(scenario.count);
        await expect(page.locator(".match-card,.standings-table")).toHaveCount(0);
        await expect(page.locator("#leagueDetailContent")).not.toContainText("Old Argentina");
        await expect(page.locator(".bracket-message--error,.standings-message--error")).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath(`world-cup-${scenario.name}.png`) });
      } finally {
        await page.unroute("**://api.atakanozkan.com/**", handler);
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.locator(".league-pick-card").first().waitFor();
      }
    });
  }
});

test("league previews refresh Live, Half Time and Full Time with long and RTL team names", async () => {
  let fixture;
  let previewRequests = 0;
  const before = apiCalls.length;
  const handler = async route => {
    previewRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [fixture], leagues: [{ code: "eng.1", name: "Premier League", matches: [fixture] }] }) });
  };
  await page.route("**://api.atakanozkan.com/live-matches**", handler);
  try {
    for (const [index, state, status, label] of [[0, "live", "Live", "67' · Live"], [1, "live", "Half Time", "Half Time"], [2, "finished", "Full Time", "Full Time"]]) {
      fixture = { ...LEAGUES[0].matches[0], state, status, homeScore: index, awayScore: 0, homeTeam: "A football club with an exceptionally long home team name", awayTeam: "فريق كرة القدم ذو الاسم الطويل للغاية" };
      await page.evaluate(() => localStorage.removeItem("hype_live_matches_cache"));
      await page.reload();
      await expect(page.locator(".league-preview-status")).toHaveText(label);
      await expect(page.locator(".league-preview-score")).toHaveText(`${index} – 0`);
      await expect(page.locator(".league-pick-preview")).toHaveCount(1);
      await expect(page.locator(".league-pick-card")).toHaveAttribute("aria-label", `Premier League · ${fixture.homeTeam} ${index} – 0 ${fixture.awayTeam} · ${label}`);
      for (const dir of ["ltr", "rtl"]) {
        await page.evaluate(dir => { document.documentElement.dir = dir; }, dir);
        expect(await page.locator(".league-preview-match").evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
        expect(await page.locator(".league-preview-team").evaluateAll(teams => teams.every(el => getComputedStyle(el).textOverflow === "ellipsis" && el.getBoundingClientRect().width > 0))).toBe(true);
        await expect(page.locator(".league-preview-score")).toHaveAttribute("dir", "ltr");
      }
    }
    expect(previewRequests).toBe(3);
    expect(apiCalls.length).toBe(before);
  } finally {
    await page.unroute("**://api.atakanozkan.com/live-matches**", handler);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator(".league-pick-card").first().waitFor();
  }
});

test("previews prefer popular club matches and upcoming metadata has no repeated total", async ({}, testInfo) => {
  let selectedMatches;
  const popular = { ...LEAGUES[0].matches[0], id: "880001", homeTeamId: "360", homeTeam: "Manchester United", awayTeamId: "364", awayTeam: "Liverpool", kickoff: new Date(Date.now() - 3 * 3600000).toISOString() };
  const minor = { ...LEAGUES[0].matches[0], id: "880002", homeTeamId: "370", homeTeam: "Fulham", awayTeamId: "384", awayTeam: "Crystal Palace", kickoff: new Date(Date.now() - 3600000).toISOString() };
  const upcoming = Array.from({ length: 4 }, (_, i) => ({ ...LEAGUES[0].matches[1], id: `88100${i}`, leagueCode: "arg.1", homeTeam: `Home Club ${i}`, awayTeam: `Away Club ${i}`, kickoff: new Date(Date.now() + 2 * 3600000).toISOString() }));
  const handler = async route => {
    const leagues = [{ code: "eng.1", name: "Premier League", matches: selectedMatches }, { code: "arg.1", name: "Argentine Liga Profesional", matches: upcoming }];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [...selectedMatches, ...upcoming], leagues }) });
  };
  await page.route("**://api.atakanozkan.com/live-matches**", handler);
  try {
    for (const [matches, expectedTeams] of [
      [[minor, popular], ["Manchester United", "Liverpool"]],
      [[{ ...popular, state: "finished", status: "Full Time" }, { ...minor, state: "finished", status: "Full Time" }], ["Manchester United", "Liverpool"]],
      [[{ ...popular, state: "finished", status: "Full Time" }, minor], ["Fulham", "Crystal Palace"]],
    ]) {
      selectedMatches = matches;
      await page.evaluate(() => localStorage.removeItem("hype_live_matches_cache"));
      await page.reload();
      const premier = page.locator(".league-pick-card", { hasText: "Premier League" });
      await expect(premier.locator(".league-preview-team")).toHaveText(expectedTeams);
      const argentina = page.locator(".league-pick-card", { hasText: "Argentine Liga Profesional" });
      await expect(argentina.locator(".league-pick-meta")).toHaveText("4 upcoming matches");
      await expect(argentina).not.toContainText("4 matches");
      expect(await argentina.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    }
    await page.locator("#settingsToggle").click();
    await page.locator('input[name="popupSize"][value="small"]').check();
    await page.setViewportSize({ width: 480, height: 540 });
    await page.locator("#settingsClose").click();
    expect(await page.locator("#leaguePickList").evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("popular-match-and-upcoming-copy.png") });
    await page.locator(".league-pick-card", { hasText: "Argentine Liga Profesional" }).click();
    await expect(page.locator(".league-detail-meta")).toHaveText("4 upcoming matches");
  } finally {
    await page.unroute("**://api.atakanozkan.com/live-matches**", handler);
    await page.evaluate(() => localStorage.clear());
    await page.setViewportSize({ width: 580, height: 600 });
    await page.reload();
    await page.locator(".league-pick-card").first().waitFor();
  }
});

test("zero console and page errors", async () => {
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
