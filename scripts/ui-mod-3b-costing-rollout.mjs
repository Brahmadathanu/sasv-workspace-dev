/**
 * DEPRECATED / DO NOT RUN — UI-MOD-3B (REJECTED)
 * Unsafe suite-wide Costing rollout. Caused CSR layout bleed and destructive
 * CSS loss via follow-on pass2. Kept only for audit history.
 * Recovery: UI-MOD-3R. Do not execute.
 *
 * Original: apply accepted CSR Costing chrome patterns to remaining 5 pages.
 * Presentation only. Does not alter workflow JS contracts.
 */
throw new Error("DEPRECATED: ui-mod-3b-costing-rollout.mjs — DO NOT RUN (UI-MOD-3B rejected)");

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

function patchHead(html) {
  let out = html;
  if (!out.includes('data-sasv-theme="sasv-core"')) {
    out = out.replace(/<html([^>]*)>/i, '<html lang="en" data-sasv-theme="sasv-core">');
  }
  if (!out.includes("sasv-costing.css")) {
    out = out.replace(
      /(<link\s+rel="stylesheet"\s+href="\.\.\/shared\/css\/style\.css"\s*\/>)/i,
      '$1\n    <link rel="stylesheet" href="../shared/css/sasv-costing.css" />'
    );
  }
  // Drop system-ui font lock so Inter/tokens apply
  out = out.replace(
    /font-family:\s*[\s\S]*?Arial,\s*sans-serif;/g,
    "/* font from sasv-costing / Inter via style.css */"
  );
  return out;
}

function patchBody(html) {
  return html.replace(/<body([^>]*)>/i, (full, attrs) => {
    if (/sasv-costing/.test(attrs)) return full;
    let next = attrs;
    if (/class="/i.test(next)) {
      next = next.replace(
        /class="([^"]*)"/i,
        'class="$1 sasv-module sasv-module--app sasv-costing"'
      );
    } else {
      next = ` class="sasv-module sasv-module--app sasv-costing"${next}`;
    }
    if (!/data-theme=/.test(next)) {
      next += ' data-theme="system"';
    }
    return `<body${next}>`;
  });
}

function patchSearch(html) {
  const repl = `      #search {
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
      }`;

  // Prefer replacing a contiguous #search / ::placeholder / :focus block when present
  const block =
    /#search\s*\{[\s\S]*?\}\s*(?:#search::placeholder\s*\{[\s\S]*?\}\s*)?(?:#search:focus\s*\{[\s\S]*?\})?/;
  if (block.test(html)) {
    return html.replace(block, repl);
  }
  return html;
}

function patchLensPills(html) {
  // Background rail
  html = html.replace(
    /\.lens-pills\s*\{([\s\S]*?)\}/,
    (m, body) => {
      let b = body
        .replace(
          /background:\s*linear-gradient\([\s\S]*?\);/,
          "background: var(--sasv-surface-soft, var(--panel-bg, #f8fafc));"
        )
        .replace(
          /border:\s*1px solid[^;]+;/,
          "border: 1px solid var(--sasv-border, var(--erp-border, var(--border, #e5e7eb)));"
        );
      return `.lens-pills {${b}}`;
    }
  );

  // Hover
  html = html.replace(
    /\.lens-pills\s+\.pill:hover\s*\{[\s\S]*?\}/,
    `.lens-pills .pill:hover {
        color: var(--sasv-text, var(--erp-text, #0f172a));
        background: var(--sasv-action-primary-soft);
        border-color: var(--sasv-action-primary-soft-border);
        box-shadow: none;
      }`
  );

  // Active — kill blue glow
  html = html.replace(
    /\.lens-pills\s+\.pill\.active\s*\{[\s\S]*?\}/,
    `.lens-pills .pill.active {
        color: var(--sasv-action-primary-active);
        background: var(--sasv-selection-soft);
        border-color: var(--sasv-action-primary-soft-border);
        box-shadow: none;
        font-weight: var(--cp-fw-heading);
      }`
  );

  // Ensure base pill has no shadow and uses tokens where easy
  html = html.replace(
    /\.lens-pills\s+\.pill\s*\{([\s\S]*?)\}/,
    (m, body) => {
      let b = body;
      if (!/box-shadow/.test(b)) b += "\n        box-shadow: none;";
      return `.lens-pills .pill {${b}}`;
    }
  );

  return html;
}

