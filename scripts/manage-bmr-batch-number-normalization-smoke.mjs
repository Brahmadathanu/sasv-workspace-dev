/**
 * Manage BMR — three-digit batch number normalization.
 * No network, no Supabase calls, no database changes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "public/shared/js/manage-bmr.js"), "utf8");

let failed = 0;
function assert(condition, message) {
  if (condition) console.log("OK", message);
  else {
    failed += 1;
    console.error("FAIL", message);
  }
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return "";
  const brace = source.indexOf("{", start);
  if (brace < 0) return "";
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
}

function extractNamed(source, name) {
  const fn = extractFunction(source, name);
  assert(fn.startsWith(`function ${name}(`), `${name} is defined once as a function`);
  assert(
    source.indexOf(`function ${name}(`) === source.lastIndexOf(`function ${name}(`),
    `${name} has a single definition`,
  );
  return fn;
}

const helperSrc = [
  extractNamed(src, "normalizeBmrBatchNumber"),
  extractNamed(src, "bmrCreateDuplicateKey"),
  extractNamed(src, "takeUniqueCreateRows"),
  extractNamed(src, "csvToRows"),
].join("\n");

const helpers = new Function(
  `${helperSrc}\nreturn { normalizeBmrBatchNumber, bmrCreateDuplicateKey, takeUniqueCreateRows, csvToRows };`,
)();

const { normalizeBmrBatchNumber, bmrCreateDuplicateKey, takeUniqueCreateRows, csvToRows } =
  helpers;

const examples = [
  ["147", "0147"],
  ["047", "0047"],
  ["0147", "0147"],
  ["5147", "5147"],
  ["SSP0606", "SSP0606"],
];

for (const [input, expected] of examples) {
  assert(
    normalizeBmrBatchNumber(input) === expected,
    `normalize ${input} -> ${expected}`,
  );
}

assert(normalizeBmrBatchNumber("  147  ") === "0147", "trimmed three digits are padded");
assert(normalizeBmrBatchNumber("12") === "12", "two digits stay unchanged");
assert(normalizeBmrBatchNumber("12345") === "12345", "five digits stay unchanged");
assert(normalizeBmrBatchNumber("14 7") === "14 7", "internal space stays unchanged");
assert(normalizeBmrBatchNumber("") === "", "empty stays empty");
assert(normalizeBmrBatchNumber(null) === "", "null becomes empty");

const csv = [
  "item,bn,batch_size,uom",
  ...examples.map(([bn]) => `Sample Item,${bn},10,Kg`),
].join("\n");
const csvRows = csvToRows(csv);

assert(csvRows.length === examples.length, "CSV parses one row per example");
examples.forEach(([input, expected], index) => {
  const manual = normalizeBmrBatchNumber(input);
  assert(
    csvRows[index].bn === expected && manual === expected && csvRows[index].bn === manual,
    `CSV and manual parity for ${input} -> ${expected}`,
  );
  assert(csvRows[index].item === "Sample Item", `CSV item preserved for ${input}`);
  assert(csvRows[index].size === 10, `CSV size preserved for ${input}`);
  assert(csvRows[index].uom === "Kg", `CSV uom preserved for ${input}`);
});

const headerless = csvToRows("Sample Item,147,10,Kg");
assert(
  headerless.length === 1 && headerless[0].bn === "0147",
  "headerless CSV pads a three-digit batch number",
);

const quoted = csvToRows('item,bn,batch_size,uom\n"Sample Item","047","10","Kg"');
assert(quoted[0].bn === "0047", "quoted CSV batch number is normalized");

const sameBatch = takeUniqueCreateRows([
  { item: "Sample Item", bn: "147", size: 10, uom: "Kg" },
  { item: "sample item", bn: "0147", size: 12, uom: "Kg" },
]);
assert(sameBatch.duplicateCount === 1, "147 and 0147 are one in-batch duplicate");
assert(
  sameBatch.unique.length === 1 && sameBatch.unique[0].bn === "0147",
  "kept row uses the normalized batch number",
);

const distinct = takeUniqueCreateRows([
  { item: "Sample Item", bn: "0147", size: 10, uom: "Kg" },
  { item: "Sample Item", bn: "5147", size: 10, uom: "Kg" },
  { item: "Sample Item", bn: "SSP0606", size: 10, uom: "Kg" },
]);
assert(distinct.duplicateCount === 0 && distinct.unique.length === 3, "4-digit and alphanumeric batches stay distinct");
assert(
  distinct.unique.map((row) => row.bn).join(",") === "0147,5147,SSP0606",
  "distinct batch numbers are not rewritten",
);

assert(
  bmrCreateDuplicateKey("Sample Item", "147") === bmrCreateDuplicateKey("Sample Item", "0147"),
  "duplicate key compares normalized batch numbers",
);
assert(
  bmrCreateDuplicateKey("Sample Item", "SSP0606") !== bmrCreateDuplicateKey("Sample Item", "147"),
  "alphanumeric batch number is a different duplicate key",
);

const getCreateSrc = extractFunction(src, "getCreateRowsFromTable");
const csvSrc = extractFunction(src, "csvToRows");
const saveStart = src.indexOf("async function saveEditModal()");
const saveEnd = src.indexOf("async function loadHierarchyMap()");
const saveSrc = src.slice(saveStart, saveEnd);

assert(
  getCreateSrc.includes("normalizeBmrBatchNumber(tr.querySelector(\".c-bn\").value)"),
  "manual entry normalizes the batch number before preview and submit",
);
assert(
  csvSrc.includes("normalizeBmrBatchNumber(rawBn)"),
  "CSV parsing normalizes through the shared function",
);
assert(
  src.includes("rows = getCreateRowsFromTable()") &&
    src.includes("${escHtml(r.bn)}") &&
    src.includes("takeUniqueCreateRows(rows)"),
  "preview renders normalized bn and submit rechecks normalized duplicates",
);
assert(
  !saveSrc.includes("normalizeBmrBatchNumber"),
  "editing an existing BMR does not rewrite its batch number",
);
assert(
  !src.includes("rpc_admin_correct_bmr_plan_mapping") &&
    !src.includes("rpc_preview_bmr_admin_correction"),
  "create normalization does not call administrative correction RPCs",
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll batch-number normalization checks passed.");
