/** Audit all shipped locales; English is the reference, not ignored seed files. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isOptionalCountMessage, validateLocaleMessages } from "./locale-validation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "extension/_locales");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const popup = read("extension/popup.js");
const en = JSON.parse(read("extension/_locales/en/messages.json"));
const codes = fs.readdirSync(dir).filter(code => fs.statSync(path.join(dir, code)).isDirectory()).sort();
const issues = [];
let optionalCount = 0;
let totalMessages = 0;
for (const code of codes) {
  const raw = read(`extension/_locales/${code}/messages.json`);
  const messages = JSON.parse(raw);
  const topLevelKeys = [...raw.matchAll(/^  "([a-z0-9_]+)":/gmi)].map(m => m[1]);
  if (new Set(topLevelKeys).size !== topLevelKeys.length) issues.push(`${code}: duplicate message keys`);
  issues.push(...validateLocaleMessages(code, messages, en));
  optionalCount += Object.keys(messages).filter(isOptionalCountMessage).length;
  totalMessages += Object.keys(messages).length;
}

const fallback = popup.match(/const FALLBACK_MESSAGES = \{([\s\S]*?)\n\};/)?.[1] || "";
const fallbackMessages = Object.fromEntries([...fallback.matchAll(/\b([a-z0-9_]+):\s*("(?:\\.|[^"\\])*")/gmi)].map(m => [m[1], JSON.parse(m[2])]));
for (const [key, value] of Object.entries(en)) {
  if (!(key in fallbackMessages)) issues.push(`English fallback missing ${key}`);
  else if (fallbackMessages[key].replaceAll("$1", "$COUNT$") !== value.message) issues.push(`English fallback differs for ${key}`);
}
for (const match of popup.matchAll(/msg\(\s*["']([a-z0-9_]+)["']/gmi)) {
  if (!(match[1] in en)) issues.push(`Runtime message missing from English: ${match[1]}`);
}

console.log(`Locales: ${codes.length}`);
console.log(`Required English reference messages: ${Object.keys(en).length}`);
console.log(`Additional language-specific count forms: ${optionalCount}`);
console.log(`Total packaged messages: ${totalMessages}`);
console.log(`Structural, substitution and English-fallback issues: ${issues.length}`);
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
}
