#!/usr/bin/env node
// Client <-> server contract for proc_indent_resync_collision_preview.
// Every field the shared client reads must be produced by the proposed server function,
// the RPC/param names must match, and the same JS file must be what PWA and Electron ship.
// When the server migration is not on this branch the contract part is reported SKIPPED
// (never PASS) and it becomes mandatory on the integrated tree.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const js = fs.readFileSync(path.join(root, "public/shared/js/procurement-execution-console.js"), "utf8");
const migDir = path.join(root, "supabase/migrations");
const mig = fs.readdirSync(migDir).find((f) => /_pec_safe_resync_collision_preview_ro\.sql$/.test(f));

const block = (start, end) => { const a = js.indexOf(start); const b = js.indexOf(end, a); assert.ok(a > 0 && b > a, "client block " + start); return js.slice(a, b); };
const render = block("function renderIndentResyncPreview()", "async function loadIndentResyncPreview");
const loader = block("async function loadIndentResyncPreview", "function openIndentResyncModal");

test("client calls the contract name with the contract parameter", () => {
  assert.match(loader, /supabase\.rpc\("proc_indent_resync_collision_preview", \{ p_indent_id: indent\.indent_id \}\)/);
});

test("every field the client renders exists in the server's jsonb output", { skip: !mig && "SKIPPED: server migration not on this branch (mandatory on the integrated tree)" }, () => {
  const sql = fs.readFileSync(path.join(migDir, mig), "utf8").replace(/\r/g, "");
  assert.match(sql, /proc_indent_resync_collision_preview\(p_indent_id bigint\)/);
  const top = new Set([...sql.matchAll(/'([a-z_]+)',/g)].map((m) => m[1]));
  const clientTop = [...render.matchAll(/\bdata(?:\?)?\.([a-z_]+)/g)].map((m) => m[1]);
  for (const k of new Set(clientTop)) assert.ok(top.has(k), "client reads data." + k + " but the server never returns it");
  const clientRow = [...render.matchAll(/\bc\.([a-z_]+)/g)].map((m) => m[1]);
  for (const k of new Set(clientRow)) assert.ok(top.has(k), "client reads collision field " + k + " but the server never returns it");
  // ineligibility reasons the client words must be the ones the server can emit
  for (const r of ["not_draft", "no_source_pr", "source_pr_not_active"]) {
    assert.ok(sql.includes("'" + r + "'"), "server never emits reason " + r);
    assert.ok(render.includes(r), "client has no wording for reason " + r);
  }
  // advisory read-only function: no write statements, permission first, correct ACL
  assert.doesNotMatch(sql.split("$function$")[1] || "", /\b(insert\s+into|update\s+public|delete\s+from)\b/i);
  assert.match(sql, /require_permission\('module:procurement-execution-console', false\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.proc_indent_resync_collision_preview\(bigint\) FROM PUBLIC, anon;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.proc_indent_resync_collision_preview\(bigint\) TO authenticated, service_role;/);
});

test("PWA and Electron share one PEC source (no duplicate client copies)", () => {
  const names = ["procurement-execution-console.html", "procurement-execution-console.js", "sasv-procurement-execution-console.css"];
  const found = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(e.name)) continue;
    const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (names.includes(e.name)) found.push(path.relative(root, p)); } };
  walk(root);
  assert.deepEqual(found.sort(), [
    "public/shared/css/sasv-procurement-execution-console.css",
    "public/shared/js/procurement-execution-console.js",
    "public/shared/procurement-execution-console.html",
  ], "exactly one canonical copy of each PEC client file");
  const main = fs.readFileSync(path.join(root, "main.js"), "utf8");
  assert.match(main, /express\.static/, "Electron serves the repo tree statically (same files)");
});
