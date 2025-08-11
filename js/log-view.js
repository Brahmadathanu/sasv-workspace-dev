/* global flatpickr, confirmDatePlugin, TomSelect */

import { supabase } from "../public/shared/js/supabaseClient.js";

/* ── Flatpickr base config -------------------------------------------------- */
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

const toISODate = (s) => {
  const [d, m, y] = s.split("-");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

/* Simple mask that inserts “-” while typing */
const attachMask = (el) =>
  el.addEventListener("input", () => {
    let v = el.value.replace(/\D/g, "").slice(0, 8);
    if (v.length > 2) v = v.slice(0, 2) + "-" + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
    el.value = v;
  });

/* ── Short DOM helper ------------------------------------------------------- */
const $ = (s) => document.querySelector(s);

/* ── Element refs ----------------------------------------------------------- */
const homeBtn = $("#homeBtn");
const backBtn = $("#backBtn");
const fDate = $("#filterDate");
const fSection = $("#filterSection");
const fSub = $("#filterSubsection");
const fArea = $("#filterArea");
const fPlant = $("#filterPlant");
const fItem = $("#filterItem");
const fBN = $("#filterBN");
const fAct = $("#filterActivity");
const fStatus = $("#filterStatus");
const clearBtn = $("#clearFilters");

const toggleAdvanced = $("#toggleAdvanced");
const filtersAdvanced = $("#filtersAdvanced");

const dlCsv = $("#downloadCsv");
const dlPdf = $("#downloadPdf");

const tbody = $("#logsTableBody");
const overlay = $("#viewOverlay");
const detailBody = $("#detailTable");
const btnClose = $("#closeView");

/* ── Helpers ---------------------------------------------------------------- */
const show = (el) =>
  (el.style.display = el.tagName === "TABLE" ? "table" : "flex");
const hide = (el) => (el.style.display = "none");

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");

/* YYYYMMDD stamp for filenames */
const todayStamp = () => {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0") +
    d.getFullYear()
  );
};

const populate = (sel, rows, valKey, txtKey, ph) =>
  (sel.innerHTML =
    `<option value="">${ph}</option>` +
    rows
      .map((r) => `<option value="${r[valKey]}">${r[txtKey]}</option>`)
      .join(""));

/* Section-name cache (for table render) */
const sectionMap = {};

/* ─── Render-race guard ──────────────────────────────────────────────── */
/* Every time we start a new table refresh we bump this number. Only the
   request that finishes _last_ is allowed to update the DOM.            */
let queryVersion = 0;

/* ── Initial bootstrap ------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  /* Home nav */
  homeBtn.onclick = () => (location.href = "index.html");
  backBtn.onclick = () => window.history.back();

  /* Date picker + mask */
  attachMask(fDate);
  flatpickr(fDate, fpBase);
  fDate.addEventListener("change", loadTable);

  /* Close details modal */
  btnClose.onclick = () => hide(overlay);

  /* Clear filters */
  clearBtn.onclick = () => {
    // 1) Reset native filter values
    [fDate, fSection, fSub, fArea, fStatus].forEach((el) => (el.value = ""));

    // 2) Reset Tom Select fields using Tom Select API (except BN)
    itemTomSelect.clear();
    activityTomSelect.clear();

    // 2b) Explicitly disable Plant (Tom Select + native)
    setPlantEnabled(false);

    fPlant.value = "";

    // 3) Reset BN dropdown to empty and disable
    populate(fBN, [], "", "", "BN");
    fBN.disabled = true;

    // 4) Disable cascading selects (Sub-section, Area)
    [fSub, fArea].forEach((el) => (el.disabled = true));

    // 5) Repopulate dependents
    cascadeSub();
    cascadeArea();
    loadBNs();
    loadPlants();
    updatePlantEnabled(); // ensure final state is consistent

    // 6) Collapse advanced filters and reset toggle text
    filtersAdvanced.style.display = "none";
    toggleAdvanced.textContent = "Advanced ▾";

    // 7) Reload the table
    loadTable();
  };

  // ─── Wire up Advanced ▾/▴ toggle ────────────────────────────────────
  toggleAdvanced.onclick = () => {
    const isOpen = filtersAdvanced.style.display === "flex";
    filtersAdvanced.style.display = isOpen ? "none" : "flex";
    toggleAdvanced.textContent = isOpen ? "Advanced ▾" : "Advanced ▴";
  };

  /* Export links */
  dlCsv.addEventListener("click", exportCsv);
  dlPdf.addEventListener("click", exportPdf);

  /* Section lookup + populate */
  const { data: secs } = await supabase
    .from("sections")
    .select("id,section_name")
    .order("section_name");

  if (secs)
    secs.forEach((s) => {
      sectionMap[s.id] = s.section_name;
    });
  populate(fSection, secs || [], "id", "section_name", "Section");

  /* Cascading wiring */
  fSection.onchange = () => {
    cascadeSub();
    cascadeArea();
    loadBNs();
    updatePlantEnabled();
    loadPlants();
    loadTable();
  };
  fSub.onchange = () => {
    cascadeArea();
    updatePlantEnabled();
    loadPlants();
    loadTable();
  };
  fArea.onchange = () => {
    updatePlantEnabled();
    loadPlants();
    loadTable();
  };
  fPlant.onchange = () => {
    loadTable();
  };

  fBN.onchange = loadTable;
  fAct.onchange = loadTable;
  fStatus.onchange = loadTable;

  /* First pass */
  cascadeSub();
  cascadeArea();
  updatePlantEnabled();
  await loadPlants();

  await loadTable();
}

