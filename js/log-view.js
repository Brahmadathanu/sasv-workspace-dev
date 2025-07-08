// js/log-view.js
import { supabase } from './supabaseClient.js';

// — Helpers —
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB');
}

// Populate a <select> with a placeholder and array of rows
function populate(sel, rows, vKey, tKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  (rows || []).forEach(r => {
    const o = document.createElement('option');
    o.value = r[vKey];
    o.textContent = r[tKey];
    sel.append(o);
  });
}

// Show/hide elements, tables vs. flex containers
const show = el => el.style.display = el.tagName === 'TABLE' ? 'table' : 'flex';
const hide = el => el.style.display = 'none';

// — Element refs —
const homeBtn    = document.getElementById('homeBtn');
const fSection   = document.getElementById('filterSection');
const fSub       = document.getElementById('filterSubsection');
const fArea      = document.getElementById('filterArea');
const fPlant     = document.getElementById('filterPlant');
const fItem      = document.getElementById('filterItem');
const fBN        = document.getElementById('filterBN');
const fStatus    = document.getElementById('filterStatus');
const btnClear   = document.getElementById('clearFilters');
const tbody      = document.getElementById('logsTableBody');
const overlay    = document.getElementById('viewOverlay');
const btnClose   = document.getElementById('closeView');
const detailBody = document.getElementById('detailTable');

// — Initialization —
async function init() {
  // Home nav
  homeBtn.onclick = () => location.href = 'index.html';

  // Close detail modal
  btnClose.onclick = () => hide(overlay);

  // Clear filters
  btnClear.onclick = () => {
    [fSection, fSub, fArea, fPlant, fItem, fBN, fStatus].forEach(s => {
      s.value = '';
      s.disabled = (s !== fSection && s !== fItem && s !== fStatus);
    });
    cascadeSub();
    cascadeArea();
    cascadePlant();
    loadItems();
    loadBN();
    loadTable();
  };

  // Load sections
  const { data: secs } = await supabase
    .from('sections')
    .select('id,section_name')
    .order('section_name');
  populate(fSection, secs, 'id', 'section_name', 'Section');

  // Cascading
  fSection.onchange = () => { cascadeSub(); cascadeArea(); cascadePlant(); loadItems(); loadBN(); loadTable(); };
  fSub.onchange     = () => { cascadeArea(); cascadePlant(); loadItems(); loadBN(); loadTable(); };
  fArea.onchange    = () => { cascadePlant(); loadItems(); loadBN(); loadTable(); };
  fPlant.onchange   = () => { loadItems(); loadBN(); loadTable(); };

  // Item → BN → table
  fItem.onchange   = () => { loadBN(); loadTable(); };
  fBN.onchange     = () => loadTable();
  fStatus.onchange = () => loadTable();

  // Initial
  cascadeSub();
  cascadeArea();
  cascadePlant();
  await loadItems();
  await loadBN();
  await loadTable();
}

// — Cascades —
function cascadeSub() {
  if (!fSection.value) {
    populate(fSub, [], '', '', 'Sub-section');
    fSub.disabled = true;
  } else {
    supabase
      .from('subsections')
      .select('id,subsection_name')
      .eq('section_id', fSection.value)
      .order('subsection_name')
      .then(({ data }) => {
        populate(fSub, data, 'id', 'subsection_name', 'Sub-section');
        fSub.disabled = false;
      });
  }
}

function cascadeArea() {
  if (!fSub.value) {
    populate(fArea, [], '', '', 'Area');
    fArea.disabled = true;
  } else {
    supabase
      .from('areas')
      .select('id,area_name')
      .eq('subsection_id', fSub.value)
      .order('area_name')
      .then(({ data }) => {
        populate(fArea, data, 'id', 'area_name', 'Area');
        fArea.disabled = false;
      });
  }
}

function cascadePlant() {
  if (!fArea.value) {
    populate(fPlant, [], '', '', 'Plant / Machinery');
    fPlant.disabled = true;
  } else {
    supabase
      .from('plant_machinery')
      .select('id,plant_name')
      .eq('area_id', fArea.value)
      .order('plant_name')
      .then(({ data }) => {
        populate(fPlant, data, 'id', 'plant_name', 'Plant / Machinery');
        fPlant.disabled = false;
      });
  }
}

// — Load and sort unique Items —
async function loadItems() {
  let q = supabase.from('daily_work_log').select('item');
  if (fSection.value) q = q.eq('section_id', fSection.value);
  if (fSub.value)     q = q.eq('subsection_id', fSub.value);
  if (fArea.value)    q = q.eq('area_id', fArea.value);
  if (fPlant.value)   q = q.eq('plant_id', fPlant.value);

  const { data, error } = await q;
  if (error) return console.error(error);

  // dedupe + sort alphabetically
  const uniq = [ ...new Set((data||[]).map(r => r.item)) ]
    .map(item => ({ item }))
    .sort((a,b) => a.item.localeCompare(b.item));

  populate(fItem, uniq, 'item', 'item', 'Item');
}

