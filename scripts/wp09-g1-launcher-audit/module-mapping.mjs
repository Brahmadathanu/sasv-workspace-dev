// WP09 G1 — existing-module → proposed grouping mapping (DESIGN DATA ONLY; nothing here is applied anywhere).
// One row per launcher-candidate SOURCE page. `key` is the registry module_key where the repository proves it
// (keyBasis "source-token"), otherwise it is inferred from the file name and MUST be confirmed against the live export
// (keyBasis "inferred"). Live section/sort_order per module is NOT OBSERVED by this session; see registry-verify.mjs.
//
// optA  = Option A: keep the 11 existing section keys; add a presentation-only subgroup heading (client-only).
// optB  = Option B: ERP lifecycle re-sectioning (changes DB section assignment + new section keys + client icon/colour maps).
// optC  = Option C: collapsed "family" launcher card layered on A (client-only); null = stays a flat top-level tile.
// aliases = registry key aliases normalised by module-registry.js (kept so grants keep resolving).
//
// Existing 11 section keys (G0): work-log, planning-workspace, mrp-procurement, inventory-sales, product-reference-master,
// qa-qc, plant-assets, bmr-production-records, sops, system, admin. (Exact keys of the last two are taken from the
// SECTION_KEY_FAMILY/SECTION_KEY_ICONS maps in index.html / ui-icons.js.)

const A = (section, sub) => ({ section, sub });

