// SYNTHETIC fixtures for the Purchase Allocations lens, in the frozen V1 RPC response shapes
// (snake_case row_data objects). They are test data, not server output and not operational data.
// The first block is modelled on the 23 Nov 2026 acceptance case (purchase fact 169565).

export const paged = (rows) => rows.map((r) => ({ row_data: r, total_count: rows.length }));

const rec = (o) => ({
  purchase_fact_id: 0, voucher_date: "2026-11-23", vendor_key: "v:1", vendor_id: 1, supplier_name: "Kera Traders",
  material_class_id: 1, material_class_code: "RM", stock_item_id: 9001, stock_item_name: "Sathavari Kizhangu (D)", uom_id: 1, uom_code: "Kg",
  gross_qty: 0, effective_qty: 0, receipt_allocated_qty: 0, unallocated_qty: 0, accepted_qty: 0, net_unallocated_qty: 0,
  indent_id: null, indent_number: null, indent_line_id: null, indent_line_sort_no: null, approved_date: null, requested_qty: null,
  allocated_qty: null, opening_balance: null, period_new_demand_qty: null, period_allocated_qty: null, closing_balance: null,
  current_balance: null, row_kind: "unallocated", ...o,
});
const alloc = (o) => rec({ row_kind: "allocation", ...o });

/** Fact 169565: 135 Kg to indents 84/107 (5), 156/170 (50), 191/198 (80). Receipt quantities repeat on each row. */
export const NOV23_TRAIL_RAW = [
  alloc({ purchase_fact_id: 169565, gross_qty: "135", effective_qty: "135", receipt_allocated_qty: "135", indent_id: 840, indent_number: 84,
    indent_line_id: 8401, indent_line_sort_no: 107, approved_date: "2026-11-02", requested_qty: "5", allocated_qty: "5",
    opening_balance: "5", period_new_demand_qty: "0", period_allocated_qty: "5", closing_balance: "0", current_balance: "0" }),
  alloc({ purchase_fact_id: 169565, gross_qty: "135", effective_qty: "135", receipt_allocated_qty: "135", indent_id: 1560, indent_number: 156,
    indent_line_id: 15601, indent_line_sort_no: 170, approved_date: "2026-11-10", requested_qty: "50", allocated_qty: "50",
    opening_balance: "50", period_new_demand_qty: "0", period_allocated_qty: "50", closing_balance: "0", current_balance: "0" }),
  alloc({ purchase_fact_id: 169565, gross_qty: "135", effective_qty: "135", receipt_allocated_qty: "135", indent_id: 1910, indent_number: 191,
    indent_line_id: 19101, indent_line_sort_no: 198, approved_date: "2026-11-15", requested_qty: "100", allocated_qty: "80",
    opening_balance: "100", period_new_demand_qty: "0", period_allocated_qty: "80", closing_balance: "20", current_balance: "20" }),
];

/** One indent line fed by two receipts: period balances repeat on both rows (must be de-duplicated by indent line). */
export const REPEATED_LINE_RAW = [
  alloc({ purchase_fact_id: 170020, vendor_key: "v:2", vendor_id: 2, supplier_name: "Alpha Supplies", stock_item_id: 9100, stock_item_name: "Synthetic Herb",
    gross_qty: "30", effective_qty: "30", receipt_allocated_qty: "30", indent_id: 500, indent_number: 500, indent_line_id: 5001, indent_line_sort_no: 7,
    approved_date: "2026-11-23", requested_qty: "50", allocated_qty: "30", opening_balance: "0", period_new_demand_qty: "50",
    period_allocated_qty: "50", closing_balance: "0", current_balance: "0" }),
  alloc({ purchase_fact_id: 170021, vendor_key: "v:2", vendor_id: 2, supplier_name: "Alpha Supplies", stock_item_id: 9100, stock_item_name: "Synthetic Herb",
    gross_qty: "20", effective_qty: "20", receipt_allocated_qty: "20", indent_id: 500, indent_number: 500, indent_line_id: 5001, indent_line_sort_no: 7,
    approved_date: "2026-11-23", requested_qty: "50", allocated_qty: "20", opening_balance: "0", period_new_demand_qty: "50",
    period_allocated_qty: "50", closing_balance: "0", current_balance: "0" }),
];

