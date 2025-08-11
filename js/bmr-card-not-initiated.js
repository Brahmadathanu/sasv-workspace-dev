/* global TomSelect */
// js/bmr-card-not-initiated.js
import { supabase } from "../public/shared/js/supabaseClient.js";

const homeBtn = document.getElementById("homeBtn");
const backBtn = document.getElementById("backBtn");
const filterCategory = document.getElementById("filterCategory");
const filterSubCat = document.getElementById("filterSubCategory");
const filterGroup = document.getElementById("filterGroup");
const filterSubGrp = document.getElementById("filterSubGroup");
const filterItem = document.getElementById("filterItem");
const filterBN = document.getElementById("filterBN");
const clearBtn = document.getElementById("clearFilters");
const downloadCsv = document.getElementById("downloadCsv");
const downloadPdf = document.getElementById("downloadPdf");
const tbody = document.getElementById("bmrCardTableBody");
const toggleAdvanced = document.getElementById("toggleAdvanced");
const filtersAdvanced = document.getElementById("filtersAdvanced");

let itemTS = null; // Tom Select instance for #filterItem

let allRows = [];

/** Fill a <select> with an array of strings */
function fillSelect(el, arr, placeholder) {
  el.innerHTML =
    `<option value="">${placeholder}</option>` +
    arr.map((v) => `<option value="${v}">${v}</option>`).join("");
}

/** YYYYMMDD stamp for exports */
function todayStamp() {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, "0") +
    String(d.getMonth() + 1).padStart(2, "0") +
    d.getFullYear()
  );
}

// ——— Item suggestions: fetch from DB on-type (respects cascades) ———
async function fetchItemOptions(query) {
  let sb = supabase
    .from("bmr_card_not_initiated")
    .select("item", { distinct: true })
    .ilike("item", `%${query}%`)
    .limit(20);

  // Apply current cascade filters so suggestions are relevant
  if (filterCategory.value) sb = sb.eq("category", filterCategory.value);
  if (filterSubCat.value) sb = sb.eq("subcategory", filterSubCat.value);
  if (filterGroup.value) sb = sb.eq("product_group", filterGroup.value);
  if (filterSubGrp.value) sb = sb.eq("subgroup", filterSubGrp.value);

  const { data, error } = await sb;
  if (error) {
    console.error("Item fetch error:", error);
    return [];
  }
  // Tom Select expects [{value, text}, ...]
  return (data || [])
    .map((r) => r.item)
    .filter(Boolean)
    .map((v) => ({ value: v, text: v }));
}

function resetItemSuggestions() {
  if (!itemTS) return;
  itemTS.clear(true); // clear selection (silent)
  itemTS.clearOptions(); // drop any cached options
  itemTS.refreshOptions(false);
}

function hasActiveFilters() {
  return Boolean(
    filterCategory.value ||
      filterSubCat.value ||
      filterGroup.value ||
      filterSubGrp.value ||
      filterItem.value ||
      filterBN.value
  );
}

/* use the exact same sort order as the table */
function sortBmrRows(rows) {
  const copy = rows.slice();
  copy.sort((a, b) => {
    const order = [
      ["category", false],
      ["subcategory", false],
      ["product_group", false],
      ["subgroup", false],
      ["item", false],
      ["bn", true],
    ];
    for (const [key, numeric] of order) {
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      if (av === bv) continue;
      if (numeric)
        return String(av).localeCompare(String(bv), undefined, {
          numeric: true,
        });
      return av < bv ? -1 : 1;
    }
    return 0;
  });
  return copy;
}

function buildFilterSummaryBits() {
  const bits = [];
  if (filterCategory.value) bits.push(`Category: ${filterCategory.value}`);
  if (filterSubCat.value) bits.push(`Sub-category: ${filterSubCat.value}`);
  if (filterGroup.value) bits.push(`Group: ${filterGroup.value}`);
  if (filterSubGrp.value) bits.push(`Sub-group: ${filterSubGrp.value}`);
  if (filterItem.value) bits.push(`Item: ${filterItem.value}`);
  if (filterBN.value) bits.push(`BN: ${filterBN.value}`);
  return bits;
}

