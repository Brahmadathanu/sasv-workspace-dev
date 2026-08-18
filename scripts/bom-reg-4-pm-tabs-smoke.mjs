/**
 * BOM-REG-4 — PM Templates Overrides/Preview/Rebuild client static smoke.
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

assert(!/initOverrides\s*\(/.test(src), "initOverrides must not be called");
assert(
  !/\(async function initOverrides/.test(src),
  "pre-auth initOverrides IIFE must be gone"
);
assert(!/OVR_PERM_CAN_EDIT/.test(src), "OVR_PERM_CAN_EDIT must be removed");
assert(
  !/module:plm-templates|plm-sku-map|MODULE_ID = "plm-templates"/.test(src),
  "stale module keys must be absent from JS"
);
assert(
  !/plm-templates|plm-sku-map/.test(html),
  "stale module keys must be absent from HTML"
);
assert(
  /const MODULE_ID = "pm-templates"/.test(src),
  "canonical MODULE_ID pm-templates"
);
assert(
  /async function ensureSkuCatalogueLoaded/.test(src),
  "shared SKU loader present"
);
assert(
  /from\("v_sku_catalog_enriched"\)/.test(src),
  "SKU catalogue contract"
);
assert(/function activateOverridesTab/.test(src), "activateOverridesTab present");
assert(/function activateRebuildTab/.test(src), "activateRebuildTab present");
assert(
  /void activateOverridesTab\(\)/.test(src),
  "Overrides tab calls activateOverridesTab"
);
assert(/void initPreviewTab\(\)/.test(src), "Preview tab calls initPreviewTab");
assert(
  /void activateRebuildTab\(\)/.test(src),
  "Rebuild tab calls activateRebuildTab"
);
assert(
  /You do not have permission to view Overrides/.test(src),
  "Overrides view gate"
);
assert(
  /You do not have permission to view Preview/.test(src),
  "Preview view gate"
);
assert(
  /You do not have permission to view Rebuild/.test(src),
  "Rebuild view gate"
);
assert(
  /if \(!PERM_CAN_EDIT\) return setStatus\("No permission to rebuild."/.test(
    src
  ),
  "rebuild write gates"
);
assert(
  /dryRunBtn\?\.addEventListener\("click", async \(\) => \{\s*if \(!PERM_CAN_EDIT\)/.test(
    src
  ),
  "dry-run gated by can_edit"
);
assert(
  /function applyRebuildPermissions/.test(src),
  "rebuild control disable helper"
);
assert(
  /function loadMappedSkusForRebuild/.test(src),
  "mapped SKU read path extracted"
);
assert(
  /Failed to load SKU catalogue:/.test(src),
  "SKU catalogue persistent error"
);
assert(/Failed to load overrides:/.test(src), "overrides persistent error");
assert(/Failed to load preview:/.test(src), "preview persistent error");
assert(
  /Failed to load override summary:/.test(src),
  "pills persistent error"
);
assert(/Failed to load mapped SKUs:/.test(src), "mapped SKUs persistent error");
assert(/rpc_plm_ovr_list/.test(src), "override list RPC unchanged");
assert(/rpc_plm_ovr_upsert/.test(src), "override upsert RPC unchanged");
assert(/rpc_plm_ovr_delete/.test(src), "override delete RPC unchanged");
assert(/rpc_plm_preview_effective/.test(src), "preview RPC unchanged");
assert(/rpc_plm_override_counts/.test(src), "counts RPC unchanged");
assert(
  /PREVIEW_UI_BOUND/.test(src) && !/PREVIEW_INIT_DONE/.test(src),
  "preview listeners bound once independently of data"
);
assert(
  /skuPicker\?\.addEventListener\("change"/.test(src),
  "SKU change listener attached outside data load"
);
assert(
  /previewSkuPicker\?\.addEventListener\("change"/.test(src),
  "Preview change listener attached outside data load"
);
assert(/ovrCtl\.setEditMode = setOvrViewMode/.test(src), "ovrCtl wired");
assert(
  /if \(!PERM_CAN_EDIT\) return setStatus\("No permission to edit."/.test(src),
  "override writes require can_edit"
);
assert(
  /bootstrapApp\(\{ loginPage: "login.html" \}\)/.test(src),
  "bootstrapApp still used"
);

const activateRebuild =
  src.match(/async function activateRebuildTab\(\) \{[\s\S]*?\n\}/)?.[0] || "";
assert(
  activateRebuild.includes("loadMappedSkusForRebuild"),
  "rebuild tab loads mapped SKUs when selected"
);
assert(
  !activateRebuild.includes("rpc_plm_rebuild"),
  "rebuild tab open does not call rebuild RPCs"
);

const ensureFn =
  src.match(/async function ensureSkuCatalogueLoaded\(\) \{[\s\S]*?\n\}/)?.[0] ||
  "";
assert(
  ensureFn.includes("if (!PERM_CAN_VIEW) return SKU_CATALOGUE"),
  "SKU loader refuses pre-permission fetch"
);
assert(ensureFn.includes("SKU_CATALOGUE_LOADED"), "SKU loader is idempotent");

if (fails.length) {
  console.error("BOM-REG-4 static smoke FAILED:");
  fails.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log("BOM-REG-4 static smoke passed");
