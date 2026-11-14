#!/usr/bin/env node
/**
 * PEC server-paging integration regression (client side of draft server PR #323).
 * Real shared module in Chromium; js/supabaseClient.js is replaced by a
 * synthetic stub that emulates the paged read contracts (scripts/lib/pec-paged-shim.mjs)
 * over LARGE fixtures. Proves the CLIENT maps filters/pages/totals/latest-wins
 * correctly; it does NOT prove the live backend or any real account.
 *
 * Usage: node scripts/pec-paging-contract-smoke.mjs [--shots <dir>]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { PAGED_SHIM } from "./lib/pec-paged-shim.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const si = process.argv.indexOf("--shots");
const shotsDir = si > 0 ? path.resolve(process.argv[si + 1]) : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

import { buildFixtureStub } from "./lib/pec-fixture-stub.mjs";
const stub = buildFixtureStub;

const browser = await chromium.launch();
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error("FAIL:", msg); } else console.log("ok  :", msg); };
const LEGACY = new Set(["proc_pec_pr_headers", "proc_pec_indent_headers", "proc_pec_purchase_excess", "proc_pec_excess_acceptance_audit"]);

async function open(S, tab, vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  if (S.badges) await page.addInitScript(() => { const add = () => { if (!document.body) return false; for (const id of ["tabCountPr", "tabCountIndents", "tabCountExcess"]) { if (document.getElementById(id)) continue; const s = document.createElement("span"); s.id = id; s.style.display = "none"; document.body.appendChild(s); } return true; }; const mo = new MutationObserver(() => { if (add()) mo.disconnect(); }); mo.observe(document, { childList: true, subtree: true }); });
  await page.route("**/js/supabaseClient.js", (r) => r.fulfill({ contentType: "text/javascript", body: stub(S) }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.goto(`${base}/shared/procurement-execution-console.html`);
  await page.waitForSelector("#mainPanel:not([hidden])", { timeout: 8000 });
  await page.waitForTimeout(300);
  if (tab !== "pr") await page.click(`.tabs .tab-btn[data-tab="${tab}"]`);
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
const calls = (page, name) => page.evaluate((n) => globalThis.__rpcCalls.filter((c) => c.name === n), name);
// ignore the 1-row tab-count probes (p_limit 1) when asserting the table load
const last = async (page, name) => { const c = (await calls(page, name)).filter((x) => x.params.p_limit !== 1); return c[c.length - 1]; };
const text = (page, sel) => page.textContent(sel).then((t) => t.replace(/\s+/g, " ").trim());


// ───────── R2 helpers: incremental feed (no numbered pagers) ─────────
const scrollEnd = (page, id) => page.evaluate((i) => { const e = document.getElementById(i); e.scrollTop = e.scrollHeight; }, id);
const footer = (page, id) => page.evaluate((i) => { const f = document.querySelector(`#${i} .pec-feed-footer`); return f ? { text: f.querySelector(".pec-feed-status").textContent.trim(), btn: !f.querySelector("button").hidden ? f.querySelector("button").textContent.trim() : "", hidden: f.hidden } : null; }, id);
const rowCount = (page, tb) => page.$$eval(`#${tb} tr:not(.pec-table-state-row)`, (n) => n.length);

