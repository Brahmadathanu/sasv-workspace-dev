// WP10 G2 mocked-Chromium checks for the pre-submit sub-group IMPACT PREVIEW inside the REAL Manage Products update confirmation (flag WP10_SAFEGUARDS_V1).
// Mocked data only: NOT live-role acceptance, and the preview endpoint is a stub (proposal 06 is unapplied). Every read is a recorded read; no live writer/preview/build is invoked.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { skip, startHarness, stopHarness, openProduct, setSubgroup, clickSave, rpcCount, rpcNames, repoRoot, shotsOn } from "./products-harness.mjs";

const shotDir = path.join(repoRoot, "docs/master-data-costing/WP10_G2_EVIDENCE/screenshots");
const shot = async (page, name, width) => { if (!shotsOn) return; fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, `${name}-${width}.png`) }); };
test.before(startHarness);
test.after(stopHarness);

const R = (state, reasons = [], over = {}) => ({ state, route_source: state === "UNKNOWN" || state === "INVALID" && !over.family_id ? null : "ROUTE_FAMILY_INHERITED", family_id: over.family_id ?? null, family_route_id: over.family_route_id ?? null, product_route_id: null, reasons, ...over });
const PV = (over = {}) => ({
  assessment_kind: "PRODUCT_SUBGROUP_ROUTE_IMPACT", authoritative_for_save: false, product_id: 7, stored_sub_group_id: 1, proposed_sub_group_id: 2, sub_group_changed: true, evaluated_on: "2026-11-15", date_basis: "CURRENT_IST_DATE", active_sku_count: 2,
  before: R("VALID", [], { family_id: 11, family_route_id: 111 }), proposed: R("INVALID", ["NO_APPROVED_ROUTE_FAMILY_MAPPING"]), impact_class: "ROUTE_LOSS", review_required: true, context_digest: "0123456789abcdef0123456789abcdef", ...over,
});
const LOSS = PV();
const VALID2 = PV({ proposed: R("VALID", [], { family_id: 12, family_route_id: 121 }), impact_class: "VALID_TO_VALID", review_required: false });
const UNKNOWN = PV({ proposed: R("UNKNOWN", ["AMBIGUOUS_APPROVED_PRODUCT_ROUTE"]), impact_class: "UNKNOWN", review_required: true });
const ok = { data: [{ product_id: 7 }], error: null };
const WRITER_REJECT = { data: null, error: { message: "WP10_PRODUCT_ROUTE_IMPACT: moving product 7 to sub-group 2 would remove its valid production route while 2 active SKU(s) exist.", hint: "Map the new sub-group first." } };
const overflowOk = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= document.documentElement.clientWidth + 1);
const confirmWith = async (page, reason = "route review") => { await page.fill("#governanceReason", reason); await page.locator("#governanceConfirm").click(); await page.waitForTimeout(600); };
const detailText = (page) => page.locator("#governanceModalDetail").innerText();

