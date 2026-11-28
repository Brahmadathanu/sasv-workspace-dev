import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { openDashboard, startServer, calls, setHandler } from "../mis-c1/mis-harness.mjs";
import { debtorFixture } from "../mis-c1/ei-debtor-fixture.mjs";

const require = createRequire(import.meta.url);
const sources = new URL("../../public/shared/js/", import.meta.url);
const readSource = (file) => fs.readFileSync(new URL(file, sources), "utf8");
const contract = await import("data:text/javascript;base64," + Buffer.from(readSource("ei-debtor-contract.js")).toString("base64"));
const browserDisabled = process.env.MIS_C1_SKIP_BROWSER === "1";
const playwright = browserDisabled ? null : (() => { try { return require("playwright"); } catch { return null; } })();
const widths = [320, 375, 390, 414, 430, 768, 1440];

test("classification paths and roles use independent, exact named arguments", () => {
  const { classificationArgs, changeClassification, roleAccess } = contract;
  assert.deepEqual(classificationArgs({ partition: "all" }), {});
  assert.deepEqual(classificationArgs({ partition: "classified", region_id: "1", type_id: "4" }), { p_partition: "classified", p_region_id: 1, p_type_id: 4 });
  assert.deepEqual(classificationArgs({ partition: "unclassified", region_id: "1" }), { p_partition: "unclassified" });
  assert.deepEqual(changeClassification({ region_id: "1", godown_id: "2", district_id: "3", area_id: "4", type_id: "5" }, "godown_id", "6"),
    { region_id: "1", godown_id: "6", district_id: null, area_id: null, type_id: "5" });
  const roles = [{ target: "role:ei-debtor-commercial", can_view: false, can_edit: true }];
  assert.deepEqual(roleAccess(roles, "role:ei-debtor-commercial"), { view: true, edit: true });
  assert.deepEqual(roleAccess(roles, "role:ei-debtor-kyc"), { view: false, edit: false });
});

test("bill export restarts mixed snapshots and rejects duplicate IDs", async () => {
  const offsets = [];
  const bill = (bill_id, report_date) => ({ bill_id, report_date });
  const scope = { p_partition: "unclassified", p_group_filter: "receivables" };
  const result = await contract.collectBillPages(async (name, args) => {
    assert.equal(name, "get_mis_finance_bill_page");
    const { p_offset, p_limit, ...rest } = args;
    assert.equal(p_limit, 500);
    assert.deepEqual(rest, scope);
    offsets.push(p_offset);
    const report = offsets.length === 1 ? "2026-11-27" : "2026-11-28";
    return { rows: [bill(p_offset + 1, report)], total_rows: 2, groups: [{ bill_count: 2 }] };
  }, scope);
  assert.deepEqual(offsets, [0, 1, 0, 1]);
  assert.equal(result.date, "2026-11-28");
  assert.deepEqual(result.rows.map((row) => row.bill_id), [1, 2]);
  await assert.rejects(contract.collectBillPages(async () => ({
    rows: [bill(1, "2026-11-28"), bill(1, "2026-11-28")], total_rows: 2, groups: [],
  }), scope), /snapshot changed/);
});

