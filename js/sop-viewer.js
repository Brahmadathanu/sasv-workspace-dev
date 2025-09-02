// js/sop-viewer.js
import { supabase } from "../public/shared/js/supabaseClient.js";
// For Electron/browser, use window.marked if loaded via <script> tag, else require if in Node
let marked = undefined;
if (typeof window !== "undefined" && window.marked) {
  marked = window.marked;
} else {
  try {
    marked = require("marked");
  } catch {
    marked = undefined;
  }
}

if (!marked || typeof marked.parse !== "function") {
  throw new Error(
    "Marked.js is not loaded. Please ensure 'marked' is installed via npm for Electron, or included via <script> for browser."
  );
}

// Helper: escape HTML special characters
function escapeHtml(s = "") {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// Helper: slugify string for anchors
function slug(s = "") {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/* ───────────────── DOM ───────────────── */
const $ = (id) => document.getElementById(id);
const homeBtn = $("homeBtn");
const exportBtn = $("exportBtn");
const exportMenu = $("exportMenu");

const elTitle = $("sopTitle");
const elBadges = $("badges");
const elMeta = $("metaCard");
const elBody = $("body");
const elAttWrap = $("attachments");
const elAttList = $("attList");

let META = null; // compiled meta for exports
let SECTIONS = []; // [{title, html, md, anchor}, ...]
let SERIES_MAP = null; // { "MF": "Manufacturing", ... }
let ATTACHMENTS = []; // for MD export (list of {name,url,mime})

/* ─────────────── Helpers ─────────────── */
const qp = (name) => new URL(location.href).searchParams.get(name);
const fmtDate = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return x.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};
const cap = (s) =>
  s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "—";
function mdToHtml(md = "") {
  return marked.parse(md);
}

// ...existing code...

// If a section's content accidentally starts with a top-level heading, demote it
function demoteLeadingHeading(md = "") {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return md;
  // Demote only the very first heading line if it is H1/H2
  if (/^#{1,2}\s+/.test(lines[i])) {
    lines[i] = "#" + lines[i]; // H1→H2, H2→H3
    return lines.join("\n");
  }
  return md;
}

// Minimal HTML→MD fallback (used only if a section lacks MD)
function htmlToMarkdownBasic(html = "") {
  if (!html) return "";

  let s = html;

  // line breaks
  s = s.replace(/<br\s*\/?>/gi, "  \n");

  // strong/emphasis
  s = s.replace(/<\/?strong>/gi, "**");
  s = s.replace(/<\/?b>/gi, "**");
  s = s.replace(/<\/?em>/gi, "*");
  s = s.replace(/<\/?i>/gi, "*");

  // links
  s = s.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // ordered lists → "1. item"
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    const items = inner.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
    return items
      .map(
        (li, idx) => `${idx + 1}. ${li.replace(/<\/?li[^>]*>/gi, "").trim()}`
      )
      .join("\n");
  });

  // unordered lists → "- item"
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const items = inner.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
    return items
      .map((li) => `- ${li.replace(/<\/?li[^>]*>/gi, "").trim()}`)
      .join("\n");
  });

  // paragraphs to blank-line separated blocks
  s = s.replace(/<\/p>\s*<p>/gi, "\n\n").replace(/<\/?p[^>]*>/gi, "");

  // strip residual tags
  s = s.replace(/<\/?[^>]+>/g, "");

  // tidy whitespace
  return s.replace(/\u00A0/g, " ").trim();
}

/* ────────── Supabase lookups ────────── */
async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) location.href = "login.html";
}

async function loadSeriesMap() {
  if (SERIES_MAP) return SERIES_MAP;
  const { data } = await supabase
    .from("sop_series")
    .select("code,name")
    .order("code");
  SERIES_MAP = {};
  (data || []).forEach((r) => (SERIES_MAP[r.code] = r.name || ""));
  return SERIES_MAP;
}

/* Core loaders */
/* ───────── v_sop_flat meta loader (new) ───────── */
/**
 * Load meta from v_sop_flat.
 * Accepts either a specific revision id (revId) or a sop id (sopId).
 * If the given revId is not present in the view (e.g. non-display rev),
 * we resolve its sop_id, then fetch the display row by sop_id.
 */
