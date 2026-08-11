/**
 * DEPRECATED / DO NOT RUN — UI-MOD-3B fix-search (REJECTED)
 * Unsafe #search[\s\S]*? replacement across Costing siblings.
 * Kept for audit history only. Recovery: UI-MOD-3R. Do not execute.
 */
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

throw new Error("DEPRECATED: ui-mod-3b-fix-search.mjs — DO NOT RUN (UI-MOD-3B rejected)");

const multiSearch = `      #search,
      #rmTraceSearch,
      #pmTraceSearch {
        background: var(--sasv-search-select-bg, var(--sasv-primary-50));
        border: 1px solid var(--sasv-search-select-border, var(--sasv-action-primary-soft-border));
        padding: 8px 38px 8px 10px;
        border-radius: var(--sasv-radius-sm, 6px);
        font-weight: var(--sasv-fw-regular, 400);
        width: 100%;
        box-sizing: border-box;
        min-height: var(--sasv-control-md, 36px);
        color: var(--sasv-text, inherit);
      }
      #search::placeholder,
      #rmTraceSearch::placeholder,
      #pmTraceSearch::placeholder {
        font-weight: var(--sasv-fw-regular, 400);
        color: var(--sasv-text-muted, var(--muted, #6b7280));
        opacity: 0.9;
      }
      #search:focus,
      #rmTraceSearch:focus,
      #pmTraceSearch:focus {
        outline: none;
        border-color: var(--sasv-control-border-focus, var(--sasv-action-primary));
        box-shadow: 0 0 0 3px var(--sasv-focus-ring);
        background: var(--sasv-control-bg, #fff);
      }
`;

const singleSearch = `      #search {
        background: var(--sasv-search-select-bg, var(--sasv-primary-50));
        border: 1px solid var(--sasv-search-select-border, var(--sasv-action-primary-soft-border));
        padding: 8px 38px 8px 10px;
        border-radius: var(--sasv-radius-sm, 6px);
        font-weight: var(--sasv-fw-regular, 400);
        width: 100%;
        box-sizing: border-box;
        min-height: var(--sasv-control-md, 36px);
        color: var(--sasv-text, inherit);
      }
      #search::placeholder {
        font-weight: var(--sasv-fw-regular, 400);
        color: var(--sasv-text-muted, var(--muted, #6b7280));
        opacity: 0.9;
      }
      #search:focus {
        outline: none;
        border-color: var(--sasv-control-border-focus, var(--sasv-action-primary));
        box-shadow: 0 0 0 3px var(--sasv-focus-ring);
        background: var(--sasv-control-bg, #fff);
      }
`;

for (const f of files) {
  const p = path.join(root, f);
  let h = fs.readFileSync(p, "utf8");

  h = h.replace(
    /border-left:\s*3px solid #2563eb;/g,
    "border-left: 3px solid var(--sasv-action-primary);"
  );

  // Replace from first search selector cluster through just before .input-clear-btn
  if (h.includes("#rmTraceSearch")) {
    h = h.replace(/#search[\s\S]*?(?=\.input-clear-btn\s*\{)/, multiSearch);
  } else {
    h = h.replace(/#search[\s\S]*?(?=\.input-clear-btn\s*\{)/, singleSearch);
  }

  h = h.replace(
    /line-height:\s*1\.2;\s*box-shadow:\s*none;\s*\}/g,
    "line-height: 1.2;\n        box-shadow: none;\n      }"
  );

  fs.writeFileSync(p, h);
  console.log(
    f,
    "blue",
    (h.match(/#2563eb/gi) || []).length,
    "hasTraceSearch",
    h.includes("#rmTraceSearch")
  );
}