/** Fetch all rows from the view */
async function fetchData() {
  const { data, error } = await supabase.from("bmr_card_not_initiated").select(`
      item,
      bn,
      batch_size,
      uom,
      category,
      subcategory,
      product_group,
      subgroup
    `);
  if (error) {
    console.error("Error fetching BMR cards:", error);
    tbody.innerHTML = `<tr class="no-data"><td colspan="8">Failed to load data</td></tr>`;
    return;
  }
  allRows = data;
}

/** Populate Category dropdown */
function populateCategory() {
  const cats = Array.from(
    new Set(allRows.map((r) => r.category).filter(Boolean))
  ).sort();
  fillSelect(filterCategory, cats, "Category");
  filterSubCat.disabled = true;
  fillSelect(filterSubCat, [], "Sub-category");
  filterGroup.disabled = true;
  fillSelect(filterGroup, [], "Group");
  filterSubGrp.disabled = true;
  fillSelect(filterSubGrp, [], "Sub-group");
}

/** Populate Sub-category based on Category */
function populateSubCategory() {
  if (!filterCategory.value) return;
  const subs = Array.from(
    new Set(
      allRows
        .filter((r) => r.category === filterCategory.value)
        .map((r) => r.subcategory)
        .filter(Boolean)
    )
  ).sort();
  fillSelect(filterSubCat, subs, "Sub-category");
  filterSubCat.disabled = false;
  filterGroup.disabled = true;
  fillSelect(filterGroup, [], "Group");
  filterSubGrp.disabled = true;
  fillSelect(filterSubGrp, [], "Sub-group");
}

/** Populate Group based on Sub-category */
function populateGroup() {
  if (!filterSubCat.value) return;
  const grs = Array.from(
    new Set(
      allRows
        .filter(
          (r) =>
            r.category === filterCategory.value &&
            r.subcategory === filterSubCat.value
        )
        .map((r) => r.product_group)
        .filter(Boolean)
    )
  ).sort();
  fillSelect(filterGroup, grs, "Group");
  filterGroup.disabled = false;
  filterSubGrp.disabled = true;
  fillSelect(filterSubGrp, [], "Sub-group");
}

/** Populate Sub-group based on Group */
function populateSubGroup() {
  if (!filterGroup.value) return;
  const sgs = Array.from(
    new Set(
      allRows
        .filter(
          (r) =>
            r.category === filterCategory.value &&
            r.subcategory === filterSubCat.value &&
            r.product_group === filterGroup.value
        )
        .map((r) => r.subgroup)
        .filter(Boolean)
    )
  ).sort();
  fillSelect(filterSubGrp, sgs, "Sub-group");
  filterSubGrp.disabled = false;
}

/** Populate BN based on selected Item */
function populateBN() {
  if (!filterItem.value) return;
  const bns = Array.from(
    new Set(allRows.filter((r) => r.item === filterItem.value).map((r) => r.bn))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  fillSelect(filterBN, bns, "BN");
  filterBN.disabled = false;
}

/** Render table, applying filters & sort */
function renderTable() {
  let rows = allRows
    .filter((r) => !filterCategory.value || r.category === filterCategory.value)
    .filter((r) => !filterSubCat.value || r.subcategory === filterSubCat.value)
    .filter((r) => !filterGroup.value || r.product_group === filterGroup.value)
    .filter((r) => !filterSubGrp.value || r.subgroup === filterSubGrp.value)
    .filter((r) => !filterItem.value || r.item === filterItem.value)
    .filter((r) => !filterBN.value || r.bn === filterBN.value);

  rows = sortBmrRows(rows);

  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr class="no-data"><td colspan="8">No records found</td></tr>`;
    return;
  }

  for (let r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.item}</td>
      <td>${r.bn}</td>
      <td>${r.batch_size}</td>
      <td>${r.uom}</td>
      <td>${r.category || ""}</td>
      <td>${r.subcategory || ""}</td>
      <td>${r.product_group || ""}</td>
      <td>${r.subgroup || ""}</td>
    `;
    tbody.append(tr);
  }
}

