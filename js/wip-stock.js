// js/wip-stock.js
import { supabase } from './supabaseClient.js';

/* ══════════════════════════════════════════════════════════════
   1.  HELPER FUNCTIONS
   ══════════════════════════════════════════════════════════════ */
const fmtDate = iso =>
  iso ? iso.split('-').reverse().join('/') : '—';

const todayStamp = () => {
  const d = new Date();
  return (
    String(d.getDate()).padStart(2, '0') +
    String(d.getMonth() + 1).padStart(2, '0') +
    d.getFullYear()
  );
};

const show = el => { el.style.display = el.tagName === 'TABLE' ? 'table' : 'flex'; };
const hide = el => { el.style.display = 'none'; };

/* ══════════════════════════════════════════════════════════════
   2.  DOM REFERENCES
   ══════════════════════════════════════════════════════════════ */
const homeBtn     = document.getElementById('homeBtn');
const fSection    = document.getElementById('filterSection');
const fSub        = document.getElementById('filterSubsection');
const fArea       = document.getElementById('filterArea');
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

/* ══════════════════════════════════════════════════════════════
   3.  GENERIC SELECT “POPULATE” HELPER
   ══════════════════════════════════════════════════════════════ */
function populate(sel, rows, vKey, tKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  rows.forEach(r => {
    const opt = document.createElement('option');
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
    .from('sections')
    .select('id,section_name')
    .order('section_name');
  if (error) { console.error(error); return; }
  populate(fSection, data, 'id', 'section_name', 'Section');
}

async function loadSubsections() {
  if (!fSection.value) {
    populate(fSub, [], '', '', 'Sub-section');
    fSub.disabled = true;
    return;
  }
  const { data, error } = await supabase
    .from('subsections')
    .select('id,subsection_name')
    .eq('section_id', fSection.value)
    .order('subsection_name');
  if (error) { console.error(error); return; }
  populate(fSub, data, 'id', 'subsection_name', 'Sub-section');
  fSub.disabled = false;
}

async function loadAreas() {
  if (!fSection.value || !fSub.value) {
    populate(fArea, [], '', '', 'Area');
    fArea.disabled = true;
    return;
  }
  const { data, error } = await supabase
    .from('areas')
    .select('id,area_name')
    .eq('section_id', fSection.value)
    .eq('subsection_id', fSub.value)
    .order('area_name');
  if (error) { console.error(error); return; }
  populate(fArea, data, 'id', 'area_name', 'Area');
  fArea.disabled = false;
}

async function loadItems() {
  const { data, error } = await supabase
    .from('daily_work_log')
    .select('item', { distinct: true })
    .order('item');
  if (error) { console.error(error); return; }
  const unique = [...new Set(data.map(r => r.item))]
    .map(item => ({ item }));
  populate(fItem, unique, 'item', 'item', 'Item');
}

async function loadBNs() {
  if (!fItem.value) {
    populate(fBN, [], '', '', 'BN');
    fBN.disabled = true;
    return;
  }
  const { data, error } = await supabase
    .from('daily_work_log')
    .select('batch_number', { distinct: true })
    .eq('item', fItem.value)
    .order('batch_number');
  if (error) { console.error(error); return; }
  const unique = [...new Set(data.map(r => r.batch_number))]
    .map(bn => ({ bn }));
  populate(fBN, unique, 'bn', 'bn', 'BN');
  fBN.disabled = false;
}

/* ══════════════════════════════════════════════════════════════
   5.  MAIN TABLE RENDER (WITH DE-DUPLICATION)
   ══════════════════════════════════════════════════════════════ */

async function renderTable () {
  tbody.innerHTML = '';

  const { data: raw = [], error } = await supabase
    .from('daily_work_log')
    .select(`
      id, log_date, section_id, subsection_id, area_id,
      item, batch_number, batch_size, batch_uom,
      activity, started_on, due_date
    `)
    .eq('status', 'Doing');
  if (error) { console.error(error); return; }

  /* 1️⃣  Deduplicate on composite key */
  const uniq = new Map();
  raw.forEach(r => {
    const key = [
      r.item, r.batch_number,
      r.batch_size, r.batch_uom, r.activity
    ].join('|');

    if (!uniq.has(key)) {
      uniq.set(key, { ...r });
    } else {
      const ex = uniq.get(key);
      /* keep earliest Started / Due */
      if (r.started_on && (!ex.started_on || r.started_on < ex.started_on))
        ex.started_on = r.started_on;
      if (r.due_date && (!ex.due_date || r.due_date < ex.due_date))
        ex.due_date = r.due_date;
    }
  });

  /* 2️⃣  Array for the rest of the pipeline */
  let rows = Array.from(uniq.values());

  /* 3️⃣  FILTERING  — Over-Due now removes non-overdue rows */
  const todayISO = new Date().toISOString().slice(0, 10);

  rows = rows.filter(r => {
    if (fOverdue.checked && (!r.due_date || r.due_date >= todayISO)) return false;
    if (fSection.value && r.section_id    !== +fSection.value) return false;
    if (fSub.value     && r.subsection_id !== +fSub.value)     return false;
    if (fArea.value    && r.area_id       !== +fArea.value)    return false;
    if (fItem.value    && r.item          !== fItem.value)     return false;
    if (fBN.value      && r.batch_number  !== fBN.value)       return false;
    return true;
  });

  /* 4️⃣  SORTING */
  rows.sort((a, b) => {
    if (fOverdue.checked) {
      /* overdue mode – earliest due first */
      const da = new Date(a.due_date), db = new Date(b.due_date);
      if (da - db) return da - db;
    } else {
      /* normal mode – earliest log_date first */
      const la = new Date(a.log_date), lb = new Date(b.log_date);
      if (la - lb) return la - lb;
    }
    const ci = a.item.localeCompare(b.item);
    if (ci) return ci;
    return a.activity.localeCompare(b.activity);
  });

  /* 5️⃣  RENDER */
  rows.forEach(r => {
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

  tbody.querySelectorAll('.view-link')
       .forEach(a => a.addEventListener('click', showDetails));
}

/* ══════════════════════════════════════════════════════════════
   6.  “VIEW” MODAL
   ══════════════════════════════════════════════════════════════ */
async function showDetails(evt) {
  evt.preventDefault();
  const id = evt.currentTarget.dataset.id;

  const { data: d, error } = await supabase
    .from('daily_work_log')
    .select(`
      *, sections(section_name),
         subsections(subsection_name),
         areas(area_name)
    `)
    .eq('id', id)
    .single();
  if (error) { console.error(error); return; }

  detailBody.innerHTML = '';
  const fields = [
    ['Date',        fmtDate(d.log_date)],
    ['Section',     d.sections?.section_name],
    ['Sub-section', d.subsections?.subsection_name],
    ['Area',        d.areas?.area_name],
    ['Item',        d.item],
    ['BN',          d.batch_number],
    ['Batch Size',  d.batch_size],
    ['Batch UOM',   d.batch_uom],
    ['Activity',    d.activity],
    ['Started On',  fmtDate(d.started_on)],
    ['Due Date',    fmtDate(d.due_date)]
  ];
  fields.forEach(([label,val]) => {
    if (val && val !== '—') {
      detailBody.insertAdjacentHTML(
        'beforeend',
        `<tr><th>${label}</th><td>${val}</td></tr>`
      );
    }
  });

  show(overlay);
}

/* ══════════════════════════════════════════════════════════════
   7.  EXPORTS
   ══════════════════════════════════════════════════════════════ */
function exportCsv() {
  const headers = Array.from(
    document.querySelectorAll('#wipTable thead th:not(:last-child)')
  ).map(th => `"${th.textContent.replace(/"/g,'""')}"`);

  const rows = Array.from(tbody.rows).map(tr =>
    Array.from(tr.cells).slice(0, -1)
      .map(td => `"${td.textContent.replace(/"/g,'""')}"`)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);

  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${todayStamp()}_wip_stock.csv`
  });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* --------------  PDF (unchanged – header row already bold) --- */
async function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();

  /* Title block */
  doc.setFont('Helvetica','normal').setFontSize(10)
     .text('Gurucharanam Saranam', pw/2, 30, { align:'center' });
  doc.setFont('Helvetica','bold').setFontSize(12)
     .text('Santhigiri Ayurveda Siddha Vaidyasala', pw/2, 55, { align:'center' });
  doc.setFont('Helvetica','bold').setFontSize(14)
     .text(`WIP SOH AS ON ${new Date().toLocaleDateString('en-GB')}`, pw/2, 85, { align:'center' });

  /* Build arrays from the CURRENT tbody (already deduped) */
  const head = Array.from(document.querySelectorAll('#wipTable thead th'))
               .slice(1,-1).map(th => th.textContent.trim());
  const body = Array.from(tbody.rows).map(tr =>
               Array.from(tr.cells).slice(1,-1).map(td => td.textContent.trim()));

  doc.autoTable({
    startY: 100,
    head: [head],
    body,
    theme: 'grid',
    margin: { left:40,right:40 },

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
      doc.setFont('Helvetica','normal').setFontSize(10)
         .text(`Page ${doc.internal.getNumberOfPages()}`, pw-40, ph-10, { align:'right' });
    }
  });

  doc.save(`${todayStamp()}_wip_stock.pdf`);
}

/* ══════════════════════════════════════════════════════════════
   8.  CLEAR FILTERS
   ══════════════════════════════════════════════════════════════ */
function clearAll() {
  [fSection, fSub, fArea, fItem, fBN].forEach(sel => {
    sel.value = '';
    sel.disabled = sel !== fSection && sel !== fItem;
  });
  fOverdue.checked = false;
  renderTable();
}

/* ══════════════════════════════════════════════════════════════
   9.  INITIALISATION
   ══════════════════════════════════════════════════════════════ */
async function init() {
  /* Events */
  homeBtn.onclick     = () => (location.href = 'index.html');
  closeWip.onclick    = () => hide(overlay);
  downloadCsv.onclick = exportCsv;
  downloadPdf.onclick = exportPdf;
  btnClear.onclick    = clearAll;

  /* Disable dependent selects initially */
  fSub.disabled = true; fArea.disabled = true; fBN.disabled = true;

  await loadSections();
  await loadItems();

  /* Cascade listeners */
  fSection.onchange = async () => {
    await loadSubsections();
    fArea.innerHTML = '<option value="">Area</option>';
    fArea.disabled  = true;
    renderTable();
  };
  fSub.onchange     = async () => { await loadAreas(); renderTable(); };
  fArea.onchange    = renderTable;
  fItem.onchange    = async () => { await loadBNs(); renderTable(); };
  fBN.onchange      = renderTable;
  fOverdue.onchange = renderTable;

  /* First paint */
  await renderTable();
}

window.addEventListener('DOMContentLoaded', init);