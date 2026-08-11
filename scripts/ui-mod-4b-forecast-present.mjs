/**
 * UI-MOD-4B — Forecast Console pilot presentation migration.
 * Presentation only. Does not alter lens keys, IDs, or RPC contracts.
 */
import fs from "fs";

const path = "public/shared/forecast-console.html";
let h = fs.readFileSync(path, "utf8");

if (!h.includes('data-sasv-theme="sasv-core"')) {
  h = h.replace(/<html([^>]*)>/i, '<html lang="en" data-sasv-theme="sasv-core">');
}

if (!h.includes("sasv-forecast.css")) {
  h = h.replace(
    /(<link\s+rel="stylesheet"\s+href="css\/style\.css"\s*\/>)/i,
    `$1\n    <link rel="stylesheet" href="css/sasv-forecast.css" />`
  );
}

h = h.replace(/<body([^>]*)>/i, (full, attrs) => {
  let a = attrs;
  if (/class="/i.test(a)) {
    a = a.replace(/class="([^"]*)"/i, (m, cls) => {
      const parts = new Set(cls.split(/\s+/).filter(Boolean));
      parts.add("sasv-module");
      parts.add("sasv-module--app");
      parts.add("sasv-forecast-console");
      return `class="${[...parts].join(" ")}"`;
    });
  } else {
    a = ` class="sasv-module sasv-module--app sasv-forecast-console"${a}`;
  }
  return `<body${a}>`;
});

// Empty HOME for canonical chrome mount (handler remains capture-phase on #homeBtn)
h = h.replace(
  /<button\s+id="homeBtn"[\s\S]*?<\/button>/i,
  `<button id="homeBtn" type="button" class="icon-btn sasv-home-btn" title="HOME" aria-label="HOME"></button>`
);

