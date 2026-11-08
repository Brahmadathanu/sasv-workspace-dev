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
import { fileURLToPath } from "node:url";
import { costingScopeReport, costingCssScope, costingHtmlScope, sqlTouchesCosting, stripSqlComments } from "../lib/costing-scope-guard.mjs";

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
  for (const sql of ["costing.x", "public.costing_refresh_run", "costing_cost_snapshot", "x_costing_y", "FN_COSTING_VIEW", "select * from \"costing\".t"]) {
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
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const read = (f) => fs.readFileSync(path.join(root, "supabase/migrations", f), "utf8");
  assert.equal(sqlTouchesCosting(read("20261024115131_wp07_ux1_roles_worklist.sql")), false);
  assert.equal(sqlTouchesCosting(read("20260802142952_grant_production_route_manager_to_costing_admin.sql")), true);
  assert.equal(sqlTouchesCosting(read("20260916142052_retire_obsolete_public_period_only_costing_review_writer.sql")), true);
});

// ---- 4 Nov 2026: SQL comments are not Costing changes; executable SQL, strings and history rules still are ------------
test("comments: a migration that only mentions costing in -- or /* */ comments is not a Costing change", () => {
  for (const sql of [
    "-- costing note\nselect 1;",
    "select 1; -- no changes to costing\n",
    "/* costing */ select 1;",
    "/* outer /* nested costing */ still comment costing */ select 1;",
    "-- No changes to activity data, foreign keys, production routes, or costing.\nbegin;\ncreate policy p on public.activities for select using (true);\n",
    "-- costing.x\n-- costing_admin\ndrop policy if exists a on public.activities;",
  ]) assert.equal(sqlTouchesCosting(sql), false, sql);
});

test("comments: executable SQL, quoted identifiers, string literals and dollar-quoted bodies still match", () => {
  for (const sql of [
    "select 1; /* x */ grant select on t to costing_admin;",
    "-- harmless\nalter table costing.t add column y int;",
    "alter table /* c */ costing.t add column y int;",
    'select 1 from "costing".t;',
    "comment on table public.t is 'costing review';",
    "insert into perms values ('module:costing-control-center');",
    "insert into t values ('-- costing');",
    "insert into t values ('/* costing */');",
    "select 'it''s' , 'costing';",
    "select E'\\' -- costing';",
    "create function public.f() returns int language sql as $$ select 1 -- costing\n$$;",
    "create function public.f() returns int language plpgsql as $body$ begin perform costing.f(); end $body$;",
    "drop policy x on costing.cost_periods;",
    "grant execute on function public.rpc_costing_health_check() to authenticated;",
    "create schema costing;",
  ]) assert.equal(sqlTouchesCosting(sql), true, sql);
});

test("comments: stripSqlComments keeps strings, identifiers and dollar quotes, drops only comments, and never swallows following code", () => {
  assert.equal(stripSqlComments("a -- c\nb"), "a  \nb");
  assert.equal(stripSqlComments("a /* c */ b"), "a   b");
  assert.equal(stripSqlComments("'-- not a comment' x"), "'-- not a comment' x");
  assert.equal(stripSqlComments('"a--b" x'), '"a--b" x');
  assert.equal(stripSqlComments("$$ -- kept $$ x"), "$$ -- kept $$ x");
  assert.equal(stripSqlComments("$t$ /* kept */ $t$ x"), "$t$ /* kept */ $t$ x");
  assert.ok(stripSqlComments("/* open costing.x").indexOf("costing") === -1, "unterminated block comment hides only its own text");
  assert.ok(stripSqlComments("select 'open costing.x").includes("costing"), "unterminated string is kept");
  assert.equal(stripSqlComments(null), "");
  assert.equal(stripSqlComments("a--b\r\nc"), "a \nc", "CRLF: the comment (its carriage return included) ends at the line feed; the next line is kept");
});

test("comments: CRLF sources are handled identically", () => {
  assert.equal(sqlTouchesCosting("-- costing note\r\nselect 1;\r\n"), false);
  assert.equal(sqlTouchesCosting("-- note\r\ngrant select on t to costing_admin;\r\n"), true);
});

test("comments: the real Manage Activities migration (#166) is allowed; its mention of costing is in a comment only", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const f = "supabase/migrations/20261104131055_manage_activities_module_edit_rls_guard.sql";
  const sql = fs.readFileSync(path.join(root, f), "utf8");
  assert.match(sql, /costing/i, "fixture assumption: the file does mention costing");
  assert.equal(sqlTouchesCosting(sql), false);
});

test("report level: comment-only mention is allowed; same text made executable, or hidden after a comment, is flagged", (t) => {
  const ok = makeRepo(); t.after(ok.cleanup);
  ok.write("supabase/migrations/20261104131055_unrelated.sql", "-- No changes to production routes, or costing.\nbegin;\ndrop policy if exists a on public.activities;\ncommit;\n");
  assert.deepEqual(ok.report().supabase, []);
  for (const [name, sql] of [
    ["executable", "-- No changes to production routes.\nalter table costing.t add column y int;\n"],
    ["after a block comment on one line", "/* note */ grant select on public.t to costing_admin;\n"],
    ["comment-on text", "-- note\ncomment on table public.activities is 'feeds costing';\n"],
    ["policy on costing table", "create policy p on costing.cost_periods for select using (true);\n"],
    ["crlf executable", "-- note\r\nalter table costing.t add column y int;\r\n"],
  ]) {
    const repo = makeRepo(); t.after(repo.cleanup);
    repo.write("supabase/migrations/20261104131056_x.sql", sql);
    assert.ok(repo.report().supabase.some((v) => v.includes("added migration touches costing")), name);
  }
});

