/**
 * UI-MOD-3H — Production Route Manager individual presentation migration.
 * Presentation only. Current tree is source of truth — no wholesale restore.
 * Does not alter DOM IDs, lens keys, RPC wiring, or parallel-agent geometry.
 */
import fs from "fs";

const path = "public/shared/production-route-manager.html";
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
      parts.add("sasv-production-route-manager");
      return `class="${[...parts].join(" ")}"`;
    });
  } else {
    a = ` class="sasv-module sasv-module--app sasv-costing sasv-production-route-manager"${a}`;
  }
  return `<body${a}>`;
});

function emptyButton(html, id) {
  const re = new RegExp(
    `<button\\s+id="${id}"([\\s\\S]*?)>[\\s\\S]*?<\\/button>`,
    "i"
  );
  return html.replace(re, (full, attrs) => {
    // Already empty for chrome mount — leave content as-is if empty.
    if (/>\s*<\/button>$/i.test(full.trim()) || /><\/button>$/i.test(full)) {
      let a = attrs;
      if (!/class=/.test(a)) a += ' class="icon-btn"';
      else if (!/icon-btn/.test(a)) a = a.replace(/class="/, 'class="icon-btn ');
      if (id === "homeBtn") {
        if (!/sasv-home-btn/.test(a))
          a = a.replace(/class="/, 'class="sasv-home-btn ');
        a = a.replace(/title="Home"/i, 'title="HOME"');
        a = a.replace(/aria-label="Home"/i, 'aria-label="HOME"');
        if (!/title=/.test(a)) a += ' title="HOME"';
        if (!/aria-label=/.test(a)) a += ' aria-label="HOME"';
      }
      return `<button id="${id}"${a}></button>`;
    }
    // Non-empty: only ensure classes, do not strip parallel-agent content if any
    return full;
  });
}

h = emptyButton(h, "refreshBtn");
h = emptyButton(h, "exportCsv");
h = emptyButton(h, "homeBtn");

// peq filter SVG → 16px (canonical action icon grammar)
h = h.replace(
  /(id="peqFilterBtn"[\s\S]*?<svg\s+[^>]*?)width="15"\s+height="15"/,
  `$1width="16"\n            height="16"`
);

const blocks = [
  [
    `        }
                  #search {`,
    `        }
      #search {`,
  ],
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
    `.cp-prm-actions .icon-btn,
      .cp-prm-editor-lifecycle .icon-btn,
      .cp-prm-form-actions .icon-btn,
      .cp-prm-summary .cp-prm-actions .icon-btn,
      .cp-prm-candidate-controls .icon-btn,
      .cp-workbench-summary-card .cp-prm-actions .icon-btn {
        width: auto;
        height: auto;
        min-height: 28px;
        padding: 4px 10px;
        gap: 4px;
        font-size: 12.5px;
        font-weight: 500;
        line-height: 1.25;
        letter-spacing: normal;
        white-space: nowrap;
        background: #eef2f7;
        border-color: #cbd5e1;
        color: var(--text, #0f172a);
      }
      .cp-prm-actions .icon-btn:hover:not(:disabled),
      .cp-prm-editor-lifecycle .icon-btn:hover:not(:disabled),
      .cp-prm-form-actions .icon-btn:hover:not(:disabled),
      .cp-prm-summary .cp-prm-actions .icon-btn:hover:not(:disabled),
      .cp-prm-candidate-controls .icon-btn:hover:not(:disabled),
      .cp-workbench-summary-card .cp-prm-actions .icon-btn:hover:not(:disabled) {
        background: #e2e8f0;
        border-color: #94a3b8;
      }`,
    `.cp-prm-actions .icon-btn,
      .cp-prm-editor-lifecycle .icon-btn,
      .cp-prm-form-actions .icon-btn,
      .cp-prm-summary .cp-prm-actions .icon-btn,
      .cp-prm-candidate-controls .icon-btn,
      .cp-workbench-summary-card .cp-prm-actions .icon-btn {
        width: auto;
        height: auto;
        min-height: 28px;
        padding: 4px 10px;
        gap: 4px;
        font-size: 12.5px;
        font-weight: 500;
        line-height: 1.25;
        letter-spacing: normal;
        white-space: nowrap;
        flex-shrink: 0;
        background: var(--sasv-surface-soft, #eef2f7);
        border-color: var(--sasv-border, #cbd5e1);
        color: var(--sasv-text, var(--text, #0f172a));
      }
      .cp-prm-actions .icon-btn:hover:not(:disabled),
      .cp-prm-editor-lifecycle .icon-btn:hover:not(:disabled),
      .cp-prm-form-actions .icon-btn:hover:not(:disabled),
      .cp-prm-summary .cp-prm-actions .icon-btn:hover:not(:disabled),
      .cp-prm-candidate-controls .icon-btn:hover:not(:disabled),
      .cp-workbench-summary-card .cp-prm-actions .icon-btn:hover:not(:disabled) {
        background: var(--sasv-action-primary-soft, #e2e8f0);
        border-color: var(--sasv-action-primary-soft-border, #94a3b8);
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
    `.icon-btn.cp-danger-text-btn {
        width: auto;
        height: auto;
        min-height: 30px;
        padding: 7px 12px;
        border-color: #fecaca;
        background: #fef2f2;
        color: #991b1b;
        font-weight: var(--cp-fw-label);
      }
      .icon-btn.cp-danger-text-btn:hover,
      .icon-btn.cp-danger-text-btn:focus-visible {
        background: #fee2e2;
        border-color: #fca5a5;
        color: #7f1d1d;
      }`,
    `.icon-btn.cp-danger-text-btn {
        width: auto;
        height: auto;
        min-height: 30px;
        padding: 7px 12px;
        border-color: var(--sasv-danger-border);
        background: var(--sasv-danger-bg);
        color: var(--sasv-danger);
        font-weight: var(--cp-fw-label);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .icon-btn.cp-danger-text-btn:hover,
      .icon-btn.cp-danger-text-btn:focus-visible {
        background: color-mix(in srgb, var(--sasv-danger) 14%, #fff);
        border-color: var(--sasv-danger-border);
        color: var(--sasv-danger);
      }`,
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
    `.cp-prm-setup-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border: 1px solid #fcd34d;
        border-radius: 999px;
        background: #fffbeb;
        color: #92400e;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        max-width: 100%;
      }
      .cp-prm-setup-chip:hover,
      .cp-prm-setup-chip:focus-visible {
        background: #fef3c7;
      }
      .cp-prm-setup-chip:focus {
        outline: none;
      }
      .cp-prm-setup-chip:focus-visible {
        outline: 2px solid #d97706;
        outline-offset: 2px;
      }
      .cp-prm-setup-chip--ok {
        background: #ecfdf5;
        border-color: #6ee7b7;
        color: #065f46;
      }`,
    `.cp-prm-setup-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border: 1px solid var(--sasv-warning-border, #fcd34d);
        border-radius: 999px;
        background: var(--sasv-warning-bg, #fffbeb);
        color: var(--sasv-warning, #92400e);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        max-width: 100%;
      }
      .cp-prm-setup-chip:hover,
      .cp-prm-setup-chip:focus-visible {
        background: color-mix(in srgb, var(--sasv-warning) 12%, #fff);
      }
      .cp-prm-setup-chip:focus {
        outline: none;
      }
      .cp-prm-setup-chip:focus-visible {
        outline: 2px solid var(--sasv-warning);
        outline-offset: 2px;
      }
      .cp-prm-setup-chip--ok {
        background: var(--sasv-success-bg, #ecfdf5);
        border-color: var(--sasv-success-border, #6ee7b7);
        color: var(--sasv-success, #065f46);
      }`,
  ],
  [
    `.cp-prm-title-action:hover {
        color: #1d4ed8;
        color: color-mix(in srgb, var(--sasv-action-primary) 82%, #000);
      }`,
    `.cp-prm-title-action:hover {
        color: var(--sasv-action-primary-active);
        color: color-mix(in srgb, var(--sasv-action-primary) 82%, #000);
      }`,
  ],
  [
    `[data-theme="dark"] .cp-prm-title-action {
        color: #93c5fd;
      }
      [data-theme="dark"] .cp-prm-title-action:hover {
        color: #bfdbfe;
      }
      [data-theme="dark"] .cp-prm-title-action .cp-cell-primary {
        text-decoration-color: color-mix(in srgb, #93c5fd 40%, transparent);
      }`,
    `[data-theme="dark"] .cp-prm-title-action {
        color: var(--sasv-action-primary-soft);
      }
      [data-theme="dark"] .cp-prm-title-action:hover {
        color: var(--sasv-action-primary-active);
      }
      [data-theme="dark"] .cp-prm-title-action .cp-cell-primary {
        text-decoration-color: color-mix(
          in srgb,
          var(--sasv-action-primary-soft) 40%,
          transparent
        );
      }`,
  ],
  [
    `.cp-prm-editor-cue--warn {
        color: #b45309;
      }`,
    `.cp-prm-editor-cue--warn {
        color: var(--sasv-warning);
      }`,
  ],
  [
    `.cp-prm-badge-info {
        background: #e0f2fe;
        color: #075985;
      }`,
    `.cp-prm-badge-info {
        background: var(--sasv-info-bg, #e0f2fe);
        color: var(--sasv-info, #075985);
      }`,
  ],
  [
    `.cp-prm-workflow li[data-state="complete"] .cp-prm-workflow-mark {
        color: #065f46;
      }
      .cp-prm-workflow li[data-state="current"] .cp-prm-workflow-mark {
        color: #9a3412;
        font-weight: var(--cp-fw-label, 500);
      }
      .cp-prm-workflow li[data-state="pending"] .cp-prm-workflow-mark {
        color: #6b7280;
      }`,
    `.cp-prm-workflow li[data-state="complete"] .cp-prm-workflow-mark {
        color: var(--sasv-success);
      }
      .cp-prm-workflow li[data-state="current"] .cp-prm-workflow-mark {
        color: var(--sasv-warning);
        font-weight: var(--cp-fw-label, 500);
      }
      .cp-prm-workflow li[data-state="pending"] .cp-prm-workflow-mark {
        color: var(--sasv-text-muted, #6b7280);
      }`,
  ],
  [
    `.cp-prm-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        background: #f3f4f6;
        font-size: 12px;
        font-weight: var(--cp-fw-label, 500);
      }
      .cp-prm-badge-ok { background: #ecfdf5; color: #065f46; }
      .cp-prm-badge-warn { background: #fff7ed; color: #9a3412; }
      .cp-prm-badge-danger { background: #fef2f2; color: #991b1b; }`,
    `.cp-prm-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--sasv-surface-soft, #f3f4f6);
        font-size: 12px;
        font-weight: var(--cp-fw-label, 500);
      }
      .cp-prm-badge-ok { background: var(--sasv-success-bg); color: var(--sasv-success); }
      .cp-prm-badge-warn { background: var(--sasv-warning-bg); color: var(--sasv-warning); }
      .cp-prm-badge-danger { background: var(--sasv-danger-bg); color: var(--sasv-danger); }`,
  ],
  [
    `.cp-prm-form-field input,
      .cp-prm-form-field select,
      .cp-prm-form-field textarea {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        min-height: 36px;
        padding: 8px 10px;
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 8px;
        background: var(--panel-bg, #fff);
        color: var(--text, #0f172a);
        font-size: 12.5px;
        font-weight: var(--cp-fw-label);
        line-height: 1.3;
      }`,
    `.cp-prm-form-field input,
      .cp-prm-form-field select,
      .cp-prm-form-field textarea {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        min-height: var(--sasv-control-md, 36px);
        padding: 8px 10px;
        border: 1px solid var(--sasv-control-border, var(--border, #e5e7eb));
        border-radius: var(--sasv-radius-sm, 8px);
        background: var(--sasv-control-bg, var(--panel-bg, #fff));
        color: var(--sasv-text, var(--text, #0f172a));
        font-size: 12.5px;
        font-weight: var(--cp-fw-label);
        line-height: 1.3;
        font: inherit;
      }`,
  ],
];

for (const [from, to] of blocks) {
  if (!h.includes(from)) {
    console.warn("MISSING block:\n", from.slice(0, 100));
    continue;
  }
  h = h.replace(from, to);
}

// Fallback: any remaining hardcoded #1d4ed8 as presentation-only (not in print)
if (/#1d4ed8/i.test(h)) {
  h = h.replace(/#1d4ed8/gi, "var(--sasv-action-primary-active)");
  console.log("remapped leftover #1d4ed8");
}
if (/#2563eb/i.test(h)) {
  h = h.replace(/#2563eb/gi, "var(--sasv-action-primary)");
  console.log("remapped leftover #2563eb");
}

// Safety: un-nest #search if still deeply indented
if (/\n\s{10,}#search\s*\{/.test(h)) {
  h = h.replace(/\n\s+#search\s*\{/, "\n      #search {");
  console.log("FIXED nested #search");
}

fs.writeFileSync(path, h);

const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
console.log(
  JSON.stringify(
    {
      body: body.replace(/\s+/g, " ").slice(0, 320),
      costingCss: h.includes("sasv-costing.css"),
      blues2563: (h.match(/#2563eb/gi) || []).length,
      blues1d4: (h.match(/#1d4ed8/gi) || []).length,
      rgba37: (h.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length,
      nestedSearch: /\n\s{10,}#search\s*\{/.test(h),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
      peqFilter16: /id="peqFilterBtn"[\s\S]{0,500}?width="16"/.test(h),
      tableWrapVisiblePattern: /#tableWrap\.tw-visible/.test(h),
      modalOverlayHidden: /\.modal-overlay\.hidden\s*\{/.test(h),
      editorToolbar: h.includes("cp-prm-editor-toolbar"),
      stepTable: h.includes("cp-prm-step-table"),
    },
    null,
    2
  )
);
