// WP05 overnight bulk wave (issue #267), workstream B3/B4 offline contract.
// Pure source characterisation: reads repository files only. No network, no Supabase, no browser, no credentials.
// It pins (a) what the operator acceptance pack may expect of the Scheme Master GET and (b) the quantified facts behind the
// standalone Viability Periods proposal. It does NOT change any behaviour and is NOT server-role or hosted-build evidence.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) =>
  readFileSync(resolve(root, rel), "utf8").replace(/\r\n/g, "\n");
const ppm = read("public/shared/js/costing-suite-pricing-policy.js");
const sw = read("public/sw.js");
const migration = read(
  "supabase/migrations/20261108082334_costing_scheme_master_register_viability_lateral.sql",
);

const selectColumns = () => {
  const m = ppm.match(
    /const SCHEME_MASTER_LIST_SELECT\s*=\s*\[([\s\S]*?)\]\.join\(","\);/,
  );
  assert.ok(m, "SCHEME_MASTER_LIST_SELECT constant missing");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
};
const viewColumns = () => {
  const m = migration.match(
    /c_expected_cols constant text\[\] := array\[([^\]]+)\]/,
  );
  assert.ok(m, "34-column contract array missing from the applied migration");
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};
const VIABILITY_SERVER_FIELDS = [
  "viability_snapshot_count",
  "viability_snapshot_period_count",
  "latest_viability_snapshot_period",
];
const RENDERER_VIABILITY_KEYS = ["viability_periods", "viability_period_count"];

test("pack expectation: the Scheme Master GET asks for 31 of the 34 view columns, in view order, with no wildcard", () => {
  const sel = selectColumns(),
    view = viewColumns();
  assert.equal(view.length, 34);
  assert.equal(sel.length, 31);
  assert.equal(new Set(sel).size, 31);
  assert.deepEqual(
    view.filter((c) => !sel.includes(c)),
    VIABILITY_SERVER_FIELDS,
    "the only omitted view columns are the three viability aggregates",
  );
  assert.deepEqual(
    sel,
    view.filter((c) => sel.includes(c)),
    "projection preserves the view's column order",
  );
  assert.ok(!sel.includes("*"));
  const site = ppm.slice(
    ppm.indexOf('costingFrom("v_costing_scheme_master_register")'),
  );
  assert.match(site.slice(0, 600), /\.select\(SCHEME_MASTER_LIST_SELECT\)/);
  assert.equal(
    (ppm.match(/v_costing_scheme_master_register/g) ?? []).length,
    1,
    "exactly one read site for the register view",
  );
});

test("pack expectation: the Scheme Master list read is a pure GET path (no mutation verb on the register view)", () => {
  const idx = ppm.indexOf('costingFrom("v_costing_scheme_master_register")');
  const chain = ppm.slice(idx, idx + 700);
  assert.doesNotMatch(chain, /\.(insert|update|upsert|delete|rpc)\(/);
});

test("pack expectation: service worker identity the operator should see (hub-cache-v393; PPM module network-first with cache fallback)", () => {
  assert.match(sw, /hub-cache-v393/);
  assert.match(sw, /costing-suite-pricing-policy\\\.js\$/);
});

test("Viability Periods: renderer keys never exist on the server view or in the 31-column list (always renders '--')", () => {
  const sel = selectColumns(),
    view = viewColumns();
  for (const k of RENDERER_VIABILITY_KEYS) {
    assert.ok(!view.includes(k), `${k} is not a column of the 34-column view`);
    assert.ok(!sel.includes(k), `${k} is not requested by the list read`);
  }
  // The server-side names that do exist are never read by the client at all.
  for (const k of VIABILITY_SERVER_FIELDS)
    assert.ok(
      !ppm.includes(k),
      `${k} is not referenced anywhere in the PPM client`,
    );
});

test("Viability Periods: exactly two numeric display sites (list cell, detail drawer) plus the header and drawer labels; every other numeric key has a column that IS requested", () => {
  const sites = [
    ...ppm.matchAll(/schemeMasterRowNumber\(\s*row,\s*\[([^\]]*)\]\s*\)/g),
  ].map((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  const viab = sites.filter((keys) =>
    keys.some((k) => RENDERER_VIABILITY_KEYS.includes(k)),
  );
  assert.equal(viab.length, 2, "list cell + detail drawer");
  assert.equal(
    (ppm.match(/"Viability Periods"/g) ?? []).length,
    2,
    "string literal appears only in the header array and the detail drawer row",
  );
  const sel = selectColumns();
  for (const keys of sites.filter((k) => !viab.includes(k)))
    assert.ok(
      keys.some((k) => sel.includes(k)),
      `no requested column for display keys ${keys}`,
    );
});

test("Viability Periods: view applied 8 Nov keeps the aggregates behind ONE LATERAL (the expensive part the list read avoids)", () => {
  assert.equal(
    (migration.match(/sku_scheme_viability_snapshot/g) ?? []).length >= 1,
    true,
  );
  assert.match(migration, /LEFT JOIN LATERAL/);
  assert.match(
    migration,
    /viab\.vs_period_count AS viability_snapshot_period_count/,
  );
});
