import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

/* ─── DOM ------------------------------------------------------- */
const homeBtn = document.getElementById("homeBtn");
const filterItem = document.getElementById("filterItem");
const filterBN = document.getElementById("filterBN");
const filterCategory = document.getElementById("filterCategory");
const filterSubCat = document.getElementById("filterSubCategory");
const filterGroup = document.getElementById("filterGroup");
const filterSubGroup = document.getElementById("filterSubGroup");
const toggleAdv = document.getElementById("toggleAdvanced");
const advFilters = document.getElementById("advancedFilters");
const clearBtn = document.getElementById("clearFilters");
const downloadCsv = document.getElementById("downloadCsv");
const downloadPdf = document.getElementById("downloadPdf");
const tbody = document.getElementById("fgBulkTableBody");

/* ─── STATE ----------------------------------------------------- */
let allRows = [];

/* ─── HELPERS --------------------------------------------------- */
const todayStamp = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}${String(
    d.getMonth() + 1
  ).padStart(2, "0")}${d.getFullYear()}`;
};

const fillSelect = (el, arr, ph) => {
  el.innerHTML =
    `<option value="">${ph}</option>` +
    arr.map((v) => `<option value="${v}">${v}</option>`).join("");
};

/* ─── DATA LOAD ------------------------------------------------- */
async function fetchData() {
  const { data, error } = await supabase
    .from("fg_bulk_stock")
    .select(
      "item,bn,qty_on_hand,on_hand_qty_uom,category_name,subcategory,product_group,subgroup,last_updated"
    );
  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr class="no-data"><td colspan="9">Failed to load data</td></tr>`;
    return;
  }
  allRows = (data || []).filter((r) => r.qty_on_hand !== 0);
}

/* ─── POPULATE CASCADE ----------------------------------------- */
function populateCategory() {
  const cats = [
    ...new Set(allRows.map((r) => r.category_name).filter(Boolean)),
  ].sort();
  fillSelect(filterCategory, cats, "Category");
  fillSelect(filterSubCat, [], "Subcategory");
  filterSubCat.disabled = true;
  fillSelect(filterGroup, [], "Group");
  filterGroup.disabled = true;
  fillSelect(filterSubGroup, [], "Subgroup");
  filterSubGroup.disabled = true;
}

function populateSubCategory() {
  if (!filterCategory.value) return;
  const subs = [
    ...new Set(
      allRows
        .filter((r) => r.category_name === filterCategory.value)
        .map((r) => r.subcategory)
        .filter(Boolean)
    ),
  ].sort();
  fillSelect(filterSubCat, subs, "Subcategory");
  filterSubCat.disabled = false;
  fillSelect(filterGroup, [], "Group");
  filterGroup.disabled = true;
  fillSelect(filterSubGroup, [], "Subgroup");
  filterSubGroup.disabled = true;
}

function populateGroup() {
  if (!filterSubCat.value) return;
  const grs = [
    ...new Set(
      allRows
        .filter(
          (r) =>
            r.category_name === filterCategory.value &&
            r.subcategory === filterSubCat.value
        )
        .map((r) => r.product_group)
        .filter(Boolean)
    ),
  ].sort();
  fillSelect(filterGroup, grs, "Group");
  filterGroup.disabled = false;
  fillSelect(filterSubGroup, [], "Subgroup");
  filterSubGroup.disabled = true;
}

function populateSubGroup() {
  if (!filterGroup.value) return;
  const sgs = [
    ...new Set(
      allRows
        .filter(
          (r) =>
            r.category_name === filterCategory.value &&
            r.subcategory === filterSubCat.value &&
            r.product_group === filterGroup.value
        )
        .map((r) => r.subgroup)
        .filter(Boolean)
    ),
  ].sort();
  fillSelect(filterSubGroup, sgs, "Subgroup");
  filterSubGroup.disabled = false;
}

function populateItem() {
  let rows = allRows;
  if (filterCategory.value)
    rows = rows.filter((r) => r.category_name === filterCategory.value);
  if (filterSubCat.value)
    rows = rows.filter((r) => r.subcategory === filterSubCat.value);
  if (filterGroup.value)
    rows = rows.filter((r) => r.product_group === filterGroup.value);
  if (filterSubGroup.value)
    rows = rows.filter((r) => r.subgroup === filterSubGroup.value);

  const items = [...new Set(rows.map((r) => r.item))].sort();
  fillSelect(filterItem, items, "Item");
  filterBN.disabled = true;
  fillSelect(filterBN, [], "BN");
}

function populateBN() {
  if (!filterItem.value) return;
  const bns = [
    ...new Set(
      allRows.filter((r) => r.item === filterItem.value).map((r) => r.bn)
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  fillSelect(filterBN, bns, "BN");
  filterBN.disabled = false;
}

/* ─── TABLE RENDER --------------------------------------------- */
function renderTable() {
  let rows = allRows
    .filter((r) => !filterItem.value || r.item === filterItem.value)
    .filter((r) => !filterBN.value || r.bn === filterBN.value)
    .filter(
      (r) => !filterCategory.value || r.category_name === filterCategory.value
    )
    .filter((r) => !filterSubCat.value || r.subcategory === filterSubCat.value)
    .filter((r) => !filterGroup.value || r.product_group === filterGroup.value)
    .filter(
      (r) => !filterSubGroup.value || r.subgroup === filterSubGroup.value
    );

  /* simple multi-key sort */
  const order = [
    ["category", false],
    ["product_group", false],
    ["subgroup", false],
    ["subcategory", false],
    ["item", false],
    ["bn", true],
  ];
  rows.sort((a, b) => {
    for (const [k, num] of order) {
      const av = a[k] ?? "",
        bv = b[k] ?? "";
      if (av === bv) continue;
      return num
        ? av.localeCompare(bv, undefined, { numeric: true })
        : av < bv
        ? -1
        : 1;
    }
    return 0;
  });

  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr class="no-data"><td colspan="9">No records found</td></tr>`;
    return;
  }
  rows.forEach((r) => {
    tbody.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${r.item}</td>
        <td>${r.bn}</td>
        <td>${r.qty_on_hand}</td>
        <td>${r.on_hand_qty_uom}</td>
        <td>${r.category_name || ""}</td>
        <td>${r.subcategory || ""}</td>
        <td>${r.product_group || ""}</td>
        <td>${r.subgroup || ""}</td>
      </tr>
    `
    );
  });
}

