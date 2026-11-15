// Regenerates the committed G1 evidence files (read-only on the repo; writes only into the evidence directory).
// Usage: node scripts/wp09-g1-launcher-audit/build-evidence.mjs docs/master-data-costing/WP09_G1_EVIDENCE
import fs from "node:fs";
import path from "node:path";
import { inventory } from "./source-inventory.mjs";
import { MAPPING, NON_LAUNCHER } from "./module-mapping.mjs";
import { toCsv } from "./lib.mjs";

const out = process.argv[2];
if (!out) throw new Error("usage: build-evidence.mjs <outDir>");
fs.mkdirSync(out, { recursive: true });
const inv = inventory();
const byPath = Object.fromEntries(inv.map((p) => [p.path, p]));
fs.writeFileSync(path.join(out, "source-page-inventory.json"), JSON.stringify({ generatedBy: "scripts/wp09-g1-launcher-audit/source-inventory.mjs", pages: inv.map(({ scripts, ...p }) => ({ ...p, scriptCount: scripts.length })) }, null, 1) + "\n");
const rows = MAPPING.map((m) => {
  const p = byPath[m.page];
  return { source_page: m.page, candidate_module_key: m.key, key_basis: m.keyBasis, aliases: (m.aliases || []).join("|"), electron_route: p.electronRoute, pwa_route: p.pwaRoute || "(not in PWA publish root)", pwa_reachable_by_source: p.pwaReachable ? "yes" : "no",
    live_current_section: "NOT OBSERVED", live_sort_order: "NOT OBSERVED",
    optA_domain_section_reference_only: m.optA.section, optA_subgroup: m.optA.sub, optB_section_key: m.optB.section, optB_subgroup: m.optB.sub, optC_family: m.optC || "(flat tile)", duplication_class: m.dup,
    tables_rpcs_touched: [...p.tables, ...p.rpcs.map((r) => "rpc:" + r)].slice(0, 12).join("|"), source_writers: p.hasWriter ? "yes" : "no" };
});
fs.writeFileSync(path.join(out, "module-group-mapping.csv"), toCsv(rows, Object.keys(rows[0])));
fs.writeFileSync(path.join(out, "non-launcher-pages.csv"), toCsv(Object.entries(NON_LAUNCHER).map(([page, reason]) => ({ page, reason })), ["page", "reason"]));
console.log(`mapping rows=${rows.length} non-launcher=${Object.keys(NON_LAUNCHER).length} pages=${inv.length}`);
