// js/wip-stock.js
/* eslint-env browser */
/* global flatpickr, confirmDatePlugin, TomSelect */

import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

/* ══════════════════════════════════════════════════════════════
   1.  HELPER FUNCTIONS
   ══════════════════════════════════════════════════════════════ */
const fmtDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");

const todayStamp = () => {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0") +
    d.getFullYear()
  );
};

const show = (el) => {
  el.style.display = el.tagName === "TABLE" ? "table" : "flex";
};
const hide = (el) => {
  el.style.display = "none";
};

/* ─── FLATPICKR & INPUT-MASK FOR DD-MM-YYYY ─────────────────── */
// Base date-picker options
const fpBase = {
  dateFormat: "d-m-Y",
  allowInput: true,
  clickOpens: true,
  plugins: [
    confirmDatePlugin({
      showTodayButton: true,
      showClearButton: true,
      showConfirmButton: false,
      todayText: "Today",
      clearText: "Clear",
    }),
  ],
};

// Enforce digit-hyphen mask on an <input>
function attachMask(el) {
  el.addEventListener("input", () => {
    let v = el.value.replace(/\D/g, "").slice(0, 8);
    if (v.length > 2) v = v.slice(0, 2) + "-" + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
    el.value = v;
  });
}

/* --- render-race guard -------------------------------------- */
let tableVersion = 0; // bump every time we start a new refresh
// Pagination state
let currentPage = 1;
const pageSize = 20;
let filteredRows = [];

/* ══════════════════════════════════════════════════════════════
   2.  DOM REFERENCES
   ══════════════════════════════════════════════════════════════ */
const homeBtn = document.getElementById("homeBtn");
const fSection = document.getElementById("filterSection");
const fSub = document.getElementById("filterSubsection");
const fArea = document.getElementById("filterArea");
const fItem = document.getElementById("filterItem");
const fBN = document.getElementById("filterBN");
const fOverdue = document.getElementById("filterOverdue");
const btnClear = document.getElementById("clearFilters");

const downloadCsv = document.getElementById("downloadCsv");
const downloadPdf = document.getElementById("downloadPdf");

const tbody = document.getElementById("wipTableBody");

const overlay = document.getElementById("wipOverlay");
const closeWip = document.getElementById("closeWip");
const detailBody = document.getElementById("detailTable");

/* ══════════════════════════════════════════════════════════════
   3.  GENERIC SELECT “POPULATE” HELPER
   ══════════════════════════════════════════════════════════════ */
function populate(sel, rows, vKey, tKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r[vKey];
    opt.textContent = r[tKey];
    sel.append(opt);
  });
}

/* ══════════════════════════════════════════════════════════════
   4.  FILTER-LIST LOADERS
   ══════════════════════════════════════════════════════════════ */
async function loadSections() {
  const { data, error } = await supabase
    .from("sections")
    .select("id,section_name")
    .order("section_name");
  if (error) {
    console.error(error);
    return;
  }
  populate(fSection, data, "id", "section_name", "Section");
}

async function loadSubsections() {
  if (!fSection.value) {
    populate(fSub, [], "", "", "Sub-section");
    fSub.disabled = true;
    return;
  }
  const { data, error } = await supabase
    .from("subsections")
    .select("id,subsection_name")
    .eq("section_id", fSection.value)
    .order("subsection_name");
  if (error) {
    console.error(error);
    return;
  }
  populate(fSub, data, "id", "subsection_name", "Sub-section");
  fSub.disabled = false;
}

async function loadAreas() {
  if (!fSection.value || !fSub.value) {
    populate(fArea, [], "", "", "Area");
    fArea.disabled = true;
    return;
  }
  const { data, error } = await supabase
    .from("areas")
    .select("id,area_name")
    .eq("section_id", fSection.value)
    .eq("subsection_id", fSub.value)
    .order("area_name");
  if (error) {
    console.error(error);
    return;
  }
  populate(fArea, data, "id", "area_name", "Area");
  fArea.disabled = false;
}

