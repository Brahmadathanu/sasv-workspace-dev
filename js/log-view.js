/* ===========================================================================
   log-view.js  —  View Logs dashboard
   ---------------------------------------------------------------------------
   • Adds a “Log Date” filter (dd-mm-yyyy) with flatpickr + input mask.
   • Natural-order table sorting: Date ↑, Item A-Z, BN ↑, Plant natural ↑.
   • Clean, fully validated cascading filters + clear-all.
=========================================================================== */

import { supabase } from '../public/shared/js/supabaseClient.js';

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
const backBtn  = $('#backBtn');
const fDate    = $('#filterDate');
const fSection = $('#filterSection');
const fSub     = $('#filterSubsection');
const fArea    = $('#filterArea');
const fPlant   = $('#filterPlant');
const fItem    = $('#filterItem');
const fBN      = $('#filterBN');
const fAct     = $('#filterActivity');
const fStatus  = $('#filterStatus');
const clearBtn = $('#clearFilters');

const toggleAdvanced   = $('#toggleAdvanced');
const filtersAdvanced  = $('#filtersAdvanced');

const dlCsv    = $('#downloadCsv');
const dlPdf    = $('#downloadPdf');

const tbody      = $('#logsTableBody');
const overlay    = $('#viewOverlay');
const detailBody = $('#detailTable');
const btnClose   = $('#closeView');

/* ── Helpers ---------------------------------------------------------------- */
const show = el => el.style.display = el.tagName === 'TABLE' ? 'table' : 'flex';
const hide = el => el.style.display = 'none';

const fmtDate = v => v ? new Date(v).toLocaleDateString('en-GB') : '—';

/* YYYYMMDD stamp for filenames */
const todayStamp = () => {
  const d = new Date();
  return String(d.getDate()).padStart(2,'0') +
         String(d.getMonth()+1).padStart(2,'0') +
         d.getFullYear();
};

const populate = (sel, rows, valKey, txtKey, ph) =>
  sel.innerHTML = `<option value="">${ph}</option>` +
    rows.map(r => `<option value="${r[valKey]}">${r[txtKey]}</option>`).join('');

/* Plant-name cache for natural sort */
const plantMap = {};

/* Section-name cache (for table render) */
const sectionMap = {};

/* ── Initial bootstrap ------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', init);

async function init () {
  /* Home nav */
  homeBtn.onclick = () => location.href = 'index.html';
  backBtn.onclick = () => window.history.back();

  /* Date picker + mask */
  attachMask(fDate);
  flatpickr(fDate, fpBase);
  fDate.addEventListener('change', loadTable);

  /* Close details modal */
  btnClose.onclick = () => hide(overlay);

/* Clear filters */
clearBtn.onclick = () => {
  // 1) Reset native filter values
  [fDate, fSection, fSub, fArea, fStatus].forEach(el => el.value = '');

  // 2) Reset Tom Select fields using Tom Select API (except BN)
  itemTomSelect.clear();
  activityTomSelect.clear();
  plantTomSelect.clear();

  // 3) Reset BN dropdown to empty and disable
  populate(fBN, [], '', '', 'BN');
  fBN.disabled = true;

  // 4) Disable cascading selects (Sub-section, Area)
  [fSub, fArea].forEach(el => el.disabled = true);

  // 5) Repopulate dependents
  cascadeSub();
  cascadeArea();
  loadBNs();

  // 6) Collapse advanced filters and reset toggle text
  filtersAdvanced.style.display = 'none';
  toggleAdvanced.textContent = 'Advanced ▾';

  // 7) Reload the table
  loadTable();
};

  // ─── Wire up Advanced ▾/▴ toggle ────────────────────────────────────
  toggleAdvanced.onclick = () => {
    const isOpen = filtersAdvanced.style.display === 'flex';
    filtersAdvanced.style.display = isOpen ? 'none' : 'flex';
    toggleAdvanced.textContent    = isOpen ? 'Advanced ▾' : 'Advanced ▴';
  };

  /* Export links */
  dlCsv.addEventListener('click', exportCsv);
  dlPdf.addEventListener('click', exportPdf);

  /* Plant lookup */
  const { data: pl } = await supabase.from('plant_machinery').select('id,plant_name');
  pl.forEach(p => plantMap[p.id] = p.plant_name);