function patchPrimaryButtons(html) {
  // Common primary button fallbacks
  html = html.replace(
    /background:\s*var\(--primary,\s*#2563eb\)/g,
    "background: var(--sasv-action-primary, var(--primary))"
  );
  html = html.replace(
    /border-color:\s*var\(--primary,\s*#2563eb\)/g,
    "border-color: var(--sasv-action-primary, var(--primary))"
  );
  html = html.replace(
    /color:\s*var\(--primary,\s*#2563eb\)/g,
    "color: var(--sasv-action-primary-active, var(--primary))"
  );
  html = html.replace(
    /background:\s*#2563eb\b/g,
    "background: var(--sasv-action-primary)"
  );
  html = html.replace(
    /border-color:\s*#2563eb\b/g,
    "border-color: var(--sasv-action-primary)"
  );
  html = html.replace(
    /color:\s*#2563eb\b/g,
    "color: var(--sasv-action-primary-active)"
  );
  html = html.replace(
    /accent-color:\s*#2563eb\b/g,
    "accent-color: var(--sasv-action-primary)"
  );
  html = html.replace(
    /box-shadow:\s*0\s+4px\s+14px\s+rgba\(\s*37,\s*99,\s*235,\s*0\.22\s*\)/g,
    "box-shadow: none"
  );
  html = html.replace(
    /rgba\(\s*37,\s*99,\s*235,\s*0\.0[2-9]\s*\)/g,
    "var(--sasv-action-primary-soft)"
  );
  html = html.replace(
    /rgba\(\s*37,\s*99,\s*235,\s*0\.1[0-9]\s*\)/g,
    "var(--sasv-action-primary-soft-border)"
  );
  html = html.replace(
    /rgba\(\s*37,\s*99,\s*235,\s*0\.2[0-9]\s*\)/g,
    "var(--sasv-action-primary-soft-border)"
  );
  // Cyan search leftovers
  html = html.replace(/#e6f7ff/g, "var(--sasv-search-select-bg, var(--sasv-primary-50))");
  html = html.replace(
    /border-color:\s*var\(--erp-accent-2,\s*#0ea5e9\)/g,
    "border-color: var(--sasv-control-border-focus)"
  );
  html = html.replace(
    /box-shadow:\s*0\s+0\s+0\s+4px\s+rgba\(\s*14,\s*165,\s*233,\s*0\.08\s*\)/g,
    "box-shadow: 0 0 0 3px var(--sasv-focus-ring)"
  );
  // Hard blues used as primary hover
  html = html.replace(/background:\s*#1d4ed8\b/g, "background: var(--sasv-action-primary-hover)");
  html = html.replace(/border-color:\s*#1d4ed8\b/g, "border-color: var(--sasv-action-primary-hover)");
  html = html.replace(/#3b82f6/g, "var(--sasv-action-primary)");
  return html;
}

function patchHeaderActions(html) {
  // Replace refresh/export/home SVG blocks with empty chrome-mounted buttons
  // Match the common CSR-era header action cluster carefully.

  const homeBlock =
    /<button\s+id="homeBtn"[^>]*>[\s\S]*?<\/button>/i;
  if (homeBlock.test(html)) {
    html = html.replace(
      homeBlock,
      `<button
            id="homeBtn"
            type="button"
            class="icon-btn sasv-home-btn"
            title="HOME"
            aria-label="HOME"
          ></button>`
    );
  }

  // Empty refresh / export SVG contents so mountModuleActionIcons can fill them
  html = html.replace(
    /(<button\s+id="refreshBtn"[^>]*>)[\s\S]*?(<\/button>)/i,
    (m, open, close) => {
      let o = open;
      if (!/class=/.test(o)) o = o.replace(/>$/, ' class="icon-btn">');
      else if (!/icon-btn/.test(o))
        o = o.replace(/class="/, 'class="icon-btn ');
      return `${o}${close}`;
    }
  );
  html = html.replace(
    /(<button\s+id="exportCsv"[^>]*>)[\s\S]*?(<\/button>)/i,
    (m, open, close) => {
      let o = open;
      if (!/class=/.test(o)) o = o.replace(/>$/, ' class="icon-btn">');
      else if (!/icon-btn/.test(o))
        o = o.replace(/class="/, 'class="icon-btn ');
      return `${o}${close}`;
    }
  );

  // Title class
  html = html.replace(
    /(<div class="page-header">\s*<div>\s*)<h1>/i,
    '$1<h1 class="sasv-module-title">'
  );

  return html;
}

function patchNowrapActions(html) {
  // Ensure modal action groups can wrap whole controls
  if (!html.includes("cost-sheet-modal-actions")) return html;
  html = html.replace(
    /\.cost-sheet-modal-actions\s*\{([\s\S]*?)\}/,
    (m, body) => {
      let b = body;
      if (!/flex-wrap/.test(b)) b += "\n        flex-wrap: wrap;";
      if (!/flex-shrink/.test(b)) b += "\n        flex-shrink: 0;";
      return `.cost-sheet-modal-actions {${b}}`;
    }
  );
  return html;
}

const report = [];
for (const f of files) {
  const p = path.join(root, f);
  let html = fs.readFileSync(p, "utf8");
  const beforeBlue = (html.match(/#2563eb/gi) || []).length;
  const beforeGlow = (html.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length;

  html = patchHead(html);
  html = patchBody(html);
  html = patchSearch(html);
  html = patchLensPills(html);
  html = patchPrimaryButtons(html);
  html = patchHeaderActions(html);
  html = patchNowrapActions(html);

  const afterBlue = (html.match(/#2563eb/gi) || []).length;
  const afterGlow = (html.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length;
  fs.writeFileSync(p, html);
  report.push({
    f,
    beforeBlue,
    afterBlue,
    beforeGlow,
    afterGlow,
    hasCostingCss: html.includes("sasv-costing.css"),
    hasBodyClass: html.includes("sasv-costing"),
  });
}

console.log(JSON.stringify(report, null, 2));
