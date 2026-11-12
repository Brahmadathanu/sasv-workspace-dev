#!/usr/bin/env node
/**
 * PEC-C1 five-lens fast-track regression (12 Nov 2026).
 * Covers: control inventory gate, truthful server-guard messages, resync copy
 * and error surfacing. Synthetic fixtures only; not signed-in acceptance.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { PAGED_SHIM } from "./lib/pec-paged-shim.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "public");
let failures = 0;
const check = (ok, m) => { if (!ok) { failures++; console.error("FAIL:", m); } else console.log("ok  :", m); };

// 1. Inventory gate: no unnamed control / bad dialog in reachable UI
try { execFileSync("node", [path.join(here, "pec-five-lens-inventory.mjs")], { stdio: "pipe" }); check(true, "control inventory: 0 FAIL rows (every reachable control named, dialogs labelled)"); }
catch (e) { check(false, "control inventory FAIL rows:\n" + String(e.stdout).split("\n").filter((l) => l.includes("| FAIL ")).join("\n")); }

// 2. Server-guard message mapping (function extracted from the shared source)
const src = fs.readFileSync(path.join(root, "shared/js/procurement-execution-console.js"), "utf8");
const start = src.indexOf("function mapPecServerGuardMessage");
const end = src.indexOf("function mapIndentLineSaveError");
const fn = new Function(`${src.slice(start, end)}\nreturn { mapPecServerGuardMessage, pecWriterErrorText };`)();
const cases = [
  ["New or increased external procurement indent quantity is prohibited for internal finished-bulk/semi-finished stock item 12", /internal finished-bulk or semi-finished/],
  ["No eligible positive external-procurement PR lines to create an indent", /no purchasable lines/],
  ["Resync allowed only for draft indents (status=approved)", /only for draft indents/],
  ["Source PR must be active to resync (status=draft)", /source PR must be active/],
  ["Indent has no source_pr_id set", /not linked to a source PR/],
  ["Invalid p_mode full. Use safe or reset", /did not recognise the resync mode/],
  ["Rebuild allowed only for draft PRs (current status=active)", /only for draft PRs/],
  ["Revision can be created only from active PR (status=draft)", /only from an active PR/],
  ["PR is not editable in status active", /can no longer be edited/],
  ["Reason is required to modify an indent in status approved", /reason is required/i],
  ["MRP UOM: missing or ambiguous factor (kg -> g)", /convert units/],
];
for (const [msg, re] of cases) check(re.test(fn.mapPecServerGuardMessage({ message: msg }) || ""), `guard mapping: ${msg.slice(0, 50)}…`);
check(fn.mapPecServerGuardMessage({ message: "something unrelated" }) === null, "unrelated errors are not re-worded");
check(fn.pecWriterErrorText("Create indent failed", { message: "boom" }) === "Create indent failed: boom", "fallback keeps original prefix + server text");

// 3. Browser: resync copy, success label, error surfacing
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const stub = (S) => `${PAGED_SHIM}
const S = ${JSON.stringify(S)};
const calls = (globalThis.__rpcCalls = []);
const mk = (d) => ({ data: d, error: null });
export const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: "f" } } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  rpc: async (name, params) => {
    calls.push({ name, params });
    const __r = __pagedRpc(name, params || {}, { indents: [{ indent_id: 200, indent_number: "IND-26-200", status: "draft", indent_date: "2026-11-10", approved_date: null, material_class_id: 1, material_class_code: "RM", line_count: 1, source_pr_id: 55 }], prs: [], excess: [], audit: [], vwl: [] });
    if (__r !== undefined) return mk(__r);
    if (name === "get_user_permissions") return mk([{ target: "module:procurement-execution-console", can_view: true, can_edit: true }]);
    if (name === "proc_pec_indent_headers") return mk([{ indent_id: 200, indent_number: "IND-26-200", status: "draft", indent_date: "2026-11-10", approved_date: null, material_class_id: 1, material_class_code: "RM", line_count: 1, source_pr_id: 55 }]);
    if (name === "proc_pec_indent_lines") return mk([]);
    if (name === "proc_indent_resync_from_pr") return S.resyncError ? { data: null, error: { message: S.resyncError } } : mk(null);
    return mk([]);
  },
  from: () => { const b = { select: () => b, eq: () => b, limit: () => b, order: () => b, in: () => b, ilike: () => b, then: (r) => r(mk([])) }; return b; },
  schema: () => ({ from: () => ({}) }),
};
export const labSupabase = supabase; export const hrSupabase = supabase; export const handleSupabaseError = (e) => e;
`;
const browser = await chromium.launch();
async function open(S) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: stub(S) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel:not([hidden])");
  await page.click('.tabs .tab-btn[data-tab="indents"]');
  await page.waitForSelector("#iTbody tr");
  await page.click("#iTbody tr");
  await page.waitForTimeout(500);
  return { ctx, page };
}
const toasts = (p) => p.$$eval("#toastContainer > div", (n) => n.map((e) => e.textContent));
for (const [label, btn, re] of [["Safe", "#btnIndentResyncSafe", /manual lines you added are kept/i], ["Full", "#btnIndentResyncFull", /manual lines you added are removed/i]]) {
  const { ctx, page } = await open({});
  await page.click("#btnIndentResyncMenu");
  await page.click(btn);
  await page.waitForSelector("#indentResyncModalBackdrop.show");
  check(re.test(await page.textContent("#indentResyncModeText")), `resync ${label}: copy states what happens to manual lines`);
  check(/Draft indents only/.test(await page.textContent("#indentResyncModalBackdrop")), `resync ${label}: draft-only / active-source-PR note shown`);
  await page.click("#btnIndentResyncConfirm");
  await page.waitForTimeout(600);
  check((await toasts(page)).some((t) => t.includes(`Indent resynced (${label})`)), `resync ${label}: success toast uses UI label`);
  check((await page.evaluate(() => globalThis.__rpcCalls.filter((c) => c.name === "proc_indent_resync_from_pr").length)) === 1, `resync ${label}: one RPC`);
  await ctx.close();
}
{
  const { ctx, page } = await open({ resyncError: "Source PR must be active to resync (status=draft)" });
  await page.click("#btnIndentResyncMenu");
  await page.click("#btnIndentResyncSafe");
  await page.click("#btnIndentResyncConfirm");
  await page.waitForTimeout(500);
  check((await toasts(page)).some((t) => /source PR must be active before this indent can be resynced/i.test(t)), "resync server rejection surfaced in plain language");
  await ctx.close();
}
await browser.close();
server.close();
if (failures) { console.error(`pec-c1-five-lens-fasttrack-smoke: ${failures} FAILED`); process.exit(1); }
console.log("pec-c1-five-lens-fasttrack-smoke: PASS");
