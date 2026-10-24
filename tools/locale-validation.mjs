// Structural checks do not replace a linguistic review.
export const COUNT_MESSAGE_PREFIXES = ["liveMatchCount", "upcomingMatchCount", "completedMatchCount", "matchCount"];
const COUNT_FORM = /^(liveMatchCount|upcomingMatchCount|completedMatchCount|matchCount)(Zero|Two|Few|Many)$/;

export function isOptionalCountMessage(key) {
  return COUNT_FORM.test(key);
}

function tokens(message) {
  return [...String(message).matchAll(/\$([a-z][a-z0-9_]*)\$/gi)].map(m => m[1].toLowerCase()).sort();
}

export function validateLocaleMessages(code, messages, reference) {
  const issues = [];
  const fail = text => issues.push(`${code}: ${text}`);
  for (const key of Object.keys(reference)) {
    if (!(key in messages)) fail(`missing ${key}`);
  }
  const categories = new Set(new Intl.PluralRules(code.replaceAll("_", "-")).resolvedOptions().pluralCategories);
  const optionalCategories = new Set();
  for (const [key, entry] of Object.entries(messages)) {
    const optional = key.match(COUNT_FORM);
    if (!(key in reference) && !optional) fail(`unexpected ${key}`);
    if (optional) {
      const category = optional[2].toLowerCase();
      optionalCategories.add(optional[2]);
      if (!categories.has(category)) fail(`${key} is not a plural category used by this locale`);
    }
    if (!entry || typeof entry.message !== "string" || !entry.message.trim()) {
      fail(`empty/non-string ${key}`);
      continue;
    }
    const text = entry.message;
    if (text !== text.trim()) fail(`${key} has leading/trailing whitespace`);
    if (/[\u0000-\u001f\u007f\ufffd]/u.test(text)) fail(`${key} has control/replacement characters`);
    if (/<\/?[a-z][^>]*>/i.test(text)) fail(`${key} must be plain text, not HTML`);
    const expected = optional ? ["count"] : tokens(reference[key]?.message || "");
    if (JSON.stringify(tokens(text)) !== JSON.stringify(expected)) fail(`${key} changes substitution tokens`);
    const placeholders = entry.placeholders || {};
    const names = Object.keys(placeholders).map(k => k.toLowerCase()).sort();
    if (JSON.stringify(names) !== JSON.stringify([...new Set(expected)])) fail(`${key} has invalid placeholder declarations`);
    if (expected.includes("count") && placeholders.count?.content !== "$1") fail(`${key} must map COUNT to $1`);
    if (key === "extName" && text.length > 75) fail("extension name exceeds 75 characters");
    if (key === "extDescription" && text.length > 132) fail("extension description exceeds 132 characters");
  }
  for (const category of optionalCategories) {
    for (const prefix of COUNT_MESSAGE_PREFIXES) {
      if (!(prefix + category in messages)) fail(`missing ${prefix + category} in the count-form family`);
    }
  }
  return issues;
}