for (const width of [1280, 390]) {
  test(`B1 flag OFF @${width}: today's flow exactly - no preview call, no WP10 module requested, no detail host; the writer runs once with the changed sub-group`, { skip }, async () => {
    const { page, context, loaded, errors } = await openProduct({ width, flag: false, rpc: { rpc_update_product: ok } });
    await clickSave(page);
    await page.waitForSelector("#governanceModalOverlay.show");
    await page.waitForTimeout(400);
    assert.equal(await rpcCount(page, "rpc_wp10_preview_product_subgroup_impact"), 0);
    assert.deepEqual(loaded, []);
    assert.equal(await page.locator("#governanceModalDetail").count(), 0);
    await confirmWith(page);
    assert.equal(await rpcCount(page, "rpc_update_product"), 1);
    assert.equal((await page.evaluate(() => window.__MOCK_CALLS.find((c) => c.name === "rpc_update_product").args.p_sub_group_id)), 2);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test(`B3 ROUTE_LOSS @${width}: route identity, reasons, active-SKU count, remediation, advisory disclaimer; Confirm stays enabled; no whole-page overflow`, { skip }, async () => {
    const { page, context, errors } = await openProduct({ width, rpc: { rpc_wp10_preview_product_subgroup_impact: { data: LOSS, error: null } } });
    await clickSave(page);
    await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
    const t = await detailText(page);
    assert.match(t, /Route loss detected/);
    assert.match(t, /Route today under the current sub-group: VALID — family 11 · family route 111/);
    assert.match(t, /Route under the proposed sub-group: INVALID/);
    assert.match(t, /No approved route family is mapped/);
    assert.match(t, /\(NO_APPROVED_ROUTE_FAMILY_MAPPING\)/);
    assert.match(t, /Active SKUs of this product at this moment: 2/);
    assert.match(t, /Remediation:.*There is no override/);
    assert.match(t, /advisory and not authoritative/);
    assert.match(t, /not a costing READY statement/);
    assert.doesNotMatch(t, /READY\b(?! statement)/);
    assert.equal(await page.locator("#governanceConfirm").isDisabled(), false);
    assert.equal(await overflowOk(page), true);
    await shot(page, "preview-route-loss", width);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("B2 endpoint ABSENT: explicit unavailable text, no fabricated assessment, Confirm enabled, the writer still runs once", { skip }, async () => {
  const { page, context } = await openProduct({ rpc: { rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  const t = await detailText(page);
  assert.match(t, /not available on this server yet/);
  assert.match(t, /No assessment was made/);
  assert.doesNotMatch(t, /Route today|VALID —|No new route loss/);
  await shot(page, "preview-unavailable", 1280);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1);
  await context.close();
});

test("B4 UNKNOWN: impact not proven, review required, but the client does NOT freeze the save (the server decides)", { skip }, async () => {
  const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: { data: UNKNOWN, error: null }, rpc_update_product: WRITER_REJECT } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview=UNKNOWN]");
  const t = await detailText(page);
  assert.match(t, /Impact NOT proven/); assert.match(t, /More than one approved product route overlaps/); assert.match(t, /Remediation:/);
  assert.equal(await page.locator("#governanceConfirm").isDisabled(), false);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1, "no client-side blanket freeze: the authoritative writer is called");
  await context.close();
});

test("B5 a FAVOURABLE preview followed by the authoritative writer REJECTION: the rejection is surfaced, the preview was only advisory, nothing claims success", { skip }, async () => {
  const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: WRITER_REJECT } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview=VALID_TO_VALID]");
  const t = await detailText(page);
  assert.match(t, /No new route loss observed at this moment/); assert.match(t, /not a promise that the save will succeed/);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1);
  const body = await page.locator("body").innerText();
  assert.match(body, /WP10_PRODUCT_ROUTE_IMPACT|Failed to update product/);
  assert.doesNotMatch(body, /Product updated successfully/);
  await context.close();
});

test("B6 hostile / malformed previews are discarded safely: nothing is rendered as HTML, nothing reads as favourable", { skip }, async () => {
  const hostile = [
    PV({ before: R("VALID", ["<img src=x onerror=window.__xss=1>"], { family_id: 11 }) }),                          // reason outside the closed code pattern
    PV({ before: { ...R("VALID", [], { family_id: 11 }), family_id: "<img src=x onerror=window.__xss=2>" } }),     // id as markup
    PV({ authoritative_for_save: true }),                                                                         // claims authority
    PV({ product_id: 8 }),                                                                                        // answers for a different product
    PV({ impact_class: "VALID_TO_VALID" }),                                                                       // contradicts its own states
    "<script>window.__xss=3</script>",
  ];
  for (const data of hostile) {
    const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: { data, error: null } } });
    await clickSave(page);
    await page.waitForSelector("#governanceModalDetail [data-wp10-preview=unavailable]");
    const t = await detailText(page);
    assert.match(t, /No assessment was made|discarded/);
    assert.equal(await page.locator("#governanceModalDetail img, #governanceModalDetail script").count(), 0);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.doesNotMatch(t, /No new route loss|valid route under both/);
    await context.close();
  }
  // an unknown but well-formed code is shown as its code only (text node)
  const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: { data: PV({ proposed: R("INVALID", ["ZZ_UNLISTED_CODE"]) }), error: null } } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview=ROUTE_LOSS]");
  assert.match(await detailText(page), /\(ZZ_UNLISTED_CODE\)/);
  await context.close();
});

