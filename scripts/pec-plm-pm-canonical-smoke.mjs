/**
 * PEC Gate 1 — PLM -> PM canonical material-class static smoke.
 * No network, no Supabase calls, no database changes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(
  join(root, "public/shared/js/procurement-execution-console.js"),
  "utf8",
);
const html = readFileSync(
  join(root, "public/shared/procurement-execution-console.html"),
  "utf8",
);
const fails = [];
const assert = (cond, msg) => {
  if (!cond) fails.push(msg);
};

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
  assert(Boolean(fn), `${name} is defined`);
  return fn;
}

const helperSrc = [
  extractNamed(src, "canonicalMaterialClassCode"),
  extractNamed(src, "canonicalMaterialClassText"),
  extractNamed(src, "displayMaterialClassCode"),
  extractNamed(src, "displayMaterialClassText"),
  extractNamed(src, "materialClassIdFromCategoryCode"),
].join("\n");

let helpers = null;
try {
  helpers = new Function(
    `${helperSrc}\nreturn {\n  canonicalMaterialClassCode,\n  canonicalMaterialClassText,\n  displayMaterialClassCode,\n  displayMaterialClassText,\n  materialClassIdFromCategoryCode,\n};`,
  )();
} catch (err) {
  assert(false, `helper eval failed: ${err.message}`);
}

if (helpers) {
  const {
    canonicalMaterialClassCode,
    canonicalMaterialClassText,
    displayMaterialClassCode,
    displayMaterialClassText,
    materialClassIdFromCategoryCode,
  } = helpers;

  assert(
    canonicalMaterialClassCode("PLM") === "PM",
    "canonicalMaterialClassCode PLM -> PM",
  );
  assert(
    canonicalMaterialClassCode("plm") === "PM",
    "canonicalMaterialClassCode plm -> PM",
  );
  assert(
    canonicalMaterialClassCode("PM") === "PM",
    "canonicalMaterialClassCode PM -> PM",
  );
  assert(
    canonicalMaterialClassCode("RM") === "RM",
    "canonicalMaterialClassCode RM unchanged",
  );
  assert(
    canonicalMaterialClassCode("IND") === "IND",
    "canonicalMaterialClassCode IND unchanged",
  );
  assert(
    canonicalMaterialClassText("PLM - Packing Material") ===
      "PM - Packing Material",
    "canonicalMaterialClassText replaces word PLM",
  );
  assert(
    canonicalMaterialClassText("RM - Raw Material") === "RM - Raw Material",
    "canonicalMaterialClassText leaves RM",
  );
  assert(
    displayMaterialClassCode("PLM") === "PM",
    "displayMaterialClassCode wraps canonical helper",
  );
  assert(
    displayMaterialClassText("PLM") === "PM",
    "displayMaterialClassText wraps canonical helper",
  );

  assert(materialClassIdFromCategoryCode("RM") === 1, "RM -> material_class_id 1");
  assert(materialClassIdFromCategoryCode("PM") === 2, "PM -> material_class_id 2");
  assert(
    materialClassIdFromCategoryCode("PLM") === 2,
    "legacy PLM -> material_class_id 2",
  );
  assert(
    materialClassIdFromCategoryCode("plm") === 2,
    "legacy plm -> material_class_id 2",
  );
  assert(
    materialClassIdFromCategoryCode("IND") === 5,
    "IND -> material_class_id 5",
  );

  assert(
    canonicalMaterialClassCode("PLM") === canonicalMaterialClassCode("PM"),
    "excess-style compare: legacy PLM row matches PM filter",
  );
  assert(
    canonicalMaterialClassCode("RM") !== canonicalMaterialClassCode("PM"),
    "excess-style compare: RM does not match PM",
  );
}

const populateVwl = extractNamed(src, "populateVwlMaterialClassFilter");
assert(
  populateVwl.includes("opt.dataset.code = canonicalMaterialClassCode("),
  "VWL filter option dataset.code is canonical",
);
assert(
  populateVwl.includes("canonicalMaterialClassText(row.material_class_display)"),
  "VWL filter option text canonicalizes material_class_display",
);
assert(
  populateVwl.includes(
    "canonicalMaterialClassCode(row.material_class_code || \"\")",
  ) &&
    populateVwl.includes(
      "canonicalMaterialClassText(row.material_class_label || \"\")",
    ),
  "VWL filter fallback code/label construction is canonical",
);
assert(
  populateVwl.includes("state.vwlFilters.materialClassCode = canonicalMaterialClassCode("),
  "VWL filter state materialClassCode is canonical",
);
assert(
  !/opt\.dataset\.code = row\.material_class_code/.test(populateVwl),
  "VWL filter no longer stores raw material_class_code on options",
);

const getSelected = extractNamed(src, "getSelectedVwlMaterialClassCode");
assert(
  getSelected.includes("canonicalMaterialClassCode("),
  "getSelectedVwlMaterialClassCode returns canonical code",
);

const refreshRm = extractNamed(src, "refreshVwlRmScopeAvailability");
assert(
  refreshRm.includes('getSelectedVwlMaterialClassCode()') &&
    refreshRm.includes('"RM"'),
  "VWL RM scope availability remains RM-only",
);
assert(
  !refreshRm.includes("PLM") && !refreshRm.includes("PM"),
  "VWL RM scope is not enabled by PM/PLM",
);

const exportRow = extractNamed(src, "mapVendorBuylistExportRow");
assert(
  exportRow.includes('canonicalMaterialClassText(row.material_class_display)') &&
    exportRow.includes('canonicalMaterialClassText(row.material_class_label)') &&
    exportRow.includes('canonicalMaterialClassCode(row.material_class_code)'),
  "VWL export Material Class uses canonical helpers",
);
assert(
  !/row\.material_class_display \|\|/.test(exportRow),
  "VWL export does not use raw material_class_display",
);

const excessLoad = extractNamed(src, "loadExcess");
assert(
  excessLoad.includes(
    "canonicalMaterialClassCode(r.material_class_code)",
  ) &&
    excessLoad.includes(
      "canonicalMaterialClassCode(filters.materialClassId)",
    ),
  "Excess filter compares canonical class codes on both sides",
);

const prExport = extractNamed(src, "buildPrFormExportRows");
assert(
  prExport.includes(
    "canonicalMaterialClassCode(row.material_class_code ?? \"\")",
  ),
  "PR export Class column is canonicalized",
);

const indentExport = extractNamed(src, "openExportIndentModal");
assert(
  indentExport.includes("canonicalMaterialClassCode(row.material_class_code)"),
  "indent export store classification uses canonical class code",
);
assert(
  indentExport.includes('classCode === "PM"') &&
    indentExport.includes("Packing Material Store"),
  "canonical PM selects Packing Material Store",
);

const stockPicker = extractNamed(src, "runStockPickerSearch");
assert(
  stockPicker.includes("displayMaterialClassCode(item.category_code)") ||
    stockPicker.includes("canonicalMaterialClassCode(item.category_code)"),
  "general stock picker labels are canonical",
);

assert(
  src.includes(
    "canonicalMaterialClassCode(item.category_code) ||",
  ),
  "PR add-line picker labels are canonical",
);
assert(
  src.includes(
    'const classLabel = canonicalMaterialClassCode(item.category_code ?? "")',
  ),
  "indent add-line picker labels are canonical",
);

const indentSearch = extractNamed(src, "applyIndentLineFiltersAndRender");
assert(
  indentSearch.includes("r.material_class_code") &&
    indentSearch.includes("canonicalMaterialClassCode(r.material_class_code)"),
  "indent-line search haystack includes both raw and canonical class codes",
);

assert(
  !src.includes("p_material_class_code"),
  "no material-class write payload uses p_material_class_code",
);
assert(
  !/material_class_code\s*:\s*["']PLM["']/.test(src),
  "no client-generated material_class_code: PLM write",
);
assert(
  !src.includes('"PLM"') ||
    extractFunction(src, "canonicalMaterialClassCode").includes('"PLM"'),
  "quoted PLM is confined to canonical inbound compatibility",
);
assert(
  /p_material_class_id:/.test(src),
  "existing numeric p_material_class_id write contracts remain",
);

assert(
  src.includes('const MODULE_TARGET = `module:${MODULE_ID}`') &&
    src.includes('const MODULE_ID = "procurement-execution-console"'),
  "MODULE_TARGET remains module:procurement-execution-console",
);
assert(
  src.includes("function canPerformEditAction"),
  "canPerformEditAction guard remains",
);
assert(
  src.includes('document.body.classList.toggle("view-only-mode"'),
  "view-only-mode behaviour remains",
);
assert(src.includes("function canWriteModule"), "canWriteModule guard remains");
assert(
  src.includes("function applyPermissionUi"),
  "applyPermissionUi remains",
);

assert(/option value="PM">PM</.test(html), "HTML Excess filter has canonical PM");
assert(/option value="2">PM</.test(html), "HTML id-based filters have PM");
assert(/option value="RM">RM</.test(html), "HTML Excess filter has RM");
assert(/option value="1">RM</.test(html), "HTML id-based filters have RM");
assert(/option value="IND">IND</.test(html), "HTML Excess filter has IND");
assert(/option value="5">IND</.test(html), "HTML id-based filters have IND");
assert(
  !/\bPLM\b/i.test(html),
  "HTML has no user-facing PLM literal",
);

const plmMatches = [...src.matchAll(/\bPLM\b|\bplm\b/g)].map((m) => {
  const idx = m.index ?? 0;
  const line = src.slice(0, idx).split("\n").length;
  const lineText = src.split("\n")[line - 1] ?? "";
  return { line, text: lineText.trim(), token: m[0] };
});

const allowedReasons = [];
for (const hit of plmMatches) {
  const t = hit.text;
  const allowed =
    t.includes("canonicalMaterialClassCode") ||
    t.includes("canonicalMaterialClassText") ||
    t.includes("retired packing-material code PLM") ||
    t.includes("replace(/\\bPLM\\b/g, \"PM\")") ||
    t.includes('return code === "PLM" ? "PM" : code') ||
    t.includes("is_plm") ||
    t.includes('source_kind') ||
    t.includes('["rm", "plm", "consumables"]') ||
    t.includes("Retained server contract");
  if (allowed) {
    allowedReasons.push(`${hit.line}:${hit.token}`);
    continue;
  }
  fails.push(
    `unexpected PLM/plm at JS L${hit.line}: ${t.slice(0, 160)}`,
  );
}

assert(
  src.includes('column: "is_plm"'),
  "legacy picker contract is_plm is retained",
);
assert(
  src.includes('["rm", "plm", "consumables"]'),
  "legacy source_kind plm ranking is retained",
);

if (fails.length) {
  console.error("PEC PLM->PM canonical smoke FAILED:");
  fails.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("PEC PLM->PM canonical smoke passed");
console.log(
  `Retained PLM/plm occurrences (${allowedReasons.length}): ${allowedReasons.join(", ")}`,
);
