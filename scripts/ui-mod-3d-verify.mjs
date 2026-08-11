/**
 * UI-MOD-3D static checks — Costing deep-action grammar.
 */
import fs from "fs";

const css = fs.readFileSync("public/shared/css/sasv-costing.css", "utf8");
const checks = {
  naturalWidthDefault: /width:\s*auto;[\s\S]*?min-width:\s*var\(--sasv-control-md\)/.test(
    css.split("UI-MOD-3D")[1] || css
  ),
  iconOnlySquare: css.includes(":has(> svg:only-child)"),
  secondaryAdapters: css.includes("cost-sheet-explain-toolbar-btn"),
  evidenceTrace: css.includes("cp-evidence-trace-btn"),
  actionGroups: css.includes("cost-sheet-drill-actions"),
  cccNoBlanketSquare: !/body\.sasv-costing-control-center\s+\.icon-btn:not\(#homeBtn\):not\(\.sasv-home-btn\)\s*\{\s*width:\s*var\(--sasv-control-md\)/.test(
    css
  ),
  noHardTealInNewBlock: !/#147a6c|#1f8f7e|#2563eb/.test(
    css.slice(css.indexOf("UI-MOD-3D"))
  ),
};

const pages = [
  "cost-sheet-review.html",
  "costing-control-center.html",
  "material-cost-manager.html",
  "cost-build-manager.html",
  "pricing-policy-manager.html",
  "production-route-manager.html",
];

const scan = {};
for (const f of pages) {
  const h = fs.readFileSync(`public/shared/${f}`, "utf8");
  scan[f] = {
    linksCostingCss: h.includes("sasv-costing.css"),
    explainToolbar: (h.match(/cost-sheet-explain-toolbar-btn/g) || []).length,
    exportBtn: (h.match(/cost-sheet-export-btn/g) || []).length,
    drillBtn: (h.match(/cost-sheet-drill-btn/g) || []).length,
    evidenceTrace: (h.match(/cp-evidence-trace-btn/g) || []).length,
    wbAudit: (h.match(/cp-wb-audit-btn/g) || []).length,
    iconBtnPrimary: (h.match(/icon-btn-primary/g) || []).length,
  };
}

console.log(JSON.stringify({ checks, scan }, null, 2));