export const MAPPING = [
  // ---- Work Log
  { page: "add-log-entry.html", key: "add-log-entry", keyBasis: "source-token", optA: A("work-log", "Daily log"), optB: A("work-log-operations", "Daily log"), optC: "Daily work log", dup: "workflow trio (add/update/view)" },
  { page: "update-log-status.html", key: "update-log-status", keyBasis: "source-token", optA: A("work-log", "Daily log"), optB: A("work-log-operations", "Daily log"), optC: "Daily work log", dup: "workflow trio" },
  { page: "public/shared/view-logs.html", key: "view-logs", keyBasis: "source-token", aliases: ["view-log"], optA: A("work-log", "Daily log"), optB: A("work-log-operations", "Daily log"), optC: "Daily work log", dup: "workflow trio" },
  { page: "public/shared/wip-stock.html", key: "wip-stock", keyBasis: "inferred", optA: A("inventory-sales", "Stock positions"), optB: A("inventory-sales", "Stock positions"), optC: "Stock positions", dup: "specialised read view (derived from daily_work_log)" },

  // ---- Planning / MRP / Procurement / Execution
  { page: "public/shared/forecast-console.html", key: "forecast-console", keyBasis: "source-token", optA: A("planning-workspace", "Forecast & plan"), optB: A("planning-procurement", "Plan"), optC: null, dup: "none" },
  { page: "production-planning-workbench.html", key: "production-planning-workbench", keyBasis: "inferred", optA: A("planning-workspace", "Forecast & plan"), optB: A("planning-procurement", "Plan"), optC: null, dup: "none (Electron root only)" },
  { page: "supply-batch-plan.html", key: "supply-batch-plan", keyBasis: "source-token", optA: A("planning-workspace", "Batch plan & overrides"), optB: A("planning-procurement", "Plan"), optC: "Batch plan & overrides", dup: "none (note: source token also referenced by costing destination map)" },
  { page: "supply-overrides.html", key: "supply-overrides", keyBasis: "inferred", optA: A("planning-workspace", "Batch plan & overrides"), optB: A("planning-procurement", "Plan"), optC: "Batch plan & overrides", dup: "CANDIDATE: duplicate of production-overrides.html (title)" },
  { page: "production-overrides.html", key: "production-overrides", keyBasis: "inferred", optA: A("planning-workspace", "Batch plan & overrides"), optB: A("planning-procurement", "Plan"), optC: "Batch plan & overrides", dup: "DEFECTIVE: loads missing js/production-overrides.js; title 'Supply Overrides'; verify registry registration before any action" },
  { page: "public/shared/fill-planner.html", key: "fill-planner", keyBasis: "inferred", optA: A("planning-workspace", "Forecast & plan"), optB: A("planning-procurement", "Plan"), optC: null, dup: "none" },
  { page: "public/shared/rm-seasonal-overlay.html", key: "rm-seasonal-overlay", keyBasis: "inferred", optA: A("mrp-procurement", "Requirements & seasonality"), optB: A("planning-procurement", "Requirements"), optC: "Requirements & seasonality", dup: "related to season_profile masters (read/overlay), not duplicate" },
  { page: "public/shared/mrp-material-board.html", key: "mrp-material-board", keyBasis: "inferred", optA: A("mrp-procurement", "Requirements & seasonality"), optB: A("planning-procurement", "Requirements"), optC: "Requirements & seasonality", dup: "workflow stage" },
  { page: "procurement-planning-workbench.html", key: "procurement-planning-workbench", keyBasis: "inferred", optA: A("mrp-procurement", "Requirements & seasonality"), optB: A("planning-procurement", "Requirements"), optC: "Requirements & seasonality", dup: "workflow stage (read-only; Electron root only)" },
  { page: "public/shared/rm-rebuild-dashboard.html", key: "rm-rebuild-dashboard", keyBasis: "inferred", optA: A("mrp-procurement", "Rebuild & issue (RM / PM)"), optB: A("planning-procurement", "Requirements"), optC: "Rebuild & issue (RM / PM)", dup: "LEGITIMATE specialised pair with pm-rebuild-dashboard (separate RPCs/data)" },
  { page: "public/shared/pm-rebuild-dashboard.html", key: "pm-rebuild-dashboard", keyBasis: "inferred", optA: A("mrp-procurement", "Rebuild & issue (RM / PM)"), optB: A("planning-procurement", "Requirements"), optC: "Rebuild & issue (RM / PM)", dup: "LEGITIMATE specialised pair" },
  { page: "public/shared/rm-issue-allocation.html", key: "rm-issue-allocation", keyBasis: "inferred", optA: A("mrp-procurement", "Rebuild & issue (RM / PM)"), optB: A("planning-procurement", "Execution"), optC: "Rebuild & issue (RM / PM)", dup: "LEGITIMATE specialised pair (mrp_rm_issue_lines_save vs mrp_pm_issue_lines_save)" },
  { page: "public/shared/pm-issue-allocation.html", key: "pm-issue-allocation", keyBasis: "inferred", optA: A("mrp-procurement", "Rebuild & issue (RM / PM)"), optB: A("planning-procurement", "Execution"), optC: "Rebuild & issue (RM / PM)", dup: "LEGITIMATE specialised pair" },
  { page: "public/shared/execution-gate.html", key: "execution-gate", keyBasis: "inferred", optA: A("mrp-procurement", "Execution"), optB: A("planning-procurement", "Execution"), optC: null, dup: "workflow stage" },
  { page: "public/shared/production-execution-queue.html", key: "production-execution-queue", keyBasis: "source-token", optA: A("mrp-procurement", "Execution"), optB: A("planning-procurement", "Execution"), optC: null, dup: "workflow stage" },
  { page: "public/shared/procurement-execution-console.html", key: "procurement-execution-console", keyBasis: "source-token", optA: A("mrp-procurement", "Execution"), optB: A("planning-procurement", "Execution"), optC: null, dup: "workflow stage" },
  { page: "public/shared/vendor-master.html", key: "vendor-master", keyBasis: "source-token", optA: A("mrp-procurement", "Suppliers & MRP masters"), optB: A("master-data", "Procurement masters"), optC: "Suppliers & MRP masters", dup: "none" },
  { page: "public/shared/mrp-master-data-console.html", key: "mrp-master-data-console", keyBasis: "inferred", optA: A("mrp-procurement", "Suppliers & MRP masters"), optB: A("master-data", "Procurement masters"), optC: "Suppliers & MRP masters", dup: "OVERLAP: season_profile create/edit/delete also in manage-season-profiles.html" },

  // ---- Inventory & Sales
  { page: "public/shared/bottled-stock.html", key: "bottled-stock", keyBasis: "inferred", optA: A("inventory-sales", "Stock positions"), optB: A("inventory-sales", "Stock positions"), optC: "Stock positions", dup: "specialised read view (bottled_stock_on_hand)" },
  { page: "public/shared/fg-bulk-stock.html", key: "fg-bulk-stock", keyBasis: "inferred", optA: A("inventory-sales", "Stock positions"), optB: A("inventory-sales", "Stock positions"), optC: "Stock positions", dup: "specialised read view (fg_bulk_stock)" },
  { page: "public/shared/stock-checker.html", key: "stock-checker", keyBasis: "inferred", optA: A("inventory-sales", "Stock positions"), optB: A("inventory-sales", "Stock positions"), optC: "Stock positions", dup: "distinct from stock-purchase-explorer (SKU snapshot vs item stock/purchase)" },
  { page: "public/shared/stock-purchase-explorer.html", key: "stock-purchase-explorer", keyBasis: "inferred", optA: A("inventory-sales", "Stock positions"), optB: A("inventory-sales", "Stock positions"), optC: "Stock positions", dup: "distinct" },
  { page: "public/shared/fg-bulk-internal-transfer.html", key: "fg-bulk-internal-transfer", keyBasis: "inferred", optA: A("inventory-sales", "Transfers"), optB: A("inventory-sales", "Transfers"), optC: "Transfers", dup: "canonical page; root fg-bulk-internal-transfer.html is a redirect stub (legitimate legacy entry)" },
  { page: "public/shared/fg-transfer-reconciliation.html", key: "fg-transfer-reconciliation", keyBasis: "source-token", optA: A("inventory-sales", "Transfers"), optB: A("inventory-sales", "Transfers"), optC: "Transfers", dup: "distinct (reconciliation vs entry)" },
  { page: "public/shared/sales-viewer.html", key: "sales-data-viewer", keyBasis: "source-token", aliases: ["sales-viewer"], optA: A("inventory-sales", "Sales & analytics"), optB: A("analytics-mis", "Sales"), optC: null, dup: "none" },
  { page: "public/shared/executive-mis-dashboard.html", key: "executive-mis-dashboard", keyBasis: "source-token", optA: A("inventory-sales", "Sales & analytics"), optB: A("analytics-mis", "Executive"), optC: null, dup: "none" },

  // ---- Product & Costing
  { page: "public/shared/manage-products.html", key: "manage-products", keyBasis: "source-token", optA: A("product-reference-master", "Product & BOM"), optB: A("product-costing", "Product & BOM"), optC: "Product & BOM", dup: "canonical (WP08); Electron legacy registration routes to root stub" },
  { page: "public/shared/manage-rm-bom.html", key: "manage-rm-bom", keyBasis: "source-token", optA: A("product-reference-master", "Product & BOM"), optB: A("product-costing", "Product & BOM"), optC: "Product & BOM", dup: "legit BOM family (RM/PM/SP separate)" },
  { page: "public/shared/manage-pm-bom.html", key: "pm-templates", keyBasis: "source-token", optA: A("product-reference-master", "Product & BOM"), optB: A("product-costing", "Product & BOM"), optC: "Product & BOM", dup: "legit BOM family; label/key/page-name mismatch (pm-templates / manage-pm-bom)" },
  { page: "public/shared/manage-sp-bom.html", key: "manage-sp-bom", keyBasis: "source-token", optA: A("product-reference-master", "Product & BOM"), optB: A("product-costing", "Product & BOM"), optC: "Product & BOM", dup: "legit BOM family" },
  { page: "public/shared/production-route-manager.html", key: "production-route-manager", keyBasis: "source-token", optA: A("product-reference-master", "Product & BOM"), optB: A("product-costing", "Product & BOM"), optC: "Product & BOM", dup: "seeded in migration: section product-reference-master, sort 95 (tie with pricing-policy-manager per G0)" },
  { page: "public/shared/pricing-policy-manager.html", key: "pricing-policy-manager", keyBasis: "source-token", optA: A("product-reference-master", "Costing suite"), optB: A("product-costing", "Costing suite"), optC: "Costing suite", dup: "legit multi-entry to one shared Costing suite" },
  { page: "public/shared/costing-control-center.html", key: "costing-control-center", keyBasis: "source-token", optA: A("product-reference-master", "Costing suite"), optB: A("product-costing", "Costing suite"), optC: "Costing suite", dup: "legit suite entry" },
  { page: "public/shared/material-cost-manager.html", key: "material-cost-manager", keyBasis: "source-token", optA: A("product-reference-master", "Costing suite"), optB: A("product-costing", "Costing suite"), optC: "Costing suite", dup: "legit suite entry" },
  { page: "public/shared/cost-build-manager.html", key: "cost-build-manager", keyBasis: "source-token", optA: A("product-reference-master", "Costing suite"), optB: A("product-costing", "Costing suite"), optC: "Costing suite", dup: "legit suite entry" },
  { page: "public/shared/cost-sheet-review.html", key: "cost-sheet-review", keyBasis: "source-token", optA: A("product-reference-master", "Costing suite"), optB: A("product-costing", "Costing suite"), optC: "Costing suite", dup: "legit suite entry" },

  // ---- Product / reference / inventory masters (root Electron-only)
  { page: "manage-product-groups.html", key: "manage-product-groups", keyBasis: "inferred", optA: A("product-reference-master", "Product classification"), optB: A("master-data", "Product classification"), optC: "Product classification", dup: "parent-child master family" },
  { page: "manage-subgroups.html", key: "manage-subgroups", keyBasis: "inferred", optA: A("product-reference-master", "Product classification"), optB: A("master-data", "Product classification"), optC: "Product classification", dup: "parent-child master family" },
  { page: "manage-categories.html", key: "manage-categories", keyBasis: "inferred", optA: A("product-reference-master", "Product classification"), optB: A("master-data", "Product classification"), optC: "Product classification", dup: "parent-child master family" },
  { page: "manage-subcategories.html", key: "manage-subcategories", keyBasis: "inferred", optA: A("product-reference-master", "Product classification"), optB: A("master-data", "Product classification"), optC: "Product classification", dup: "parent-child master family" },
  { page: "manage-season-profiles.html", key: "manage-season-profiles", keyBasis: "inferred", optA: A("product-reference-master", "Seasonality"), optB: A("master-data", "Procurement masters"), optC: "Suppliers & MRP masters", dup: "OVERLAP with mrp-master-data-console season tab" },
  { page: "manage-stock-items.html", key: "manage-stock-items", keyBasis: "inferred", optA: A("product-reference-master", "Inventory masters"), optB: A("master-data", "Inventory masters"), optC: "Inventory masters", dup: "RELATED: also writes inv_stock_item_class_map (single-item) vs manage-category-map (bulk)" },
  { page: "manage-category-map.html", key: "manage-category-map", keyBasis: "inferred", optA: A("product-reference-master", "Inventory masters"), optB: A("master-data", "Inventory masters"), optC: "Inventory masters", dup: "RELATED: bulk class map (fn_bulk_upsert_item_class_map)" },
  { page: "manage-tally-inv-mapping.html", key: "manage-tally-inv-mapping", keyBasis: "inferred", optA: A("product-reference-master", "Inventory masters"), optB: A("master-data", "Inventory masters"), optC: "Inventory masters", dup: "distinct (Tally alias mapping)" },
  { page: "manage-uom.html", key: "manage-uom", keyBasis: "inferred", optA: A("product-reference-master", "Inventory masters"), optB: A("master-data", "Inventory masters"), optC: "Inventory masters", dup: "distinct" },
  { page: "manage-publications.html", key: "manage-publications", keyBasis: "inferred", optA: A("product-reference-master", "Reference library"), optB: A("master-data", "Reference library"), optC: "Reference library", dup: "parent-child master family" },
  { page: "manage-chapters.html", key: "manage-chapters", keyBasis: "inferred", optA: A("product-reference-master", "Reference library"), optB: A("master-data", "Reference library"), optC: "Reference library", dup: "parent-child master family" },
  { page: "manage-references.html", key: "manage-references", keyBasis: "inferred", optA: A("product-reference-master", "Reference library"), optB: A("master-data", "Reference library"), optC: "Reference library", dup: "parent-child master family" },

  // ---- Plant & production records
  { page: "manage-sections.html", key: "manage-sections", keyBasis: "inferred", optA: A("plant-assets", "Plant locations"), optB: A("plant-production", "Plant locations & equipment"), optC: "Plant locations & equipment", dup: "parent-child; NAME COLLISION with launcher 'section'" },
  { page: "manage-subsections.html", key: "manage-subsections", keyBasis: "inferred", optA: A("plant-assets", "Plant locations"), optB: A("plant-production", "Plant locations & equipment"), optC: "Plant locations & equipment", dup: "parent-child; NAME COLLISION" },
  { page: "manage-areas.html", key: "manage-areas", keyBasis: "inferred", optA: A("plant-assets", "Plant locations"), optB: A("plant-production", "Plant locations & equipment"), optC: "Plant locations & equipment", dup: "parent-child master family" },
  { page: "manage-machine-types.html", key: "manage-machine-types", keyBasis: "inferred", optA: A("plant-assets", "Plant locations"), optB: A("plant-production", "Plant locations & equipment"), optC: "Plant locations & equipment", dup: "parent-child master family" },
  { page: "manage-plants.html", key: "manage-plants", keyBasis: "inferred", optA: A("plant-assets", "Plant locations"), optB: A("plant-production", "Plant locations & equipment"), optC: "Plant locations & equipment", dup: "parent-child master family" },
  { page: "public/shared/plant-occupancy.html", key: "plant-occupancy", keyBasis: "inferred", optA: A("plant-assets", "Occupancy"), optB: A("plant-production", "Plant operations"), optC: null, dup: "none (sort tie with vendor-master at MRP 110 per G0)" },
  { page: "manage-activities.html", key: "manage-activities", keyBasis: "source-token", optA: A("plant-assets", "Plant locations"), optB: A("plant-production", "Plant locations & equipment"), optC: "Plant locations & equipment", dup: "master for work-log activities (cross-section link to Work Log)" },
  { page: "public/shared/manage-bmr.html", key: "manage-bmr", keyBasis: "source-token", optA: A("bmr-production-records", "BMR"), optB: A("plant-production", "Batch records"), optC: null, dup: "none" },
  { page: "public/shared/bmr-card-not-initiated.html", key: "bmr-card-not-initiated", keyBasis: "inferred", optA: A("bmr-production-records", "BMR"), optB: A("plant-production", "Batch records"), optC: null, dup: "related to manage-bmr (exception list)" },

  // ---- QA/QC + SOPs
  { page: "public/shared/lab-analysis-entry.html", key: "lab-analysis-entry", keyBasis: "inferred", optA: A("qa-qc", "Analysis workflow"), optB: A("quality", "Analysis workflow"), optC: "Analysis workflow", dup: "workflow stage; overlap with analysis-workspace NOT DETERMINED" },
  { page: "public/shared/lab-analysis-queue.html", key: "lab-analysis-queue", keyBasis: "source-token", optA: A("qa-qc", "Analysis workflow"), optB: A("quality", "Analysis workflow"), optC: "Analysis workflow", dup: "workflow stage" },
  { page: "public/shared/analysis-workspace.html", key: "analysis-workspace", keyBasis: "source-token", optA: A("qa-qc", "Analysis workflow"), optB: A("quality", "Analysis workflow"), optC: "Analysis workflow", dup: "OVERLAP NOT DETERMINED vs lab-analysis-entry/queue (needs workflow-owner input)" },
  { page: "public/shared/coa-register.html", key: "coa-register", keyBasis: "inferred", optA: A("qa-qc", "Certificates & samples"), optB: A("quality", "Certificates & samples"), optC: "Certificates & samples", dup: "distinct (coa-print is a child/print page, not a launcher)" },
  { page: "public/shared/control-sample-register.html", key: "control-sample-register", keyBasis: "inferred", optA: A("qa-qc", "Certificates & samples"), optB: A("quality", "Certificates & samples"), optC: "Certificates & samples", dup: "distinct" },
  { page: "public/shared/lab-protocol-manager.html", key: "lab-protocol-manager", keyBasis: "inferred", optA: A("qa-qc", "Lab masters"), optB: A("quality", "Lab masters"), optC: "Lab masters", dup: "related masters sharing protocol_category" },
  { page: "public/shared/lab-spec-profile-manager.html", key: "lab-spec-profile-manager", keyBasis: "source-token", optA: A("qa-qc", "Lab masters"), optB: A("quality", "Lab masters"), optC: "Lab masters", dup: "related masters sharing protocol_category; carries a v_module_badges badge (see index.html)" },
  { page: "public/shared/test-method-master.html", key: "lab-test-method-master", keyBasis: "source-token", optA: A("qa-qc", "Lab masters"), optB: A("quality", "Lab masters"), optC: "Lab masters", dup: "related masters; label/key/page-name mismatch" },
  { page: "public/shared/product-shelf-life-manager.html", key: "product-shelf-life-manager", keyBasis: "source-token", optA: A("qa-qc", "Lab masters"), optB: A("quality", "Lab masters"), optC: "Lab masters", dup: "also injected client-side if registry row missing (index.html:834)" },
  { page: "sop-dashboard.html", key: "sop-dashboard", keyBasis: "inferred", optA: A("sops", "SOPs"), optB: A("quality", "SOPs"), optC: null, dup: "sop-editor/sop-viewer are child pages reached from the dashboard, not launchers" },

  // ---- System & Administration
  { page: "public/shared/operations-monitor.html", key: "operations-monitor", keyBasis: "inferred", aliases: ["etl-monitor", "etl_monitor"], optA: A("system", "Integrations"), optB: A("system-admin", "Integrations"), optC: "Integrations", dup: "LEGITIMATE pair with operations-control (read vs control)" },
  { page: "public/shared/operations-control.html", key: "operations-control", keyBasis: "inferred", aliases: ["etl-control", "etl_control"], optA: A("system", "Integrations"), optB: A("system-admin", "Integrations"), optC: "Integrations", dup: "LEGITIMATE pair" },
  { page: "public/shared/e-aushadhi-review-control.html", key: "e-aushadhi-automation", keyBasis: "source-token", optA: A("system", "Integrations"), optB: A("system-admin", "Integrations"), optC: "Integrations", dup: "out of WP09 scope (e-Aushadhi excluded); placement only" },
  { page: "public/shared/staff-directory-manager.html", key: "staff-directory-manager", keyBasis: "source-token", optA: A("admin", "Access & people"), optB: A("system-admin", "Access & people"), optC: "Access & people", dup: "also injected client-side if registry row missing (index.html:864)" },
  { page: "public/shared/lab-workflow-access-control.html", key: "lab-workflow-access-control", keyBasis: "source-token", optA: A("admin", "Access & people"), optB: A("system-admin", "Access & people"), optC: "Access & people", dup: "admin-style module housed in QA domain by name; grants-only, no permission change proposed" },
  { page: "public/utilities-hub/admin.html", key: "admin-console", keyBasis: "source-token", aliases: ["hub-admin", "hub_admin"], optA: A("admin", "Access & people"), optB: A("system-admin", "Access & people"), optC: "Access & people", dup: "PWA admin entry" },
];

