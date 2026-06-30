const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "src");
const exts = new Set([".js", ".jsx"]);
const ignore = ["textConstants.js", "languageContext.js"];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.has(path.extname(entry.name)) && !ignore.some((i) => full.endsWith(i))) check(full);
  }
}

function check(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.includes("console.")) return;
    const hasLiteralTextNode = />\s*[^<{][^<>{}]*</.test(line);
    const hasLiteralPlaceholder = /placeholder="[^"]+"/.test(line);
    if (hasLiteralTextNode || hasLiteralPlaceholder) {
      if (!line.includes("{t.")) {
        console.log(`${path.relative(ROOT, file)}:${idx + 1}: ${trimmed}`);
      }
    }
  });
}

walk(ROOT);
