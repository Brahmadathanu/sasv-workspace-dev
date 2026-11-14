// WP08 G2-0 source-contract tests (no browser, no network, read-only).
//   node --test scripts/wp08-g2-0-shared-master-data/source.test.mjs
// Requires full git history for the "moved, not rewritten" check (git fetch --unshallow on a shallow clone).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { repoRoot, MODULES } from "./harness.mjs";

const BASE = "3f47b11517c0592c71d6c27bf3601ec5e3c51658"; // main at G2-0 start
const read = (p) => fs.readFileSync(path.join(repoRoot, p), "utf8").replace(/\r\n/g, "\n");
const exists = (p) => fs.existsSync(path.join(repoRoot, p));
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(path.join(repoRoot, p))).digest("hex");
const git = (...a) => execFileSync("git", a, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const HTML = MODULES.map((m) => m.file);
const JS = MODULES.map((m) => m.js);
const CANON_HTML = HTML.map((f) => `public/shared/${f}`);
const CANON_JS = JS.map((f) => `public/shared/js/${f}`);

test("one canonical source: pages and module scripts live in public/shared and nowhere else", () => {
  for (const p of [...CANON_HTML, ...CANON_JS, "public/shared/css/shared-ui.css", "public/shared/js/master-data-platform.js"]) assert.ok(exists(p), `${p} exists`);
  for (const f of JS) assert.ok(!exists(`js/${f}`), `legacy js/${f} must not remain (moved, not copied)`);
  assert.ok(!exists("css/shared-ui.css"), "legacy css/shared-ui.css must not remain");
  const tracked = git("ls-files").split("\n").filter(Boolean);
  for (const p of [...CANON_HTML, ...CANON_JS]) {
    const h = sha(p);
    const dup = tracked.filter((t) => t !== p && !t.startsWith("docs/") && exists(t) && fs.statSync(path.join(repoRoot, t)).size === fs.statSync(path.join(repoRoot, p)).size && sha(t) === h);
    assert.deepEqual(dup, [], `${p} has no byte-identical copy`);
  }
  for (const f of JS) assert.deepEqual(tracked.filter((t) => t.endsWith(`/${f}`) || t === f), [`public/shared/js/${f}`], `${f} appears exactly once`);
});

test("legacy root URLs are redirect stubs only: forward with query+hash, no module code, no copy", () => {
  for (const f of HTML) {
    const stub = read(f);
    assert.ok(stub.length < 900, `${f} stub is tiny`);
    assert.ok(stub.includes(`public/shared/${f}`));
    assert.match(stub, /location\.search \+ location\.hash/);
    assert.doesNotMatch(stub, /type="module"|supabase|<link rel="stylesheet"/);
  }
});

function refsOf(html) {
  return [...html.matchAll(/<(?:link|script|a)\b[^>]*?(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|data:)/.test(u));
}
function importsOf(js) {
  return [...js.matchAll(/(?:^|\n)\s*(?:import|export)\s[^"';]*?from\s*"([^"]+)"|import\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1] || m[2]).filter((u) => u && !/^https?:/.test(u));
}

const CLIENTS = {
  electron: { root: "", base: "/public/shared/" },
  pwa: { root: "public", base: "/shared/" },
};
function resolveUnder(client, fromUrl, ref) {
  const url = new URL(ref, `http://x${fromUrl}`);
  return { url, file: path.join(CLIENTS[client].root, decodeURIComponent(url.pathname)) };
}

test("every page reference and transitive module import resolves in BOTH the Electron root and the PWA public/ tree", () => {
  const checked = [];
  for (const m of MODULES) {
    for (const [client, cfg] of Object.entries(CLIENTS)) {
      const pageUrl = cfg.base + m.file;
      const html = read(`public/shared/${m.file}`);
      for (const ref of refsOf(html)) {
        if (m.file === "manage-products.html" && /season-profiles/.test(ref)) continue; // Electron-only by design; hidden on PWA (see browser test)
        const { file } = resolveUnder(client, pageUrl, ref);
        assert.ok(exists(file), `${client}: ${m.file} -> ${ref} -> ${file}`);
        checked.push(`${client}:${m.file}:${ref}`);
        if (/\.js$/.test(ref)) {
          // crawl module graph
          const seen = new Set();
          const walk = (fromUrl, filePath) => {
            if (seen.has(filePath)) return;
            seen.add(filePath);
            for (const imp of importsOf(fs.readFileSync(path.join(repoRoot, filePath), "utf8"))) {
              const r = resolveUnder(client, fromUrl, imp);
              assert.ok(exists(r.file), `${client}: ${filePath} imports ${imp} -> ${r.file}`);
              walk(r.url.pathname, r.file);
            }
          };
          walk(resolveUnder(client, pageUrl, ref).url.pathname, file);
        }
      }
    }
  }
  assert.ok(checked.length >= 30);
});

test("no page-relative index.html / login.html and no root-relative asset paths remain in the shared pages", () => {
  for (const p of [...CANON_JS, ...CANON_HTML]) {
    const t = read(p);
    assert.doesNotMatch(t, /location\.href\s*=\s*"index\.html"/, `${p} HOME`);
    assert.doesNotMatch(t, /loginPage:\s*"login\.html"/, `${p} login`);
    assert.doesNotMatch(t, /\.\.\/public\/shared\//, `${p} import`);
    assert.doesNotMatch(t, /(?:href|src)="(?:public\/shared|css)\//, `${p} root-relative`);
  }
});

test("permission keys are preserved exactly (PM BOM stays module:pm-templates)", () => {
  assert.match(read("public/shared/js/products.js"), /const MODULE_TARGET = "module:manage-products";/);
  assert.match(read("public/shared/js/manage-rm-bom.js"), /const MODULE_ID = "manage-rm-bom";/);
  assert.match(read("public/shared/js/manage-sp-bom.js"), /const MODULE_ID = "manage-sp-bom";/);
  const pm = read("public/shared/js/manage-pm-bom.js");
  assert.match(pm, /const MODULE_ID = "pm-templates";/);
  assert.doesNotMatch(pm, /module:manage-pm-bom|"manage-pm-bom"/);
  for (const p of [...CANON_JS, ...CANON_HTML]) assert.doesNotMatch(read(p), /module:manage-pm-bom/);
});

test("moved, not rewritten: only allow-listed navigation/import/path lines differ from the base commit", () => {
  try { git("cat-file", "-e", `${BASE}^{commit}`); } catch { assert.fail(`needs ${BASE} (full history): git fetch --unshallow`); }
  const pairs = [["manage-products.html", "public/shared/manage-products.html"], ["manage-rm-bom.html", "public/shared/manage-rm-bom.html"], ["manage-pm-bom.html", "public/shared/manage-pm-bom.html"], ["manage-sp-bom.html", "public/shared/manage-sp-bom.html"], ["js/products.js", "public/shared/js/products.js"], ["js/manage-rm-bom.js", "public/shared/js/manage-rm-bom.js"], ["js/manage-pm-bom.js", "public/shared/js/manage-pm-bom.js"], ["js/manage-sp-bom.js", "public/shared/js/manage-sp-bom.js"], ["css/shared-ui.css", "public/shared/css/shared-ui.css"]];
  const allow = [
    /^import \{ (?:supabase|bootstrapApp|mountModuleHome) \} from "(?:\.\.\/public\/shared\/js\/|\.\/)[A-Za-z-]+\.js";$/,
    /^\} from "(?:\.\.\/public\/shared\/js\/|\.\/)sasv-module-chrome\.js";$/,
    /^import \{ resolveMasterDataLoginPage, goMasterDataHome \} from "\.\/master-data-platform\.js";$/,
    /^import \{$/, /^  resolveMasterDataLoginPage,$/, /^  goMasterDataHome,$/, /^  resolveSeasonProfilesHref,$/, /^\} from "\.\/master-data-platform\.js";$/,
    /bootstrapApp\(\{ loginPage: (?:"login\.html"|resolveMasterDataLoginPage\(\)) \}\)/,
    /^\s*(?:window\.location\.href = "index\.html"|goMasterDataHome\(\));$/,
    /<link rel="stylesheet" href="(?:public\/shared\/css|css|\.\.\/shared\/css)\/[a-z-]+\.css" \/>/,
    /<script type="module" src="(?:public\/shared\/js|js)\/(?:supabaseClient|products|manage-[a-z]+-bom)\.js"><\/script>/,
    /manage-season-profiles\.html/,
    /Season Profiles exists only|const seasonProfilesLink|if \(seasonProfilesLink\)|const seasonHref|if \(seasonHref\)|else seasonProfilesLink\.hidden|^\s*\}$|^\s*$/,
    /homeBtn\?\.addEventListener\("click", \(\) =>|window\.Platform &&|\? window\.Platform\.goHome\(\)|: \(window\.location\.href = "index\.html"\)|^\s*\);$|homeBtn\?\.addEventListener\("click", \(\) => goMasterDataHome\(\)\);/,
    /^window\.addEventListener\("DOMContentLoaded", async \(\) => \{$|^  const boot = await bootstrapApp\(/,
  ];
  for (const [oldP, newP] of pairs) {
    const tmp = path.join(os.tmpdir(), `g2-0-base-${crypto.randomBytes(4).toString("hex")}-${path.basename(oldP)}`);
    fs.writeFileSync(tmp, git("show", `${BASE}:${oldP}`));
    const headTmp = `${tmp}.head`;
    fs.writeFileSync(headTmp, read(newP));
    let out = "";
    try { execFileSync("diff", ["-U0", tmp, headTmp], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); } catch (e) { out = e.stdout || ""; }
    fs.rmSync(tmp, { force: true });
    fs.rmSync(headTmp, { force: true });
    const changed = out.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l)).map((l) => l.slice(1));
    const total = git("show", `${BASE}:${oldP}`).split("\n").length;
    assert.ok(changed.length < Math.max(40, total * 0.01), `${newP}: ${changed.length} changed lines of ${total} is a move, not a rewrite`);
    for (const l of changed) assert.ok(allow.some((re) => re.test(l)), `${newP}: unexpected change: ${l.trim().slice(0, 120)}`);
  }
});

test("writer / reader surface is unchanged: identical RPC names, table names and permission strings vs base", () => {
  const tokens = (t) => ({
    rpc: [...t.matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]).sort(),
    from: [...t.matchAll(/\.from\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]).sort(),
    perm: [...t.matchAll(/module:[a-z-]+/g)].map((m) => m[0]).sort(),
  });
  const map = [["js/products.js", "public/shared/js/products.js"], ["js/manage-rm-bom.js", "public/shared/js/manage-rm-bom.js"], ["js/manage-pm-bom.js", "public/shared/js/manage-pm-bom.js"], ["js/manage-sp-bom.js", "public/shared/js/manage-sp-bom.js"]];
  for (const [o, n] of map) {
    const before = tokens(git("show", `${BASE}:${o}`));
    const after = tokens(read(n));
    assert.deepEqual(after, before, `${n} data/permission surface`);
    assert.ok(before.rpc.length > 0);
  }
});

test("shared-ui.css consumers all resolve after the move (including the previously Electron-only console)", () => {
  const consumers = git("grep", "-l", "shared-ui.css", "--", "*.html").split("\n").filter(Boolean);
  assert.ok(consumers.length >= 8);
  for (const f of consumers) {
    const t = read(f);
    const m = t.match(/href="([^"]*shared-ui\.css)"/);
    assert.ok(m, f);
    const abs = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
    assert.equal(abs, "public/shared/css/shared-ui.css", `${f} -> ${m[1]}`);
  }
});

test("platform helper: Electron vs PWA targets, and no data access or writes in the helper", async () => {
  const mod = await import("../../public/shared/js/master-data-platform.js").catch(() => null);
  // platform.js touches window at call time only; helper functions accept an injected platform for this test.
  assert.ok(mod);
  assert.equal(mod.resolveMasterDataLoginPage({ isElectron: true }), "/login.html");
  assert.equal(mod.resolveMasterDataLoginPage({ isElectron: false }), "/utilities-hub/index.html");
  assert.equal(mod.resolveMasterDataHomePath({ isElectron: true }), "/index.html");
  assert.equal(mod.resolveMasterDataHomePath({ isElectron: false }), "/utilities-hub/index.html");
  assert.equal(mod.resolveSeasonProfilesHref({ isElectron: true }), "../../manage-season-profiles.html");
  assert.equal(mod.resolveSeasonProfilesHref({ isElectron: false }), null);
  assert.doesNotMatch(read("public/shared/js/master-data-platform.js"), /supabase|\.rpc\(|\.from\(|localStorage/);
});

test("service worker change is minimal: only added network-first patterns for the shared Master Data modules, CACHE_NAME unchanged", () => {
  const diff = git("diff", "-U0", "--no-color", BASE, "HEAD", "--", "public/sw.js");
  const changed = diff.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  assert.ok(changed.length <= 10, `sw.js diff is ${changed.length} lines`);
  assert.ok(!changed.some((l) => /CACHE_NAME/.test(l)), "no cache-version change");
  const added = changed.filter((l) => l.startsWith("+")).join("\n");
  assert.match(added, /WP08 G2-0/);
  assert.match(added, /products\|manage-rm-bom\|manage-pm-bom\|manage-sp-bom\|master-data-platform/);
  assert.match(added, /shared-ui\|sasv-bom/);
  assert.equal((read("public/sw.js").match(/const CACHE_NAME = "hub-cache-v393"/g) ?? []).length, 1);
});

test("scope guard: no G2-1 bridges, no resolver/PPM/registry-config/sw/flag changes in this package", () => {
  const changed = git("diff", "--name-only", BASE, "HEAD").split("\n").filter(Boolean);
  const forbidden = [/costing-suite-recommended-ui-route/, /costing-suite-pricing-policy/, /costing-suite-shell/, /costing-route-config/, /costing-suite-registry/, /costing-feature-flags/, /^supabase\//, /^main\.js$/, /^preload\.js$/, /^public\/netlify\.toml$/, /module-registry\.js$/];
  for (const f of changed) for (const re of forbidden) assert.doesNotMatch(f, re, `forbidden file changed: ${f}`);
  for (const p of CANON_JS) assert.doesNotMatch(read(p), /URLSearchParams|location\.search/, `${p} adds no deep-link consumer`);
});

test("registry proposal files exist, are outside supabase/migrations, and keep PM BOM on pm-templates (behaviour is covered by registry-sql.test.mjs)", () => {
  const dir = "docs/master-data-costing/WP08_G2_0_REGISTRY_PROPOSAL_UNAPPLIED";
  const files = ["README.md", "01_preflight_and_before_select.sql", "02_apply_pwa_client_rows.sql", "03_optional_repoint_electron_routes.sql", "98_rollback_step_b_electron.sql", "99_rollback_step_a_pwa.sql"];
  for (const f of files) assert.ok(exists(`${dir}/${f}`), f);
  assert.ok(!exists(`${dir}/99_rollback.sql`), "the old overwriting-era rollback is gone");
  assert.ok(!git("ls-files", "supabase/migrations").split("\n").some((f) => /g2[_-]?0|master_data_pwa/i.test(f)), "must not be in supabase/migrations");
  const all = files.filter((f) => f.endsWith(".sql")).map((f) => read(`${dir}/${f}`)).join("\n");
  assert.match(all, /'pm-templates'/);
  assert.doesNotMatch(all, /manage-pm-bom'/);
  assert.doesNotMatch(all, /on conflict/i, "no upsert in any script");
  assert.match(all, /UNAPPLIED/);
});
