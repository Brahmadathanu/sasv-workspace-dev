// Contract test for docs/master-data-costing/ACCEPTANCE_14_LENS_EVIDENCE_MATRIX_2026-11-08.md (issue #211). Reads files only: no database, no network, no browser.
// It keeps the matrix honest: every lens exists, the classification counts add up, every named view/RPC exists in the client source, the stated gates match the code,
// and the document contains no secrets or private identifiers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LENS_REGISTRY } from "../../public/shared/js/costing-suite-registry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const DOC = read("docs/master-data-costing/ACCEPTANCE_14_LENS_EVIDENCE_MATRIX_2026-11-08.md");
const JS_DIR = path.join(root, "public/shared/js");
const ALL_JS = fs.readdirSync(JS_DIR).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(JS_DIR, f), "utf8")).join("\n");

const LENSES = {
  "portfolio-readiness": { cls: "dependency", registry: true }, "rm-cost-trace": { cls: "restricted", registry: true }, "pm-cost-trace": { cls: "restricted", registry: true },
  "staff-governance": { cls: "probable", registry: true }, "manual-provisions": { cls: "probable", registry: true },
  "proposal-decisions": { cls: "probable", registry: false }, "approved-for-application": { cls: "probable", registry: false }, "scheme-rule-register": { cls: "confirmed", registry: false },
  "route-family-mapping-review": { cls: "probable", registry: true }, "route-family-foundation-review": { cls: "probable", registry: true },
  "route-family-route-editor": { cls: "selector", registry: true }, "product-route-editor": { cls: "selector", registry: true },
  "historical-candidate-review": { cls: "selector", registry: true }, "effective-route-viewer": { cls: "selector", registry: true },
};
const matrixRows = DOC.split("\n").filter((l) => /^\| \d+ \| /.test(l) && l.includes("`"));
const section = (title) => { const i = DOC.indexOf(title); const j = DOC.indexOf("\n## ", i + 1); return DOC.slice(i, j < 0 ? undefined : j); };

test("exactly the 14 lenses are in the matrix, each once, numbered 1..14, and each exists in the client (registry or PPM workspace list)", () => {
  const m = section("## 2. Matrix"); const rows = m.split("\n").filter((l) => /^\| \d+ \| /.test(l));
  assert.equal(rows.length, 14);
  assert.deepEqual(rows.map((r) => Number(/^\| (\d+) \|/.exec(r)[1])), Array.from({ length: 14 }, (_, i) => i + 1));
  for (const id of Object.keys(LENSES)) {
    assert.equal(rows.filter((r) => r.includes("`" + id + "`")).length, 1, id);
    if (LENSES[id].registry) assert.ok(LENS_REGISTRY[id], `${id} in LENS_REGISTRY`);
    else assert.ok(new RegExp(`id: "${id}"`).test(ALL_JS), `${id} is a Pricing Policy workspace id`);
  }
});

test("classification counts in the summary equal the rows and add up to 14 (1 + 1 + 2 + 4 + 6, zero failures)", () => {
  const sum = section("## 1. Summary counts"); const m = section("## 2. Matrix");
  const expected = { dependency: 1, confirmed: 1, restricted: 2, selector: 4, probable: 6 };
  const tally = {}; for (const v of Object.values(LENSES)) tally[v.cls] = (tally[v.cls] ?? 0) + 1;
  assert.deepEqual(tally, expected); assert.equal(Object.values(tally).reduce((a, b) => a + b, 0), 14);
  const rowCls = (id) => { const r = m.split("\n").find((l) => l.includes("`" + id + "`")); return r; };
  const pat = { dependency: /Expected: governed data-build dependency/, confirmed: /Expected empty, confirmed/, restricted: /Permission-restricted \(intentional\)/, selector: /Selector required/, probable: /Probably expected empty/ };
  for (const [id, v] of Object.entries(LENSES)) assert.match(rowCls(id), pat[v.cls], id);
  for (const [k, n] of [["Expected: governed data-build dependency", 1], ["Expected empty: confirmed by a live count", 1], ["Permission-restricted (intentional)", 2], ["Selector / input required (runner never selects)", 4]]) assert.match(sum, new RegExp(`\\*\\*${k.replace(/[()/]/g, "\\$&")}\\*\\* \\| ${n} \\|`), k);
  assert.match(sum, /\| 6 \| CBM `staff-governance`, `manual-provisions`; PPM `proposal-decisions`, `approved-for-application`; PRM `route-family-mapping-review`, `route-family-foundation-review` \|/);
  assert.match(sum, /\*\*Actual query failure\*\* \| \*\*0\*\*/);
});

