// CW-07: the Cost Sheet screen has no approval action, so it is named "Cost Sheet Review".
// Display text only: module key, permission target, route path, suite id and lens ids must not change.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { COSTING_ROUTE_CONFIG } from "../../public/shared/js/costing-route-config.js";
import { COSTING_SUITE_MODULES } from "../../public/shared/js/costing-suite-registry.js";
import { CW07_LABEL_CHANGES, applyCw07Labels, applyApprovedHtmlInsertions, isCw07LabelOnlyChange } from "../lib/costing-scope-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const BASE = "28cfadb20de3e2f3daf0aadada096f541254819d";
const showBase = (rel) => execFileSync("git", ["show", `${BASE}:${rel}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n");
const HTML = "public/shared/cost-sheet-review.html";
const NEW_NAME = "Cost Sheet Review";
const OLD_NAME = "Cost Sheet Review & Approval";

const ROUTE = COSTING_ROUTE_CONFIG["cost-sheet-review"];
const SUITE = COSTING_SUITE_MODULES.find((s) => s.id === "cost-sheet-review");
const decode = (t) => t.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

test("navigation labels: route config, suite registry, page title and heading agree on the new name", () => {
  const html = read(HTML);
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  const h1s = [...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)].map((m) => m[1]);
  assert.equal(ROUTE.title, NEW_NAME);
  assert.equal(SUITE.label, NEW_NAME);
  assert.equal(decode(title), NEW_NAME);
  assert.deepEqual(h1s.map(decode), [NEW_NAME], "exactly one h1 and it names the module");
  assert.equal(decode(title), decode(h1s[0]), "document title equals the visible heading");
});

test("no user-facing text still promises approval on this screen", () => {
  const html = read(HTML);
  const sub = html.match(/<div class="page-sub" id="subtitle">([\s\S]*?)<\/div>/)[1];
  assert.doesNotMatch(decode(sub), /approv/i);
  assert.doesNotMatch(ROUTE.subtitle, /approv/i);
  assert.equal(decode(sub), ROUTE.subtitle, "initial subtitle equals the route-config subtitle");
  for (const rel of ["public/shared/js/costing-route-config.js", "public/shared/js/costing-suite-registry.js", "public/shared/js/costing-suite-shell.js", "public/shared/js/costing-suite-cost-sheet.js", HTML]) {
    const src = read(rel);
    assert.ok(!src.includes(OLD_NAME), `${rel} has no "${OLD_NAME}"`);
    assert.ok(!src.includes("Cost Sheet Review &amp; Approval"), `${rel} has no encoded old title`);
  }
});

test("identifiers are untouched: module key, permission target, suite id, route path, default and allowed lenses", () => {
  const baseCfg = showBase("public/shared/js/costing-route-config.js");
  const grab = (src, key) => src.match(new RegExp(`"cost-sheet-review": \\{[\\s\\S]*?${key}:\\s*("[^"]*"|\\[[^\\]]*\\])`))[1];
  for (const key of ["moduleKey", "permissionTarget", "suiteId", "defaultLens", "routePath", "allowedLensIds"]) {
    assert.equal(grab(read("public/shared/js/costing-route-config.js"), key), grab(baseCfg, key), key);
  }
  assert.equal(ROUTE.moduleKey, "cost-sheet-review");
  assert.equal(ROUTE.permissionTarget, "module:cost-sheet-review");
  assert.equal(ROUTE.routePath, "public/shared/cost-sheet-review.html");
  assert.equal(SUITE.id, "cost-sheet-review");
  assert.deepEqual([...SUITE.lensIds], ["sku-cost-sheet", "printable-cost-sheet", "cost-comparison", "scheme-comparison", "qc-action-queue", "materials-stores-action-queue"]);
  assert.ok(fs.existsSync(path.join(root, HTML)), "file path unchanged");
  assert.ok(fs.existsSync(path.join(root, "public/shared/js/cost-sheet-review-entry.js")));
});

test("diff against the baseline is exactly the label rename (nothing else changed in these files)", () => {
  for (const rel of ["public/shared/js/costing-route-config.js", "public/shared/js/costing-suite-registry.js", "public/shared/js/costing-suite-cost-sheet.js", HTML]) {
    // Later, individually approved CSS-only insertions (scope guard APPROVED_HTML_INSERTIONS) are the only other difference tolerated.
    assert.equal(read(rel), applyApprovedHtmlInsertions(rel, applyCw07Labels(showBase(rel))), rel);
  }
  // MDC-07 N1 (flag-gated navigation) is the only later package allowed to edit the shell: every line of the
  // label-renamed baseline must still appear, in order, in the current shell, except the single flat
  // `lensSelect.innerHTML = activeSuites` line that N1 turns into a flag-gated ternary. N1 otherwise only adds lines.
  const shellRel = "public/shared/js/costing-suite-shell.js";
  const baseLines = applyCw07Labels(showBase(shellRel)).split("\n");
  const nowLines = read(shellRel).split("\n");
  const REPLACED_BY_N1 = "      lensSelect.innerHTML = activeSuites";
  let at = 0;
  const missing = [];
  for (const line of baseLines) {
    const found = nowLines.indexOf(line, at);
    if (found === -1) missing.push(line);
    else at = found + 1;
  }
  assert.deepEqual(missing, [REPLACED_BY_N1], "shell: only the select-population line is replaced; everything else is untouched");
  assert.equal(CW07_LABEL_CHANGES.length, 7);
  for (const [from, to] of CW07_LABEL_CHANGES) assert.notEqual(from, to);
});

test("the label-only tolerance in the scope guard is narrow: any other edit is still a violation", () => {
  const files = { "a.html": "<title>Cost Sheet Review &amp; Approval</title><p>x</p>" };
  const base = "B";
  const git = (...args) => (args[0] === "show" ? files["a.html"] : "");
  const mk = (head) => ({ git, root: fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "cw07-")), base, rel: "a.html", head });
  const run = (head) => {
    const c = mk(head);
    fs.writeFileSync(path.join(c.root, "a.html"), head);
    return isCw07LabelOnlyChange({ git, root: c.root, base, rel: "a.html" });
  };
  assert.equal(run("<title>Cost Sheet Review</title><p>x</p>"), true, "rename only");
  assert.equal(run("<title>Cost Sheet Review</title>\r\n<p>x</p>".replace("\r\n", "")), true, "CRLF-normalised comparison");
  assert.equal(run("<title>Cost Sheet Review</title><p>y</p>"), false, "extra change");
  assert.equal(run("<title>Cost Sheet Review &amp; Approval</title><p>x</p>"), false, "unchanged file is not a rename");
  assert.equal(run("<title>Cost Sheet Review</title><p>x</p><script>1</script>"), false);
});