// ───────── PR ─────────
{
  const { ctx, page, errors } = await open({ role: "edit" }, "pr");
  const name = "proc_pec_pr_headers_filtered_paged";
  let c = await last(page, name);
  check(c && c.params.p_limit === 30 && c.params.p_offset === 0 && c.params.p_status === null, "PR: first page requested with limit 30/offset 0, no filters");
  check((await rowCount(page, "prTbody")) === 30, "PR: first 30 of 230 rows rendered (not the whole table)");
  check((await text(page, "#prMeta")) === "230 PRs", "PR: exact count from total_count right of the lens title");
  check((await page.locator("#prBtnPrev, #prBtnNext, #prPaging").count()) === 0, "PR: no numbered pagination controls in the DOM");
  const ids = async () => page.$$eval("#prTbody tr td:first-child", (n) => n.map((e) => e.textContent.trim()));
  let f = await footer(page, "prScroll");
  check(f && /Showing 30 of 230/.test(f.text) && f.btn === "Load more", `PR: accessible footer "${f?.text}" with a Load more button`);
  const p1 = await ids();
  check(p1[0] === "PR-0230", "PR: descending ID order from server");
  await scrollEnd(page, "prScroll"); await page.waitForTimeout(600);
  c = await last(page, name);
  const p2 = await ids();
  check(c.params.p_offset === 30 && p2.length === 60 && new Set(p2).size === 60 && p2[30] === "PR-0200", "PR: scrolling near the bottom appends page 2 (offset 30), no duplicates, order continues");
  await page.focus("#prScroll .pec-load-more"); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  check((await rowCount(page, "prTbody")) === 90, "PR: keyboard activation of Load more loads the next page");
  await page.fill("#prSearch", "PR-0007"); await page.waitForTimeout(700);
  c = await last(page, name);
  check(c.params.p_q === "PR-0007" && c.params.p_offset === 0 && (await page.evaluate(() => document.getElementById("prScroll").scrollTop)) === 0, "PR: search resets the feed to offset 0 and scroll to top");
  check((await ids()).join() === "PR-0007", "PR: match located beyond the loaded rows is found (server-side filter)");
  f = await footer(page, "prScroll");
  check(f && /End of list/.test(f.text) && f.btn === "", "PR: end-of-list status, no Load more when everything is loaded");
  await page.fill("#prSearch", ""); await page.waitForTimeout(500);
  await page.click("#prFilterBtn"); await page.selectOption("#prFilterStatus", "active"); await page.waitForTimeout(500);
  c = await last(page, name);
  check(c.params.p_status === "active" && c.params.p_offset === 0 && (await text(page, "#prMeta")) === "58 PRs", "PR: status filter mapped to p_status, feed reset, total from server (58)");
  await page.fill("#prSearch", "ZZZ-NOMATCH"); await page.waitForTimeout(700);
  check((await page.locator("#tab-pr td.pec-table-state.is-empty").count()) === 1 && (await text(page, "#prMeta")) === "0 PRs", "PR: no-match filtered result shows empty state (0 PRs)");
  const legacy = await page.evaluate((L) => globalThis.__rpcCalls.filter((c) => L.includes(c.name)).map((c) => c.name), [...LEGACY]);
  check(legacy.length === 0, `PR/Indent/Excess/Audit never call the full-read RPCs (${legacy.join(",") || "none"})`);
  check(errors.length === 0, `PR: no page errors ${errors.join("|")}`);
  await ctx.close();
}

// ───────── Shrinking data / end of list (PR) ─────────
{
  const { ctx, page } = await open({ role: "edit" }, "pr");
  await page.evaluate(() => globalThis.__setCounts(250, 35)); // 35 PRs now exist server-side
  for (let i = 0; i < 3; i++) { await scrollEnd(page, "prScroll"); await page.waitForTimeout(500); }
  const n = await rowCount(page, "prTbody");
  const f = await footer(page, "prScroll");
  check(n === 35 && /End of list/.test(f.text), `PR: when the server total shrinks the feed ends cleanly (${n} rows, "${f.text}")`);
  check((await page.locator("#tab-pr td.pec-table-state.is-error").count()) === 0, "PR: shrinking data is not reported as an error");
  await ctx.close();
}

// ───────── Indents ─────────
{
  const { ctx, page } = await open({ role: "edit" }, "indents");
  const name = "proc_pec_indent_headers_filtered_paged";
  let c = await last(page, name);
  check(c.params.p_limit === 30 && c.params.p_offset === 0, "Indents: first page 30/0");
  check((await text(page, "#iMeta")) === "250 indents" && (await page.locator("#iBtnPrev, #iBtnNext, #iPaging").count()) === 0, "Indents: exact count, no numbered pager");
  await scrollEnd(page, "iScroll"); await page.waitForTimeout(600);
  check((await last(page, name)).params.p_offset === 30 && (await rowCount(page, "iTbody")) === 60, "Indents: scroll appends offset 30");
  await page.click("#iFilterBtn"); await page.selectOption("#iStatus", "approved"); await page.waitForTimeout(500);
  c = await last(page, name);
  check(c.params.p_status === "approved" && c.params.p_offset === 0 && (await text(page, "#iMeta")) === "83 indents" && (await rowCount(page, "iTbody")) === 30, "Indents: status filter server-side (83 approved of 250); feed reset to first page of 30");
  await page.selectOption("#iClass", "2"); await page.waitForTimeout(500);
  c = await last(page, name);
  check(c.params.p_material_class_id === 2, "Indents: material class sent as numeric id");
  await page.selectOption("#iStatus", ""); await page.selectOption("#iClass", ""); await page.waitForTimeout(400);
  await page.fill("#iSearch", "0123"); await page.waitForTimeout(700);
  check((await page.$$eval("#iTbody tr td:nth-child(2)", (n) => n.map((e) => e.textContent.trim()))).join() === "IND-26-0123", "Indents: search hit beyond first page via server");
  await page.fill("#iSearch", "nomatch-xyz"); await page.waitForTimeout(700);
  check((await page.locator("#tab-indents td.pec-table-state.is-empty").count()) === 1, "Indents: no-match → empty state");
  await ctx.close();
}

