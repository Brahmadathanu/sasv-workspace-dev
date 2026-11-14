// WP08 G1 — read-only, deterministic navigation evidence extraction. Reads repository files only; writes to stdout.
// Usage (repo root): node docs/master-data-costing/WP08_G1_evidence/extract-nav-evidence.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");
const out = [];
const p = (s = "") => out.push(s);

// 1. Server-emitted recommended_ui_route literals (all migrations) with the file count per code.
const migDir = "supabase/migrations";
const codeFiles = new Map();
for (const f of readdirSync(join(root, migDir)).filter((n) => n.endsWith(".sql")).sort()) {
  const t = read(`${migDir}/${f}`);
  for (const m of t.matchAll(/'recommended_ui_route'\s*,\s*'([A-Z_]+)'/g)) {
    if (!codeFiles.has(m[1])) codeFiles.set(m[1], new Set());
    codeFiles.get(m[1]).add(f);
  }
}
p("## A. Literal 'recommended_ui_route' codes in supabase/migrations");
for (const [c, s] of [...codeFiles].sort()) p(`${c}\tmigrations=${s.size}`);

// 2. Codes the shared client resolver maps (costing-suite-recommended-ui-route.js).
const res = read("public/shared/js/costing-suite-recommended-ui-route.js");
const resolverCodes = [...res.matchAll(/export const [A-Z_]+_ROUTE = "([A-Z_]+)"/g)].map((m) => m[1]);
p("\n## B. Codes handled by resolveRecommendedUiRouteTarget");
for (const c of resolverCodes) p(c);
p("\n## C. Server codes with NO resolver branch (all fall through to navigable:false/unmapped)");
for (const c of [...codeFiles.keys()].sort()) if (!resolverCodes.includes(c)) p(c);

// 3. Costing route config -> modules, permission targets, routePath.
const rc = read("public/shared/js/costing-route-config.js");
p("\n## D. COSTING_ROUTE_CONFIG modules");
for (const m of rc.matchAll(/moduleKey: "([^"]+)",\s*permissionTarget: "([^"]+)"[\s\S]*?routePath: "([^"]+)"/g)) p(`${m[1]}\t${m[2]}\t${m[3]}`);

// 4. Root-level master pages (served by Electron static server only; PWA publish dir is public/).
p("\n## E. Root-level *.html (Electron express.static root; NOT under public/)");
for (const f of readdirSync(root).filter((n) => n.endsWith(".html")).sort()) p(f);
p("\n## F. Product/BOM pages present under public/? (PWA publish = public)");
for (const f of ["manage-products.html", "manage-rm-bom.html", "manage-pm-bom.html", "manage-sp-bom.html"]) {
  p(`${f}\troot=${existsSync(join(root, f))}\tpublic=${existsSync(join(root, "public", f))}\tpublic/shared=${existsSync(join(root, "public/shared", f))}`);
}

// 5. Deep-link parameter consumers.
p("\n## G. URL-parameter consumers (source grep)");
for (const f of ["js/products.js", "js/manage-rm-bom.js", "js/manage-pm-bom.js", "js/manage-sp-bom.js"]) {
  const t = read(f);
  p(`${f}\tURLSearchParams=${/URLSearchParams|location\.search/.test(t)}\tpermissionTarget=${(t.match(/MODULE_TARGET = "([^"]+)"|MODULE_ID = "([^"]+)"/) || []).slice(1).filter(Boolean).join("")}`);
}
const shell = read("public/shared/js/costing-suite-shell.js");
p(`costing-suite-shell.js reads product_id=${/qp\.get\("product_id"\)/.test(shell)} sku_id=${/qp\.get\("sku_id"\)/.test(shell)}`);
p(`shell applies LAUNCH_DRILL_CONTEXT.skuId only for: ${/CURRENT_LENS === "manual-rate-manager"[\s\S]{0,200}skuId: LAUNCH_DRILL_CONTEXT\.skuId/.test(shell) ? "manual-rate-manager (Material Cost Manager)" : "?"}`);
const prm = read("public/shared/js/costing-suite-production-route.js");
p(`PRM applyDeepLinkFromUrl reads product_id=${/"product_id",\s*\n\s*"product_group_id"/.test(prm)}`);
p("\n## H. Electron application menu items with module navigation");
const main = read("main.js");
p(`main.js menu labels: ${[...main.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]).join(", ")}`);
p(`setWindowOpenHandler/will-navigate present: ${/setWindowOpenHandler|will-navigate/.test(main)}`);
console.log(out.join("\n"));
