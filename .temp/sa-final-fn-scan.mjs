#!/usr/bin/env node
/** SA-FINAL-FN-READ discovery helper — read-only. */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SKIP = new Set([
  "node_modules",
  "vendor",
  ".git",
  ".temp",
  "docs",
  "dist",
]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html|ts)$/i.test(e.name)) out.push(p);
  }
  return out;
}

function lineOf(src, idx) {
  return src.slice(0, idx).split(/\n/).length;
}

const files = walk(ROOT).filter((f) => {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (rel.startsWith("scripts/") && /smoke/i.test(rel)) return false;
  if (rel.includes("types/supabase")) return false;
  return true;
});

const literal = [];
const dyn = [];
const LIT = /\.rpc\(\s*(['"`])([^'"`]+)\1/g;
const DYN = /\.rpc\(\s*([A-Za-z_$][\w.]*)\s*[,)]/g;

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  let src;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!/\.rpc\s*\(/.test(src)) continue;
  let m;
  LIT.lastIndex = 0;
  while ((m = LIT.exec(src))) {
    literal.push({ file: rel, line: lineOf(src, m.index), name: m[2] });
  }
  DYN.lastIndex = 0;
  while ((m = DYN.exec(src))) {
    dyn.push({ file: rel, line: lineOf(src, m.index), expr: m[1] });
  }
}

const byName = {};
for (const h of literal) {
  (byName[h.name] ||= []).push(h);
}

fs.writeFileSync(
  ".temp/sa-final-fn-scan.json",
  JSON.stringify(
    {
      uniqueLiteral: Object.keys(byName).sort(),
      byName,
      dyn,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      uniqueCount: Object.keys(byName).length,
      uniqueLiteral: Object.keys(byName).sort(),
      dyn,
    },
    null,
    2,
  ),
);