// ───────── Latest-wins under in-flight responses ─────────
{
  const { ctx, page } = await open({ role: "edit", slowSearch: "IND-26-001" }, "indents");
  await page.fill("#iSearch", "IND-26-001"); await page.waitForTimeout(350); // slow request fires (900 ms)
  await page.fill("#iSearch", "IND-26-0250"); await page.waitForTimeout(1500); // fast request finishes first; slow one lands after
  const rows = await page.$$eval("#iTbody tr td:nth-child(2)", (n) => n.map((e) => e.textContent.trim()));
  check(rows.join() === "IND-26-0250", `Indents: stale slow response never overwrites newer result (${rows.join()})`);
  check((await text(page, "#iMeta")) === "1 indent", "Indents: count/pager reflect the latest request only");
  await ctx.close();
}
{
  const { ctx, page } = await open({ role: "edit" }, "indents");
  // rapid tab toggling + filter change leaves a consistent final state, no sticky loading
  for (const t of ["pr", "indents", "excess", "indents"]) { await page.click(`.tabs .tab-btn[data-tab="${t}"]`); }
  await page.click("#iFilterBtn"); await page.selectOption("#iStatus", "approved");
  await page.waitForTimeout(1000);
  check((await text(page, "#iMeta")) === "83 indents", "rapid tab toggling + filter: final state correct");
  check((await page.$eval("#tab-indents", (e) => e.getAttribute("aria-busy"))) === "false" && (await page.$eval("#mainPanel", (e) => e.style.pointerEvents)) === "", "rapid toggling: no stuck loading state");
  await ctx.close();
}