/** Clear all filters */
function clearFilters() {
  // Reset cascades (only Category enabled)
  filterCategory.value = "";
  filterSubCat.value = "";
  filterSubCat.disabled = true;
  filterGroup.value = "";
  filterGroup.disabled = true;
  filterSubGrp.value = "";
  filterSubGrp.disabled = true;

  // Reset Item (Tom Select) and BN
  if (itemTS) itemTS.clear(true);

  filterBN.disabled = true;
  fillSelect(filterBN, [], "BN");

  // Collapse advanced
  filtersAdvanced.style.display = "none";
  toggleAdvanced.textContent = "Advanced ▾";

  // Re-render table with no filters
  renderTable();
}

/** CSV export */
function exportCsv() {
  const headers = [
    "ITEM",
    "BN",
    "BATCH SIZE",
    "UOM",
    "CATEGORY",
    "SUB-CATEGORY",
    "PRODUCT GROUP",
    "SUB-GROUP",
  ]
    .map((h) => `"${h}"`)
    .join(",");

  const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  let lines = [];

  if (!hasActiveFilters()) {
    // No filters → export ALL rows from DB, sorted like the table
    const sorted = sortBmrRows(allRows || []);
    lines = sorted.map((r) =>
      [
        r.item,
        r.bn,
        r.batch_size,
        r.uom,
        r.category,
        r.subcategory,
        r.product_group,
        r.subgroup,
      ]
        .map(csvEscape)
        .join(",")
    );
  } else {
    // Filters on → export exactly what's visible (already sorted by renderTable)
    lines = Array.from(tbody.rows)
      .filter((r) => !r.classList.contains("no-data"))
      .map((tr) =>
        Array.from(tr.cells)
          .map((td) => csvEscape(td.textContent.trim()))
          .join(",")
      );
  }

  const csv = [headers, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${todayStamp()}_bmr_cards_not_initiated.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** PDF export */
async function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Header
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
      `BMR Cards Not Initiated AS ON ${new Date().toLocaleDateString("en-GB")}`,
      pw / 2,
      85,
      { align: "center" }
    );

  // ── Filter summary (wraps to page width) — with safe spacing below title
  const filtBits = buildFilterSummaryBits();

  // Baseline just after the title (title printed at y = 85)
  const headerBottomY = 90;

  // Start the summary at least 18pt below the title
  let cursorY = headerBottomY + 18;

  if (filtBits.length) {
    doc.setFont("Helvetica", "normal").setFontSize(10);
    const summary = filtBits.join("  |  ");
    const wrapped = doc.splitTextToSize(summary, pw - 80); // 40pt margins

    wrapped.forEach((line) => {
      doc.text(line, pw / 2, cursorY, { align: "center" });
      cursorY += 12; // line height
    });
  }

  // Table starts a bit after the summary (or after the header if no filters)
  const tableStartY = cursorY + 8;

  // ── Data: if no filters → ALL rows (sorted); else → visible rows
  let data = [];
  if (!hasActiveFilters()) {
    const sorted = sortBmrRows(allRows || []);
    data = sorted.map((r) => ({
      item: r.item ?? "",
      bn: r.bn ?? "",
      batch_size: r.batch_size ?? "",
      uom: r.uom ?? "",
    }));
  } else {
    // From visible table (already sorted by renderTable)
    data = Array.from(document.querySelectorAll("#bmrCardTableBody tr"))
      .filter((tr) => !tr.classList.contains("no-data"))
      .map((tr) => {
        const c = tr.cells;
        return {
          item: c[0].textContent.trim(),
          bn: c[1].textContent.trim(),
          batch_size: c[2].textContent.trim(),
          uom: c[3].textContent.trim(),
        };
      });
  }

  // ── Table
  doc.autoTable({
    startY: tableStartY,
    columns: [
      { header: "ITEM", dataKey: "item" },
      { header: "BN", dataKey: "bn" },
      { header: "BATCH SIZE", dataKey: "batch_size" },
      { header: "UOM", dataKey: "uom" },
    ],
    body: data,
    theme: "grid",
    margin: { left: 40, right: 40 },
    styles: {
      font: "Helvetica",
      fontStyle: "normal",
      fontSize: 10,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      halign: "center",
      valign: "middle",
    },
    headStyles: {
      font: "Helvetica",
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
    },
    columnStyles: {
      item: { halign: "left" },
    },
    rowPageBreak: "avoid",
    willDrawCell: (data) => {
      doc.setFont("Helvetica", data.section === "head" ? "bold" : "normal");
    },
    didDrawPage: () => {
      doc.setFont("Helvetica", "normal").setFontSize(10);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pw - 40, ph - 10, {
        align: "right",
      });
    },
  });

  doc.save(`${todayStamp()}_bmr_cards_not_initiated.pdf`);
}

