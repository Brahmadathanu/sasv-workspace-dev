// R4 gate: the coverage manifest is verified against REAL Chromium renderings of the real six pages, at desktop,
// Navigation-Only and 390px mobile. A lens may only be POPULATED if it shows real table/card data; an empty screen,
// offline message or restriction notice can never satisfy a POPULATED claim and is asserted as such for the others.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createReadOnlyLoopbackServer } from "./read-only-loopback-server.mjs";
import { auditAll } from "./audit-lens-coverage.mjs";
import { COVERAGE } from "./coverage-manifest.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
let server, browser, base, desktop, navOnly, mobile;
test.before(async () => {
  server = await createReadOnlyLoopbackServer();
  base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  desktop = await auditAll({ base, browser, flags: [], width: 1280 });
  navOnly = await auditAll({ base, browser, flags: ["COSTING_NAV_GROUPS_V1"], width: 1280 });
  mobile = await auditAll({ base, browser, flags: [], width: 390 });
});
test.after(async () => { await browser?.close(); await new Promise((r) => server?.close(r)); });

const find = (rows, c) => rows.find((r) => r.module === c.module && r.id === c.id);
const OFFLINE = /no synthetic fixture|cannot populate offline/i;

test("live page inventory equals the manifest: 40 lenses/workspaces, none missing, none extra", () => {
  const live = desktop.filter((r) => r.kind !== "module").map((r) => r.module + ":" + r.id).sort();
  assert.deepEqual(live, COVERAGE.map((c) => c.module + ":" + c.id).sort());
});

test("POPULATED lenses render real synthetic data rows with no failure banner (desktop 1280px)", () => {
  const failures = [];
  for (const c of COVERAGE.filter((x) => x.status === "POPULATED")) {
    const r = find(desktop, c);
    if (!r) { failures.push(c.id + ": not found"); continue; }
    if (r.dataRows < c.minRows) failures.push(c.id + ": " + r.dataRows + " data rows < " + c.minRows);
    if (r.failureBanner) failures.push(c.id + ": banner " + r.failureBanner);
    if (r.unsupported.length) failures.push(c.id + ": unsupported reads " + r.unsupported.join(","));
    if (r.syntheticTextCount < 1 && !c.noSyntheticLabel) failures.push(c.id + ": no SYNTHETIC-labelled value rendered");
    if (r.overflowPx > 1) failures.push(c.id + ": horizontal overflow " + r.overflowPx);
    if (r.deniedWrites && r.deniedWrites.length) failures.push(c.id + ": a write was attempted while only reading");
  }
  assert.deepEqual(failures, []);
});

test("UNSUPPORTED, SELECTION_REQUIRED and RESTRICTED lenses are never rendered as data and say so explicitly", () => {
  for (const c of COVERAGE.filter((x) => x.status !== "POPULATED")) {
    const r = find(desktop, c);
    assert.ok(r, c.id);
    assert.equal(r.dataRows, 0, c.id + " must not show data rows");
    if (c.status === "UNSUPPORTED") assert.match(r.failureBanner ?? "", OFFLINE, c.id + " must show the explicit offline message");
    if (c.status === "RESTRICTED") assert.match(r.failureBanner ?? "", /Restricted/i, c.id);
    if (c.status === "SELECTION_REQUIRED") assert.equal(r.failureBanner, null, c.id + " shows a selection prompt, not an error");
    assert.ok(c.blocker, c.id + " needs a documented blocker");
  }
});

test("Navigation Only changes presentation only: same data everywhere, role-restricted lenses hidden, group labels shown", () => {
  for (const c of COVERAGE.filter((x) => x.status === "POPULATED")) {
    const a = find(desktop, c), b = find(navOnly, c);
    assert.equal(b.dataRows, a.dataRows, c.id + ": row count must not change with nav grouping");
    assert.equal(b.failureBanner, a.failureBanner, c.id);
  }
  const hidden = navOnly.filter((r) => r.hiddenInNav).map((r) => r.id).sort();
  assert.deepEqual(hidden, ["pm-cost-trace", "rm-cost-trace"]);
  assert.equal(desktop.filter((r) => r.hiddenInNav).length, 0, "flat navigation shows every lens");
});

test("mobile 390px: every populated lens shows synthetic data without horizontal scrolling", () => {
  const failures = [];
  for (const c of COVERAGE.filter((x) => x.status === "POPULATED")) {
    const r = find(mobile, c);
    if (!r) { failures.push(c.id + ": missing"); continue; }
    if (r.failureBanner) failures.push(c.id + ": banner " + r.failureBanner);
    if (r.dataRows < 1 && r.syntheticTextCount < 1) failures.push(c.id + ": nothing rendered");
    if (r.overflowPx > 1) failures.push(c.id + ": overflow " + r.overflowPx);
  }
  assert.deepEqual(failures, []);
});
