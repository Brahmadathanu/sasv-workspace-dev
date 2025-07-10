// js/bottled-stock.js
import { supabase } from './supabaseClient.js';

const homeBtn     = document.getElementById('homeBtn');
const fItem       = document.getElementById('filterItem');
const fBN         = document.getElementById('filterBN');
const clearLink   = document.getElementById('clearFilters');
const downloadCsv = document.getElementById('downloadCsv');
const downloadPdf = document.getElementById('downloadPdf');
const tbody       = document.getElementById('bottledTableBody');

let allRows = [];

/** Helper to get YYYYMMDD stamp */
function todayStamp() {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2,'0') +
    String(d.getMonth()+1).padStart(2,'0') +
    d.getFullYear()
  );
}

/** Initialize: fetch data, wire up events */
async function init() {
  homeBtn.onclick     = () => location.href = 'index.html';
  clearLink.onclick   = clearFilters;
  downloadCsv.onclick = exportCsv;
  downloadPdf.onclick = exportPdf;

  // Fetch everything in one go from the new view
  const { data, error } = await supabase
    .from('bottled_stock_report')
    .select('*')
    .order('item');

  if (error) {
    console.error('Error loading bottled_stock_report:', error);
    tbody.innerHTML = `<tr class="no-data"><td colspan="5">Failed to load data</td></tr>`;
    return;
  }

  allRows = data;
  populateItemFilter();
  renderTable();

  fItem.onchange = () => {
    populateBnFilter();
    renderTable();
  };
  fBN.onchange = renderTable;
}

/** Build the Item dropdown */
function populateItemFilter() {
  const items = Array.from(new Set(allRows.map(r => r.item))).sort();
  fItem.innerHTML = `<option value="">Item</option>` +
    items.map(i => `<option value="${i}">${i}</option>`).join('');
  // Reset BN when items repopulate
  fBN.disabled = true;
  fBN.innerHTML = `<option value="">BN</option>`;
}

/** Build the BN dropdown for the selected Item */
function populateBnFilter() {
  if (!fItem.value) {
    fBN.disabled = true;
    fBN.innerHTML = `<option value="">BN</option>`;
    return;
  }
  const bns = Array.from(new Set(
    allRows
      .filter(r => r.item === fItem.value)
      .map(r => r.batch_number)
  )).sort();
  fBN.disabled = false;
  fBN.innerHTML = `<option value="">BN</option>` +
    bns.map(b => `<option value="${b}">${b}</option>`).join('');
}

/** Render the table body based on current filters */
function renderTable() {
  tbody.innerHTML = '';
  let rows = allRows;
  if (fItem.value) rows = rows.filter(r => r.item === fItem.value);
  if (fBN.value)   rows = rows.filter(r => r.batch_number === fBN.value);

  if (!rows.length) {
    tbody.innerHTML = `<tr class="no-data"><td colspan="5">No records found</td></tr>`;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.item}</td>
      <td>${r.batch_number}</td>
      <td>${r.pack_size}</td>
      <td>${r.uom}</td>
      <td>${r.on_hand}</td>
    `;
    tbody.append(tr);
  }
}

/** Clear both filters and redraw */
function clearFilters() {
  fItem.value = '';
  fBN.value   = '';
  fBN.disabled = true;
  renderTable();
}

/** Export visible rows as CSV */
function exportCsv() {
  const headers = ['ITEM','BN','PACK SIZE','UOM','STOCK ON HAND']
    .map(h => `"${h}"`).join(',');
  const rows = Array.from(tbody.rows)
    .filter(r => !r.classList.contains('no-data'))
    .map(tr =>
      Array.from(tr.cells)
        .map(td => `"${td.textContent}"`)
        .join(',')
    );
  const csv = [headers, ...rows].join('\r\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${todayStamp()}_bottled_stock.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export visible rows as PDF (WIP Stock header/style) */
async function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();

  // Header / subheader
  doc.setFont('Helvetica','normal').setFontSize(10)
     .text('Gurucharanam Saranam', pw/2, 30, { align:'center' });
  doc.setFont('Helvetica','bold').setFontSize(12)
     .text('Santhigiri Ayurveda Siddha Vaidyasala', pw/2, 55, { align:'center' });
  doc.setFont('Helvetica','bold').setFontSize(14)
     .text(`BOTTLED STOCK AS ON ${new Date().toLocaleDateString('en-GB')}`,
           pw/2, 85, { align:'center' });

  // Table
  const head = ['ITEM','BN','PACK SIZE','UOM','STOCK ON HAND'];
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
      textColor:[0,0,0], lineColor:[0,0,0], lineWidth:0.5,
      halign:'center', valign:'middle'
    },
    headStyles: {
      font:'Helvetica', fontStyle:'bold', fillColor:[255,255,255],
      textColor:[0,0,0], lineColor:[0,0,0], lineWidth:0.5
    },
    columnStyles:{ 0:{ halign:'left' } },
    willDrawCell: d => {
      doc.setFont('Helvetica', d.section==='head' ? 'bold' : 'normal');
    },
    didDrawPage: () => {
      const page = doc.internal.getNumberOfPages();
      doc.setFont('Helvetica','normal').setFontSize(10)
         .text(`Page ${page}`, pw-40, ph-10);
    }
  });

  doc.save(`${todayStamp()}_bottled_stock.pdf`);
}

window.addEventListener('DOMContentLoaded', init);