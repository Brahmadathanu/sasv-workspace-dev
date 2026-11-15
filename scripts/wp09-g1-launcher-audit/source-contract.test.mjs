// WP09 G1 source/route/permission contract tests (offline, read-only). Run: node scripts/wp09-g1-launcher-audit/source-contract.test.mjs
import fs from "node:fs";
import path from "node:path";
import { loadRegistryModule, read, exists, repoRoot, sortRows } from "./lib.mjs";
import { inventory } from "./source-inventory.mjs";
import { MAPPING, NON_LAUNCHER, OPTION_B_SECTIONS, EXISTING_SECTIONS } from "./module-mapping.mjs";
import { verifyRegistry } from "./registry-verify.mjs";

let fails = 0;
const check = (name, ok, detail = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const R = await loadRegistryModule();

// ---- route normalisation ----
const N = R.normalizeClientRoute;
check("R1 electron: public/shared route kept", N("public/shared/x.html", "electron") === "public/shared/x.html");
check("R2 electron: /public/ leading slash stripped", N("/public/shared/x.html", "electron") === "public/shared/x.html");
check("R3 electron: ../shared/ -> public/shared/", N("../shared/x.html", "electron") === "public/shared/x.html");
check("R4 electron: ./admin.html -> hub admin", N("./admin.html", "electron") === "public/utilities-hub/admin.html");
check("R5 electron: root legacy route untouched (Step B not authorised)", N("manage-products.html", "electron") === "manage-products.html");
check("R6 pwa: public/shared route -> /shared/ (publish root is public/)", N("public/shared/x.html", "pwa") === "/shared/x.html");
check("R7 pwa: ../shared kept relative; ./admin.html kept", N("../shared/x.html", "pwa") === "../shared/x.html" && N("./admin.html", "pwa") === "./admin.html");
check("R8 pwa: electron-root legacy route is NOT rewritten (would 404 on PWA)", N("manage-products.html", "pwa") === "manage-products.html");
check("R9 absolute http / hash passthrough", N("https://e.invalid/a", "pwa") === "https://e.invalid/a" && N("#", "electron") === "#");

// ---- keys & permission gate ----
check("K1 key aliases", ["hub_admin", "etl-monitor", "etl_control", "sales_viewer", "view_log"].map(R.normalizeModuleKey).join() === "admin-console,operations-monitor,operations-control,sales-data-viewer,view-logs");
const pm = R.buildPermissionMap([{ target: "module:a", can_view: true, can_edit: false }, { target: "role:a", can_view: false, can_edit: true }, { target: "module:b", can_view: true }, null, {}]);
check("K2 permission map ORs duplicate targets (module:/role: share a key)", pm.a.can_view && pm.a.can_edit);
const lvl = (mode, p) => R.getModuleAccessLevel({ moduleKey: "m", minNavMode: mode }, { m: p });
check("K3 can_edit => use", lvl("view", { can_view: true, can_edit: true }) === "use");
check("K4 view-only + min view => view (locked)", lvl("view", { can_view: true, can_edit: false }) === "view");
check("K5 view-only + min read => read", lvl("read", { can_view: true, can_edit: false }) === "read");
check("K6 view-only + min edit => none", lvl("edit", { can_view: true, can_edit: false }) === "none");
check("K7 no grant => none", R.getModuleAccessLevel({ moduleKey: "m", minNavMode: "view" }, {}) === "none");
check("K8 empty/unknown min_nav_mode defaults to view", lvl("", { can_view: true, can_edit: false }) === "view");

// ---- ordering: sort_order then label ----
const ordered = sortRows([{ sortOrder: 110, label: "Vendor Master" }, { sortOrder: 110, label: "Plant Occupancy" }, { sortOrder: 95, label: "Pricing Policy Manager" }, { sortOrder: 95, label: "Production Route Manager" }]).map((r) => r.label);
check("O1 G0 tie pairs resolve deterministically by label (MRP 110, Product 95)", ordered.join("|") === "Pricing Policy Manager|Production Route Manager|Plant Occupancy|Vendor Master");
const idx = read("index.html"), hub = read("public/utilities-hub/js/hub-auth.js"), reg = read("public/shared/js/module-registry.js");
check("O2 SQL view query orders sort_order then label", /order\("sort_order"[^)]*\)\s*\.order\("label"/.test(reg));
check("O3 Electron client re-sorts order then label.localeCompare", /left\.order !== right\.order\) return left\.order - right\.order;\s*return left\.label\.localeCompare/.test(idx));
check("O4 PWA sortByCuration = section, order, label", /sectionDelta[\s\S]*orderDelta[\s\S]*localeCompare/.test(hub));
check("O5 Electron groups by sectionLabel (title), not key — two sections sharing a label would merge", /sections\.has\(sectionTitle\)/.test(idx) && /sections\.get\(sectionTitle\)/.test(idx));
check("O6 FINDING Electron section order falls back to row index when catalog entry missing", /order: sectionMeta\?\.sortOrder \?\? index/.test(idx));