/* ─── CLEAR ----------------------------------------------------- */
function clearFilters() {
  [
    filterCategory,
    filterSubCat,
    filterGroup,
    filterSubGroup,
    filterItem,
    filterBN,
  ].forEach((el) => {
    el.value = "";
    el.disabled = el !== filterItem && el !== filterCategory; // only Item stays enabled
  });
  populateCategory();
  populateItem();
  advFilters.style.display = "none";
  toggleAdv.textContent = "Advanced ▾";
  renderTable();
}

/* ─── EXPORTS --------------------------------------------------- */
function exportCsv() {
  const hdr = [
    "ITEM",
    "BN",
    "QTY ON HAND",
    "UOM",
    "CATEGORY",
    "SUBCATEGORY",
    "PRODUCT GROUP",
    "SUBGROUP",
  ];
  const rows = [...tbody.rows]
    .filter((r) => !r.classList.contains("no-data"))
    .map((tr) =>
      [...tr.cells]
        .map((td) => `"${td.textContent.replace(/"/g, '""')}"`)
        .join(",")
    );
  const csv = [hdr.map((h) => `"${h}"`).join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${todayStamp()}_fg_bulk_stock.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  /* ── Header block (same look & spacing as reference) ───────── */
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
      `FG BULK STOCK AS ON ${new Date().toLocaleDateString("en-GB")}`,
      pw / 2,
      85,
      { align: "center" }
    );

  /* ── Collect current (visible) rows ────────────────────────── */
  const data = [...tbody.rows]
    .filter((r) => !r.classList.contains("no-data"))
    .map((tr) => {
      const c = [...tr.cells];
      return {
        item: c[0].textContent.trim(),
        bn: c[1].textContent.trim(),
        qty: c[2].textContent.trim(),
        uom: c[3].textContent.trim(),
        cat: c[4].textContent.trim(),
        sub: c[5].textContent.trim(),
        grp: c[6].textContent.trim(),
        sg: c[7].textContent.trim(),
      };
    });

  /* ── Build table (same grid theme / fonts / page‑break rules) ─ */
  doc.autoTable({
    startY: 100,
    margin: { left: 40, right: 40 },
    theme: "grid",

    columns: [
      { header: "ITEM", dataKey: "item" },
      { header: "BN", dataKey: "bn" },
      { header: "QTY", dataKey: "qty" },
      { header: "UOM", dataKey: "uom" },
      { header: "CATEGORY", dataKey: "cat" },
      { header: "SUBCATEGORY", dataKey: "sub" },
      { header: "GROUP", dataKey: "grp" },
      { header: "SUBGROUP", dataKey: "sg" },
    ],
    body: data,

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
      fontSize: 10,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
    },
    columnStyles: {
      item: { halign: "left" },
      cat: { halign: "left" },
      sub: { halign: "left" },
      grp: { halign: "left" },
      sg: { halign: "left" },
    },

    rowPageBreak: "avoid",

    willDrawCell: (data) => {
      // keep header bold / body normal (reference behaviour)
      doc.setFont("Helvetica", data.section === "head" ? "bold" : "normal");
    },

    didDrawPage: () => {
      // footer page‑number (bottom‑right)
      doc.setFont("Helvetica", "normal").setFontSize(10);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pw - 40, ph - 10, {
        align: "right",
      });
    },
  });

  doc.save(`${todayStamp()}_fg_bulk_stock.pdf`);
}

/* ─── INIT ------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
  if (homeBtn) homeBtn.onclick = () => Platform.goHome();

  toggleAdv.onclick = () => {
    const open = advFilters.style.display === "flex";
    advFilters.style.display = open ? "none" : "flex";
    toggleAdv.textContent = open ? "Advanced ▾" : "Advanced ▴";
  };

  clearBtn.onclick = clearFilters;
  downloadCsv.onclick = exportCsv;
  downloadPdf.onclick = exportPdf;

  await fetchData();
  populateCategory();
  populateItem();
  renderTable();

  /* cascades */
  filterCategory.addEventListener("change", () => {
    populateSubCategory();
    populateItem();
    renderTable();
  });
  filterSubCat.addEventListener("change", () => {
    populateGroup();
    populateItem();
    renderTable();
  });
  filterGroup.addEventListener("change", () => {
    populateSubGroup();
    populateItem();
    renderTable();
  });
  filterSubGroup.addEventListener("change", () => {
    populateItem();
    renderTable();
  });
  filterItem.addEventListener("change", () => {
    populateBN();
    renderTable();
  });
  filterBN.addEventListener("change", renderTable);
});
