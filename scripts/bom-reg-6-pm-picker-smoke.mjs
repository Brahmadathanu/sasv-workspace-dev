/**
 * BOM-REG-6 — PM Templates searchable-select picker static smoke.
 * No network, no rebuild RPC execution, no database changes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "js/manage-pm-bom.js"), "utf8");
const html = readFileSync(join(root, "manage-pm-bom.html"), "utf8");
const fails = [];
const assert = (cond, msg) => {
  if (!cond) fails.push(msg);
};

const populateFn =
  src.match(
    /function populateOvrPreviewSkuPickers\([\s\S]*?\n\}/
  )?.[0] || "";
const ensureFn =
  src.match(/function ensurePmSearchableSelect\([\s\S]*?\n\}/)?.[0] || "";
const activateRebuild =
  src.match(/async function activateRebuildTab\(\) \{[\s\S]*?\n\}/)?.[0] || "";
const rebuildFill =
  src.match(
    /Populate rebuild tab template picker[\s\S]*?ensurePmSearchableSelect\([\s\S]*?PM_TPL_SEARCH_OPTS[\s\S]*?\);/
  )?.[0] || "";

assert(ensureFn.includes("selectEl._sasvSearch"), "uses _sasvSearch guard");
assert(ensureFn.includes("syncSearchableSelect(selectEl)"), "syncs if enhanced");
assert(
  ensureFn.includes("enhanceSearchableSelect(selectEl, opts)"),
  "enhances if not yet wrapped"
);
assert(
  populateFn.includes('el("ovr_skuPicker")'),
  "Overrides picker populated"
);
assert(
  populateFn.includes('el("ovr_previewSkuPicker")'),
  "Preview picker populated"
);
assert(
  populateFn.includes("ensurePmSearchableSelect"),
  "SKU pickers enhanced/synced after options"
);
assert(
  populateFn.includes("PM_SKU_SEARCH_OPTS"),
  "SKU placeholder/options used"
);
assert(
  /placeholder:\s*"Search or select a SKU…"/.test(src),
  "SKU placeholder"
);
assert(
  /placeholder:\s*"Search or select a template…"/.test(src),
  "template placeholder"
);
assert(/showAllWhenEmpty:\s*true/.test(src), "showAllWhenEmpty enabled");
assert(/allowEmptyOption:\s*true/.test(src), "allowEmptyOption enabled");
assert(
  rebuildFill.includes("rebuildTplPicker") &&
    rebuildFill.includes("ensurePmSearchableSelect"),
  "Rebuild picker enhanced after TEMPLATES fill"
);
assert(
  rebuildFill.includes('rebuildTplPicker.value = ""'),
  "Rebuild does not auto-select a template"
);
assert(
  activateRebuild.includes("ensurePmSearchableSelect"),
  "Rebuild tab open syncs picker"
);
assert(
  !activateRebuild.includes("rpc_plm_rebuild"),
  "Rebuild tab open does not call rebuild RPCs"
);
assert(
  /fillSkuSelect[\s\S]*selectEl\.value = ""/.test(src),
  "SKU fill does not auto-select a catalogue row"
);
assert(!/OVR_PERM_CAN_EDIT/.test(src), "no hardcoded override edit flag");
assert(
  !/module:plm-templates|plm-sku-map/.test(src),
  "no stale module keys in JS"
);
assert(!/plm-templates|plm-sku-map/.test(html), "no stale module keys in HTML");
assert(
  /const MODULE_ID = "pm-templates"/.test(src),
  "canonical MODULE_ID pm-templates"
);
assert(
  /Failed to initialize SKU selector\./.test(src),
  "SKU enhance failure status"
);
assert(
  /Failed to initialize template selector\./.test(src),
  "template enhance failure status"
);

if (fails.length) {
  console.error("BOM-REG-6 static smoke FAILED:");
  fails.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log("BOM-REG-6 static smoke passed");
