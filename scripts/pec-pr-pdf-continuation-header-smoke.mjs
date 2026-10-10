/**
 * PEC PR PDF continuation header (DEC-016).
 * Static source checks, plus a synthetic multi-page render when
 * jspdf@2.5.1 and jspdf-autotable@3.8.2 are available (temp install;
 * not a package.json dependency). Looks in PEC_JSPDF_ROOT or
 * /tmp/pec-pdf-libs/node_modules.
 * No network, no Supabase, no database changes.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(
  join(root, "public/shared/js/procurement-execution-console.js"),
  "utf8",
);
const swSrc = readFileSync(join(root, "public/sw.js"), "utf8");
const fails = [];
const assert = (cond, msg) => {
  if (!cond) fails.push(msg);
};

function extractFunction(source, name) {
  const needle = `function ${name}(`;
  const start = source.indexOf(needle);
  if (start < 0) return "";
  let i = source.indexOf("{", start);
  if (i < 0) return "";
  let depth = 0;
  let quote = null;
  let escape = false;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
}

const pdfFn = extractFunction(src, "exportIndentToPdf");
const headerFn = extractFunction(src, "drawContinuationHeader");
const prFormFn = extractFunction(src, "exportPrFormPdf");

assert(pdfFn.includes("async function") || src.includes("async function exportIndentToPdf"), "exportIndentToPdf exists");
assert(pdfFn.length > 500, "exportIndentToPdf body extracted");
assert(headerFn.includes("function drawContinuationHeader"), "drawContinuationHeader extracted");
assert(prFormFn.includes("function exportPrFormPdf"), "exportPrFormPdf extracted");

assert(
  /didDrawPage:\s*\(data\)\s*=>\s*\{\s*if\s*\(data\.pageNumber\s*>\s*1\)\s*drawContinuationHeader\(doc,\s*ctx\);/.test(
    pdfFn,
  ),
  "autoTable didDrawPage draws the continuation header only when pageNumber > 1",
);
assert(
  /top:\s*margin\s*\+\s*CONT_HEADER_H/.test(pdfFn),
  "continued-page table margin.top is margin + CONT_HEADER_H",
);
assert(/const CONT_HEADER_H = 14;/.test(pdfFn), "CONT_HEADER_H is 14mm");
assert(/startY:\s*HEADER_H/.test(pdfFn), "page 1 table still starts at HEADER_H");

for (const label of ["Dept/Unit", "Location", "Req No & Date"]) {
  assert(headerFn.includes(`"${label}"`), `continuation header labels ${label}`);
}
assert(headerFn.includes("splitTextToSize"), "continuation values use splitTextToSize");
assert(headerFn.includes("getTextWidth"), "continuation values use getTextWidth");
assert(headerFn.includes('|| "-"'), "empty continuation values fall back to '-'");
assert(headerFn.includes("\\u2026"), "truncated continuation values use an ellipsis");
assert(/ctx\.deptUnit/.test(headerFn), "continuation Dept/Unit uses ctx.deptUnit");
assert(/ctx\.location/.test(headerFn), "continuation Location uses ctx.location");
assert(/ctx\.reqNoAndDate/.test(headerFn), "continuation Req No & Date uses ctx.reqNoAndDate");

const footerCalls = pdfFn.match(/drawPageFooter\(/g) || [];
assert(footerCalls.length === 1, "footer is drawn in exactly one pass");
const footerAt = pdfFn.indexOf("drawPageFooter(");
const approvedAt = pdfFn.lastIndexOf("Approved By");
const addPageAt = pdfFn.indexOf('doc.addPage("a4", "landscape")');
assert(footerAt > approvedAt && approvedAt > 0, "footer pass is after the signature block");
assert(addPageAt > 0, "signature overflow still adds a page");
const afterAdd = pdfFn.slice(addPageAt, addPageAt + 280);
assert(
  afterAdd.includes("drawContinuationHeader(doc, ctx)"),
  "signature-only page draws the continuation header",
);
assert(
  afterAdd.includes("sigY = margin + CONT_HEADER_H + 20"),
  "signatures on a new page sit below the continuation header",
);
assert(
  !/finalTotalPages\s*>\s*totalPages/.test(pdfFn),
  "footer is not restamped when a signature page is added",
);

assert(
  !prFormFn.includes("drawContinuationHeader") && !prFormFn.includes("CONT_HEADER_H"),
  "exportPrFormPdf is unchanged by the continuation header",
);
assert(
  /CACHE_NAME = "hub-cache-v346"/.test(swSrc),
  "service worker cache generation is hub-cache-v346",
);

function loadJsPdf() {
  const roots = [
    process.env.PEC_JSPDF_ROOT,
    "/tmp/pec-pdf-libs/node_modules",
  ].filter(Boolean);
  for (const libRoot of roots) {
    const pkg = join(libRoot, "jspdf/package.json");
    if (!existsSync(pkg)) continue;
    const req = createRequire(pkg);
    const loaded = req("jspdf");
    const jsPDF = loaded.jsPDF || loaded.default?.jsPDF || loaded;
    req("jspdf-autotable");
    if (typeof jsPDF === "function") return jsPDF;
  }
  return null;
}

function pageStream(doc, pageNumber) {
  const page = doc.internal.pages[pageNumber];
  if (page == null) return "";
  return Array.isArray(page) ? page.join("\n") : String(page);
}

function pdfLiterals(stream) {
  const out = [];
  const re = /\((?:\\.|[^\\)])*\)/g;
  let match = re.exec(stream);
  while (match) {
    let text = match[0].slice(1, -1);
    text = text
      .replace(/\\([()\\])/g, "$1")
      .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(Number.parseInt(oct, 8)));
    out.push(text);
    match = re.exec(stream);
  }
  return out.join("");
}

function runRuntime(jsPDF) {
  const heightMatch = pdfFn.match(/const CONT_HEADER_H = (\d+);/);
  const drawContinuationHeader = new Function(
    `${heightMatch[0]}\n${headerFn}\nreturn drawContinuationHeader;`,
  )();

  const margin = 10;
  const FOOTER_H = 12;
  const CONT_HEADER_H = 14;
  const startY = 62;
  const longLocation =
    "Raw Material Store, SASV, North Annex Wing, Building B, Floor 2, Bay 14, Rack 9";
  const ctx = {
    margin,
    pageWidth: 297,
    deptUnit: "SHRO / SASV",
    location: longLocation,
    indentNumber: "193",
    reqNoAndDate: "193  /  2026-10-10",
  };

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  ctx.pageWidth = doc.internal.pageSize.getWidth();
  const headStarts = [];
  const body = Array.from({ length: 60 }, (_, i) => [
    String(i + 1),
    "PM",
    `Synthetic material line ${i + 1}`,
    "-",
    "NOS",
    "4",
    "0",
    "4",
    "",
    "Acme",
    "",
  ]);

  doc.autoTable({
    theme: "grid",
    showHead: "everyPage",
    head: [["SN", "Category", "Material Description", "Brand / Part No", "UOM"]],
    body,
    startY,
    margin: {
      top: margin + CONT_HEADER_H,
      left: margin,
      right: margin,
      bottom: FOOTER_H,
    },
    styles: { fontSize: 7.6, cellPadding: 1.45, overflow: "linebreak" },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawContinuationHeader(doc, ctx);
    },
    willDrawCell: (data) => {
      if (data.section === "head" && data.column.index === 0 && data.row.index === 0) {
        headStarts.push({ page: data.pageNumber, y: data.cell.y });
      }
    },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const tablePages = doc.internal.getNumberOfPages();
  doc.setPage(tablePages);
  let sigY = doc.lastAutoTable.finalY + 16;
  if (sigY + 28 > pageHeight - FOOTER_H) {
    doc.addPage("a4", "landscape");
    drawContinuationHeader(doc, ctx);
    sigY = margin + CONT_HEADER_H + 20;
  }
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(0);
  doc.text("Prepared / Requested By", margin + 40, sigY + 4);

  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(100);
    doc.text(`Page ${i} of ${total}`, ctx.pageWidth - margin - 10, ph - 5, {
      align: "right",
    });
    doc.text(`PR: ${ctx.indentNumber}`, margin, ph - 5);
  }

  assert(total >= 2, `synthetic 60-line indent spans at least 2 pages (got ${total})`);
  const page1 = pdfLiterals(pageStream(doc, 1));
  assert(!page1.includes("Dept/Unit:"), "page 1 does not draw the continuation line");
  assert(!page1.includes("Req No & Date:"), "page 1 does not repeat Req No & Date as a continuation line");
  assert(
    page1.split("Page 1 of").length - 1 === 1,
    "page 1 footer page number is drawn once",
  );
  assert(page1.split("PR: 193").length - 1 === 1, "page 1 PR footer is drawn once");

  for (let i = 2; i <= total; i += 1) {
    const text = pdfLiterals(pageStream(doc, i));
    assert(text.includes("Dept/Unit:"), `page ${i} continuation includes Dept/Unit`);
    assert(text.includes("Location:"), `page ${i} continuation includes Location`);
    assert(text.includes("Req No & Date:"), `page ${i} continuation includes Req No & Date`);
    assert(text.includes("SHRO / SASV"), `page ${i} continuation includes the department value`);
    assert(text.includes("193  /  2026-10-10"), `page ${i} continuation includes req no and date`);
    assert(!text.includes(longLocation), `page ${i} truncates a long location`);
    assert(
      text.split("Dept/Unit:").length - 1 === 1,
      `page ${i} draws the continuation line once`,
    );
    assert(
      text.split(`Page ${i} of`).length - 1 === 1,
      `page ${i} footer is drawn once`,
    );
  }

  const page1Head = headStarts.find((row) => row.page === 1);
  const page2Head = headStarts.find((row) => row.page === 2);
  assert(page1Head && Math.abs(page1Head.y - startY) < 0.6, "page 1 column header stays at startY");
  assert(
    page2Head && page2Head.y >= margin + CONT_HEADER_H - 0.6,
    "page 2 column header starts at or below the continuation band",
  );

  const emptyDoc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const emptyCtx = {
    margin,
    pageWidth: emptyDoc.internal.pageSize.getWidth(),
    deptUnit: "",
    location: "   ",
    reqNoAndDate: "",
  };
  drawContinuationHeader(emptyDoc, emptyCtx);
  const emptyText = pdfLiterals(pageStream(emptyDoc, 1));
  assert(emptyText.includes("Dept/Unit:"), "empty department still prints the label");
  assert(emptyText.includes("Location:"), "blank location still prints the label");
  assert(emptyText.includes("Req No & Date:"), "empty req no and date still prints the label");
  assert(emptyText.includes("-"), "empty continuation values render '-'");

  const oneDoc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  oneDoc.autoTable({
    theme: "grid",
    showHead: "everyPage",
    head: [["SN", "Material Description"]],
    body: [["1", "Only line"]],
    startY,
    margin: {
      top: margin + CONT_HEADER_H,
      left: margin,
      right: margin,
      bottom: FOOTER_H,
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawContinuationHeader(oneDoc, ctx);
    },
  });
  assert(oneDoc.internal.getNumberOfPages() === 1, "a one-line indent stays on a single page");
  assert(
    !pdfLiterals(pageStream(oneDoc, 1)).includes("Dept/Unit:"),
    "single-page export does not draw a continuation header",
  );

  const sigDoc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  sigDoc.autoTable({
    theme: "grid",
    head: [["SN"]],
    body: [["1"]],
    startY,
    margin: { top: margin, left: margin, right: margin, bottom: FOOTER_H },
  });
  assert(sigDoc.internal.getNumberOfPages() === 1, "signature fixture starts on one page");
  sigDoc.addPage("a4", "landscape");
  drawContinuationHeader(sigDoc, ctx);
  const overflowSigY = margin + CONT_HEADER_H + 20;
  sigDoc.setFont("helvetica", "normal").setFontSize(8).setTextColor(0);
  sigDoc.text("Prepared / Requested By", margin, overflowSigY + 4);
  const sigPage1 = pdfLiterals(pageStream(sigDoc, 1));
  const sigPage2 = pdfLiterals(pageStream(sigDoc, 2));
  assert(!sigPage1.includes("Dept/Unit:"), "signature fixture page 1 has no continuation header");
  assert(sigPage2.includes("Dept/Unit:"), "signature overflow page draws Dept/Unit");
  assert(sigPage2.includes("Location:"), "signature overflow page draws Location");
  assert(sigPage2.includes("Req No & Date:"), "signature overflow page draws Req No & Date");
  assert(sigPage2.includes("Prepared / Requested By"), "signatures are drawn on the overflow page");

  const artifactDir = process.env.PEC_PDF_ARTIFACT_DIR || "/opt/cursor/artifacts";
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = join(artifactDir, "pec-pr-continuation-header-sample.pdf");
  writeFileSync(artifactPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`runtime sample: ${artifactPath} (${total} pages)`);
}

const jsPDF = loadJsPdf();
if (!jsPDF) {
  const message =
    "runtime SKIPPED — install jspdf@2.5.1 and jspdf-autotable@3.8.2 under /tmp/pec-pdf-libs or PEC_JSPDF_ROOT";
  if (process.env.PEC_PDF_RUNTIME === "required") fails.push(message);
  else console.log(message);
} else {
  try {
    runRuntime(jsPDF);
    console.log("runtime: PASS");
  } catch (err) {
    fails.push(`runtime render failed: ${err && err.stack ? err.stack : err}`);
  }
}

if (fails.length) {
  console.error("pec-pr-pdf-continuation-header-smoke FAILED:");
  for (const fail of fails) console.error(` - ${fail}`);
  process.exit(1);
}
console.log("pec-pr-pdf-continuation-header-smoke OK");