test("PWA serves new exact asset versions with old cache present", async () => {
  const page = "/shared/executive-mis-dashboard.html";
  const assets = ["/shared/js/executive-mis-dashboard.js?mis-c1=ei-r8-kyc-2", "/shared/js/executive-intelligence-model.js?ei-r8=3",
    "/shared/js/ei-debtor-contract.js?kyc=1", "/shared/js/ei-debtor-workspace.js?kyc=2"];
  const cache = new Map([["/shared/js/executive-mis-dashboard.js?mis-c1=ei-r8-kyc-1", { value: "prior preview" }],
    ["/shared/js/ei-debtor-workspace.js?kyc=1", { value: "prior preview" }],["/shared/js/executive-mis-dashboard.js?mis-c1=ei-r8-n1-20261127", { value: "old" }],
    ["/shared/js/executive-intelligence-model.js?ei-r8=2", { value: "old" }]]);
  const fetches = [];
  let onFetch;
  const response = (value) => ({ ok: true, value, clone() { return response(value); } });
  vm.runInNewContext(fs.readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"), {
    self: { addEventListener(name, fn) { if (name === "fetch") onFetch = fn; } },
    location: { origin: "https://fixture.invalid" }, URL,
    fetch: async (r) => { fetches.push(r.key); return response(r.key); },
    caches: { match: async (r) => cache.get(r.key), open: async () => ({ put: async (r, data) => cache.set(r.key, data) }) },
  });
  const get = (key, mode) => new Promise((resolve) => onFetch({
    request: { url: "https://fixture.invalid" + key, method: "GET", key, mode, headers: new Map() },
    respondWith: (value) => resolve(value),
  }));
  const html = fs.readFileSync(new URL("../../public" + page, import.meta.url), "utf8");
  assert.ok(html.includes(assets[0].split("/").at(-1)));
  for (const asset of assets.slice(1)) assert.ok(readSource("executive-mis-dashboard.js").includes(asset.split("/").at(-1)));
  assert.equal((await get(page, "navigate")).value, page);
  for (const asset of assets) {
    assert.equal((await get(asset)).value, asset);
    assert.equal((await get(asset)).value, asset);
  }
  assert.deepEqual(fetches, [page, ...assets]);
});

function fixtureInit(mode) {
  return new Function("(" + debtorFixture.toString() + ")(" + JSON.stringify(mode) + ")");
}
const last = async (page, name) => (await calls(page, name)).at(-1)?.args;
const command = (page, name) => page.getByRole("button", { name, exact: true });
const visibleDialog = (page) => page.locator("dialog[open]").last();
const fillReason = (page, value = "Fixture validation") => visibleDialog(page).getByLabel("Reason", { exact: true }).fill(value);
const profile = (page) => command(page, "Fixture Debtor 1").first().click();

const kycTab = (page, name) => page.getByRole("tab", { name, exact: true });

