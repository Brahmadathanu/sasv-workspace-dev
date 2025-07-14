/* ===========================================================================
   log-view.js  —  View Logs dashboard
   ---------------------------------------------------------------------------
   • Adds a “Log Date” filter (dd-mm-yyyy) with flatpickr + input mask.
   • Natural-order table sorting: Date ↑, Item A-Z, BN ↑, Plant natural ↑.
   • Clean, fully validated cascading filters + clear-all.
=========================================================================== */

import { supabase } from './supabaseClient.js';

/* ── Flatpickr base config -------------------------------------------------- */
const fpBase = {
  dateFormat : 'd-m-Y',
  allowInput : true,
  clickOpens : true,
  plugins    : [confirmDatePlugin({
    showTodayButton   : true,
    showClearButton   : true,
    showConfirmButton : false,
    todayText         : 'Today',
    clearText         : 'Clear'
  })]
};

/* DD-MM-YYYY helpers (avoid TZ pitfalls) */
const parseDMY  = s => { const [d,m,y] = s.split('-').map(Number); return new Date(y, m-1, d); };
const toISODate = s => { const [d,m,y] = s.split('-'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`; };
const fmtDMY    = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

/* Simple mask that inserts “-” while typing */
const attachMask = el =>
  el.addEventListener('input', () => {
    let v = el.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    el.value = v;
  });

/* ── Short DOM helper ------------------------------------------------------- */
const $ = s => document.querySelector(s);

/* ── Element refs ----------------------------------------------------------- */
const homeBtn  = $('#homeBtn');
const fDate    = $('#filterDate');
const fSection = $('#filterSection');
const fSub     = $('#filterSubsection');
const fArea    = $('#filterArea');
const fPlant   = $('#filterPlant');
const fItem    = $('#filterItem');
const fBN      = $('#filterBN');
const fStatus  = $('#filterStatus');
const clearBtn = $('#clearFilters');

const tbody      = $('#logsTableBody');
const overlay    = $('#viewOverlay');
const detailBody = $('#detailTable');
const btnClose   = $('#closeView');

/* ── Helpers ---------------------------------------------------------------- */
const show = el => el.style.display = el.tagName === 'TABLE' ? 'table' : 'flex';
const hide = el => el.style.display = 'none';

const fmtDate = v => v ? new Date(v).toLocaleDateString('en-GB') : '—';

const populate = (sel, rows, valKey, txtKey, ph) =>
  sel.innerHTML = `<option value="">${ph}</option>` +
    rows.map(r => `<option value="${r[valKey]}">${r[txtKey]}</option>`).join('');

/* Plant-name cache for natural sort */
const plantMap = {};

/* ── Initial bootstrap ------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', init);

async function init () {
  /* Home nav */
  homeBtn.onclick = () => location.href = 'index.html';

  /* Date picker + mask */
  attachMask(fDate);
  flatpickr(fDate, fpBase);
  fDate.addEventListener('change', loadTable);

  /* Close details modal */
  btnClose.onclick = () => hide(overlay);

  /* Clear filters */
  clearBtn.onclick = () => {
    [fDate,fSection,fSub,fArea,fPlant,fItem,fBN,fStatus].forEach(el => el.value = '');
    [fSub,fArea,fPlant,fBN].forEach(el => el.disabled = true);
    cascadeSub(); cascadeArea(); cascadePlant();
    loadItems(); loadBN(); loadTable();
  };

  /* Plant lookup */
  const { data: pl } = await supabase.from('plant_machinery').select('id,plant_name');
  pl.forEach(p => plantMap[p.id] = p.plant_name);

  /* Load Sections */
  const { data: secs } = await supabase.from('sections')
                                       .select('id,section_name').order('section_name');
  populate(fSection, secs, 'id', 'section_name', 'Section');

  /* Cascading wiring */
  fSection.onchange = () => { cascadeSub(); cascadeArea(); cascadePlant(); loadItems(); loadBN(); loadTable(); };
  fSub     .onchange = () => { cascadeArea(); cascadePlant();               loadItems(); loadBN(); loadTable(); };
  fArea    .onchange = () => { cascadePlant();                               loadItems(); loadBN(); loadTable(); };
  fPlant   .onchange = () => {                                               loadItems(); loadBN(); loadTable(); };
  fItem    .onchange = () => {                                               loadBN();    loadTable(); };
  fBN      .onchange = loadTable;
  fStatus  .onchange = loadTable;

  /* First pass */
  cascadeSub(); cascadeArea(); cascadePlant();
  await loadItems(); await loadBN(); await loadTable();
}

/* ── Cascades --------------------------------------------------------------- */
function cascadeSub () {
  if (!fSection.value) {
    populate(fSub, [], '', '', 'Sub-section'); fSub.disabled = true;
  } else {
    supabase.from('subsections')
      .select('id,subsection_name').eq('section_id', fSection.value)
      .order('subsection_name')
      .then(({ data }) => { populate(fSub, data, 'id', 'subsection_name', 'Sub-section'); fSub.disabled = false; });
  }
}

function cascadeArea () {
  if (!fSub.value) {
    populate(fArea, [], '', '', 'Area'); fArea.disabled = true;
  } else {
    supabase.from('areas')
      .select('id,area_name').eq('subsection_id', fSub.value)
      .order('area_name')
      .then(({ data }) => { populate(fArea, data, 'id', 'area_name', 'Area'); fArea.disabled = false; });
  }
}

function cascadePlant () {
  if (!fArea.value) {
    populate(fPlant, [], '', '', 'Plant / Machinery'); fPlant.disabled = true;
  } else {
    supabase.from('plant_machinery')
      .select('id,plant_name').eq('area_id', fArea.value)
      .order('plant_name')
      .then(({ data }) => { populate(fPlant, data, 'id', 'plant_name', 'Plant / Machinery'); fPlant.disabled = false; });
  }
}

/* ── Unique Item / BN loaders ---------------------------------------------- */
async function loadItems () {
  let q = supabase.from('daily_work_log').select('item');
  if (fSection.value) q = q.eq('section_id',    fSection.value);
  if (fSub.value)     q = q.eq('subsection_id', fSub.value);
  if (fArea.value)    q = q.eq('area_id',       fArea.value);
  if (fPlant.value)   q = q.eq('plant_id',      fPlant.value);

  const { data, error } = await q;
  if (error) return console.error(error);

  const uniq = [...new Set((data || []).map(r => r.item))]
    .map(item => ({ item }))
    .sort((a, b) => a.item.localeCompare(b.item, undefined, { sensitivity: 'base' }));

  populate(fItem, uniq, 'item', 'item', 'Item');
}

async function loadBN () {
  if (!fItem.value) {
    populate(fBN, [], '', '', 'BN'); fBN.disabled = true; return;
  }

  let q = supabase.from('daily_work_log').select('batch_number').eq('item', fItem.value);
  if (fSection.value) q = q.eq('section_id',    fSection.value);
  if (fSub.value)     q = q.eq('subsection_id', fSub.value);
  if (fArea.value)    q = q.eq('area_id',       fArea.value);
  if (fPlant.value)   q = q.eq('plant_id',      fPlant.value);

  const { data, error } = await q;
  if (error) return console.error(error);

  const uniq = [...new Set((data || []).map(r => r.batch_number))]
    .map(bn => ({ bn }))
    .sort((a, b) => a.bn.toString().localeCompare(b.bn.toString(), undefined, { numeric: true }));

  populate(fBN, uniq, 'bn', 'bn', 'BN'); fBN.disabled = !uniq.length;
}

/* ── Main table refresh ----------------------------------------------------- */
async function loadTable () {
  tbody.replaceChildren();

  let q = supabase.from('daily_work_log')
    .select(`
      id,log_date,item,batch_number,batch_size,batch_uom,activity,plant_id,status,
      plant_machinery(plant_name)
    `);

  /* Date filter */
  if (fDate.value) q = q.eq('log_date', toISODate(fDate.value));

  /* Other filters */
  if (fSection.value) q = q.eq('section_id',    fSection.value);
  if (fSub.value)     q = q.eq('subsection_id', fSub.value);
  if (fArea.value)    q = q.eq('area_id',       fArea.value);
  if (fPlant.value)   q = q.eq('plant_id',      fPlant.value);
  if (fItem.value)    q = q.eq('item',          fItem.value);
  if (fBN.value)      q = q.eq('batch_number',  fBN.value);
  if (fStatus.value)  q = q.eq('status',        fStatus.value);

  const { data, error } = await q;
  if (error) return console.error(error);

  /* Natural sort: Date ↑, Item A-Z, BN ↑, Plant natural ↑ */
  const coll = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  data.sort((a, b) => {
    const dt  = new Date(a.log_date) - new Date(b.log_date); if (dt) return dt;
    const itm = a.item.localeCompare(b.item, undefined, { sensitivity:'base' }); if (itm) return itm;
    const bn  = a.batch_number.toString().localeCompare(b.batch_number.toString(), undefined, { numeric:true }); if (bn) return bn;
    const pa  = a.plant_machinery?.plant_name || '';
    const pb  = b.plant_machinery?.plant_name || '';
    return coll.compare(pa, pb);
  });

  /* Render */
  data.forEach(r => {
    const plantName = r.plant_machinery?.plant_name || '';
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${fmtDate(r.log_date)}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${r.batch_size}</td>
        <td>${r.batch_uom}</td>
        <td>${plantName}</td>
        <td>${r.activity}</td>
        <td><a href="#" class="view-link" data-id="${r.id}">View</a></td>
      </tr>`);
  });

  /* Detail handlers */
  [...document.querySelectorAll('.view-link')]
    .forEach(a => a.addEventListener('click', showDetails));
}