test("B7 stale: a preview answered after the dialog was cancelled is discarded; a reopened dialog shows only ITS OWN preview", { skip }, async () => {
  const alt = async () => { window.__n = (window.__n || 0) + 1; const mine = window.__n; await new Promise((r) => setTimeout(r, mine === 1 ? 900 : 50)); const mk = (code) => ({ assessment_kind: "PRODUCT_SUBGROUP_ROUTE_IMPACT", authoritative_for_save: false, product_id: 7, stored_sub_group_id: 1, proposed_sub_group_id: 2, sub_group_changed: true, evaluated_on: "2026-11-15", date_basis: "CURRENT_IST_DATE", active_sku_count: 1, before: { state: "VALID", route_source: "ROUTE_FAMILY_INHERITED", family_id: 11, family_route_id: 111, product_route_id: null, reasons: [] }, proposed: { state: "INVALID", route_source: null, family_id: null, family_route_id: null, product_route_id: null, reasons: [code] }, impact_class: "ROUTE_LOSS", review_required: true, context_digest: "0123456789abcdef0123456789abcdef" }); return { data: mk(mine === 1 ? "FIRST_DIALOG_CODE" : "SECOND_DIALOG_CODE"), error: null }; };
  const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: alt } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.locator("#governanceCancel").click();
  await page.waitForTimeout(200);
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview=ROUTE_LOSS]");
  await page.waitForTimeout(1100);
  const t = await detailText(page);
  assert.match(t, /SECOND_DIALOG_CODE/); assert.doesNotMatch(t, /FIRST_DIALOG_CODE/);
  await context.close();
});

test("B8 pending helper import + double invocation: ONE dialog, ONE preview call, ONE writer call", { skip }, async () => {
  const { page, context } = await openProduct({ importDelayMs: 600, rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await page.evaluate(() => { const f = document.getElementById("productForm"); f.dispatchEvent(new Event("submit", { cancelable: true })); f.dispatchEvent(new Event("submit", { cancelable: true })); });
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.waitForTimeout(900);
  assert.equal(await rpcCount(page, "rpc_wp10_preview_product_subgroup_impact"), 1);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1);
  await context.close();
});

test("B9 pending import then the SUB-GROUP changes: nothing opens, nothing is previewed or written, and the reservation is released", { skip }, async () => {
  const { page, context } = await openProduct({ importDelayMs: 700, rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null } } });
  await clickSave(page);
  await setSubgroup(page, 1);
  await page.waitForTimeout(1200);
  assert.equal(await page.locator("#governanceModalOverlay.show").count(), 0);
  assert.equal(await rpcCount(page, "rpc_wp10_preview_product_subgroup_impact"), 0);
  assert.equal(await rpcCount(page, "rpc_update_product"), 0);
  await setSubgroup(page, 2);
  await clickSave(page);
  await page.waitForSelector("#governanceModalOverlay.show");
  await context.close();
});

test("B10 the SUB-GROUP changes while the dialog is open: confirming submits NOTHING and says why", { skip }, async () => {
  const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  await setSubgroup(page, 1);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 0);
  assert.match(await page.locator("body").innerText(), /nothing was submitted/);
  await context.close();
});