test("report level: migration-history, config and out-of-migrations rules are unchanged by the comment rule", (t) => {
  const cases = [
    ["existing migration modified (comment only)", (r) => r.write("supabase/migrations/20260101000000_costing_base.sql", "-- reworded\ncreate table costing.t (id int);\n"), /^M supabase\/migrations\/20260101000000_costing_base\.sql/],
    ["existing migration appended with a comment", (r) => r.write("supabase/migrations/20260101000000_costing_base.sql", FILES["supabase/migrations/20260101000000_costing_base.sql"] + "-- note\n"), /^M /],
    ["config changed", (r) => r.write("supabase/config.toml", 'project_id = "x"\n'), /supabase\/config\.toml/],
    ["function file added", (r) => r.write("supabase/functions/x/index.ts", "// costing\nexport {};\n"), /outside supabase\/migrations\//],
  ];
  for (const [name, apply, re] of cases) {
    const repo = makeRepo(); t.after(repo.cleanup);
    apply(repo);
    assert.ok(repo.report().supabase.some((v) => re.test(v)), name);
  }
});

// ---- APPROVED_COSTING_SUPABASE_FILES: exact, content-hash-pinned added files (Scheme Master migration, issue #211 B) ----
import crypto from "node:crypto";
const hashLf = (t) => crypto.createHash("sha256").update(String(t).replace(/\r\n/g, "\n")).digest("hex");
const MIG_REL = "supabase/migrations/20261101000009_approved_costing_view.sql", MIG_SQL = "create or replace view public.v_x as select 1 from costing.t;\n";
const ROLL_REL = "supabase/rollback-evidence/20261101000009_approved_costing_view_pre.sql";
const approvedList = [{ package: "fixture", rel: MIG_REL, sha256: hashLf(MIG_SQL) }, { package: "fixture rollback", rel: ROLL_REL, sha256: hashLf(MIG_SQL + "-- rollback\n") }];

test("approved Costing migration: the exact pinned content at the exact path is tolerated (LF or CRLF), including its recovery-only rollback file outside supabase/migrations", (t) => {
  const repo = makeRepo(); t.after(repo.cleanup);
  repo.write(MIG_REL, MIG_SQL.replace(/\n/g, "\r\n")); repo.write(ROLL_REL, MIG_SQL + "-- rollback\n");
  const r = costingScopeReport({ git: repo.git, root: repo.dir, base: repo.base, approvedSupabase: approvedList });
  assert.deepEqual(r.supabase, [], JSON.stringify(r.supabase));
});

test("approved Costing migration negatives: edited content, renamed path, a second Costing migration, an unapproved rollback file and the default (empty-for-fixtures) list are all still violations", (t) => {
  const edit = makeRepo(); t.after(edit.cleanup);
  edit.write(MIG_REL, MIG_SQL.replace("select 1", "select 2"));
  assert.ok(costingScopeReport({ git: edit.git, root: edit.dir, base: edit.base, approvedSupabase: approvedList }).supabase.some((v) => v.includes(MIG_REL)), "edited content");
  const ren = makeRepo(); t.after(ren.cleanup);
  ren.write("supabase/migrations/20261101000010_renamed.sql", MIG_SQL);
  assert.ok(costingScopeReport({ git: ren.git, root: ren.dir, base: ren.base, approvedSupabase: approvedList }).supabase.some((v) => v.includes("renamed")), "renamed path");
  const two = makeRepo(); t.after(two.cleanup);
  two.write(MIG_REL, MIG_SQL); two.write("supabase/migrations/20261101000011_second.sql", "alter table costing.t add column z int;\n");
  const tw = costingScopeReport({ git: two.git, root: two.dir, base: two.base, approvedSupabase: approvedList }).supabase;
  assert.equal(tw.length, 1); assert.ok(tw[0].includes("second"), "only the unlisted second migration is reported");
  const roll = makeRepo(); t.after(roll.cleanup);
  roll.write(ROLL_REL, MIG_SQL + "-- different\n");
  assert.ok(costingScopeReport({ git: roll.git, root: roll.dir, base: roll.base, approvedSupabase: approvedList }).supabase.some((v) => v.includes("outside supabase/migrations")), "edited rollback file");
  const def = makeRepo(); t.after(def.cleanup);
  def.write(MIG_REL, MIG_SQL);
  assert.ok(def.report().supabase.some((v) => v.includes(MIG_REL)), "fixture file is not in the real approved list");
});

test("approval cannot launder an existing-file change: a modified or deleted existing migration stays a violation even if its new hash is listed", (t) => {
  const repo = makeRepo(); t.after(repo.cleanup);
  const rel = "supabase/migrations/20260101000000_costing_base.sql", changed = "create table costing.t (id bigint);\n";
  repo.write(rel, changed);
  const r = costingScopeReport({ git: repo.git, root: repo.dir, base: repo.base, approvedSupabase: [{ package: "fixture", rel, sha256: hashLf(changed) }] });
  assert.ok(r.supabase.some((v) => v.startsWith("M supabase/migrations/20260101000000_costing_base.sql")));
});