// ───────── Excess ─────────
{
  const { ctx, page } = await open({ role: "edit" }, "excess");
  const name = "proc_pec_purchase_excess_filtered_paged";
  let c = await last(page, name);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dm = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  check(c.params.p_date_from === dm(30) && c.params.p_date_to === iso(new Date()), `Excess: default last-30-day ISO range sent (${c.params.p_date_from}..${c.params.p_date_to})`);
  const total30 = Number((await text(page, "#eMeta")).match(/^(\d+) lines/)?.[1]);
  check((await text(page, "#eSummary")).includes("last 30 days"), "Excess: filter summary (last 30 days) shown separately from the count");
  const allRowsSample = await page.$$eval("#eTbody tr td:first-child div.muted", (n) => n.map((e) => e.textContent.trim()));
  check(total30 > 0 && total30 < 450 && allRowsSample.every((d) => d >= dm(30)), `Excess: 30-day filter applied by server (${total30} of 450); visible rows inside range`);
  check((await page.locator("#ePaging, #eBtnPrev, #eBtnNext").count()) === 0 && (await rowCount(page, "eTbody")) === 30, "Excess: first 30 rows, no numbered pager");
  await scrollEnd(page, "eScroll"); await page.waitForTimeout(600);
  const exRows = await page.$$eval("#eTbody tr td:first-child", (n) => n.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
  check(exRows.length === 60 && new Set(exRows).size === 60 && (await last(page, "proc_pec_purchase_excess_filtered_paged")).params.p_offset === 30, "Excess: scroll appends offset 30 with the same 30-day filter and no duplicate rows");
  // ordering: net unallocated desc then date desc
  const nets = await page.$$eval("#eTbody tr td:nth-child(8)", (n) => n.map((e) => Number(e.textContent.replace(/,/g, ""))));
  check(nets.every((v, i) => i === 0 || nets[i - 1] >= v), "Excess: server order net-unallocated descending retained (no client re-sort)");
  await page.click("#eFilterBtn");
  await page.selectOption("#eFDatePreset", "7d"); await page.waitForTimeout(700);
  c = await last(page, name);
  check(c.params.p_date_from === dm(7) && c.params.p_offset === 0, "Excess: 7-day preset changes server date range, page reset");
  await page.selectOption("#eFDatePreset", "fy"); await page.waitForTimeout(700);
  c = await last(page, name);
  check(c.params.p_date_from === dm(365), "Excess: 365-day preset sent");
  await page.fill("#eSearch", "Special"); await page.waitForTimeout(700);
  c = await last(page, name);
  check(c.params.p_q === "Special", "Excess: quick search sent as p_q");
  const specials = await page.$$eval("#eTbody tr td:nth-child(2)", (n) => n.every((e) => /Special/i.test(e.textContent)));
  check(specials && (await page.$$eval("#eTbody tr", (n) => n.length)) > 0, "Excess: search results all match (server-side)");
  await page.fill("#eSearch", "zzzz-none"); await page.waitForTimeout(700);
  check((await page.locator("#tab-excess td.pec-table-state.is-empty").count()) === 1, "Excess: no-match shows empty state");
  await ctx.close();
}

// ───────── Excess audit ─────────
{
  const { ctx, page } = await open({ role: "edit" }, "excess");
  await page.click("#eAuditBtn"); await page.waitForTimeout(600);
  let c = await last(page, "proc_pec_excess_acceptance_audit_paged");
  check(c.params.p_limit === 30 && c.params.p_offset === 0, "Audit: first page 30/0");
  check((await text(page, "#eAuditMeta")) === "250 lines" && (await page.locator("#eAuditBtnPrev, #eAuditBtnNext, #eAuditPaging").count()) === 0, "Audit: exact count, no numbered pager");
  await scrollEnd(page, "eAuditScroll"); await page.waitForTimeout(600);
  c = await last(page, "proc_pec_excess_acceptance_audit_paged");
  check(c.params.p_offset === 30 && (await rowCount(page, "eAuditTbody")) === 60, "Audit: scrolling inside the dialog appends offset 30");
  await ctx.close();
}

// ───────── Vendor-wise ─────────
{
  const { ctx, page } = await open({ role: "edit" }, "vendor-buylist");
  await page.waitForTimeout(500);
  const PAGED = "proc_vendorwise_buylist_operational_paged", OPTS = "proc_vendorwise_buylist_operational_options";
  let c = await last(page, PAGED);
  check(c.params.p_limit === 75 && c.params.p_offset === 0 && c.params.p_operational_filter === null, "VWL: first page 75/0, no operational filter");
  check((await text(page, "#vwlMeta")) === "500 lines" && (await rowCount(page, "vwlTbody")) === 75 && (await page.locator("#vwlPrev, #vwlNext, #vwlPaging").count()) === 0, "VWL: exact count, first 75 rows, no numbered pager");
  const optionLabels = async () => page.$$eval("#vwlVendorFilter option", (n) => n.map((o) => o.textContent.trim()));
  const labels = await optionLabels();
  const firstPageVendors = await page.$$eval("#vwlTbody tr td:first-child", (n) => n.map((e) => e.textContent));
  check(labels.some((l) => l.includes("ZZ Last Vendor")) && !firstPageVendors.some((t) => t.includes("ZZ Last Vendor")), "VWL: dropdown lists a vendor that exists only on a later page");
  check(labels.some((l) => /Local Purchase/.test(l)) && labels.some((l) => /UNASSIGNED/i.test(l)), "VWL: Local Purchase and UNASSIGNED buckets in options");
  check((await calls(page, OPTS)).length === 1, "VWL: options requested once for the initial upstream filters");
  await scrollEnd(page, "vwlScroll"); await page.waitForTimeout(600);
  check((await last(page, PAGED)).params.p_offset === 75 && (await calls(page, OPTS)).length === 1, "VWL: loading more does not refetch options");
  for (let i = 0; i < 7; i++) { await scrollEnd(page, "vwlScroll"); await page.waitForTimeout(450); }
  const lastRows = await page.$$eval("#vwlTbody tr td:first-child", (n) => n.map((e) => e.textContent.trim()));
  const vf = await footer(page, "vwlScroll");
  check(lastRows.length === 500 && /End of list/.test(vf.text) && /UNASSIGNED/i.test(lastRows[lastRows.length - 1]), `VWL: all 500 loaded incrementally, ends with UNASSIGNED (server order kept); footer "${vf.text}"`);
  // operational choice
  await page.click("#vwlFilterBtn");
  await page.selectOption("#vwlVendorFilter", "bucket:UNASSIGNED"); await page.waitForTimeout(600);
  c = await last(page, PAGED);
  check(c.params.p_operational_filter === "bucket:UNASSIGNED" && c.params.p_offset === 0, "VWL: bucket:UNASSIGNED sent as p_operational_filter, page reset");
  check((await calls(page, OPTS)).length === 1, "VWL: vendor choice does not refetch options");
  const optVal = await page.$$eval("#vwlVendorFilter option", (n) => n.map((o) => o.value).find((v) => /^vendor:/.test(v)));
  await page.selectOption("#vwlVendorFilter", optVal); await page.waitForTimeout(500);
  check((await last(page, PAGED)).params.p_operational_filter === optVal, `VWL: ${optVal} sent as vendor:<id> filter`);
  await page.selectOption("#vwlVendorFilter", "bucket:LOCAL_PURCHASE"); await page.waitForTimeout(500);
  check((await last(page, PAGED)).params.p_operational_filter === "bucket:LOCAL_PURCHASE", "VWL: bucket:LOCAL_PURCHASE filter sent");
  // upstream filter (search) refetches options and resets vendor choice if gone
  await page.fill("#vwlSearch", "VItem 0001"); await page.waitForTimeout(800);
  check((await calls(page, OPTS)).length === 2 && (await last(page, OPTS)).params.p_q === "VItem 0001", "VWL: search change refetches options with the same upstream filters");
  check((await last(page, PAGED)).params.p_q === "VItem 0001", "VWL: search sent to server");
  // legacy full read only for split-only
  const before = (await calls(page, "proc_vendorwise_buylist_filtered")).length;
  check(before === 0, "VWL: normal browsing never uses the full buylist read");
  await ctx.close();
}

// ───────── Vendor-wise exports use ALL rows ─────────
{
  const { ctx, page } = await open({ role: "edit" }, "vendor-buylist");
  await page.waitForTimeout(500);
  const download = async (btnSel) => {
    await page.click("#vwlExportBtn");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click(btnSel)]);
    return fs.readFileSync(await dl.path(), "utf8");
  };
  const csv = await download("#vwlExportCsv");
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  check(lines.length === 501, `Export CSV: all 500 matching rows + header, not the visible 75 (${lines.length} lines)`);
  const tsv = await download("#vwlExportTsv");
  check(tsv.split(/\r?\n/).filter((l) => l.trim()).length === 501, "Export TSV: all rows + header");
  check(lines.slice(1).every((l) => /IND-26-1\d\d \(\d\)/.test(l)), "Export: canonical 'Indent (line)' serial preserved");
  // with an operational filter the export covers every row of that choice only
  const vopt = await page.$$eval("#vwlVendorFilter option", (n) => n.map((o) => o.value).find((v) => /^vendor:/.test(v)));
  await page.click("#vwlFilterBtn");
  await page.selectOption("#vwlVendorFilter", vopt); await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  const shown = Number((await text(page, "#vwlMeta")).match(/^(\d+)/)[1]);
  const csv2 = await download("#vwlExportCsv");
  check(csv2.split(/\r?\n/).filter((l) => l.trim()).length - 1 === shown && shown < 500, `Export respects operational filter (${shown} rows, equals server total)`);
  await ctx.close();
}
{
  const { ctx, page } = await open({ role: "edit", hugeVwl: true }, "vendor-buylist");
  await page.waitForTimeout(800);
  await page.click("#vwlExportBtn");
  let downloaded = false;
  page.on("download", () => (downloaded = true));
  await page.click("#vwlExportCsv");
  await page.waitForTimeout(1500);
  const t = await page.$$eval("#toastContainer > div", (n) => n.map((e) => e.textContent).join(" | "));
  check(!downloaded && /safe limit of 50000/.test(t) && /nothing was truncated/.test(t), "Export: oversized export refused with explicit message, never silently truncated or reported complete");
  await ctx.close();
}


