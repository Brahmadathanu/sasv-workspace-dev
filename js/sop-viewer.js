// js/sop-viewer.js
import { supabase } from "../public/shared/js/supabaseClient.js";

/* ---------- DOM ---------- */
const homeBtn = document.getElementById("homeBtn");
const pageTitle = document.getElementById("pageTitle");
const exportMenuBtn = document.getElementById("exportMenuBtn");
const exportMenu = document.getElementById("exportMenu");
const elDesc = document.getElementById("descBox");

let _meta = null;
let _md = "";

// ── SOP Type helper (DB-backed) ────────────────────────────────────────────
let TYPES = null; // { MF: "Manufacturing", QA: "Quality Assurance", ... }

async function loadTypesMap() {
  if (TYPES) return TYPES;
  const { data, error } = await supabase
    .from("sop_types")
    .select("code, type_name");
  TYPES = {};
  if (!error && Array.isArray(data)) {
    for (const row of data) {
      if (row?.code) TYPES[row.code] = row.type_name || "";
    }
  }
  return TYPES;
}

// Build "Type Name (CODE)" if we know the name; else show just the code
function typeLabel(meta) {
  const code = meta?.type_code || "";
  const name = meta?.type_name || (TYPES && TYPES[code]) || "";
  if (!code && !name) return "—";
  return name ? `${name} (${code})` : code;
}

/* ---------- Nav ---------- */
if (homeBtn) {
  homeBtn.addEventListener(
    "click",
    () => (window.location.href = "index.html")
  );
}

