// Offline verifier of the committed metadata capture; no network or database calls.
// L7 reports ties; it does not assert uniqueness of sort_order.
import fs from "node:fs";
import path from "node:path";
import { loadRegistryModule, exists, toCsv, read } from "./lib.mjs";
import { MAPPING } from "./module-mapping.mjs";

const G0 = { electron: 79, pwa: 41,
  electronBySection: { "work-log": 6, "planning-workspace": 4, "mrp-procurement": 12, "inventory-sales": 15, "product-reference-master": 15, "qa-qc": 9, "plant-assets": 5, "bmr-production-records": 1, sops: 3, system: 4, admin: 5 },
  pwaBySection: { "work-log": 2, "mrp-procurement": 4, "inventory-sales": 11, "product-reference-master": 8, "qa-qc": 8, system: 4, admin: 4 } };

// Browser-relative routes resolve from the actual launcher document, then from
// its publish root. Query/fragment do not identify separate static files.
export function staticPath(route, client) {
  const base = client === "pwa" ? "https://offline.invalid/utilities-hub/index.html" : "https://offline.invalid/index.html";
  const url = new URL(route, base);
  if (url.origin !== "https://offline.invalid" || !route || route.startsWith("#")) return null;
  return (client === "pwa" ? "public/" : "") + decodeURIComponent(url.pathname).replace(/^\/+/, "");
}

export async function verifyRegistry(data, mapping = MAPPING) {
  const R = await loadRegistryModule();
  const out = [];
  const add = (id, ok, detail = "") => out.push({ id, status: ok ? "PASS" : "FAIL", detail });
  const reg = (data.registry || []).filter((r) => r.nav_enabled !== false);
  const by = Object.fromEntries(["electron", "pwa"].map((c) => [c, reg.filter((r) => r.client_key === c).map((r) => ({ ...r, route: R.normalizeClientRoute(r.route_path, c) }))]));
  add("L1 active navigable Electron = 79", by.electron.length === G0.electron, `${by.electron.length}`);
  add("L2 active navigable PWA = 41", by.pwa.length === G0.pwa, `${by.pwa.length}`);
  const ek = new Set(by.electron.map((r) => r.module_key));
  add("L3 every PWA module also in Electron", by.pwa.every((r) => ek.has(r.module_key)));
  add("L4 Electron-only = 38", by.electron.filter((r) => !by.pwa.some((p) => p.module_key === r.module_key)).length === 38);
  for (const c of ["electron", "pwa"]) {
    const dist = {}; by[c].forEach((r) => (dist[r.section_key] = (dist[r.section_key] || 0) + 1));
    const exp = G0[c + "BySection"];
    add(`L5 ${c} section distribution matches G0`, JSON.stringify(Object.entries(dist).sort()) === JSON.stringify(Object.entries(exp).sort()), JSON.stringify(dist));
    const routes = by[c].map((r) => staticPath(r.route, c));
    add(`L6 no duplicate active route within ${c}`, new Set(routes).size === routes.length && routes.every(Boolean));
    const ties = {}; by[c].forEach((r) => ((ties[`${r.section_key}:${r.sort_order}`] ||= []).push(r.module_key)));
    add(`L7 sort_order ties reported (${c})`, true, Object.entries(ties).filter(([, v]) => v.length > 1).map(([k, v]) => `${k}=[${v.join("|")}]`).join("; ") || "none");
    const missing = by[c].filter((r) => !staticPath(r.route, c) || !exists(staticPath(r.route, c)));
    add(`L8 ${c} route target exists in static root`, missing.length === 0, missing.map((r) => `${r.module_key}->${r.route}`).join(", "));
    // Ownership is canonical source path or an existing redirect containing that
    // exact canonical path (WP08/FG-BIT). Never silently repoint registry routes.
    const wrong = by[c].filter((r) => {
      const m = mapping.find((m) => m.key === r.module_key);
      const file = staticPath(r.route, c);
      if (!m || !file || !exists(file)) return true;
      return file !== m.page && !(read(file).includes(m.page) && /location\.replace\(/.test(read(file)));
    });
    add(`L8 ${c} route ownership matches canonical page or redirect`, wrong.length === 0, wrong.map((r) => r.module_key).join(","));
  }
  const secKeys = new Set((data.sections || []).filter((s) => s.is_active !== false).map((s) => s.key));
  add("L9 no orphan active section assignment", [...by.electron, ...by.pwa].every((r) => secKeys.has(r.section_key)));
  const unmapped = [...ek].filter((k) => mapping.filter((m) => m.key === k).length !== 1);
  add("L10 every live module_key has exactly one mapping row", unmapped.length === 0, `unmapped/duplicate=${unmapped.length}: ${unmapped.join(",")}`);
  const stale = mapping.filter((m) => !ek.has(m.key)).map((m) => m.key);
  add("L11 every mapping key is registered (all bases; aliases cannot mask gaps)", stale.length === 0 && new Set(mapping.map((m) => m.key)).size === mapping.length, `${stale.length}: ${stale.join(",")}`);
  const moved = by.electron.filter((r) => mapping.find((m) => m.key === r.module_key)?.optA.section !== r.section_key).map((r) => r.module_key);
  add("L12 Option A preserves every live section", moved.length === 0, `${moved.length}: ${moved.join(",")}`);
  // Missing definitions must fail the full gate, even when counts happen to match.
  {
    const modules = data.modules || [];
    add("S1 definitions = 85; inactive = 6; active visible = 79", modules.length === 85 && modules.filter((m) => !m.is_active).length === 6 && modules.filter((m) => m.is_active && m.show_in_navigation).length === 79);
    add("S2 active sections = 11 with unique keys", secKeys.size === 11 && secKeys.size === data.sections.filter((s) => s.is_active).length);
    const defs = new Map(modules.map((m) => [m.module_key, m]));
    add("S3 unique definitions/client keys and active definition linkage", reg.length === 120 && reg.every((r) => ["electron", "pwa"].includes(r.client_key) && r.nav_enabled === true) && defs.size === modules.length && new Set(reg.map((r) => `${r.client_key}:${r.module_key}`)).size === reg.length && reg.every((r) => {
      const m = defs.get(r.module_key); return m?.is_active && m.show_in_navigation && m.section_key === r.section_key && m.sort_order === r.sort_order && m.min_nav_mode === r.min_nav_mode;
    }));
  }
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
