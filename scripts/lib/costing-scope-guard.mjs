// Costing package scope guard (shared by the Costing node:test suites).
//
// The historical Costing package tests compare the working tree with a fixed Costing base commit. They used
// to assert that the WHOLE repository's `*.html`, `*.css` and `supabase/` were unchanged, so any later,
// unrelated module landing on main (for example WP-07 e-Aushadhi HTML/CSS and its own migration) made them
// fail. This helper keeps the protection on what Costing owns or depends on, and ignores other modules:
//
//   HTML      Costing pages: public/shared/costing-*.html plus the known Costing pages below.
//   CSS       Costing styles (any *costing*.css), every stylesheet a Costing page links, and the shared
//             style contract: public/shared/css/style.css and its transitive @import chain.
//   supabase  Existing files are immutable (any M/D/R/C/T of a file present at the base is a violation);
//             anything changed outside supabase/migrations/ is a violation; an ADDED migration is a
//             violation when its SQL mentions costing.
//   package.json  Any change is a violation.
//
// Nothing here is Costing-specific logic; it only selects which changed paths count.

import fs from "node:fs";
import path from "node:path";

export const COSTING_HTML_FILES = Object.freeze([
  "public/shared/cost-build-manager.html",
  "public/shared/cost-sheet-review.html",
  "public/shared/costing-control-center.html",
  "public/shared/material-cost-manager.html",
  "public/shared/pricing-policy-manager.html",
  "public/shared/production-route-manager.html",
]);

export const SHARED_STYLE_ROOT = "public/shared/css/style.css";
const COSTING_HTML_PATTERN = /^public\/shared\/costing-[^/]*\.html$/;
const COSTING_CSS_PATTERN = /(^|\/)[^/]*costing[^/]*\.css$/i;
// "costing" as a whole token where "_" and "." also delimit, so that all of these match:
//   costing.sku_price (schema), public.costing_refresh_run, fn_costing_view_allowed, costing_admin (role),
//   v_current_successful_costing_refresh_run, GRANT/POLICY/ALTER/DROP/COMMENT statements naming any of them.
// Letters and digits on either side prevent matches inside other words ("accosting", "costings", "costing2").
// SQL comments are scanned too on purpose: a migration that merely talks about costing is flagged for review
// rather than silently allowed (conservative; real WP-07 migrations do not contain the word).
const COSTING_SQL_PATTERN = /(^|[^a-z0-9])costing(?![a-z0-9])/i;

/** True when migration SQL references Costing-owned database objects (schema, table, view, function, role). */
export function sqlTouchesCosting(sql) {
  return COSTING_SQL_PATTERN.test(String(sql || ""));
}

const lines = (text) => String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);

function makeReaders({ git, root, base }) {
  const readHead = (rel) => {
    try { return fs.readFileSync(path.join(root, rel), "utf8"); } catch { return null; }
  };
  const readBase = (rel) => {
    try { return git("show", `${base}:${rel}`); } catch { return null; }
  };
  return { readHead, readBase };
}