for (const engine of ["chromium", "webkit"]) {
  test(`${engine}: Finance modal parity, nested layers, drawers and preserved lens at 320–1440px`, { skip: !playwright }, async () => {
    const srv = await startServer();
    let browser;
    try {
      browser = await playwright[engine].launch();
      for (const width of widths) {
        const { page, context } = await openDashboard(browser, srv.base, { width, init: fixtureInit("editor") });
        try {
          page.setDefaultTimeout(10000);
          const capture = async (name) => {
            const out = process.env.EI_KYC_SCREENSHOTS;
            if (!out || ![320, 390, 768, 1440].includes(width)) return;
            fs.mkdirSync(out, { recursive: true });
            await page.screenshot({ path: `${out}/${engine}-${width}-${name}.png` });
          };
          await page.locator("#financeAgeBtn").click();
          await page.getByRole("dialog", { name: "Ageing analysis" }).waitFor();
          await capture("01-finance-ageing");
          await page.keyboard.press("Escape");
          await page.locator("#financeFilterBtn").click();
          await page.locator('input[name="financeFilter"][value="receivables"]').check();
          const finance = page.locator("#financeSearch");
          await finance.fill("Fixture");
          await page.waitForFunction(() => window.__mis.calls.some((c) => c.name === "get_mis_finance_party_page" && c.args.p_search === "Fixture"));
          await page.locator("#financePartyTableWrap tbody tr, #financePartyTableWrap .ei-rc").first().waitFor();
          await capture("02-finance");
          const trigger = page.locator("#openDebtorKyc");
          const before = await trigger.evaluate((button) => {
            const panel = document.querySelector("#tabPanel");
            const list = document.querySelector("#financePartyTableWrap");
            window.financeContent = panel.firstElementChild;
            const scroll = matchMedia("(max-width: 640px)").matches ? panel : list;
            scroll.scrollTop = 80;
            button.focus({ preventScroll: true });
            button.click();
            return scroll.scrollTop;
          });
          const modal = page.getByRole("dialog", { name: "Debtor KYC", exact: true });
          await modal.locator("tbody tr").first().waitFor();
          assert.equal(await page.evaluate(() => document.querySelector("#tabPanel").firstElementChild === window.financeContent), true);
          assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#tabPanel")).overflowY === "hidden"), true);
          await capture("03-debtor-register");
          if (width === 320 || width === 1440) {
            const register = modal.locator("#debtorPanel");
            await register.evaluate((el) => { el.scrollTop = el.scrollHeight; });
            await page.waitForFunction(() => window.__mis.calls.some((call) => call.name === "ei_debtor_register_page" && call.args.p_offset === 50));
            await register.evaluate((el) => { el.scrollTop = 0; });
            await modal.getByRole("button", { name: "Close", exact: true }).focus();
            await page.keyboard.press("Shift+Tab");
            assert.equal(await modal.evaluate((el) => el.contains(document.activeElement)), true);
          }
          const filter = modal.getByRole("button", { name: "Filters", exact: true });
          await filter.click();
          const drawer = modal.getByRole("dialog", { name: "Debtor register filters" });
          await drawer.getByLabel("Scope").selectOption("outstanding");
          await drawer.getByLabel("Status").selectOption("DRAFT");
          await capture("04-debtor-filters");
          await page.keyboard.press("Escape");
          await drawer.waitFor({ state: "hidden" });
          assert.equal(await filter.evaluate((el) => document.activeElement === el), true);
          await modal.getByRole("button", { name: "Sort register" }).click();
          await modal.getByRole("radio", { name: "Debtor name" }).check();
          assert.equal(await modal.getByRole("button", { name: "Sort register" }).getAttribute("aria-expanded"), "false");
          await profile(page);
          await capture("05-debtor-profile");
          await visibleDialog(page).getByRole("button", { name: "Add alias" }).click();
          assert.equal(await page.locator("dialog[open]").count(), 3);
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => document.querySelectorAll("dialog[open]").length === 2);
          assert.equal(await visibleDialog(page).getByRole("button", { name: "Add alias" }).evaluate((el) => el === document.activeElement), true);
          const fits = await page.evaluate(() => {
            const dialogs = [...document.querySelectorAll("dialog[open]")];
            return document.documentElement.scrollWidth <= innerWidth && dialogs.every((dialog) =>
              dialog.getBoundingClientRect().width <= innerWidth && dialog.scrollWidth <= dialog.clientWidth + 1 &&
              dialog.querySelector(".ei-kyc-dialog-body").scrollWidth <= dialog.querySelector(".ei-kyc-dialog-body").clientWidth + 1);
          });
          assert.ok(fits, `${engine} at ${width}px fits without horizontal overflow`);
          await page.keyboard.press("Escape");
          await kycTab(page, "Debtor Register").focus();
          await page.keyboard.press("ArrowRight");
          assert.equal(await kycTab(page, "Classification Masters").getAttribute("aria-selected"), "true");
          await capture("06-classification-masters");
          await page.keyboard.press("ArrowRight");
          assert.equal(await kycTab(page, "Commercial Policies").getAttribute("aria-selected"), "true");
          await capture("07-commercial-policies");
          await page.keyboard.press("Escape");
          await page.locator(".ei-kyc-workspace").waitFor({ state: "detached" });
          assert.equal(await finance.inputValue(), "Fixture");
          assert.equal(await page.evaluate(() => document.activeElement.id), "openDebtorKyc");
          const after = await page.evaluate(() => {
            const panel = document.querySelector("#tabPanel");
            const scroll = matchMedia("(max-width: 640px)").matches ? panel : document.querySelector("#financePartyTableWrap");
            return { top: scroll.scrollTop, same: panel.firstElementChild === window.financeContent, locked: getComputedStyle(document.querySelector("#tabPanel")).overflowY === "hidden" };
          });
          assert.deepEqual(after, { top: before, same: true, locked: false });
        } finally { await context.close(); }
      }
    } finally { await browser?.close(); srv.server.close(); }
  });
}

async function scenario(t, mode, lens = "finance", width) {
  const server = await startServer();
  const browser = await playwright.chromium.launch();
  t.after(async () => { await browser.close(); server.server.close(); });
  const instance = await openDashboard(browser, server.base, { lens, width, init: fixtureInit(mode), permission: mode === "unauthorized" ? "denied" : "granted" });
  instance.page.setDefaultTimeout(8000);
  return instance;
}

