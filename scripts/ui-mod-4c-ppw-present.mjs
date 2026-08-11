/**
 * UI-MOD-4C — Production Planning Workbench presentation migration.
 * Presentation only. Preserves workflow IDs, stage keys, and tab contracts.
 */
import fs from "fs";

const path = "production-planning-workbench.html";
let h = fs.readFileSync(path, "utf8");

if (!h.includes('data-sasv-theme="sasv-core"')) {
  h = h.replace(
    /<html([^>]*)>/i,
    '<html lang="en" data-sasv-theme="sasv-core">'
  );
}

if (!h.includes('name="viewport"')) {
  h = h.replace(
    /<meta charset="UTF-8"\s*\/>/i,
    `<meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />`
  );
}

if (!h.includes("sasv-production-planning.css")) {
  h = h.replace(
    /(<link\s+rel="stylesheet"\s+href="public\/shared\/css\/style\.css"\s*\/>)/i,
    `$1\n    <link rel="stylesheet" href="public/shared/css/sasv-production-planning.css" />`
  );
}

h = h.replace(/<body([^>]*)>/i, (full, attrs) => {
  let a = attrs || "";
  if (/class="/i.test(a)) {
    a = a.replace(/class="([^"]*)"/i, (m, cls) => {
      const parts = new Set(cls.split(/\s+/).filter(Boolean));
      parts.add("sasv-module");
      parts.add("sasv-module--app");
      parts.add("sasv-production-planning-workbench");
      return `class="${[...parts].join(" ")}"`;
    });
  } else {
    a = ` class="sasv-module sasv-module--app sasv-production-planning-workbench"${a}`;
  }
  if (!/data-theme=/.test(a)) a += ' data-theme="system"';
  return `<body${a}>`;
});

// Canonical HOME chrome
h = h.replace(
  /<button\s+id="homeBtn"[\s\S]*?<\/button>/i,
  `<button id="homeBtn" type="button" class="icon-btn sasv-home-btn" title="HOME" aria-label="HOME"></button>`
);

// Header structure like accepted modules
h = h.replace(
  /<!-- Page Header -->\s*<header class="page-header">\s*<h1>Production Planning Workbench<\/h1>\s*<div class="header-actions">\s*<button id="homeBtn"[^>]*><\/button>\s*<\/div>\s*<\/header>/i,
  `<!-- Page Header -->
    <div class="header-card">
      <div class="page-header">
        <div class="ppw-header-copy">
          <h1 class="sasv-module-title">Production Planning Workbench</h1>
          <div class="page-sub">
            Forecast plan through output normalization for batch-ready production
            planning.
          </div>
        </div>
        <div class="header-actions">
          <button id="homeBtn" type="button" class="icon-btn sasv-home-btn" title="HOME" aria-label="HOME"></button>
        </div>
      </div>
    </div>`
);

