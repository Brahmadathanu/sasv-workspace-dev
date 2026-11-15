// Reproduce source inventory + exact live-key design mapping from committed capture.
import fs from "node:fs";
import path from "node:path";
import { inventory } from "./source-inventory.mjs";
import { MAPPING, NON_LAUNCHER } from "./module-mapping.mjs";
import { toCsv, read } from "./lib.mjs";
import { staticPath } from "./registry-verify.mjs";
const out = process.argv[2];
if (!out) throw new Error("usage: build-evidence.mjs <outDir>");
fs.mkdirSync(out, { recursive: true });
const live = JSON.parse(read("docs/master-data-costing/WP09_G1_EVIDENCE/live-registry-snapshot-2026-11-15.json"));
const inv = inventory();
const byPath = Object.fromEntries(inv.map((p) => [p.path, p]));
fs.writeFileSync(path.join(out, "source-page-inventory.json"), JSON.stringify({ generatedBy: "scripts/wp09-g1-launcher-audit/source-inventory.mjs", pages: inv.map(({ scripts, ...p }) => ({ ...p, scriptCount: scripts.length })) }, null, 1) + "\n");
const rows = MAPPING.map((m) => {
  const p = byPath[m.page];
  const e = live.registry.find((r) => r.module_key === m.key && r.client_key === "electron");
  const w = live.registry.find((r) => r.module_key === m.key && r.client_key === "pwa");
  return { canonical_source_page: m.page, module_key: m.key, key_basis: m.keyBasis, label: e.label,
    electron_registered_route: e.route_path, electron_static_path: staticPath(e.route_path, "electron"),
    pwa_registered_route: w?.route_path || "(not registered)", pwa_static_path: w ? staticPath(w.route_path, "pwa") : "(not registered)",
    live_current_section: e.section_key, live_sort_order: e.sort_order, live_target_key: e.target_key, live_min_nav_mode: e.min_nav_mode,
    pwa_target_key: w?.target_key || "", pwa_min_nav_mode: w?.min_nav_mode || "",
    source_permission_key_observed: m.sourcePermissionKey || "", aliases_in_shared_normalizer: (m.aliases || []).join("|"),
    optA_section: m.optA.section, optA_subgroup: m.optA.sub, optB_section_key: m.optB.section, optB_subgroup: m.optB.sub,
    optC_family_within_live_section: m.optC || "(flat tile)", duplication_class: m.dup,
    tables_rpcs_touched: [...p.tables, ...p.rpcs.map((r) => "rpc:" + r)].slice(0, 12).join("|"), source_writers: p.hasWriter ? "yes" : "no" };
});
fs.writeFileSync(path.join(out, "module-group-mapping.csv"), toCsv(rows, Object.keys(rows[0])));
fs.writeFileSync(path.join(out, "non-launcher-pages.csv"), toCsv(Object.entries(NON_LAUNCHER).map(([page, reason]) => ({ page, reason })), ["page", "reason"]));
const coverage = ["electron", "pwa"].map((client) => {
  const modules = live.registry.filter((r) => r.client_key === client && r.nav_enabled);
  const sections = [...new Set(modules.map((r) => r.section_key))];
  const perSection = sections.map((section) => {
    const ms = modules.filter((r) => r.section_key === section).map((r) => MAPPING.find((m) => m.key === r.module_key));
    const families = new Set(ms.filter((m) => m.optC).map((m) => m.optC));
    const flat = ms.filter((m) => !m.optC).length;
    return { section, modules: ms.length, subgroups: new Set(ms.map((m) => m.optA.sub)).size, family_cards: families.size, flat_tiles: flat, option_c_top_level: families.size + flat };
  });
  return { client, registered_modules: modules.length, mapped_modules: modules.filter((r) => MAPPING.some((m) => m.key === r.module_key)).length,
    option_a_tiles: modules.length, option_a_sections: sections.length, option_a_subgroups: perSection.reduce((n, s) => n + s.subgroups, 0),
    option_b_tiles: modules.length, option_b_sections: new Set(modules.map((r) => MAPPING.find((m) => m.key === r.module_key).optB.section)).size,
    option_c_top_level: perSection.reduce((n, s) => n + s.option_c_top_level, 0),
    count_basis: "maximum registered inventory, before per-user grants; families scoped to live section; singleton family still counts as one tile", perSection };
});
fs.writeFileSync(path.join(out, "option-coverage.json"), JSON.stringify(coverage, null, 2) + "\n");
console.log(`mapping rows=${rows.length} non-launcher/source-only=${Object.keys(NON_LAUNCHER).length} pages=${inv.length}`);
console.log(JSON.stringify(coverage.map(({ perSection, ...r }) => r), null, 2));
