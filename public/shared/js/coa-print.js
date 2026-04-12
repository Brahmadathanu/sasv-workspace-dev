/* coa-print.js
 * Lab ERP — Certificate of Analysis Print Module
 *
 * Loads an issued COA by numeric ID (URL param: ?coa_issue_id=<number>)
 * and renders a print-ready Form 50 style Certificate of Analysis.
 *
 * Data sources:
 *   lab.v_coa_form50_header  — Analysis & signatory metadata
 *   lab.v_coa_form50_lines   — Individual test result rows
 *
 * This is a read-only document page — no editing is performed.
 */

import { labSupabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

// ── DOM refs ───────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const btnBack = $("btnBack");
const btnDownloadPdf = $("btnDownloadPdf");
const btnRefresh = $("btnRefresh");
const loadingOverlay = $("loadingOverlay");
const toastContainer = $("toastContainer");
const errorState = $("errorState");
const errTitle = $("errTitle");
const errDetail = $("errDetail");
const coaSheet = $("coaSheet");
const pageSubtitle = $("pageSubtitle");
const coaReportHint = $("coaReportHint");

const metaDate = $("metaDate");
const metaReportNo = $("metaReportNo");
const detailBody = $("detailBody");
const resultsBody = $("resultsBody");

const sigPreparedName = $("sigPreparedName");
const sigPreparedDes = $("sigPreparedDes");
const sigApprovedName = $("sigApprovedName");
const sigApprovedDes = $("sigApprovedDes");

// ── Module state ───────────────────────────────────────────────────────────────
let coaIssueId = null; // parsed from URL param
let currentHeader = null; // stored after successful load for PDF generation
let currentLines = null; // stored after successful load for PDF generation
// ── Utility: parse URL param ───────────────────────────────────────────────────
function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Utility: escape HTML ───────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Utility: format date ───────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

// ── Utility: format date + unit string ────────────────────────────────────────
function formatBatchSize(size, uom) {
  if (size == null && !uom) return "—";
  const parts = [];
  if (size != null) parts.push(String(size));
  if (uom) parts.push(esc(uom));
  return parts.join(" ");
}

// ── Toast notifications ────────────────────────────────────────────────────────
function toast(message, kind = "info", duration = 3500) {
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 320);
  }, duration);
}

// ── Loading overlay ────────────────────────────────────────────────────────────
function showLoading() {
  loadingOverlay.classList.add("open");
}
function hideLoading() {
  loadingOverlay.classList.remove("open");
}

// ── Navigate back safely ───────────────────────────────────────────────────────
function goBack() {
  // Prefer platform navigation
  if (typeof Platform?.goHome === "function") {
    Platform.goHome();
    return;
  }
  // Try browser history
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  // Final fallback
  window.location.href = "lab-analysis-queue.html";
}

// ── Data loading ───────────────────────────────────────────────────────────────
/**
 * Load the header row for this COA issue from lab.v_coa_form50_header.
 * Returns null on error or when not found.
 */
async function loadHeader() {
  const { data, error } = await labSupabase
    .from("v_coa_form50_header")
    .select("*")
    .eq("coa_issue_id", coaIssueId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows — not found
    throw error;
  }
  return data ?? null;
}

/**
 * Load all test result lines for this COA issue from lab.v_coa_form50_lines.
 * Returns an empty array on error.
 */