const blocks = [
  [
    `body {
        font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif;
        margin: 16px;
        color: #111;
      }
      h1 {
        margin: 0 0 12px;
      }`,
    `body {
        /* Inter + padding from sasv-production-planning.css / sasv-module */
        margin: 0;
        color: var(--sasv-text, #111);
      }
      h1 {
        margin: 0 0 12px;
      }`,
  ],
  [
    `.btn.primary {
        background: var(--primary, #3b82f6);
        color: white;
        border-color: var(--primary, #3b82f6);
      }
      .btn.secondary {
        background: #6b7280;
        color: white;
        border-color: #6b7280;
      }

      /* Home Button */
      #homeBtn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border: 1px solid #fdba74 !important;
        border-radius: 6px;
        background: #fed7aa !important;
        color: #9a3412 !important;
        cursor: pointer;
        font-size: 0.875rem;
        font-family: inherit;
        font-weight: 500;
        transition: all 0.2s;
      }
      #homeBtn:hover {
        background: #fdba74 !important;
        border-color: #fb923c !important;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      #homeBtn svg {
        flex-shrink: 0;
      }

      /* Page Header */
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .page-header h1 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--primary);
      }
      .header-actions {
        display: flex;
        gap: 8px;
      }`,
    `.btn.primary {
        background: var(--sasv-action-primary);
        color: var(--sasv-text-on-primary, #fff);
        border-color: var(--sasv-action-primary);
      }
      .btn.secondary {
        background: var(--sasv-surface-soft);
        color: var(--sasv-text);
        border-color: var(--sasv-border);
      }

      /* HOME chrome: body.sasv-module #homeBtn.sasv-home-btn */
      /* Page header geometry: sasv-production-planning.css */`,
  ],
  [
    `.workflow-steps {
        margin-bottom: 20px;
        padding: 12px 20px;
        background: linear-gradient(135deg, #fefefe 0%, #f8fafc 100%);
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      }`,
    `.workflow-steps {
        margin-bottom: 16px;
        padding: 10px 14px;
        background: var(--sasv-surface, #fff);
        border-radius: var(--sasv-radius-md, 8px);
        border: 1px solid var(--sasv-border, #e2e8f0);
        box-shadow: none;
      }`,
  ],
  [
    `.workflow-step.completed .workflow-step-icon {
        background: #dcfce7;
        border-color: #16a34a;
      }

      .workflow-step.completed .workflow-step-icon svg {
        color: #16a34a;
      }

      .workflow-step.completed .workflow-step-label {
        color: #166534;
      }

      .workflow-step.completed .workflow-step-status {
        color: #16a34a;
      }

      .workflow-step.active .workflow-step-icon {
        background: #dbeafe;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
      }

      .workflow-step.active .workflow-step-icon svg {
        color: #3b82f6;
      }

      .workflow-step.active .workflow-step-label {
        color: #1e40af;
      }

      .workflow-step.active .workflow-step-status {
        color: #3b82f6;
      }

      .workflow-step.pending .workflow-step-icon {
        background: #fef3c7;
        border-color: #f59e0b;
      }

      .workflow-step.pending .workflow-step-icon svg {
        color: #d97706;
      }

      .workflow-step.pending .workflow-step-label {
        color: #92400e;
      }

      .workflow-step.pending .workflow-step-status {
        color: #f59e0b;
      }`,
    `.workflow-step.completed .workflow-step-icon {
        background: var(--sasv-success-bg);
        border-color: var(--sasv-success-border);
      }

      .workflow-step.completed .workflow-step-icon svg {
        color: var(--sasv-success);
      }

      .workflow-step.completed .workflow-step-label {
        color: var(--sasv-success);
        font-weight: 500;
      }

      .workflow-step.completed .workflow-step-status {
        color: var(--sasv-success);
      }

      .workflow-step.active .workflow-step-icon {
        background: var(--sasv-selection-soft);
        border-color: var(--sasv-action-primary-soft-border);
        box-shadow: none;
      }

      .workflow-step.active .workflow-step-icon svg {
        color: var(--sasv-action-primary-active);
      }

      .workflow-step.active .workflow-step-label {
        color: var(--sasv-action-primary-active);
        font-weight: 600;
      }

      .workflow-step.active .workflow-step-status {
        color: var(--sasv-action-primary);
      }

      .workflow-step.pending .workflow-step-icon {
        background: var(--sasv-warning-bg);
        border-color: var(--sasv-warning-border);
      }

      .workflow-step.pending .workflow-step-icon svg {
        color: var(--sasv-warning);
      }

      .workflow-step.pending .workflow-step-label {
        color: var(--sasv-warning);
        font-weight: 500;
      }

      .workflow-step.pending .workflow-step-status {
        color: var(--sasv-warning);
      }`,
  ],
  [
    `.workflow-step-label {
        font-size: 0.7rem;
        font-weight: 600;
        color: #64748b;
        text-align: center;
        line-height: 1.1;
        max-width: 90px;
      }`,
    `.workflow-step-label {
        font-size: 0.7rem;
        font-weight: 500;
        color: var(--sasv-text-secondary, #64748b);
        text-align: center;
        line-height: 1.1;
        max-width: 90px;
        white-space: nowrap;
      }`,
  ],
  [
    `.workflow-step-icon svg {
        width: 18px;
        height: 18px;
        color: #94a3b8;
      }`,
    `.workflow-step-icon svg {
        width: 16px;
        height: 16px;
        color: var(--sasv-text-muted, #94a3b8);
      }`,
  ],
  [
    `.toggle-option.active {
        background: #3b82f6;
        color: white;
      }
      .toggle-option.inactive {
        background: #ef4444;
        color: white;
      }`,
    `.toggle-option.active {
        background: var(--sasv-action-primary);
        color: var(--sasv-text-on-primary, #fff);
      }
      .toggle-option.inactive {
        background: var(--sasv-danger);
        color: var(--sasv-text-on-primary, #fff);
      }`,
  ],
  [
    `.action-btn.primary {
        background: #3b82f6;
        color: white;
      }

      .action-btn.primary:hover {
        background: #2563eb;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .action-btn.secondary {
        background: #64748b;
        color: white;
      }

      .action-btn.secondary:hover {
        background: #475569;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }`,
    `.action-btn.primary {
        background: var(--sasv-action-primary);
        color: var(--sasv-text-on-primary, #fff);
      }

      .action-btn.primary:hover {
        background: var(--sasv-action-primary-hover);
        transform: none;
        box-shadow: none;
      }

      .action-btn.secondary {
        background: var(--sasv-surface-soft);
        color: var(--sasv-text);
        border: 1px solid var(--sasv-border);
      }

      .action-btn.secondary:hover {
        background: var(--sasv-action-primary-soft);
        transform: none;
        box-shadow: none;
      }`,
  ],
  [
    `#toast {
        position: fixed;
        right: 16px;
        bottom: 16px;
        background: #111827;
        color: #fff;
        padding: 10px 14px;
        border-radius: 8px;
        display: none;
        z-index: 9999;
      }`,
    `/* Local #toast retained for API compat; canonical toast.js used at runtime */
      #toast {
        display: none !important;
      }`,
  ],
];

