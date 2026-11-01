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
import { costingScopeReport, costingCssScope, costingHtmlScope, sqlTouchesCosting } from "../lib/costing-scope-guard.mjs";

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
  ...[
    ["schema-qualified table", "alter table costing.sku_sales_allocation_basis_snapshot add column z int;\n"],
    ["public costing_refresh_run", "create or replace view public.costing_refresh_run as select 1;\n"],
    ["costing_cost_snapshot", "create table public.costing_cost_snapshot (id int);\n"],
    ["suffixed name", "drop view if exists public.v_current_successful_costing_refresh_run;\n"],
    ["function name", "create function public.fn_costing_view_allowed() returns boolean language sql as $$select true$$;\n"],
    ["grant to costing role", "grant select on some_table to costing_admin;\n"],
    ["policy on costing table", "create policy p on costing.cost_periods for select using (true);\n"],
    ["quoted mixed case", 'alter table "Costing"."Thing" rename to x;\n'],
    ["comment on costing object", "comment on table costing.cost_periods is 'x';\n"],
  ].map(([name, sql]) => [`added migration: ${name}`, (r) => r.write("supabase/migrations/20261101000001_" + name.replace(/\W+/g, "_") + ".sql", sql), (rep) => rep.supabase.some((v) => v.includes("added migration touches costing"))]),
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

test("sqlTouchesCosting: Costing identifiers match; unrelated WP-07 and look-alike words do not", () => {
  for (const sql of ["costing.x", "public.costing_refresh_run", "costing_cost_snapshot", "x_costing_y", "FN_COSTING_VIEW", "select * from \"costing\".t", "-- costing note"]) {
    assert.equal(sqlTouchesCosting(sql), true, sql);
  }
  for (const sql of ["create table regulatory.eaushadhi_role (id int);", "alter table regulatory.source_composition_line add column a int;", "accosting", "costings", "costing2", "discosting_x", ""]) {
    assert.equal(sqlTouchesCosting(sql), false, sql);
  }
});

test("positive control: realistic unrelated WP-07 migrations are allowed", (t) => {
  const repo = makeRepo();
  t.after(repo.cleanup);
  repo.write("supabase/migrations/20261024115131_wp07_ux1_roles_worklist.sql", [
    "create table if not exists regulatory.eaushadhi_review_role (user_id uuid primary key, role text not null);",
    "create or replace function public.rpc_eaushadhi_my_roles_v1() returns jsonb language sql security definer as $$ select '{}'::jsonb $$;",
    "grant execute on function public.rpc_eaushadhi_my_roles_v1() to authenticated;",
    "create policy wp07_roles_read on regulatory.eaushadhi_review_role for select using (true);",
  ].join("\n") + "\n");
  repo.write("supabase/migrations/20261031102139_wp07_ux9_source_reference_bulk.sql", "create table regulatory.source_reference_bulk_request (id uuid primary key);\n");
  assert.deepEqual(repo.report().supabase, []);
});

test("regression: real WP-07 migration in this repository is allowed, real Costing migrations are flagged", () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const read = (f) => fs.readFileSync(path.join(root, "supabase/migrations", f), "utf8");
  assert.equal(sqlTouchesCosting(read("20261024115131_wp07_ux1_roles_worklist.sql")), false);
  assert.equal(sqlTouchesCosting(read("20260802142952_grant_production_route_manager_to_costing_admin.sql")), true);
  assert.equal(sqlTouchesCosting(read("20260916142052_retire_obsolete_public_period_only_costing_review_writer.sql")), true);
});