test("B11 the SELECTED PRODUCT changes while the dialog is open: confirming submits nothing for the old product; a late preview never paints", { skip }, async () => {
  const slow = async () => { await new Promise((r) => setTimeout(r, 800)); return { data: { assessment_kind: "PRODUCT_SUBGROUP_ROUTE_IMPACT", authoritative_for_save: false, product_id: 7, stored_sub_group_id: 1, proposed_sub_group_id: 2, sub_group_changed: true, evaluated_on: "2026-11-15", date_basis: "CURRENT_IST_DATE", active_sku_count: 0, before: { state: "VALID", route_source: "ROUTE_FAMILY_INHERITED", family_id: 11, family_route_id: 111, product_route_id: null, reasons: [] }, proposed: { state: "VALID", route_source: "ROUTE_FAMILY_INHERITED", family_id: 12, family_route_id: 121, product_route_id: null, reasons: [] }, impact_class: "VALID_TO_VALID", review_required: false, context_digest: "0123456789abcdef0123456789abcdef" }, error: null }; };
  const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: slow, rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.evaluate(() => { const rows = [...document.querySelectorAll("#productRegisterBody tr, #productLedger button")].filter((n) => n.offsetParent !== null); rows[1].click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("modalConfirm")?.click()); // discard the dirty form and load product 8
  await page.waitForTimeout(1200);
  const late = await detailText(page);
  assert.match(late, /discarded because the product, its sub-group or your access changed/);
  assert.doesNotMatch(late, /No new route loss|Checking the route impact/, "a late preview for product 7 must not paint and 'Checking…' must not linger");
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 0);
  await context.close();
});

