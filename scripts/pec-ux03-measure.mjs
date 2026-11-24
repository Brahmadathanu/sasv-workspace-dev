#!/usr/bin/env node
/**
 * PEC-UX03 evidence: pre-data vertical height of the Purchase Allocations lens + screenshots.
 * Works against the CURRENT tree (run once on the v6.5.0 baseline -> "before", once on the patch -> "after").
 * Synthetic fixtures only (scripts/lib/pec-ui-harness.mjs). Usage: node scripts/pec-ux03-measure.mjs <outDir>
 */
import fs from "node:fs";
import path from "node:path";
import { startHarness } from "./lib/pec-ui-harness.mjs";
import * as fx from "./fixtures/pec-purchase-allocations-view-model.mjs";

const out = path.resolve(process.argv[2] || "pec-ux03-evidence");
fs.mkdirSync(out, { recursive: true });
const FIXED = "2026-11-24T05:00:00Z";
const retarget = (r) => (r.indent_id === 840 ? { ...r, indent_id: 101 } : r);
const mat = (o) => ({ material_class_id: 1, material_class_code: "RM", uom_id: 1, uom_code: "Kg", purchase_fact_count: 1, gross_qty: "10", effective_qty: "10",
  allocated_qty: "5", matching_allocated_qty: "5", unallocated_qty: "5", accepted_qty: "0", net_unallocated_qty: "5", ...o });
const data = {
  summary: fx.SUMMARY_RAW, indent: fx.INDENT_ROWS_RAW.map(retarget),
  material: Array.from({ length: 12 }, (_, i) => mat({ stock_item_id: 9000 + i, stock_item_name: `Synthetic Material ${i + 1}` })),
  vendor: [1, 2, 3, 4, 5, 6].map((i) => ({ vendor_key: `v:${i}`, vendor_id: i, supplier_name: `Supplier ${i}`, material_count: 2, purchase_fact_count: 3,
    totals_by_uom: [{ uom_id: 1, uom_code: "Kg", gross_qty: "135", effective_qty: "135", allocated_qty: "100", matching_allocated_qty: "100", unallocated_qty: "35", accepted_qty: "0", net_unallocated_qty: "35" }] })),
  trail: [...fx.NOV23_TRAIL_RAW, ...fx.REPEATED_LINE_RAW].map(retarget),
};
function mockInit({ data }) {
  globalThis.__paData = data;
  const page = (rows, p) => rows.slice(p.p_offset || 0, (p.p_offset || 0) + (p.p_limit || 50)).map((r) => ({ row_data: r, total_count: rows.length }));
  globalThis.__paRpc = async (name, p) => {
    if (!name.startsWith("proc_pec_purchase_alloc_")) return undefined;
    const D = globalThis.__paData;
    if (name.endsWith("_summary")) return { data: D.summary, error: null };
    if (name.endsWith("_indent_paged")) return { data: page(D.indent, p), error: null };
    if (name.endsWith("_material_paged")) return { data: page(D.material, p), error: null };
    if (name.endsWith("_vendor_paged")) return { data: page(D.vendor, p), error: null };
    return { data: page(D.trail, p), error: null };
  };
}
const VPS = [[375, 812], [390, 844], [430, 932], [820, 1180], [1440, 900]];
const FIRST = { indent: ".pa-indent-card", material: "#paMaterialTbody tr", vendor: "#paVendorTbody tr" };
const h = await startHarness();
const rows = [];
for (const [w, ht] of VPS) {
  const r = await h.open({ role: "edit", indentDate: true }, { width: w, height: ht }, { dsf: 1, fixedTime: FIXED, init: { fn: mockInit, arg: { data } } });
  const { page, ctx } = r;
  if (w <= 520) await page.selectOption("#procTabSelect", "purchase-allocations"); else await page.click('.tabs .tab-btn[data-tab="purchase-allocations"]');
  await page.waitForSelector(".pa-indent-card");
  await page.waitForTimeout(400);
  for (const mode of ["indent", "material", "vendor"]) {
    await page.click(`[data-pa-mode="${mode}"]`);
    await page.waitForSelector(FIRST[mode]);
    await page.waitForTimeout(250);
    const m = await page.evaluate(({ sel }) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null);
      const vh = innerHeight;
      const first = els[0]?.getBoundingClientRect();
      const visible = els.filter((e) => { const b = e.getBoundingClientRect(); return b.top < vh - 8 && b.bottom > b.top + 0.6 * b.height ? b.top + 0.6 * b.height < vh : false; }).length;
      return { firstTop: first ? Math.round(first.top) : null, visible, vh, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
    }, { sel: FIRST[mode] });
    rows.push({ width: w, height: ht, mode, ...m });
    await page.screenshot({ path: path.join(out, `pa-${mode}-${w}.png`) });
  }
  await ctx.close();
}
await h.close?.();
fs.writeFileSync(path.join(out, "measurements.json"), JSON.stringify(rows, null, 2));
console.table(rows);
process.exit(0);
