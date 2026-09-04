import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { compareIntendedVsPortal } = require(join(root, "electron/eaushadhi-worker/compare.js"));

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const intended = {
  product: { canonical_product_name: "Dasamoolarishtam" },
  details: {
    permission_purpose_label: "Classical",
    composition_title: "Title",
    diseases_conditions: "Fever",
    combined_restricted_declaration: "NO",
  },
  actions: [{ label: "Deepana" }, { label: "Pachana" }],
  composition: [
    {
      source_composition_line_id: 1,
      ingredient_name: "Bilva",
      scientific_name: "Aegle marmelos",
      quantity_value: 1,
      unit_text: "kg",
      part_used: { label: "Root" },
    },
  ],
};

const equalPortal = {
  ...intended,
  product: { canonical_product_name: "  Dasamoolarishtam " },
  actions: [{ label: "Pachana" }, { label: "Deepana" }],
};
assert(compareIntendedVsPortal(intended, equalPortal).equal, "exact equal after trim and action set order");

const qty = structuredClone(intended);
qty.composition[0].quantity_value = 2;
assert(
  compareIntendedVsPortal(intended, qty).diffs.some((d) => d.kind === "quantity"),
  "quantity mismatch",
);

const unit = structuredClone(intended);
unit.composition[0].unit_text = "g";
assert(
  compareIntendedVsPortal(intended, unit).diffs.some((d) => d.kind === "unit"),
  "unit mismatch",
);

const missing = structuredClone(intended);
missing.composition = [];
assert(
  compareIntendedVsPortal(intended, missing).diffs.some((d) => d.kind === "missing_row"),
  "missing composition row",
);

const extra = structuredClone(intended);
extra.composition = [
  ...intended.composition,
  { source_composition_line_id: 2, ingredient_name: "Ginger", quantity_value: 1, unit_text: "kg" },
];
assert(
  compareIntendedVsPortal(intended, extra).diffs.some((d) => d.kind === "extra_row"),
  "extra composition row",
);

const text = structuredClone(intended);
text.details.composition_title = "Other";
assert(
  compareIntendedVsPortal(intended, text).diffs.some((d) => d.path === "details.composition_title"),
  "meaningful text difference",
);

const diacritic = structuredClone(intended);
diacritic.composition[0].ingredient_name = "Bilvā";
assert(
  compareIntendedVsPortal(intended, diacritic).diffs.some((d) => d.path.includes("ingredient_name")),
  "diacritic difference is kept",
);

if (failed) {
  console.error(`\n${failed} compare assertion(s) failed`);
  process.exit(1);
}
console.log("\neaushadhi-worker-compare-smoke: all assertions passed");