async function loadMetaFromFlat({ revId = null, sopId = null }) {
  // Try exact revision first
  if (revId) {
    const { data } = await supabase
      .from("v_sop_flat")
      .select(
        "sop_id, sop_number, title, series_code, revision_id, version, status, effective_date, " +
          "revision_updated_at, kind_id, kind_name, kind_code, " +
          "created_at, updated_at, created_by_name, updated_by_name"
      )
      .eq("revision_id", revId)
      .maybeSingle();

    if (data) {
      return {
        sop_id: data.sop_id,
        revision_id: data.revision_id,
        sop_number: data.sop_number,
        title: data.title || "Untitled SOP",
        version: data.version || "",
        status: data.status || "draft",
        effective_date: data.effective_date || null,
        created_at: data.created_at || null,
        updated_at: data.updated_at || data.revision_updated_at || null,
        series_code: data.series_code || "",
        kind_id: data.kind_id || null,
        kind_name: data.kind_name || "",
        kind_code: data.kind_code || "",
        created_by_name: data.created_by_name || "",
        updated_by_name: data.updated_by_name || "",
        // convenience for exports
        file_stem: (data.sop_number || "SOP").replace(/\s+/g, "_"),
      };
    }

    // Fallback: find sop_id from revision, then read view by sop_id
    const { data: rev } = await supabase
      .from("sop_revisions")
      .select("sop_id")
      .eq("id", revId)
      .maybeSingle();
    if (!rev?.sop_id) throw new Error("Revision not found in view.");
    sopId = rev.sop_id;
  }

  if (sopId) {
    const { data, error } = await supabase
      .from("v_sop_flat")
      .select(
        "sop_id, sop_number, title, series_code, revision_id, version, status, effective_date, " +
          "revision_updated_at, kind_id, kind_name, kind_code, " +
          "created_at, updated_at, created_by_name, updated_by_name"
      )
      .eq("sop_id", sopId)
      .maybeSingle();

    if (error || !data) throw new Error(error?.message || "SOP not found");
    return {
      sop_id: data.sop_id,
      revision_id: data.revision_id,
      sop_number: data.sop_number,
      title: data.title || "Untitled SOP",
      version: data.version || "",
      status: data.status || "draft",
      effective_date: data.effective_date || null,
      created_at: data.created_at || null,
      updated_at: data.updated_at || data.revision_updated_at || null,
      series_code: data.series_code || "",
      kind_id: data.kind_id || null,
      kind_name: data.kind_name || "",
      kind_code: data.kind_code || "",
      author: data.created_by_name || "",
      last_reviewer: data.updated_by_name || "",
      file_stem: (data.sop_number || "SOP").replace(/\s+/g, "_"),
    };
  }

  throw new Error("Missing rev or sop_id");
}

async function loadSections(revId) {
  const { data, error } = await supabase
    .from("sop_sections")
    .select("*")
    .eq("revision_id", revId);

  if (error) {
    console.error("loadSections error:", error);
    return [];
  }

  const sortKey = (row) =>
    row.position ?? row.order ?? row.order_index ?? row.seq ?? 999999;

  const rows = (data || []).slice().sort((a, b) => sortKey(a) - sortKey(b));

  return rows.map((row, idx) => {
    const title = row.title || `Section ${idx + 1}`;
    const anchor = slug(title) || `s${idx + 1}`;
    // Your column is "content" (markdown text)
    const md = row.content || "";
    return {
      title,
      anchor,
      md,
      html: mdToHtml(md),
      position: sortKey(row),
    };
  });
}

