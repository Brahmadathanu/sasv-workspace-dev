#!/usr/bin/env node
/**
 * PEC five-lens control inventory (static HTML x JS cross-reference).
 *
 * Parses the shared HTML, groups every ID/aria-bearing control by the pane or
 * modal that contains it, cross-references each id against the shared JS, and
 * checks accessible-name / dialog semantics. Prints a markdown matrix
 * (--md) and exits non-zero on FAIL rows. Source-level only: it proves the
 * control exists, is named and is referenced by JS - not that it works with
 * live data or roles.
 *
 * Usage: node scripts/pec-five-lens-inventory.mjs [--md out.md]
 */
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const htmlSrc = fs.readFileSync(path.join(root, "shared/procurement-execution-console.html"), "utf8");
const jsSrc = fs.readFileSync(path.join(root, "shared/js/procurement-execution-console.js"), "utf8");
const mdIdx = process.argv.indexOf("--md");
const mdOut = mdIdx > 0 ? process.argv[mdIdx + 1] : null;

const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[ext] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
// Static DOM only: block module scripts so no data/role code mutates the markup.
await page.route("**/js/*.js", (r) => r.abort());
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
await page.goto(`${base}/shared/procurement-execution-console.html`);

const rows = await page.evaluate(() => {
  const out = [];
  const containers = [
    ...["pr", "action", "indents", "vendor-buylist", "excess"].map((t) => ({ key: `lens:${t}`, el: document.getElementById(`tab-${t}`) })),
    ...[...document.querySelectorAll(".modal-backdrop, .erp-modal-backdrop, [id$='ModalBackdrop']")].map((el) => ({ key: `modal:${el.id}`, el })),
    { key: "header", el: document.querySelector(".pec-header-card") },
    { key: "lens-nav", el: document.querySelector(".tabs-card") },
  ];
  const seen = new Set();
  const nameOf = (c) => {
    if (c.getAttribute("aria-label")) return c.getAttribute("aria-label");
    if (c.getAttribute("aria-labelledby")) {
      const refs = c.getAttribute("aria-labelledby").split(/\s+/).filter((i) => document.getElementById(i));
      if (!refs.length) return "";
      const txt = refs.map((i) => document.getElementById(i).textContent.trim()).join(" ");
      return txt || `(runtime title #${refs[0]})`;
    }
    if (c.id) { const l = document.querySelector(`label[for="${c.id}"]`); if (l) return l.textContent.trim(); }
    const wrap = c.closest("label"); if (wrap) return wrap.textContent.trim();
    const t = c.textContent.trim(); if (t) return t;
    return c.getAttribute("title") || "";
  };
  for (const { key, el } of containers) {
    if (!el) continue;
    for (const c of el.querySelectorAll("button, input, select, textarea, a[href], [role='button'], [role='tab'], [role='combobox'], [role='dialog']")) {
      if (seen.has(c)) continue;
      seen.add(c);
      out.push({ area: key, tag: c.tagName.toLowerCase(), type: c.getAttribute("type") || "", id: c.id || "", role: c.getAttribute("role") || "", name: nameOf(c).replace(/\s+/g, " ").slice(0, 60), editAction: c.dataset.editAction === "true", hidden: c.hidden || !!c.closest("[hidden]") });
    }
    if (key.startsWith("modal:")) {
      const dlg = el.querySelector("[role='dialog']");
      out.push({ area: key, tag: "dialog", id: el.id, role: "dialog", name: dlg ? nameOf(dlg) : "", dialogOk: !!(dlg && dlg.getAttribute("aria-modal") === "true" && (dlg.getAttribute("aria-labelledby") || dlg.getAttribute("aria-label"))) });
    }
    if (key.startsWith("lens:")) {
      el.querySelectorAll("th").forEach((th) => out.push({ area: key, tag: "th", id: th.id || "", name: th.textContent.trim(), hidden: th.hidden }));
    }
  }
  return out;
});
await browser.close();
server.close();