/** Zero-effective returned receipt, a positive unallocated receipt with accepted excess, and two DIFFERENT unmapped suppliers. */
export const RETURNED_AND_UNALLOCATED_RAW = [
  rec({ purchase_fact_id: 170030, vendor_key: "name:cash a", vendor_id: null, supplier_name: "Cash Purchase", stock_item_id: 9200,
    stock_item_name: "Synthetic Resin", gross_qty: "40", effective_qty: "0", receipt_allocated_qty: "0", unallocated_qty: "0" }),
  rec({ purchase_fact_id: 170031, vendor_key: "name:cash b", vendor_id: null, supplier_name: "Cash Purchase", stock_item_id: 9200,
    stock_item_name: "Synthetic Resin", gross_qty: "12.5", effective_qty: "12.5", receipt_allocated_qty: "0", unallocated_qty: "12.5",
    accepted_qty: "12.5", net_unallocated_qty: "0" }),
];

/** One receipt of 100 Kg fully allocated across indents 300 (60) and 301 (40); the trail filtered to indent 300 shows only its row. */
export const FILTERED_RECEIPT_RAW = [
  alloc({ purchase_fact_id: 170040, vendor_key: "v:3", vendor_id: 3, supplier_name: "Beta Traders", stock_item_id: 9300, stock_item_name: "Synthetic Root",
    gross_qty: "100", effective_qty: "100", receipt_allocated_qty: "100", unallocated_qty: "0", indent_id: 300, indent_number: 300,
    indent_line_id: 3001, indent_line_sort_no: 1, approved_date: "2026-11-01", requested_qty: "60", allocated_qty: "60",
    opening_balance: "60", period_new_demand_qty: "0", period_allocated_qty: "60", closing_balance: "0", current_balance: "0" }),
];

/** Decimal precision: 9,369.455 gross and 8,914.463741 allocated (6 d.p.) must survive summing exactly. */
export const DECIMAL_TOTALS = [
  { uom_id: 1, uom_code: "Kg", gross_qty: "9369.455", effective_qty: "9369.455", allocated_qty: "8914.463741", matching_allocated_qty: "8914.463741",
    unallocated_qty: "454.991259", accepted_qty: "0", net_unallocated_qty: "454.991259" },
  { uom_id: 2, uom_code: "L", gross_qty: "35", effective_qty: "35", allocated_qty: "35", matching_allocated_qty: "35",
    unallocated_qty: "0", accepted_qty: "0", net_unallocated_qty: "0" },
  { uom_id: 3, uom_code: "Nos", gross_qty: "41066", effective_qty: "41066", allocated_qty: "30000", matching_allocated_qty: "30000",
    unallocated_qty: "11066", accepted_qty: "0", net_unallocated_qty: "11066" },
];

export const SUMMARY_RAW = {
  date_from: "2026-11-23", date_to: "2026-11-23", purchase_fact_count: 39, affected_indent_count: 9, affected_indent_line_count: 38,
  totals_by_uom: DECIMAL_TOTALS, coverage: "Approved and issued indents only.",
  balance_basis: "Balances are reconstructed under the current allocation authority, not immutable historical snapshots.",
};

export const INDENT_ROWS_RAW = [
  { indent_id: 1560, indent_number: 156, approved_date: "2026-11-10", material_line_count: 1, totals_by_uom: [{ uom_id: 1, uom_code: "Kg", allocated_qty: "50" }] },
  { indent_id: 840, indent_number: 84, approved_date: "2026-11-02", material_line_count: 1, totals_by_uom: [{ uom_id: 1, uom_code: "Kg", allocated_qty: "5" }] },
  { indent_id: 1910, indent_number: 191, approved_date: "2026-11-15", material_line_count: 2,
    totals_by_uom: [{ uom_id: 2, uom_code: "L", allocated_qty: "10" }, { uom_id: 1, uom_code: "Kg", allocated_qty: "80" }] },
];