/* ───────── Export menu (PDF / DOCX / HTML / MD) ───────── */
if (exportMenuBtn && exportMenu) {
  const setMenuOpen = (open) => {
    exportMenu.hidden = !open;
    exportMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      const first =
        exportMenu.querySelector('button[role="menuitem"]') ||
        exportMenu.querySelector("button[data-export]");
      first?.focus();
    }
  };

  // toggle menu open/closed
  exportMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenuOpen(exportMenu.hidden); // invert
  });

  // open with ArrowDown
  exportMenuBtn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && exportMenu.hidden) {
      e.preventDefault();
      setMenuOpen(true);
    }
  });

  // close when clicking outside
  document.addEventListener("click", () => {
    if (!exportMenu.hidden) setMenuOpen(false);
  });
  exportMenu.addEventListener("click", (e) => e.stopPropagation());

  // close on Escape while menu focused
  exportMenu.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !exportMenu.hidden) {
      e.preventDefault();
      setMenuOpen(false);
      exportMenuBtn.focus();
    }
  });

  // route clicks by data-export value
  exportMenu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-export]");
    if (!btn) return;
    const kind = btn.getAttribute("data-export");
    setMenuOpen(false);

    try {
      const fileStem = _meta?.sop_number || "SOP"; // filenames
      const displayTitle = _meta?.title || fileStem; // human title/header

      // small helpers for MD metadata
      const cap = (s) =>
        s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "";
      const toISO = (d) => {
        if (!d) return "";
        const dt = new Date(d);
        return isNaN(dt) ? "" : dt.toISOString().slice(0, 10); // YYYY-MM-DD
      };
      const yamlEsc = (v) => {
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '\\"')}"`;
      };
      const typeLabelStr = typeLabel(_meta || {}); // e.g. "Manufacturing (MF)"

      if (kind === "md") {
        // Add YAML front matter with SOP metadata, then cleaned body (no duplicate H1)
        const cleanedMd = stripLeadingH1(_md || "", displayTitle);
        const yaml = [
          "---",
          `sop_number: ${yamlEsc(_meta?.sop_number || "")}`,
          `title: ${yamlEsc(displayTitle)}`,
          `version: ${yamlEsc(_meta?.version || "")}`,
          `status: ${yamlEsc(cap(_meta?.status || ""))}`,
          `type: ${yamlEsc(typeLabelStr)}`,
          `type_code: ${yamlEsc(_meta?.type_code || "")}`,
          `type_name: ${yamlEsc(_meta?.type_name || "")}`,
          `kind: ${yamlEsc(_meta?.kind_name || "")}`,
          `kind_code: ${yamlEsc(_meta?.kind_code || "")}`,
          `author: ${yamlEsc(_meta?.author || "")}`,
          `last_reviewer: ${yamlEsc(_meta?.last_reviewer || "")}`,
          `created_on: ${yamlEsc(toISO(_meta?.created_at))}`,
          `last_updated_on: ${yamlEsc(toISO(_meta?.updated_at))}`,
          `source_url: ${yamlEsc(window.location.href || "")}`,
          `exported_at: ${yamlEsc(new Date().toISOString())}`,
          "---",
          "",
        ].join("\n");
        downloadText(`${fileStem}.md`, yaml + (cleanedMd || ""));
        if (typeof flash === "function") flash("Markdown downloaded");
        return;
      }

      // Reuse cleaned markdown & rendered HTML across non-MD branches
      const cleanedMd = stripLeadingH1(_md || "", displayTitle);
      const bodyHtml = renderMarkdown(cleanedMd);

      if (kind === "pdf") {
        const html = buildPdfHtml(displayTitle, bodyHtml, _meta || {});

        // Running header/footer with page numbers
        const headerLeft = escapeHtml(_meta?.sop_number || "");
        const headerRight = escapeHtml(displayTitle);
        const headerTemplate = `
    <div style="font-size:10px; width:100%; padding:0 10mm;
                display:flex; justify-content:space-between;
                color:#6b7280; font-family:Arial,sans-serif;">
      <span>${headerLeft}</span><span>${headerRight}</span>
    </div>`;
        const footerTemplate = `
    <div style="font-size:10px; width:100%; padding:0 10mm;
                display:flex; justify-content:flex-end;
                color:#6b7280; font-family:Arial,sans-serif;">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>`;

        if (!window.sopAPI?.exportPdfFromHtml) {
          if (typeof flash === "function") flash("PDF export not available");
          return;
        }
        const res = await window.sopAPI.exportPdfFromHtml(fileStem, html, {
          pageSize: "A4",
          landscape: false,
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate,
          footerTemplate,
        });
        if (res?.ok && res.pdfBase64) {
          downloadBase64(
            res.suggestedName || `${fileStem}.pdf`,
            res.pdfBase64,
            "application/pdf"
          );
          if (typeof flash === "function") flash("PDF downloaded");
        } else {
          if (typeof flash === "function")
            flash(res?.error || "PDF export failed");
        }
        return;
      }

      if (kind === "docx") {
        if (!window.sopAPI?.exportDocxNative) {
          if (typeof flash === "function") flash("DOCX export not available");
          return;
        }
        const cleanedMdForDocx = stripLeadingH1(_md || "", displayTitle);
        const res = await window.sopAPI.exportDocxNative(
          displayTitle,
          _meta || {},
          cleanedMdForDocx
        );
        if (res?.ok && res.docxBase64) {
          downloadBase64(
            res.suggestedName || `${fileStem}.docx`,
            res.docxBase64,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          );
          if (typeof flash === "function") flash("DOCX downloaded");
        } else {
          if (typeof flash === "function")
            flash(res?.error || "DOCX export failed");
        }
        return;
      }

      if (kind === "html") {
        const html = buildPrintableHtml(displayTitle, bodyHtml, _meta || {});
        downloadHtml(`${fileStem}.html`, html);
        if (typeof flash === "function") flash("HTML downloaded");
        return;
      }
    } catch (e2) {
      console.error(e2);
      if (typeof flash === "function") flash("Export error");
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && exportMenu && !exportMenu.hidden) {
    exportMenu.hidden = true;
    exportMenuBtn?.focus();
  }
});

