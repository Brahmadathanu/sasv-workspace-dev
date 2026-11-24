#!/usr/bin/env node
/** PEC-UX03 evidence: screenshots of all six PEC lenses at 390 and 1440. Usage: node scripts/pec-ux03-lenses.mjs <outDir> */
import fs from "node:fs";
import path from "node:path";
import { startHarness } from "./lib/pec-ui-harness.mjs";
const out = path.resolve(process.argv[2] || "pec-ux03-lenses");
fs.mkdirSync(out, { recursive: true });
const h = await startHarness();
for (const [w, ht] of [[390, 844], [1440, 900]]) {
  for (const tab of ["pr", "indents", "vendor-buylist", "action", "purchase-allocations", "excess"]) {
    const r = await h.open({ role: "edit", indentDate: true }, { width: w, height: ht }, { dsf: 1, fixedTime: "2026-11-24T05:00:00Z" });
    const { page, ctx } = r;
    try {
      if (w <= 520) await page.selectOption("#procTabSelect", tab); else await page.click(`.tabs .tab-btn[data-tab="${tab}"]`);
      await page.waitForSelector(`#tab-${tab}.active`);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, `${tab}-${w}.png`) });
    } catch (e) { console.error(tab, w, String(e).slice(0, 100)); }
    await ctx.close();
  }
}
process.exit(0);
