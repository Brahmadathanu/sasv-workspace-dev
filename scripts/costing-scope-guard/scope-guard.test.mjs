// Negative controls for scripts/lib/costing-scope-guard.mjs.
// Builds a throwaway git repo (os.tmpdir, no network), commits a Costing "base", then applies one change per
// case and checks that the guard flags protected Costing / shared-contract / supabase changes and ignores
// unrelated-module changes such as WP-07 e-Aushadhi HTML, CSS and a non-Costing migration.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { costingScopeReport, costingCssScope, costingHtmlScope } from "../lib/costing-scope-guard.mjs";

const FILES = {
  "package.json": '{ "name": "fixture" }\n',
  "public/shared/costing-control-center.html": '<link rel="stylesheet" href="../shared/css/style.css" />\n<link rel="stylesheet" href="../shared/css/sasv-costing.css" />\n',
  "public/shared/pricing-policy-manager.html": '<link rel="stylesheet" href="css/style.css" />\n',
  "public/shared/e-aushadhi-review-control.html": '<link rel="stylesheet" href="css/sasv-eaushadhi-review.css" />\n',
  "public/shared/css/style.css": '@import "./design-tokens.css";\n@import "./sasv-module.css";\n',
  "public/shared/css/design-tokens.css": ":root { --x: 1; }\n",
  "public/shared/css/sasv-module.css": ".m { color: red; }\n",
  "public/shared/css/sasv-costing.css": ".c { color: blue; }\n",
  "public/shared/css/sasv-eaushadhi-review.css": ".e { color: green; }\n",
  "supabase/config.toml": "project_id = \"fixture\"\n",
  "supabase/migrations/20260101000000_costing_base.sql": "create table costing.t (id int);\n",
};

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "costing-scope-guard-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "-q");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "fixture");
  git("config", "core.autocrlf", "false");
  for (const [rel, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
    git("add", "-A");
  };
  const report = () => costingScopeReport({ git, root: dir, base });
  return { dir, git, base, write, report, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const empty = (r) => r.html.length === 0 && r.css.length === 0 && r.supabase.length === 0 && r.packageJson.length === 0;

test("scope: Costing pages, linked styles and the shared @import chain are in scope; other modules are not", (t) => {
  const repo = makeRepo();
  t.after(repo.cleanup);
  const html = costingHtmlScope({ git: repo.git, base: repo.base });
  const css = costingCssScope({ git: repo.git, root: repo.dir, base: repo.base });
  assert.ok(html.includes("public/shared/costing-control-center.html"));
  assert.ok(!html.includes("public/shared/e-aushadhi-review-control.html"));
  for (const f of ["style.css", "design-tokens.css", "sasv-module.css", "sasv-costing.css"]) assert.ok(css.includes(`public/shared/css/${f}`), f);
  assert.ok(!css.includes("public/shared/css/sasv-eaushadhi-review.css"));
  assert.ok(empty(repo.report()), "clean tree has no violations");
});

test("control: unrelated-module HTML, CSS and a non-Costing migration are NOT violations (WP-07 shape)", (t) => {
  const repo = makeRepo();
  t.after(repo.cleanup);
  repo.write("public/shared/e-aushadhi-review-control.html", FILES["public/shared/e-aushadhi-review-control.html"] + "<p>wp07</p>\n");
  repo.write("public/shared/css/sasv-eaushadhi-review.css", FILES["public/shared/css/sasv-eaushadhi-review.css"] + ".e2 {}\n");
  repo.write("supabase/migrations/20261024115131_wp07_ux1_roles_worklist.sql", "create table regulatory.eaushadhi_role (id int);\n");
  assert.ok(empty(repo.report()), JSON.stringify(repo.report()));
});

const negatives = [
  ["Costing page HTML edited", (r) => r.write("public/shared/costing-control-center.html", "<p>changed</p>\n"), (rep) => rep.html.includes("public/shared/costing-control-center.html")],
  ["known Costing page edited", (r) => r.write("public/shared/pricing-policy-manager.html", "<p>changed</p>\n"), (rep) => rep.html.includes("public/shared/pricing-policy-manager.html")],
  ["new costing-*.html page added", (r) => r.write("public/shared/costing-new-screen.html", "<p>new</p>\n"), (rep) => rep.html.includes("public/shared/costing-new-screen.html")],
  ["Costing CSS edited", (r) => r.write("public/shared/css/sasv-costing.css", ".c { color: black; }\n"), (rep) => rep.css.includes("public/shared/css/sasv-costing.css")],
  ["shared style.css edited", (r) => r.write("public/shared/css/style.css", '@import "./design-tokens.css";\n'), (rep) => rep.css.includes("public/shared/css/style.css")],
  ["@import-chain stylesheet edited", (r) => r.write("public/shared/css/sasv-module.css", ".m { color: blue; }\n"), (rep) => rep.css.includes("public/shared/css/sasv-module.css")],
  ["design tokens edited", (r) => r.write("public/shared/css/design-tokens.css", ":root { --x: 2; }\n"), (rep) => rep.css.includes("public/shared/css/design-tokens.css")],
  ["existing migration modified", (r) => r.write("supabase/migrations/20260101000000_costing_base.sql", "create table costing.t (id bigint);\n"), (rep) => rep.supabase.some((v) => v.startsWith("M supabase/migrations/20260101000000_costing_base.sql"))],
  ["existing migration deleted", (r) => { fs.rmSync(path.join(r.dir, "supabase/migrations/20260101000000_costing_base.sql")); r.git("add", "-A"); }, (rep) => rep.supabase.some((v) => v.startsWith("D supabase/migrations/20260101000000_costing_base.sql"))],
  ["new migration touching costing added", (r) => r.write("supabase/migrations/20261101000000_x.sql", "alter table costing.t add column y int;\n"), (rep) => rep.supabase.some((v) => v.includes("added migration touches costing"))],
  ["supabase config changed", (r) => r.write("supabase/config.toml", 'project_id = "other"\n'), (rep) => rep.supabase.some((v) => v.includes("supabase/config.toml"))],
  ["file added outside supabase/migrations", (r) => r.write("supabase/functions/x/index.ts", "export {};\n"), (rep) => rep.supabase.some((v) => v.includes("outside supabase/migrations/"))],
  ["package.json changed", (r) => r.write("package.json", '{ "name": "changed" }\n'), (rep) => rep.packageJson.includes("package.json")],
];

for (const [label, apply, detected] of negatives) {
  test(`negative control: ${label} is detected`, (t) => {
    const repo = makeRepo();
    t.after(repo.cleanup);
    apply(repo);
    const rep = repo.report();
    assert.ok(detected(rep), `${label} not detected: ${JSON.stringify(rep)}`);
    assert.ok(!empty(rep));
  });
}

test("negative control: unstaged working-tree edit to a Costing page is detected (git diff base semantics)", (t) => {
  const repo = makeRepo();
  t.after(repo.cleanup);
  fs.writeFileSync(path.join(repo.dir, "public/shared/costing-control-center.html"), "<p>unstaged</p>\n");
  assert.ok(repo.report().html.includes("public/shared/costing-control-center.html"));
});
