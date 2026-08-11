/**
 * UI-MOD-4D — Supply Overrides presentation migration.
 * Presentation only. Preserves tab keys, plan IDs, RPC wiring, download behaviour.
 */
import fs from "fs";

const path = "supply-overrides.html";
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

if (!h.includes("sasv-supply-overrides.css")) {
  h = h.replace(
    /(<link\s+rel="stylesheet"\s+href="public\/shared\/css\/style\.css"\s*\/>)/i,
    `$1\n    <link rel="stylesheet" href="public/shared/css/sasv-supply-overrides.css" />`,
  );
}

h = h.replace(/<body([^>]*)>/i, (full, attrs) => {
  let a = attrs || "";
  if (/class="/i.test(a)) {
    a = a.replace(/class="([^"]*)"/i, (m, cls) => {
      const parts = new Set(cls.split(/\s+/).filter(Boolean));
      parts.add("sasv-module");
      parts.add("sasv-module--app");
      parts.add("sasv-supply-overrides");
      return `class="${[...parts].join(" ")}"`;
    });
  } else {
    a = ` class="sasv-module sasv-module--app sasv-supply-overrides"${a}`;
  }
  if (!/data-theme=/.test(a)) a += ' data-theme="system"';
  return `<body${a}>`;
});

// Canonical HOME chrome + header copy
h = h.replace(
  /<header class="page-header">\s*<h1>Supply Overrides<\/h1>\s*<div class="header-actions">\s*<button id="homeBtn">[\s\S]*?<\/button>\s*<\/div>\s*(?:<!--[\s\S]*?-->\s*)?<\/header>/i,
  `<div class="header-card">
      <div class="page-header">
        <div class="so-header-copy">
          <h1 class="sasv-module-title">Supply Overrides</h1>
          <div class="page-sub">
            Manual plan sets through reconcile and apply for supply quantity overrides.
          </div>
        </div>
        <div class="header-actions">
          <button id="homeBtn" type="button" class="icon-btn sasv-home-btn" title="HOME" aria-label="HOME"></button>
        </div>
      </div>
    </div>`,
);

