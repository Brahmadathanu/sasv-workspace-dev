/**
 * UI-MOD-3G — Pricing Policy Manager individual presentation migration.
 * Presentation only. Does not alter DOM IDs, workspace keys, or workflows.
 */
import fs from "fs";

const path = "public/shared/pricing-policy-manager.html";
let h = fs.readFileSync(path, "utf8");

if (!h.includes("sasv-costing.css")) {
  h = h.replace(
    /(<link\s+rel="stylesheet"\s+href="\.\.\/shared\/css\/style\.css"\s*\/>)/i,
    `$1\n    <link rel="stylesheet" href="../shared/css/sasv-costing.css" />`
  );
}

if (!h.includes('data-sasv-theme="sasv-core"')) {
  h = h.replace(/<html([^>]*)>/i, '<html lang="en" data-sasv-theme="sasv-core">');
}

h = h.replace(/<body([^>]*)>/i, (full, attrs) => {
  let a = attrs;
  if (/class="/i.test(a)) {
    a = a.replace(/class="([^"]*)"/i, (m, cls) => {
      const parts = new Set(cls.split(/\s+/).filter(Boolean));
      parts.add("sasv-module");
      parts.add("sasv-module--app");
      parts.add("sasv-costing");
      parts.add("sasv-pricing-policy-manager");
      return `class="${[...parts].join(" ")}"`;
    });
  } else {
    a = ` class="sasv-module sasv-module--app sasv-costing sasv-pricing-policy-manager"${a}`;
  }
  return `<body${a}>`;
});