test("the screen offers no approval: Cost Sheet, QC and Materials/Stores controllers read only (get_* RPCs, no approve/write)", () => {
  const files = ["public/shared/js/costing-suite-cost-sheet.js", "public/shared/js/costing-suite-qc-action-queue.js", "public/shared/js/costing-suite-materials-stores-action-queue.js", "public/shared/js/costing-suite-scheme-comparison.js"];
  for (const rel of files) {
    const src = read(rel);
    const rpcs = [...src.matchAll(/costingRpc\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]);
    for (const name of rpcs) assert.match(name, /^rpc_get_|^rpc_list_|^rpc_search_/, `${rel}: ${name} is a read RPC`);
    assert.doesNotMatch(src, /rpc_[a-z_]*(approve|submit|supersede|set_|update_|insert_|delete_|upsert_|create_|write)/, rel);
  }
  // Static HTML: the only "Approved" controls are the printable sheet's signatory fields, not an approval action.
  const html = read(HTML);
  const approveIds = [...html.matchAll(/id="([A-Za-z]*[Aa]pprov[A-Za-z]*)"/g)].map((m) => m[1]);
  assert.deepEqual(approveIds.sort(), ["csApprovedOrg", "csApprovedRole"]);
  assert.doesNotMatch(html, /data-[a-z-]*approve|>\s*Approve\s*</i);
});

test("accessibility: html lang, module heading, labelled header actions and a labelled home button remain", () => {
  const html = read(HTML);
  assert.match(html, /<html lang="en"/);
  for (const id of ["refreshBtn", "exportCsv", "homeBtn"]) {
    const tag = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))[0];
    assert.match(tag, /aria-label="[^"]+"/, id);
    assert.match(tag, /title="[^"]+"/, id);
  }
  // Every runtime consumer of the label reads route config / registry, so menus follow automatically.
  const shell = read("public/shared/js/costing-suite-shell.js");
  assert.match(shell, /ACTIVE_ROUTE_CONFIG\.title|routeConfig\.title|\.title/);
});

test("service worker cache is the current release hub-cache-v391 (CW-07 itself never bumped the cache; v390 predates it)", () => {
  assert.match(read("public/sw.js"), /const CACHE_NAME = "hub-cache-v391"/);
});