const refCount = (id) => (id ? (jsSrc.match(new RegExp(`["'\`#]${id}["'\`\\s\\]]|getElementById\\(["']${id}["']\\)`, "g")) || []).length : 0);
// controls whose behaviour is attached via delegation/generic helpers rather than by literal id
const GENERIC = /^(.*SearchClear|.*FilterBtn|procTabSelect|tab-vendor-buylist-btn)$/;
const lines = [];
let fails = 0, controls = 0;
// A modal whose backdrop id and none of whose control ids appear in the JS has no opener.
const unreachable = new Set();
for (const area of new Set(rows.map((r) => r.area))) {
  if (!area.startsWith("modal:")) continue;
  const ids = rows.filter((r) => r.area === area && r.id).map((r) => r.id);
  if (ids.every((i) => !new RegExp(`["'\`#]${i}["'\`\\s\\]]|getElementById\\(["']${i}["']\\)`).test(jsSrc))) unreachable.add(area);
}
const byArea = {};
for (const r of rows) {
  if (r.tag === "th") { (byArea[r.area] ||= { th: 0, ctl: [], fail: 0 }).th++; continue; }
  const a = (byArea[r.area] ||= { th: 0, ctl: [], fail: 0 });
  if (unreachable.has(r.area)) { a.ctl.push({ ...r, status: "DEFER", note: "modal unreachable: no JS opener or handler references it (dead markup; not removed in this PR)" }); continue; }
  if (r.tag === "dialog") { a.ctl.push({ ...r, status: r.dialogOk ? "PASS" : "FAIL", note: r.dialogOk ? "role=dialog, aria-modal, labelled" : "dialog semantics missing" }); if (!r.dialogOk) { a.fail++; fails++; } continue; }
  controls++;
  const refs = refCount(r.id);
  const named = Boolean(r.name);
  const wired = !r.id || refs > 0 || GENERIC.test(r.id) || r.tag === "a" || r.tag === "input" && r.type === "hidden";
  const status = !named ? "FAIL" : !wired ? "FIX" : "PASS";
  if (status === "FIX") { a.fail++; fails++; } // FIX rows are fatal too (unreachable modals are DEFER, not FIX)
  const note = !named ? "no accessible name" : !wired ? "id not referenced by JS (verify handler)" : `named; ${r.id ? refs + " JS ref(s)" : "no id (static/dynamic)"}`;
  if (status === "FAIL") { a.fail++; fails++; }
  a.ctl.push({ ...r, status, note });
}

lines.push("| Area | Controls | Table headers | PASS | FIX | FAIL |", "|---|---|---|---|---|---|");
for (const [k, a] of Object.entries(byArea)) {
  const c = a.ctl;
  lines.push(`| ${k} | ${c.filter((x) => x.tag !== "dialog").length} | ${a.th} | ${c.filter((x) => x.status === "PASS").length} | ${c.filter((x) => x.status === "FIX").length} | ${c.filter((x) => x.status === "FAIL").length} |${c.some((x) => x.status === "DEFER") ? " DEFER: unreachable modal" : ""}`);
}
lines.push("", "### Element detail (non-PASS and edit-gated controls)", "", "| Area | Element | Role/type | Accessible name | Edit-gated | Status | Note |", "|---|---|---|---|---|---|---|");
for (const [k, a] of Object.entries(byArea)) for (const c of a.ctl) {
  if (c.status === "PASS" && !c.editAction) continue;
  lines.push(`| ${k} | ${c.tag}${c.id ? "#" + c.id : ""} | ${c.role || c.type || "-"} | ${(c.name || "").replace(/\|/g, "/")} | ${c.editAction ? "yes" : "no"} | ${c.status} | ${c.note} |`);
}
const md = lines.join("\n");
if (mdOut) fs.writeFileSync(mdOut, md + "\n");
console.log(md);
console.log(`\nTotal controls inventoried: ${controls}; FAIL+FIX rows: ${fails}`);
const lensIdCount = (k) => byArea[k]?.ctl.filter((c) => c.id && c.tag !== "dialog").length ?? 0;
console.log("ID-bearing controls per lens:", ["pr", "action", "indents", "vendor-buylist", "excess"].map((t) => `${t}=${lensIdCount("lens:" + t)}`).join(", "));
if (fails) process.exit(1);