/* Section lookup + populate */
  const { data: secs } = await supabase
  .from('sections')
  .select('id,section_name')
  .order('section_name');

  if (secs) secs.forEach(s => { sectionMap[s.id] = s.section_name; });
  populate(fSection, secs || [], 'id', 'section_name', 'Section');

  /* Cascading wiring */
  fSection.onchange = () => {
    cascadeSub(); cascadeArea();
    loadBNs();
    loadTable();
  };
  fSub.onchange = () => {
    cascadeArea();
    loadTable();
  };
  fPlant.onchange = () => {
    loadTable();
  };

  fBN.onchange = loadTable;
  fAct.onchange    = loadTable;
  fStatus.onchange = loadTable;

  /* First pass */
  cascadeSub(); cascadeArea();

  await loadTable();
}

// ========== AUTOCOMPLETE FOR ITEM FIELD ==========

// Helper function: fetch matching items from Supabase
async function fetchItemsFromSupabase(query) {
  let sbQuery = supabase
      .from('daily_work_log')
      .select('item', { distinct: true })
      .ilike('item', `%${query}%`)
      .limit(20);

  // Optional: add other filters here if needed

  const { data, error } = await sbQuery;
  if (error) {
    console.error('Supabase item fetch error:', error);
    return [];
  }
  // Remove duplicates and empty
  return [...new Set((data || []).map(r => r.item).filter(Boolean))]
    .map(item => ({item: item}));
}

// Initialize Tom Select for the Item filter
const itemTomSelect = new TomSelect("#filterItem", {
  valueField: 'item',
  labelField: 'item',
  searchField: ['item'],
  load: function(query, callback) {
    // Only fetch if user typed something
    if (!query.length) return callback();
    fetchItemsFromSupabase(query).then(items => {
      callback(items);
    });
  },
  maxOptions: 20,
  create: false
});

// When Item changes, reload BN dropdown and table
fItem.addEventListener('change', () => {
  loadBNs();
  activityTomSelect.clear();
  loadTable();
});
fBN.addEventListener('change', () => {
  activityTomSelect.clear();
  loadTable();
});

// Load BN options for the selected item
async function loadBNs() {
  // If no item is selected, clear and disable BN dropdown
  if (!fItem.value) {
    populate(fBN, [], '', '', 'BN');
    fBN.disabled = true;
    return;
  }
  // Fetch unique BNs for the selected item
  const { data, error } = await supabase
    .from('daily_work_log')
    .select('batch_number', { distinct: true })
    .eq('item', fItem.value)
    .order('batch_number', { ascending: true });
  if (error) {
    console.error('BN fetch error', error);
    populate(fBN, [], '', '', 'BN');
    fBN.disabled = true;
    return;
  }
  const uniqueBNs = [...new Set((data || []).map(r => r.batch_number).filter(Boolean))]
    .map(bn => ({ bn }));
  populate(fBN, uniqueBNs, 'bn', 'bn', 'BN');
  fBN.disabled = !uniqueBNs.length;
}

// Helper: fetch matching Activity from Supabase based on current filters and input
async function fetchActivitiesFromSupabase(query) {
  let sbQuery = supabase.from('daily_work_log')
    .select('activity', { distinct: true })
    .ilike('activity', `%${query}%`)
    .limit(20);

  // Apply filters for Item and BN
  if (fItem.value) sbQuery = sbQuery.eq('item', fItem.value);
  if (fBN.value) sbQuery = sbQuery.eq('batch_number', fBN.value);

  const { data, error } = await sbQuery;
  if (error) {
    console.error('Supabase Activity fetch error:', error);
    return [];
  }
  return [...new Set((data || []).map(r => r.activity).filter(Boolean))]
    .map(activity => ({activity: activity}));
}

const activityTomSelect = new TomSelect("#filterActivity", {
  valueField: 'activity',
  labelField: 'activity',
  searchField: ['activity'],
  load: function(query, callback) {
    if (!query.length) return callback();
    fetchActivitiesFromSupabase(query).then(acts => {
      callback(acts);
    });
  },
  maxOptions: 20,
  create: false
});

