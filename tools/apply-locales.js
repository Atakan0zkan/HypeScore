/**
 * Converts flat locale maps in tools/i18n-source/*.json into Chrome
 * extension/_locales/<code>/messages.json files.
 *
 * Usage: node tools/apply-locales.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(__dirname, "i18n-source");
const LOCALES_DIR = path.join(ROOT, "extension", "_locales");
const PLACEHOLDER_KEYS = new Set(["liveCount", "matchCount"]);

function toChromeMessages(flat) {
  const out = {};
  for (const [key, message] of Object.entries(flat)) {
    if (typeof message !== "string") {
      throw new Error(`Non-string message for key "${key}"`);
    }
    out[key] = { message };
    if (PLACEHOLDER_KEYS.has(key)) {
      out[key].placeholders = {
        count: { content: "$1" },
      };
    }
  }
  return out;
}

function main() {
  const enPath = path.join(SOURCE_DIR, "en.json");
  if (!fs.existsSync(enPath)) {
    throw new Error("Missing tools/i18n-source/en.json (English reference)");
  }
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
  const expectedKeys = Object.keys(en).sort();

  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  let written = 0;
  for (const file of files) {
    const code = file.replace(/\.json$/, "");
    const flat = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, file), "utf8"));
    const keys = Object.keys(flat).sort();
    if (keys.length !== expectedKeys.length) {
      throw new Error(
        `${code}: expected ${expectedKeys.length} keys, got ${keys.length}`,
      );
    }
    for (const key of expectedKeys) {
      if (!(key in flat)) {
        throw new Error(`${code}: missing key ${key}`);
      }
    }
    for (const key of keys) {
      if (!expectedKeys.includes(key)) {
        throw new Error(`${code}: unexpected key ${key}`);
      }
    }

    const dir = path.join(LOCALES_DIR, code);
    fs.mkdirSync(dir, { recursive: true });
    const chromeMessages = toChromeMessages(flat);
    fs.writeFileSync(
      path.join(dir, "messages.json"),
      JSON.stringify(chromeMessages, null, 2) + "\n",
      "utf8",
    );
    written += 1;
  }

  console.log(`Wrote ${written} locale file(s) to extension/_locales`);
}

main();