test("Alerts link opens unclassified workspace and KYC/commercial roles stay independent", { skip: !playwright }, async (t) => {
  const { page } = await scenario(t, "executive", "alerts");
  const alert = page.getByRole("link", { name: "Outstanding debtors without active KYC" });
  await alert.click();
  await page.getByText("Fixture Unmapped").waitFor();
  assert.deepEqual(await last(page, "get_mis_finance_party_page"), { p_search: "", p_group_filter: "receivables", p_limit: 50, p_offset: 0, p_partition: "unclassified" });
  assert.equal(await kycTab(page, "Classification Masters").count(), 0);
  assert.equal(await kycTab(page, "Commercial Policies").count(), 0);
  assert.equal(await calls(page, "ei_debtor_profile").then((value) => value.length), 0);
  assert.equal(await page.locator("#tabPanel .ei-alerts").count(), 1);
  await page.keyboard.press("Escape");
  await page.locator(".ei-kyc-workspace").waitFor({ state: "detached" });
  assert.equal(await alert.evaluate((el) => el === document.activeElement), true);
  const narrow = await scenario(t, "executive", "alerts", 390);
  await narrow.page.getByRole("button", { name: "Open unclassified Debtor KYC" }).click();
  await narrow.page.getByText("Fixture Unmapped").waitFor();
  const direct = await scenario(t, "executive", "finance/debtor-kyc?partition=unclassified");
  await direct.page.getByText("Fixture Unmapped").waitFor();
  assert.equal(await direct.page.locator("#tabPanel .ei-lens-finance").count(), 1);
  await direct.page.keyboard.press("Escape");
  await direct.page.locator(".ei-kyc-workspace").waitFor({ state: "detached" });
  assert.equal(new URL(direct.page.url()).hash, "#finance");
  for (const [role, masters, commercial] of [["kyc-viewer", true, false], ["kyc-editor", true, false], ["commercial-viewer", false, true], ["commercial-editor", false, true], ["unauthorized", false, false]]) {
    const instance = await scenario(t, role, "finance/debtor-kyc");
    if (role === "unauthorized") {
      await instance.page.locator("#statusArea").getByText(/permission/).waitFor();
      assert.equal(await calls(instance.page, "ei_debtor_lookups").then((value) => value.length), 0);
      continue;
    }
    await instance.page.getByRole("heading", { name: "Debtor KYC" }).waitFor();
    assert.equal(!!await kycTab(instance.page, "Classification Masters").count(), masters);
    assert.equal(!!await kycTab(instance.page, "Commercial Policies").count(), commercial);
    if (masters) {
      await profile(instance.page);
      await visibleDialog(instance.page).getByLabel("Business name").waitFor();
      assert.equal(await visibleDialog(instance.page).getByRole("button", { name: "Save draft" }).count(), role.endsWith("editor") ? 1 : 0);
    } else {
      await kycTab(instance.page, "Commercial Policies").click();
      await instance.page.getByLabel("Debtor type").selectOption("40");
      await instance.page.getByLabel("Region").selectOption("1");
      await instance.page.getByText("No matching records").waitFor();
      assert.equal(await command(instance.page, "Add default").count(), role.endsWith("editor") ? 1 : 0);
    }
  }
});