// ========== AUTOCOMPLETE FOR ITEM FIELD ==========

// Helper function: fetch matching items from Supabase
async function fetchItemsFromSupabase(query) {
  let sbQuery = supabase
    .from("daily_work_log")
    .select("item", { distinct: true })
    .ilike("item", `%${query}%`)
    .limit(20);

  // Optional: add other filters here if needed

  const { data, error } = await sbQuery;
  if (error) {
    console.error("Supabase item fetch error:", error);
    return [];
  }
  // Remove duplicates and empty
  return [...new Set((data || []).map((r) => r.item).filter(Boolean))].map(
    (item) => ({ item: item })
  );
}

// Initialize Tom Select for the Item filter
const itemTomSelect = new TomSelect("#filterItem", {
  valueField: "item",
  labelField: "item",
  searchField: ["item"],
  load: function (query, callback) {
    // Only fetch if user typed something
    if (!query.length) return callback();
    fetchItemsFromSupabase(query).then((items) => {
      callback(items);
    });
  },
  maxOptions: 20,
  create: false,
});

// When Item changes, reload BN dropdown and table
fItem.addEventListener("change", () => {
  loadBNs();
  activityTomSelect.clear();
  loadTable();
});
fBN.addEventListener("change", () => {
  activityTomSelect.clear();
  loadTable();
});

// Load BN options for the selected item
async function loadBNs() {
  // If no item is selected, clear and disable BN dropdown
  if (!fItem.value) {
    populate(fBN, [], "", "", "BN");
    fBN.disabled = true;
    return;
  }
  // Fetch unique BNs for the selected item
  const { data, error } = await supabase
    .from("daily_work_log")
    .select("batch_number", { distinct: true })
    .eq("item", fItem.value)
    .order("batch_number", { ascending: true });
  if (error) {
    console.error("BN fetch error", error);
    populate(fBN, [], "", "", "BN");
    fBN.disabled = true;
    return;
  }
  const uniqueBNs = [
    ...new Set((data || []).map((r) => r.batch_number).filter(Boolean)),
  ].map((bn) => ({ bn }));
  populate(fBN, uniqueBNs, "bn", "bn", "BN");
  fBN.disabled = !uniqueBNs.length;
}

// Load Plant/Machinery options into the native <select>
async function loadPlants() {
  // Only load if enabled by higher filters
  if (fPlant.disabled) return;

  let q = supabase
    .from("plant_machinery")
    .select("id, plant_name, area_id, status")
    .eq("status", "O")
    .order("plant_name", { ascending: true });

  if (fArea.value) {
    q = q.eq("area_id", fArea.value);
  }
  // else: show all operational plants

  const { data, error } = await q;
  if (error) {
    console.error("Plant load error:", error);
    fPlant.innerHTML = `<option value="">Plant / Machinery</option>`;
    return;
  }

  const opts = [
    `<option value="">Plant / Machinery</option>`,
    ...(data || []).map(
      (r) => `<option value="${r.id}">${r.plant_name}</option>`
    ),
  ];
  fPlant.innerHTML = opts.join("");
}

