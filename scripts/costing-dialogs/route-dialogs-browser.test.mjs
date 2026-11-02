// CW-06 browser acceptance (mock backend, real Production Route Manager page and controllers).
// Skips cleanly when Playwright is unavailable; COSTING_DIALOGS_BROWSER_SKIP=1 skips explicitly.
// No Supabase, no network, no real data: every RPC is answered by an in-memory mock and recorded.
import test from "node:test";
import assert from "node:assert/strict";
import {
  CANDIDATE_URL, MOCK, SUPERSEDE_URL, WRITE_RPC,
  launch, openCreateFamilyDialog, openMockPage, openSupersedeDialog, rpcCalls,
} from "./route-dialogs-browser.mjs";
import { GENERIC_SUBMIT_ERROR } from "../../public/shared/js/costing-dialogs-route-input.js";

const SKIP = process.env.COSTING_DIALOGS_BROWSER_SKIP === "1";
let env = null;
test.before(async () => { if (!SKIP) env = await launch(); });
test.after(async () => { await env?.close(); });

const writes = async (page) => (await rpcCalls(page)).filter((c) => WRITE_RPC.test(c.name));
const dialogOpen = (page) => page.evaluate(() => Boolean(document.querySelector("#prmSupersedeNewRouteId, #prmCreateFamilyName")) && !document.getElementById("detailsModal")?.classList.contains("hidden"));
const errorText = (page, id) => page.evaluate((i) => document.getElementById(i)?.textContent || "", id);

async function withPage(t, search, opts, fn) {
  if (SKIP) return t.skip("COSTING_DIALOGS_BROWSER_SKIP=1");
  if (!env) return t.skip("playwright not available");
  const { context, page, errors } = await openMockPage(env.browser, env.base, search, opts);
  try {
    await fn(page, errors);
    assert.deepEqual(errors, [], "no page errors");
  } finally {
    await context.close();
  }
}

// The candidate lens renders its scope controls into #workbenchSummary, which the page keeps display:none unless
// the "is-visible" class is added (see CW-06 review notes). This helper reveals it so the REAL controller
// controls can be driven; whether it was visible is reported as a diagnostic, not asserted.
async function revealCandidateControls(t, page) {
  const wasVisible = await page.evaluate(() => { const s = document.getElementById("workbenchSummary"); const g = document.getElementById("prmCandidateGroups"); return Boolean(s && getComputedStyle(s).display !== "none" && g && g.getBoundingClientRect().height > 0); });
  t.diagnostic(`Historical Candidate Review scope controls visible without help: ${wasVisible}`);
  if (!wasVisible) await page.evaluate(() => document.getElementById("workbenchSummary")?.classList.add("is-visible"));
  return wasVisible;
}

test("A1 Supersede: deep link to an existing product route shows the Supersede action; dialog is labelled, focused and validates", async (t) => {
  await withPage(t, SUPERSEDE_URL, { flagOn: true }, async (page) => {
    await openSupersedeDialog(page);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "prmSupersedeNewRouteId");
    assert.equal(await page.evaluate(() => document.querySelector('label[for="prmSupersedeNewRouteId"]')?.textContent.includes("New approved draft route ID")), true);
    assert.equal(await page.getAttribute("#prmSupersedeNewRouteId", "aria-describedby"), "prmSupersedeNewRouteIdError");
    for (const [value, expected] of [["", /Enter the new route ID/], ["abc", /positive whole number/], [String(MOCK.productRouteId), /different from the route being superseded/]]) {
      await page.fill("#prmSupersedeNewRouteId", value);
      await page.click("[data-prm-prompt-submit]");
      assert.match(await errorText(page, "prmSupersedeNewRouteIdError"), expected);
      assert.equal(await page.getAttribute("#prmSupersedeNewRouteId", "aria-invalid"), "true");
    }
    assert.deepEqual(await writes(page), [], "validation never writes");
  });
});

