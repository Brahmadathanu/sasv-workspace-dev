// WP10 G2 source/safety checks: default-off flag, protected files untouched, no writers or new permission targets in the new client code,
// draft SQL outside supabase/migrations, no new migration files, CRLF migration differences untouched by this package.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" });
const core = read("public/shared/js/wp10-safeguards.js");
const ui = read("public/shared/js/wp10-safeguards-ui.js");
const products = read("public/shared/js/products.js");
const readiness = read("public/shared/js/costing-suite-readiness.js");

test("S1 flag is read-only, exact '1', never set by shipped code", () => {
  const code = (src) => src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"); // the operator how-to in a header comment is documentation, not code
  for (const [name, raw] of [["core", core], ["ui", ui], ["products", products], ["readiness", readiness]]) {
    const src = code(raw);
    assert.equal(/localStorage\??\.setItem\(\s*["']WP10_SAFEGUARDS_V1/.test(src), false, `${name} must never enable the flag`);
  }
  assert.match(products, /getItem\("WP10_SAFEGUARDS_V1"\) === "1"/);
  assert.match(readiness, /getItem\("WP10_SAFEGUARDS_V1"\) === "1"/);
});

test("S2 helper modules load only by dynamic import behind the flag (no static import)", () => {
  assert.equal(/^import .*wp10-safeguards/m.test(products), false);
  assert.equal(/^import .*wp10-safeguards/m.test(readiness), false);
  assert.match(products, /import\("\.\/wp10-safeguards\.js\?v=[0-9a-f]{10}"\)/);
  assert.match(readiness, /import\("\.\/wp10-safeguards-ui\.js\?v=[0-9a-f]{10}"\)/);
});

test("S3 new client modules call no writer and no table API; only the read-only horizon endpoint is named", () => {
  for (const src of [core, ui]) {
    assert.equal(/\.rpc\(\s*["']rpc_(create|update|set|build|refresh|rebuild)/.test(src), false);
    assert.equal(/\.from\(\s*["'`]|\.insert\(\s*[\[{]|\.upsert\(|\.update\(\s*\{|supabase\s*\./.test(src), false); // table API shapes only (Map.delete / Array.from are not table calls)
  }
  assert.match(core, /rpc_wp10_get_operational_expiry_horizon/);
});

test("S4 no new permission target, registry entry, launcher entry or route in the client package", () => {
  for (const src of [core, ui]) assert.equal(/module:[a-z-]+/.test(src), false);
  const changed = git("diff", "--name-only", "origin/main", "--", "public", "index.html", "main.js", "electron").split("\n").filter(Boolean);
  const allowed = new Set(["public/shared/js/products.js", "public/shared/js/costing-suite-readiness.js", "public/shared/js/wp10-safeguards.js", "public/shared/js/wp10-safeguards-ui.js"]);
  const untracked = git("ls-files", "--others", "--exclude-standard", "public").split("\n").filter(Boolean);
  for (const f of [...changed, ...untracked]) assert.ok(allowed.has(f), `unexpected changed client file: ${f}`);
});

test("S5 protected files are byte-identical to origin/main (sw.js, manage-products.html, launcher, registry)", () => {
  for (const f of ["public/sw.js", "public/shared/manage-products.html", "index.html", "public/shared/js/module-registry.js", "public/shared/js/hub-auth.js", "public/shared/js/master-data-write-guard.js"]) {
    if (!fs.existsSync(path.join(root, f))) continue;
    assert.equal(git("diff", "--stat", "origin/main", "--", f).trim(), "", `${f} must be unchanged`);
  }
});

test("S6 SQL proposals live outside supabase/ entirely (so the PEC protected-path guard needs no exemption) and no migration/supabase file was added", () => {
  const supa = git("diff", "--name-only", "origin/main", "HEAD", "--", "supabase").split("\n").filter(Boolean);
  assert.deepEqual(supa, [], "no tracked supabase/ change");
  assert.equal(fs.existsSync(path.join(root, "supabase/draft-proposals")), false);
  assert.ok(fs.existsSync(path.join(root, "docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS")));
  const added = git("diff", "--name-status", "origin/main", "--", "supabase/migrations").split("\n").filter((l) => /^A/.test(l));
  assert.deepEqual(added, []);
  const untrackedMig = git("ls-files", "--others", "--exclude-standard", "supabase/migrations").trim();
  assert.equal(untrackedMig, "");
});

test("S7 every dynamic string in the new UI goes through textContent/createTextNode or the escaper", () => {
  assert.equal(/\.innerHTML\s*=/.test(ui.replace(/panel\.replaceChildren/g, "")), false, "no innerHTML assignment in ui module");
  assert.equal(/insertAdjacentHTML|document\.write/.test(ui + core), false);
});

test("S8 Manage Products: pre-check never disables Confirm and never calls a writer itself", () => {
  const seg = products.slice(products.indexOf("async function toggleSkuActive"));
  const pre = seg.slice(0, seg.indexOf("const governance = await promptGovernance"));
  assert.equal(/governanceConfirm|disabled\s*=/.test(pre), false);
  assert.equal(/rpc_set_product_sku_active/.test(pre), false);
});

test("S9 products.js RPC surface differs from main by exactly the one read-only pre-check call", () => {
  const rpcs = (t) => [...t.matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]).sort();
  const base = rpcs(git("show", "origin/main:public/shared/js/products.js"));
  const now = rpcs(products);
  assert.deepEqual(now.filter((n) => !base.includes(n)), ["rpc_get_sku_activation_check"]);
  assert.deepEqual(base.filter((n) => !now.includes(n)), []);
  assert.equal((products.match(/\.from\(\s*["'`]/g) || []).length, (git("show", "origin/main:public/shared/js/products.js").match(/\.from\(\s*["'`]/g) || []).length);
});