// ───────── Jump to Indent: page-independent ─────────
const toastsText = (page) => page.$$eval("#toastContainer > div", (n) => n.map((e) => e.textContent));
{
  const jumpFrom = async (page, k) => {
    await page.evaluate(() => document.querySelector('.tabs .tab-btn[data-tab="action"]').click());
    await page.waitForSelector("#aqTbody tr:not(.pec-table-state-row)", { timeout: 5000 });
    await page.evaluate((i) => document.querySelectorAll("#aqTbody tr")[i].click(), k);
    await page.waitForSelector("#detailModalBackdrop.show");
    await page.evaluate(() => document.getElementById("btnDetailJumpIndent").click());
  };
  const title = (page) => page.textContent("#iLinesTitle").then((t) => t.trim());
  {
    const { ctx, page } = await open({ role: "edit", aq: true }, "action");
    await jumpFrom(page, 0); await page.waitForTimeout(700);
    check((await title(page)) === "Lines — IND-26-0250" && (await page.isVisible("#indentViewModalBackdrop.show")), "Jump: first-page indent (#250) opens its modal");
    await page.evaluate(() => document.getElementById("btnIndentViewClose").click());
    await jumpFrom(page, 1); await page.waitForTimeout(700);
    const onPage0 = await page.$$eval("#iTbody tr td:nth-child(2)", (n) => n.map((e) => e.textContent.trim()));
    check(!onPage0.includes("IND-26-0200") && (await title(page)) === "Lines — IND-26-0200", "Jump: page-2 indent (#200, not on loaded page 0) opens by exact id");
    const paged = (await calls(page, "proc_pec_indent_headers_filtered_paged")).filter((c) => c.params.p_q === "IND-26-0200");
    check(paged.length >= 1 && paged[0].params.p_limit === 200, "Jump: resolved through the permission-gated paged lookup by number (no full read needed)");
    await page.evaluate(() => document.getElementById("btnIndentViewClose").click());
    const fullBefore = (await calls(page, "proc_pec_indent_headers")).length;
    await jumpFrom(page, 4); await page.waitForTimeout(900); // stale number, valid id -> fallback
    check((await title(page)) === "Lines — IND-26-0200" && (await calls(page, "proc_pec_indent_headers")).length > fullBefore, "Jump: number miss falls back to the existing full-header read and still opens the right indent");
    await page.evaluate(() => document.getElementById("btnIndentViewClose").click());
    await jumpFrom(page, 3); await page.waitForTimeout(900);
    check(!(await page.isVisible("#indentViewModalBackdrop.show")) && (await toastsText(page)).some((t) => /IND-26-9999 was not found or is not accessible/.test(t)), "Jump: nonexistent id shows a clear message and opens nothing");
    await ctx.close();
  }
  {
    // competing navigations: slow older jump must not hijack the newer one
    const { ctx, page } = await open({ role: "edit", aq: true, slowSearch: "IND-26-0200" }, "action");
    await jumpFrom(page, 1); // slow (900 ms)
    await page.waitForTimeout(150);
    await jumpFrom(page, 0); // fast, newer
    await page.waitForTimeout(1800);
    check((await title(page)) === "Lines — IND-26-0250", "Jump: stale slower navigation never replaces the newer one");
    await ctx.close();
  }
}