// — Load and sort unique BNs for selected Item —
async function loadBN() {
  if (!fItem.value) {
    populate(fBN, [], '', '', 'BN');
    fBN.disabled = true;
    return;
  }

  let q = supabase
    .from('daily_work_log')
    .select('batch_number')
    .eq('item', fItem.value);
  if (fSection.value) q = q.eq('section_id', fSection.value);
  if (fSub.value)     q = q.eq('subsection_id', fSub.value);
  if (fArea.value)    q = q.eq('area_id', fArea.value);
  if (fPlant.value)   q = q.eq('plant_id', fPlant.value);

  const { data, error } = await q;
  if (error) return console.error(error);

  // dedupe + sort ascending
  const uniq = [ ...new Set((data||[]).map(r => r.batch_number)) ]
    .map(bn => ({ batch_number: bn }))
    .sort((a,b) => a.batch_number.toString().localeCompare(b.batch_number.toString(), undefined, { numeric: true }));

  populate(fBN, uniq, 'batch_number', 'batch_number', 'BN');
  fBN.disabled = !uniq.length;
}

// — Render main table —
async function loadTable() {
  tbody.innerHTML = '';

  let q = supabase
    .from('daily_work_log')
    .select('id,log_date,item,batch_number,batch_size,batch_uom,activity')
    .order('log_date', { ascending: false });

  if (fSection.value) q = q.eq('section_id', fSection.value);
  if (fSub.value)     q = q.eq('subsection_id', fSub.value);
  if (fArea.value)    q = q.eq('area_id', fArea.value);
  if (fPlant.value)   q = q.eq('plant_id', fPlant.value);
  if (fItem.value)    q = q.eq('item', fItem.value);
  if (fBN.value)      q = q.eq('batch_number', fBN.value);
  if (fStatus.value)  q = q.eq('status', fStatus.value);

  const { data, error } = await q;
  if (error) return console.error(error);

  (data||[]).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(r.log_date)}</td>
      <td>${r.item}</td>
      <td>${r.batch_number}</td>
      <td>${r.batch_size}</td>
      <td>${r.batch_uom}</td>
      <td>${r.activity}</td>
      <td><a href="#" class="view-link" data-id="${r.id}">View</a></td>`;
    tbody.append(tr);
  });

  document.querySelectorAll('.view-link')
          .forEach(a => a.addEventListener('click', showDetails));
}

// — Show detail modal —
async function showDetails(e) {
  e.preventDefault();
  const id = e.currentTarget.dataset.id;

  const { data: log, error } = await supabase
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
  if (error) return console.error(error);

  detailBody.innerHTML = '';
  const fields = [
    ['Date',            fmtDate(log.log_date)],
    ['Section',         log.sections?.section_name],
    ['Sub-section',     log.subsections?.subsection_name],
    ['Area',            log.areas?.area_name],
    ['Plant / Machinery', log.plant_machinery?.plant_name],
    ['Item',            log.item],
    ['Batch #',         log.batch_number],
    ['Batch Size',      log.batch_size],
    ['Batch UOM',       log.batch_uom],
    ['Activity',        log.activity],
    ['Juice/Decoction', log.juice_or_decoction],
    ['Specify',         log.specify],
    ['Count Saravam',   log.count_of_saravam],
    ['Fuel',            log.fuel],
    ['Fuel Under',      log.fuel_under],
    ['Fuel Over',       log.fuel_over],
    ['Started On',      fmtDate(log.started_on)],
    ['Due Date',        fmtDate(log.due_date)],
    ['Status',          log.status],
    ['Completed On',    fmtDate(log.completed_on)],
    ['Qty After Process', log.qty_after_process],
    ['UOM After',        log.qty_uom],
    ['Lab Ref Number',   log.lab_ref_number],
    ['SKU Breakdown',    log.sku_breakdown],
    ['Remarks',          log.remarks],
    ['Uploaded By',      log.uploaded_by],
    ['Created At',       fmtDate(log.created_at)]
  ];

  fields.forEach(([label, val]) => {
    if (val !== null && val !== undefined && val !== '') {
      const tr = document.createElement('tr');
      tr.innerHTML = `<th>${label}</th><td>${val}</td>`;
      detailBody.append(tr);
    }
  });

  show(overlay);
}

window.addEventListener('DOMContentLoaded', init);