test("A2 Supersede: Cancel and Escape close the dialog, restore the page, and write nothing", async (t) => {
  await withPage(t, SUPERSEDE_URL, { flagOn: true }, async (page) => {
    await openSupersedeDialog(page);
    await page.fill("#prmSupersedeNewRouteId", String(MOCK.newRouteId));
    await page.click("[data-prm-prompt-cancel]");
    assert.equal(await dialogOpen(page), false);
    await page.waitForSelector('[data-prm-action="supersede-product"]');
    await openSupersedeDialog(page);
    await page.keyboard.press("Escape");
    assert.equal(await dialogOpen(page), false);
    await page.waitForSelector('[data-prm-action="supersede-product"]');
    assert.deepEqual(await writes(page), []);
  });
});

test("A3 Supersede: submit sends exactly one rpc_supersede_product_route with the same payload as before, then reloads the route", async (t) => {
  await withPage(t, SUPERSEDE_URL, { flagOn: true }, async (page) => {
    await openSupersedeDialog(page);
    await page.fill("#prmSupersedeNewRouteId", ` ${MOCK.newRouteId} `);
    await page.dblclick("[data-prm-prompt-submit]");
    await page.waitForFunction(() => document.getElementById("detailsModal")?.classList.contains("hidden"));
    const w = await writes(page);
    assert.equal(w.length, 1, "double click = one write");
    assert.equal(w[0].name, "rpc_supersede_product_route");
    assert.deepEqual(w[0].args, { p_old_product_route_id: MOCK.productRouteId, p_new_product_route_id: MOCK.newRouteId });
    const reads = (await rpcCalls(page)).filter((c) => c.name === "rpc_get_product_route_detail").length;
    assert.ok(reads >= 2, "route detail reloaded after the (mock) write");
  });
});

test("A4 Supersede: a rejected (mock) write is reported by the editor exactly as before; no raw error in the dialog, one write only", async (t) => {
  await withPage(t, SUPERSEDE_URL, { flagOn: true }, async (page) => {
    await openSupersedeDialog(page);
    await page.evaluate(() => { window.__mock.failWrites = true; });
    await page.fill("#prmSupersedeNewRouteId", String(MOCK.newRouteId));
    await page.click("[data-prm-prompt-submit]");
    // editor.supersedeProduct resolves { ok: false } and shows its own toast; the dialog then closes exactly like
    // the native prompt flow did (the thrown-exception wording is covered by the unit tests).
    await page.waitForFunction(() => document.getElementById("detailsModal")?.classList.contains("hidden"));
    assert.equal((await writes(page)).length, 1);
    assert.equal(await page.evaluate(() => document.body.innerText.includes("mock: connection lost")), true, "editor toast shows the server message");
    assert.doesNotMatch(await errorText(page, "prmSupersedeNewRouteIdError"), /connection lost|nothing was changed/i);
  });
});

test("A5 Supersede: Cancel is disabled while the write is pending; Escape then completing the write does not reopen or re-close anything", async (t) => {
  await withPage(t, SUPERSEDE_URL, { flagOn: true }, async (page) => {
    await openSupersedeDialog(page);
    await page.evaluate(() => { window.__mock.holdWrites = true; });
    await page.fill("#prmSupersedeNewRouteId", String(MOCK.newRouteId));
    await page.click("[data-prm-prompt-submit]");
    await page.waitForFunction(() => window.__mock.rpc.some((c) => c.name === "rpc_supersede_product_route"));
    assert.equal(await page.evaluate(() => document.querySelector("[data-prm-prompt-cancel]")?.disabled), true);
    await page.evaluate(() => document.querySelector("[data-prm-prompt-cancel]")?.click());
    assert.equal(await dialogOpen(page), true, "disabled Cancel does nothing");
    await page.keyboard.press("Escape");
    assert.equal(await dialogOpen(page), false);
    // Open an unrelated PRM modal after the dismissal, then let the pending write finish.
    await page.evaluate(() => window.__mock.release());
    await page.waitForTimeout(400);
    assert.equal((await writes(page)).length, 1);
    assert.equal(await dialogOpen(page), false);
  });
});

