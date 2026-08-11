#!/usr/bin/env node
/**
 * SA-4 discovery helper — read-only. Does not modify app or Supabase.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", "vendor", ".git", ".temp", "docs"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|html|ts|tsx)$/i.test(e.name)) out.push(p);
  }
  return out;
}

// Parse public Views from generated types
const types = fs.readFileSync("public/shared/js/types/supabase.ts", "utf8");
const tablesStart = types.indexOf("    Tables: {");
const viewsStart = types.indexOf("    Views: {");
const functionsStart = types.indexOf("    Functions: {");
const viewsBlock = types.slice(viewsStart, functionsStart);
const tablesBlock = types.slice(tablesStart, viewsStart);
const nameRe = /^\s{6}([a-zA-Z0-9_]+):\s*\{/gm;
function names(block) {
  const s = new Set();
  let m;
  while ((m = nameRe.exec(block))) s.add(m[1]);
  return s;
}
const VIEW_NAMES = names(viewsBlock);
const TABLE_NAMES = names(tablesBlock);

const FROM_RE = /\.from\(\s*(['"`])([^'"`]+)\1\s*\)/g;
const hits = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("scripts/") && rel.includes("smoke")) continue;
  if (rel.includes("types/supabase")) continue;
  let src;
  try {
    src = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  let m;
  FROM_RE.lastIndex = 0;
  while ((m = FROM_RE.exec(src)) !== null) {
    const name = m[2];
    const before = src.slice(Math.max(0, m.index - 50), m.index);
    if (/\.storage\s*$/.test(before.trimEnd()) || /storage\s*\.\s*$/.test(before))
      continue;
    const slice = src.slice(m.index, m.index + 800);
    const nextFrom = slice.search(/\.from\s*\(/);
    const window = nextFrom > 0 ? slice.slice(0, nextFrom) : slice;
    const ops = new Set();
    let om;
    const ore = /\.(select|insert|update|upsert|delete)\s*\(/gi;
    while ((om = ore.exec(window)) !== null) ops.add(om[1].toUpperCase());
    const line = src.slice(0, m.index).split(/\n/).length;
    const beforeAll = src.slice(0, m.index);
    const fnMatch = beforeAll.match(
      /(?:async\s+function|function)\s+([A-Za-z0-9_$]+)\s*\(/g,
    );
    const arrowMatch = beforeAll.match(
      /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/g,
    );
    let fn = "(module/top)";
    if (fnMatch)
      fn = fnMatch[fnMatch.length - 1].replace(/^.*?([A-Za-z0-9_$]+)\s*\($/, "$1");
    else if (arrowMatch) {
      const last = arrowMatch[arrowMatch.length - 1];
      fn = last.match(/(?:const|let|var)\s+([A-Za-z0-9_$]+)/)?.[1] || fn;
    }
    const kind = VIEW_NAMES.has(name)
      ? "VIEW"
      : TABLE_NAMES.has(name)
        ? "TABLE"
        : name.startsWith("v_") || name.startsWith("mv_") || name.startsWith("sop_v_")
          ? "LIKELY_VIEW_UNTYPED"
          : "UNKNOWN";
    hits.push({
      file: rel,
      line,
      name,
      kind,
      ops: [...ops].length ? [...ops] : ["UNKNOWN"],
      fn,
    });
  }
}

// Dynamic string literals that look like view names near .from(cfg
const dynHints = [];
const dynRe =
  /(?:table|view|viewName|candidate|cfg\.table|cfg\.view)\s*[:=]\s*['"`]([^'"`]+)['"`]/g;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (rel.startsWith("scripts/")) continue;
  if (rel.includes("types/supabase")) continue;
  const src = fs.readFileSync(file, "utf8");
  if (!/\.from\s*\(\s*(cfg\.|viewName|candidate|view|table|tbl)\b/.test(src) &&
      !/\.from\s*\(\s*[A-Z_][A-Z0-9_]*\s*\)/.test(src)) {
    // still collect string assignments that are typed views
  }
  let m;
  dynRe.lastIndex = 0;
  while ((m = dynRe.exec(src)) !== null) {
    const name = m[1];
    if (VIEW_NAMES.has(name) || name.startsWith("v_") || name.startsWith("mv_")) {
      const line = src.slice(0, m.index).split(/\n/).length;
      dynHints.push({ file: rel, line, name, kind: VIEW_NAMES.has(name) ? "VIEW" : "LIKELY_VIEW" });
    }
  }
  // Const arrays of view candidates
  const arrRe = /=\s*\[\s*((?:['"`][^'"`]+['"`]\s*,?\s*)+)\]/g;
  while ((m = arrRe.exec(src)) !== null) {
    if (!/VIEW|view|OVERVIEW|CANDIDATE/i.test(src.slice(Math.max(0, m.index - 80), m.index)))
      continue;
    const parts = [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]);
    for (const name of parts) {
      if (VIEW_NAMES.has(name) || name.startsWith("v_")) {
        const line = src.slice(0, m.index).split(/\n/).length;
        dynHints.push({ file: rel, line, name, kind: VIEW_NAMES.has(name) ? "VIEW" : "LIKELY_VIEW" });
      }
    }
  }
}

const viewHits = hits.filter((h) => h.kind === "VIEW" || h.kind === "LIKELY_VIEW_UNTYPED");
const byView = new Map();
for (const h of viewHits) {
  if (!byView.has(h.name)) byView.set(h.name, []);
  byView.get(h.name).push(h);
}
for (const h of dynHints) {
  if (!byView.has(h.name)) byView.set(h.name, []);
  byView.get(h.name).push({ ...h, ops: ["SELECT?"], fn: "(dynamic-config)", dynamic: true });
}

const activeViews = [...byView.keys()].sort();
const typedViews = [...VIEW_NAMES].sort();
const zeroClient = typedViews.filter((v) => !byView.has(v));

const out = {
  typedViewCount: VIEW_NAMES.size,
  activeViewCount: activeViews.length,
  activeViews,
  zeroClientCount: zeroClient.length,
  zeroClient,
  byView: Object.fromEntries(
    [...byView.entries()].map(([k, v]) => [
      k,
      v.map((h) => ({
        file: h.file,
        line: h.line,
        fn: h.fn,
        ops: h.ops,
        kind: h.kind,
        dynamic: !!h.dynamic,
      })),
    ]),
  ),
  dynHints,
  nonViewHitsSample: hits.filter((h) => h.kind === "UNKNOWN").slice(0, 50),
};

fs.writeFileSync(".temp/sa4-view-access-scan.json", JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      typedViewCount: out.typedViewCount,
      activeViewCount: out.activeViewCount,
      zeroClientCount: out.zeroClientCount,
      activeViews,
      dynUnique: [...new Set(dynHints.map((d) => d.name))].sort(),
    },
    null,
    2,
  ),
);
