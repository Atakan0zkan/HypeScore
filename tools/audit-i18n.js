/**
 * Audit popup.js/html against locale keys and hard-coded UI strings.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const popup = fs.readFileSync(path.join(ROOT, "extension/popup.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "extension/popup.html"), "utf8");
const en = JSON.parse(
  fs.readFileSync(path.join(ROOT, "extension/_locales/en/messages.json"), "utf8"),
);
const enKeys = Object.keys(en);

const msgKeys = [
  ...popup.matchAll(/msg\(\s*["']([A-Za-z0-9_]+)["']/g),
].map((m) => m[1]);
const uniqueMsg = [...new Set(msgKeys)].sort();

const missingInEn = uniqueMsg.filter((k) => !enKeys.includes(k));
const unusedInEn = enKeys.filter(
  (k) => !uniqueMsg.includes(k) && k !== "extName" && k !== "extDescription",
);

const fbBlock = popup.match(/const FALLBACK_MESSAGES = \{([\s\S]*?)\n\};/);
const fbKeys = fbBlock
  ? [...fbBlock[1].matchAll(/^\s*([A-Za-z0-9_]+):/gm)].map((m) => m[1])
  : [];
const missingFb = uniqueMsg.filter(
  (k) =>
    !fbKeys.includes(k) && k !== "extName" && k !== "extDescription",
);

// Hard-coded English UI candidates in popup.js (string literals)
const stringLits = [...popup.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g)]
  .map((m) => m[2])
  .filter((s) => s.length >= 3 && s.length < 120)
  .filter((s) => /[A-Za-z]/.test(s))
  .filter(
    (s) =>
      !s.startsWith("http") &&
      !s.startsWith("icons/") &&
      !s.startsWith("hype_") &&
      !s.includes("site.api") &&
      !s.includes("atakanozkan") &&
      !s.includes("fifa") &&
      !s.includes("data:") &&
      !s.includes("xmlns") &&
      !s.includes("font-") &&
      !s.includes("rgb") &&
      !s.includes("#") &&
      !/^[a-z0-9_.-]+$/i.test(s) === false ||
      /^(Live|Scheduled|Full Time|Half Time|vs|Loading|Could|No |Ready|Paused)/i.test(
        s,
      ),
  );

// More focused: English phrases used as status maps / UI glue
const suspicious = [];
const patterns = [
  /["']vs["']/g,
  /["']Full Time["']/g,
  /["']Half Time["']/g,
  /["']Scheduled["']/g,
  /["']Live["']/g,
  /textContent\s*=\s*["'][^"']*[A-Za-z]{3,}[^"']*["']/g,
  /createTextElement\([^,]+,\s*[^,]+,\s*["'][^"']+[A-Za-z]{3,}[^"']*["']/g,
  /setAttribute\(\s*["']aria-label["']\s*,\s*["'][^"']+["']/g,
  /title\s*=\s*["'][^"']+[A-Za-z]{3,}[^"']*["']/g,
];

for (const re of patterns) {
  for (const m of popup.matchAll(re)) {
    suspicious.push(m[0]);
  }
}

// HTML static text
const htmlText = html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<[^>]+>/g, "\n")
  .split("\n")
  .map((s) => s.trim())
  .filter((s) => s && /[A-Za-z]{3,}/.test(s));

// Locale parity
const localesDir = path.join(ROOT, "extension/_locales");
const codes = fs
  .readdirSync(localesDir)
  .filter((d) => fs.statSync(path.join(localesDir, d)).isDirectory())
  .sort();

let parityIssues = [];
for (const code of codes) {
  const data = JSON.parse(
    fs.readFileSync(path.join(localesDir, code, "messages.json"), "utf8"),
  );
  const keys = Object.keys(data);
  if (keys.length !== enKeys.length) {
    parityIssues.push(`${code}: count ${keys.length} != ${enKeys.length}`);
  }
  for (const k of enKeys) {
    if (!(k in data)) parityIssues.push(`${code}: missing ${k}`);
    else if (!data[k].message || !String(data[k].message).trim()) {
      parityIssues.push(`${code}: empty ${k}`);
    }
  }
  // identical to English (possible untranslated) — exclude en*
  if (!code.startsWith("en")) {
    let same = 0;
    for (const k of enKeys) {
      if (data[k] && data[k].message === en[k].message) same += 1;
    }
    if (same > 40) {
      parityIssues.push(`${code}: ${same}/${enKeys.length} strings identical to English`);
    }
  }
}

console.log("=== LOCALE PARITY ===");
console.log("locales:", codes.length);
console.log("en keys:", enKeys.length);
console.log("parity issues:", parityIssues.length);
if (parityIssues.length) console.log(parityIssues.slice(0, 30).join("\n"));

console.log("\n=== msg() COVERAGE ===");
console.log("unique msg keys:", uniqueMsg.length);
console.log("missing in en:", missingInEn);
console.log("en keys unused via msg() (except ext*):", unusedInEn);
console.log("missing FALLBACK_MESSAGES:", missingFb);

console.log("\n=== SUSPICIOUS HARDCODED UI ===");
console.log([...new Set(suspicious)].join("\n") || "(none)");

console.log("\n=== HTML STATIC TEXT ===");
console.log(htmlText.join("\n"));

console.log("\n=== ALL msg() KEYS USED ===");
console.log(uniqueMsg.join(", "));