// ---- launcher behaviour contracts ----
check("B1 Electron fails closed when get_user_permissions fails", /display = "none"/.test(idx) && /permsErr \|\| !Array\.isArray\(perms\)/.test(idx));
check("B2 PWA fails closed (null perms => none)", /if \(!perms\) return map/.test(hub) && /map\[utility\.id\] = "none"/.test(hub));
check("B3 palette search = label substring only", /x\.label\.toLowerCase\(\)\.includes\(qLow\)/.test(idx) && !/description/.test(idx.slice(idx.indexOf("function renderCmdResults"), idx.indexOf("function setActive"))));
check("B4 palette empty query capped at 20", /slice\(0, 20\)/.test(idx));
check("B5 Quick Access personal: localStorage scoped by user id; pins<=10, recents<=8", /sasv-workspace:\$\{workspaceStorageScope\}/.test(idx) && /writeStoredModuleList\("pinned-modules", items, 10\)/.test(idx) && /"recent-modules", items, 8/.test(idx));
check("B6 Quick Access excludes locked/disabled and '#' routes", /aria-disabled"\) !== "true" && href !== "#"/.test(idx));
check("B7 PWA hub has no module search / palette / Quick Access code", !/moduleSearch|cmd-palette|pinned-modules/.test(read("public/utilities-hub/index.html") + hub));
check("B8 FINDING two Electron search surfaces (header datalist + Ctrl+K palette) with different locked-item handling", /module-list-datalist/.test(idx) && /cmdPaletteInput/.test(idx));
check("B9 local fallback modules injected client-side: product-shelf-life-manager, staff-directory-manager", /product-shelf-life-manager/.test(idx) && /staff-directory-manager/.test(idx) && /sortOrder: 9998/.test(idx));
check("B10 launcher never writes registry/permission tables (only user_presence)", !/from\("(app_modules|app_module_clients|app_nav_sections|permission_targets|user_permissions)[a-z_]*"\)\s*\.(insert|update|upsert|delete)/.test(idx + hub + reg));

// ---- icon / colour coupling to section keys ----
const icons = read("public/shared/js/ui-icons.js");
const iconKeys = [...icons.slice(icons.indexOf("SECTION_KEY_ICONS = {"), icons.indexOf("};", icons.indexOf("SECTION_KEY_ICONS = {"))).matchAll(/"?([a-z-]+)"?:\s*"/g)].map((m) => m[1]);
check("C1 11 current section keys all have an icon mapping", EXISTING_SECTIONS.every((k) => iconKeys.includes(k)), `missing=${EXISTING_SECTIONS.filter((k) => !iconKeys.includes(k))}`);
check("C2 Option B new section keys have NO icon mapping today (client change required)", OPTION_B_SECTIONS.map(([k]) => k).filter((k) => !iconKeys.includes(k)).length >= 6, OPTION_B_SECTIONS.map(([k]) => k).filter((k) => !iconKeys.includes(k)).join(","));

// ---- source page inventory / mapping completeness ----
const inv = inventory();
const byPath = Object.fromEntries(inv.map((p) => [p.path, p]));
const mapped = new Set(MAPPING.map((m) => m.page));
check("M1 mapping pages all exist in source", MAPPING.every((m) => byPath[m.page]), MAPPING.filter((m) => !byPath[m.page]).map((m) => m.page).join());
check("M2 no duplicate page or key in mapping", mapped.size === MAPPING.length && new Set(MAPPING.map((m) => m.key)).size === MAPPING.length);
const unclassified = inv.filter((p) => !mapped.has(p.path) && !(p.path in NON_LAUNCHER)).map((p) => p.path);
check("M3 every source HTML page is mapped or explicitly classed non-launcher", unclassified.length === 0, unclassified.join());
check("M4 optA sections are existing keys; optB sections are declared", MAPPING.every((m) => EXISTING_SECTIONS.includes(m.optA.section) && OPTION_B_SECTIONS.some(([k]) => k === m.optB.section) || false));
check("M5 FINDING Electron-root-only launcher pages (not reachable in PWA publish root)", true, `${MAPPING.filter((m) => !byPath[m.page].pwaReachable).length} pages`);
const redirects = inv.filter((p) => p.redirectStub || p.path === "fg-bulk-internal-transfer.html");
check("M6 redirect stubs all point at an existing public/shared page", redirects.every((p) => /public\/shared\/[a-z-]+\.html/.test(read(p.path)) && exists(/(public\/shared\/[a-z-]+\.html)/.exec(read(p.path))[1])), redirects.map((p) => p.path).join());
check("M7 WP08 shared four exist under public/shared (PWA-reachable)", ["manage-products", "manage-rm-bom", "manage-pm-bom", "manage-sp-bom"].every((n) => exists(`public/shared/${n}.html`)));

// ---- missing local assets referenced by pages (route-existence probe) ----
const missing = [];
for (const p of inv) {
  const html = read(p.path);
  for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"':#?]+\.(?:m?js|css))(?:\?[^"']*)?["']/g)) {
    const spec = m[1];
    const rel = spec.startsWith("/") ? spec.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(p.path), spec));
    if (!exists(rel) && !exists(spec.startsWith("/") ? `public${spec}` : rel)) missing.push(`${p.path} -> ${spec}`);
  }
}
check("A1 KNOWN FINDING exactly one page references missing local assets: production-overrides.html -> css/style.css and js/production-overrides.js", missing.length === 2 && missing.every((m) => m.startsWith("production-overrides.html -> ")) && missing.some((m) => /js\/production-overrides\.js/.test(m)), missing.join("; ") || "none");
const sw = read("public/sw.js");
const swMissing = [...sw.matchAll(/"(\/shared\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !exists(`public${u}`));
check("A2 KNOWN FINDING stale service-worker precache entries (renamed ETL pages)", JSON.stringify(swMissing.sort()) === JSON.stringify(["/shared/etl-monitor.html", "/shared/js/etl-control.js"]), swMissing.join());

// ---- writer guard for this audit package ----
const own = fs.readdirSync(path.dirname(new URL(import.meta.url).pathname)).filter((f) => f.endsWith(".mjs") && f !== "harness.mjs" && f !== "source-contract.test.mjs");
const bad = own.filter((f) => /supabase\.co|createClient\(|\.rpc\(|\.insert\(|\.upsert\(|fetch\(/.test(read(`scripts/wp09-g1-launcher-audit/${f}`)));
check("W1 audit scripts contain no network client / writer API calls (harness stub excluded)", bad.length === 0, bad.join());
check("W2 harness records, never forwards, writes (no real network)", !/supabase\.co/.test(read("scripts/wp09-g1-launcher-audit/harness.mjs")));

// ---- verifier self-test on a SYNTHETIC export shaped like G0 (proves the tool, NOT live data) ----
{
  const secs = Object.keys({ ...{ "work-log": 6, "planning-workspace": 4, "mrp-procurement": 12, "inventory-sales": 15, "product-reference-master": 15, "qa-qc": 9, "plant-assets": 5, "bmr-production-records": 1, sops: 3, system: 4, admin: 5 } });
  const dist = { "work-log": 6, "planning-workspace": 4, "mrp-procurement": 12, "inventory-sales": 15, "product-reference-master": 15, "qa-qc": 9, "plant-assets": 5, "bmr-production-records": 1, sops: 3, system: 4, admin: 5 };
  const pwaDist = { "work-log": 2, "mrp-procurement": 4, "inventory-sales": 11, "product-reference-master": 8, "qa-qc": 8, system: 4, admin: 4 };
  const rows = []; let n = 0;
  for (const [s, c] of Object.entries(dist)) for (let i = 0; i < c; i++) rows.push({ module_key: `syn-${s}-${i}`, label: `S${n}`, section_key: s, sort_order: 10 + n++, route_path: "", nav_enabled: true, client_key: "electron", min_nav_mode: "view" });
  const pwaKeys = []; for (const [s, c] of Object.entries(pwaDist)) for (let i = 0; i < c; i++) pwaKeys.push([s, i]);
  pwaKeys.forEach(([s, i]) => rows.push({ ...rows.find((r) => r.module_key === `syn-${s}-${i}`), client_key: "pwa" }));
  rows.forEach((r) => (r.route_path = `public/shared/manage-bmr.html`)); // exists in source; dup routes tested below
  rows.forEach((r, i) => (r.route_path = i % 2 ? "public/shared/manage-bmr.html?x=" + i : "public/shared/manage-bmr.html#" + i));
  const res = await verifyRegistry({ registry: rows, sections: secs.map((k) => ({ key: k })) });
  const get = (id) => res.find((x) => x.id.startsWith(id));
  check("V1 verifier: synthetic 79/41 shape passes counts, parity, distribution", ["L1", "L2", "L3", "L4", "L5 electron", "L5 pwa", "L9"].every((i) => get(i).status === "PASS"));
  check("V2 verifier: synthetic keys are flagged unmapped (mapping gate works)", get("L10").status === "FAIL");
  const mut = rows.map((r, i) => (i === 0 ? { ...r, nav_enabled: false } : r));
  check("V3 verifier: dropping one active Electron row is detected", (await verifyRegistry({ registry: mut, sections: secs.map((k) => ({ key: k })) })).find((x) => x.id.startsWith("L1")).status === "FAIL");
  const dup = rows.map((r, i) => (i < 2 && r.client_key === "electron" ? { ...r, route_path: "public/shared/manage-bmr.html" } : r));
  check("V4 verifier: duplicate active route is detected", (await verifyRegistry({ registry: dup, sections: secs.map((k) => ({ key: k })) })).find((x) => x.id.startsWith("L6 no duplicate active route within electron")).status === "FAIL");
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
