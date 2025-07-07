import { supabase } from './supabaseClient.js';

// — Helpers —
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
}
const todayISO = () => new Date().toISOString().slice(0,10);
const todayStamp = () => {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2,'0') +
    String(d.getMonth()+1).padStart(2,'0') +
    d.getFullYear()
  );
};
const show = el => el.style.display = el.tagName==='TABLE' ? 'table' : 'flex';
const hide = el => el.style.display = 'none';

// — DOM refs —
const homeIcon    = document.getElementById('homeIcon');
const fSection    = document.getElementById('filterSection');
const fSub        = document.getElementById('filterSubsection');
const fArea       = document.getElementById('filterArea');
const fPlant      = document.getElementById('filterPlant');
const fItem       = document.getElementById('filterItem');
const fBN         = document.getElementById('filterBN');
const fOverdue    = document.getElementById('filterOverdue');
const btnClear    = document.getElementById('clearFilters');
const downloadCsv = document.getElementById('downloadCsv');
const downloadPdf = document.getElementById('downloadPdf');
const tbody       = document.getElementById('wipTableBody');
const overlay     = document.getElementById('wipOverlay');
const closeWip    = document.getElementById('closeWip');
const detailBody  = document.getElementById('detailTable');

// — Populate a <select> helper —
function populate(sel, rows, vKey, tKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r[vKey];
    opt.textContent = r[tKey];
    sel.append(opt);
  });
}

// — Export CSV —
function exportCsv() {
  const headers = Array.from(
    document.querySelectorAll('#wipTable thead th:not(:last-child)')
  ).map(th => `"${th.textContent.trim().replace(/"/g,'""')}"`);

  const rows = Array.from(tbody.querySelectorAll('tr')).map(tr =>
    Array.from(tr.querySelectorAll('td:not(:last-child)'))
      .map(td => `"${td.textContent.trim().replace(/"/g,'""')}"`)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${todayStamp()}_wip_stock.csv`;
  document.body.append(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// — Export PDF via jsPDF & AutoTable —
async function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();

  // Header
  doc.setFont('Arial','bold').setFontSize(10);
  doc.text('Gurucharanam Saranam', pw/2, 30, { align:'center' });
  doc.setFont('Arial','normal').setFontSize(12);
  doc.text('Santhigiri Ayurveda Siddha Vaidyasala', pw/2, 55, { align:'center' });
  doc.setFont('Arial','bold').setFontSize(14);
  doc.text(`WIP SOH AS ON ${new Date().toLocaleDateString('en-GB')}`, pw/2, 85, { align:'center' });

  // Prepare table data (skip Date & Action columns)
  const headers = Array.from(
    document.querySelectorAll('#wipTable thead th:not(:nth-child(1)):not(:last-child)')
  ).map(th => th.textContent.trim());

  const data = Array.from(tbody.querySelectorAll('tr')).map(tr =>
    Array.from(tr.querySelectorAll('td'))
      .filter((_, i) => i !== 0 && i !== 8)
      .map(td => td.textContent.trim())
  );

  doc.autoTable({
    startY: 100,
    head: [headers],
    body: data,
    theme: 'grid',
    styles: {
      font: 'Arial',
      fontStyle: 'normal',
      fontSize: 12,
      textColor: [0,0,0],
      halign: 'center',
      valign: 'middle',
      lineColor: [0,0,0],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [255,255,255],
      textColor: [0,0,0],
      fontStyle: 'bold',
      lineColor: [0,0,0],
      lineWidth: 0.5
    },
    columnStyles: { 0: { halign:'left' } }, // Item column
    margin: { left:40, right:40 },
    didDrawPage: () => {
      doc.setFont('Arial','normal').setFontSize(10);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, pw-40, ph-10, { align:'right' });
    }
  });

  doc.save(`${todayStamp()}_wip_stock.pdf`);
}

// — Load, Sort & Render rows —
async function renderTable() {
  tbody.innerHTML = '';
  const today = todayISO();

  let { data: rows } = await supabase
    .from('daily_work_log')
    .select('id,log_date,section_id,subsection_id,area_id,plant_id,item,batch_number,batch_size,batch_uom,activity,started_on,due_date')
    .eq('status','Doing');

  rows = rows || [];

  // Apply sort
  rows.sort((a,b) => {
    if (fOverdue.checked) {
      // 1) Due On ascending
      const da = new Date(a.due_date), db = new Date(b.due_date);
      if (da - db !== 0) return da - db;
      // 2) fallback to Log Date
      const la = new Date(a.log_date), lb = new Date(b.log_date);
      if (la - lb !== 0) return la - lb;
      // 3) Item
      const ci = a.item.localeCompare(b.item);
      if (ci !== 0) return ci;
      // 4) Activity
      return a.activity.localeCompare(b.activity);
    } else {
      // Normal: Log Date → Item → Activity
      const la = new Date(a.log_date), lb = new Date(b.log_date);
      if (la - lb !== 0) return la - lb;
      const ci = a.item.localeCompare(b.item);
      if (ci !== 0) return ci;
      return a.activity.localeCompare(b.activity);
    }
  });

  // Filter by fields (Overdue only affects sort)
  const filtered = rows.filter(r => {
    if (fSection.value && r.section_id !== +fSection.value) return false;
    if (fSub.value && r.subsection_id !== +fSub.value)   return false;
    if (fArea.value && r.area_id !== +fArea.value)       return false;
    if (fPlant.value && r.plant_id !== +fPlant.value)    return false;
    if (fItem.value && r.item !== fItem.value)           return false;
    if (fBN.value && r.batch_number !== fBN.value)       return false;
    return true;
  });

  filtered.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(r.log_date)}</td>
      <td>${r.item}</td>
      <td>${r.batch_number}</td>
      <td>${r.batch_size}</td>
      <td>${r.batch_uom}</td>
      <td>${r.activity}</td>
      <td>${fmtDate(r.started_on)}</td>
      <td>${fmtDate(r.due_date)}</td>
      <td><a href="#" class="view-link" data-id="${r.id}">View</a></td>
    `;
    tbody.append(tr);
  });

  document.querySelectorAll('.view-link').forEach(a => (a.onclick = showDetails));
}