test("B12 rights revoked while the dialog is open (test-only access hook): the writer is NOT called", { skip }, async () => {
  const { page, context } = await openProduct({ accessHook: true, rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  await page.evaluate(() => { window.__wp10Access.canEdit = false; });
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 0);
  await context.close();
});

test("B13 only a CHANGED sub-group on an EXISTING product previews: unchanged sub-group and product creation make no preview call", { skip }, async () => {
  const { page, context } = await openProduct({ changeSubgroup: false, rpc: { rpc_update_product: ok } });
  await setSubgroup(page, 1); // explicitly the STORED sub-group: nothing changes
  await clickSave(page);
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.waitForTimeout(300);
  assert.equal(await rpcCount(page, "rpc_wp10_preview_product_subgroup_impact"), 0);
  assert.equal(await page.locator("#governanceModalDetail").count(), 0);
  await context.close();
});

test("B14 helper module load failure leaves today's flow working (no preview, writer still runs)", { skip }, async () => {
  const { page, context } = await openProduct({ blockModule: true, rpc: { rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalOverlay.show");
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_wp10_preview_product_subgroup_impact"), 0);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1);
  await context.close();
});

test("B15 read surface: the preview is invoked as a READ with exactly {p_product_id, p_proposed_sub_group_id}; no other WP10 endpoint, builder, refresh or second writer is called", { skip }, async () => {
  const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  const args = await page.evaluate(() => window.__MOCK_CALLS.find((c) => c.name === "rpc_wp10_preview_product_subgroup_impact").args);
  assert.deepEqual(args, { p_product_id: 7, p_proposed_sub_group_id: 2 });
  await confirmWith(page);
  const names = await rpcNames(page);
  assert.deepEqual(names.filter((n) => /^rpc_(create|update|set)_|wp10|build|refresh/.test(n)), ["rpc_wp10_preview_product_subgroup_impact", "rpc_update_product"]);
  const calls = await page.evaluate(() => window.__MOCK_CALLS);
  assert.equal(calls.some((c) => c.kind === "from" && /^(insert|update|delete|upsert)$/.test(c.method)), false);
  await context.close();
});

for (const width of [1280, 390]) {
  test(`B16 whole-page overflow @${width}: Manage Products with the update dialog open (preview shown) adds no horizontal overflow relative to flag OFF`, { skip }, async () => {
    const measure = async (flag) => {
      const { page, context } = await openProduct({ width, flag, rpc: { rpc_wp10_preview_product_subgroup_impact: { data: LOSS, error: null }, rpc_update_product: WRITER_REJECT } });
      const w = () => page.evaluate(() => ({ vw: document.documentElement.clientWidth, doc: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) }));
      const closed = await w();
      await clickSave(page);
      await page.waitForSelector("#governanceModalOverlay.show");
      if (flag) await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
      const dialog = await w();
      await confirmWith(page);
      const after = await w();
      await context.close();
      return { closed, dialog, after };
    };
    const off = await measure(false), on = await measure(true);
    for (const k of ["closed", "dialog", "after"]) assert.ok(on[k].doc <= off[k].doc + 1, `${k}: flag ON ${on[k].doc} must not exceed flag OFF ${off[k].doc}`);
    if (shotsOn) { fs.mkdirSync(shotDir, { recursive: true }); fs.writeFileSync(path.join(shotDir, `preview-overflow-compare-${width}.json`), JSON.stringify({ width, off, on }, null, 2) + "\n"); }
  });
}

test("IR1a full draft changes during import: no dialog/read/write; a fresh retry works", { skip }, async () => {
  const { page, context } = await openProduct({ importDelayMs: 700, rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await clickSave(page);
  await page.evaluate(() => { document.getElementById("itemInput").value = "Changed during import"; });
  await page.waitForTimeout(1400);
  assert.equal(await page.locator("#governanceModalOverlay.show").count(), 0);
  assert.equal(await rpcCount(page, "rpc_wp10_preview_product_subgroup_impact"), 0);
  assert.equal(await rpcCount(page, "rpc_update_product"), 0);
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1);
  await context.close();
});

test("IR1b name, status or PTO changes under an open preview confirmation cannot replace the confirmed draft", { skip }, async () => {
  for (const field of ["itemInput", "statusSelect", "isPtoCheckbox"]) {
    const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
    await clickSave(page);
    await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
    await page.evaluate((id) => { const e = document.getElementById(id); if (id === "isPtoCheckbox") e.checked = !e.checked; else e.value = id === "statusSelect" ? "Inactive" : "Changed after confirmation opened"; }, field);
    await confirmWith(page);
    assert.equal(await rpcCount(page, "rpc_update_product"), 0, field);
    assert.match(await page.locator("body").innerText(), /nothing was submitted/);
    await context.close();
  }
});

test("IR2a pending preview cannot re-enter as an unchanged-subgroup save; reservation releases after stale import", { skip }, async () => {
  const { page, context } = await openProduct({ importDelayMs: 700, rpc: { rpc_update_product: ok } });
  await clickSave(page);
  await setSubgroup(page, 1);
  await clickSave(page);
  await page.waitForTimeout(1400);
  assert.equal(await page.locator("#governanceModalOverlay.show").count(), 0);
  assert.equal(await rpcCount(page, "rpc_update_product"), 0);
  await clickSave(page);
  await page.waitForSelector("#governanceModalOverlay.show");
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1);
  await context.close();
});

test("IR2b an unchanged-subgroup re-submit cannot attach another confirm handler to an open preview", { skip }, async () => {
  const { page, context } = await openProduct({ rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  await setSubgroup(page, 1);
  await clickSave(page);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 0);
  await context.close();
});

test("IR3 flag-ON shared dialog has one owner even for two ordinary unchanged-subgroup saves", { skip }, async () => {
  const { page, context } = await openProduct({ changeSubgroup: false, rpc: { rpc_update_product: ok } });
  await setSubgroup(page, 1); // explicitly populate the required select with the stored subgroup, as in B13
  await clickSave(page);
  await page.waitForSelector("#governanceModalOverlay.show");
  await clickSave(page);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1);
  await context.close();
});

test("IR-M1 mutation detects missing full-draft validation: a changed name reaches the writer", { skip }, async () => {
  const guard = 'JSON.stringify(buildProductRpcPayloadFromForm({ reason: "__pending__", approvalReference: null })) === a.draftSignature &&';
  const { page, context } = await openProduct({ mutateProducts: [[guard, ""]], rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  await page.evaluate(() => { document.getElementById("itemInput").value = "Unconfirmed replacement"; });
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1, "IR1b must detect the mutant");
  await context.close();
});

test("IR-M2 mutation detects missing reservation and shared-dialog ownership: reclassified save writes", { skip }, async () => {
  const { page, context } = await openProduct({ mutateProducts: [
    ["if (wp10ProductAttempt) return; // one confirmation lifecycle at a time", ""],
    ['if (wp10SafeguardsOn() && governanceModalOverlay?.classList.contains("show")) return Promise.resolve(null);', ""],
  ], rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  await setSubgroup(page, 1);
  await clickSave(page);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1, "IR2b must detect the mutant");
  await context.close();
});

// ---------------- mutation controls (the harness serves a MUTATED products.js / helper; each must be CAUGHT by a probe above) ----------------
test("M1 mutation control: WITHOUT the pre-writer revalidation a changed sub-group still reaches the writer (B10 would fail)", { skip }, async () => {
  const { page, context } = await openProduct({ mutateProducts: [["function wp10ProductAttemptValid(a) {", "function wp10ProductAttemptValid(a) { return true;"]], rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  await setSubgroup(page, 1);
  await confirmWith(page);
  assert.equal(await rpcCount(page, "rpc_update_product"), 1, "the mutant must be caught: it submits although the sub-group changed under the dialog");
  await context.close();
});

test("M2 mutation control: WITHOUT any serialization double invocation opens two previews (B8 would fail)", { skip }, async () => {
  const { page, context } = await openProduct({ importDelayMs: 500, mutateProducts: [["if (wp10ProductAttempt) return; // one confirmation lifecycle at a time", ""], ["wp10ProductAttempt === a &&", ""], ['if (wp10SafeguardsOn() && governanceModalOverlay?.classList.contains("show")) return Promise.resolve(null);', ""]], rpc: { rpc_wp10_preview_product_subgroup_impact: { data: VALID2, error: null }, rpc_update_product: ok } });
  await page.evaluate(() => { const f = document.getElementById("productForm"); f.dispatchEvent(new Event("submit", { cancelable: true })); f.dispatchEvent(new Event("submit", { cancelable: true })); });
  await page.waitForSelector("#governanceModalOverlay.show");
  await page.waitForTimeout(900);
  await confirmWith(page);
  const previews = await rpcCount(page, "rpc_wp10_preview_product_subgroup_impact"), writers = await rpcCount(page, "rpc_update_product");
  assert.equal(previews > 1 || writers > 1, true, `the mutant must be caught (previews=${previews}, writers=${writers})`);
  await context.close();
});

test("M3 mutation control: WITHOUT the identity check an answer for ANOTHER product is displayed as a favourable assessment (B6 would fail)", { skip }, async () => {
  const other = PV({ product_id: 8, impact_class: "VALID_TO_VALID", proposed: R("VALID", [], { family_id: 12, family_route_id: 121 }), review_required: false });
  const { page, context } = await openProduct({
    mutateModules: [[/wp10-safeguards\.js/, "if (data.product_id !== Number(expected.productId) || data.proposed_sub_group_id !== Number(expected.proposedSubGroupId)) return { ok: false, reason: \"IDENTITY_MISMATCH\" };", ""]],
    rpc: { rpc_wp10_preview_product_subgroup_impact: { data: other, error: null } },
  });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  assert.match(await detailText(page), /No new route loss observed/, "the mutant must be caught: it shows another product's favourable answer");
  await context.close();
});

test("M4 mutation control: WITHOUT the class-consistency check a self-contradicting answer is displayed (B6 would fail)", { skip }, async () => {
  const contradict = PV({ impact_class: "VALID_TO_VALID" }); // states say ROUTE_LOSS
  const { page, context } = await openProduct({
    mutateModules: [[/wp10-safeguards\.js/, "if (expectClass !== data.impact_class) return { ok: false, reason: \"INCONSISTENT\" };", ""]],
    rpc: { rpc_wp10_preview_product_subgroup_impact: { data: contradict, error: null } },
  });
  await clickSave(page);
  await page.waitForSelector("#governanceModalDetail [data-wp10-preview]");
  assert.match(await detailText(page), /No new route loss observed/, "the mutant must be caught: it displays a favourable headline over an INVALID proposed route");
  await context.close();
});
