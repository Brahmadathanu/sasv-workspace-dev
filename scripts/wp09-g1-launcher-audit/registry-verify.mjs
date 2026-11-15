// WP09 G1 registry-export verifier (READ-ONLY, offline). Input: JSON captured by the owner/operator from the SELECT-only pack
// docs/master-data-costing/WP09_G1_LIVE_REGISTRY_SELECT_PACK.sql, shape:
//   { "registry": [ rows of public.v_app_module_registry incl. non-nav rows ], "sections": [ rows of public.app_nav_sections ],
//     "modules": [ optional rows of public.app_modules incl. inactive ] }
// Usage: node scripts/wp09-g1-launcher-audit/registry-verify.mjs export.json [outDir]
// This session could NOT run that SELECT pack (no Supabase access), so live verification is NOT OBSERVED until it is run.
import fs from "node:fs";
import path from "node:path";
import { loadRegistryModule, exists, toCsv } from "./lib.mjs";
import { MAPPING, EXISTING_SECTIONS } from "./module-mapping.mjs";

const G0 = { modules: 85, inactive: 6, electron: 79, pwa: 41, pwaAlsoElectron: 41, electronOnly: 38,
  electronBySection: { "work-log": 6, "planning-workspace": 4, "mrp-procurement": 12, "inventory-sales": 15, "product-reference-master": 15, "qa-qc": 9, "plant-assets": 5, "bmr-production-records": 1, sops: 3, system: 4, admin: 5 },
  pwaBySection: { "work-log": 2, "mrp-procurement": 4, "inventory-sales": 11, "product-reference-master": 8, "qa-qc": 8, system: 4, admin: 4 } };

export async function verifyRegistry(data) {
  const R = await loadRegistryModule();
  const out = [];
  const add = (id, ok, detail) => out.push({ id, status: ok ? "PASS" : "FAIL", detail });
  const reg = (data.registry || []).filter((r) => r.nav_enabled !== false);
  const norm = (r, c) => ({ key: R.normalizeModuleKey(r.module_key || r.target_key), label: r.label, section: r.section_key, sort: Number(r.sort_order), route: R.normalizeClientRoute(r.route_path, c), client: c, mode: r.min_nav_mode });
  const by = { electron: reg.filter((r) => r.client_key === "electron").map((r) => norm(r, "electron")), pwa: reg.filter((r) => r.client_key === "pwa").map((r) => norm(r, "pwa")) };
  add("L1 active navigable Electron = 79", by.electron.length === G0.electron, `${by.electron.length}`);
  add("L2 active navigable PWA = 41", by.pwa.length === G0.pwa, `${by.pwa.length}`);
  const ek = new Set(by.electron.map((r) => r.key));
  add("L3 every PWA module also in Electron", by.pwa.every((r) => ek.has(r.key)), by.pwa.filter((r) => !ek.has(r.key)).map((r) => r.key).join(","));
  add("L4 Electron-only = 38", by.electron.filter((r) => !by.pwa.some((p) => p.key === r.key)).length === G0.electronOnly);
  for (const c of ["electron", "pwa"]) {
    const dist = {}; by[c].forEach((r) => (dist[r.section] = (dist[r.section] || 0) + 1));
    const exp = c === "electron" ? G0.electronBySection : G0.pwaBySection;
    add(`L5 ${c} section distribution matches G0`, JSON.stringify(Object.entries(dist).sort()) === JSON.stringify(Object.entries(exp).sort()), JSON.stringify(dist));
    const routes = by[c].map((r) => r.route);
    add(`L6 no duplicate active route within ${c}`, new Set(routes).size === routes.length, "");
    const ties = {}; by[c].forEach((r) => ((ties[`${r.section}:${r.sort}`] ||= []).push(r.key)));
    const tiesList = Object.entries(ties).filter(([, v]) => v.length > 1);
    add(`L7 sort_order ties reported (${c})`, true, tiesList.map(([k, v]) => `${k}=[${v.join("|")}]`).join("; ") || "none");
    const missing = by[c].filter((r) => !/^(https?:|#)/.test(r.route) && !exists(c === "pwa" ? `public${r.route.startsWith("/") ? r.route : "/" + r.route}` : r.route));
    add(`L8 ${c} route target exists in static root`, missing.length === 0, missing.map((r) => `${r.key}->${r.route}`).join(", "));
  }
  const secKeys = new Set((data.sections || []).map((s) => R.normalizeModuleKey(s.key)));
  add("L9 no orphan section (every registry section_key in app_nav_sections)", [...by.electron, ...by.pwa].every((r) => secKeys.has(R.normalizeModuleKey(r.section))));
  const known = new Set(MAPPING.flatMap((m) => [m.key, ...(m.aliases || []).map(R.normalizeModuleKey)]));
  const unmapped = [...ek].filter((k) => !known.has(k));
  add("L10 every live module_key has a G1 mapping row (unmapped listed; assign before G2)", unmapped.length === 0, `unmapped=${unmapped.length}: ${unmapped.join(",")}`);
  const live = new Set([...ek]);
  const stale = MAPPING.filter((m) => m.keyBasis === "inferred" && !live.has(m.key)).map((m) => m.key);
  add("L11 inferred mapping keys absent from live registry (rename in mapping)", stale.length === 0, `${stale.length}: ${stale.join(",")}`);
  const moved = by.electron.filter((r) => { const m = MAPPING.find((x) => x.key === r.key || (x.aliases || []).map(R.normalizeModuleKey).includes(r.key)); return m && m.optA.section !== r.section; }).map((r) => r.key);
  add("L12 modules whose live section differs from Option A target (informational)", true, `${moved.length}: ${moved.join(",")}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.log("usage: registry-verify.mjs export.json [outDir]"); process.exit(64); }
  const res = await verifyRegistry(JSON.parse(fs.readFileSync(file, "utf8")));
  for (const r of res) console.log(`${r.status}  ${r.id}${r.detail ? "  — " + r.detail : ""}`);
  if (process.argv[3]) { fs.mkdirSync(process.argv[3], { recursive: true }); fs.writeFileSync(path.join(process.argv[3], "registry-verify-result.csv"), toCsv(res, ["id", "status", "detail"])); }
  process.exit(res.some((r) => r.status === "FAIL") ? 1 : 0);
}