test("KYC lifecycle, stale revisions, alias conflicts, bulk preview, audits and master writes", { skip: !playwright }, async (t) => {
  const { page } = await scenario(t, "editor", "finance/debtor-kyc");
  await profile(page);
  let modal = visibleDialog(page);
  await modal.getByLabel("Business name").fill("Synthetic contact");
  await fillReason(page);
  await modal.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Profile saved.").waitFor();
  await profile(page);
  modal = visibleDialog(page);
  await modal.getByLabel("Business name").fill("");
  await fillReason(page);
  await modal.getByRole("button", { name: "Activate", exact: true }).click();
  await modal.getByText(/violate a classification/).waitFor();
  for (const [field, id] of [["Region", "1"], ["Godown", "10"], ["District", "20"], ["Area", "30"], ["Debtor type", "40"]]) {
    await modal.getByLabel(field, { exact: true }).selectOption(id);
  }
  await modal.getByRole("button", { name: "Activate", exact: true }).click();
  await page.getByText("Debtor activated.").waitFor();
  assert.equal((await last(page, "ei_debtor_save")).p_profile.business_name, null);
  await profile(page);
  await visibleDialog(page).getByRole("button", { name: "Inactivate debtor" }).click();
  await fillReason(page);
  await visibleDialog(page).getByRole("button", { name: "Confirm inactivation" }).click();
  await page.getByText("Debtor inactivated.").waitFor();
  assert.equal((await last(page, "ei_debtor_save")).p_class, null);
  await profile(page);
  await fillReason(page);
  await visibleDialog(page).getByRole("button", { name: "Reactivate" }).click();
  await page.getByText("Debtor activated.").waitFor();
  await profile(page);
  await visibleDialog(page).getByRole("button", { name: "KYC profile history" }).click();
  await visibleDialog(page).getByText("Synthetic contact").waitFor({ state: "attached" });
  assert.equal(await page.evaluate(() => Object.values(localStorage).join("").includes("Synthetic contact") || Object.values(sessionStorage).join("").includes("Synthetic contact")), false);
  await page.keyboard.press("Escape");
  await visibleDialog(page).getByRole("button", { name: "Add alias" }).click();
  await visibleDialog(page).getByLabel("Observed ledger name").fill("Fixture Alias");
  await fillReason(page);
  await visibleDialog(page).getByRole("button", { name: "Confirm", exact: true }).click();
  await visibleDialog(page).getByRole("button", { name: "Inactivate alias" }).click();
  await fillReason(page);
  await visibleDialog(page).getByRole("button", { name: "Confirm", exact: true }).click();
  await visibleDialog(page).getByRole("button", { name: "Reactivate alias" }).waitFor();
  assert.equal((await last(page, "ei_debtor_alias_set")).p_revision, 1);
  await visibleDialog(page).getByRole("button", { name: "Add alias" }).click();
  await visibleDialog(page).getByLabel("Observed ledger name").fill("Fixture Alias");
  await fillReason(page);
  await visibleDialog(page).getByRole("button", { name: "Confirm", exact: true }).click();
  await visibleDialog(page).getByText(/already assigned/).waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("checkbox", { name: "Select Fixture Debtor 1", exact: true }).check();
  await command(page, "Bulk classification").click();
  await visibleDialog(page).getByLabel("Lifecycle action").selectOption("SAVE");
  for (const [field, id] of [["Region", "1"], ["Godown", "10"], ["District", "20"], ["Area", "30"], ["Debtor type", "40"]]) {
    await visibleDialog(page).getByLabel(field, { exact: true }).selectOption(id);
  }
  await fillReason(page);
  await visibleDialog(page).getByRole("button", { name: "Preview", exact: true }).click();
  await visibleDialog(page).getByText("Fixture Debtor 1 · Active").waitFor();
  const savesBefore = (await calls(page, "ei_debtor_save")).length;
  await visibleDialog(page).getByRole("button", { name: "Confirm bulk classification" }).click();
  await visibleDialog(page).getByText("Fixture Debtor 1 · Saved").waitFor();
  assert.equal((await calls(page, "ei_debtor_save")).length, savesBefore + 1);
  await page.keyboard.press("Escape");
  await kycTab(page, "Classification Masters").click();
  await page.getByLabel("Master", { exact: true }).selectOption("type");
  await command(page, "Edit").click();
  await visibleDialog(page).getByLabel("Status").selectOption("false");
  await fillReason(page);
  await visibleDialog(page).getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Master record saved.").waitFor();
  assert.deepEqual((await last(page, "ei_debtor_master_set")).p_data, { definition: "Synthetic class", is_active: false, name: "Fixture dealer" });
  await kycTab(page, "Debtor Register").click();
  await profile(page);
  await setHandler(page, "ei_debtor_save", () => ({ data: null, error: { code: "40001" } }));
  await fillReason(page);
  await visibleDialog(page).getByRole("button", { name: "Save changes" }).click();
  await visibleDialog(page).getByRole("button", { name: "Reload current version" }).click();
  await visibleDialog(page).getByRole("button", { name: "Save changes" }).waitFor();
  assert.equal((await last(page, "ei_debtor_profile")).p_id, 1);
});