document.getElementById('filterActivity').addEventListener('change', loadTable);


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
    populate(fArea, [], '', '', 'Area');
    fArea.disabled = true;
  } else {
    supabase.from('areas')
      .select('id,area_name')
      .eq('section_id',    fSection.value)   // safer: honor current Section
      .eq('subsection_id', fSub.value)
      .order('area_name')
      .then(({ data }) => {
        populate(fArea, data || [], 'id', 'area_name', 'Area');
        fArea.disabled = false;
      });
  }
}

// Helper: fetch matching Plant/Machinery from Supabase based on current filters and input
async function fetchPlantsFromSupabase(query) {
  let sbQuery = supabase.from('plant_machinery')
    .select('id, plant_name')
    .ilike('plant_name', `%${query}%`)
    .eq('status', 'O')  // Only operational
    .limit(20);

  // You may want to filter by Area, Section, Sub-section, etc.
  if (fArea.value) sbQuery = sbQuery.eq('area_id', fArea.value);

  const { data, error } = await sbQuery;
  if (error) {
    console.error('Supabase Plant fetch error:', error);
    return [];
  }
  return data.map(r => ({ id: r.id, plant_name: r.plant_name }));
}

const plantTomSelect = new TomSelect("#filterPlant", {
  valueField: 'id',
  labelField: 'plant_name',
  searchField: ['plant_name'],
  load: function(query, callback) {
    if (!query.length) return callback();
    fetchPlantsFromSupabase(query).then(plants => {
      callback(plants);
    });
  },
  maxOptions: 20,
  create: false
});

document.getElementById('filterPlant').addEventListener('change', loadTable);

/* ── Main table refresh ----------------------------------------------------- */
async function loadTable() {
  // 1) Clear out the old rows
  tbody.replaceChildren();

  // 2) Detect whether any filter is active
  const hasFilter = Boolean(
    fDate.value    ||
    fSection.value ||
    fSub.value     ||
    fArea.value    ||
    fPlant.value   ||
    fItem.value    ||
    fBN.value      ||
    fAct.value     ||
    fStatus.value
  );

  // 3) Build base query
  let q = supabase
    .from('daily_work_log')
    .select(`
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

  // 4) Apply filters
  if (fDate.value)    q = q.eq('log_date',     toISODate(fDate.value));
  if (fSection.value) q = q.eq('section_id',   fSection.value);
  if (fSub.value)     q = q.eq('subsection_id',fSub.value);
  if (fArea.value)    q = q.eq('area_id',      fArea.value);
  if (fPlant.value)   q = q.eq('plant_id',     fPlant.value);
  if (fItem.value)    q = q.eq('item',         fItem.value);
  if (fBN.value)      q = q.eq('batch_number', fBN.value);
  if (fAct.value)     q = q.eq('activity',     fAct.value);
  if (fStatus.value)  q = q.eq('status',       fStatus.value);

  // 5) Always pull newest‑first
  q = q
    .order('log_date',   { ascending: false })
    .order('created_at', { ascending: false });

  // 6) If no filters, limit to the 10 most recent rows
  if (!hasFilter) {
    q = q.limit(10);
  }

  // 7) Execute
  const { data, error } = await q;
  if (error) {
    console.error(error);
    return;
  }

  // 8) Copy into an array for client‑side sorting
  const rows = data ? data.slice() : [];

  // 9) Natural‑order sort ascending for display
  const coll = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  rows.sort((a, b) => {
    // 1) by log_date
    let diff = new Date(a.log_date) - new Date(b.log_date);
    if (diff) return diff;
    // 2) by created_at
    diff = new Date(a.created_at) - new Date(b.created_at);
    if (diff) return diff;
    // 3) by item A→Z
    diff = a.item.localeCompare(b.item, undefined, { sensitivity: 'base' });
    if (diff) return diff;
    // 4) by batch_number numerically
    diff = a.batch_number
      .toString()
      .localeCompare(b.batch_number.toString(), undefined, { numeric: true });
    if (diff) return diff;
    // 5) by section_name A→Z
    const sa = sectionMap[a.section_id] || '';
    const sb = sectionMap[b.section_id] || '';
    diff = sa.localeCompare(sb, undefined, { sensitivity: 'base' });
    if (diff) return diff;
    // 6) by plant_name natural ↑
    const pa = a.plant_machinery?.plant_name || '';
    const pb = b.plant_machinery?.plant_name || '';
    diff = coll.compare(pa, pb);
    return diff;
  });

  // 10) Render into the table
  rows.forEach(r => {
    const plantName   = r.plant_machinery?.plant_name || '';
    const sectionName = sectionMap[r.section_id] || '';
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${fmtDate(r.log_date)}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${r.batch_size ?? ''}</td>
        <td>${r.batch_uom  ?? ''}</td>
        <td>${sectionName}</td>
        <td>${plantName}</td>
        <td>${r.activity}</td>
        <td>${r.status ?? ''}</td>
        <td><a href="#" class="view-link" data-id="${r.id}">View</a></td>
      </tr>
    `);
  });

  // 11) Attach the “View” click handlers
  document.querySelectorAll('.view-link')
    .forEach(a => a.addEventListener('click', showDetails));
}