// Helper: fetch matching Activity from Supabase based on current filters and input
async function fetchActivitiesFromSupabase(query) {
  let sbQuery = supabase
    .from("daily_work_log")
    .select("activity", { distinct: true })
    .ilike("activity", `%${query}%`)
    .limit(20);

  // Apply filters for Item and BN
  if (fItem.value) sbQuery = sbQuery.eq("item", fItem.value);
  if (fBN.value) sbQuery = sbQuery.eq("batch_number", fBN.value);

  const { data, error } = await sbQuery;
  if (error) {
    console.error("Supabase Activity fetch error:", error);
    return [];
  }
  return [...new Set((data || []).map((r) => r.activity).filter(Boolean))].map(
    (activity) => ({ activity: activity })
  );
}

const activityTomSelect = new TomSelect("#filterActivity", {
  valueField: "activity",
  labelField: "activity",
  searchField: ["activity"],
  load: function (query, callback) {
    if (!query.length) return callback();
    fetchActivitiesFromSupabase(query).then((acts) => {
      callback(acts);
    });
  },
  maxOptions: 20,
  create: false,
});

document.getElementById("filterActivity").addEventListener("change", loadTable);

/* ── Cascades --------------------------------------------------------------- */
function cascadeSub() {
  if (!fSection.value) {
    // Section cleared → clear Sub & Area and disable both
    populate(fSub, [], "", "", "Sub-section");
    fSub.disabled = true;

    populate(fArea, [], "", "", "Area");
    fArea.disabled = true;

    updatePlantEnabled(); // ← also disables Plant
  } else {
    supabase
      .from("subsections")
      .select("id,subsection_name")
      .eq("section_id", fSection.value)
      .order("subsection_name")
      .then(({ data }) => {
        populate(fSub, data || [], "id", "subsection_name", "Sub-section");
        fSub.disabled = !data || !data.length;
        updatePlantEnabled(); // ← might enable Plant if Section chosen
      });
  }
}

function cascadeArea() {
  if (!fSub.value) {
    // Sub-section cleared → clear Area and disable it
    populate(fArea, [], "", "", "Area");
    fArea.disabled = true;
    updatePlantEnabled(); // ← reassess Plant enabled state
  } else {
    supabase
      .from("areas")
      .select("id,area_name")
      .eq("section_id", fSection.value) // honor current Section
      .eq("subsection_id", fSub.value)
      .order("area_name")
      .then(({ data }) => {
        populate(fArea, data || [], "id", "area_name", "Area");
        fArea.disabled = !data || !data.length;
        updatePlantEnabled(); // ← might enable Plant if Area now chosen
      });
  }
}

// === Plant enable/disable for native <select> ===//
function setPlantEnabled(enabled) {
  fPlant.disabled = !enabled;
  if (!enabled) {
    fPlant.innerHTML = `<option value="">Plant / Machinery</option>`;
    fPlant.value = "";
  }
}

function updatePlantEnabled() {
  const shouldEnable = Boolean(fSection.value || fSub.value || fArea.value);
  setPlantEnabled(shouldEnable);
}

// start disabled until a higher filter (Section/Sub/Area) is chosen
setPlantEnabled(false);