// Body base: defer to module shell (no duplicate viewport padding)
h = h.replace(
  /body \{\s*font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif;\s*margin: 16px;\s*background: #f8fafc;\s*color: #0f172a;\s*\}/,
  `body {
        /* Inter + viewport gutter from sasv-module--app tokens */
        margin: 0;
        color: var(--sasv-text, #0f172a);
      }`,
);

h = h.replace(
  /\.page-header h1 \{\s*font-size: 1\.5rem;\s*color: var\(--primary, #3b82f6\);\s*\}/,
  `/* page title: sasv-supply-overrides.css */
      .page-header h1 {
        font-size: 1.125rem;
        color: var(--sasv-text);
        font-weight: 600;
      }`,
);

// Tabs: soft selection, no blue glow
h = h.replace(
  /\.tab-btn \{\s*border: 1px solid transparent;\s*border-bottom: 1px solid transparent;\s*border-radius: 10px 10px 0 0;\s*background: transparent;\s*cursor: pointer;\s*padding: 12px 16px;\s*display: inline-flex;\s*flex-direction: column;\s*gap: 4px;\s*min-width: 160px;\s*color: var\(--muted\);\s*font-weight: 600;\s*font-size: 0\.9rem;\s*transition: all 0\.2s ease;\s*\}/,
  `.tab-btn {
        border: 1px solid transparent;
        border-bottom: 1px solid transparent;
        border-radius: 10px 10px 0 0;
        background: transparent;
        cursor: pointer;
        padding: 12px 16px;
        display: inline-flex;
        flex-direction: column;
        gap: 4px;
        min-width: 160px;
        color: var(--muted);
        font-weight: 500;
        font-size: 0.9rem;
        transition: background 0.15s ease, color 0.15s ease;
        white-space: nowrap;
      }`,
);

h = h.replace(
  /\.tab-btn\[aria-selected="true"\] \{\s*background: linear-gradient\(\s*180deg,\s*rgba\(37, 99, 235, 0\.12\),\s*rgba\(37, 99, 235, 0\.05\)\s*\);\s*color: #0b3a9a;\s*border-color: rgba\(13, 60, 160, 0\.18\);\s*border-bottom-color: transparent;\s*box-shadow: 0 4px 10px rgba\(15, 23, 42, 0\.08\);\s*\}/,
  `.tab-btn[aria-selected="true"] {
        background: var(--sasv-selection-soft);
        color: var(--sasv-action-primary-active);
        border-color: var(--sasv-action-primary-soft-border);
        border-bottom-color: transparent;
        box-shadow: none;
      }`,
);

h = h.replace(
  /\.tab-btn:focus-visible \{\s*outline: 3px solid rgba\(37, 99, 235, 0\.24\);\s*outline-offset: 2px;\s*\}/,
  `.tab-btn:focus-visible {
        outline: 3px solid var(--sasv-focus-ring);
        outline-offset: 2px;
      }`,
);

h = h.replace(
  /\.tab-btn:hover \{\s*background: #f1f5f9;\s*color: #334155;\s*\}/,
  `.tab-btn:hover {
        background: var(--sasv-action-primary-soft);
        color: var(--sasv-text);
      }`,
);

// Toggle active — semantic primary (absent/zero/no stay danger via specialization)
h = h.replace(
  /\.toggle-option\.active \{\s*background: #2563eb;\s*color: #fff;\s*box-shadow: none;\s*\}/,
  `.toggle-option.active {
        background: var(--sasv-action-primary);
        color: var(--sasv-text-on-primary, #fff);
        box-shadow: none;
      }`,
);

// Buttons
h = h.replace(
  /\.btn\.primary \{\s*background: #3b82f6;\s*border-color: #2563eb;\s*color: #fff;\s*\}/,
  `.btn.primary {
        background: var(--sasv-action-primary);
        border-color: var(--sasv-action-primary);
        color: var(--sasv-text-on-primary, #fff);
      }`,
);

h = h.replace(
  /\.btn\.outline \{\s*background: transparent;\s*border-color: rgba\(59, 130, 246, 0\.4\);\s*color: #1d4ed8;\s*\}/,
  `.btn.outline {
        background: var(--sasv-surface, #fff);
        border-color: var(--sasv-control-border, #cbd5e1);
        color: var(--sasv-text);
      }`,
);

h = h.replace(
  /\.btn\.outline:hover \{\s*background: rgba\(37, 99, 235, 0\.1\);\s*\}/,
  `.btn.outline:hover {
        background: var(--sasv-action-primary-soft);
      }`,
);

// Remove amber HOME block — shell owns HOME
h = h.replace(
  /\s*\/\* Home Button \*\/\s*#homeBtn \{[\s\S]*?#homeBtn svg \{\s*flex-shrink: 0;\s*\}\s*/,
  `\n      /* HOME chrome: body.sasv-module #homeBtn.sasv-home-btn */\n`,
);

// Mobile body margin — no duplicate gutter
h = h.replace(
  /@media \(max-width: 720px\) \{\s*body \{\s*margin: 12px;\s*\}/,
  `@media (max-width: 720px) {
        /* viewport gutter from sasv-module--app */`,
);

// Needed rows → token comment (specialization CSS wins for bg)
h = h.replace(
  /#unifiedTable tr\.needed td \{\s*background: rgba\(250, 204, 21, 0\.12\); \/\* soft amber \*\/\s*\}/,
  `#unifiedTable tr.needed td {
        background: var(--sasv-warning-bg); /* needed = warning semantics */
      }`,
);

h = h.replace(
  /#unifiedTable tr\.needed:hover td \{\s*background: rgba\(250, 204, 21, 0\.18\);\s*\}/,
  `#unifiedTable tr.needed:hover td {
        background: var(--sasv-warning-bg);
      }`,
);

// Strip hard-hex inline styles on Zero Seeded / Refresh — classes + specialization CSS
h = h.replace(
  /(<button\s+[^>]*id="btnZeroSeeded"[^>]*)\s+style="[\s\S]*?"(\s*>)/i,
  `$1$2`,
);

h = h.replace(
  /(<button\s+[^>]*id="btnRefreshSupplyRollups"[^>]*)\s+style="[\s\S]*?"(\s*>)/i,
  `$1$2`,
);

// Ensure Zero Seeded / Refresh keep btn class for grammar
if (!/id="btnZeroSeeded"[^>]*class=/.test(h)) {
  h = h.replace(
    /id="btnZeroSeeded"/,
    `id="btnZeroSeeded" class="btn"`,
  );
}

if (!/id="btnRefreshSupplyRollups"[^>]*class="btn"/.test(h)) {
  // may already have class="btn"
  if (!/id="btnRefreshSupplyRollups"[^>]*class=/.test(h)) {
    h = h.replace(/id="btnRefreshSupplyRollups"/, `id="btnRefreshSupplyRollups" class="btn"`);
  }
}

// Hidden toast host for adapter fallback
if (!h.includes('id="toast"')) {
  h = h.replace(
    /<\/body>/i,
    `    <div id="toast" hidden></div>\n  </body>`,
  );
}

fs.writeFileSync(path, h);
console.log("UI-MOD-4D present: supply-overrides.html updated");