for (const [from, to] of blocks) {
  if (!h.includes(from)) {
    console.warn("MISSING block:\n", from.slice(0, 100).replace(/\n/g, " "));
    continue;
  }
  h = h.replace(from, to);
}

// Leftover presentation hex blues in page-local <style> only
const styleEnd = h.indexOf("</style>");
if (styleEnd > 0) {
  let head = h.slice(0, styleEnd);
  const tail = h.slice(styleEnd);
  const before = {
    b256: (head.match(/#2563eb/gi) || []).length,
    b3b: (head.match(/#3b82f6/gi) || []).length,
    b1d4: (head.match(/#1d4ed8/gi) || []).length,
    b1e40: (head.match(/#1e40af/gi) || []).length,
    amber: (head.match(/#fed7aa/gi) || []).length,
  };
  head = head.replace(/#2563eb/gi, "var(--sasv-action-primary)");
  head = head.replace(/#3b82f6/gi, "var(--sasv-action-primary)");
  head = head.replace(/#1d4ed8/gi, "var(--sasv-action-primary-active)");
  head = head.replace(/#1e40af/gi, "var(--sasv-action-primary-active)");
  h = head + tail;
  console.log("hex remap counts", before);
}

fs.writeFileSync(path, h);

const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
console.log(
  JSON.stringify(
    {
      body: body.replace(/\s+/g, " ").slice(0, 300),
      cssLink: h.includes("sasv-production-planning.css"),
      theme: /data-sasv-theme="sasv-core"/.test(h),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
      headerCopy: h.includes("ppw-header-copy"),
      steps: [
        "step-forecast-hierarchy",
        "step-net-sku-plan",
        "step-bulk-requirements",
        "step-netting",
        "step-wip",
        "step-normalizer",
      ].every((id) => h.includes(`id="${id}"`)),
      bluesLeft: (h.slice(0, h.indexOf("</style>")).match(/#2563eb|#3b82f6|#1d4ed8/gi) || [])
        .length,
      amberLeft: (h.slice(0, h.indexOf("</style>")).match(/#fed7aa/gi) || []).length,
    },
    null,
    2
  )
);
