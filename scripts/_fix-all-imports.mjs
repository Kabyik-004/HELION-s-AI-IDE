// Comprehensive import path fixer
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("apps/desktop/src");

function listFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = listFiles(SRC);
const byBase = new Map();
for (const file of files) {
  const base = path.basename(file).replace(/\.tsx?$/, "");
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(file);
}

const exists = (p) => {
  for (const candidate of [p, `${p}.ts`, `${p}.tsx`, path.join(p, "index.ts"), path.join(p, "index.tsx")]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

let fixed = 0;
const ambiguous = [];

for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let text = original;

  text = text.replace(/(from\s+["'])([^"']+)(["'])/g, (whole, pre, spec, post) => {
    if (!spec.startsWith(".")) return whole;
    const resolved = path.resolve(path.dirname(file), spec);
    if (exists(resolved) !== null) return whole;

    const base = path.basename(spec);
    const candidates = byBase.get(base) ?? [];
    if (candidates.length !== 1) {
      ambiguous.push(`${path.relative(SRC, file)} -> ${spec} (${candidates.length} candidates)`);
      return whole;
    }
    let next = path.relative(path.dirname(file), candidates[0]).replace(/\\/g, "/").replace(/\.tsx?$/, "");
    if (!next.startsWith(".")) next = `./${next}`;
    fixed += 1;
    return `${pre}${next}${post}`;
  });

  text = text.replace(/(^|\n)(\s*import\s+)(["'])([^"']+)(["'];?)/g, (whole, lead, pre, q, spec, post) => {
    if (!spec.startsWith(".")) return whole;
    const resolved = path.resolve(path.dirname(file), spec);
    if (exists(resolved) !== null) return whole;

    const base = path.basename(spec);
    const candidates = byBase.get(base) ?? [];
    if (candidates.length !== 1) {
      ambiguous.push(`${path.relative(SRC, file)} -> ${spec} (${candidates.length} candidates)`);
      return whole;
    }
    let next = path.relative(path.dirname(file), candidates[0]).replace(/\\/g, "/").replace(/\.tsx?$/, "");
    if (!next.startsWith(".")) next = `./${next}`;
    fixed += 1;
    return `${lead}${pre}${q}${next}${post}`;
  });

  if (text !== original) fs.writeFileSync(file, text);
}

console.log(`repaired ${fixed} import specifiers`);
if (ambiguous.length > 0) {
  console.log("AMBIGUOUS:");
  for (const item of ambiguous) console.log(`  ${item}`);
}