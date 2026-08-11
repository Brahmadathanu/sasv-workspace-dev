/**
 * UI-MOD-4E — Supply Batch Plan presentation migration.
 * Presentation only. Preserves tab keys, batch-size RPCs, plan header IDs.
 */
import fs from "fs";

const path = "supply-batch-plan.html";
let h = fs.readFileSync(path, "utf8");

if (!h.includes('data-sasv-theme="sasv-core"')) {
  h = h.replace(/<html([^>]*)>/i, '<html lang="en" data-sasv-theme="sasv-core">');
}

if (!h.includes('name="viewport"')) {
  h = h.replace(
    /<meta charset="UTF-8"\s*\/>/i,
    `<meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />`,
  );
}

if (!h.includes("sasv-supply-batch-plan.css")) {
  h = h.replace(
    /(<link\s+rel="stylesheet"\s+href="public\/shared\/css\/style\.css"\s*\/>)/i,
    `$1\n    <link rel="stylesheet" href="public/shared/css/sasv-supply-batch-plan.css" />`,
  );
}

h = h.replace(/<body([^>]*)>/i, (full, attrs) => {
  let a = attrs || "";
  if (/class="/i.test(a)) {
    a = a.replace(/class="([^"]*)"/i, (m, cls) => {
      const parts = new Set(cls.split(/\s+/).filter(Boolean));
      parts.add("sasv-module");
      parts.add("sasv-module--app");
      parts.add("sasv-supply-batch-plan");
      return `class="${[...parts].join(" ")}"`;
    });
  } else {
    a = ` class="sasv-module sasv-module--app sasv-supply-batch-plan"${a}`;
  }
  if (!/data-theme=/.test(a)) a += ' data-theme="system"';
  return `<body${a}>`;
});

// Canonical HOME chrome
h = h.replace(
  /<!-- Simplified Page Header -->\s*<header class="page-header">\s*<h1>Supply Batch Plan<\/h1>\s*<div class="header-actions">\s*<button id="homeBtn">HOME<\/button>\s*<\/div>\s*<\/header>/i,
  `<!-- Page Header -->
    <div class="header-card">
      <div class="page-header">
        <div class="sbp-header-copy">
          <h1 class="sasv-module-title">Supply Batch Plan</h1>
          <div class="page-sub">
            Build, size, and apply supply batch plans with preferred batch-size references.
          </div>
        </div>
        <div class="header-actions">
          <button id="homeBtn" type="button" class="icon-btn sasv-home-btn" title="HOME" aria-label="HOME"></button>
        </div>
      </div>
    </div>`,
);

