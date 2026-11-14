#!/usr/bin/env node
/**
 * PEC R12 — SAFE-resync collision UX regression (fixture based).
 * NOT owner acceptance, NOT a genuine-session test, NOT a security oracle: the
 * synthetic stub only proves client behaviour. The server is the authority.
 *   node scripts/pec-r12-resync-collision-ux-smoke.mjs [--shots <dir>]
 * Covers: 5-lens navigation at 375px and 1280px, collision list + SAFE blocked
 * remediation, RESET destructive acknowledgement, unavailable preview contract,
 * never-invent-data, view-only/no-access negative + disabled controls, 375px modal.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildFixtureStub } from "./lib/pec-fixture-stub.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "public");
const si = process.argv.indexOf("--shots");
const shots = si > 0 ? path.resolve(process.argv[si + 1]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let failures = 0;
const check = (ok, m) => { if (!ok) { failures++; console.error("FAIL:", m); } else console.log("ok  :", m); };
const NARROW = { width: 375, height: 760 }, WIDE = { width: 1280, height: 850 };
const PREVIEW_BLOCKED = { eligible: true, reason: null, blocked: true,
  collisions: [{ indent_line_id: 1, stock_item_id: 13, item_name: "Synthetic <b>Item</b> 13", uom_code: "KG", indent_qty: 8, indent_reason: "manual but PR identity exists", pr_qty: 4, pr_reason: "PR 13", differs_qty: true, differs_reason: true }],
  reset_consequence_delete_all_lines: 5, reset_consequence_manual_lines_lost: 2 };
const PREVIEW_CLEAN = { eligible: true, reason: null, blocked: false, collisions: [], reset_consequence_delete_all_lines: 3, reset_consequence_manual_lines_lost: 1 };
const COLLISION_ERR = { message: "SAFE resync manual/PR quantity or reason collision; explicit resolution required", code: "23514" };

async function open(S, vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: buildFixtureStub(S) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const goTab = async (page, vp, tab) => { if (vp.width <= 520) await page.selectOption("#procTabSelect", tab); else await page.click(`.tabs .tab-btn[data-tab="${tab}"]`); await page.waitForTimeout(500); };
const openDraftPrLinked = async (page) => { await page.fill("#iSearch", "IND-26-0005"); await page.waitForTimeout(700); await page.click("#iTbody tr"); await page.waitForTimeout(700); };
const openResync = async (page, id) => { await page.click("#btnIndentResyncMenu"); await page.click(id); await page.waitForTimeout(600); };
const rpcCount = (page, n) => page.evaluate((x) => globalThis.__rpcCalls.filter((c) => c.name === x).length, n);
const hOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const vp of [NARROW, WIDE]) {
  const tag = vp.width + "px";
  // ---- 5-lens navigation smoke
  {
    const { ctx, page, errors } = await open({ role: "edit", r2: true }, vp);
    for (const t of ["pr", "indents", "vendor-buylist", "action", "excess"]) {
      await goTab(page, vp, t);
      check(await page.evaluate((x) => document.getElementById("tab-" + x)?.classList.contains("active"), t), `${tag}: lens ${t} activates`);
    }
    check(errors.length === 0, `${tag}: no page errors during 5-lens navigation (${errors[0] || ""})`);
    await ctx.close();
  }
  // ---- SAFE blocked: preview lists conflict, SAFE disabled, nothing written, escaped content
  {
    const { ctx, page } = await open({ role: "edit", r2: true, preview: PREVIEW_BLOCKED }, vp);
    await goTab(page, vp, "indents"); await openDraftPrLinked(page); await openResync(page, "#btnIndentResyncSafe");
    const txt = await page.textContent("#indentResyncPreview");
    check(/1 conflicting manual line/.test(txt) && /manual but PR identity exists/.test(txt) && /PR 13/.test(txt), `${tag}: preview shows indent and PR quantity/reason`);
    check(await page.$eval("#btnIndentResyncConfirm", (b) => b.disabled), `${tag}: SAFE confirm disabled while conflicts exist`);
    check(!(await page.$("#indentResyncPreview b")), `${tag}: item name from server is HTML-escaped`);
    check(await rpcCount(page, "proc_indent_resync_from_pr") === 0, `${tag}: opening preview performs no resync`);
    check(await page.$eval("#indentResyncResetAckRow", (e) => e.hidden), `${tag}: no destructive acknowledgement in SAFE mode`);
    check((await hOverflow(page)) <= 0, `${tag}: modal causes no horizontal page overflow`);
    const box = await page.$eval("#indentResyncModalBackdrop .modal", (m) => { const r = m.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    check(box.l >= 0 && box.r <= box.w, `${tag}: modal fits viewport`);
    if (shots) await page.screenshot({ path: path.join(shots, `resync-safe-blocked-${vp.width}.png`) });
    await ctx.close();
  }
  // ---- server collision on SAFE (stale/no preview): clear remediation, modal stays, no success
  {
    const { ctx, page } = await open({ role: "edit", r2: true, preview: PREVIEW_CLEAN, resyncError: COLLISION_ERR }, vp);
    await goTab(page, vp, "indents"); await openDraftPrLinked(page); await openResync(page, "#btnIndentResyncSafe");
    check(!(await page.$eval("#btnIndentResyncConfirm", (b) => b.disabled)), `${tag}: SAFE enabled when preview shows no conflict`);
    await page.click("#btnIndentResyncConfirm"); await page.waitForTimeout(600);
    const c = await page.textContent("#indentResyncConflict");
    check(/blocked and nothing was changed/.test(c) && /Full \(destructive reset\)/.test(c), `${tag}: server collision shown with remediation`);
    check(await page.$eval("#indentResyncModalBackdrop", (e) => e.classList.contains("show")), `${tag}: modal stays open after rejection`);
    check(!(await page.evaluate(() => /Indent resynced/.test(document.body.innerText))), `${tag}: no success toast on rejection`);
    await ctx.close();
  }
  // ---- RESET: explicit destructive confirmation enumerating its effect
  {
    const { ctx, page } = await open({ role: "edit", r2: true, preview: PREVIEW_BLOCKED }, vp);
    await goTab(page, vp, "indents"); await openDraftPrLinked(page); await openResync(page, "#btnIndentResyncFull");
    const t = await page.textContent("#indentResyncPreview");
    check(/deletes all 5 current line/.test(t) && /2 manual\/unmapped line/.test(t), `${tag}: RESET enumerates lines and manual lines deleted`);
    check(await page.$eval("#btnIndentResyncConfirm", (b) => b.disabled), `${tag}: RESET disabled until acknowledged`);
    await page.evaluate(() => document.getElementById("btnIndentResyncConfirm").click()); // disabled button: must not fire
    check(await rpcCount(page, "proc_indent_resync_from_pr") === 0, `${tag}: RESET RPC not sent without acknowledgement`);
    await page.check("#indentResyncResetAck");
    check(!(await page.$eval("#btnIndentResyncConfirm", (b) => b.disabled)), `${tag}: RESET enabled after acknowledgement`);
    check(/destructive/i.test(await page.textContent("#btnIndentResyncConfirm")), `${tag}: RESET button labelled destructive`);
    if (shots) await page.screenshot({ path: path.join(shots, `resync-reset-confirm-${vp.width}.png`) });
    await page.click("#btnIndentResyncConfirm"); await page.waitForTimeout(500);
    const calls = await page.evaluate(() => globalThis.__rpcCalls.filter((c) => c.name === "proc_indent_resync_from_pr").map((c) => c.params.p_mode));
    check(calls.length === 1 && calls[0] === "reset", `${tag}: exactly one explicit reset call after acknowledgement`);
    await ctx.close();
  }
}
// ---- preview contract unavailable / never invent data (default stub returns [] for unknown RPCs)
{
  const { ctx, page } = await open({ role: "edit", r2: true }, NARROW);
  await goTab(page, NARROW, "indents"); await openDraftPrLinked(page); await openResync(page, "#btnIndentResyncSafe");
  const t = await page.textContent("#indentResyncPreview");
  check(/not available on this server version/.test(t) && !/conflicting manual line/.test(t), "unavailable preview says so and invents nothing");
  check(!(await page.$eval("#btnIndentResyncConfirm", (b) => b.disabled)), "SAFE stays usable when preview contract absent (server remains authority)");
  await ctx.close();
}
{
  const { ctx, page } = await open({ role: "edit", r2: true, previewError: { message: "Could not find the function public.proc_indent_resync_collision_preview", code: "PGRST202", status: 404 } }, NARROW);
  await goTab(page, NARROW, "indents"); await openDraftPrLinked(page); await openResync(page, "#btnIndentResyncSafe");
  check(/not available on this server version/.test(await page.textContent("#indentResyncPreview")), "PGRST202 handled as unavailable");
  await ctx.close();
}
{
  const { ctx, page } = await open({ role: "edit", r2: true, previewError: { message: "Permission denied for module:procurement-execution-console", code: "P0001" } }, NARROW);
  await goTab(page, NARROW, "indents"); await openDraftPrLinked(page); await openResync(page, "#btnIndentResyncSafe");
  check(/do not have permission/.test(await page.textContent("#indentResyncPreview")), "server permission denial shown, no data rendered");
  await ctx.close();
}
// ---- permission negative: view-only and no-access never see/execute writer action
{
  const { ctx, page } = await open({ role: "view", r2: true, preview: PREVIEW_BLOCKED }, WIDE);
  await goTab(page, WIDE, "indents"); await openDraftPrLinked(page);
  const menu = await page.$("#btnIndentResyncMenu");
  const disabled = !menu || (await menu.evaluate((b) => b.disabled || b.getAttribute("aria-disabled") === "true" || b.offsetParent === null));
  check(disabled, "view-only: Resync menu disabled/hidden");
  // Tampered DOM (controls force-enabled then clicked): the client permission guard itself must refuse.
  await page.evaluate(() => { for (const id of ["btnIndentResyncSafe", "btnIndentResyncFull", "btnIndentResyncConfirm"]) { const b = document.getElementById(id); if (b) { b.disabled = false; b.hidden = false; b.click(); } } });
  await page.waitForTimeout(300);
  check(!(await page.$eval("#indentResyncModalBackdrop", (e) => e.classList.contains("show"))), "view-only: resync modal cannot be opened");
  check(await rpcCount(page, "proc_indent_resync_collision_preview") === 0 && await rpcCount(page, "proc_indent_resync_from_pr") === 0, "view-only: no preview or writer RPC issued");
  const ed = await page.$$eval("[data-edit-action='true']", (els) => els.filter((e) => ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(e.tagName) && e.offsetParent !== null).every((e) => e.disabled));
  check(ed, "view-only: every visible marked edit control is disabled");
  await ctx.close();
}
{
  const { ctx, page } = await open({ role: "none", r2: true, preview: PREVIEW_BLOCKED }, WIDE);
  check(!(await page.$eval("#mainPanel", (e) => e.offsetParent !== null).catch(() => false)), "no-access: PEC panel hidden");
  check(await rpcCount(page, "proc_indent_resync_collision_preview") === 0 && await rpcCount(page, "proc_indent_resync_from_pr") === 0, "no-access: no resync RPC issued");
  await ctx.close();
}
await browser.close(); server.close();
console.log(failures ? `\n${failures} FAILURE(S)` : "\nPEC_R12_RESYNC_COLLISION_UX_SMOKE_PASS");
process.exit(failures ? 1 : 0);