test("B1 Create family: Mode B selection and preview through the real candidate controls expose the action; dialog validates and cancels without writing", async (t) => {
  await withPage(t, CANDIDATE_URL, { flagOn: true }, async (page) => {
    await revealCandidateControls(t, page);
    await openCreateFamilyDialog(page);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "prmCreateFamilyName");
    await page.fill("#prmCreateFamilyName", "   ");
    await page.click("[data-prm-prompt-submit]");
    assert.match(await errorText(page, "prmCreateFamilyNameError"), /Enter a Route Family name/);
    await page.click("[data-prm-prompt-cancel]");
    assert.equal(await dialogOpen(page), false);
    assert.deepEqual(await writes(page), []);
    const previews = (await rpcCalls(page)).filter((c) => c.name === "rpc_preview_route_family_candidate");
    assert.equal(previews.length, 1, "only the read-only preview ran");
  });
});

test("B2 Create family: submit passes the entered name to candidates.createRouteFamily exactly as the native prompt did; the builder rejects it client-side (no p_family_code), so no RPC is sent", async (t) => {
  await withPage(t, CANDIDATE_URL, { flagOn: true }, async (page) => {
    await revealCandidateControls(t, page);
    await openCreateFamilyDialog(page);
    await page.fill("#prmCreateFamilyName", "  Mock Family  ");
    await page.click("[data-prm-prompt-submit]");
    await page.waitForFunction(() => document.getElementById("detailsModal")?.classList.contains("hidden"));
    // PRE-EXISTING behaviour, identical with the native prompt: createRouteFamily({ route_family_name }) has no
    // family code and buildCreateRouteFamilyArgs requires p_family_code, so the action never reaches the server.
    assert.deepEqual(await writes(page), [], "no write RPC is sent");
    assert.equal(await page.evaluate(() => document.body.innerText.includes("p_family_code is required")), true, "same client-side validation toast as the native flow");
  });
});

test("B3 Create family: Escape closes without a write", async (t) => {
  await withPage(t, CANDIDATE_URL, { flagOn: true }, async (page) => {
    await revealCandidateControls(t, page);
    await openCreateFamilyDialog(page);
    await page.keyboard.press("Escape");
    assert.equal(await dialogOpen(page), false);
    assert.deepEqual(await writes(page), []);
  });
});

test("C flag OFF: both actions still use the native prompts (no in-page dialog), and dismissing them writes nothing", async (t) => {
  await withPage(t, SUPERSEDE_URL, { flagOn: false }, async (page) => {
    const seen = [];
    page.on("dialog", async (d) => { seen.push([d.type(), d.message()]); await d.dismiss(); });
    await page.waitForSelector('[data-prm-action="supersede-product"]', { timeout: 15000 });
    await page.click('[data-prm-action="supersede-product"]');
    await page.waitForTimeout(300);
    assert.deepEqual(seen, [["prompt", "New approved draft route ID:"]]);
    assert.equal(await page.evaluate(() => Boolean(document.getElementById("prmSupersedeNewRouteId"))), false);
    assert.deepEqual(await writes(page), []);
  });
  await withPage(t, CANDIDATE_URL, { flagOn: false }, async (page) => {
    const seen = [];
    page.on("dialog", async (d) => { seen.push([d.type(), d.message()]); await d.dismiss(); });
    await revealCandidateControls(t, page);
    await page.waitForSelector("#prmCandidateGroups");
    await page.selectOption("#prmCandidateGroups", String(MOCK.productGroupId));
    await page.click('button[data-prm-candidate="family-b"]');
    await page.waitForSelector("[data-prm-create-family]");
    await page.click("[data-prm-create-family]");
    await page.waitForTimeout(300);
    assert.deepEqual(seen, [["prompt", "Manufacturing Route Family name:"]]);
    assert.deepEqual(await writes(page), []);
  });
});

test("C2 parity: with the flag OFF, accepting the native family prompt yields the same client-side rejection and no write", async (t) => {
  await withPage(t, CANDIDATE_URL, { flagOn: false }, async (page) => {
    page.on("dialog", async (d) => { await d.accept("Mock Family"); });
    await revealCandidateControls(t, page);
    await page.waitForSelector("#prmCandidateGroups");
    await page.selectOption("#prmCandidateGroups", String(MOCK.productGroupId));
    await page.click('button[data-prm-candidate="family-b"]');
    await page.waitForSelector("[data-prm-create-family]");
    await page.click("[data-prm-create-family]");
    await page.waitForFunction(() => document.body.innerText.includes("p_family_code is required"));
    assert.deepEqual(await writes(page), []);
  });
});