// Source pages that are intentionally NOT launcher tiles (reasoned classification).
export const NON_LAUNCHER = {
  "index.html": "Electron launcher shell",
  "login.html": "auth", "reset-password.html": "auth",
  "public/utilities-hub/index.html": "PWA launcher shell",
  "public/utilities-hub/auth/callback.html": "auth", "public/utilities-hub/auth/reset.html": "auth",
  "edit-log-entry.html": "child page of Work Log (edit from view/update)",
  "sop-editor.html": "child page of SOP Dashboard", "sop-viewer.html": "child page of SOP Dashboard",
  "public/shared/coa-print.html": "print child page of COA Register",
  "manage-products.html": "legacy redirect stub (WP08)", "manage-rm-bom.html": "legacy redirect stub (WP08)",
  "manage-pm-bom.html": "legacy redirect stub (WP08)", "manage-sp-bom.html": "legacy redirect stub (WP08)",
  "fg-bulk-internal-transfer.html": "legacy redirect stub",
};

export const OPTION_B_SECTIONS = [
  ["work-log-operations", "Work Log & Daily Operations"], ["planning-procurement", "Planning & Procurement"],
  ["inventory-sales", "Inventory & Sales"], ["product-costing", "Product & Costing"], ["master-data", "Master Data"],
  ["plant-production", "Plant & Production"], ["quality", "Quality (QA/QC & SOPs)"], ["analytics-mis", "Analytics & MIS"], ["system-admin", "System & Administration"],
];
export const EXISTING_SECTIONS = ["work-log", "planning-workspace", "mrp-procurement", "inventory-sales", "product-reference-master", "qa-qc", "plant-assets", "bmr-production-records", "sops", "system", "admin"];
