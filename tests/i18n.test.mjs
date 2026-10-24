import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { loadPopupContext } from "./helpers.mjs";
import { validateLocaleMessages } from "../tools/locale-validation.mjs";

const locales = new URL("../extension/_locales/", import.meta.url);
const readLocale = async code => {
  const raw = await readFile(new URL(`${code}/messages.json`, locales), "utf8");
  const keys = [...raw.matchAll(/^  "([a-z0-9_]+)":/gmi)].map(m => m[1]);
  assert.equal(new Set(keys).size, keys.length, `${code}: no duplicate message keys`);
  return JSON.parse(raw);
};
const en = await readLocale("en");

function installLocale(app, code, messages) {
  app.ctx.chrome = { i18n: {
    getUILanguage: () => code.replaceAll("_", "-"),
    getMessage: (key, values = []) => {
      const text = messages[key]?.message || en[key]?.message || "";
      return text.replaceAll("$COUNT$", String(values[0] ?? ""));
    },
  } };
}

describe("translation reference and runtime behavior", () => {
  it("all 55 packs retain every reference message and valid substitutions", async () => {
    const codes = (await readdir(locales)).sort();
    assert.equal(codes.length, 55);
    const app = await loadPopupContext();
    for (const code of codes) {
      const messages = await readLocale(code);
      assert.deepEqual(validateLocaleMessages(code, messages, en), [], code);
      installLocale(app, code, messages);
      for (const [key, entry] of Object.entries(messages)) {
        assert.equal(app.run(`msg(${JSON.stringify(key)}, ["23"])`), entry.message.replaceAll("$COUNT$", "23"), `${code}/${key}`);
      }
      for (const [status, key] of [["FT", "fullTime"], ["Full Time", "fullTime"], ["HT", "halfTime"], ["Half Time", "halfTime"], ["Scheduled", "scheduled"], ["Live", "live"]]) {
        for (const fn of ["translateStatus", "translateMinute"]) {
          assert.equal(app.run(`${fn}(${JSON.stringify(status)})`), messages[key].message, `${code}/${fn}/${status}`);
        }
      }
      for (const kind of ["live", "upcoming", "completed", "matches"]) {
        for (const count of [0, 1, 2, 3, 4, 5, 10, 11, 12, 20, 21, 22, 101, 102]) {
          const result = app.run(`matchCountMessage(${JSON.stringify(kind)}, ${count})`);
          assert.ok(result.includes(String(count)), `${code}/${kind}/${count}: preserves the count`);
          assert.ok(!/\$COUNT\$|MatchCount|MatchesCount|^matchCount/.test(result), `${code}/${kind}/${count}: no unresolved keys/tokens`);
        }
      }
    }
    assert.ok(app.run("matchCountPluralRules.size") <= 11, "plural-rule cache stays bounded to shipped count-rule languages");
  });

  it("English fallback is identical to the English reference", async () => {
    const app = await loadPopupContext();
    for (const [key, entry] of Object.entries(en)) {
      assert.equal(app.run(`msg(${JSON.stringify(key)}, ["3"])`), entry.message.replaceAll("$COUNT$", "3"), key);
    }
  });

  it("English reference is consistent across regional packs apart from regional wording", async () => {
    for (const code of ["en_US", "en_GB", "en_AU"]) {
      const pack = await readLocale(code);
      const regional = new Set(["favorite", "removeFavorite", "favoriteLeague", "settingsBackupHint", "quarterfinals", "semifinals", "kickoff"]);
      for (const key of Object.keys(en)) {
        if (!regional.has(key)) assert.equal(pack[key].message, en[key].message, `${code}/${key}`);
      }
    }
  });

  const countCases = [
    ["en", 1, "1 live match"], ["en", 2, "2 live matches"],
    ["tr", 1, "1 canlı maç"], ["tr", 4, "4 canlı maç"],
    ["pl", 2, "2 mecze na żywo"], ["pl", 5, "5 meczów na żywo"], ["pl", 21, "21 meczów na żywo"],
    ["cs", 3, "3 zápasy živě"], ["sk", 4, "4 zápasy naživo"],
    ["ru", 21, "Идёт 21 матч"], ["ru", 22, "Идут 22 матча"], ["ru", 25, "Идут 25 матчей"],
    ["uk", 22, "22 матчі наживо"], ["hr", 22, "22 utakmice uživo"], ["sr", 23, "23 утакмице уживо"],
    ["sl", 2, "2 tekmi v živo"], ["sl", 3, "3 tekme v živo"], ["sl", 102, "102 tekmi v živo"],
    ["lt", 2, "2 vykstančios rungtynės"], ["lt", 10, "10 vykstančių rungtynių"],
    ["lv", 10, "10 notiekošu spēļu"], ["lv", 21, "21 notiekoša spēle"],
    ["ro", 2, "2 meciuri în direct"], ["ro", 20, "20 de meciuri în direct"],
    ["ar", 2, "مباريات مباشرة: 2"], ["ja", 2, "2試合が進行中"], ["ko", 2, "진행 중 2경기"],
  ];
  for (const [code, count, expected] of countCases) {
    it(`${code}: ${count} uses a natural live-match count form`, async () => {
      const app = await loadPopupContext();
      installLocale(app, code, await readLocale(code));
      assert.equal(app.run(`matchCountMessage("live", ${count})`), expected);
    });
  }

  it("ENG override uses English grammar, not the browser's plural rules", async () => {
    const app = await loadPopupContext();
    installLocale(app, "ru", await readLocale("ru"));
    app.run("isEnglishOverride = true");
    assert.equal(app.run('matchCountMessage("live", 21)'), "21 live matches");
    assert.equal(app.run('matchCountMessage("live", 1)'), "1 live match");
  });

  it("unsupported browser locales keep the fallback language's grammar", async () => {
    const app = await loadPopupContext();
    installLocale(app, "is", en);
    assert.equal(app.run('matchCountMessage("matches", 21)'), "21 matches");
  });

  it("missing optional forms fall back safely without leaking a key", async () => {
    const app = await loadPopupContext();
    installLocale(app, "pl", en);
    assert.equal(app.run('matchCountMessage("live", 2)'), "2 live matches");
  });

  it("known provider status aliases use translations without guessing playing halves or prose", async () => {
    const app = await loadPopupContext();
    installLocale(app, "tr", await readLocale("tr"));
    for (const [value, key] of [[" ft ", "fullTime"], ["FULL-TIME", "fullTime"], ["STATUS_FULL_TIME", "fullTime"], ["ht", "halfTime"], ["half-time", "halfTime"], ["STATUS_HALFTIME", "halfTime"], [" scheduled ", "scheduled"], ["STATUS_SCHEDULED", "scheduled"], ["LIVE", "live"]]) {
      for (const fn of ["translateStatus", "translateMinute"]) assert.equal(app.run(`${fn}(${JSON.stringify(value)})`), app.run(`msg(${JSON.stringify(key)})`), `${fn}/${value}`);
    }
    for (const value of ["1H", "2H", "45'+3'", "AET", "Postponed", "Full Time after penalties", "constructor", "toString"]) {
      for (const fn of ["translateStatus", "translateMinute"]) assert.equal(app.run(`${fn}(${JSON.stringify(value)})`), value);
    }
    assert.equal(app.run("translateStatus(null)"), "");
    assert.equal(app.run("translateMinute(null)"), "-");
  });

  it("ENG override also formats dates in English while normal mode preserves browser conventions", async () => {
    const app = await loadPopupContext();
    installLocale(app, "tr", await readLocale("tr"));
    const calls = [];
    app.ctx.Intl = { DateTimeFormat: class {
      constructor(locale, options) {
        calls.push(locale);
        this.format = new Intl.DateTimeFormat(locale, options).format;
      }
    } };
    const value = "2026-10-24T19:30:00Z";
    for (const enabled of [false, true]) {
      app.run(`isEnglishOverride = ${enabled}`);
      for (const fn of ["formatUpcomingKickoff", "formatDateTime", "formatShortDate", "formatClockTime"]) {
        assert.ok(app.run(`${fn}(${JSON.stringify(value)})`).length > 0);
        assert.equal(calls.at(-1), enabled ? "en" : undefined, fn);
      }
    }
  });

  it("validator catches token loss, unknown keys and incomplete plural families", () => {
    const broken = structuredClone(en);
    broken.matchCount.message = "matches";
    broken.unreviewedKey = { message: "Unreviewed" };
    broken.liveMatchCountFew = { message: "$COUNT$ mecze na żywo", placeholders: { count: { content: "$2" } } };
    const issues = validateLocaleMessages("pl", broken, en).join("\n");
    assert.match(issues, /changes substitution tokens/);
    assert.match(issues, /unexpected unreviewedKey/);
    assert.match(issues, /must map COUNT to \$1/);
    assert.match(issues, /missing upcomingMatchCountFew/);
  });

  it("football rounds and halftime do not regress to literal mistranslations", async () => {
    const expected = {
      it: ["roundOf32", "Sedicesimi di finale"], no: ["roundOf32", "Sekstendedelsfinale"],
      fa: ["roundOf32", "یک‌شانزدهم نهایی"], cs: ["roundOf32", "Šestnáctifinále"],
      sw: ["standings", "Msimamo"], am: ["lineups", "አሰላለፍ"],
      th: ["halfTime", "พักครึ่ง"], id: ["halfTime", "Jeda"], vi: ["halfTime", "Nghỉ giữa hiệp"],
      bg: ["halfTime", "Почивка"], sk: ["halfTime", "Prestávka"], sl: ["halfTime", "Odmor"],
      zh_CN: ["halfTime", "中场休息"], zh_TW: ["halfTime", "中場休息"],
    };
    for (const [code, [key, value]] of Object.entries(expected)) assert.equal((await readLocale(code))[key].message, value, `${code}/${key}`);
  });
});