function buildPrintableHtml(title, bodyHtml, meta = {}) {
  // Capitalize helper (for Status)
  const cap = (s) =>
    s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "";

  // "Type Name (CODE)" — uses meta.type_name (from STEP 18) or falls back to TYPES map if present, else code.
  const typeLabelStr = (() => {
    const code = meta?.type_code || "";
    const name =
      meta?.type_name ||
      (typeof TYPES !== "undefined" && TYPES ? TYPES[code] : "");
    if (!code && !name) return "—";
    return name ? `${name} (${code})` : code;
  })();

  const formatDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    /* Keep CSS simple; tables render best in html-to-docx */
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      font-size: 12pt;
      color: #000;
      background: #fff;
      margin: 20mm; /* has no effect in DOCX but harmless; fine for HTML export */
    }
    h1 { font-size: 20pt; margin: 0 0 10px; }

    /* 4-column meta table: Label | Value | Label | Value */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 18px;
      font-size: 11pt;  /* slightly smaller than body */
      line-height: 1.45;
    }
    .meta-table td {
      padding: 6px 8px;
      vertical-align: top;
      border: none; /* cleaner print look */
    }
    .meta-table td strong {
      display: inline-block;
      min-width: 120px; /* enough for most labels; DOCX wraps values cleanly */
      color: #374151;
    }

    /* Body: left aligned for Purpose/Procedure and everything else */
    .sop-body, .sop-body * { text-align: left; }
    h2 { font-size: 14pt; margin: 1em 0 .4em; }
    h3 { font-size: 13pt; margin: .8em 0 .3em; }
    p  { margin: .6em 0; }
    ul, ol { margin: .6em 0 .6em 1.4em; }
    li  { margin: .2em 0; }
    code {
      background: #f3f4f6;
      padding: 0 3px;
      border-radius: 3px;
      font-family: Consolas, monospace;
    }
    pre {
      background:#f3f4f6; color:#000;
      padding:10px; border-radius:6px; white-space: pre-wrap;
    }
    a { text-decoration: underline; color: #0645ad; }
    hr { border: none; border-top: 1px solid #ccc; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(meta.title || title)}</h1>

  <table class="meta-table">
    <tr>
      <td><strong>SOP No.</strong></td><td>${escapeHtml(
        meta.sop_number || "—"
      )}</td>
      <td><strong>Version</strong></td><td>${escapeHtml(
        meta.version || "—"
      )}</td>
    </tr>
    <tr>
      <td><strong>Status</strong></td><td>${escapeHtml(
        cap(meta.status || "—")
      )}</td>
      <td><strong>Type</strong></td><td>${escapeHtml(typeLabelStr)}</td>
    </tr>
    <tr>
      <td><strong>Kind</strong></td>
      <td>${escapeHtml(
        meta.kind_name
          ? meta.kind_code
            ? `${meta.kind_name} (${meta.kind_code})`
            : meta.kind_name
          : "—"
      )}</td>
      <td><strong>Author</strong></td><td>${escapeHtml(meta.author || "—")}</td>
    </tr>
    <tr>
      <td><strong>Created on</strong></td><td>${formatDate(
        meta.created_at
      )}</td>
      <td><strong>Last updated on</strong></td><td>${formatDate(
        meta.updated_at
      )}</td>
    </tr>
    <tr>
      <td><strong>Last Reviewer</strong></td><td>${escapeHtml(
        meta.last_reviewer || "—"
      )}</td>
      <td></td><td></td>
    </tr>
  </table>

  <div class="sop-body">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function buildPdfHtml(title, bodyHtml, meta = {}) {
  const cap = (s) =>
    s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "";
  const formatDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const typeLabelStr = (() => {
    const code = meta?.type_code || "";
    const name =
      meta?.type_name ||
      (typeof TYPES !== "undefined" && TYPES ? TYPES[code] : "");
    if (!code && !name) return "—";
    return name ? `${name} (${code})` : code;
  })();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    /* Page + base typography */
    @page { margin: 20mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      margin: 0; /* margins from @page */
      background: #fff;
    }

    /* Title */
    h1 { font-size: 20pt; margin: 0 0 10px; }

    /* ── Meta block (2 balanced columns for A4 portrait) ───────────── */
    .meta-wrap {
      display: grid;
      grid-template-columns: 1fr 1fr;  /* 2 columns only */
      gap: 0 24px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin: 0 0 16px;
      font-size: 10pt;                /* slightly smaller than body */
      line-height: 1.5;               /* tighter lines for dense info */
    }
    /* Each row inside a column uses a 2-column grid: Label | Value */
    .meta-col > div {
      display: grid;
      grid-template-columns: 160px 1fr; /* fixed label column, flexible value */
      column-gap: 10px;
      align-items: start;
      margin: 4px 0;
    }
    .meta-col strong {
      color: #374151;
      white-space: nowrap;              /* labels never wrap */
    }
    .meta-col span {
      white-space: normal;              /* values wrap naturally */
      overflow-wrap: anywhere;          /* avoid awkward overflow */
    }

    /* ── Body content (left aligned) ───────────────────────────────── */
    .sop-body { margin-top: 12px; }
    .sop-body, .sop-body * { text-align: left; } /* ensure left alignment everywhere */
    h2 { font-size: 14pt; margin: 1em 0 .4em; }
    h3 { font-size: 13pt; margin: .8em 0 .3em; }
    p  { margin: .6em 0; }
    ul, ol { margin: .6em 0 .6em 1.4em; }
    li { margin: .2em 0; }

    code {
      background: #f3f4f6;
      padding: 0 3px;
      border-radius: 3px;
      font-family: Consolas, monospace;
    }
    pre {
      background:#f3f4f6; color:#000;
      padding:10px; border-radius:6px; white-space: pre-wrap;
    }
    a { text-decoration: underline; color:#0645ad; }
    hr { border: none; border-top: 1px solid #ccc; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(meta.title || title)}</h1>

  <div class="meta-wrap">
    <!-- Left: Identity + Lifecycle -->
    <div class="meta-col">
      <div><strong>SOP No.</strong> <span>${escapeHtml(
        meta.sop_number || "—"
      )}</span></div>
      <div><strong>Version</strong> <span>${escapeHtml(
        meta.version || "—"
      )}</span></div>
      <div><strong>Status</strong> <span>${escapeHtml(
        cap(meta.status || "—")
      )}</span></div>
      <div><strong>Type</strong> <span>${escapeHtml(typeLabelStr)}</span></div>
      <div><strong>Kind</strong> <span>${escapeHtml(meta.kind_name || "—")}${
    meta.kind_code ? ` (${escapeHtml(meta.kind_code)})` : ""
  }</span></div>
    </div>

    <!-- Right: People & Dates -->
    <div class="meta-col">
      <div><strong>Created on</strong> <span>${formatDate(
        meta.created_at
      )}</span></div>
      <div><strong>Last updated on</strong> <span>${formatDate(
        meta.updated_at
      )}</span></div>
      <div><strong>Author</strong> <span>${escapeHtml(
        meta.author || "—"
      )}</span></div>
      <div><strong>Last Reviewer</strong> <span>${escapeHtml(
        meta.last_reviewer || "—"
      )}</span></div>
    </div>
  </div>

  <div class="sop-body">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

/* ---------- Utils ---------- */
function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function escapeHtml(s = "") {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c])
  );
}

function stripLeadingH1(md = "", pageTitle = "") {
  // Normalize newlines and split
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  if (!lines.length) return md;

  // Check if first non-empty line is a Markdown H1
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return md;

  const m = lines[i].match(/^#\s+(.+)$/);
  if (!m) return md;

  const mdTitle = m[1].trim();
  const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const same = pageTitle && norm(mdTitle) === norm(pageTitle);

  if (same) {
    // Remove that H1 (and a following blank line if present)
    const rest = lines.slice(i + 1);
    if (rest[0] && rest[0].trim() === "") rest.shift();
    // Keep any lines before i (usually none/blank) + rest
    return lines.slice(0, i).join("\n") + (i ? "\n" : "") + rest.join("\n");
  } else {
    // Demote H1 → H2 so the page has only one H1 (the header)
    lines[i] = "## " + mdTitle;
    return lines.join("\n");
  }
}

/* very small Markdown renderer: headings, bold/italics, code, lists, links */
function renderMarkdown(md = "") {
  // normalize newlines
  let src = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // fence code blocks ```lang\n...\n```
  src = src.replace(/```([\s\S]*?)```/g, (m, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // inline code `code`
  src = src.replace(
    /`([^`]+?)`/g,
    (m, code) => `<code>${escapeHtml(code)}</code>`
  );

  // headings #### ### ## #
  src = src
    .replace(/^###### (.*)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // bold **text** and italics *text*
  src = src
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // links [text](url)
  src = src.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`
  );

  // lists (simple)
  // convert consecutive lines starting with "- " or "* " into <ul>
  src = src.replace(/(?:^|\n)([-*] .+(?:\n[-*] .+)*)/g, (m, block) => {
    const items = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!items.every((t) => /^[-*] /.test(t))) return m;
    const li = items
      .map((t) => `<li>${escapeHtml(t.replace(/^[-*]\s+/, ""))}</li>`)
      .join("");
    return `\n<ul>${li}</ul>`;
  });

  // paragraphs: wrap remaining text lines into <p>…</p>, preserving blank lines
  const lines = src.split("\n");
  let out = "";
  let buf = [];
  const flush = () => {
    if (buf.length) {
      const paragraph = buf.join(" ").trim();
      if (
        paragraph &&
        !/^<h\d|<ul>|<pre>|<p>|<table>|<blockquote>/.test(paragraph)
      ) {
        out += `<p>${paragraph}</p>\n`;
      } else if (paragraph) {
        out += paragraph + "\n";
      }
      buf = [];
    }
  };
  for (const line of lines) {
    if (line.trim() === "") {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();

  return out.trim() || "";
}

function flash(msg) {
  // super-lightweight toast
  const n = document.createElement("div");
  n.textContent = msg;
  n.style.cssText = `
    position: fixed; right: 16px; bottom: 16px;
    background: #111827; color: #fff; padding: 8px 12px;
    border-radius: 6px; font-size: 14px; opacity: 0.95; z-index: 9999;
  `;
  document.body.appendChild(n);
  setTimeout(() => {
    n.remove();
  }, 1600);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64(filename, base64, mime = "application/pdf") {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadHtml(filename, html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function fillMeta(meta) {
  const $ = (id) => document.getElementById(id);

  // Title at the document header
  const titleEl = document.getElementById("sopTitle");
  if (titleEl) titleEl.textContent = meta?.title || "Untitled SOP";

  // Badges row (on-screen quick identifiers)
  const badges = document.getElementById("sopBadges");
  if (badges) {
    const status = (meta?.status || "").toLowerCase();
    const statusCls =
      status === "active" ? "ok" : status === "obsolete" ? "danger" : "warn";
    badges.innerHTML = `
      <span class="badge primary">${meta?.sop_number || ""}</span>
      <span class="badge">Type: ${meta?.type_code || ""}</span>
      <span class="badge ${statusCls}">${meta?.status || "draft"}</span>
      <span class="badge">Version: ${meta?.version || ""}</span>
      <span class="badge">Kind: ${meta?.kind_name || ""}${
      meta?.kind_code ? ` (${meta.kind_code})` : ""
    }</span>
    `;
  }

  // Helpers
  const formatDMY = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // People & dates
  const author = meta?.author || "—";
  const reviewer = meta?.last_reviewer || "—";
  const created = meta?.created_at ? formatDMY(meta.created_at) : "—";
  const updated = meta?.updated_at ? formatDMY(meta.updated_at) : "—";

  // Identifiers
  const sopNo = meta?.sop_number || "—";
  const type = typeLabel(meta); // e.g., "Manufacturing (MF)"
  const statusTx = meta?.status || "—";
  const version = meta?.version || "—";
  const kind = meta?.kind_name
    ? `${meta.kind_name}${meta?.kind_code ? ` (${meta.kind_code})` : ""}`
    : "—";

  // Write to DOM (IDs match the HTML above)
  const ids = {
    m_author: author,
    m_reviewer: reviewer,
    m_created: created,
    m_updated: updated,
    m_sop_no: sopNo,
    m_type: type,
    m_status: statusTx,
    m_version: version,
    m_kind: kind,
  };

  for (const [id, val] of Object.entries(ids)) {
    const el = $(id);
    if (el) el.textContent = val;
  }
}

/* ---------- Data loaders ---------- */
async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.href = "login.html";
}

async function loadMeta(sopId) {
  const { data, error } = await supabase
    .from("v_sop_flat")
    .select(
      "sop_id, sop_number, title, type_code, version, status, author, updated_at, kind_name, kind_code"
    )
    .eq("sop_id", sopId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadDesc(sopId) {
  const { data, error } = await supabase
    .from("sop_content")
    .select("description_md, created_at")
    .eq("sop_id", sopId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return {
    md: data?.description_md ?? "",
    created_at: data?.created_at ?? null,
  };
}

/* ---------- Render ---------- */
function render(meta, md) {
  if (pageTitle) {
    pageTitle.textContent = "SOP Viewer";
  }
  if (elDesc) {
    const cleanedMd = stripLeadingH1(md || "", meta?.title || "");
    elDesc.innerHTML = renderMarkdown(cleanedMd);
  }
}

/* ---------- Init ---------- */
(async function init() {
  await ensureSession();
  const sopId = getQueryParam("sop_id");
  if (!sopId) {
    elDesc.textContent = "Missing sop_id in URL.";
    return;
  }
  try {
    const [meta, desc] = await Promise.all([loadMeta(sopId), loadDesc(sopId)]);
    _meta = meta || {};
    _md = desc.md || "";
    // carry created_at from sop_content into meta so exports can use it
    _meta.created_at = desc.created_at || null;

    // Load type names (once) and attach to meta for consistent use
    const typesMap = await loadTypesMap();
    if (!_meta.type_name && _meta.type_code) {
      _meta.type_name = typesMap?.[_meta.type_code] || "";
    }

    if (!meta) {
      elDesc.textContent = "SOP not found.";
      return;
    }

    if (document.getElementById("sopTitle")) fillMeta(_meta);

    render(meta, _md);
  } catch (err) {
    console.error(err);
    elDesc.textContent = err.message || "Failed to load SOP.";
  }
})();
