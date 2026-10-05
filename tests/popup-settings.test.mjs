import { beforeEach, afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadPopupDOM, domPayload, workerJson } from "./dom-helpers.mjs";

let app;
const format = "hype-score-preferences";
const backup = (over = {}) => JSON.stringify({ format, version: 1, favoriteLeagues: ["esp.1", "eng.1"], popupSize: "big", ...over });
beforeEach(async () => {
  app = await loadPopupDOM({ fetchImpl: async () => workerJson({ matches: [], leagues: [] }) });
});
afterEach(async () => { await app.close(); });

describe("popup settings and local backups", () => {
  it("removes the subtitle and puts settings between ENG and power", () => {
    assert.equal(app.document.getElementById("subtitle"), null);
    assert.deepEqual([...app.document.querySelectorAll(".hero-actions > button")].map(b => b.id), ["englishToggle", "settingsToggle", "powerToggle"]);
    assert.equal(app.document.querySelectorAll('input[name="popupSize"]').length, 3);
  });

  it("uses fixed HTTPS project/privacy links with isolated new tabs", () => {
    const links = [...app.document.querySelectorAll(".settings-link")];
    assert.deepEqual(links.map(a => a.href), ["https://github.com/Atakan0zkan/HypeScore", "https://gist.github.com/Atakan0zkan/7767ff31859fa9703b9e851ea5eb9a6d"]);
    for (const link of links) {
      assert.equal(link.target, "_blank");
      assert.ok(link.rel.includes("noopener") && link.rel.includes("noreferrer"));
    }
  });

  it("opens/closes accessibly and restores focus on Escape", () => {
    const toggle = app.document.getElementById("settingsToggle");
    toggle.click();
    assert.equal(app.eval("__T.isSettingsOpen"), true);
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(app.document.getElementById("settingsPanel").hidden, false);
    assert.equal(app.document.getElementById("leaguePickList").inert, true);
    app.document.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(app.eval("__T.isSettingsOpen"), false);
    assert.equal(app.document.activeElement, toggle);
    assert.equal(app.document.getElementById("leaguePickList").inert, false);
  });

  it("persists only supported size presets", () => {
    assert.equal(app.eval("__T.popupSize"), "default");
    for (const size of ["small", "big", "default"]) {
      assert.equal(app.eval(`savePopupSize(${JSON.stringify(size)})`), true);
      assert.equal(app.document.documentElement.dataset.popupSize, size);
      assert.equal(app.window.localStorage.getItem("hype_popup_size"), size);
      assert.equal(app.document.querySelector('input[name="popupSize"]:checked').value, size);
    }
    assert.equal(app.eval('savePopupSize("999px")'), false);
    assert.equal(app.document.documentElement.dataset.popupSize, "default");
  });

  it("restores a supported saved size and ignores malformed stored values", async () => {
    await app.close();
    app = await loadPopupDOM({ storage: { hype_popup_size: "small", hype_enabled: "0" } });
    assert.equal(app.eval("__T.popupSize"), "small");
    await app.close();
    app = await loadPopupDOM({ storage: { hype_popup_size: '"big";color:red', hype_enabled: "0" } });
    assert.equal(app.eval("__T.popupSize"), "default");
  });

  it("exports only supported league favorites and size, not other local data", () => {
    app.eval('__T.favoriteLeagues.add("esp.1"); __T.favoriteLeagues.add("eng.1"); __T.favoriteLeagues.add("<img>"); localStorage.setItem("hype_enabled","0"); localStorage.setItem("hype_daily_request_count","private counter")');
    app.eval('savePopupSize("small")');
    const data = JSON.parse(app.eval("JSON.stringify(buildPreferencesExport())"));
    assert.deepEqual(data, { format, version: 1, favoriteLeagues: ["eng.1", "esp.1"], popupSize: "small" });
  });

  it("validates and deduplicates portable settings", () => {
    const parsed = JSON.parse(app.eval(`JSON.stringify(parsePreferencesImport(${JSON.stringify(backup({ favoriteLeagues: ["eng.1", "eng.1", "esp.1"] }))}))`));
    assert.deepEqual(parsed, { favoriteLeagues: ["eng.1", "esp.1"], popupSize: "big" });
  });

  it("rejects invalid versions, foreign fields, unsupported leagues and executable-looking data", () => {
    for (const text of ["no json", "null", "[]", "{}", backup({ version: 2 }), backup({ version: "1" }), backup({ format: "other" }), backup({ popupSize: "huge" }), backup({ favoriteLeagues: "eng.1" }), backup({ favoriteLeagues: ["unsupported.league"] }), backup({ favoriteLeagues: ["<img src=x onerror=alert(1)>"] }), backup({ favorites: [] }), backup({ favoriteLeagues: Array(33).fill("eng.1") }), backup().replace('"format":', '"__proto__":{"polluted":true},"format":')]) {
      assert.throws(() => app.eval(`parsePreferencesImport(${JSON.stringify(text)})`));
    }
    assert.equal(app.eval("({}).polluted"), undefined);
  });

  it("replaces both preferences while leaving power, language and counters alone", async () => {
    await app.close();
    app = await loadPopupDOM({ storage: { hype_enabled: "0", hype_english_override: "1", hype_daily_request_count: "counter", hype_live_matches_cache: "cache", hype_favorite_leagues: '["ita.1"]' } });
    assert.equal(app.eval(`applyImportedPreferences(parsePreferencesImport(${JSON.stringify(backup())}))`), true);
    assert.deepEqual(JSON.parse(app.window.localStorage.getItem("hype_favorite_leagues")), ["eng.1", "esp.1"]);
    assert.equal(app.window.localStorage.getItem("hype_popup_size"), "big");
    assert.equal(app.eval("__T.popupSize"), "big");
    for (const [key, value] of Object.entries({ hype_enabled: "0", hype_english_override: "1", hype_daily_request_count: "counter", hype_live_matches_cache: "cache" })) assert.equal(app.window.localStorage.getItem(key), value);
    assert.equal(app.eval("__T.isEnabled"), false);
  });

  it("imports a valid file and reports success without an extra API request", async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    let requests = 0;
    app.window.fetch = async () => { requests++; return workerJson(domPayload()); };
    await app.eval(`importPreferencesFile(new File([${JSON.stringify(backup())}], "settings.json", {type:"application/json"}))`);
    assert.equal(app.document.getElementById("settingsStatus").textContent, "Settings imported.");
    assert.equal(app.document.getElementById("settingsStatus").classList.contains("settings-status--error"), false);
    assert.equal(requests, 0);
  });

  it("rejects malformed files without changing preferences", async () => {
    app.eval('savePopupSize("small"); __T.favoriteLeagues.add("ita.1"); writeSet("hype_favorite_leagues", __T.favoriteLeagues)');
    await app.eval('importPreferencesFile(new File(["invalid"], "bad.json"))');
    assert.equal(app.eval("__T.popupSize"), "small");
    assert.deepEqual(JSON.parse(app.window.localStorage.getItem("hype_favorite_leagues")), ["ita.1"]);
    assert.equal(app.document.getElementById("settingsStatus").classList.contains("settings-status--error"), true);
    assert.equal(app.document.getElementById("importSettings").disabled, false);
  });

  it("rejects oversized files before reading them", async () => {
    app.window.tooLarge = { size: 65537, text() { throw new Error("must not be read"); } };
    await app.eval("importPreferencesFile(window.tooLarge)");
    assert.equal(app.document.getElementById("settingsStatus").textContent, "This is not a valid Hype settings file.");
    assert.equal(app.eval("__T.popupSize"), "default");
    assert.throws(() => app.eval(`parsePreferencesImport(${JSON.stringify(" ".repeat(65537))})`));
  });

  it("keeps settings available while the scores are switched off", () => {
    app.document.getElementById("powerToggle").click();
    app.document.getElementById("settingsToggle").click();
    assert.equal(app.eval("__T.isEnabled"), false);
    assert.equal(app.eval("__T.isSettingsOpen"), true);
    assert.equal(app.document.getElementById("settingsPanel").hidden, false);
    assert.equal(app.eval('savePopupSize("big")'), true);
  });

  it("preserves view scroll while settings delay a background render", () => {
    app.eval(`__T.lastPayload = ${JSON.stringify(domPayload())}; __T.renderLast()`);
    const pick = app.document.getElementById("leaguePickList");
    pick.scrollTop = 120;
    app.document.getElementById("settingsToggle").click();
    pick.scrollTop = 0; // Simulate layout clamping a hidden view.
    app.eval("__T.renderLast()");
    app.document.getElementById("settingsClose").click();
    assert.equal(pick.scrollTop, 120);
  });

  it("rolls back a failed import and keeps the in-memory preferences", () => {
    app.eval('savePopupSize("small"); __T.favoriteLeagues.add("ita.1"); writeSet("hype_favorite_leagues", __T.favoriteLeagues)');
    const original = app.window.localStorage.setItem.bind(app.window.localStorage);
    app.window.console.warn = () => {};
    Object.defineProperty(app.window.localStorage, "setItem", { configurable: true, value: (key, value) => {
      if (key === "hype_popup_size" && value === "big") throw new Error("storage failure");
      return original(key, value);
    } });
    assert.equal(app.eval(`applyImportedPreferences(parsePreferencesImport(${JSON.stringify(backup())}))`), false);
    assert.equal(app.eval("__T.popupSize"), "small");
    assert.deepEqual(JSON.parse(app.window.localStorage.getItem("hype_favorite_leagues")), ["ita.1"]);
    assert.equal(app.window.localStorage.getItem("hype_popup_size"), "small");
  });

  it("does not change the size when saving fails", () => {
    app.window.console.warn = () => {};
    Object.defineProperty(app.window.localStorage, "setItem", { configurable: true, value: () => { throw new Error("storage failure"); } });
    assert.equal(app.eval('savePopupSize("big")'), false);
    assert.equal(app.eval("__T.popupSize"), "default");
    assert.equal(app.document.querySelector('input[name="popupSize"]:checked').value, "default");
    assert.equal(app.document.getElementById("settingsStatus").textContent, "Settings could not be saved on this device.");
  });
});