async function loadLines() {
  const { data, error } = await labSupabase
    .from("v_coa_form50_lines")
    .select("*")
    .eq("coa_issue_id", coaIssueId)
    .order("seq_no", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ── Render ─────────────────────────────────────────────────────────────────────
/**
 * Populate the meta (date / report no) strip and update subtitle hint.
 */
function renderMeta(header) {
  metaDate.textContent = formatDate(header.issue_date);
  metaReportNo.textContent = header.coa_no ?? "—";

  // Update subtitle and action bar hint with COA identity
  if (pageSubtitle) {
    pageSubtitle.textContent = header.item_name
      ? `${header.item_name} — Form 50`
      : "Form 50 — Drugs & Cosmetics Rules 1945";
  }
  if (coaReportHint) {
    coaReportHint.textContent = header.coa_no
      ? `Report: ${header.coa_no} • Issued ${formatDate(header.issue_date)}`
      : "";
  }

  // Update browser/tab title
  document.title = header.coa_no
    ? `COA Preview \u2014 ${header.coa_no}`
    : "Certificate of Analysis \u2014 Form 50";
}

// ── Build safe PDF filename ────────────────────────────────────────────────────
function buildPdfFileName(header) {
  const parts = [
    "COA",
    header.coa_no ?? "",
    header.item_name ?? "",
    header.batch_no_snapshot ?? header.system_lot_no ?? "NA",
  ]
    .map((p) => String(p).trim())
    .filter(Boolean);

  const raw = parts.join("_");
  return raw.replace(/[^\w\-.]/g, "_").replace(/_+/g, "_") + ".pdf";
}

// ── Load image as data URL for PDF embedding ───────────────────────────────────
function loadImageAsDataUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          nw: img.naturalWidth,
          nh: img.naturalHeight,
        });
      } catch (e) {
        console.warn("[COA PDF] Canvas draw failed for logo:", e);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn("[COA PDF] Logo not found:", src);
      resolve(null);
    };
    img.src = src;
  });
}

// ── PDF helper — footer page number ──────────────────────────────────────────
function pdfDrawFooter(doc, pageNo, dims) {
  const { PW, PH, MR } = dims;
  doc.setFont("times", "normal").setFontSize(8).setTextColor(60);
  doc.text(`Page ${pageNo}`, PW - MR, PH - 8, { align: "right" });
  doc.setTextColor(0);
}

// ── PDF helper — continuation header on page 2+ ───────────────────────────────
function pdfDrawContinuationHeader(doc, coaNo, dims) {
  const { ML, MR, MT, PW } = dims;
  doc.setFont("times", "italic").setFontSize(8).setTextColor(68);
  doc.text(`Certificate of Analysis \u2014 ${coaNo}  (continued)`, ML, MT + 3);
  doc
    .setLineWidth(0.18)
    .setDrawColor(160)
    .line(ML, MT + 5, PW - MR, MT + 5);
  doc.setTextColor(0).setDrawColor(0);
}

