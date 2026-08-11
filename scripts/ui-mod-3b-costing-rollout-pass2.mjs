/**
 * DEPRECATED / DO NOT RUN — UI-MOD-3B pass 2 (REJECTED)
 * Destructive: icon-btn-primary:hover regex deleted large CSS spans including
 * .cost-sheet-modal.hidden on CCC/MCM/CBM/PPM. Kept for audit history only.
 * Recovery: UI-MOD-3R. Do not execute.
 *
 * Original: remap remaining visually-active legacy blues
 * and PPM/workspace tab states on the five migrated Costing pages.
 */
throw new Error("DEPRECATED: ui-mod-3b-costing-rollout-pass2.mjs — DO NOT RUN (UI-MOD-3B rejected)");

import fs from "fs";
import path from "path";

const root = path.resolve("public/shared");
const files = [
  "costing-control-center.html",
  "material-cost-manager.html",
  "cost-build-manager.html",
  "pricing-policy-manager.html",
  "production-route-manager.html",
];

function patch(html) {
  // peq filter active / badge / hover
  html = html.replace(
    /\.peq-filter-btn:hover,\s*\.peq-filter-btn:focus-visible\s*\{[\s\S]*?\}/,
    `.peq-filter-btn:hover,
      .peq-filter-btn:focus-visible {
        background: var(--sasv-surface-soft, var(--erp-hover, #f3f4f6));
        border-color: var(--sasv-action-primary-soft-border);
        color: var(--sasv-action-primary-active);
        outline: none;
      }`
  );
  html = html.replace(
    /\.peq-filter-btn--active\s*\{[\s\S]*?\}/,
    `.peq-filter-btn--active {
        background: var(--sasv-action-primary-soft);
        border-color: var(--sasv-action-primary-soft-border);
        color: var(--sasv-action-primary-active);
      }`
  );
  html = html.replace(
    /\.peq-filter-btn--active:hover\s*\{[\s\S]*?\}/,
    `.peq-filter-btn--active:hover {
        background: var(--sasv-selection-soft);
        border-color: var(--sasv-action-primary-soft-border);
        color: var(--sasv-action-primary-active);
      }`
  );
  html = html.replace(
    /\.peq-filter-badge\s*\{([\s\S]*?)\}/,
    (m, body) => {
      let b = body
        .replace(/background:\s*#2563eb;/, "background: var(--sasv-action-primary);")
        .replace(/color:\s*#fff;/, "color: var(--sasv-text-on-primary, #fff);");
      return `.peq-filter-badge {${b}}`;
    }
  );

  // drawer modal tabs
  html = html.replace(
    /\.modal-window\s+\.tab\.active\s*\{[\s\S]*?\}/,
    `.modal-window .tab.active {
        background: var(--sasv-selection-soft);
        color: var(--sasv-action-primary-active);
        border-color: var(--sasv-action-primary-soft-border);
        box-shadow: none;
      }`
  );

  // icon-btn-primary blocks that still use --primary,#2563eb
  html = html.replace(
    /\.icon-btn\.icon-btn-primary,\s*button\.icon-btn-primary\s*\{[\s\S]*?\}/,
    `.icon-btn.icon-btn-primary,
      button.icon-btn-primary {
        background: var(--sasv-action-primary);
        border-color: var(--sasv-action-primary);
        color: var(--sasv-text-on-primary, #fff);
      }`
  );
  html = html.replace(
    /\.icon-btn\.icon-btn-primary:hover,[\s\S]*?button\.icon-btn-primary:focus-visible\s*\{[\s\S]*?\}/,
    `.icon-btn.icon-btn-primary:hover,
      button.icon-btn-primary:hover,
      .icon-btn.icon-btn-primary:focus-visible,
      button.icon-btn-primary:focus-visible {
        background: var(--sasv-action-primary-hover);
        border-color: var(--sasv-action-primary-hover);
        color: var(--sasv-text-on-primary, #fff);
      }`
  );

  // PPM workspace tabs
  html = html.replace(
    /\.cp-pricing-direct-workspace-tab\.active[\s\S]*?\{[\s\S]*?\}/g,
    (m) =>
      m
        .replace(/#2563eb/g, "var(--sasv-action-primary)")
        .replace(/rgba\(\s*37,\s*99,\s*235,\s*[^)]+\)/g, "var(--sasv-action-primary-soft)")
        .replace(/box-shadow:\s*[^;]+;/g, "box-shadow: none;")
  );

  // Manager tab cards active
  html = html.replace(
    /\.cp-manager-tab-card\.active\s*\{[\s\S]*?\}/,
    `.cp-manager-tab-card.active {
        border-color: var(--sasv-action-primary-soft-border);
        background: var(--sasv-action-primary-soft);
        box-shadow: none;
      }`
  );
  html = html.replace(
    /\.cp-manager-tab-card\.active\s+\.cp-card-label,\s*\.cp-manager-tab-card\.active\s+\.cp-card-value\s*\{[\s\S]*?\}/,
    `.cp-manager-tab-card.active .cp-card-label,
      .cp-manager-tab-card.active .cp-card-value {
        color: var(--sasv-action-primary-active);
      }`
  );

  // Remaining presentation fallbacks
  html = html.replace(/var\(--primary,\s*#2563eb\)/g, "var(--sasv-action-primary)");
  html = html.replace(/var\(--erp-accent,\s*#2563eb\)/g, "var(--sasv-action-primary)");
  html = html.replace(/var\(--accent,\s*#2563eb\)/g, "var(--sasv-action-primary)");
  html = html.replace(/accent-color:\s*#2563eb/g, "accent-color: var(--sasv-action-primary)");

  // Blue glow leftovers
  html = html.replace(
    /box-shadow:\s*0\s+4px\s+14px\s+rgba\(\s*37,\s*99,\s*235,\s*0\.22\s*\);/g,
    "box-shadow: none;"
  );

  // Fix mangled pill rule from pass 1
  html = html.replace(
    /box-shadow:\s*none;\}/g,
    "box-shadow: none;\n      }"
  );

  // Text-action nowrap helpers for common export/explain buttons if present
  if (html.includes("cost-sheet-export-btn") && !html.includes("white-space: nowrap;\n        flex-shrink: 0;\n      }\n      .cost-sheet-export-btn")) {
    html = html.replace(
      /\.cost-sheet-export-btn\s*\{([\s\S]*?)\}/,
      (m, body) => {
        let b = body;
        if (!/white-space/.test(b)) b += "\n        white-space: nowrap;";
        if (!/flex-shrink/.test(b)) b += "\n        flex-shrink: 0;";
        return `.cost-sheet-export-btn {${b}}`;
      }
    );
  }

  return html;
}

const report = [];
for (const f of files) {
  const p = path.join(root, f);
  let html = fs.readFileSync(p, "utf8");
  const before = (html.match(/#2563eb/gi) || []).length;
  html = patch(html);
  const after = (html.match(/#2563eb/gi) || []).length;
  fs.writeFileSync(p, html);
  report.push({ f, before, after });
}
console.log(JSON.stringify(report, null, 2));