// ───────── Excess badge = active/default filters ─────────
{
  let expected30 = 0, expectedAll = 450;
  for (let i = 0; i < 450; i++) if (i % 120 <= 30) expected30++;
  // 0) current markup has no badge elements -> no invisible probe reads at boot
  const none = await open({ role: "edit" }, "pr");
  await none.page.waitForTimeout(800);
  check((await none.page.locator("#tabCountExcess, #tabCountPr, #tabCountIndents").count()) === 0 && (await calls(none.page, "proc_pec_purchase_excess_filtered_paged")).length === 0, "badges: none rendered in current markup and no wasted Excess count probe at boot");
  await none.ctx.close();
  // 1) if a badge element is present (emulated), its meaning is the ACTIVE-filter count
  const { ctx, page } = await open({ role: "edit", badges: true }, "pr");
  await page.waitForTimeout(800);
  check((await page.$eval("#tabCountExcess", (e) => e.textContent)) === String(expected30), `Excess badge at boot = default 30-day count (${expected30}), not the all-history ${expectedAll}`);
  const probe = await calls(page, "proc_pec_purchase_excess_filtered_paged");
  check(probe.length === 1 && probe[0].params.p_limit === 1 && probe[0].params.p_date_from !== null && probe[0].params.p_date_to !== null, "Excess badge probe sends the same date range as the lens");
  await page.click('.tabs .tab-btn[data-tab="excess"]'); await page.waitForTimeout(600);
  check((await text(page, "#eMeta")).startsWith(`${expected30} lines`) && (await text(page, "#tabCountExcess")) === String(expected30), "Excess lens total equals badge");
  await page.click("#eFilterBtn"); await page.selectOption("#eFDatePreset", "fy"); await page.waitForTimeout(700);
  check((await text(page, "#tabCountExcess")) === String(expectedAll), "Excess badge follows the date preset (365 days → all 450)");
  await page.fill("#eSearch", "Special"); await page.waitForTimeout(700);
  const specialTotal = (await text(page, "#tabCountExcess"));
  check(Number(specialTotal) > 0 && Number(specialTotal) < expectedAll && (await text(page, "#eMeta")).startsWith(`${specialTotal} lines`), "Excess badge follows the quick search");
  await ctx.close();
  const f = await open({ role: "edit", failPaged: true, badges: true }, "pr");
  await f.page.waitForTimeout(600);
  check((await text(f.page, "#tabCountExcess")) === "", "Excess badge stays empty (not a wrong number) when the read is denied/fails");
  await f.ctx.close();
}