// ── Generate structured A4 PDF via jsPDF ──────────────────────────────────────
/* global jspdf */
async function generatePdf() {
  if (!currentHeader || !currentLines) {
    toast("No COA loaded. Please wait for the page to finish loading.", "warn");
    return;
  }
  if (typeof jspdf === "undefined") {
    toast("PDF library not available. Please reload the page.", "error");
    return;
  }

  btnDownloadPdf.disabled = true;
  btnDownloadPdf.textContent = "Generating\u2026";

  try {
    // ── Page geometry (A4, mm) ────────────────────────────────────────────────
    const PW = 210,
      PH = 297;
    const ML = 14,
      MR = 14,
      MT = 12,
      MB = 18;
    const CW = PW - ML - MR; // 182 mm usable width
    const cx = PW / 2;
    const dims = { PW, PH, ML, MR, MT, MB, CW, cx };

    const { jsPDF } = jspdf;
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
    });

    const coaNo = currentHeader.coa_no ?? "\u2014";
    const issueDate = formatDate(currentHeader.issue_date);

    // Load logo (failure is non-fatal)
    const logoInfo = await loadImageAsDataUrl("./assets/santhigiri-logo.png");

    let y = MT;

    // ── Letterhead box ────────────────────────────────────────────────────────
    const LH_H = 20; // letterhead box height (mm) — matches preview compact feel
    const LOGO_COL_W = 30; // right logo column (mm)
    const TEXT_WRAP_W = CW - LOGO_COL_W - 4; // text wrap width (avoids logo)

    doc.setLineWidth(0.2).setDrawColor(60).rect(ML, y, CW, LH_H); // 0.2 ≈ 1px CSS border

    // Text block centered on full page width
    let ty = y + 4;
    doc.setFont("times", "italic").setFontSize(8.5).setTextColor(51);
    doc.text("Gurucharanam Saranam", cx, ty, { align: "center" });
    ty += 5.5; // gap between blessing and org name

    doc.setFont("times", "bold").setFontSize(12).setTextColor(0);
    const orgLines = doc.splitTextToSize(
      "SANTHIGIRI AYURVEDA SIDDHA VAIDYASALA",
      TEXT_WRAP_W,
    );
    doc.text(orgLines, cx, ty, { align: "center" });
    ty += orgLines.length * 4.8;

    doc.setFont("times", "normal").setFontSize(8.5);
    doc.text("Santhigiri P O, Thiruvananthapuram, Kerala, 695589", cx, ty, {
      align: "center",
      maxWidth: TEXT_WRAP_W,
    });
    ty += 3.8;

    doc.setFontSize(8);
    doc.text("Mfg. Lic. No: 61/25D/89   GMP No: 41 Dated 13.08.2002", cx, ty, {
      align: "center",
      maxWidth: TEXT_WRAP_W,
    });

    // Logo: right column, vertically centered — capped to match preview size
    if (logoInfo) {
      const MAX_LW = LOGO_COL_W - 6;
      const MAX_LH = 15; // ~54px @ 96dpi, matches html max-height:54px
      const aspect = logoInfo.nw / logoInfo.nh;
      let lH = Math.min(MAX_LH, MAX_LH);
      let lW = lH * aspect;
      if (lW > MAX_LW) {
        lW = MAX_LW;
        lH = lW / aspect;
      }
      const logoAreaX = ML + CW - LOGO_COL_W;
      const logoImgX = logoAreaX + (LOGO_COL_W - lW) / 2;
      const logoImgY = y + (LH_H - lH) / 2;
      doc.addImage(logoInfo.dataUrl, "PNG", logoImgX, logoImgY, lW, lH);
    }

    y += LH_H + 5; // clear gap below letterhead border

    // ── Certificate title block ───────────────────────────────────────────────
    doc.setFont("times", "bold").setFontSize(12).setTextColor(0);
    doc.text("CERTIFICATE OF ANALYSIS", cx, y, { align: "center" });
    y += 4;

    doc.setFont("times", "italic").setFontSize(8).setTextColor(68);
    doc.text(
      "Schedule A, Form 50, Drugs & Cosmetics Rules 1945, Rule 160-D(f)",
      cx,
      y,
      { align: "center" },
    );
    y += 2.5;

    doc
      .setLineWidth(0.18)
      .setDrawColor(80)
      .line(ML, y, PW - MR, y);
    y += 5;

    // ── Date / Report No strip (outside detail table) ─────────────────────────
    doc.setFont("times", "normal").setFontSize(8.5).setTextColor(0);
    doc.text(`Date: ${issueDate}`, ML, y);
    doc.setFont("times", "bold");
    doc.text(`Report No: ${coaNo}`, PW - MR, y, { align: "right" });
    doc.setFont("times", "normal");
    y += 3;
    doc
      .setLineWidth(0.18)
      .setDrawColor(180)
      .line(ML, y, PW - MR, y);
    y += 3;

    // ── Detail table ──────────────────────────────────────────────────────────
    const batchSizePdf = (size, uom) => {
      if (size == null && !uom) return "\u2014";
      return [size != null ? String(size) : null, uom || null]
        .filter(Boolean)
        .join(" ");
    };

    const DRH = 5.5; // row height (mm)
    const LPAD = 1.5; // left padding inside each cell
    const TY_OFF = 3.9; // text baseline offset from row top

    // Fixed column widths matching HTML dt-lbl:23% / dt-val:27% — same for all rows
    // This ensures vertical borders align between full-width and paired rows.
    const C_LBL = CW * 0.23; // 41.86 mm — each label column
    const C_VAL = CW * 0.27; // 49.14 mm — each value column
    // Full-width value spans 3 columns: val + lbl + val = 27+23+27 = 77% of CW
    const C_FVAL = CW - C_LBL; // 140.14 mm

    const DT_LC = [190, 190, 190]; // detail table border color
    const DT_LW = 0.18; // detail table border weight

    /**
     * drawDetailRow — draws one row with clean non-doubled borders.
     * Each cell defined as { x, w, text, bold }.
     * Strategy: fill whole row → draw outer rect → draw inner vertical dividers as lines.
     * This avoids shared-edge double-stroking that thickens interior borders.
     */
    const drawDetailRow = (cells) => {
      // Pass 1: solid white fill across the full row
      doc.setFillColor(255, 255, 255).rect(ML, y, CW, DRH, "F");

      // Pass 2: outer row border (single stroke, no double-up)
      doc
        .setLineWidth(DT_LW)
        .setDrawColor(...DT_LC)
        .rect(ML, y, CW, DRH, "S");

      // Pass 3: inner vertical dividers only (skip first and last — those are outer border)
      let rx = ML;
      for (let i = 0; i < cells.length - 1; i++) {
        rx += cells[i].w;
        doc.line(rx, y, rx, y + DRH);
      }

      // Pass 4: text
      rx = ML;
      for (const cell of cells) {
        doc
          .setFont("times", cell.bold ? "bold" : "normal")
          .setFontSize(8.5)
          .setTextColor(0);
        doc.text(String(cell.text), rx + LPAD, y + TY_OFF, {
          maxWidth: cell.w - LPAD - 1,
        });
        rx += cell.w;
      }
      y += DRH;
    };

    const ch = currentHeader;

    // Row 1: Name of the Sample (full width, 2-col)
    drawDetailRow([
      { w: C_LBL, text: "Name of the Sample", bold: true },
      { w: C_FVAL, text: ch.item_name ?? "\u2014", bold: false },
    ]);

    // Row 2: Batch No | Batch Size (4-col, aligned with HTML 23/27/23/27)
    drawDetailRow([
      { w: C_LBL, text: "Batch No", bold: true },
      { w: C_VAL, text: ch.batch_no_snapshot ?? "\u2014", bold: false },
      { w: C_LBL, text: "Batch Size", bold: true },
      {
        w: C_VAL,
        text: batchSizePdf(ch.batch_size_snapshot, ch.batch_uom_code),
        bold: false,
      },
    ]);

    // Row 3: Date of Mfg | Date of Exp
    drawDetailRow([
      { w: C_LBL, text: "Date of Mfg", bold: true },
      { w: C_VAL, text: formatDate(ch.mfg_date), bold: false },
      { w: C_LBL, text: "Date of Exp", bold: true },
      { w: C_VAL, text: formatDate(ch.exp_date), bold: false },
    ]);

    // Row 4: Sample Submitted By (full width, 2-col)
    drawDetailRow([
      { w: C_LBL, text: "Sample Submitted By", bold: true },
      { w: C_FVAL, text: ch.sample_submitted_by ?? "\u2014", bold: false },
    ]);

    // Row 5: Date Submitted | Date Analysis Completed
    drawDetailRow([
      { w: C_LBL, text: "Date of Sample Submitted", bold: true },
      { w: C_VAL, text: formatDate(ch.sample_submitted_date), bold: false },
      { w: C_LBL, text: "Date of Analysis Completed", bold: true },
      { w: C_VAL, text: formatDate(ch.analysis_completed_date), bold: false },
    ]);

    y += 6; // gap before TEST RESULTS

    // ── Results section heading ───────────────────────────────────────────────
    doc.setFont("times", "bold").setFontSize(9).setTextColor(0);
    doc.text("TEST RESULTS", ML, y);
    y += 2;
    doc
      .setLineWidth(0.18)
      .setDrawColor(80)
      .line(ML, y, PW - MR, y); // Part D: thin
    y += 3.5;

    // ── Results table via autoTable ───────────────────────────────────────────
    const tHead = [["Test", "Result", "Test Method", "Reference Range"]];
    const tBody = currentLines.length
      ? currentLines.map((ln) => [
          ln.test_name_snapshot ?? "\u2014",
          ln.result_display_snapshot ?? "\u2014",
          ln.method_name_snapshot ?? "\u2014",
          ln.spec_display_snapshot ?? "\u2014",
        ])
      : [["No test results recorded.", "", "", ""]];

    // Track page count so manual addPage gets the right number
    let pageCount = doc.getNumberOfPages();

    doc.autoTable({
      startY: y,
      head: tHead,
      body: tBody,
      theme: "grid",
      margin: { left: ML, right: MR, top: MT + 10, bottom: MB + 5 },
      rowPageBreak: "avoid",
      styles: {
        font: "times",
        fontStyle: "normal",
        fontSize: 8.5,
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.18,
        cellPadding: { top: 1.2, right: 2, bottom: 1.2, left: 2 },
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        font: "times",
        fontStyle: "bold",
        fontSize: 9,
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.18,
      },
      columnStyles: {
        0: { cellWidth: CW * 0.3 },
        1: { cellWidth: CW * 0.15, halign: "center" },
        2: { cellWidth: CW * 0.27 },
        3: { cellWidth: CW * 0.28 },
      },
      didDrawPage: (data) => {
        pageCount = Math.max(pageCount, data.pageNumber);
        if (data.pageNumber > 1) {
          pdfDrawContinuationHeader(doc, coaNo, dims);
        }
        pdfDrawFooter(doc, data.pageNumber, dims); // Part E: every page
        doc.setTextColor(0).setDrawColor(0);
      },
    });

    y = doc.lastAutoTable.finalY + 4;

    // ── Opinion + signatures ──────────────────────────────────────────────────
    const opinionText =
      "In the opinion of the undersigned, the sample referred to above is of standard quality" +
      " as defined in the act or the rules made thereunder.";
    doc.setFont("times", "italic").setFontSize(8.5).setTextColor(34);
    const opLines = doc.splitTextToSize(opinionText, CW);
    const opinionH = 5 + opLines.length * 4.2; // top padding + text lines
    const signatureH = 4 + 4 + 5.5 + 4.5 + 4; // rule→label→name→desig
    const finalBlockH = opinionH + signatureH;

    if (y + finalBlockH > PH - MB) {
      doc.addPage();
      pageCount += 1;
      pdfDrawContinuationHeader(doc, coaNo, dims);
      pdfDrawFooter(doc, pageCount, dims); // Part E: footer on manual page
      doc.setTextColor(0).setDrawColor(0);
      y = MT + 14;
    }

    // Opinion paragraph
    doc.setFont("times", "italic").setFontSize(8.5).setTextColor(34);
    doc.text(opLines, ML, y);
    y += opLines.length * 4.2 + 4;

    // Signature rule lines — Part D: thin, subtle
    const sigW = CW * 0.38;
    doc.setLineWidth(0.18).setDrawColor(120);
    doc.line(ML, y, ML + sigW, y);
    doc.line(PW - MR - sigW, y, PW - MR, y);
    y += 4;

    // Signature labels
    doc.setFont("times", "normal").setFontSize(7.5).setTextColor(100);
    doc.text("ANALYSED BY", ML, y);
    doc.text("PERSON IN-CHARGE OF TESTING", PW - MR, y, { align: "right" });
    y += 5.5;

    // Signatory names
    doc.setFont("times", "bold").setFontSize(9).setTextColor(0);
    doc.text(currentHeader.prepared_by_name_snapshot ?? "\u2014", ML, y);
    doc.text(currentHeader.approved_by_name_snapshot ?? "\u2014", PW - MR, y, {
      align: "right",
    });
    y += 4.5;

    // Signatory designations
    doc.setFont("times", "italic").setFontSize(8).setTextColor(68);
    doc.text(currentHeader.prepared_by_designation_snapshot ?? "", ML, y);
    doc.text(currentHeader.approved_by_designation_snapshot ?? "", PW - MR, y, {
      align: "right",
    });
    doc.setTextColor(0).setDrawColor(0);

    // ── Save ──────────────────────────────────────────────────────────────────
    const filename = buildPdfFileName(currentHeader);
    doc.save(filename);
    toast(`Saved: ${filename}`, "success", 4000);
  } catch (err) {
    toast(`PDF generation failed: ${err.message}`, "error", 5000);
  } finally {
    btnDownloadPdf.disabled = false;
    btnDownloadPdf.innerHTML =
      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"` +
      ` stroke="currentColor" stroke-width="2"` +
      ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>` +
      `<polyline points="7 10 12 15 17 10"></polyline>` +
      `<line x1="12" y1="15" x2="12" y2="3"></line></svg> Download PDF`;
  }
}

/**
 * Build the detail rows table (Name of sample, batch, etc.).
 */
function renderDetailTable(header) {
  const h = header;
  const batchSz = esc(formatBatchSize(h.batch_size_snapshot, h.batch_uom_code));

  detailBody.innerHTML = `
    <tr>
      <td class="dt-lbl">Name of the Sample</td>
      <td class="dt-val" colspan="3">${esc(h.item_name ?? "—")}</td>
    </tr>
    <tr>
      <td class="dt-lbl">Batch No</td>
      <td class="dt-val">${esc(h.batch_no_snapshot ?? "—")}</td>
      <td class="dt-lbl">Batch Size</td>
      <td class="dt-val">${batchSz}</td>
    </tr>
    <tr>
      <td class="dt-lbl">Date of Mfg</td>
      <td class="dt-val">${formatDate(h.mfg_date)}</td>
      <td class="dt-lbl">Date of Exp</td>
      <td class="dt-val">${formatDate(h.exp_date)}</td>
    </tr>
    <tr>
      <td class="dt-lbl">Sample Submitted By</td>
      <td class="dt-val" colspan="3">${esc(h.sample_submitted_by ?? "—")}</td>
    </tr>
    <tr>
      <td class="dt-lbl">Date of Sample Submitted</td>
      <td class="dt-val">${formatDate(h.sample_submitted_date)}</td>
      <td class="dt-lbl">Date of Analysis Completed</td>
      <td class="dt-val">${formatDate(h.analysis_completed_date)}</td>
    </tr>`;
}

/**
 * Build the test results table rows.
 */
function renderResultsTable(lines) {
  if (!lines.length) {
    resultsBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:14px;color:#666;font-style:italic;">
          No test results recorded.
        </td>
      </tr>`;
    return;
  }

  resultsBody.innerHTML = lines
    .map(
      (line) => `
        <tr>
          <td>${esc(line.test_name_snapshot ?? "—")}</td>
          <td>${esc(line.result_display_snapshot ?? "—")}</td>
          <td>${esc(line.method_name_snapshot ?? "—")}</td>
          <td>${esc(line.spec_display_snapshot ?? "—")}</td>
        </tr>`,
    )
    .join("");
}

