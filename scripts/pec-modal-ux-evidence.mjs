#!/usr/bin/env node
/**
 * PEC-UX-02 evidence: screenshots of the indent-originated secondary dialogs
 * (and PR-side siblings) at desktop and narrow widths.
 * Usage: node scripts/pec-modal-ux-evidence.mjs <outDir>
 * Offline synthetic fixture (see scripts/lib/pec-ui-harness.mjs); not operational acceptance.
 */
import fs from "node:fs";
import path from "node:path";
import { startHarness } from "./lib/pec-ui-harness.mjs";

const out = path.resolve(process.argv[2] || "pec-modal-ux-shots");
fs.mkdirSync(out, { recursive: true });
const VPS = [{ name: "desktop", width: 1440, height: 900 }, { name: "narrow", width: 390, height: 800 }];
const FORCED = [
  "indentSourcePr", "indentResync", "indentAddLine", "clearSelectedVendor", "vendor",
  "hardDelete", "stockPicker", "exportIndent", "acceptExcess", "prSetStatus", "prAddLine", "snapshotRefresh",
];
const h = await startHarness();
for (const vp of VPS) {
  const { ctx, page } = await h.open({ role: "edit", indentDate: true }, vp, { dsf: 2 });
  await h.openIndentModal(page, vp);
  const shot = async (id, label) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `${vp.name}-${label}.png`) });
  };
  // Real flow: Recommend & Accept Vendors from the indent modal.
  await page.click("#btnIndentRecommendAcceptVendors");
  await page.waitForSelector("#vendorAcceptModeModalBackdrop.show");
  await shot("vendorAcceptMode", "recommend-accept-vendors");
  await page.click("#btnVendorAcceptModeCancel");
  await page.waitForFunction(() => !document.querySelector("#vendorAcceptModeModalBackdrop.show"));
  // Real flow: first available status action on the indent.
  const act = page.locator("#indentViewModalBackdrop .status-action:visible").first();
  if (await act.count()) {
    await act.click();
    if (await page.locator("#indentActionModalBackdrop.show").count()) {
      await shot("indentAction", "indent-action");
      await page.click("#btnIndentActionCancel");
    }
  }
  for (const key of FORCED) {
    const id = `${key}ModalBackdrop`;
    // Layout audit only: content is the static template (no live data).
    await page.evaluate((i) => document.getElementById(i)?.classList.add("show"), id);
    await shot(id, key);
    await page.evaluate((i) => document.getElementById(i)?.classList.remove("show"), id);
  }
  await ctx.close();
}
await h.close();
console.log(`screenshots written to ${out}`);