async function loadBNs() {
  if (!fItem.value) {
    populate(fBN, [], "", "", "BN");
    fBN.disabled = true;
    return;
  }
  const { data, error } = await supabase
    .from("daily_work_log")
    .select("batch_number", { distinct: true })
    .eq("item", fItem.value)
    .order("batch_number");
  if (error) {
    console.error(error);
    return;
  }
  const unique = [...new Set(data.map((r) => r.batch_number))].map((bn) => ({
    bn,
  }));
  populate(fBN, unique, "bn", "bn", "BN");
  fBN.disabled = false;
}

/* ══════════════════════════════════════════════════════════════
   5.  MAIN TABLE RENDER (WITH DE-DUPLICATION)
   ══════════════════════════════════════════════════════════════ */

async function renderTable() {
  const myVersion = ++tableVersion;
  tbody.innerHTML = "";
  // Fetch all “Doing” entries
  const { data: raw = [], error } = await supabase
    .from("daily_work_log")
    .select(
      `id, log_date, section_id, subsection_id, area_id,
      item, batch_number, batch_size, batch_uom,
      activity, started_on, due_date`
    )
    .or(
      "status.eq.Doing," +
        'and(status.eq."In Storage",activity.eq."Intermediate storage")'
    );
  if (error) {
    console.error("loadStatus error:", error);
    return;
  }
  if (myVersion !== tableVersion) return;
  // Deduplicate
  const uniq = new Map();
  raw.forEach((r) => {
    const key = [
      r.item,
      r.batch_number,
      r.batch_size,
      r.batch_uom,
      r.activity,
    ].join("|");
    if (!uniq.has(key)) {
      uniq.set(key, { ...r });
    } else {
      const ex = uniq.get(key);
      if (r.started_on && (!ex.started_on || r.started_on < ex.started_on))
        ex.started_on = r.started_on;
      if (r.due_date && (!ex.due_date || r.due_date < ex.due_date))
        ex.due_date = r.due_date;
    }
  });
  let rows = Array.from(uniq.values());
  // Apply filters
  const dateFilter = document.getElementById("sLogDate").value;
  const actFilter = document.getElementById("sActivity").value;
  const todayISO = new Date().toISOString().slice(0, 10);
  rows = rows.filter((r) => {
    if (dateFilter) {
      const [dd, mm, yyyy] = dateFilter.split("-");
      if (r.log_date !== `${yyyy}-${mm}-${dd}`) return false;
    }
    if (actFilter && r.activity !== actFilter) return false;
    if (fOverdue.checked && (!r.due_date || r.due_date >= todayISO))
      return false;
    if (fSection.value && r.section_id !== +fSection.value) return false;
    if (fSub.value && r.subsection_id !== +fSub.value) return false;
    if (fArea.value && r.area_id !== +fArea.value) return false;
    if (fItem.value && r.item !== fItem.value) return false;
    if (fBN.value && r.batch_number !== fBN.value) return false;
    return true;
  });
  // Store filtered rows for export
  filteredRows = rows;
  // Sort
  rows.sort((a, b) => {
    if (fOverdue.checked) {
      const da = new Date(a.due_date),
        db = new Date(b.due_date);
      if (da - db) return da - db;
    } else {
      const la = new Date(a.log_date),
        lb = new Date(b.log_date);
      if (la - lb) return la - lb;
    }
    const ci = a.item.localeCompare(b.item);
    if (ci) return ci;
    return a.activity.localeCompare(b.activity);
  });
  // Row count display
  document.getElementById("rowCount").textContent = `${rows.length} rows`;
  // Pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pageRows = rows.slice(startIdx, endIdx);
  // Render rows
  pageRows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(r.log_date)}</td>
      <td>${r.item}</td>
      <td>${r.batch_number}</td>
      <td>${r.batch_size ?? ""}</td>
      <td>${r.batch_uom ?? ""}</td>
      <td>${r.activity}</td>
      <td>${fmtDate(r.started_on)}</td>
      <td>${fmtDate(r.due_date)}</td>
      <td><a href="#" class="view-link" data-id="${r.id}">View</a></td>
    `;
    tbody.append(tr);
  });
  // Wire up “View” links
  tbody.querySelectorAll(".view-link").forEach((a) => {
    a.removeEventListener("click", showDetails);
    a.addEventListener("click", showDetails);
  });
  // Render pagination controls
  renderPagination(totalPages);
}
function renderPagination(totalPages) {
  const pag = document.getElementById("pagination");
  pag.innerHTML = "";
  if (totalPages <= 1) return;
  const prev = document.createElement("button");
  prev.textContent = "Prev";
  prev.disabled = currentPage === 1;
  prev.onclick = () => {
    currentPage--;
    renderTable();
  };
  pag.appendChild(prev);
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.disabled = i === currentPage;
    btn.onclick = () => {
      currentPage = i;
      renderTable();
    };
    pag.appendChild(btn);
  }
  const next = document.createElement("button");
  next.textContent = "Next";
  next.disabled = currentPage === totalPages;
  next.onclick = () => {
    currentPage++;
    renderTable();
  };
  pag.appendChild(next);
}

/* ══════════════════════════════════════════════════════════════
   6.  “VIEW” MODAL
   ══════════════════════════════════════════════════════════════ */
async function showDetails(evt) {
  evt.preventDefault();
  const id = evt.currentTarget.dataset.id;

  const { data: d, error } = await supabase
    .from("daily_work_log")
    .select(
      `
      *, sections(section_name),
         subsections(subsection_name),
         areas(area_name)
    `
    )
    .eq("id", id)
    .single();
  if (error) {
    console.error(error);
    return;
  }

  detailBody.innerHTML = "";
  const fields = [
    ["Date", fmtDate(d.log_date)],
    ["Section", d.sections?.section_name],
    ["Sub-section", d.subsections?.subsection_name],
    ["Area", d.areas?.area_name],
    ["Item", d.item],
    ["Batch #", d.batch_number],
    ["Batch Size", d.batch_size],
    ["Batch UOM", d.batch_uom],
    ["Activity", d.activity],
    ["Juice/Decoction", d.juice_or_decoction],
    ["Specify", d.specify],
    ["RM Juice Qty", d.rm_juice_qty],
    ["RM Juice UOM", d.rm_juice_uom],
    ["Count Saravam", d.count_of_saravam],
    ["Fuel", d.fuel],
    ["Fuel Under", d.fuel_under],
    ["Fuel Over", d.fuel_over],
    ["Started On", fmtDate(d.started_on)],
    ["Due Date", fmtDate(d.due_date)],
    ["Status", d.status],
    ["Completed On", fmtDate(d.completed_on)],
    ["Qty After Process", d.qty_after_process],
    ["UOM After", d.qty_uom],
    ["Lab Ref Number", d.lab_ref_number],
    ["SKU Breakdown", d.sku_breakdown],
    ["Storage Qty", d.storage_qty],
    ["Storage UOM", d.storage_qty_uom],
    ["Remarks", d.remarks],
    ["Uploaded By", d.uploaded_by],
    ["Created At", fmtDate(d.created_at)],
  ];

  detailBody.innerHTML = "";
  fields.forEach(([lbl, val]) => {
    if (val !== null && val !== undefined && val !== "") {
      detailBody.insertAdjacentHTML(
        "beforeend",
        `<tr><th>${lbl}</th><td>${val}</td></tr>`
      );
    }
  });

  show(overlay);
}

/* ══════════════════════════════════════════════════════════════
   7.  EXPORTS
   ══════════════════════════════════════════════════════════════ */
function exportCsv() {
  const headers = [
    "Date",
    "Item",
    "BN",
    "Size",
    "UOM",
    "Activity",
    "Started On",
    "Due On",
  ];
  const rows = filteredRows.map((r) =>
    [
      fmtDate(r.log_date),
      r.item,
      r.batch_number,
      r.batch_size ?? "",
      r.batch_uom ?? "",
      r.activity,
      fmtDate(r.started_on),
      fmtDate(r.due_date),
    ]
      .map((val) => `"${String(val).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [headers.map((h) => `"${h}"`).join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `${todayStamp()}_wip_stock.csv`,
  });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* --------------  PDF (rows won't split across pages) --- */
function exportPdf() {
  const { jsPDF } = window.jspdf;
  const totalRows = filteredRows.length; // number to print
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const leftMargin = 40;
  const rightMargin = 40;
  const tableTopY = 110; // where the table will start

  /* ── Header block ───────────────────────────────────── */
  doc
    .setFont("Helvetica", "normal")
    .setFontSize(10)
    .text("Gurucharanam Saranam", pw / 2, 30, { align: "center" });

  doc
    .setFont("Helvetica", "bold")
    .setFontSize(12)
    .text("Santhigiri Ayurveda Siddha Vaidyasala", pw / 2, 55, {
      align: "center",
    });

  doc
    .setFont("Helvetica", "bold")
    .setFontSize(14)
    .text(
      `WIP SOH AS ON ${new Date().toLocaleDateString("en-GB")}`,
      pw / 2,
      85,
      { align: "center" }
    );

  /* ── Row-count label ────────────────────────────────── */
  doc
    .setFont("Helvetica", "bold")
    .setFontSize(10)
    .text(`${totalRows} ROWS`, pw - rightMargin, tableTopY - 12, {
      align: "right",
    });

  /* ── Table ──────────────────────────────────────────── */
  const head = [
    "Date",
    "Item",
    "BN",
    "Size",
    "UOM",
    "Activity",
    "Started On",
    "Due On",
  ];
  const body = filteredRows.map((r) => [
    fmtDate(r.log_date),
    r.item,
    r.batch_number,
    r.batch_size ?? "",
    r.batch_uom ?? "",
    r.activity,
    fmtDate(r.started_on),
    fmtDate(r.due_date),
  ]);

  doc.autoTable({
    startY: tableTopY,
    head: [head],
    body,
    theme: "grid",
    margin: { left: leftMargin, right: rightMargin, top: 40, bottom: 40 },
    rowPageBreak: "avoid",
    styles: {
      font: "Helvetica",
      fontStyle: "normal",
      fontSize: 10,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      font: "Helvetica",
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
    },
    columnStyles: { 0: { halign: "left" } },
    willDrawCell: (d) =>
      doc.setFont("Helvetica", d.section === "head" ? "bold" : "normal"),
    didDrawPage: () => {
      doc
        .setFont("Helvetica", "normal")
        .setFontSize(10)
        .text(
          `Page ${doc.internal.getNumberOfPages()}`,
          pw - rightMargin,
          ph - 10,
          { align: "right" }
        );
    },
  });

  doc.save(`${todayStamp()}_wip_stock.pdf`);
}

/* ══════════════════════════════════════════════════════════════
   8.  CLEAR FILTERS
   ══════════════════════════════════════════════════════════════ */
function clearAll() {
  // Reset the new filters
  document.getElementById("sLogDate").value = "";
  document.getElementById("sActivity").value = "";

  // Reset Section → Sub → Area → Item → BN
  [fSection, fSub, fArea, fItem, fBN].forEach((sel) => {
    sel.value = "";
    // only Section and Item stay enabled
    sel.disabled = sel !== fSection && sel !== fItem;
  });

  // Reset Overdue checkbox
  fOverdue.checked = false;

  // Re-render
  renderTable();
}

/* ══════════════════════════════════════════════════════════════
   TOM SELECT  (Item  +  Activity)
   ══════════════════════════════════════════════════════════════ */

/* ---------- Item (Tom Select) -------------------------------- */
async function fetchItemsTS(q) {
  const { data, error } = await supabase
    .from("daily_work_log")
    .select("item", { distinct: true })
    .ilike("item", `%${q}%`)
    .limit(20);

  if (error) {
    console.error("Item fetch", error);
    return [];
  }

  return [...new Set(data.map((r) => r.item).filter(Boolean))].map((item) => ({
    item,
  }));
}

const itemTS = new TomSelect("#filterItem", {
  valueField: "item",
  labelField: "item",
  searchField: ["item"],
  load: (q, cb) => (q ? fetchItemsTS(q).then(cb) : cb()),
  maxOptions: 20,
  create: false,
});

/* when an Item is actually chosen (click **or** Enter) */
itemTS.on("item_add", async () => {
  await loadBNs(); // repopulate BN list (enables #filterBN)
  renderTable(); // refresh the grid

  // release focus and move to BN
  itemTS.control_input.blur();
  itemTS.blur();
  requestAnimationFrame(() => {
    const bn = document.getElementById("filterBN");
    if (!bn.disabled) bn.focus();
  });
});

/* safeguard: programmatic value changes */
document.getElementById("filterItem").addEventListener("change", async () => {
  await loadBNs();
  renderTable();
});

/* ---------- Activity (Tom Select) ---------------------------- */
async function fetchActsTS(q) {
  let sb = supabase
    .from("daily_work_log")
    .select("activity", { distinct: true })
    .ilike("activity", `%${q}%`)
    .limit(20);

  const itm = document.getElementById("filterItem").value;
  const bn = document.getElementById("filterBN").value;
  if (itm) sb = sb.eq("item", itm);
  if (bn) sb = sb.eq("batch_number", bn);

  const { data, error } = await sb;
  if (error) {
    console.error("Activity fetch", error);
    return [];
  }
  return [...new Set(data.map((r) => r.activity).filter(Boolean))].map(
    (activity) => ({ activity })
  );
}

// instantiate without assigning to avoid "assigned but never used"
new TomSelect("#sActivity", {
  valueField: "activity",
  labelField: "activity",
  searchField: ["activity"],
  load: (q, cb) => (q ? fetchActsTS(q).then(cb) : cb()),
  maxOptions: 20,
  create: false,
});

document.getElementById("sActivity").addEventListener("change", renderTable);

/* ══════════════════════════════════════════════════════════════
   9.  INITIALISATION
   ══════════════════════════════════════════════════════════════ */
async function init() {
  // ─── Grab new controls ───────────────────────────────────────
  const sLogDate = document.getElementById("sLogDate");
  const sActivity = document.getElementById("sActivity");
  const toggleAdvanced = document.getElementById("toggleAdvanced");
  const advancedFilters = document.getElementById("advancedFilters");

  // ─── Date-picker & mask ──────────────────────────────────────
  attachMask(sLogDate);
  flatpickr(sLogDate, fpBase);

  // ─── Core buttons ────────────────────────────────────────────
  // HOME → Hub home if in Hub, otherwise Workspace home
  if (homeBtn) homeBtn.onclick = () => Platform.goHome();
  closeWip.onclick = () => hide(overlay);
  downloadCsv.onclick = exportCsv;
  downloadPdf.onclick = exportPdf;

  // ─── Clear filters + collapse Advanced ───────────────────────
  btnClear.onclick = () => {
    clearAll();
    advancedFilters.style.display = "none";
    toggleAdvanced.textContent = "Advanced ▾";
  };

  // ─── Toggle Advanced filters row ─────────────────────────────
  toggleAdvanced.onclick = () => {
    const isOpen = advancedFilters.style.display === "flex";
    advancedFilters.style.display = isOpen ? "none" : "flex";
    toggleAdvanced.textContent = isOpen ? "Advanced ▾" : "Advanced ▴";
  };

  // ─── Disable dependent selects initially ────────────────────
  fSub.disabled = fArea.disabled = fBN.disabled = true;

  // ─── Load initial dropdowns ──────────────────────────────────
  await loadSections();

  // (removed: unused uniqueActs preload block)

  // ─── Re-render table on date or activity change ────────────
  sLogDate.addEventListener("change", renderTable);
  sActivity.addEventListener("change", renderTable);

  // ─── Cascade listeners: Section → Sub → Area ────────────────
  fSection.onchange = async () => {
    await loadSubsections();
    fArea.innerHTML = '<option value="">Area</option>';
    fArea.disabled = true;
    renderTable();
  };
  fSub.onchange = async () => {
    await loadAreas();
    renderTable();
  };
  fArea.onchange = renderTable;

  // ─── Other filters: Item, BN, Overdue ────────────────────────
  fItem.onchange = async () => {
    await loadBNs();
    renderTable();
  };
  fBN.onchange = renderTable;
  fOverdue.onchange = renderTable;

  // ─── First paint ─────────────────────────────────────────────
  await renderTable();
}

document.addEventListener("DOMContentLoaded", init);