/* ── Main table refresh ----------------------------------------------------- */
async function loadTable() {
  /* 1️⃣ – stamp THIS request and mark it as “latest so far” */
  const myVersion = ++queryVersion; // bump the global counter

  /* 2️⃣ – Detect whether any filter is active (unchanged) */
  const hasFilter = Boolean(
    fDate.value ||
      fSection.value ||
      fSub.value ||
      fArea.value ||
      fPlant.value ||
      fItem.value ||
      fBN.value ||
      fAct.value ||
      fStatus.value
  );

  /* 3️⃣ – Build the Supabase query (unchanged) */
  let q = supabase.from("daily_work_log").select(`
      id,
      log_date,
      item,
      batch_number,
      batch_size,
      batch_uom,
      section_id,
      activity,
      plant_id,
      status,
      created_at,
      plant_machinery(plant_name)
    `);

  if (fDate.value) q = q.eq("log_date", toISODate(fDate.value));
  if (fSection.value) q = q.eq("section_id", fSection.value);
  if (fSub.value) q = q.eq("subsection_id", fSub.value);
  if (fArea.value) q = q.eq("area_id", fArea.value);
  if (fPlant.value) {
    q = q.eq("plant_id", fPlant.value);
  }

  if (fItem.value) q = q.eq("item", fItem.value);
  if (fBN.value) q = q.eq("batch_number", fBN.value);
  if (fAct.value) q = q.eq("activity", fAct.value);
  if (fStatus.value) q = q.eq("status", fStatus.value);

  q = q
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (!hasFilter) q = q.limit(10);

  /* 4️⃣ – Run the query */
  const { data, error } = await q;
  if (error) {
    console.error(error);
    return;
  }

  /* 5️⃣ – ABANDON if a newer request has started meanwhile */
  if (myVersion !== queryVersion) return;

  /* 6️⃣ – We are still the newest ➜ clear and render */
  tbody.replaceChildren();

  const rows = data ? data.slice() : [];

  /* 7️⃣ – Natural-order sort (unchanged) */
  const coll = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  rows.sort((a, b) => {
    let diff = new Date(a.log_date) - new Date(b.log_date);
    if (diff) return diff;
    diff = new Date(a.created_at) - new Date(b.created_at);
    if (diff) return diff;
    diff = a.item.localeCompare(b.item, undefined, { sensitivity: "base" });
    if (diff) return diff;
    diff = a.batch_number
      .toString()
      .localeCompare(b.batch_number.toString(), undefined, { numeric: true });
    if (diff) return diff;
    const sa = sectionMap[a.section_id] || "";
    const sb = sectionMap[b.section_id] || "";
    diff = sa.localeCompare(sb, undefined, { sensitivity: "base" });
    if (diff) return diff;
    const pa = a.plant_machinery?.plant_name || "";
    const pb = b.plant_machinery?.plant_name || "";
    return coll.compare(pa, pb);
  });

  /* 8️⃣ – Render rows (unchanged) */
  rows.forEach((r) => {
    const plantName = r.plant_machinery?.plant_name || "";
    const sectionName = sectionMap[r.section_id] || "";
    tbody.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${fmtDate(r.log_date)}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${r.batch_size ?? ""}</td>
        <td>${r.batch_uom ?? ""}</td>
        <td>${sectionName}</td>
        <td>${plantName}</td>
        <td>${r.activity}</td>
        <td>${r.status ?? ""}</td>
        <td><a href="#" class="view-link" data-id="${r.id}">View</a></td>
      </tr>
    `
    );
  });

  /* 9️⃣ – Attach “View” links (unchanged) */
  document
    .querySelectorAll(".view-link")
    .forEach((a) => a.addEventListener("click", showDetails));
}

// Helper: fetch ALL logs with stable pagination (replaces your fetchAllLogs)
async function fetchAllLogs() {
  const pageSize = 1000; // Supabase default cap
  let page = 0;
  const all = [];

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("daily_work_log")
      .select(
        `
        log_date,
        item,
        batch_number,
        batch_size,
        batch_uom,
        section_id,
        activity,
        plant_id,
        status,
        created_at,
        id,
        plant_machinery(plant_name)
      `
      )
      // Use a stable, deterministic ordering for pagination:
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }) // tie-breaker to avoid misses/dupes
      .range(from, to);

    if (error) {
      console.error("Fetch all logs error:", error);
      break;
    }

    if (!data || data.length === 0) break;

    all.push(...data);

    if (data.length < pageSize) break; // last page reached
    page += 1;
  }

  return all;
}

/* ── Export: CSV (visible table rows) --------------------------------------- */
async function exportCsv() {
  // Table header labels (skip Action column)
  const headers = [
    "Date",
    "Item",
    "BN",
    "Batch Size",
    "UOM",
    "Section",
    "Plant / Machinery",
    "Activity",
    "Status",
  ]
    .map((h) => `"${h}"`)
    .join(",");

  // Check if any filter is active
  const hasFilter = Boolean(
    fDate.value ||
      fSection.value ||
      fSub.value ||
      fArea.value ||
      fPlant.value ||
      fItem.value ||
      fBN.value ||
      fAct.value ||
      fStatus.value
  );

  let rowsData;

  if (!hasFilter) {
    // No filters: fetch all from DB
    rowsData = await fetchAllLogs();
  } else {
    // Filters applied: use current visible rows
    rowsData = [...tbody.rows].map((tr) => {
      // slice(0, -1) drops the last "Action" column
      const cells = [...tr.cells].slice(0, -1);
      return cells.map((td) => td.textContent.trim());
    });
  }

  // Prepare CSV data
  const csvRows = [];
  if (!hasFilter) {
    // For full DB, format data
    for (const r of rowsData) {
      csvRows.push(
        [
          fmtDate(r.log_date),
          r.item,
          r.batch_number,
          r.batch_size ?? "",
          r.batch_uom ?? "",
          sectionMap[r.section_id] || "",
          r.plant_machinery?.plant_name || "",
          r.activity,
          r.status ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    }
  } else {
    // For visible, already processed above
    csvRows.push(
      ...rowsData.map((rowArr) =>
        rowArr.map((txt) => `"${txt.replace(/"/g, '""')}"`).join(",")
      )
    );
  }

  const csv = [headers, ...csvRows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${todayStamp()}_daily_work_logs.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Build a human-readable filter summary string for PDF/filenames/etc.
function buildFilterSummary() {
  const bits = [];

  // Date (already dd-mm-yyyy in input)
  if (fDate.value) bits.push(`Date: ${fDate.value}`);

  // Section / Sub / Area (use option text if present)
  if (fSection.value) {
    const secName =
      sectionMap[fSection.value] ||
      fSection.options[fSection.selectedIndex]?.text ||
      fSection.value;
    bits.push(`Section: ${secName}`);
  }
  if (fSub.value) {
    const subText = fSub.options[fSub.selectedIndex]?.text || fSub.value;
    bits.push(`Sub-section: ${subText}`);
  }
  if (fArea.value) {
    const areaText = fArea.options[fArea.selectedIndex]?.text || fArea.value;
    bits.push(`Area: ${areaText}`);
  }

  // Plant (safe to read option text too)
  if (fPlant.value) {
    const plantText =
      document.querySelector("#filterPlant option:checked")?.text ||
      fPlant.value;
    bits.push(`Plant: ${plantText}`);
  }

  // Item / BN / Activity / Status (Tom Selects store strings as values)
  if (fItem.value) bits.push(`Item: ${fItem.value}`);
  if (fBN.value) bits.push(`BN: ${fBN.value}`);
  if (fAct.value) bits.push(`Activity: ${fAct.value}`);
  if (fStatus.value) bits.push(`Status: ${fStatus.value}`);

  return bits;
}

/* ── Export: PDF (visible table rows) --------------------------------------- */
async function exportPdf() {
  const jsPDFCtor = window.jspdf?.jsPDF || window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFCtor) {
    console.error("jsPDF not found. Did the script load?");
    return;
  }

  const doc = new jsPDFCtor({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc
    .setFont("helvetica", "normal")
    .setFontSize(10)
    .text("Gurucharanam Saranam", pw / 2, 30, { align: "center" });
  doc
    .setFont("helvetica", "bold")
    .setFontSize(12)
    .text("Santhigiri Ayurveda Siddha Vaidyasala", pw / 2, 50, {
      align: "center",
    });
  doc
    .setFont("helvetica", "bold")
    .setFontSize(14)
    .text(
      `DAILY WORK LOGS AS ON ${new Date().toLocaleDateString("en-GB")}`,
      pw / 2,
      75,
      { align: "center" }
    );

  // Check filters
  const hasFilter = Boolean(
    fDate.value ||
      fSection.value ||
      fSub.value ||
      fArea.value ||
      fPlant.value ||
      fItem.value ||
      fBN.value ||
      fAct.value ||
      fStatus.value
  );

  let data = [];

  if (!hasFilter) {
    // No filters: fetch all logs
    const allRows = await fetchAllLogs();
    data = allRows.map((r) => ({
      date: fmtDate(r.log_date),
      item: r.item,
      bn: r.batch_number,
      size: r.batch_size ?? "",
      uom: r.batch_uom ?? "",
      section: sectionMap[r.section_id] || "",
      plant: r.plant_machinery?.plant_name || "",
      act: r.activity,
      status: r.status ?? "",
    }));
  } else {
    // Filters: use visible
    data = [...tbody.rows].map((tr) => {
      const c = [...tr.cells];
      return {
        date: c[0].textContent.trim(),
        item: c[1].textContent.trim(),
        bn: c[2].textContent.trim(),
        size: c[3].textContent.trim(),
        uom: c[4].textContent.trim(),
        section: c[5].textContent.trim(),
        plant: c[6].textContent.trim(),
        act: c[7].textContent.trim(),
        status: c[8].textContent.trim(),
      };
    });
  }

  // Build a clean summary line and wrap to page width
  const filtBits = buildFilterSummary();
  let tableStartY = 95; // default if no filters

  if (filtBits.length) {
    doc.setFont("helvetica", "normal").setFontSize(9);

    // Join with separators and wrap to available width
    const summary = filtBits.join("  |  ");
    const wrapped = doc.splitTextToSize(summary, pw - 80); // 40pt margin on both sides

    // Print each wrapped line centered
    let y = 88;
    wrapped.forEach((line) => {
      doc.text(line, pw / 2, y, { align: "center" });
      y += 12; // line height
    });

    tableStartY = y + 5; // push table down below the summary
  }

  doc.autoTable({
    startY: tableStartY,
    margin: { left: 40, right: 40 },
    theme: "grid",
    columns: [
      { header: "Date", dataKey: "date" },
      { header: "Item", dataKey: "item" },
      { header: "BN", dataKey: "bn" },
      { header: "Batch Size", dataKey: "size" },
      { header: "UOM", dataKey: "uom" },
      { header: "Section", dataKey: "section" },
      { header: "Plant / Machinery", dataKey: "plant" },
      { header: "Activity", dataKey: "act" },
      { header: "Status", dataKey: "status" },
    ],
    body: data,
    styles: {
      font: "helvetica",
      fontSize: 9,
      halign: "center",
      valign: "middle",
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
    },
    headStyles: {
      font: "helvetica",
      fontStyle: "bold",
      fontSize: 9,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.25,
      halign: "center",
    },
    columnStyles: {
      item: { halign: "left" },
      section: { halign: "left" },
      plant: { halign: "left" },
      act: { halign: "left" },
    },
    rowPageBreak: "avoid",

    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.styles.fontStyle = "bold";
      }
    },
    willDrawCell: (data) => {
      if (data.section === "head") {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }
    },
    didDrawPage: () => {
      doc.setFont("Helvetica", "normal").setFontSize(9);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pw - 40, ph - 10, {
        align: "right",
      });
    },
  });

  doc.save(`${todayStamp()}_daily_work_logs.pdf`);
}