// ───────── Vendor-wise export completeness beyond 1,000 rows ─────────
{
  const libs = process.env.PEC_JSPDF_ROOT;
  const { ctx, page } = await open({ role: "edit", vwlRows: 1500 }, "vendor-buylist");
  if (libs && fs.existsSync(path.join(libs, "jspdf/dist/jspdf.umd.min.js"))) {
    await page.route("**/jspdf.umd.min.js", (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(libs, "jspdf/dist/jspdf.umd.min.js")) }));
    await page.route("**/jspdf.plugin.autotable.min.js", (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(libs, "jspdf-autotable/dist/jspdf.plugin.autotable.min.js")) }));
    await page.reload(); await page.waitForSelector("#mainPanel:not([hidden])"); await page.click('.tabs .tab-btn[data-tab="vendor-buylist"]');
  }
  await page.waitForTimeout(800);
  const legacyLen = await page.evaluate(async () => { const { supabase } = await import("/shared/js/supabaseClient.js"); return (await supabase.rpc("proc_vendorwise_buylist_filtered", {})).data.length; });
  check(legacyLen === 1000, `transport check: the UNPAGED full RPC is silently capped at ${legacyLen} of 1500 (PostgREST max_rows emulation) - why exports no longer use it`);
  check((await text(page, "#vwlMeta")) === "1500 lines", "VWL list total is 1500 from total_count");
  const download = async (sel) => { await page.click("#vwlExportBtn"); const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click(sel)]); return dl; };
  const parseCsv = (t) => { const rows = []; let cur = [], f = "", q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; cur.push(f); f = ""; if (cur.length > 1 || cur[0] !== "") rows.push(cur); cur = []; } else f += c; } if (f !== "" || cur.length) { cur.push(f); rows.push(cur); } return rows; };
  const csv = fs.readFileSync(await (await download("#vwlExportCsv")).path(), "utf8");
  const rows = parseCsv(csv); const head = rows[0]; const body = rows.slice(1);
  const iItem = head.indexOf("Item"), iQty = head.indexOf("Total Qty to Buy"), iBd = head.indexOf("Indent Breakdown");
  check(body.length === 1500 && new Set(body.map((r) => r[iItem])).size === 1500, `CSV export: all 1500 matching rows, 1500 distinct items (visible page shows 75)`);
  check(body.reduce((a, r) => a + Number(r[iQty]), 0) === 7500, "CSV quantity parity: Σ Total Qty to Buy = 7500 (1500 × 5)");
  check(body.every((r) => /IND-26-1\d\d \(\d\)/.test(r[iBd])), "CSV canonical 'Indent (line)' serial in every row");
  const tsv = fs.readFileSync(await (await download("#vwlExportTsv")).path(), "utf8").split(/\r?\n/).filter((l) => l.trim());
  check(tsv.length === 1501, "TSV export: 1500 rows + header");
  // operational vendor choice: export == server total for that choice
  const vopt = await page.$$eval("#vwlVendorFilter option", (n) => n.map((o) => o.value).find((v) => /^vendor:/.test(v)));
  await page.click("#vwlFilterBtn"); await page.selectOption("#vwlVendorFilter", vopt); await page.waitForTimeout(700); await page.keyboard.press("Escape");
  const shown = Number((await text(page, "#vwlMeta")).match(/^(\d+)/)[1]);
  const csv2 = parseCsv(fs.readFileSync(await (await download("#vwlExportCsv")).path(), "utf8"));
  check(shown < 1500 && csv2.length - 1 === shown, `CSV honours the operational vendor choice (${shown} rows == server total)`);
  await page.click("#vwlFilterBtn"); await page.selectOption("#vwlVendorFilter", ""); await page.waitForTimeout(600); await page.keyboard.press("Escape");
  if (libs && fs.existsSync(path.join(libs, "jspdf/dist/jspdf.umd.min.js"))) {
    const pdf = await download("#vwlExportPdf");
    const pdfPath = (await pdf.path());
    const { execFileSync } = await import("node:child_process");
    const txt = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const items = new Set(txt.match(/VItem \d{4}/g) || []);
    const pages = (txt.match(/\f/g) || []).length;
    check(items.size === 1500 && pages > 5, `PDF runtime (real jsPDF + pdftotext): all 1500 distinct items present across ${pages} pages`);
    check(/IND-26-1\d\d \(\d\)/.test(txt), "PDF contains canonical 'Indent (line)' serial");
  } else {
    console.log("SKIP: PDF runtime (set PEC_JSPDF_ROOT to a dir containing node_modules/jspdf + jspdf-autotable) - not verified in this run");
  }
  await ctx.close();
}

