#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", "vendor", ".git", ".temp", "docs"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|html)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const re = /(labSupabase|hrSupabase|supabase)\.from\(\s*['"`]([^'"`]+)['"`]/g;
const byClient = { labSupabase: new Set(), hrSupabase: new Set(), supabase: new Set() };

for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (rel.startsWith("scripts/")) continue;
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(src))) {
    const name = m[2];
    if (name.startsWith("v_") || name.startsWith("mv_")) continue;
    byClient[m[1]].add(name);
  }
}

console.log(
  JSON.stringify(
    {
      lab: [...byClient.labSupabase].sort(),
      hr: [...byClient.hrSupabase].sort(),
      publicLiteral: [...byClient.supabase].sort(),
    },
    null,
    2,
  ),
);