/** Init */
window.addEventListener("DOMContentLoaded", async () => {
  // ─── Home, clear & export hooks ────────────────────────────────
  homeBtn.onclick = () => (location.href = "index.html");
  backBtn.onclick = () => window.history.back();
  clearBtn.onclick = () => {
    clearFilters();
    // also collapse advanced on clear
    filtersAdvanced.style.display = "none";
    toggleAdvanced.textContent = "Advanced ▾";
  };
  downloadCsv.onclick = exportCsv;
  downloadPdf.onclick = exportPdf;

  // ─── Advanced toggle init ─────────────────────────────────────
  filtersAdvanced.style.display = "none";
  toggleAdvanced.textContent = "Advanced ▾";
  toggleAdvanced.addEventListener("click", () => {
    const isOpen = filtersAdvanced.style.display === "flex";
    filtersAdvanced.style.display = isOpen ? "none" : "flex";
    toggleAdvanced.textContent = isOpen ? "Advanced ▾" : "Advanced ▴";
  });

  // ─── Load & render data ────────────────────────────────────────
  await fetchData();
  populateCategory();
  // Turn #filterItem into a Tom Select (then populate it)
  itemTS = new TomSelect("#filterItem", {
    valueField: "value",
    labelField: "text",
    searchField: ["text"],
    create: false,
    allowEmptyOption: true,
    placeholder: "Item",
    maxOptions: 200, // server returns up to 20; this is just an upper bound

    // Load suggestions from Supabase as you type
    load: function (query, callback) {
      if (!query.length) return callback();
      fetchItemOptions(query)
        .then(callback)
        .catch(() => callback());
    },
  });

  resetItemSuggestions();
  renderTable();

  // ─── Wire up cascading & render on filter change ───────────────
  filterCategory.addEventListener("change", () => {
    populateSubCategory();
    resetItemSuggestions();
    renderTable();
  });
  filterSubCat.addEventListener("change", () => {
    populateGroup();
    resetItemSuggestions();
    renderTable();
  });
  filterGroup.addEventListener("change", () => {
    populateSubGroup();
    resetItemSuggestions();
    renderTable();
  });
  filterSubGrp.addEventListener("change", () => {
    resetItemSuggestions();
    renderTable();
  });
  filterItem.addEventListener("change", () => {
    populateBN();
    renderTable();

    // move focus to BN after Tom Select/native finishes updating
    setTimeout(() => {
      if (!filterBN.disabled) filterBN.focus();
    }, 0);
  });
  filterBN.addEventListener("change", renderTable);
});