/* ── Details modal ---------------------------------------------------------- */
async function showDetails(e) {
  e.preventDefault();
  const id = e.currentTarget.dataset.id;

  const { data: log, error } = await supabase
    .from("daily_work_log")
    .select(
      `
      *,sections(section_name),subsections(subsection_name),
      areas(area_name),plant_machinery(plant_name)
    `
    )
    .eq("id", id)
    .single();
  if (error) return console.error(error);

  detailBody.innerHTML = "";
  const rows = [
    ["Date", fmtDate(log.log_date)],
    ["Section", log.sections?.section_name],
    ["Sub-section", log.subsections?.subsection_name],
    ["Area", log.areas?.area_name],
    ["Plant / Machinery", log.plant_machinery?.plant_name],
    ["Item", log.item],
    ["Batch #", log.batch_number],
    ["Batch Size", log.batch_size],
    ["Batch UOM", log.batch_uom],
    ["Activity", log.activity],
    ["Juice/Decoction", log.juice_or_decoction],
    ["Specify", log.specify],
    ["RM Juice Qty", log.rm_juice_qty], // NEW
    ["RM Juice UOM", log.rm_juice_uom], // NEW
    ["Count Saravam", log.count_of_saravam],
    ["Fuel", log.fuel],
    ["Fuel Under", log.fuel_under],
    ["Fuel Over", log.fuel_over],
    ["Started On", fmtDate(log.started_on)],
    ["Due Date", fmtDate(log.due_date)],
    ["Status", log.status],
    ["Completed On", fmtDate(log.completed_on)],
    ["Qty After Process", log.qty_after_process],
    ["UOM After", log.qty_uom],
    ["Lab Ref Number", log.lab_ref_number],
    ["SKU Breakdown", log.sku_breakdown],
    ["Storage Qty", log.storage_qty], // NEW
    ["Storage UOM", log.storage_qty_uom], // NEW
    ["Remarks", log.remarks],
    ["Uploaded By", log.uploaded_by],
    ["Created At", fmtDate(log.created_at)],
  ];

  rows.forEach(([lbl, val]) => {
    if (val !== null && val !== undefined && val !== "") {
      detailBody.insertAdjacentHTML(
        "beforeend",
        `<tr><th>${lbl}</th><td>${val}</td></tr>`
      );
    }
  });

  show(overlay);
}
