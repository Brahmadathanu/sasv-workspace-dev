// js/bmr-card-not-initiated.js
import { supabase } from './supabaseClient.js';

const homeBtn        = document.getElementById('homeBtn');
const filterCategory = document.getElementById('filterCategory');
const filterSubCat   = document.getElementById('filterSubCategory');
const filterGroup    = document.getElementById('filterGroup');
const filterSubGrp   = document.getElementById('filterSubGroup');
const filterItem     = document.getElementById('filterItem');
const filterBN       = document.getElementById('filterBN');
const clearBtn       = document.getElementById('clearFilters');
const downloadCsv    = document.getElementById('downloadCsv');
const downloadPdf    = document.getElementById('downloadPdf');
const tbody          = document.getElementById('bmrCardTableBody');

let allRows = [];

/** Fill a <select> with an array of strings */
function fillSelect(el, arr, placeholder) {
  el.innerHTML = `<option value="">${placeholder}</option>` +
    arr.map(v => `<option value="${v}">${v}</option>`).join('');
}

/** YYYYMMDD stamp for exports */
function todayStamp() {
  const d = new Date();
  return String(d.getDate()).padStart(2,'0') +
         String(d.getMonth()+1).padStart(2,'0') +
         d.getFullYear();
}

/** Fetch all rows from the view */
async function fetchData() {
  const { data, error } = await supabase
    .from('bmr_card_not_initiated')
    .select(`
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
    console.error('Error fetching BMR cards:', error);
    tbody.innerHTML = `<tr class="no-data"><td colspan="8">Failed to load data</td></tr>`;
    return;
  }
  allRows = data;
}

/** Populate Category dropdown */
function populateCategory() {
  const cats = Array.from(new Set(allRows.map(r => r.category).filter(Boolean))).sort();
  fillSelect(filterCategory, cats, 'Category');
  filterSubCat.disabled = true; fillSelect(filterSubCat, [], 'Sub-category');
  filterGroup.disabled  = true; fillSelect(filterGroup, [], 'Group');
  filterSubGrp.disabled = true; fillSelect(filterSubGrp, [], 'Sub-group');
}

/** Populate Sub-category based on Category */
function populateSubCategory() {
  if (!filterCategory.value) return;
  const subs = Array.from(new Set(
    allRows
      .filter(r => r.category === filterCategory.value)
      .map(r => r.subcategory)
      .filter(Boolean)
  )).sort();
  fillSelect(filterSubCat, subs, 'Sub-category');
  filterSubCat.disabled = false;
  filterGroup.disabled  = true; fillSelect(filterGroup,  [], 'Group');
  filterSubGrp.disabled = true; fillSelect(filterSubGrp, [], 'Sub-group');
}

/** Populate Group based on Sub-category */
function populateGroup() {
  if (!filterSubCat.value) return;
  const grs = Array.from(new Set(
    allRows
      .filter(r => r.category === filterCategory.value && r.subcategory === filterSubCat.value)
      .map(r => r.product_group)
      .filter(Boolean)
  )).sort();
  fillSelect(filterGroup, grs, 'Group');
  filterGroup.disabled = false;
  filterSubGrp.disabled = true; fillSelect(filterSubGrp, [], 'Sub-group');
}

/** Populate Sub-group based on Group */
function populateSubGroup() {
  if (!filterGroup.value) return;
  const sgs = Array.from(new Set(
    allRows
      .filter(r =>
        r.category      === filterCategory.value &&
        r.subcategory   === filterSubCat.value &&
        r.product_group === filterGroup.value
      )
      .map(r => r.subgroup)
      .filter(Boolean)
  )).sort();
  fillSelect(filterSubGrp, sgs, 'Sub-group');
  filterSubGrp.disabled = false;
}

/** Populate Item always, filtered by any selected cascades */
function populateItem() {
  let rows = allRows;
  if (filterCategory.value) rows = rows.filter(r => r.category === filterCategory.value);
  if (filterSubCat.value)   rows = rows.filter(r => r.subcategory === filterSubCat.value);
  if (filterGroup.value)    rows = rows.filter(r => r.product_group === filterGroup.value);
  if (filterSubGrp.value)   rows = rows.filter(r => r.subgroup === filterSubGrp.value);

  const items = Array.from(new Set(rows.map(r => r.item))).sort();
  fillSelect(filterItem, items, 'Item');
  filterBN.disabled = true;
  fillSelect(filterBN, [], 'BN');
}

/** Populate BN based on selected Item */
function populateBN() {
  if (!filterItem.value) return;
  const bns = Array.from(new Set(
    allRows
      .filter(r => r.item === filterItem.value)
      .map(r => r.bn)
  )).sort((a,b) => a.localeCompare(b, undefined, { numeric:true }));
  fillSelect(filterBN, bns, 'BN');
  filterBN.disabled = false;
}

/** Render table, applying filters & sort */
function renderTable() {
  let rows = allRows
    .filter(r => !filterCategory.value || r.category      === filterCategory.value)
    .filter(r => !filterSubCat.value   || r.subcategory   === filterSubCat.value)
    .filter(r => !filterGroup.value    || r.product_group === filterGroup.value)
    .filter(r => !filterSubGrp.value   || r.subgroup      === filterSubGrp.value)
    .filter(r => !filterItem.value     || r.item         === filterItem.value)
    .filter(r => !filterBN.value       || r.bn           === filterBN.value);

  // Sort by Category → Sub-cat → ProdGroup → Sub-group → Item → BN
  rows.sort((a,b) => {
    const order = [
      ['category',      false],
      ['subcategory',   false],
      ['product_group', false],
      ['subgroup',      false],
      ['item',          false],
      ['bn',            true]
    ];
    for (let [key, numeric] of order) {
      const av = a[key] ?? '', bv = b[key] ?? '';
      if (av === bv) continue;
      if (numeric) {
        return av.localeCompare(bv, undefined, { numeric:true });
      }
      return av < bv ? -1 : 1;
    }
    return 0;
  });

  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr class="no-data"><td colspan="8">No records found</td></tr>`;
    return;
  }

  for (let r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.item}</td>
      <td>${r.bn}</td>
      <td>${r.batch_size}</td>
      <td>${r.uom}</td>
      <td>${r.category||''}</td>
      <td>${r.subcategory||''}</td>
      <td>${r.product_group||''}</td>
      <td>${r.subgroup||''}</td>
    `;
    tbody.append(tr);
  }
}

/** Clear all filters */
function clearFilters() {
  [ filterCategory, filterSubCat, filterGroup, filterSubGrp,
    filterItem, filterBN
  ].forEach((el,i) => {
    el.value = '';
    el.disabled = (i !== 0);
  });
  populateCategory();
  populateItem();
  renderTable();
}

/** CSV export */
function exportCsv() {
  const headers = [
    'ITEM','BN','BATCH SIZE','UOM',
    'CATEGORY','SUB-CATEGORY','PRODUCT GROUP','SUB-GROUP'
  ].map(h => `"${h}"`).join(',');
  const rows = Array.from(tbody.rows)
    .filter(r => !r.classList.contains('no-data'))
    .map(tr => Array.from(tr.cells).map(td => `"${td.textContent}"`).join(','));
  const csv = [headers, ...rows].join('\r\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${todayStamp()}_bmr_cards_not_initiated.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** PDF export */
/* --------------  PDF (with custom header & styles) --- */
async function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // ── Header ───────────────────────────────────────────────────────────
  doc.setFont('Helvetica','normal').setFontSize(10)
     .text('Gurucharanam Saranam', pw/2, 30, { align:'center' });
  doc.setFont('Helvetica','bold').setFontSize(12)
     .text('Santhigiri Ayurveda Siddha Vaidyasala', pw/2, 55, { align:'center' });
  doc.setFont('Helvetica','bold').setFontSize(14)
     .text(
       `BMR Cards Not Initiated AS ON ${new Date().toLocaleDateString('en-GB')}`,
       pw/2, 85,
       { align:'center' }
     );

  // ── Gather just the first four columns into a data array ─────────────
  const data = Array.from(tbody.rows)
    .filter(r => !r.classList.contains('no-data'))
    .map(tr => {
      const cells = Array.from(tr.cells).slice(0, 4);
      return {
        item:        cells[0].textContent.trim(),
        bn:          cells[1].textContent.trim(),
        batch_size:  cells[2].textContent.trim(),
        uom:         cells[3].textContent.trim()
      };
    });

  // ── Generate the PDF table with no row‑splitting ──────────────────────
  doc.autoTable({
    startY: 100,
    columns: [
      { header: 'ITEM',         dataKey: 'item'       },
      { header: 'BN',           dataKey: 'bn'         },
      { header: 'BATCH SIZE',   dataKey: 'batch_size' },
      { header: 'UOM',          dataKey: 'uom'        },
    ],
    body: data,
    theme: 'grid',
    margin: { left:40, right:40 },

    styles: {
      font: 'Helvetica',
      fontStyle: 'normal',
      fontSize: 10,
      textColor: [0,0,0],
      lineColor: [0,0,0],
      lineWidth: 0.5,
      halign: 'center',
      valign: 'middle'
    },
    headStyles: {
      font: 'Helvetica',
      fontStyle: 'bold',
      fillColor: [255,255,255],
      textColor: [0,0,0],
      lineColor: [0,0,0],
      lineWidth: 0.5
    },
    columnStyles: {
      item: { halign: 'left' }
    },
    rowPageBreak: 'avoid',
    willDrawCell: data => {
      // keep header bold
      doc.setFont('Helvetica', data.section === 'head' ? 'bold' : 'normal');
    },
    didDrawPage: () => {
      doc.setFont('Helvetica','normal').setFontSize(10);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pw - 40,
        ph - 10,
        { align: 'right' }
      );
    }
  });

  doc.save(`${todayStamp()}_bmr_cards_not_initiated.pdf`);
}

/** Init */
window.addEventListener('DOMContentLoaded', async () => {
  homeBtn.onclick     = () => location.href = 'index.html';
  clearBtn.onclick    = clearFilters;
  downloadCsv.onclick = exportCsv;
  downloadPdf.onclick = exportPdf;

  await fetchData();
  populateCategory();
  populateItem();
  renderTable();

  filterCategory.addEventListener('change', () => {
    populateSubCategory();
    populateItem();
    renderTable();
  });
  filterSubCat.addEventListener('change', () => {
    populateGroup();
    populateItem();
    renderTable();
  });
  filterGroup.addEventListener('change', () => {
    populateSubGroup();
    populateItem();
    renderTable();
  });
  filterSubGrp.addEventListener('change', () => {
    populateItem();
    renderTable();
  });
  filterItem.addEventListener('change', () => {
    populateBN();
    renderTable();
  });
  filterBN.addEventListener('change', renderTable);
});