function emptyButton(html, id) {
  const re = new RegExp(
    `<button\\s+id="${id}"([\\s\\S]*?)>[\\s\\S]*?<\\/button>`,
    "i"
  );
  return html.replace(re, (full, attrs) => {
    let a = attrs;
    if (!/class=/.test(a)) a += ' class="icon-btn"';
    else if (!/icon-btn/.test(a)) a = a.replace(/class="/, 'class="icon-btn ');
    if (id === "homeBtn") {
      if (!/sasv-home-btn/.test(a)) a = a.replace(/class="/, 'class="sasv-home-btn ');
      a = a.replace(/title="Home"/i, 'title="HOME"');
      a = a.replace(/aria-label="Home"/i, 'aria-label="HOME"');
      if (!/title=/.test(a)) a += ' title="HOME"';
      if (!/aria-label=/.test(a)) a += ' aria-label="HOME"';
    }
    return `<button id="${id}"${a}></button>`;
  });
}

h = emptyButton(h, "refreshBtn");
h = emptyButton(h, "exportCsv");
h = emptyButton(h, "homeBtn");

const blocks = [
  [
    `.page-header h1 {
        margin: 0;
        color: var(--primary);
        font-weight: var(--cp-fw-heading);
      }`,
    `.page-header h1 {
        margin: 0;
        color: var(--sasv-text, var(--text, #0f172a));
        font-weight: var(--cp-fw-heading);
      }`,
  ],
  [
    `.kpi {
        background: linear-gradient(180deg, var(--panel-bg), var(--panel-bg));
        border: 1px solid rgba(0, 0, 0, 0.06);
        padding: 5px 8px;
        border-radius: 7px;`,
    `.kpi {
        background: var(--sasv-surface, var(--panel-bg));
        border: 1px solid var(--sasv-border, rgba(0, 0, 0, 0.06));
        padding: 5px 8px;
        border-radius: var(--sasv-radius-sm, 7px);`,
  ],
  [
    `.kpi.total {
        border-left: 3px solid var(--sasv-action-primary);
        background: linear-gradient(
          135deg,
          var(--sasv-action-primary-soft),
          var(--sasv-action-primary-soft)
        );
      }
      .kpi.ready {
        border-left: 3px solid #16a34a;
        background: linear-gradient(
          135deg,
          rgba(22, 163, 74, 0.07),
          rgba(22, 163, 74, 0.02)
        );
      }
      .kpi.review {
        border-left: 3px solid #f59e0b;
        background: linear-gradient(
          135deg,
          rgba(245, 158, 11, 0.07),
          rgba(245, 158, 11, 0.02)
        );
      }
      .kpi.blocked {
        border-left: 3px solid #ef4444;
        background: linear-gradient(
          135deg,
          rgba(239, 68, 68, 0.07),
          rgba(239, 68, 68, 0.02)
        );
      }
      .kpi.scheme {
        border-left: 3px solid #4f46e5;
        background: linear-gradient(
          135deg,
          rgba(79, 70, 229, 0.07),
          rgba(79, 70, 229, 0.02)
        );
      }`,
    `.kpi.total {
        border-left: 3px solid var(--sasv-action-primary);
        background: var(--sasv-action-primary-soft);
      }
      .kpi.ready {
        border-left: 3px solid var(--sasv-success);
        background: var(--sasv-success-bg);
      }
      .kpi.review {
        border-left: 3px solid var(--sasv-warning);
        background: var(--sasv-warning-bg);
      }
      .kpi.blocked {
        border-left: 3px solid var(--sasv-danger);
        background: var(--sasv-danger-bg);
      }
      .kpi.scheme {
        border-left: 3px solid var(--sasv-info);
        background: var(--sasv-info-bg);
      }`,
  ],
  [
    `.icon-btn.costing-refresh-dirty {
        border-color: #d97706;
        color: #b45309;
        background: #fffbeb;
        box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.18);
      }
      .icon-btn:hover {
        background: #f3f4f6;
      }`,
    `.icon-btn.costing-refresh-dirty {
        border-color: var(--sasv-warning-border);
        color: var(--sasv-warning);
        background: var(--sasv-warning-bg);
        box-shadow: 0 0 0 2px var(--sasv-focus-ring);
      }
      .icon-btn:hover {
        background: var(--sasv-surface-soft, #f3f4f6);
      }`,
  ],
  [
    `.icon-btn.cp-danger-icon-btn {
        width: 30px;
        height: 30px;
        padding: 0;
        border-color: #fecaca;
        background: #fef2f2;
        color: #991b1b;
      }
      .icon-btn.cp-danger-icon-btn:hover,
      .icon-btn.cp-danger-icon-btn:focus-visible {
        background: #fee2e2;
        border-color: #fca5a5;
        color: #7f1d1d;
      }`,
    `.icon-btn.cp-danger-icon-btn {
        width: 30px;
        height: 30px;
        padding: 0;
        border-color: var(--sasv-danger-border);
        background: var(--sasv-danger-bg);
        color: var(--sasv-danger);
      }
      .icon-btn.cp-danger-icon-btn:hover,
      .icon-btn.cp-danger-icon-btn:focus-visible {
        background: color-mix(in srgb, var(--sasv-danger) 14%, #fff);
        border-color: var(--sasv-danger-border);
        color: var(--sasv-danger);
      }`,
  ],
  [
    `        }
                    #search {`,
    `        }
      #search {`,
  ],
];

for (const [from, to] of blocks) {
  if (!h.includes(from)) {
    console.warn("MISSING block:\n", from.slice(0, 90));
    continue;
  }
  h = h.replace(from, to);
}

const blueMaps = [
  [
    `.generic-table-meta-actions .icon-btn.icon-btn-primary:hover,
      .generic-table-meta-actions .icon-btn.icon-btn-primary:focus-visible {
        background: color-mix(in srgb, var(--primary, #2563eb) 24%, #fff);
        border-color: color-mix(in srgb, var(--primary, #2563eb) 48%, #fff);
        color: var(--primary, #2563eb);
      }`,
    `.generic-table-meta-actions .icon-btn.icon-btn-primary:hover,
      .generic-table-meta-actions .icon-btn.icon-btn-primary:focus-visible {
        background: color-mix(in srgb, var(--sasv-action-primary) 24%, #fff);
        border-color: color-mix(in srgb, var(--sasv-action-primary) 48%, #fff);
        color: var(--sasv-action-primary-active);
      }`,
  ],
  [
    `tr.clickable:hover {
        background: rgba(37, 99, 235, 0.045);
      }`,
    `tr.clickable:hover {
        background: var(--sasv-action-primary-soft);
      }`,
  ],
  [
    `border-top-color: var(--primary, #2563eb);`,
    `border-top-color: var(--sasv-action-primary);`,
  ],
  [
    `.lane {
        display: block;
        width: 5px;
        min-height: 28px;
        border-radius: 6px;
        background: #6b7280;
      }
      .lane.ready {
        background: #16a34a;
      }
      .lane.review {
        background: #f59e0b;
      }
      .lane.blocked {
        background: #ef4444;
      }
      .lane.scheme {
        background: #4f46e5;
      }`,
    `.lane {
        display: block;
        width: 5px;
        min-height: 28px;
        border-radius: 6px;
        background: var(--sasv-text-muted, #6b7280);
      }
      .lane.ready {
        background: var(--sasv-success);
      }
      .lane.review {
        background: var(--sasv-warning);
      }
      .lane.blocked {
        background: var(--sasv-danger);
      }
      .lane.scheme {
        background: var(--sasv-info);
      }`,
  ],
  [
    `.chip.green,
      .status-chip.green {
        background: #ecfdf5;
        border-color: #86efac;
        color: #166534;
      }
      .chip.amber,
      .status-chip.amber {
        background: #fffbeb;
        border-color: #fcd34d;
        color: #92400e;
      }
      .chip.red,
      .status-chip.red {
        background: #fef2f2;
        border-color: #fca5a5;
        color: #991b1b;
      }
      .chip.blue,
      .status-chip.blue {
        background: #eff6ff;
        border-color: #93c5fd;
        color: #1d4ed8;
      }
      .chip.indigo,
      .status-chip.indigo {
        background: #eef2ff;
        border-color: #a5b4fc;
        color: #3730a3;
      }
      .chip.gray,
      .status-chip.gray {
        background: #f1f5f9;
        border-color: #cbd5e1;
        color: #475569;
      }`,
    `.chip.green,
      .status-chip.green {
        background: var(--sasv-success-bg);
        border-color: var(--sasv-success-border);
        color: var(--sasv-success);
      }
      .chip.amber,
      .status-chip.amber {
        background: var(--sasv-warning-bg);
        border-color: var(--sasv-warning-border);
        color: var(--sasv-warning);
      }
      .chip.red,
      .status-chip.red {
        background: var(--sasv-danger-bg);
        border-color: var(--sasv-danger-border);
        color: var(--sasv-danger);
      }
      .chip.blue,
      .status-chip.blue {
        background: var(--sasv-action-primary-soft);
        border-color: var(--sasv-action-primary-soft-border);
        color: var(--sasv-action-primary-active);
      }
      .chip.indigo,
      .status-chip.indigo {
        background: var(--sasv-info-bg);
        border-color: var(--sasv-info-border);
        color: var(--sasv-info);
      }
      .chip.gray,
      .status-chip.gray {
        background: var(--sasv-surface-soft);
        border-color: var(--sasv-border);
        color: var(--sasv-text-secondary);
      }`,
  ],
  [
    `[data-theme="dark"] .status-chip.blue,
      [data-theme="dark"] .chip.blue {
        background: #172554;
        border-color: #1d4ed8;
        color: #93c5fd;
      }`,
    `[data-theme="dark"] .status-chip.blue,
      [data-theme="dark"] .chip.blue {
        background: color-mix(in srgb, var(--sasv-action-primary) 28%, #0f172a);
        border-color: var(--sasv-action-primary-soft-border);
        color: var(--sasv-action-primary-soft);
      }`,
  ],
  [
    `.cp-printable-section-row td {
        background: rgba(37, 99, 235, 0.055);
        color: var(--text, #0f172a);
        font-size: 12px;`,
    `.cp-printable-section-row td {
        background: var(--sasv-action-primary-soft);
        color: var(--sasv-text, var(--text, #0f172a));
        font-size: 12px;`,
  ],
  [
    `.icon-btn.icon-btn-primary,
      button.icon-btn-primary {
        background: var(--primary, #2563eb);
        border-color: var(--primary, #2563eb);
        color: #fff;
      }
      .icon-btn.icon-btn-primary:hover,
      button.icon-btn-primary:hover,
      .icon-btn.icon-btn-primary:focus-visible,
      button.icon-btn-primary:focus-visible {
        background: #1d4ed8;
        background: color-mix(in srgb, var(--primary, #2563eb) 86%, #000);
        border-color: #1d4ed8;
        border-color: color-mix(in srgb, var(--primary, #2563eb) 86%, #000);
        color: #fff;
      }`,
    `.icon-btn.icon-btn-primary,
      button.icon-btn-primary {
        background: var(--sasv-action-primary);
        border-color: var(--sasv-action-primary);
        color: var(--sasv-text-on-primary, #fff);
      }
      .icon-btn.icon-btn-primary:hover,
      button.icon-btn-primary:hover,
      .icon-btn.icon-btn-primary:focus-visible,
      button.icon-btn-primary:focus-visible {
        background: var(--sasv-action-primary-hover);
        border-color: var(--sasv-action-primary-hover);
        color: var(--sasv-text-on-primary, #fff);
      }`,
  ],
  [
    `.table-card {
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 8px;
        padding: 8px;
        background: var(--panel-bg);
      }`,
    `.table-card {
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
        border: 1px solid var(--sasv-border, var(--border, #e5e7eb));
        border-radius: var(--sasv-radius-md, 8px);
        padding: 8px;
        background: var(--sasv-surface, var(--panel-bg));
      }`,
  ],
];

for (const [from, to] of blueMaps) {
  if (!h.includes(from)) {
    console.warn("MISSING blueMap:\n", from.slice(0, 90));
    continue;
  }
  h = h.replace(from, to);
}

// PPM-specific remaining presentation blues (role-mapped, not blind)
const ppmTokenPasses = [
  [/var\(--primary,\s*#2563eb\)/g, "var(--sasv-action-primary)"],
  [/var\(--erp-accent,\s*var\(--primary,\s*#2563eb\)\)/g, "var(--sasv-action-primary)"],
  [/var\(--erp-accent,\s*var\(--sasv-action-primary\)\)/g, "var(--sasv-action-primary)"],
  [/outline:\s*2px solid var\(--primary,\s*#2563eb\)/g, "outline: 2px solid var(--sasv-control-border-focus)"],
  [/outline:\s*2px solid var\(--sasv-action-primary\)/g, "outline: 2px solid var(--sasv-control-border-focus)"],
  [/color:\s*#1d4ed8;/g, "color: var(--sasv-action-primary-active);"],
  [/border-color:\s*#1d4ed8;/g, "border-color: var(--sasv-action-primary-hover);"],
  [/background:\s*#1d4ed8;/g, "background: var(--sasv-action-primary-hover);"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.045\s*\)/g, "var(--sasv-action-primary-soft)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.055\s*\)/g, "var(--sasv-action-primary-soft)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.04\s*\)/g, "var(--sasv-action-primary-soft)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.06\s*\)/g, "var(--sasv-action-primary-soft)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.08\s*\)/g, "var(--sasv-action-primary-soft)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.1\s*\)/g, "var(--sasv-action-primary-soft)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.14\s*\)/g, "var(--sasv-selection-soft)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.18\s*\)/g, "var(--sasv-action-primary-soft-border)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.28\s*\)/g, "var(--sasv-action-primary-soft-border)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.35\s*\)/g, "var(--sasv-action-primary-soft-border)"],
  [/rgba\(\s*37,\s*99,\s*235,\s*0\.45\s*\)/g, "var(--sasv-action-primary-soft-border)"],
  [/color-mix\(\s*in srgb,\s*var\(--primary,\s*#2563eb\)\s*86%,\s*#000\s*\)/g, "var(--sasv-action-primary-hover)"],
  [/var\(--primary,\s*#2563eb\)/g, "var(--sasv-action-primary)"],
];

for (const [re, rep] of ppmTokenPasses) {
  h = h.replace(re, rep);
}

// Remaining hard #2563eb if any (presentation fills only)
h = h.replace(/#2563eb/gi, "var(--sasv-action-primary)");
h = h.replace(/#1d4ed8/gi, "var(--sasv-action-primary-hover)");

h = h.replace(
  /(id="peqFilterBtn"[\s\S]*?<svg\s+width=")15("\s+height=")15(")/,
  "$116$216$3"
);

fs.writeFileSync(path, h);
console.log(
  JSON.stringify(
    {
      body: (h.match(/<body[^>]*>/) || [""])[0].replace(/\s+/g, " ").slice(0, 300),
      costingCss: h.includes("sasv-costing.css"),
      blues2563: (h.match(/#2563eb/gi) || []).length,
      blues1d4: (h.match(/#1d4ed8/gi) || []).length,
      rgba37: (h.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
      modalHidden: /\.cost-sheet-modal\.hidden\s*\{/.test(h),
      tableWrapHidden: /#tableWrap\.hidden\s*\{/.test(h),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
      refreshEmpty: /id="refreshBtn"[^>]*>\s*<\/button>/.test(h),
    },
    null,
    2
  )
);