/** Resolve a stylesheet/link reference found in `fromRel` to a repo-relative path. */
function resolveRef(fromRel, ref) {
  if (!ref || /^(https?:)?\/\//i.test(ref) || ref.startsWith("data:")) return null;
  const clean = ref.split(/[?#]/)[0];
  const joined = clean.startsWith("/") ? path.posix.join("public", clean) : path.posix.join(path.posix.dirname(fromRel), clean);
  return path.posix.normalize(joined);
}

function cssImports(rel, text) {
  return [...String(text || "").matchAll(/@import\s+(?:url\()?["']?([^"')\s;]+)["']?\)?/g)].map((m) => resolveRef(rel, m[1])).filter(Boolean);
}

function linkedStylesheets(rel, html) {
  return [...String(html || "").matchAll(/<link\b[^>]*href=["']([^"']+\.css(?:[?#][^"']*)?)["'][^>]*>/gi)].map((m) => resolveRef(rel, m[1])).filter(Boolean);
}

/** Every repo path the Costing scope protects for HTML. */
export function costingHtmlScope({ git, base }) {
  const tracked = new Set([...lines(git("ls-files", "--", "public/shared/*.html")), ...lines(git("ls-tree", "-r", "--name-only", base, "--", "public/shared/"))]);
  const out = new Set(COSTING_HTML_FILES);
  for (const f of tracked) if (COSTING_HTML_PATTERN.test(f)) out.add(f);
  return [...out].sort();
}

/** Every repo path the Costing scope protects for CSS (Costing styles, Costing page links, shared @import chain). */
export function costingCssScope({ git, root, base }) {
  const { readHead, readBase } = makeReaders({ git, root, base });
  const out = new Set();
  const queue = [SHARED_STYLE_ROOT];
  for (const page of costingHtmlScope({ git, base })) {
    for (const text of [readHead(page), readBase(page)]) for (const css of linkedStylesheets(page, text)) queue.push(css);
  }
  const tracked = [...lines(git("ls-files", "--", "*.css")), ...lines(git("ls-tree", "-r", "--name-only", base, "--", "public/"))];
  for (const f of tracked) if (COSTING_CSS_PATTERN.test(f)) queue.push(f);
  while (queue.length) {
    const rel = queue.shift();
    if (!rel || out.has(rel)) continue;
    out.add(rel);
    for (const text of [readHead(rel), readBase(rel)]) for (const imp of cssImports(rel, text)) if (!out.has(imp)) queue.push(imp);
  }
  return [...out].sort();
}

/** Paths in `scope` whose content differs from `base` (working tree vs base, like `git diff base`). */
export function changedInScope({ git, base, scope }) {
  if (!scope.length) return [];
  return lines(git("diff", "--name-only", base, "--", ...scope)).sort();
}

/** Supabase changes that touch Costing or rewrite history. Returns human-readable violation strings. */
export function supabaseCostingViolations({ git, root, base }) {
  const { readHead } = makeReaders({ git, root, base });
  const out = [];
  for (const row of lines(git("diff", "--name-status", "--no-renames", base, "--", "supabase/"))) {
    const [status, file] = row.split(/\t/);
    if (status !== "A") { out.push(`${status} ${file}: existing supabase/ files are immutable for Costing packages`); continue; }
    if (!file.startsWith("supabase/migrations/")) { out.push(`A ${file}: change outside supabase/migrations/`); continue; }
    const sql = readHead(file) || "";
    if (sqlTouchesCosting(sql)) out.push(`A ${file}: added migration touches costing`);
  }
  return out;
}

// CW-07 (Cost Sheet terminology): the Cost Sheet screen has no approval action, so its user-facing name changed
// from "Cost Sheet Review & Approval" to "Cost Sheet Review". These are the ONLY text differences the historical
// "Costing files unchanged" package tests tolerate for that rename: they apply the rename to the base text before
// comparing, so any other change to those files is still detected. Identifiers (module key, permission target,
// route path, lens ids) are intentionally absent: they must never change.
export const CW07_LABEL_CHANGES = Object.freeze([
  ["<title>Cost Sheet Review &amp; Approval</title>", "<title>Cost Sheet Review</title>"],
  ['<h1 class="sasv-module-title">Cost Sheet Review &amp; Approval</h1>', '<h1 class="sasv-module-title">Cost Sheet Review</h1>'],
  ["SKU cost details, printable cost sheets, monthly comparison, and\n            approval support", "SKU cost details, printable cost sheets, snapshot comparison, scheme\n            viability, QC and Materials / Stores action queues"],
  ['title: "Cost Sheet Review & Approval",', 'title: "Cost Sheet Review",'],
  ['label: "Cost Sheet Review & Approval",', 'label: "Cost Sheet Review",'],
  ['source_module_label: "Cost Sheet Review & Approval",', 'source_module_label: "Cost Sheet Review",'],
  ['"Scheme Comparison is now available under Cost Sheet Review & Approval.",', '"Scheme Comparison is now available under Cost Sheet Review.",'],
]);

/** Base text with the CW-07 label rename applied (LF-normalised). Files without those strings are unchanged. */
export function applyCw07Labels(text) {
  let out = String(text ?? "").replace(/\r\n/g, "\n");
  for (const [from, to] of CW07_LABEL_CHANGES) out = out.split(from).join(to);
  return out;
}

/** True when `rel` differs from `base` only by the CW-07 label rename. */
export function isCw07LabelOnlyChange({ git, root, base, rel }) {
  const { readHead, readBase } = makeReaders({ git, root, base });
  const head = readHead(rel);
  const before = readBase(rel);
  if (head === null || before === null) return false;
  return head.replace(/\r\n/g, "\n") === applyCw07Labels(before);
}

const withoutCw07LabelOnly = (paths, ctx) => paths.filter((rel) => !isCw07LabelOnlyChange({ ...ctx, rel }));

/** One-call summary used by the package tests. */
export function costingScopeReport({ git, root, base }) {
  const htmlScope = costingHtmlScope({ git, base });
  const cssScope = costingCssScope({ git, root, base });
  const ctx = { git, root, base };
  return {
    htmlScope,
    cssScope,
    html: withoutCw07LabelOnly(changedInScope({ git, base, scope: htmlScope }), ctx),
    css: changedInScope({ git, base, scope: cssScope }),
    supabase: supabaseCostingViolations({ git, root, base }),
    packageJson: changedInScope({ git, base, scope: ["package.json"] }),
  };
}