// Helper to fetch all logs (ADD THIS before exportCsv)
async function fetchAllLogs() {
  let { data, error } = await supabase
    .from('daily_work_log')
    .select(`
      log_date,
      item,
      batch_number,
      batch_size,
      batch_uom,
      section_id,
      activity,
      plant_id,
      status,
      plant_machinery(plant_name)
    `)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Fetch all logs error:', error);
    return [];
  }
  return data;
}

/* ── Export: CSV (visible table rows) --------------------------------------- */
async function exportCsv () {
  // Table header labels (skip Action column)
  const headers = [
    'Date','Item','BN','Batch Size','UOM',
    'Section','Plant / Machinery','Activity','Status'
  ].map(h => `"${h}"`).join(',');

  // Check if any filter is active
  const hasFilter = Boolean(
    fDate.value    ||
    fSection.value ||
    fSub.value     ||
    fArea.value    ||
    fPlant.value   ||
    fItem.value    ||
    fBN.value      ||
    fAct.value     ||
    fStatus.value
  );

  let rowsData;

  if (!hasFilter) {
    // No filters: fetch all from DB
    rowsData = await fetchAllLogs();
  } else {
    // Filters applied: use current visible rows
    rowsData = [...tbody.rows].map(tr => {
    // slice(0, -1) drops the last "Action" column
      const cells = [...tr.cells].slice(0, -1);
      return cells.map(td => td.textContent.trim());
    });
  }

  // Prepare CSV data
  const csvRows = [];
  if (!hasFilter) {
    // For full DB, format data
    for (const r of rowsData) {
      csvRows.push([
        fmtDate(r.log_date),
        r.item,
        r.batch_number,
        r.batch_size ?? '',
        r.batch_uom ?? '',
        sectionMap[r.section_id] || '',
        r.plant_machinery?.plant_name || '',
        r.activity,
        r.status ?? ''
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
    }
  } else {
    // For visible, already processed above
    csvRows.push(...rowsData.map(rowArr => rowArr.map(txt =>
      `"${txt.replace(/"/g,'""')}"`
    ).join(',')));
  }

  const csv = [headers, ...csvRows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${todayStamp()}_daily_work_logs.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── Export: PDF (visible table rows) --------------------------------------- */
async function exportPdf () {
  const jsPDFCtor = window.jspdf?.jsPDF || window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFCtor) {
    console.error('jsPDF not found. Did the script load?');
    return;
  }

  const doc = new jsPDFCtor({ orientation:'landscape', unit:'pt', format:'a4' });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica','normal').setFontSize(10)
     .text('Gurucharanam Saranam', pw/2, 30, { align:'center' });
  doc.setFont('helvetica','bold').setFontSize(12)
     .text('Santhigiri Ayurveda Siddha Vaidyasala', pw/2, 50, { align:'center' });
  doc.setFont('helvetica','bold').setFontSize(14)
     .text(`DAILY WORK LOGS AS ON ${new Date().toLocaleDateString('en-GB')}`,
           pw/2, 75, { align:'center' });

  // Check filters
  const hasFilter = Boolean(
    fDate.value    ||
    fSection.value ||
    fSub.value     ||
    fArea.value    ||
    fPlant.value   ||
    fItem.value    ||
    fBN.value      ||
    fAct.value     ||
    fStatus.value
  );

  let data = [];

  if (!hasFilter) {
    // No filters: fetch all logs
    const allRows = await fetchAllLogs();
    data = allRows.map(r => ({
      date:    fmtDate(r.log_date),
      item:    r.item,
      bn:      r.batch_number,
      size:    r.batch_size ?? '',
      uom:     r.batch_uom ?? '',
      section: sectionMap[r.section_id] || '',
      plant:   r.plant_machinery?.plant_name || '',
      act:     r.activity,
      status:  r.status ?? ''
    }));
  } else {
    // Filters: use visible
    data = [...tbody.rows].map(tr => {
      const c = [...tr.cells];
      return {
        date:    c[0].textContent.trim(),
        item:    c[1].textContent.trim(),
        bn:      c[2].textContent.trim(),
        size:    c[3].textContent.trim(),
        uom:     c[4].textContent.trim(),
        section: c[5].textContent.trim(),
        plant:   c[6].textContent.trim(),
        act:     c[7].textContent.trim(),
        status:  c[8].textContent.trim()
      };
    });
  }

  // (keep rest of your PDF formatting code unchanged)
  const filtBits = [];
  if (fDate.value)    filtBits.push(`Date=${fDate.value}`);
  if (fSection.value) filtBits.push(`Section=${sectionMap[fSection.value]||fSection.value}`);
  if (fSub.value)     filtBits.push(`Sub=${fSub.options[fSub.selectedIndex].text}`);
  if (fArea.value)    filtBits.push(`Area=${fArea.options[fArea.selectedIndex].text}`);
  if (fPlant.value)   filtBits.push(`Plant=${fPlant.options[fPlant.selectedIndex].text}`);
  if (fItem.value)    filtBits.push(`Item=${fItem.value}`);
  if (fBN.value)      filtBits.push(`BN=${fBN.value}`);
  if (fAct.value)     filtBits.push(`Activity=${fAct.value}`);
  if (fStatus.value)  filtBits.push(`Status=${fStatus.value}`);

  if (filtBits.length){
    doc.setFont('Helvetica','normal').setFontSize(9)
       .text(filtBits.join(' | '), pw/2, 88, { align:'center', maxWidth: pw-80 });
  }

  doc.autoTable({
    startY: 95,
    margin: { left:40, right:40 },
    theme: 'grid',
    columns: [
  { header:'Date',                dataKey:'date'    },
  { header:'Item',                dataKey:'item'    },
  { header:'BN',                  dataKey:'bn'      },
  { header:'Batch Size',          dataKey:'size'    },
  { header:'UOM',                 dataKey:'uom'     },
  { header:'Section',             dataKey:'section' },
  { header:'Plant / Machinery',   dataKey:'plant'   },
  { header:'Activity',            dataKey:'act'     },
  { header:'Status',              dataKey:'status'  }
],
    body: data,
    styles: {
      font:'helvetica',
      fontSize:9,
      halign:'center',
      valign:'middle',
      cellPadding:3,
      lineColor:[0,0,0],
      lineWidth:0.25,
      textColor:[0,0,0]
    },
    headStyles:{
      font: 'helvetica',
      fontStyle:'bold',
      fontSize: 9,
      fillColor:[255,255,255],
      textColor:[0,0,0],
      lineWidth:0.25,
      halign:'center'
    },
    columnStyles:{
      item:{ halign:'left' },
      section:{ halign:'left' },
      plant:{ halign:'left' },
      act:{ halign:'left' }
    },
    rowPageBreak:'avoid',

    didParseCell: data => {
      if (data.section === 'head') {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    willDrawCell: data => {
      if (data.section === 'head') {
        doc.setFont('helvetica','bold');
      } else {
        doc.setFont('helvetica','normal');
      }
    },
    didDrawPage: (data) => {
      doc.setFont('Helvetica','normal').setFontSize(9);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pw - 40,
        ph - 10,
        { align:'right' }
      );
    }
  });

  doc.save(`${todayStamp()}_daily_work_logs.pdf`);
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
  ['RM Juice Qty',      log.rm_juice_qty],      // NEW
  ['RM Juice UOM',      log.rm_juice_uom],      // NEW
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
  ['Storage Qty',       log.storage_qty],       // NEW
  ['Storage UOM',       log.storage_qty_uom],   // NEW
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