// js/bottled-stock.js
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
const tbody          = document.getElementById('bottledTableBody');

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

/** Fetch all data once */
async function fetchData() {
  const { data, error } = await supabase
    .from('bottled_stock_on_hand')
    .select(`
      batch_number,
      pack_size,
      uom,
      on_hand,
      item,
      category,
      sub_category,
      "group",
      sub_group
    `);
  if (error) {
    console.error('Error fetching data:', error);
    tbody.innerHTML = `<tr class="no-data"><td colspan="9">Failed to load data</td></tr>`;
    return;
  }
  allRows = data;
}

/** Populate Category dropdown */
function populateCategory() {
  const cats = Array.from(new Set(allRows.map(r => r.category).filter(Boolean))).sort();
  fillSelect(filterCategory, cats, 'Category');
  filterSubCat.disabled = true; fillSelect(filterSubCat, [], 'Sub-category');
  filterGroup.disabled  = true; fillSelect(filterGroup,  [], 'Group');
  filterSubGrp.disabled = true; fillSelect(filterSubGrp, [], 'Sub-group');
}

/** Populate Sub-category based on Category */
function populateSubCategory() {
  if (!filterCategory.value) return;
  const subs = Array.from(new Set(
    allRows
      .filter(r => r.category === filterCategory.value)
      .map(r => r.sub_category)
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
      .filter(r => r.category === filterCategory.value && r.sub_category === filterSubCat.value)
      .map(r => r.group)
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
        r.category     === filterCategory.value &&
        r.sub_category === filterSubCat.value &&
        r.group        === filterGroup.value
      )
      .map(r => r.sub_group)
      .filter(Boolean)
  )).sort();
  fillSelect(filterSubGrp, sgs, 'Sub-group');
  filterSubGrp.disabled = false;
}

/** Populate Item always, but filtered by any selected cascades */
function populateItem() {
  let rows = allRows;
  if (filterCategory.value) rows = rows.filter(r => r.category === filterCategory.value);
  if (filterSubCat.value)   rows = rows.filter(r => r.sub_category === filterSubCat.value);
  if (filterGroup.value)    rows = rows.filter(r => r.group === filterGroup.value);
  if (filterSubGrp.value)   rows = rows.filter(r => r.sub_group === filterSubGrp.value);

  const items = Array.from(new Set(rows.map(r => r.item))).sort();
  fillSelect(filterItem, items, 'Item');
  filterBN.disabled = true;
  fillSelect(filterBN, [], 'BN');
}

/** Populate BN based on selected Item */
function populateBN() {
  if (!filterItem.value) return;
  let rows = allRows.filter(r => r.item === filterItem.value);
  const bns = Array.from(new Set(rows.map(r => r.batch_number)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  fillSelect(filterBN, bns, 'BN');
  filterBN.disabled = false;
}

/** Render table, applying filters & custom sort */
function renderTable() {
  let rows = allRows
    .filter(r => !filterCategory.value || r.category === filterCategory.value)
    .filter(r => !filterSubCat.value   || r.sub_category === filterSubCat.value)
    .filter(r => !filterGroup.value    || r.group === filterGroup.value)
    .filter(r => !filterSubGrp.value   || r.sub_group === filterSubGrp.value)
    .filter(r => !filterItem.value     || r.item === filterItem.value)
    .filter(r => !filterBN.value       || r.batch_number === filterBN.value);

  // Sort by Category → Group → Sub-group → Sub-category → Item → Batch #
  rows.sort((a, b) => {
    const order = [
      ['category',     false],
      ['group',        false],
      ['sub_group',    false],
      ['sub_category', false],
      ['item',         false],
      ['batch_number', true]
    ];
    for (let [key, numeric] of order) {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      if (av === bv) continue;
      if (numeric) {
        return av.localeCompare(bv, undefined, { numeric: true });
      }
      return av < bv ? -1 : 1;
    }
    return 0;
  });

  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr class="no-data"><td colspan="9">No records found</td></tr>`;
    return;
  }

  for (let r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.item}</td>
      <td>${r.batch_number}</td>
      <td>${r.pack_size}</td>
      <td>${r.uom}</td>
      <td>${r.on_hand}</td>
      <td>${r.category||''}</td>
      <td>${r.sub_category||''}</td>
      <td>${r.group||''}</td>
      <td>${r.sub_group||''}</td>
    `;
    tbody.append(tr);
  }
}

/** Clear all filters */
function clearFilters() {
  [ filterCategory, filterSubCat, filterGroup, filterSubGrp,
    filterItem, filterBN
  ].forEach((el, i) => {
    el.value = '';
    el.disabled = (i !== 0); // only Category remains enabled
  });
  populateCategory();
  populateItem();
  renderTable();
}

/** Export visible rows as CSV */
function exportCsv() {
  const headers = [
    'ITEM','BN','PACK SIZE','UOM','STOCK ON HAND',
    'CATEGORY','SUB-CATEGORY','GROUP','SUB-GROUP'
  ].map(h => `"${h}"`).join(',');
  const rows = Array.from(tbody.rows)
    .filter(r => !r.classList.contains('no-data'))
    .map(tr => Array.from(tr.cells).map(td => `"${td.textContent}"`).join(','));
  const csv = [headers, ...rows].join('\r\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${todayStamp()}_bottled_stock.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export visible rows as PDF */
function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();

  doc.setFont('Helvetica','normal').setFontSize(10)
     .text('Gurucharanam Saranam', pw/2, 30, { align:'center' })
     .setFont('Helvetica','bold').setFontSize(12)
     .text('Santhigiri Ayurveda Siddha Vaidyasala', pw/2, 55, { align:'center' })
     .setFont('Helvetica','bold').setFontSize(14)
     .text(`BOTTLED STOCK AS ON ${new Date().toLocaleDateString('en-GB')}`,
           pw/2, 85, { align:'center' });

  const head = [
    'ITEM','BN','PACK SIZE','UOM','STOCK ON HAND',
    'CATEGORY','SUB-CATEGORY','GROUP','SUB-GROUP'
  ];
  const body = Array.from(tbody.rows)
    .filter(r => !r.classList.contains('no-data'))
    .map(tr => Array.from(tr.cells).map(td => td.textContent));

  doc.autoTable({
    startY: 110,
    head: [head],
    body,
    theme: 'grid',
    margin: { left:40, right:40 },
    styles: {
      font:'Helvetica', fontStyle:'normal', fontSize:10,
      halign:'center', valign:'middle'
    },
    headStyles: { font:'Helvetica', fontStyle:'bold' },
    columnStyles: { 0:{ halign:'left' } },
    didDrawPage: () => {
      const page = doc.internal.getNumberOfPages();
      doc.setFont('Helvetica','normal').setFontSize(10)
         .text(`Page ${page}`, pw-40, ph-10);
    }
  });

  doc.save(`${todayStamp()}_bottled_stock.pdf`);
}

/** Initialize everything */
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