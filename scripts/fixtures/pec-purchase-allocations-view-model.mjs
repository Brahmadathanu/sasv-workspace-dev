// SYNTHETIC client view-model fixtures for the Purchase Allocations lens.
// Shapes follow the client view-model typedefs in public/shared/js/pec-purchase-allocations.js.
// They are NOT server responses and make no claim about RPC field names. The first block is
// modelled on the 23 Nov 2026 acceptance case; values here are test data, never operational data.

/** Purchase fact 169565 (Kera Traders, Sathavari Kizhangu (D)) distributed to three indents. */
export const NOV23_TRAIL = [
  { purchaseFactId: 169565, voucherDate: "2026-11-23", vendorName: "Kera Traders", materialClass: "RM", stockItemId: 9001,
    materialName: "Sathavari Kizhangu (D)", uom: "Kg", indentNumber: 84, indentSerial: 107, allocatedQty: 5,
    periodOpeningBalance: 5, periodClosingBalance: 0, currentBalance: 0 },
  { purchaseFactId: 169565, voucherDate: "2026-11-23", vendorName: "Kera Traders", materialClass: "RM", stockItemId: 9001,
    materialName: "Sathavari Kizhangu (D)", uom: "Kg", indentNumber: 156, indentSerial: 170, allocatedQty: 50,
    periodOpeningBalance: 50, periodClosingBalance: 0, currentBalance: 0 },
  { purchaseFactId: 169565, voucherDate: "2026-11-23", vendorName: "Kera Traders", materialClass: "RM", stockItemId: 9001,
    materialName: "Sathavari Kizhangu (D)", uom: "Kg", indentNumber: 191, indentSerial: 198, allocatedQty: 80,
    periodOpeningBalance: 100, periodClosingBalance: 20, currentBalance: 20 },
];

export const NOV23_FACTS = [
  { purchaseFactId: 169565, voucherDate: "2026-11-23", vendorName: "Kera Traders", materialName: "Sathavari Kizhangu (D)", uom: "Kg",
    grossQty: 135, effectiveQty: 135, allocatedQty: 135, unallocatedQty: 0, acceptedExcessQty: 0 },
];

/** Mixed-UOM, return-adjusted, unallocated and multi-receipt cases (synthetic). */
export const MIXED_FACTS = [
  ...NOV23_FACTS,
  { purchaseFactId: 170001, voucherDate: "2026-11-23", vendorName: "Alpha Supplies", materialName: "Synthetic Oil", uom: "L",
    grossQty: 35, effectiveQty: 35, allocatedQty: 35, unallocatedQty: 0, acceptedExcessQty: 0 },
  { purchaseFactId: 170002, voucherDate: "2026-11-23", vendorName: "Alpha Supplies", materialName: "Synthetic Bottle", uom: "Nos",
    grossQty: 41066, effectiveQty: 41066, allocatedQty: 30000, unallocatedQty: 11066, acceptedExcessQty: 0 },
  // return-adjusted: gross 100, effective 80 (a later negative fact reversed 20), 60 allocated, 20 unallocated
  { purchaseFactId: 170003, voucherDate: "2026-11-23", vendorName: "Beta Traders", materialName: "Synthetic Herb", uom: "Kg",
    grossQty: 100, effectiveQty: 80, allocatedQty: 60, unallocatedQty: 20, acceptedExcessQty: 0 },
  // fully unallocated receipt with accepted excess
  { purchaseFactId: 170004, voucherDate: "2026-11-23", vendorName: "Beta Traders", materialName: "Synthetic Resin", uom: "Kg",
    grossQty: 12.5, effectiveQty: 12.5, allocatedQty: 0, unallocatedQty: 12.5, acceptedExcessQty: 12.5 },
];
