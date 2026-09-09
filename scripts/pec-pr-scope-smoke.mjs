/**
 * PEC PR Workbench Scope presentation smoke.
 * Proves prScopeText falls back to material class when RM scope is absent,
 * and that VWL / Generate-PR RM-scope contracts remain untouched.
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
  extractNamed(src, "normalizePrRmScopeLabel"),
  extractNamed(src, "prScopeText"),
].join("\n");

let helpers = null;
try {
  helpers = new Function(
    `${helperSrc}\nreturn {\n  canonicalMaterialClassCode,\n  canonicalMaterialClassText,\n  normalizePrRmScopeLabel,\n  prScopeText,\n};`,
  )();
} catch (err) {
  assert(false, `helper eval failed: ${err.message}`);
}

if (helpers) {
  const { prScopeText, normalizePrRmScopeLabel } = helpers;

  assert(
    normalizePrRmScopeLabel("normal") === "Normal RM",
    "normalizePrRmScopeLabel normal -> Normal RM",
  );
  assert(
    normalizePrRmScopeLabel("JIT") === "JIT RM",
    "normalizePrRmScopeLabel jit -> JIT RM",
  );
  assert(
    normalizePrRmScopeLabel("all") === "All RM",
    "normalizePrRmScopeLabel all -> All RM",
  );
  assert(
    normalizePrRmScopeLabel("other") === "",
    "normalizePrRmScopeLabel unknown -> empty",
  );

  assert(
    prScopeText({
      material_class_code: "PM",
      material_class_label: "Packing Material",
    }) === "Packing Material",
    "PM canonical row -> Packing Material",
  );

  assert(
    prScopeText({
      material_class_code: "PLM",
      material_class_label: "Packing Material",
    }) === "Packing Material",
    "legacy PLM code via canonical helper -> Packing Material",
  );

  assert(
    prScopeText({ material_class_code: "RM", rm_scope: "normal" }) ===
      "Normal RM",
    "RM raw normal -> Normal RM",
  );
  assert(
    prScopeText({ material_class_code: "RM", rm_scope: "jit" }) === "JIT RM",
    "RM raw jit -> JIT RM",
  );
  assert(
    prScopeText({
      material_class_code: "RM",
      generation_filters: { rm_scope: "all" },
    }) === "All RM",
    "RM raw all via generation_filters -> All RM",
  );
  assert(
    prScopeText({
      material_class_code: "RM",
      rm_scope: "normal",
      rm_scope_label: "Normal RM",
    }) === "Normal RM",
    "RM rm_scope_label preferred",
  );

  assert(
    prScopeText({
      material_class_code: "IND",
      material_class_label: "Indirect Materials & Utilities",
    }) === "Indirect Materials & Utilities",
    "future non-RM class with label",
  );
  assert(
    prScopeText({ material_class_code: "IND" }) === "IND",
    "known class without label -> code",
  );
  assert(
    prScopeText({ material_class_code: "RM" }) === "Raw Material",
    "RM with no scope -> Raw Material",
  );
  assert(prScopeText({}) === "—", "unclassified row -> em dash");
  assert(prScopeText(null) === "—", "null row -> em dash");

  assert(
    !/rm_scope\s*[:=]\s*["'](?:normal|jit|all)["']/.test(
      JSON.stringify(
        (() => {
          const out = {};
          prScopeText({
            material_class_code: "PM",
            material_class_label: "Packing Material",
          });
          return out;
        })(),
      ),
    ),
    "helper does not invent PM rm_scope side effects",
  );

  // Prefer label over composite display for PM Scope
  assert(
    prScopeText({
      material_class_code: "PM",
      material_class_label: "Packing Material",
      material_class_display: "PM - Packing Material",
    }) === "Packing Material",
    "PM prefers material_class_label over display composite",
  );

  // No PLM-specific branch inside prScopeText
  const prScopeFn = extractFunction(src, "prScopeText");
  assert(
    !/===\s*["']PLM["']/.test(prScopeFn),
    "prScopeText has no PLM-specific branch",
  );
  assert(
    /canonicalMaterialClassCode\(/.test(prScopeFn),
    "prScopeText uses canonicalMaterialClassCode",
  );
}

// Generate PR: rm_scope only when materialClassId === 1
const genDraft = extractFunction(src, "generateDraftPr");
assert(Boolean(genDraft), "generateDraftPr is defined");
assert(
  /if\s*\(\s*materialClassId\s*===\s*1\s*\)\s*\{[\s\S]*?genFilters\.rm_scope\s*=/.test(
    genDraft,
  ),
  "generateDraftPr sets genFilters.rm_scope only inside materialClassId === 1",
);
assert(
  !/materialClassId\s*===\s*2[\s\S]{0,120}genFilters\.rm_scope/.test(genDraft),
  "generateDraftPr does not set rm_scope for PM class id path",
);

// VWL RM Scope contracts retained
assert(/vwlRmScopeFilter/.test(src), "VWL vwlRmScopeFilter retained");
assert(/p_rm_scope/.test(src), "VWL p_rm_scope retained");
assert(/"RM Scope"/.test(src), "VWL RM Scope export label retained");
assert(
  /All RM Scope/.test(src),
  "VWL All RM Scope option retained",
);
assert(
  /proc_pec_buylist_rm_scope_options/.test(src),
  "VWL buylist rm_scope options RPC retained",
);

// PR Workbench surfaces still use prScopeText (no duplicated Scope paint)
assert(
  /\$\{esc\(prScopeText\(row\)\)\}/.test(src),
  "PR header table uses prScopeText",
);
assert(
  /Scope: \$\{prScopeText\(pr\)\}/.test(src),
  "Create Indent from PR picker uses prScopeText",
);
assert(
  /Scope: \$\{prScopeText\(row\)\}/.test(src),
  "PR detail meta uses prScopeText",
);
assert(
  /const scopeText = prScopeText\(pr\)/.test(src),
  "PR export builder uses prScopeText",
);
assert(/Scope: scopeText/.test(src), "PR CSV maps Scope from scopeText");
assert(
  /Scope: \$\{scopeText\}/.test(src),
  "PR PDF header uses scopeText",
);

if (fails.length) {
  console.error("pec-pr-scope-smoke FAILED:");
  for (const f of fails) console.error(" -", f);
  process.exit(1);
}
console.log("pec-pr-scope-smoke OK");