async function loadAttachments(revId) {
  // Don’t name columns; avoid server sort on maybe-missing names
  const { data, error } = await supabase
    .from("sop_attachments")
    .select("*")
    .eq("revision_id", revId);

  if (error) {
    console.error("loadAttachments error:", error);
    return [];
  }

  const pickName = (a) =>
    a.display_name || a.name || a.file_name || a.filename || "Attachment";

  const pickUrl = (a) => a.file_url || a.public_url || a.url || a.path || "#";

  const pickMime = (a) => a.mime_type || a.mimetype || a.content_type || "";

  return (data || [])
    .map((a) => ({ name: pickName(a), url: pickUrl(a), mime: pickMime(a) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ───────────── Rendering ───────────── */
function renderMeta(meta) {
  elTitle.textContent = meta.title;

  $("m_no").textContent = meta.sop_number || "—";
  $("m_ver").textContent = meta.version || "—";
  $("m_status").textContent = cap(meta.status);

  const seriesDisplay = meta.series_name
    ? `${meta.series_name} (${meta.series_code || ""})`
    : meta.series_code || "—";
  $("m_series").textContent = seriesDisplay;

  const kindDisplay =
    meta.kind_label ||
    (meta.kind_name
      ? meta.kind_code
        ? `${meta.kind_name} (${meta.kind_code})`
        : meta.kind_name
      : "—");
  $("m_kind").textContent = kindDisplay;

  $("m_eff").textContent = fmtDate(meta.effective_date);
  $("m_created").textContent = fmtDate(meta.created_at);
  $("m_updated").textContent = fmtDate(meta.updated_at);

  $("m_created_by").textContent = meta.created_by_name || "—";
  $("m_updated_by").textContent = meta.updated_by_name || "—";

  const cls =
    (meta.status || "").toLowerCase() === "active"
      ? "ok"
      : (meta.status || "").toLowerCase() === "obsolete"
      ? "danger"
      : "warn";

  elBadges.innerHTML = `
    <span class="badge primary">${escapeHtml(meta.sop_number || "")}</span>
    <span class="badge ${cls}">${escapeHtml(cap(meta.status))}</span>
    <span class="badge">Version ${escapeHtml(meta.version || "")}</span>
  `;

  elMeta.hidden = false;
}

function renderBody(sections) {
  elBody.innerHTML =
    sections
      .map(
        (s, i) => `
    <article class="section" id="${s.anchor}">
      <h2>${i + 1}. ${escapeHtml(s.title)}</h2>
      <div class="md">${s.html || ""}</div>
    </article>
  `
      )
      .join("") || "<p>No content.</p>";
}

function renderAttachments(list) {
  if (!list?.length) {
    elAttWrap.hidden = true;
    return;
  }
  elAttList.innerHTML = list
    .map(
      (a) =>
        `<li><a href="${
          a.url
        }" target="_blank" rel="noopener noreferrer">${escapeHtml(
          a.name
        )}</a></li>`
    )
    .join("");
  elAttWrap.hidden = false;
}

/* ─────────────── Exports ─────────────── */
// Build print-friendly HTML specifically for PDF export
function buildPdfHtml(meta, sections) {
  const title = meta?.title || meta?.sop_number || "SOP";
  const capStatus = (s) =>
    s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "—";
  const seriesLabel = meta?.series_name
    ? `${meta.series_name} (${meta.series_code || ""})`
    : meta?.series_code || "—";

  const activityLabel = meta?.kind_label || meta?.kind_name || "—";

  const metaTable = `
    <table class="meta-table">
      <tr>
        <td><strong>SOP No.</strong></td><td>${escapeHtml(
          meta?.sop_number || "—"
        )}</td>
        <td><strong>Status</strong></td><td>${escapeHtml(
          capStatus(meta?.status)
        )}</td>
      </tr>
      <tr>
        <td><strong>Version</strong></td><td>${escapeHtml(
          meta?.version || "—"
        )}</td>
        <td><strong>Series</strong></td><td>${escapeHtml(seriesLabel)}</td>
      </tr>
      <tr>
        <td><strong>Activity</strong></td><td>${escapeHtml(activityLabel)}</td>
        <td><strong>Effective from</strong></td><td>${escapeHtml(
          fmtDate(meta?.effective_date)
        )}</td>
      </tr>
      <tr>
        <td><strong>Created on</strong></td><td>${escapeHtml(
          fmtDate(meta?.created_at)
        )}</td>
        <td><strong>Created by</strong></td><td>${escapeHtml(
          meta?.author || meta?.created_by_name || "—"
        )}</td>
      </tr>
      <tr>
        <td><strong>Updated on</strong></td><td>${escapeHtml(
          fmtDate(meta?.updated_at)
        )}</td>
        <td><strong>Updated by</strong></td><td>${escapeHtml(
          meta?.updated_by_name || "—"
        )}</td>
      </tr>
    </table>
  `;

  const bodyHtml =
    (sections || [])
      .map(
        (s, i) => `
          <article class="section">
            <h2 class="sec-title">${i + 1}. ${escapeHtml(s.title)}</h2>
            <div class="sec-body">${s.html || ""}</div>
          </article>`
      )
      .join("") || "<p>No content.</p>";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
  /* ───────────────── Page & base type ───────────────── */
  @page { margin: 20mm 15mm; }
  body {
    font-family: Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    background: #fff;
    margin: 0;
  }

  /* Headings/code remain left-aligned */
  h1, h2, h3, h4, h5, h6,
  pre, code, table, th, td, blockquote { text-align: left !important; }

  /* Fully justify paragraph text (including list items) */
  p,
  .sec-body p,
  .section .md p,
  li {
    text-align: justify !important;
    text-justify: inter-word;
    hyphens: auto;
    overflow-wrap: anywhere;
    widows: 3;
    orphans: 3;
  }

  /* ───────────────── Title ───────────────── */
  h1 {
    font-size: 20pt;
    margin: 0 0 6mm 0;
    font-weight: 700;
  }

  /* ───────────────── Separators around meta ───────────────── */
  hr.meta-sep { border: none; border-top: 1px solid #ddd; margin: 4mm 0; }
  hr.before-body { border: none; border-top: 1px solid #ddd; margin: 6mm 0; }

  /* ───────────────── Meta table ───────────────── */
  .meta-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 2mm 0;
    font-size: 10pt;
    line-height: 1.5;
  }
  .meta-table td {
    padding: 3px 6px;
    vertical-align: top;
  }
  .meta-table td strong {
    display: inline-block;
    min-width: 34mm;
    color: #374151;
    white-space: nowrap;
    text-align: left !important;
  }

  /* ───────────────── Sections ───────────────── */
  /* Bold headings and avoid breaking from their content */
  .sec-title {
    font-size: 14pt;
    font-weight: 700;
    margin: 10pt 0 6pt;
    break-after: avoid-page;         /* do not break *after* the heading */
    page-break-after: avoid;
    break-before: avoid-page;        /* also avoid a new page *before* heading */
    page-break-before: avoid;
    text-align: left !important;
  }

  /* Try to keep each section together */
  .section {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Lists spacing */
  .sec-body ul, .sec-body ol {
    margin: 0.6em 0 0.6em 1.4em;
    padding-left: 1em;
  }

  /* Code styling */
  .sec-body code {
    background: #f3f4f6;
    padding: 0 3px;
    border-radius: 3px;
    font-family: Consolas, monospace;
  }
  .sec-body pre {
    background:#f3f4f6; color:#000;
    padding:10px; border-radius:6px;
    white-space: pre-wrap;
    text-align: left !important;     /* code blocks should not be justified */
  }

  a { color: #0645ad; text-decoration: underline; }
</style>
</head>
<body>
  <h1>${escapeHtml(meta?.title || title)}</h1>
  <hr class="meta-sep"/>
  ${metaTable}
  <hr class="before-body"/>
  ${bodyHtml}
</body>
</html>`;
}

function buildHtmlForExport(meta, sections) {
  const title = meta?.title || meta?.sop_number || "SOP";
  const status = String(meta?.status || "").toLowerCase();
  const statusCls =
    status === "active" ? "ok" : status === "obsolete" ? "danger" : "warn";

  const seriesLabel = meta?.series_name
    ? `${meta.series_name}${meta?.series_code ? ` (${meta.series_code})` : ""}`
    : meta?.series_code || "—";

  const kindLabel =
    meta?.kind_label ||
    (meta?.kind_name
      ? `${meta.kind_name}${meta?.kind_code ? ` (${meta.kind_code})` : ""}`
      : "—");

  const fmt = (d) => {
    if (!d) return "—";
    const x = new Date(d);
    return x.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const sectionsHtml =
    (sections || [])
      .map(
        (s, i) => `
        <article class="section" id="s${i + 1}">
          <h2 class="sec-title">${i + 1}. ${escapeHtml(
          s.title || `Section ${i + 1}`
        )}</h2>
          <div class="md-body">${s.html || ""}</div>
        </article>`
      )
      .join("") || `<p>No content.</p>`;

  return `
<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --panel: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --line: #e5e7eb;
      --bg: #f7f8fb;
    }

    html, body { margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      font-size: 16px;
    }

    .container {
      max-width: 980px;
      margin: 24px auto;
      padding: 0 16px;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 16px 0 12px;
    }
    header h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.2;
      font-weight: 700;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }

    /* badges row */
    .badges-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 8px 0 12px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid var(--line);
      background: #f9fafb;
      color: #111827;
    }
    .badge.primary { background: #0a62c3; color: #fff; border-color: #084c99; }
    .badge.ok { background: #d1f7c4; color: #2f6f1a; border-color: #a7ec91; }
    .badge.warn { background: #fff3cd; color: #9a6b00; border-color: #ffe08a; }
    .badge.danger { background: #f8d7da; color: #842029; border-color: #f1aeb5; }

    /* ===== Tighter, smarter meta layout to reduce wrapping ===== */
    .meta-card {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr)); /* no forced min width per column */
      gap: 8px 18px;                                    /* tighter gaps */
      line-height: 1.6;
      font-size: 14px;                                  /* slightly smaller to avoid wraps */
    }
    /* Each row becomes a tiny grid: label = max-content, value = remaining space */
    .meta-col > div {
      display: grid;
      grid-template-columns: max-content 1fr;
      column-gap: 8px;
      align-items: start;
      margin: 2px 0;
    }
    .meta-col strong {
      color: #374151;
      white-space: nowrap;       /* labels never wrap */
      font-weight: 600;
    }
    .meta-col span {
      min-width: 0;              /* allow shrinking */
      overflow-wrap: anywhere;   /* wrap long tokens early (codes/URLs) */
    }

    .meta-sep {
      border: none;
      border-top: 1px solid var(--line);
      margin: 10px 0 6px;
    }

    /* sections mirror viewer */
    .section { margin: 16px 0 12px; }
    .sec-title { font-size: 18px; font-weight: 700; margin: 10px 0 6px; }
    .md-body { line-height: 1.55; }
    .md-body h1, .md-body h2, .md-body h3 { margin: 1em 0 0.4em; }
    .md-body p { margin: 0.6em 0; }
    .md-body ul, .md-body ol { margin: 0.6em 0 0.6em 1.4em; }
    .md-body code { padding: 0 4px; border-radius: 4px; background: #f3f4f6; }
    .md-body pre { padding: 10px; border-radius: 6px; background: #111827; color: #f3f4f6; overflow: auto; }
    .md-body a { text-decoration: underline; color: #0645ad; }

    /* Collapse meta to fewer columns when needed */
    @media (max-width: 900px) {
      .meta-card { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 620px) {
      .meta-card { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(title)}</h1>
    </header>

    <div class="badges-row">
      <span class="badge primary">${escapeHtml(meta?.sop_number || "")}</span>
      <span class="badge ${statusCls}">${escapeHtml(status || "draft")}</span>
      <span class="badge">Version ${escapeHtml(meta?.version || "")}</span>
    </div>

    <section class="panel">
      <div class="meta-card">
        <!-- Identity -->
        <div class="meta-col">
          <div><strong>SOP No.</strong><span>${escapeHtml(
            meta?.sop_number || "—"
          )}</span></div>
          <div><strong>Version</strong><span>${escapeHtml(
            meta?.version || "—"
          )}</span></div>
          <div><strong>Status</strong><span>${escapeHtml(
            status || "—"
          )}</span></div>
        </div>

        <!-- Classification / dates -->
        <div class="meta-col">
          <div><strong>Series</strong><span>${escapeHtml(
            seriesLabel
          )}</span></div>
          <div><strong>Activity</strong><span>${escapeHtml(
            kindLabel
          )}</span></div>
          <div><strong>Effective from</strong><span>${escapeHtml(
            fmt(meta?.effective_date)
          )}</span></div>
        </div>

        <!-- People (Created/Updated) -->
        <div class="meta-col">
          <div><strong>Created on</strong><span>${escapeHtml(
            fmt(meta?.created_at)
          )}</span></div>
          <div><strong>Created by</strong><span>${escapeHtml(
            meta?.created_by_name || "—"
          )}</span></div>
          <div><strong>Updated on</strong><span>${escapeHtml(
            fmt(meta?.updated_at)
          )}</span></div>
          <div><strong>Updated by</strong><span>${escapeHtml(
            meta?.updated_by_name || "—"
          )}</span></div>
        </div>
      </div>

      <hr class="meta-sep"/>

      ${sectionsHtml}
    </section>
  </div>
</body>
</html>`;
}

function buildDocxHtml(meta, sections, attachments = []) {
  const cap = (s) =>
    s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "—";
  const iso = (d) => {
    if (!d) return "—";
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? "—" : x.toISOString().slice(0, 10);
  };
  const series = meta?.series_name
    ? `${meta.series_name}${meta?.series_code ? ` (${meta.series_code})` : ""}`
    : meta?.series_code || "—";
  const activity =
    meta?.kind_label ||
    (meta?.kind_name
      ? `${meta.kind_name}${meta?.kind_code ? ` (${meta.kind_code})` : ""}`
      : "—");

  const metaTable = `
    <table class="meta-table">
      <tr>
        <td class="label"><strong>SOP No.</strong></td><td>${escapeHtml(
          meta?.sop_number || "—"
        )}</td>
        <td class="label"><strong>Status</strong></td><td>${escapeHtml(
          cap(meta?.status || "")
        )}</td>
      </tr>
      <tr>
        <td class="label"><strong>Version</strong></td><td>${escapeHtml(
          meta?.version || "—"
        )}</td>
        <td class="label"><strong>Series</strong></td><td>${escapeHtml(
          series
        )}</td>
      </tr>
      <tr>
        <td class="label"><strong>Activity</strong></td><td>${escapeHtml(
          activity
        )}</td>
        <td class="label"><strong>Effective from</strong></td><td>${escapeHtml(
          iso(meta?.effective_date)
        )}</td>
      </tr>
      <tr>
        <td class="label"><strong>Created</strong></td>
        <td>${escapeHtml(iso(meta?.created_at))} by ${escapeHtml(
    meta?.created_by_name || "—"
  )}</td>
        <td class="label"><strong>Updated</strong></td>
        <td>${escapeHtml(iso(meta?.updated_at))} by ${escapeHtml(
    meta?.updated_by_name || "—"
  )}</td>
      </tr>
    </table>`;

  const body = (sections || [])
    .map(
      (s, i) => `
    <div class="section">
      <h2 class="sec-title">${i + 1}. ${escapeHtml(
        s.title || `Section ${i + 1}`
      )}</h2>
      <div class="sec-body">${s.html || ""}</div>
    </div>`
    )
    .join("");

  const attHtml =
    attachments && attachments.length
      ? `<h2 class="sec-title">Attachments</h2>
       <ul class="sec-body">${attachments
         .map(
           (a) =>
             `<li><a href="${a.url || a.file_url || "#"}">${escapeHtml(
               a.name || a.display_name || a.file_name || "Attachment"
             )}</a></li>`
         )
         .join("")}</ul>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(meta?.title || meta?.sop_number || "SOP")}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #000; margin: 20mm 15mm; text-align: left; }
    h1 { font-size: 20pt; margin: 0 0 6mm 0; font-weight: 700; text-align: left; }
    hr.sep { border: none; border-top: 1px solid #ddd; margin: 6mm 0; }
    .meta-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10pt; margin: 0 0 4mm 0; }
    .meta-table td { padding: 3px 6px; vertical-align: top; }
    .meta-table td.label { width: 34mm; white-space: nowrap; color: #374151; }
    .section { page-break-inside: avoid; break-inside: avoid; }
    .sec-title { font-size: 14pt; font-weight: 700; margin: 10pt 0 6pt; page-break-after: avoid; break-after: avoid; text-align: left; }
    .sec-body { text-align: justify; }
    .sec-body p { text-align: justify; }
    .sec-body ul, .sec-body ol { margin: 0.6em 0 0.6em 1.4em; padding-left: 1em; }
    code { background: #f3f4f6; padding: 0 3px; border-radius: 3px; font-family: Consolas, monospace; }
    pre  { background:#f3f4f6; color:#000; padding:10px; border-radius:6px; white-space: pre-wrap; text-align: left; }
    a { color: #0645ad; text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${escapeHtml(meta?.title || "")}</h1>
  <hr class="sep"/>
  ${metaTable}
  <hr class="sep"/>
  ${body || "<p>No content.</p>"}
  ${attHtml}
</body>
</html>`;
}

function buildMarkdownForExport(meta, sections, attachments = []) {
  const toISO = (d) => {
    if (!d) return "";
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10);
  };
  const yamlEsc = (v) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '\\"')}"`;
  };
  const cap = (s) =>
    s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "";

  // Friendly labels (already computed in your META usually)
  const series = meta?.series_name
    ? `${meta.series_name}${meta?.series_code ? ` (${meta.series_code})` : ""}`
    : meta?.series_code || "";
  const activity =
    meta?.kind_label ||
    (meta?.kind_name
      ? `${meta.kind_name}${meta?.kind_code ? ` (${meta.kind_code})` : ""}`
      : "");

  // ---------- YAML FRONT MATTER ----------
  const yaml = [
    "---",
    `sop_id: ${yamlEsc(meta?.sop_id || "")}`,
    `revision_id: ${yamlEsc(meta?.rev_id || meta?.revision_id || "")}`,
    `sop_number: ${yamlEsc(meta?.sop_number || "")}`,
    `title: ${yamlEsc(meta?.title || "")}`,
    `status: ${yamlEsc((meta?.status || "").toLowerCase())}`,
    `version: ${yamlEsc(meta?.version || "")}`,
    `series_code: ${yamlEsc(meta?.series_code || "")}`,
    `series_name: ${yamlEsc(meta?.series_name || "")}`,
    `activity_name: ${yamlEsc(meta?.kind_name || "")}`,
    `activity_code: ${yamlEsc(meta?.kind_code || "")}`,
    `effective_date: ${yamlEsc(toISO(meta?.effective_date))}`,
    `created_at: ${yamlEsc(toISO(meta?.created_at))}`,
    `created_by: ${yamlEsc(meta?.created_by_name || "")}`,
    `updated_at: ${yamlEsc(toISO(meta?.updated_at))}`,
    `updated_by: ${yamlEsc(meta?.updated_by_name || "")}`,
    `source_url: ${yamlEsc(
      typeof window !== "undefined" ? window.location.href : ""
    )}`,
    `exported_at: ${yamlEsc(new Date().toISOString())}`,
    "---",
    "",
  ].join("\n");

  // ---------- H1 ----------
  const title = meta?.title || meta?.sop_number || "SOP";
  let out = `# ${title}\n\n`;

  // ---------- Small meta summary (optional, compact & readable) ----------
  out +=
    [
      `**SOP No.**: ${meta?.sop_number || "—"}  `,
      `**Version**: ${meta?.version || "—"}  `,
      `**Status**: ${cap(meta?.status || "") || "—"}  `,
      `**Series**: ${series || "—"}  `,
      `**Activity**: ${activity || "—"}  `,
      `**Effective from**: ${toISO(meta?.effective_date) || "—"}  `,
      `**Created**: ${toISO(meta?.created_at) || "—"} by ${
        meta?.created_by_name || "—"
      }  `,
      `**Updated**: ${toISO(meta?.updated_at) || "—"} by ${
        meta?.updated_by_name || "—"
      }`,
    ].join("\n") + "\n\n";

  // ---------- TOC ----------
  if (sections?.length > 1) {
    out += "## Table of Contents\n\n";
    sections.forEach((s, i) => {
      const headingText = `${i + 1}. ${s.title || `Section ${i + 1}`}`;
      const anchor = slug(headingText); // uses your existing slug helper
      out += `- [${headingText}](#${anchor})\n`;
    });
    out += "\n";
  }

  // ---------- Sections ----------
  sections.forEach((s, i) => {
    const headingText = `${i + 1}. ${s.title || `Section ${i + 1}`}`;
    out += `## ${headingText}\n\n`;

    // Prefer original Markdown, else convert basic HTML → MD
    let body =
      s.md && s.md.trim() ? s.md.trim() : htmlToMarkdownBasic(s.html || "");

    // Avoid a duplicate H1/H2 if someone inserted it inside the section content
    body = demoteLeadingHeading(body);

    out += body ? `${body}\n\n` : "\n";
  });

  // ---------- Attachments (optional) ----------
  if (attachments && attachments.length) {
    out += "## Attachments\n\n";
    attachments.forEach((a) => {
      const name = a.name || a.display_name || a.file_name || "Attachment";
      const url = a.url || a.file_url || "#";
      out += `- [${name}](${url})\n`;
    });
    out += "\n";
  }

  return yaml + out.trim() + "\n";
}

/* download helpers */
function dlText(name, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function dlHtml(name, html) {
  dlText(name, html, "text/html;charset=utf-8");
}

/* Exports handler */
async function handleExport(kind) {
  if (!META) return;

  if (kind === "md") {
    const md = buildMarkdownForExport(META, SECTIONS, ATTACHMENTS || []);
    dlText(`${META.file_stem}.md`, md);
    return;
  }

  if (kind === "html") {
    const html = buildHtmlForExport(META, SECTIONS);
    dlHtml(`${META.file_stem}.html`, html);
    return;
  }

  if (kind === "pdf") {
    const html = buildPdfHtml(META, SECTIONS);

    // Running header/footer for Chromium print-to-PDF
    const headerLeft = escapeHtml(META?.sop_number || "");
    const headerRight = escapeHtml(META?.title || META?.file_stem || "SOP");

    const headerTemplate = `
    <div style="font-size:10px;width:100%;padding:0 10mm;
                display:flex;justify-content:space-between;
                color:#6b7280;font-family:Arial,sans-serif;">
      <span>${headerLeft}</span>
      <span>${headerRight}</span>
    </div>`;

    const footerTemplate = `
    <div style="font-size:10px;width:100%;padding:0 10mm;
                display:flex;justify-content:space-between;
                color:#6b7280;font-family:Arial,sans-serif;">
      <span>Printed ${escapeHtml(new Date().toLocaleDateString("en-GB"))}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`;

    if (window.sopAPI?.exportPdfFromHtml) {
      const res = await window.sopAPI.exportPdfFromHtml(META.file_stem, html, {
        pageSize: "A4",
        landscape: false,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        fileStem: META.sop_number || META.file_stem || "SOP",
        meta: META,
        margin: { top: "25mm", bottom: "20mm", left: "15mm", right: "15mm" },
      });
      if (res?.ok && res.pdfBase64) {
        const bin = atob(res.pdfBase64);
        const bytes = new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.suggestedName || `${META.file_stem}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        alert(res?.error || "PDF export failed.");
      }
    } else {
      // Fallback: open the HTML and let user print to PDF
      const w = window.open("", "_blank");
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
    return;
  }

  if (kind === "docx") {
    // Prefer SOP number for the filename
    const fileStem =
      (META?.sop_number && String(META.sop_number)) ||
      (META?.file_stem && String(META.file_stem)) ||
      (META?.title && String(META.title)) ||
      "SOP";

    // Build Word-friendly HTML (your builder)
    const html = buildDocxHtml(META, SECTIONS, ATTACHMENTS);

    // Use the HTML→DOCX bridge if available
    if (window.sopAPI?.exportDocxFromHtml) {
      try {
        const res = await window.sopAPI.exportDocxFromHtml(
          fileStem, // <-- pass our stem so main uses it for suggestedName
          html,
          {
            // You can pass extras if your main.js supports them later:
            // headerLeft: META?.sop_number || "",
            // headerRight: META?.title || "",
            // footerCenter: "Page {PAGE} of {PAGES}",
          }
        );

        if (res?.ok && res.docxBase64) {
          const bin = atob(res.docxBase64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

          const blob = new Blob([bytes], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;

          // Force SOP-based filename even if main returns a different suggestion
          a.download =
            (res.suggestedName && String(res.suggestedName)) ||
            `${fileStem.replace(/[\\/:*?"<>|]+/g, "_")}.docx`;

          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } else {
          alert(res?.error || "DOCX export failed.");
        }
      } catch (err) {
        console.error("[DOCX] export error:", err);
        alert("DOCX export failed.");
      }
      return;
    }

    // Strict fallback: provide Word-friendly HTML instead of raw Markdown
    const safeStem = fileStem.replace(/[\\/:*?"<>|]+/g, "_");
    dlHtml(`${safeStem}.html`, html);
    alert(
      "DOCX export bridge not available. Saved Word-friendly HTML instead."
    );
    return;
  }
}

/* ───────────── Events ───────────── */
homeBtn?.addEventListener("click", () => (location.href = "index.html"));

if (exportBtn && exportMenu) {
  const open = (v) => (exportMenu.hidden = !v),
    isOpen = () => !exportMenu.hidden;
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    open(!isOpen());
    exportBtn.setAttribute("aria-expanded", String(isOpen()));
  });
  document.addEventListener("click", () => {
    if (isOpen()) open(false);
    exportBtn.setAttribute("aria-expanded", "false");
  });
  exportMenu.addEventListener("click", (e) => e.stopPropagation());
  exportMenu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-export]");
    if (!btn) return;
    open(false);
    exportBtn.setAttribute("aria-expanded", "false");
    await handleExport(btn.dataset.export);
  });
}

/* ───────────── Init ───────────── */
(async function init() {
  await ensureSession();

  const revIdParam = qp("rev");
  const sopIdParam = qp("sop_id");

  if (!revIdParam && !sopIdParam) {
    elTitle.textContent = "Missing revision id or sop_id.";
    elBody.innerHTML = "<p>No identifier provided.</p>";
    return;
  }

  try {
    // 1) Meta from flat view (handles rev->sop fallback internally)
    const meta = await loadMetaFromFlat({
      revId: revIdParam,
      sopId: sopIdParam,
    });

    // 2) Enrich meta with series_name and kind_label for display/export
    const seriesMap = await loadSeriesMap();
    meta.series_name = seriesMap?.[meta.series_code] || "";
    meta.kind_label = meta.kind_name
      ? meta.kind_code
        ? `${meta.kind_name} (${meta.kind_code})`
        : meta.kind_name
      : "";

    // (file_stem is already set in loadMetaFromFlat; keep it)
    META = meta;

    // 3) Sections + attachments for the resolved revision
    const revIdForBody = meta.revision_id;
    const [sections, atts] = await Promise.all([
      loadSections(revIdForBody),
      loadAttachments(revIdForBody),
    ]);
    SECTIONS = sections;
    ATTACHMENTS = atts;

    // 4) Render
    renderMeta(meta);
    renderBody(sections);
    renderAttachments(atts);
  } catch (err) {
    console.error(err);
    elTitle.textContent = "Failed to load SOP.";
    elBody.innerHTML = `<p style="color:#7f1d1d">${escapeHtml(
      err.message || ""
    )}</p>`;
  }
})();
