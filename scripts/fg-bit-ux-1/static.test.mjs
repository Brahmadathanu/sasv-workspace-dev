// FG-BIT-UX-1 static contract checks (no browser, no network).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (r) => fs.readFileSync(path.join(root, r), "utf8").replace(/\r\n/g, "\n");
const html = read("fg-bulk-internal-transfer.html");
const css = read("public/shared/css/sasv-fg-bulk-internal-transfer.css");
const js = read("public/shared/js/fg-bulk-internal-transfer.js");

test("page: theme attr, body class, stylesheet order, relative (Electron-safe) asset paths", () => {
  assert.match(html, /<html[^>]*data-sasv-theme="sasv-core"/);
  assert.match(html, /<body class="sasv-fg-bit"/);
  const a = html.indexOf('href="public/shared/css/style.css"');
  const b = html.indexOf('href="public/shared/css/sasv-fg-bulk-internal-transfer.css"');
  assert.ok(a > 0 && b > a, "module CSS loads after shared style.css");
  assert.match(html, /src="public\/shared\/js\/fg-bulk-internal-transfer\.js"/);
  assert.doesNotMatch(html, /(?:href|src)="\//, "no root-absolute URLs");
  assert.doesNotMatch(html, /<style[\s>]/, "no inline <style> block");
  assert.doesNotMatch(html, /style="/, "no inline style attributes");
  for (const f of ["public/shared/css/sasv-fg-bulk-internal-transfer.css", "public/shared/js/fg-bulk-internal-transfer.js", "public/shared/js/sasv-module-chrome.js"]) assert.ok(fs.existsSync(path.join(root, f)), f);
});
test("page: every element id used by the script still exists (IDs preserved)", () => {
  const ids = [...js.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(ids.length >= 25);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), id);
  for (const id of ["homeBtn", "transferForm", "submitBtn", "resetBtn", "cancelBtn", "modalCloseBtn"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /class="source-table-wrap"/);
});
test("home: canonical helper class, accessible name, target unchanged", () => {
  assert.match(html, /id="homeBtn"[^>]*class="sasv-home-btn"|class="sasv-home-btn"[^>]*id="homeBtn"|id="homeBtn"\s+type="button"\s+class="sasv-home-btn"/);
  assert.match(js, /mountModuleHome\(els\.homeBtn\)/);
  assert.match(js, /window\.location\.href = "index\.html"/);
});
test("css: scoped to body.sasv-fg-bit, tokens only, no raw hex, no global selectors", () => {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(stripped.replace(/var\([^)]*#[0-9a-fA-F]{3,8}\)/g, "").match(/#[0-9a-fA-F]{3,8}\b/g), null, "no raw hex");
  assert.doesNotMatch(stripped, /:root\s*\{/, "no token redefinition");
  assert.match(stripped, /var\(--sasv-/);
  const selectors = stripped.replace(/\{[^{}]*\}/g, "{}").split(/[{}]/).flatMap((b) => b.split(",")).map((x) => x.trim()).filter((x) => x && !/^(@|\d|from|to)/.test(x) && !x.includes("%"));
  for (const sel of selectors) assert.ok(/sasv-fg-bit|^\.fgbit-/.test(sel), `unscoped selector: ${sel}`);
});
test("contract: RPC names and payload argument names are exactly preserved", () => {
  const rpcs = [...js.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(rpcs, ["rpc_create_fg_bulk_internal_transfer", "rpc_fg_bulk_internal_transfer_source_by_identity", "rpc_fg_bulk_internal_transfer_source_page"]);
  const post = js.slice(js.indexOf("function buildRpcPayload"), js.indexOf("/* -- Submit"));
  const keys = [...post.matchAll(/^\s+(p_[a-z_]+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ["p_transfer_date","p_product_id","p_item","p_batch_number","p_qty","p_uom","p_from_section_id","p_from_subsection_id","p_from_area_id","p_from_plant_id","p_to_section_id","p_to_subsection_id","p_to_area_id","p_to_plant_id","p_remarks","p_source_work_log_id"]);
  assert.match(js, /p_plant_id: identity\.plant_id \?\? null/);
  assert.match(js, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/, "date computation untouched");
});
test("a11y hooks: status regions, dialog attrs, row keyboard activation, busy guard", () => {
  assert.match(html, /role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(html, /id="modalMsgArea"[\s\S]*aria-live="polite"/);
  assert.match(js, /tabindex="0"/);
  assert.match(js, /handleSourceRowKeydown/);
  assert.match(js, /state\.isPosting\) return/);
});
test("scope: SW cache pin unchanged; FG-BIT script/CSS use the existing network-first branch", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /CACHE_NAME = "hub-cache-v393"/);
  assert.match(sw, /fg-bulk-internal-transfer\\\.js\$\/\.test\(url\.pathname\)/);
  assert.match(sw, /sasv-fg-bulk-internal-transfer\\\.css\$\/\.test\(url\.pathname\)/);
  // Runtime behaviour is covered by sw-freshness.test.mjs.
});

test("PWA route publishes the same module with correct relative assets and navigation", () => {
  const pwa = read("public/shared/fg-bulk-internal-transfer.html");
  assert.match(pwa, /data-sasv-theme="sasv-core"/);
  for (const id of [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1])) {
    assert.match(pwa, new RegExp('id="' + id + '"'), id);
  }
  for (const asset of ['css/style.css', 'css/sasv-fg-bulk-internal-transfer.css', 'js/fg-bulk-internal-transfer.js']) {
    assert.ok(pwa.includes('="' + asset + '"'), asset);
    assert.ok(fs.existsSync(path.join(root, "public/shared", asset)), asset);
  }
  assert.doesNotMatch(pwa, /(?:href|src)="public\//);
  assert.match(js, /window\.location\.pathname\.startsWith\("\/shared\/"\)/);
  assert.match(js, /"\/utilities-hub\/index\.html"/);
});
