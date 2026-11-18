// WP10 four-master client regression guard: the four classification modules (and the rest of the shipped client tree) must not perform direct
// INSERT/UPDATE/UPSERT/DELETE against categories / sub_categories / product_groups / sub_groups. Offline. Run: node --test scripts/wp10-four-master-stage-a/client-direct-write-guard.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { scan } from "./client-write-scanner.mjs";

const read = (p) => fs.readFileSync(p, "utf8");
const MODULES = {
  "js/categories.js": ["rpc_wp10_create_category", "rpc_wp10_rename_category", "rpc_wp10_delete_category"],
  "js/subcategories.js": ["rpc_wp10_create_subcategory", "rpc_wp10_rename_subcategory", "rpc_wp10_delete_subcategory"],
  "js/product-groups.js": ["rpc_wp10_create_product_group", "rpc_wp10_rename_product_group", "rpc_wp10_delete_product_group"],
  "js/subgroups.js": ["rpc_wp10_create_subgroup", "rpc_wp10_rename_subgroup", "rpc_wp10_delete_subgroup"],
};
const HELPERS = ["js/classification-master-access.js", "js/classification-html-escape.js"];
const HTML = ["manage-categories.html", "manage-subcategories.html", "manage-product-groups.html", "manage-subgroups.html"];

for (const [file, rpcs] of Object.entries(MODULES)) {
  test(`G1 ${file}: STRICT — reads only, exactly the 3 governed RPCs, no direct write / fetch / REST / dynamic table`, () => {
    assert.deepEqual(scan(read(file), { strict: true, allowedRpc: rpcs }), []);
    for (const r of rpcs) assert.ok(read(file).includes(`'${r}'`) || read(file).includes(`"${r}"`), `${r} must still be called (client behaviour preserved)`);
  });
}
for (const f of [...HELPERS, ...HTML]) test(`G2 ${f}: no direct write path (shared helper / page inline script)`, () => assert.deepEqual(scan(read(f), { strict: false }), []));

function* walk(dir) {
  const skip = new Set(["node_modules", ".git", "dist", "vendor", "docs", "scripts", "supabase", "sql", ".github"]);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else if (/\.(js|mjs|cjs|html)$/.test(e.name)) yield p;
  }
}
test("G3 repo-wide shipped client tree (root, public, electron, js): no direct write on the four tables from ANY file, no dynamic from() write", () => {
  const bad = []; let files = 0;
  for (const f of walk(".")) { files++; for (const x of scan(read(f))) bad.push(`${f}:${x.line} ${x.kind} ${x.detail}`); }
  assert.ok(files > 100, "walked the client tree (" + files + " files)");
  assert.deepEqual(bad, []);
});
test("G4 Electron main/preload never reference the four tables", () => {
  for (const f of ["main.js", "preload.js", ...fs.readdirSync("electron", { recursive: true }).filter((x) => /\.(js|cjs|mjs)$/.test(String(x))).map((x) => path.join("electron", String(x)))]) {
    assert.doesNotMatch(read(f), /\b(categories|sub_categories|product_groups|sub_groups)\b/, f);
  }
});

// ---- scanner self-tests (negative controls): the guard must bite ----
const bad = (src, kind, opts) => { const r = scan(src, opts); assert.ok(r.some((x) => x.kind === kind), `expected ${kind}, got ${JSON.stringify(r)}`); };
test("G5 scanner flags direct writes: plain, multi-line, long-gap, upsert, delete, spacing/quotes", () => {
  bad("await supabase.from('categories').insert({ category_name: n });", "DIRECT_WRITE");
  bad("await supabase\n  .from(\"sub_categories\")\n  .update({ a: 1 })\n  .eq('id', 1);", "DIRECT_WRITE");
  bad("supabase.from( 'product_groups' )\n" + "\n".repeat(80) + "  // c\n  .upsert([{a:1}]);", "DIRECT_WRITE");
  bad("supabase.from('sub_groups').delete().eq('id', 1)", "DIRECT_WRITE");
  bad("supabase.from('sub_groups').select('*').eq('id',1).delete()", "DIRECT_WRITE");
  bad("supabase.from('public.categories').insert(x)", "DIRECT_WRITE");
  bad("supabase.from(`categories`).insert(x)", "DIRECT_WRITE");
});
test("G6 scanner flags aliasing, dynamic table names, REST and strict-mode side doors", () => {
  bad("const q = supabase.from('categories'); await q.insert(x);", "NON_SELECT_START");
  bad("const T = 'sub_groups'; await supabase.from(T).delete().eq('id',1);", "DYNAMIC_FROM_WRITE");
  bad("await supabase.from(table).upsert(rows)", "DYNAMIC_FROM_WRITE");
  bad("fetch(url + '/rest/v1/categories', { method: 'POST' })", "REST_PATH");
  bad("const T='x'; supabase.from(T).select()", "STRICT_DYNAMIC_FROM", { strict: true });
  bad("supabase.from('products').select()", "STRICT_UNLISTED_TABLE", { strict: true });
  bad("fetch('/x')", "STRICT_NETWORK_SIDE_DOOR", { strict: true });
  bad("rows.delete(1)", "STRICT_WRITE_METHOD", { strict: true });
  bad("supabase.rpc('rpc_wp10_delete_category_force', {})", "STRICT_UNLISTED_RPC", { strict: true, allowedRpc: ["rpc_wp10_delete_category"] });
  bad("supabase.rpc(name, {})", "STRICT_DYNAMIC_RPC", { strict: true, allowedRpc: ["x"] });
});
test("G7 scanner does NOT flag legitimate reads, governed RPCs, comments, storage/Array.from or writes to other tables", () => {
  const ok = [
    "const { data } = await supabase.from('categories').select('id, category_name').order('category_name');",
    "await supabase.rpc('rpc_wp10_create_category', { p_name: n });",
    "// supabase.from('categories').insert({})\n/* supabase.from('sub_groups').delete() */ const a = 1;",
    "supabase.storage.from('bucket').remove([p]); Array.from(x); Buffer.from(y);",
    "await supabase.from('products').insert(row); await supabase.from('marketing_overrides_staging').delete();",
  ];
  for (const src of ok) assert.deepEqual(scan(src), [], src);
});
test("G8 mutation on the REAL files: injecting a direct write into each of the four modules is detected (guard bites on shipped source)", () => {
  for (const [file, rpcs] of Object.entries(MODULES)) {
    const src = read(file);
    const tbl = { "js/categories.js": "categories", "js/subcategories.js": "sub_categories", "js/product-groups.js": "product_groups", "js/subgroups.js": "sub_groups" }[file];
    for (const inj of [`\nawait supabase.from('${tbl}').insert({ x: 1 });`, `\nawait supabase\n  .from("${tbl}")\n  .update({ x: 1 }).eq('id', 1);`, `\nconst q = supabase.from('${tbl}');\nawait q.delete();`]) {
      assert.ok(scan(src + inj, { strict: true, allowedRpc: rpcs }).length > 0, `${file} + ${inj.trim().slice(0, 40)}`);
      assert.ok(scan(src + inj).length > 0, `${file} (non-strict) + ${inj.trim().slice(0, 40)}`);
    }
    // swapping a governed RPC for a direct write (the PR #445 regression) is detected
    const reverted = src.replace(/supabase\.rpc\('rpc_wp10_create_[a-z_]+',[^;]*;?/, `supabase.from('${tbl}').insert({ name });`);
    assert.notEqual(reverted, src); assert.ok(scan(reverted, { strict: true, allowedRpc: rpcs }).length > 0, file + " revert to direct insert");
  }
});