const blocks = [
  [
    `        font-family:
          system-ui,
          Segoe UI,
          Roboto,
          Arial,
          sans-serif;
      }`,
    `        /* Inter via style.css / sasv-fonts */
      }`,
  ],
  [
    `.page-header h1 {
        margin: 0;
        color: var(--primary, #2563eb);
        font-size: clamp(1.1rem, 3vw, 1.6rem);
        line-height: 1.2;
      }`,
    `.page-header h1 {
        margin: 0;
        color: var(--sasv-text, var(--text, #0f172a));
        font-size: clamp(1.1rem, 3vw, 1.6rem);
        line-height: 1.2;
        font-weight: var(--sasv-fw-semibold, 600);
      }`,
  ],
  [
    `#homeBtn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 7px 11px;
        border: 1px solid #fdba74 !important;
        border-radius: 6px;
        background: #fed7aa !important;
        color: #9a3412 !important;
        cursor: pointer;
        font-size: 0.82rem;
        font-weight: 600;
        transition: all 0.18s ease;
      }
      #homeBtn svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }
      #homeBtn:hover {
        background: #fdba74 !important;
        border-color: #fb923c !important;
        transform: translateY(-1px);
      }`,
    `/* HOME chrome: canonical body.sasv-module #homeBtn.sasv-home-btn */`,
  ],
  [
    `.kpi.kpi-pairs {
        border-left: 4px solid #2563eb;
        background: linear-gradient(
          135deg,
          rgba(37, 99, 235, 0.06),
          rgba(37, 99, 235, 0.02)
        );
      }
      .kpi.kpi-rows {
        border-left: 4px solid #0ea5e9;
        background: linear-gradient(
          135deg,
          rgba(14, 165, 233, 0.06),
          rgba(14, 165, 233, 0.02)
        );
      }
      .kpi.kpi-cov {
        border-left: 4px solid #16a34a;
        background: linear-gradient(
          135deg,
          rgba(22, 163, 74, 0.07),
          rgba(22, 163, 74, 0.02)
        );
      }
      .kpi.kpi-llt {
        border-left: 4px solid #f59e0b;
        background: linear-gradient(
          135deg,
          rgba(245, 158, 11, 0.07),
          rgba(245, 158, 11, 0.02)
        );
        cursor: pointer;
      }
      .kpi.kpi-seas {
        border-left: 4px solid #ef4444;
        background: linear-gradient(
          135deg,
          rgba(239, 68, 68, 0.07),
          rgba(239, 68, 68, 0.02)
        );
        cursor: pointer;
      }
      .kpi.kpi-ov {
        border-left: 4px solid #7c3aed;
        background: linear-gradient(
          135deg,
          rgba(124, 58, 237, 0.07),
          rgba(124, 58, 237, 0.02)
        );
      }`,
    `.kpi.kpi-pairs {
        border-left: 4px solid var(--sasv-action-primary);
        background: var(--sasv-action-primary-soft);
      }
      .kpi.kpi-rows {
        border-left: 4px solid var(--sasv-info);
        background: var(--sasv-info-bg);
      }
      .kpi.kpi-cov {
        border-left: 4px solid var(--sasv-success);
        background: var(--sasv-success-bg);
      }
      .kpi.kpi-llt {
        border-left: 4px solid var(--sasv-warning);
        background: var(--sasv-warning-bg);
        cursor: pointer;
      }
      .kpi.kpi-seas {
        border-left: 4px solid var(--sasv-danger);
        background: var(--sasv-danger-bg);
        cursor: pointer;
      }
      .kpi.kpi-ov {
        border-left: 4px solid var(--sasv-info);
        background: var(--sasv-info-bg);
      }`,
  ],
  [
    `.tabs-card {
        background: linear-gradient(
          135deg,
          rgba(37, 99, 235, 0.05) 0%,
          rgba(37, 99, 235, 0.02) 100%
        );
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 10px;
        padding: 6px 8px;
        flex-shrink: 0;
        margin-bottom: 6px;
      }`,
    `.tabs-card {
        background: var(--sasv-surface, var(--panel-bg, #fff));
        border: 1px solid var(--sasv-border, var(--border, #e5e7eb));
        border-radius: var(--sasv-radius-md, 10px);
        padding: 6px 8px;
        flex-shrink: 0;
        margin-bottom: 6px;
      }`,
  ],
  [
    `.lens-pills .pill:hover {
        color: #0f172a;
        background: rgba(37, 99, 235, 0.05);
        border-color: rgba(37, 99, 235, 0.12);
      }
      .lens-pills .pill:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }
      .lens-pills .pill.active {
        color: #fff;
        background: var(--primary, #2563eb);
        border-color: var(--primary, #2563eb);
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.22);
      }`,
    `.lens-pills .pill:hover {
        color: var(--sasv-text, #0f172a);
        background: var(--sasv-action-primary-soft);
        border-color: var(--sasv-action-primary-soft-border);
      }
      .lens-pills .pill:focus {
        outline: none;
      }
      .lens-pills .pill:focus-visible {
        outline: 3px solid var(--sasv-focus-ring);
        outline-offset: 2px;
      }
      .lens-pills .pill.active {
        color: var(--sasv-action-primary-active);
        background: var(--sasv-selection-soft);
        border-color: var(--sasv-action-primary-soft-border);
        box-shadow: none;
      }`,
  ],
  [
    `.tab-select {
        width: 100%;
        padding: 8px 40px 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--primary, #2563eb);
        background: linear-gradient(
          135deg,
          rgba(37, 99, 235, 0.12),
          rgba(37, 99, 235, 0.06)
        );
        color: #0f172a;
        font-weight: 600;
        font-size: 14px;
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
      }
      .tab-select-icon {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 18px;
        height: 18px;
        pointer-events: none;
        color: var(--primary, #2563eb);
      }`,
    `.tab-select {
        width: 100%;
        padding: 8px 40px 8px 10px;
        border-radius: var(--sasv-radius-sm, 8px);
        border: 1px solid var(--sasv-control-border-focus, var(--sasv-action-primary));
        background: var(--sasv-action-primary-soft);
        color: var(--sasv-text, #0f172a);
        font-weight: 600;
        font-size: 14px;
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
      }
      .tab-select-icon {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
        height: 16px;
        pointer-events: none;
        color: var(--sasv-action-primary-active);
      }`,
  ],
  [
    `      tbody tr:hover {
        background: rgba(37, 99, 235, 0.06);
      }`,
    `      tbody tr:hover {
        background: var(--sasv-action-primary-soft);
      }`,
  ],
  [
    `.ok {
        color: #0f7a44;
      }
      .warn {
        color: #c2410c;
      }`,
    `.ok {
        color: var(--sasv-success);
      }
      .warn {
        color: var(--sasv-warning);
      }`,
  ],
  [
    `.chip.ok {
        background: #16a34a;
      }
      .chip.warn {
        background: #f59e0b;
      }
      .chip.err {
        background: #ef4444;
      }
      .chip.gray {
        background: #6b7280;
      }`,
    `.chip.ok {
        background: var(--sasv-success);
      }
      .chip.warn {
        background: var(--sasv-warning);
      }
      .chip.err {
        background: var(--sasv-danger);
      }
      .chip.gray {
        background: var(--sasv-text-muted, #6b7280);
      }`,
  ],
  [
    `#toast {
        position: fixed;
        right: 16px;
        bottom: 16px;
        background: #111;
        color: #fff;
        padding: 10px 14px;
        border-radius: 8px;
        display: none;
        z-index: 9999;
      }`,
    `/* Local #toast retained in DOM for compat; canonical toast.js used at runtime */
      #toast {
        display: none !important;
      }`,
  ],
];

for (const [from, to] of blocks) {
  if (!h.includes(from)) {
    console.warn("MISSING block:\n", from.slice(0, 90));
    continue;
  }
  h = h.replace(from, to);
}

// Leftover hex blues in page-local <style> only (not style.css; not rgba blind-replace)
const styleEnd = h.indexOf("</style>");
if (styleEnd > 0) {
  let head = h.slice(0, styleEnd);
  const tail = h.slice(styleEnd);
  const before256 = (head.match(/#2563eb/gi) || []).length;
  const before1d4 = (head.match(/#1d4ed8/gi) || []).length;
  const leftRgba = (head.match(/rgba\(\s*37,\s*99,\s*235/g) || []).length;
  head = head.replace(/#2563eb/gi, "var(--sasv-action-primary)");
  head = head.replace(/#1d4ed8/gi, "var(--sasv-action-primary-active)");
  h = head + tail;
  console.log("style hex blues remapped", { before256, before1d4, leftRgba });
}

fs.writeFileSync(path, h);
const body = (h.match(/<body[\s\S]*?>/) || [""])[0];
console.log(
  JSON.stringify(
    {
      body: body.replace(/\s+/g, " ").slice(0, 280),
      forecastCss: h.includes("sasv-forecast.css"),
      theme: /data-sasv-theme="sasv-core"/.test(h),
      homeEmpty: /id="homeBtn"[^>]*>\s*<\/button>/.test(h),
      bluesInPageStyle: (
        (h.slice(0, h.indexOf("</style>")).match(/#2563eb/gi) || []).length
      ),
    },
    null,
    2
  )
);