// — Show Detail Modal —
async function showDetails(evt) {
  evt.preventDefault();
  const id = evt.currentTarget.dataset.id;

  const { data: d } = await supabase
    .from('daily_work_log')
    .select(`
      *,
      sections(section_name),
      subsections(subsection_name),
      areas(area_name),
      plant_machinery(plant_name)
    `)
    .eq('id', id)
    .single();

  detailBody.innerHTML = '';
  const fields = [
    ['Date', d.log_date && fmtDate(d.log_date)],
    ['Section', d.sections?.section_name],
    ['Sub-section', d.subsections?.subsection_name],
    ['Area', d.areas?.area_name],
    ['Plant', d.plant_machinery?.plant_name],
    ['Item', d.item],
    ['BN', d.batch_number],
    ['Batch Size', d.batch_size],
    ['Batch UOM', d.batch_uom],
    ['Activity', d.activity],
    ['Juice/Decoction', d.juice_or_decoction],
    ['Specify', d.specify],
    ['Count of Saravam', d.count_of_saravam],
    ['Fuel', d.fuel],
    ['Fuel Under', d.fuel_under],
    ['Fuel Over', d.fuel_over],
    ['Started On', d.started_on && fmtDate(d.started_on)],
    ['Due Date', d.due_date && fmtDate(d.due_date)],
    ['Status', d.status],
    ['Completed On', d.completed_on && fmtDate(d.completed_on)],
    ['Qty After Process', d.qty_after_process],
    ['UOM After', d.qty_uom],
    ['Lab Ref Number', d.lab_ref_number],
    ['SKU Breakdown', d.sku_breakdown],
    ['Remarks', d.remarks],
    ['Uploaded By', d.uploaded_by],
    ['Created At', d.created_at && fmtDate(d.created_at.split(' ')[0])]
  ];

  fields.forEach(([label, value]) => {
    if (value != null && value !== '') {
      const tr = document.createElement('tr');
      tr.innerHTML = `<th>${label}</th><td>${value}</td>`;
      detailBody.append(tr);
    }
  });

  show(overlay);
}

// — Initialization —
async function init() {
  homeIcon.onclick    = () => (location.href = 'index.html');
  closeWip.onclick    = () => hide(overlay);
  downloadCsv.onclick = exportCsv;
  downloadPdf.onclick = exportPdf;
  btnClear.onclick    = () => {
    [fSection, fSub, fArea, fPlant, fItem, fBN].forEach(s => {
      s.value = '';
      s.disabled = s !== fSection && s !== fItem;
    });
    fOverdue.checked = false;
    renderTable();
  };

  // Load filters
  let { data: secs } = await supabase
    .from('sections')
    .select('id,section_name')
    .order('section_name');
  populate(fSection, secs, 'id', 'section_name', 'Section');

  let { data: items } = await supabase
    .from('daily_work_log')
    .select('item', { distinct: true })
    .order('item');
  populate(fItem, items.map(r => ({ item: r.item })), 'item', 'item', 'Item');

  [fSub, fArea, fPlant, fBN].forEach(el => (el.disabled = true));

  fSection.onchange = () => renderTable();
  fSub.onchange     = () => renderTable();
  fArea.onchange    = () => renderTable();
  fPlant.onchange   = () => renderTable();
  fItem.onchange    = () => renderTable();
  fBN.onchange      = () => renderTable();
  fOverdue.onchange = () => renderTable();

  await renderTable();
}

window.addEventListener('DOMContentLoaded', init);