// ───────── Error state, mobile layout ─────────
{
  const { ctx, page } = await open({ role: "edit", failPaged: true }, "indents");
  check((await page.locator("#tab-indents td.pec-table-state.is-error").count()) === 1, "paged read failure shows error state (not stuck loading)");
  await ctx.close();
}
// Responsive: incremental lists + cards at wide / tablet / phone widths
for (const vp of [{ n: "1440", width: 1440, height: 900 }, { n: "820", width: 820, height: 1100 }, { n: "390", width: 390, height: 800 }, { n: "320", width: 320, height: 720 }]) {
  const { ctx, page, errors } = await open({ role: "edit" }, "pr", vp);
  const narrow = vp.width <= 520;
  for (const [tab, tb, counter] of [["pr", "prTbody", "#prMeta"], ["indents", "iTbody", "#iMeta"], ["vendor-buylist", "vwlTbody", "#vwlMeta"], ["excess", "eTbody", "#eMeta"]]) {
    if (narrow) await page.selectOption("#procTabSelect", tab); else await page.click(`.tabs .tab-btn[data-tab="${tab}"]`);
    await page.waitForTimeout(700);
    const r = await page.evaluate(({ tb, counter }) => { const tr = document.querySelector(`#${tb} tr`); const td = tr.querySelector("td:nth-child(2)"); const cs = getComputedStyle(tr); const de = document.documentElement; return { ovf: de.scrollWidth - de.clientWidth, display: cs.display, label: td?.dataset.label || "", count: document.querySelector(counter).textContent.trim(), mirror: document.getElementById("procTabCount").textContent.trim() }; }, { tb, counter });
    const isCard = vp.width <= 640;
    check(r.ovf <= 1 && /\d/.test(r.count) && (isCard ? r.display === "flex" && r.label !== "" : r.display === "table-row"), `${vp.n}px ${tab}: ${isCard ? "row is a labelled card" : "row is a table row"}, count "${r.count}", no horizontal overflow`);
    if (narrow) check(r.mirror === r.count, `${vp.n}px ${tab}: lens selector shows the count (${r.mirror})`);
    const kb = await page.evaluate((tb) => { const tr = document.querySelector(`#${tb} tr`); return { tab: tr.tabIndex, key: tr.dataset.pecRow }; }, tb);
    check(kb.tab === 0 && kb.key === "1", `${vp.n}px ${tab}: rows are keyboard reachable`);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `r2-${vp.n}px-${tab}.png`) });
  }
  check(errors.length === 0, `${vp.n}px: no page errors ${errors.join("|")}`);
  await ctx.close();
}
await browser.close();
server.close();
if (failures) { console.error(`pec-paging-contract-smoke: ${failures} FAILED`); process.exit(1); }
console.log("pec-paging-contract-smoke: PASS");