// Body base — inherit shell gutter
h = h.replace(
  /body \{\s*font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif;\s*margin: 16px;\s*color: #111;\s*\}/,
  `body {
        /* Inter + viewport gutter from sasv-module--app tokens */
        margin: 0;
        color: var(--sasv-text, #111);
      }`,
);

// Primary buttons → semantic
h = h.replace(
  /\.btn\.primary \{\s*background: var\(--btn-bg, #005a8d\);\s*color: var\(--btn-text, #fff\);\s*border-color: var\(--btn-bg, #005a8d\);\s*\}/,
  `.btn.primary {
        background: var(--sasv-action-primary, var(--btn-bg, #005a8d));
        color: var(--sasv-text-on-primary, #fff);
        border-color: var(--sasv-action-primary, var(--btn-bg, #005a8d));
      }`,
);

h = h.replace(
  /\.btn\.primary:hover \{\s*background: var\(--btn-hover-bg, #004876\);\s*border-color: var\(--btn-hover-bg, #004876\);\s*filter: brightness\(1\.02\);\s*\}/,
  `.btn.primary:hover {
        background: var(--sasv-action-primary-hover, var(--btn-hover-bg, #004876));
        border-color: var(--sasv-action-primary-hover, var(--btn-hover-bg, #004876));
        filter: none;
      }`,
);

h = h.replace(
  /\.btn\.warn \{\s*background: #fef3c7;\s*border-color: #f59e0b;\s*color: #92400e;\s*\}/,
  `.btn.warn {
        background: var(--sasv-warning-bg, #fef3c7);
        border-color: var(--sasv-warning-border, #f59e0b);
        color: var(--sasv-warning, #92400e);
      }`,
);

// Workflow tabs — soft selection, no blue glow
h = h.replace(
  /\.tab-btn\[aria-selected="true"\] \{\s*background: linear-gradient\(\s*180deg,\s*rgba\(37, 99, 235, 0\.12\),\s*rgba\(37, 99, 235, 0\.06\)\s*\);\s*color: #0b3a9a;\s*border-color: rgba\(13, 60, 160, 0\.12\);\s*border-bottom-color: transparent;\s*box-shadow: 0 2px 6px rgba\(15, 23, 42, 0\.06\);\s*\}/,
  `.tab-btn[aria-selected="true"] {
        background: var(--sasv-selection-soft);
        color: var(--sasv-action-primary-active);
        border-color: var(--sasv-action-primary-soft-border);
        border-bottom-color: transparent;
        box-shadow: none;
        font-weight: 600;
      }`,
);

h = h.replace(
  /\.tab-btn:focus \{\s*outline: 3px solid rgba\(37, 99, 235, 0\.12\);\s*outline-offset: 2px;\s*\}/,
  `.tab-btn:focus-visible {
        outline: 3px solid var(--sasv-focus-ring);
        outline-offset: 2px;
      }
      .tab-btn:focus {
        outline: none;
      }`,
);

h = h.replace(
  /\.tab-btn:hover \{\s*background: #f1f5f9;\s*color: #374151;\s*\}/,
  `.tab-btn:hover {
        background: var(--sasv-action-primary-soft);
        color: var(--sasv-text);
      }`,
);

// Config tab blues
h = h.replace(
  /background: linear-gradient\(135deg, #3b82f6 0%, #2563eb 100%\);/g,
  `background: var(--sasv-selection-soft);`,
);
h = h.replace(
  /background: linear-gradient\(135deg, #2563eb 0%, #1d4ed8 100%\);/g,
  `background: var(--sasv-action-primary-soft);`,
);
h = h.replace(/border-color: #2563eb;/g, `border-color: var(--sasv-action-primary-soft-border);`);
h = h.replace(
  /box-shadow: 0 2px 6px rgba\(37, 99, 235, 0\.25\);/g,
  `box-shadow: none;`,
);
h = h.replace(
  /box-shadow: 0 3px 8px rgba\(37, 99, 235, 0\.35\);/g,
  `box-shadow: none;`,
);

// Tab intro bar + workflow active step blues
h = h.replace(
  /background: linear-gradient\(90deg, #3b82f6, #60a5fa\);/g,
  `background: var(--sasv-action-primary);`,
);
h = h.replace(
  /background: #3b82f6;\s*border-color: #3b82f6;\s*box-shadow: 0 0 0 4px rgba\(59, 130, 246, 0\.1\);/g,
  `background: var(--sasv-selection-soft);
        border-color: var(--sasv-action-primary-soft-border);
        box-shadow: none;
        color: var(--sasv-action-primary-active);`,
);

// Focus / spinner / inpage primary blues (targeted common leftovers)
h = h.replace(/outline: 2px solid #3b82f6;/g, `outline: 2px solid var(--sasv-focus-ring);`);
h = h.replace(/border-top: 3px solid #3b82f6;/g, `border-top: 3px solid var(--sasv-action-primary);`);
h = h.replace(
  /\.inpage-modal-btn-primary[^{]*\{[^}]*background: #3b82f6;/g,
  (m) => m.replace(`background: #3b82f6;`, `background: var(--sasv-action-primary);`),
);

// btn-link blues
h = h.replace(/color: #2563eb !important;/g, `color: var(--sasv-action-primary) !important;`);
h = h.replace(/color: #1d4ed8 !important;/g, `color: var(--sasv-action-primary-hover) !important;`);

// Input focus → semantic
h = h.replace(
  /input:focus,\s*select:focus \{\s*outline: 2px solid var\(--primary, #005a8d\);\s*outline-offset: 2px;\s*border-color: var\(--primary, #005a8d\);\s*\}/,
  `input:focus,
      select:focus {
        outline: none;
        border-color: var(--sasv-control-border-focus, var(--primary, #005a8d));
        box-shadow: 0 0 0 3px var(--sasv-focus-ring);
      }`,
);

// Hide legacy toast host (canonical toast.js used at runtime)
h = h.replace(
  /#toast \{\s*display: none;\s*position: fixed;[\s\S]*?border-radius: 4px;\s*\}/,
  `#toast {
        display: none !important; /* canonical toast.js */
      }`,
);

fs.writeFileSync(path, h);

// Sanity leftovers
const blues = (h.match(/#2563eb|#1d4ed8|#3b82f6/gi) || []).length;
const glow = (h.match(/rgba\(\s*37,\s*99,\s*235|rgba\(\s*59,\s*130,\s*246/g) || []).length;
console.log(
  JSON.stringify(
    {
      ok: h.includes("sasv-supply-batch-plan") && h.includes("sasv-module--app"),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
      bluesLeft: blues,
      glowLeft: glow,
    },
    null,
    2,
  ),
);
console.log("UI-MOD-4E present: supply-batch-plan.html updated");