/* ── Details modal ---------------------------------------------------------- */
async function showDetails (e) {
  e.preventDefault();
  const id = e.currentTarget.dataset.id;

  const { data: log, error } = await supabase
    .from('daily_work_log')
    .select(`
      *,sections(section_name),subsections(subsection_name),
      areas(area_name),plant_machinery(plant_name)
    `).eq('id', id).single();
  if (error) return console.error(error);

  detailBody.innerHTML = '';
  const rows = [
    ['Date',              fmtDate(log.log_date)],
    ['Section',           log.sections?.section_name],
    ['Sub-section',       log.subsections?.subsection_name],
    ['Area',              log.areas?.area_name],
    ['Plant / Machinery', log.plant_machinery?.plant_name],
    ['Item',              log.item],
    ['Batch #',           log.batch_number],
    ['Batch Size',        log.batch_size],
    ['Batch UOM',         log.batch_uom],
    ['Activity',          log.activity],
    ['Juice/Decoction',   log.juice_or_decoction],
    ['Specify',           log.specify],
    ['Count Saravam',     log.count_of_saravam],
    ['Fuel',              log.fuel],
    ['Fuel Under',        log.fuel_under],
    ['Fuel Over',         log.fuel_over],
    ['Started On',        fmtDate(log.started_on)],
    ['Due Date',          fmtDate(log.due_date)],
    ['Status',            log.status],
    ['Completed On',      fmtDate(log.completed_on)],
    ['Qty After Process', log.qty_after_process],
    ['UOM After',         log.qty_uom],
    ['Lab Ref Number',    log.lab_ref_number],
    ['SKU Breakdown',     log.sku_breakdown],
    ['Remarks',           log.remarks],
    ['Uploaded By',       log.uploaded_by],
    ['Created At',        fmtDate(log.created_at)]
  ];

  rows.forEach(([lbl, val]) => {
    if (val !== null && val !== undefined && val !== '') {
      detailBody.insertAdjacentHTML('beforeend',
        `<tr><th>${lbl}</th><td>${val}</td></tr>`);
    }
  });

  show(overlay);
}