/**
 * Render the two-signatory block.
 */
function renderSignatures(header) {
  sigPreparedName.textContent = header.prepared_by_name_snapshot ?? "—";
  sigPreparedDes.textContent = header.prepared_by_designation_snapshot ?? "";

  sigApprovedName.textContent = header.approved_by_name_snapshot ?? "—";
  sigApprovedDes.textContent = header.approved_by_designation_snapshot ?? "";
}

// ── Full render cycle ──────────────────────────────────────────────────────────
async function renderCoa() {
  showLoading();
  coaSheet.style.display = "none";
  errorState.style.display = "none";

  try {
    const [header, lines] = await Promise.all([loadHeader(), loadLines()]);

    if (!header) {
      errTitle.textContent = "COA not found";
      errDetail.textContent =
        "The requested COA does not exist or you may not have access.";
      errorState.style.display = "block";
      coaSheet.style.display = "none";
      return;
    }

    currentHeader = header;
    currentLines = lines;
    renderMeta(header);
    renderDetailTable(header);
    renderResultsTable(lines);
    renderSignatures(header);

    coaSheet.style.display = "block";
  } catch (err) {
    toast(`Failed to load COA: ${err.message}`, "error", 6000);
    errTitle.textContent = "Load failed";
    errDetail.textContent = err.message;
    errorState.style.display = "block";
  } finally {
    hideLoading();
  }
}

// ── Event wiring ───────────────────────────────────────────────────────────────
function wireEvents() {
  btnBack.addEventListener("click", goBack);

  btnRefresh.addEventListener("click", async () => {
    btnRefresh.disabled = true;
    await renderCoa();
    toast("Refreshed.", "info", 1800);
    btnRefresh.disabled = false;
  });

  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener("click", generatePdf);
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────
async function init() {
  const rawId = getUrlParam("coa_issue_id");
  coaIssueId = rawId ? parseInt(rawId, 10) : null;

  wireEvents();

  // Case 1 — No ID provided
  if (!coaIssueId || isNaN(coaIssueId)) {
    console.log("[COA] No coa_issue_id in URL — showing error state.");
    errTitle.textContent = "No COA selected";
    errDetail.textContent =
      "This page must be opened from the Analysis Queue or Workspace.";
    errorState.style.display = "block";
    coaSheet.style.display = "none";
    return;
  }

  // Case 2 — Valid ID → load normally
  console.log("[COA] Loading COA Issue ID:", coaIssueId);
  await renderCoa();
}

init();