test("commercial defaults, independent inheritance, explicit zero and dated withdrawal", { skip: !playwright }, async (t) => {
  const { page } = await scenario(t, "commercial-editor", "finance/debtor-kyc");
  await kycTab(page, "Commercial Policies").click();
  await page.getByLabel("Debtor type", { exact: true }).selectOption("40");
  await page.getByLabel("Region", { exact: true }).selectOption("1");
  await command(page, "Add default").click();
  const modal = visibleDialog(page);
  await modal.getByLabel("Effective from").fill("2026-01-01");
  await modal.getByLabel("Discount (%)", { exact: true }).fill("5");
  await modal.getByRole("button", { name: "Select scheme" }).click();
  await visibleDialog(page).getByRole("button", { name: "No Scheme" }).click();
  await fillReason(page);
  await modal.getByRole("button", { name: "Save policy" }).click();
  await page.getByText("Policy saved.").waitFor();
  await command(page, "Choose debtor").click();
  await visibleDialog(page).getByRole("button", { name: "Fixture Debtor 1", exact: true }).first().click();
  await page.getByLabel("Effective on").fill("2026-11-28");
  await page.getByText("5% · Type–region default").waitFor();
  await command(page, "Add override").click();
  await modal.getByLabel("Effective from").fill("2026-02-01");
  await modal.getByLabel("Discount (%)", { exact: true }).fill("0");
  await fillReason(page);
  await modal.getByRole("button", { name: "Save policy" }).click();
  await page.getByText("0% · Debtor override").waitFor();
  await page.getByText("No Scheme · Type–region default").waitFor();
  assert.equal((await last(page, "ei_debtor_terms_set")).p_discount, 0);
  assert.equal((await last(page, "ei_debtor_terms_set")).p_scheme, null);
  await command(page, "Withdraw override").click();
  await modal.getByLabel("Withdrawal date").fill("2026-05-01");
  await fillReason(page);
  await modal.getByRole("button", { name: "Confirm withdrawal" }).click();
  await page.getByText("5% · Type–region default").waitFor();
  await page.getByText("2026-02-01 → 2026-05-01").waitFor();
});

test("classified Finance retains company groups, handles negative subtotal and exports all canonical bill pages", { skip: !playwright }, async (t) => {
  const { page } = await scenario(t, "editor");
  assert.deepEqual(await last(page, "get_mis_finance_party_page"), { p_group_filter: "payables", p_search: "", p_limit: 25, p_offset: 0 });
  await page.locator("#financeFilterBtn").click();
  await page.locator("#financeClassFields").getByLabel("Region", { exact: true }).selectOption("1");
  await command(page, "Apply classification").click();
  await page.getByText("Filtered receivables", { exact: true }).waitFor();
  assert.match(await page.locator("#financeAgeing").innerText(), /-₹30/);
  const args = await last(page, "get_mis_finance_party_page");
  assert.equal(args.p_group_filter, "receivables");
  assert.equal(args.p_region_id, 1);
  await page.locator("#financeAgeBtn").click();
  await page.locator(".fin-age-dialog").getByRole("button", { name: /apply/i }).click();
  await page.locator("#financeAgeing .fin-age-group[data-group=filtered]").waitFor();
  assert.equal(await page.locator("#financeAgeing .fin-age-group").count(), 3);
  await page.locator("#financePartyTableWrap tbody tr").first().click();
  await page.locator("#financeBillTotals").getByText(/502 bills/).waitFor();
  await page.locator("#financeModalContent tbody").getByText("No usable date").first().waitFor();
  await page.locator("#financeBillMore").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__mis.calls.some((call) => call.name === "get_mis_finance_bill_page" && call.args.p_offset === 100));
  const download = page.waitForEvent("download");
  await page.locator("#financeBillExport").click();
  const file = await (await download).path();
  const csv = fs.readFileSync(file, "utf8");
  assert.match(csv, /Company oriented,Party oriented/);
  assert.match(csv, /Fixture 501/);
  assert.match(csv, /On account[^\r\n]*,30,-30,-30/);
  assert.equal((await calls(page, "get_mis_finance_bill_page")).some(({ args }) => args.p_offset === 500 && args.p_limit === 500), true);
  assert.doesNotMatch(csv, /contact_person|verification_status|actor_user_id/);
});