test("every view and RPC named in the matrix exists in the client source", () => {
  const names = [...new Set([...DOC.matchAll(/`((?:v_[a-z0-9_]+|rpc_[a-z0-9_]+))`/g)].map((x) => x[1]))];
  assert.ok(names.length >= 18, "names found: " + names.length);
  for (const n of names) assert.ok(ALL_JS.includes(n), `${n} not found in public/shared/js`);
});

test("the permission and period gates stated in the document match the code", () => {
  assert.ok(ALL_JS.includes('byTarget.get("role:material-cost-rm-trace")')); assert.match(ALL_JS, /CAN_VIEW_TRACE = CAN_VIEW_RM_TRACE;/);
  assert.match(ALL_JS, /Restricted RM contribution detail/); assert.match(ALL_JS, /Restricted PM contribution detail/);
  assert.ok(ALL_JS.includes("PERIOD_PICKER_DISABLED_TITLE")); assert.ok(ALL_JS.includes("function isPeriodScopedLens"));
  assert.ok(ALL_JS.includes("Choose a scope, then explicitly preview historical evidence.")); assert.ok(ALL_JS.includes("Select an existing Family Route or create a new Draft."));
  assert.ok(ALL_JS.includes("No Product Route selected.")); assert.ok(ALL_JS.includes("Search or select a Product to view its effective manufacturing route."));
  assert.ok(read("scripts/costing-acceptance/lib/allowlist.mjs").includes("rpc_get_[a-z0-9_]+"), "read-only runner allow-list admits only rpc_get_* (so rpc_preview_* is not runnable)");
  for (const id of ["rm-cost-trace", "pm-cost-trace", "manual-provisions"]) assert.equal(LENS_REGISTRY[id].periodScoped, true, id);
  for (const id of ["manual-rate-manager", "cost-governance", "staff-governance", "route-readiness", "driver-governance"]) assert.equal(LENS_REGISTRY[id].periodScoped, false, id);
});

test("period-switch skips: 8 rows in four modules, all 13 PRM lenses are not period-scoped, and MCM's only period-scoped lenses are the restricted traces", () => {
  const sec = section("## 3. The eight period-switch skips"); const rows = sec.split("\n").filter((l) => /^\| \d+(-\d+)? \| /.test(l));
  assert.equal(rows.length, 4); assert.match(sec, /8 skips = 8 by design/); assert.match(sec, /Defects: 0/);
  const prm = ["route-readiness", "product-route-assignments", "product-subgroup-mappings", "shared-workload-preview", "route-families", "route-family-mapping-review", "route-family-foundation-review", "production-cost-centres", "route-family-route-editor", "product-route-editor", "historical-candidate-review", "effective-route-viewer", "archived-routes"];
  assert.equal(prm.length, 13); for (const id of prm) assert.equal(LENS_REGISTRY[id]?.periodScoped, false, id);
  assert.deepEqual(["manual-rate-manager", "rm-cost-trace", "pm-cost-trace"].filter((id) => LENS_REGISTRY[id].periodScoped), ["rm-cost-trace", "pm-cost-trace"]);
});

test("the document is documentation-only and safe: records the unchanged programme status, makes no write instruction, and contains no secrets, emails, tokens or user ids", () => {
  assert.match(DOC, /Documentation only/); assert.match(DOC, /\*\*5\/13\*\*/);
  assert.doesNotMatch(DOC, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/, "no email address");
  assert.doesNotMatch(DOC, /eyJ[A-Za-z0-9_-]{10,}|sb-[a-z0-9]{10,}|Bearer\s+\S{10,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, "no JWT, key, bearer token or UUID");
  assert.doesNotMatch(DOC, /\b(insert into|update \w+ set|delete from|truncate|apply_migration|db push)\b/i);
  assert.match(DOC, /Do not use the Draft\/Save controls/);
  assert.equal(matrixRows.length >= 14, true);
});
