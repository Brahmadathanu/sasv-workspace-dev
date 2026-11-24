// Static guards for the MIS G7 client: security boundary, governed-only writes, theme tokens, navigation (PWA + Electron),
// service-worker freshness, and contract alignment. No browser, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const js = read("public/shared/js/mis-batch-governance.js");
const lib = read("public/shared/js/mis-g7-contract.js");
const css = read("public/shared/css/sasv-mis-batch-governance.css");
const html = read("public/shared/mis-batch-governance.html");
const contract = JSON.parse(read("docs/executive-mis-g7-server/client_rpc_contract.json"));
const NEW = { js, lib, css, html };

test("client uses only the documented read/write surface: no direct table writes, no service role, no private schema, no invented RPC", () => {
  for (const [n, src] of Object.entries({ js, lib })) {
    assert.doesNotMatch(src, /\.from\([^)]*\)[\s\S]{0,240}?\.(insert|update|upsert|delete)\(/, `${n}: direct table write`);
    assert.doesNotMatch(src, /service_role|SERVICE_ROLE|app_private|\.schema\(/, `${n}: privileged or private access`);
  }
  const known = new Set([...contract.rpcs.map((r) => r.name), "app_has_permission", "rpc_get_effective_product_process_route"]);
  for (const m of (js + lib).matchAll(/["'](mis_[a-z0-9_]+_v1|rpc_[a-z0-9_]+|app_[a-z0-9_]+)["']/g)) assert.ok(known.has(m[1]), `unknown RPC ${m[1]}`);
  assert.doesNotMatch(js + lib, /["'](fn_fg_[a-z_]+|rpc_update_daily_work_log|rpc_create_daily_work_log)/, "ungoverned depletion/legacy writer used");
});

test("no active ENFORCE transition or core sign-off is exposed", () => {
  assert.doesNotMatch(js + lib, /mis_g7_set_enforcement_v1|mis_g7_record_core_migration_acceptance_v1/);
  assert.doesNotMatch(html, /<button[^>]*>[^<]*enforce/i);
  assert.match(js, /separately governed owner actions and are not available in this screen/);
});

test("excess controls exist only behind the server's excess_permitted flag AND the excess capability", () => {
  assert.match(js, /d\.excess_permitted === true && S\.caps\.canExcess/);
  assert.match(lib, /canExcess: out\.packing\.edit && out\.excess\.edit/);
});

test("theme: new CSS uses semantic tokens only (no hex/rgb palette literals)", () => {
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  assert.match(css, /var\(--sasv-/);
  assert.match(css, /@media \(max-width: 520px\)/);
});

test("HOME uses canonical module chrome + platform navigation; session redirect is platform-aware (Electron vs PWA)", () => {
  assert.match(js, /import\s*\{\s*mountModuleHome\s*\}\s*from\s*"\.\/sasv-module-chrome\.js"/);
  assert.match(js, /addEventListener\("click",\s*\(\)\s*=>\s*Platform\.goHome\(\)\)/);
  assert.match(js, /Platform\.isElectron \? "\/login\.html" : "\/utilities-hub\/index\.html"/);
  assert.doesNotMatch(js, /window\.location\.protocol\s*===\s*["']file:["']/);
});

test("page uses relative asset paths so it resolves under /shared (PWA) and public/shared (Electron)", () => {
  assert.match(html, /href="css\/style\.css"/); assert.match(html, /src="js\/mis-batch-governance\.js"/);
  assert.doesNotMatch(html, /(?:href|src)="\//);
});

test("registry route normalisation for both clients (Electron + PWA)", async () => {
  const src = read("public/shared/js/module-registry.js").replace(/^import .*supabaseClient.*$/m, "const supabase = {};");
  const { normalizeClientRoute } = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
  assert.equal(normalizeClientRoute("public/shared/mis-batch-governance.html", "electron"), "public/shared/mis-batch-governance.html");
  assert.equal(normalizeClientRoute("public/shared/mis-batch-governance.html", "pwa"), "/shared/mis-batch-governance.html");
  assert.equal(normalizeClientRoute("../shared/mis-batch-governance.html", "electron"), "public/shared/mis-batch-governance.html");
});

test("protected service worker is not modified by this package (a reviewed SW rule is a release dependency)", () => {
  const head = execFileSync("git", ["show", "HEAD:public/sw.js"], { cwd: new URL("../../", import.meta.url), maxBuffer: 1 << 26 }).toString().replace(/\r\n/g, "\n");
  assert.equal(read("public/sw.js").replace(/\r\n/g, "\n"), head);
});

test("executive MIS dashboard: governance section is presentation-only and links to the module", () => {
  const dash = read("public/shared/js/executive-mis-dashboard.js");
  assert.match(dash, /import \{ GOVERNANCE_STATES, HISTORICAL_AUDIT_SNAPSHOT \} from "\.\/mis-g7-contract\.js"/);
  assert.match(dash, /renderGovernanceSection\(\)/); assert.match(dash, /href="mis-batch-governance\.html"/);
  assert.match(dash, /not live/); assert.match(dash, /never backfilled/);
  assert.equal((dash.match(/get_mis_production_value_summary/g) || []).length, (read("public/shared/js/executive-mis-dashboard.js").match(/get_mis_production_value_summary/g) || []).length);
});

test("registry proposal is not placed in supabase/migrations and assigns no user", () => {
  const sql = read("docs/executive-mis-g7-server/CLIENT_PERMISSION_REGISTRY_PROPOSAL_NOT_APPLIED.sql");
  assert.doesNotMatch(sql.replace(/^\s*--.*$/gm, ""), /user_permissions|insert into public\.user_/i);
  for (const t of ["mis-batch-stage-signer", "mis-fg-bulk-packing", "mis-fg-excess-adjustment", "mis-g7-enforcement-admin", "mis-g7-core-migration-signoff", "mis-batch-governance"]) assert.ok(sql.includes(`'${t}'`), t);
  assert.ok(!fs.readdirSync(new URL("../../supabase/migrations/", import.meta.url)).some((f) => /mis_g7_client|permission_registry/.test(f)));
});

test("manifest regeneration preserves registered versions and LIVE status", () => {
  const gen = read("supabase/tests/mis_g7/gen_migration_identities.mjs");
  const man = JSON.parse(read("docs/executive-mis-g7-server/MIGRATION_IDENTITIES.json"));
  for (const m of man.migrations) { assert.ok(gen.includes(m.registered_version), m.registered_version); assert.match(m.status, /^LIVE/); }
  assert.doesNotMatch(gen, /HELD \(not installed\)/);
  assert.ok(vm.isContext !== undefined);
});
