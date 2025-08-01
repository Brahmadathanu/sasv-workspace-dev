// js/log-edit.js

import { supabase } from '../shared/js/supabaseClient.js';

/* ────────────────────────────────────────────────────────────────────────────
   DATE HELPERS & FLATPICKR SETUP
─────────────────────────────────────────────────────────────────────────────*/

/** Parse a "DD-MM-YYYY" string into a Date object */
function parseDMY(str) {
  const [d, m, y] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date object as "DD-MM-YYYY" */
function formatDMY(dt) {
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${dt.getFullYear()}`;
}

/** Add business days to a Date, skipping Sundays */
function addBusinessDays(startDate, days) {
  const d = new Date(startDate.getTime());
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++;
  }
  return d;
}

/* ── NEW: convert UI date → ISO (YYYY-MM-DD) ─────────────────────────── */
const toISO = dmy => {
  if (!dmy) return null;                       // keep NULL / empty
  const [d, m, y] = dmy.split("-");
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
};

/* ── NEW: short, readable text for duplicate-key errors ──────────────── */
const duplicateMessage = data => (
  "A log with these details already exists:\n\n" +
  `Item          : ${data.item}\n` +
  `Batch Number  : ${data.batch_number}\n` +
  `Activity      : ${data.activity}\n` +
  `Log Date      : ${data.log_date}\n\n` +
  "Open the existing log instead of saving changes."
);

// Flatpickr configuration: dd-mm-YYYY, input allowed, Today  Clear, no confirm button
const fpOptions = {
  dateFormat: 'd-m-Y',
  allowInput: true,
  clickOpens: true,
  plugins: [
    confirmDatePlugin({
      showTodayButton: true,
      showClearButton: true,
      showConfirmButton: false,
      todayText: 'Today',
      clearText: 'Clear'
    })
  ]
};

/** Attach an input mask that auto-inserts hyphens as DD-MM-YYYY is typed */
function attachMask(el) {
  el.addEventListener('input', () => {
    let v = el.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    el.value = v;
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   MAIN INITIALIZATION
─────────────────────────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', async () => {
  // Inject CSS to hide any leftover Flatpickr “OK” tick icon
  const css = document.createElement('style');
  css.textContent = `
    .flatpickr-confirm, .flatpickr-confirm::before {
      display: none !important;
    }
    /* make locked fields visibly greyed */
    .locked{
      pointer-events:none;
      background:#eee !important;
      color:#666 !important;
      opacity:.7;
    }
  `;
  document.head.append(css);

  // ─── Apply mask  Flatpickr to modal & filter date inputs ─────────
  ['doneCompletedOn','e_start','e_comp','fLogDate'].forEach(id => {
    const el = document.getElementById(id);
    attachMask(el);

    // For all except fLogDate we disallow future dates too
    if (id !== 'fLogDate') {
      flatpickr(el, { ...fpOptions, maxDate: 'today' });
      // Clamp manually-typed values on blur
      el.addEventListener('blur', () => {
        const d     = parseDMY(el.value);
        const today = new Date();
        if (d > today) {
          el.value = formatDMY(today);
        }
      });
    } else {
      // Log Date filter: no max restriction, re-run loadFull on change
      flatpickr(el, {
      ...fpOptions,
        onChange: loadFull
       });
  }
});

  // Leave Due Date alone (auto-calculated, no picker)
  const dueEl = document.getElementById('e_due');
  if (dueEl) dueEl.readOnly = true;

  // ───────── Element references ─────────────────────────────────────────────
  const homeBtn     = document.getElementById('homeBtn');
  const fullBody    = document.getElementById('fullBody');

  const fLogDate    = document.getElementById('fLogDate');
  const fSection    = document.getElementById('fSection');
  const fSub        = document.getElementById('fSub');
  const fArea       = document.getElementById('fArea');
  const fItem       = document.getElementById('fItem');
  const fBN         = document.getElementById('fBN');
  const fActivity   = document.getElementById('fActivity');
  const fStatus     = document.getElementById('fStatus');
  const clearFull   = document.getElementById('clearFull');

  // Done-modal refs
  const doneModal         = document.getElementById('doneModal');
  const doneForm          = document.getElementById('doneForm');
  const doneCompletedOn   = document.getElementById('doneCompletedOn');
  const doneQtySection    = document.getElementById('doneQtySection');
  const doneLabRefSection = document.getElementById('doneLabRefSection');
  const doneSkuSection    = document.getElementById('doneSkuSection');
  const doneSkuBody       = document.querySelector('#doneSkuTable tbody');
  const doneTransSection  = document.getElementById('doneTransSection');
  const doneTransBody     = document.querySelector('#doneTransTable tbody');
  const doneCancel        = document.getElementById('doneCancel');
  const doneJust          = document.getElementById('doneJust');
  const doneNew           = document.getElementById('doneNew');

  // Edit-modal refs
  const editModal        = document.getElementById('editModal');
  const editSuccess      = document.getElementById('editSuccess');
  const editForm         = document.getElementById('editForm');
  const cancelEdit       = document.getElementById('cancelEdit');
  cancelEdit.onclick     = () => hideModal(editModal);

  const e_id             = document.getElementById('e_id');
  const e_size           = document.getElementById('e_size');
  const e_uom            = document.getElementById('e_uom');
  const e_activity       = document.getElementById('e_activity');
  const juiceS           = document.getElementById('juiceS');
  const e_juice          = document.getElementById('e_juice');
  const e_specify        = document.getElementById('e_specify');
  const rmJuiceSection   = document.getElementById('rmJuiceSection');
  const e_rmJuiceQty     = document.getElementById('e_rm_juice_qty');
  const e_rmJuiceUom     = document.getElementById('e_rm_juice_uom');
  const putamS           = document.getElementById('putamS');
  const e_count          = document.getElementById('e_count');
  const e_fuel           = document.getElementById('e_fuel');
  const e_fuel_under     = document.getElementById('e_fuel_under');
  const e_fuel_over      = document.getElementById('e_fuel_over');
  const storageSection   = document.getElementById('storageSection');
  const e_storageQty     = document.getElementById('e_storage_qty');
  const e_storageUom     = document.getElementById('e_storage_qty_uom');
  const e_start          = document.getElementById('e_start');
  const e_due            = document.getElementById('e_due');
  const e_comp           = document.getElementById('e_comp');
  const e_status         = document.getElementById('e_status');
  const editQtySection   = document.getElementById('editQtySection');
  const e_qty            = document.getElementById('e_qty');
  const e_qty_uom        = document.getElementById('e_qty_uom');
  const labRefSection    = document.getElementById('labRefSection');
  const e_lab_ref        = document.getElementById('e_lab_ref');
  const editSkuSection   = document.getElementById('editSkuSection');
  const editSkuBody      = document.querySelector('#editSkuTable tbody');
  const editTransSection = document.getElementById('editTransSection');
  const editTransBody    = document.querySelector('#editTransTable tbody');
  const e_remarks        = document.getElementById('e_remarks');

  // Confirm-modal refs
  const confirmModal     = document.getElementById('confirmModal');
  const confirmText      = document.getElementById('confirmText');
  const confirmYes       = document.getElementById('confirmYes');
  const confirmNo        = document.getElementById('confirmNo');

// Dynamic packaging activities (lowercased)
  const sectionMap = {};
  let skuActivities = [];     // filled by loadSkuActivities()
  let skuActSet     = new Set();
  let pkgActSet     = new Set();
// Duration of current activity (business days) for auto due-date calc
let currentActDuration = null;

// ───────────────────────────  LOAD SKU ACTIVITIES (dynamic)  ───────────────────────────
async function loadSkuActivities() {
const { data, error } = await supabase
  .from('event_type_lkp')
  .select('label, is_packaging, affects_bottled_stock')
  .eq('active', true);

// All packaging activities (need a packaging_event row)
const pkgActivities = (data || [])
  .filter(r => r.is_packaging)          // <— NEW
  .map(r => (r.label || '').trim().toLowerCase())
  .filter(Boolean);

pkgActSet = new Set(pkgActivities);      // <— NEW

  if (error) {
    console.error('loadSkuActivities error:', error);
    skuActivities = [];
    skuActSet     = new Set();
    return;
  }

  skuActivities = (data || [])
     .filter(r => r.affects_bottled_stock == 1)
     .map(r => (r.label || '').trim().toLowerCase())
     .filter(Boolean);
   skuActSet = new Set(skuActivities);
}

/* ────────────────────────────────────────────────────────────────────────────
   BASIC MODAL HELPERS
──────────────────────────────────────────────────────────────────────────── */
function showModal(m) { m.style.display = 'flex'; }
function hideModal(m) { m.style.display = 'none'; }

function askConfirm(msg) {
  confirmText.textContent = msg;
  /* show Yes  No buttons */
  confirmYes.style.display = 'inline-block';
  confirmNo.style.display  = 'inline-block';
  showModal(confirmModal);
  return new Promise(res => {
    confirmYes.onclick = () => { hideModal(confirmModal); res(true);  };
    confirmNo.onclick  = () => { hideModal(confirmModal); res(false); };
  });
}

/* ── NEW: simple OK-only alert ─────────────────────────────────────────── */
function showAlert(msg) {
  confirmText.textContent = msg;
  confirmYes.style.display = 'none';
  confirmNo.style.display  = 'none';
  showModal(confirmModal);
  return new Promise(res => {
    const handler = () => {
      hideModal(confirmModal);
      confirmModal.removeEventListener('click', handler);
      res();
    };
    confirmModal.addEventListener('click', handler, { once: true });
  });
}

/* ── NEW: show/hide Juice & Putam sections on “Doing” ─────────────────── */
function updateEditSections() {
  const act   = e_activity.value.trim().toLowerCase();
  const doing = e_status.value === 'Doing';
  const inStorage = e_status.value === 'In Storage';

  // Juice/Decoction panel
  juiceS.style.display      = doing && /juice|grinding|kashayam/.test(act)
                               ? 'flex'
                               : 'none';

  // RM‑Juice Qty & UOM panel
  rmJuiceSection.style.display = doing && /juice|grinding|kashayam/.test(act)
                                   ? 'flex'
                                   : 'none';

  // Putam panel
  putamS.style.display      = doing && /putam|gaja putam|seelamann/.test(act)
                               ? 'flex'
                               : 'none';

  //Storage panel
  storageSection.style.display = inStorage ? 'flex' : 'none';
}

function recalcDueDate() {
  if (currentActDuration == null || !e_start.value) {
    return; // keep whatever is in e_due
  }
  const start = parseDMY(e_start.value);
  const due   = addBusinessDays(start, Number(currentActDuration));
  e_due.value = formatDMY(due);
}

/* ────────────────────────────────────────────────────────────────────────────
   UTILITY HELPERS  (insert *above* loadFull)
──────────────────────────────────────────────────────────────────────────── */

/** Populate a <select> with rows you pass in */
function populate(selectEl, rows, valueKey, textKey, placeholder) {
  // start with the placeholder option
  let html = `<option value="">${placeholder}</option>`;
  // then append one option per row
  (rows || []).forEach(r => {
    html += `<option value="${r[valueKey]}">${r[textKey]}</option>`;
  });
  selectEl.innerHTML = html;
}

/** Remove any packaging_events + event_skus linked to a work-log row */
async function clearPackaging(workLogId) {
  const { data: evts } = await supabase
    .from('packaging_events')
    .select('id')
    .eq('work_log_id', workLogId);

  const ids = (evts || []).map(e => e.id);
  if (!ids.length) return;

  await supabase.from('event_skus')
    .delete()
    .in('packaging_event_id', ids);

  await supabase.from('packaging_events')
    .delete()
    .in('id', ids);
}

// helper to detect unique-constraint failures
  const isDuplicateError = err =>
    err.code === '23505' ||
    /duplicate key/i.test(err.message || '') ||
    /violates unique constraint/i.test(err.message || '');
    
// helper to detect our ledger negative‑stock trigger message
const isFgNegError = err =>
  /would make stock negative/i.test(err?.message || '');

// === NEW HELPER: render a SKU-style tbody with given rows ===
function renderSkuTable(tbody, rows, includeOnHand = false) {
  tbody.innerHTML = ''; // clear existing content
  rows.forEach(r => {
    const tr = document.createElement('tr');
    let inner = `
      <td>${r.pack_size}</td>
      <td>${r.uom}</td>`;
    if (includeOnHand) {
      inner += `<td>${r.on_hand}</td>`;
    }
    inner += `
      <td>
        <input type="number" min="0"
               ${includeOnHand ? `max="${r.on_hand}"` : ''}
               data-sku-id="${r.sku_id}"
               data-pack-size="${r.pack_size}"
               data-uom="${r.uom}"
               value="${r.count || ''}">
      </td>`;
    tr.innerHTML = inner;
    tbody.append(tr);
  });
}

/* ── Refresh the Activity <select> so it ALWAYS matches current filters ── */
async function refreshActivityFilter() {
  // Build the same query the main table will use, but select only activity
  let q = supabase.from('daily_work_log').select('activity');

  // Apply all *up-stream* filters (leave out status & activity themselves)
  if (fLogDate.value)  q = q.eq('log_date', toISO(fLogDate.value));
  if (fSection.value)  q = q.eq('section_id',    fSection.value);
  if (fSub.value)      q = q.eq('subsection_id', fSub.value);
  if (fArea.value)     q = q.eq('area_id',       fArea.value);
  if (fItem.value)     q = q.eq('item',          fItem.value);
  if (fBN.value)       q = q.eq('batch_number',  fBN.value);

  const { data, error } = await q;
  if (error) { console.error('refreshActivityFilter:', error); return; }

  const uniqueActs = [...new Set(
                        (data || [])
                          .map(r => (r.activity || '').trim())
                          .filter(Boolean)
                      )]
                      .sort((a,b) => a.localeCompare(b, undefined, { sensitivity:'base' }))
                      .map(a => ({ activity: a }));

  // DEBUG – watch what the filter *thinks* is available
  console.log('Activity filter rebuilt →', uniqueActs.length, 'options:', uniqueActs);

  populate(fActivity, uniqueActs, 'activity', 'activity', 'Activity');
  fActivity.disabled = !uniqueActs.length;
}

// ────────────────────────────────────────────────────────────────────────────
  // LOAD & RENDER FULL EDIT TABLE
  // ────────────────────────────────────────────────────────────────────────────
  async function loadFull() {
    fullBody.innerHTML = '';

    // 1) Build base query
let q = supabase
  .from('daily_work_log')
  .select(`
    id,
    log_date,
    created_at,
    item,
    batch_number,
    batch_size,
    batch_uom,
    section_id,
    plant_id,
    plant_machinery(plant_name),
    activity,
    status
  `);

    // 2) Apply Log Date filter
    if (fLogDate.value) {
      const dt  = parseDMY(fLogDate.value);
      // manual YYYY-MM-DD avoids timezone shift
      const yyyy = dt.getFullYear();
      const mm   = String(dt.getMonth() + 1).padStart(2,'0');
      const dd   = String(dt.getDate()   ).padStart(2,'0');
      const iso  = `${yyyy}-${mm}-${dd}`;
      q = q.eq('log_date', iso);
    }

    // 3) Apply other filters
    if (fSection.value) q = q.eq('section_id',    fSection.value);
    if (fSub.value)     q = q.eq('subsection_id', fSub.value);
    if (fArea.value)    q = q.eq('area_id',       fArea.value);
    if (fItem.value)    q = q.eq('item',          fItem.value);
    if (fBN.value)      q = q.eq('batch_number',  fBN.value);
    if (fActivity.value) q = q.eq('activity', fActivity.value);
    if(fStatus.value)   q = q.eq('status',fStatus.value); 

    // 4) Fetch data
    const { data } = await q;
    const rows = (data || []).slice(); // clone

    // 5) Client-side sort
    const coll = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    rows.sort((a, b) => {
      // a) Date ascending
      const da = new Date(a.log_date), db = new Date(b.log_date);
      if (da < db) return -1;
      if (da > db) return  1;
      // b) Item α
      const ci = a.item.localeCompare(b.item, undefined, { sensitivity: 'base' });
      if (ci !== 0) return ci;
      // c) BN numeric α
      const na = parseInt(a.batch_number,10), nb = parseInt(b.batch_number,10);
      if (!isNaN(na) && !isNaN(nb)) {
        if (na < nb) return -1;
        if (na > nb) return  1;
      } else {
        const cbn = a.batch_number.localeCompare(b.batch_number, undefined, { numeric: true });
        if (cbn !== 0) return cbn;
      }

      // d) created_at ascending
      if (a.created_at && b.created_at) {
        const ca = new Date(a.created_at), cb = new Date(b.created_at);
        if (ca < cb) return -1;
        if (ca > cb) return  1;
      }

      // e) Plant natural α
      const pa = a.plant_machinery?.plant_name || '';
      const pb = b.plant_machinery?.plant_name || '';
      return coll.compare(pa, pb);
    });

    // 6) Render
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(r.log_date).toLocaleDateString('en-GB')}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${r.batch_size   ?? ''}</td>
        <td>${r.batch_uom    ?? ''}</td>
        <td>${sectionMap[r.section_id]||''}</td>
        <td>${r.plant_machinery?.plant_name || ''}</td>
        <td>${r.activity}</td>
        <td>${r.status}</td>
        <td class="actions-cell">
          <div class="dropdown">
            <button class="dropdown-toggle" aria-haspopup="true" aria-expanded="false">⋮</button>
            <ul class="dropdown-menu" role="menu">
              <li role="menuitem"><a href="#" class="editBtn"   data-id="${r.id}">Edit</a></li>
              <li role="menuitem"><a href="#" class="deleteBtn" data-id="${r.id}">Delete</a></li>
            </ul>
          </div>
        </td>
      `;
      fullBody.append(tr);
    });

    // 7) Wire up Edit/Delete
    document.querySelectorAll('.editBtn').forEach(btn => {
      btn.onclick = e => { e.preventDefault(); openEditModal(btn.dataset.id); };
    });
    document.querySelectorAll('.deleteBtn').forEach(btn => {
      btn.onclick = async e => {
        e.preventDefault();
        if (await askConfirm('Delete this entry?')) {
          await clearPackaging(btn.dataset.id);
          await supabase.from('daily_work_log').delete().eq('id', btn.dataset.id);
          loadFull();
        }
      };
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // INITIALIZE FILTERS & FIRST LOAD
  // ────────────────────────────────────────────────────────────────────────────
  async function initFull() {
  // ───────── Element references ────────────────────────────────────────────
  const toggleAdvancedFull   = document.getElementById('toggleAdvancedFull');
  const advancedFiltersFull  = document.getElementById('advancedFiltersFull');

  // ───────── 1) Populate Sections & fill sectionMap ───────────────────────
  {
    const { data: secs, error } = await supabase
      .from('sections')
      .select('id,section_name')
      .order('section_name');
    if (!error && secs) {
      secs.forEach(s => sectionMap[s.id] = s.section_name);
      populate(fSection, secs, 'id', 'section_name', 'Section');
    }
  }
  // disable dependent filters
  [fSub, fArea, fBN].forEach(x => x.disabled = true);

  // Status is a static list, just hook its onchange
  fStatus.onchange   = loadFull;

  // ───────── 3) Populate Items ─────────────────────────────────────────────
  {
    const { data: itemsRaw } = await supabase
      .from('bmr_details')
      .select('item')
      .order('item');
    if (itemsRaw) {
      const uniqueItems = Array.from(new Set(itemsRaw.map(r => r.item)))
                              .map(item => ({ item }));
      populate(fItem, uniqueItems, 'item','item','Item');
    }
  }

  // ───────── 4) Cascading: Section → Sub‑section ──────────────────────────
  fSection.onchange = async () => {
    if (!fSection.value) {
      populate(fSub, [], '', '', 'Sub‑section');
      fSub.disabled = true;
    } else {
      const { data: subs } = await supabase
        .from('subsections')
        .select('id,subsection_name')
        .eq('section_id', fSection.value)
        .order('subsection_name');
      populate(fSub, subs, 'id','subsection_name','Sub‑section');
      fSub.disabled = false;
    }
    populate(fArea, [], '', '', 'Area');
    fArea.disabled = true;
    populate(fBN,   [], '', '', 'BN');
    fBN.disabled   = true;
    await refreshActivityFilter();
    loadFull();
  };

  // ───────── 5) Sub‑section → Area ────────────────────────────────────────
  fSub.onchange = async () => {
    if (!fSub.value) {
      populate(fArea, [], '', '', 'Area');
      fArea.disabled = true;
    } else {
      const { data: areas } = await supabase
        .from('areas')
        .select('id,area_name')
        .eq('section_id',    fSection.value)
        .eq('subsection_id', fSub.value)
        .order('area_name');
      populate(fArea, areas, 'id','area_name','Area');
      fArea.disabled = false;
    }
    populate(fBN, [], '', '', 'BN');
    fBN.disabled = true;
    await refreshActivityFilter();
    loadFull();
  };

  // ───────── 6) Area → reset BN ───────────────────────────────────────────
  fArea.onchange = async () => {
    populate(fBN, [], '', '', 'BN');
    fBN.disabled = true;
    await refreshActivityFilter();
    loadFull();
  };

  // ───────── 7) Item → BN ─────────────────────────────────────────────────
  fItem.onchange = async () => {
    if (!fItem.value) {
      populate(fBN, [], '', '', 'BN');
      fBN.disabled = true;
    } else {
      const { data: bns } = await supabase
        .from('bmr_details')
        .select('bn')
        .eq('item', fItem.value)
        .order('bn');
      const uniq = [...new Set((bns||[]).map(r => r.bn))];
      populate(fBN, uniq.map(bn=>({ bn })), 'bn','bn','BN');
      fBN.disabled = false;
    }
    await refreshActivityFilter();
    loadFull();
  };
  fBN.onchange = loadFull;

// ───────── 8) Clear All Filters ─────────────────────────────────────────
clearFull.onclick = () => {
  // 1) Reset all values
  fLogDate.value  = '';
  fSection.value  = '';
  fSub.value      = '';
  fArea.value     = '';
  fItem.value     = '';
  fBN.value       = '';
  fActivity.value = '';
  fStatus.value   = '';

  // 2) Disable only the cascading selects
  fSub.disabled = true;
  fArea.disabled = true;
  fBN.disabled = true;

  // 3) Collapse the advanced‐filters row
  advancedFiltersFull.style.display = 'none';
  toggleAdvancedFull.textContent    = 'Advanced ▾';

  // 4) Reload table
  loadFull();
};

  // ───────── 9) HOME button ────────────────────────────────────────────────
  homeBtn.onclick = () => location.href = 'index.html';

  // ───────── 10) Advanced toggle ──────────────────────────────────────────
  toggleAdvancedFull.addEventListener('click', () => {
    const open = advancedFiltersFull.style.display === 'flex';
    advancedFiltersFull.style.display = open ? 'none' : 'flex';
    toggleAdvancedFull.textContent    = open ? 'Advanced ▾' : 'Advanced ▴';
  });

  // ───────── 10a) Build Activity filter once, then wire its change handler
  await refreshActivityFilter();   // fills <select id="fActivity">
  fActivity.onchange = loadFull;   // run table refresh when user chooses one

  // ───────── 11) First render ───────────────────────────────────────────────
  await loadFull();
}

  // ────────────────────────────────────────────────────────────────────────────
  // “DONE?” MODAL CONFIGURATION (unchanged)
  // ────────────────────────────────────────────────────────────────────────────
  async function configureDoneModal(activity, item, batch, id) {
    const act = activity.trim().toLowerCase();
    doneQtySection.style.display =
    doneLabRefSection.style.display =
    doneSkuSection.style.display =
    doneTransSection.style.display = 'none';
    doneSkuBody.innerHTML   = '';
    doneTransBody.innerHTML = '';

if (act === 'finished goods quality assessment') {
  doneLabRefSection.style.display = 'flex';
}
else if (skuActSet.has(act)) {
  doneSkuSection.style.display = 'block';

  // 1) In parallel, load the product record & any existing packaging_event
  const [{ data: prod }, { data: pe }] = await Promise.all([
    supabase
      .from('products')
      .select('id')
      .eq('item', item)
      .single(),
    supabase
      .from('packaging_events')
      .select('id')
      .eq('work_log_id', id)
      .maybeSingle()    // returns null if no event yet
  ]);

  // 2) If we have a product, grab its active SKUs
  if (prod) {
    const { data: skus } = await supabase
      .from('product_skus')
      .select('id,pack_size,uom')
      .eq('product_id', prod.id)
      .eq('is_active', true)
      .order('pack_size');

    // 3) If there is an existing packaging_event, get its SKUs/counts
    let existing = [];
    if (pe?.id) {
      ({ data: existing } = await supabase
        .from('event_skus')
        .select('sku_id,count')
        .eq('packaging_event_id', pe.id));
    }

    // 4) Render one row per SKU, pre‑filling the previous count if present
const doneSkuRows = skus.map(sku => {
  const prev = existing.find(e => e.sku_id === sku.id);
  return {
    pack_size: sku.pack_size,
    uom: sku.uom,
    sku_id: sku.id,
    count: prev?.count || ''
  };
});
renderSkuTable(doneSkuBody, doneSkuRows);
  }
}
  else if (act === 'transfer to fg store') {
    doneTransSection.style.display = 'block';

// 1) What SKUs *could* be transferred (from on-hand)
const batchValue = String(batch).trim();      // ← ensure text-to-text comparison
const { data: stocked, error: stockErr } = await supabase
  .from('bottled_stock_on_hand')
  .select('sku_id, pack_size, uom, on_hand')
  .eq('batch_number', batchValue);            // always a string

if (stockErr) console.error('bottled_stock_on_hand lookup:', stockErr);

    // 2) What *has* already been transferred?
const { data: pe } = await supabase
  .from('packaging_events')
  .select('id')
  .eq('work_log_id', id)
  .maybeSingle();          // safe if none yet

let existing = [];
if (pe?.id) {
  ({ data: existing } = await supabase
    .from('event_skus')
    .select('sku_id,count')
    .eq('packaging_event_id', pe.id));
}

    // 3) Render one row per stocked SKU, pre‑filling count
const doneTransRows = stocked.map(r => {
  const prev = existing.find(e => e.sku_id === r.sku_id);
  return {
    pack_size: r.pack_size,
    uom: r.uom,
    sku_id: r.sku_id,
    on_hand: r.on_hand,
    count: prev?.count || ''
  };
});
renderSkuTable(doneTransBody, doneTransRows, true); // include on_hand column
  }

    else {
      doneQtySection.style.display = 'flex';
      doneForm.qty_after_process_uom.value = '';
    }
  }

  async function promptDone(activity, item, batch, id) {
    doneForm.reset();
    doneCompletedOn.value = formatDMY(new Date());
    doneSkuBody.innerHTML = '';
    doneTransBody.innerHTML = '';
    await configureDoneModal(activity, item, batch, id);
    showModal(doneModal);
    return new Promise(resolve => {
      doneCancel.onclick = () => { hideModal(doneModal); resolve({ choice: 'cancel' }); };
      const finish = choice => {
        const act = activity.trim().toLowerCase();
        let rows = [], qty = null, uom = null, labRef = null;
        if (act === 'finished goods quality assessment') {
          labRef = doneForm.lab_ref_number.value.trim();
        }
        else if (skuActSet.has(act)) {
          rows = Array.from(doneSkuBody.querySelectorAll('input')).map(i => ({
            skuId: i.dataset.skuId,
            count: i.value,
            packSize: i.dataset.packSize,
            uom: i.dataset.uom
          })).filter(r => r.count > 0);
        }
        else if (act === 'transfer to fg store') {
          rows = Array.from(doneTransBody.querySelectorAll('input')).map(i => ({
            skuId: i.dataset.skuId,
            count: i.value,
            packSize: i.dataset.packSize,
            uom: i.dataset.uom
          })).filter(r => r.count > 0);
        }
        else {
          qty = doneForm.qty_after_process.value || null;
          uom = doneForm.qty_after_process_uom.value.trim() || null;
        }
        hideModal(doneModal);
        resolve({ choice, rows, completedOn: doneCompletedOn.value, qty, uom, labRef });
      };
      doneJust.onclick = () => finish('just');
      doneNew.onclick  = () => finish('new');
    });
  }

async function saveStatusUpdate(id, sel) {
  const activity  = sel.dataset.act;
  const newStat   = sel.value;
  const actLower  = activity.trim().toLowerCase();

  // If they clicked “Done?”, collect the post-done info first
  let doneData = null;
  if (newStat === 'Done') {
    doneData = await promptDone(activity, sel.dataset.item, sel.dataset.bn, id);
    if (doneData.choice === 'cancel') {
      sel.value = 'Doing';
      return;
    }

    // enforce qty/UOM when required
    const needsQty = !skuActSet.has(actLower)
                   && actLower !== 'transfer to fg store'
                   && actLower !== 'finished goods quality assessment';
    if (needsQty && (!doneData.qty || !doneData.uom)) {
      if (!await askConfirm('No Qty/UOM provided. Continue anyway?')) {
        sel.value = 'Doing';
        return;
      }
    }
  }

  // build the update payload
  const upd = {
    status            : newStat,
    completed_on      : newStat === 'Done' ? toISO(doneData.completedOn) : null,
    qty_after_process : (newStat === 'Done'
                         && !skuActSet.has(actLower))
                         ? Number(doneData.qty) || null
                         : null,
    qty_uom           : (newStat === 'Done'
                         && !skuActSet.has(actLower))
                         ? doneData.uom || null
                         : null,
    sku_breakdown     : (newStat === 'Done'
                         && (pkgActSet.has(actLower)
                             || actLower === 'transfer to fg store'))
                         ? doneData.rows
                             .map(r => `${r.packSize} ${r.uom} x ${r.count}`)
                             .join('; ')
                         : null,
    lab_ref_number    : (newStat === 'Done'
                         && actLower === 'finished goods quality assessment')
                         ? doneData.labRef
                         : null
  };

  // Client-side FG bulk stock ceiling for SKU activities
if (newStat === 'Done' && skuActSet.has(actLower)) {
  // 1) product factor
  const { data: prod } = await supabase
    .from('products')
    .select('conversion_to_base,uom_base')
    .eq('item', sel.dataset.item)
    .single();

  const factor = Number(prod?.conversion_to_base) || 1;

  // 2) total in base units
  let totalUnits = 0;
  doneData.rows.forEach(r => { totalUnits += (Number(r.packSize)||0) * (Number(r.count)||0); });
  const totalBaseQty = totalUnits * factor;

  // 3) current FG bulk
  const { data: stock } = await supabase
    .from('fg_bulk_stock')
    .select('qty_on_hand')
    .eq('item', sel.dataset.item)
    .eq('bn', sel.dataset.bn)
    .maybeSingle();

  if (stock) {
    const available = Number(stock.qty_on_hand) || 0;
    const EPS = 0.001;
    if (totalBaseQty > available + EPS) {
      await showAlert(
        `Cannot save Done: packaging ${totalBaseQty.toFixed(3)} ${prod?.uom_base||''} `
        + `> available ${available.toFixed(3)} ${prod?.uom_base||''}.`
      );
      sel.value = 'Doing';
      return;
    }
  }
}

  // ── 1) Attempt to update the work‐log row ───────────────────────────
  const { data: updatedRow, error: updErr } = await supabase
    .from('daily_work_log')
    .update(upd)
    .eq('id', id);

  // ── 2) If the DB rejected it, show alert & bail (modal stays open) ─
  if (updErr) {
   if (isFgNegError(updErr)) {
     await showAlert(updErr.message);        // show trigger text verbatim
     sel.value = 'Doing';                    // roll back
     return;
   }
   await showAlert(
     isDuplicateError(updErr)
       ? duplicateMessage({
           item         : sel.dataset.item,
           batch_number : sel.dataset.bn,
           activity     : activity,
           log_date     : '(unchanged)'
         })
       : `Unexpected error: ${updErr.message || 'see console'}`
   );
   sel.value = newStat === 'Done' ? 'Doing' : 'Done';
   return;
  }

  // ── 3) On real success, upsert packaging events if needed ────────────
  if (newStat === 'Done'
      && (pkgActSet.has(actLower)
          || actLower === 'transfer to fg store')) {
    const { data: pe } = await supabase
      .from('packaging_events')
      .upsert(
        { work_log_id: id, event_type: activity },
        { onConflict: ['work_log_id']})
      .select('id')
      .maybeSingle();

    if (pe) {
      await supabase
        .from('event_skus')
        .delete()
        .eq('packaging_event_id', pe.id);

      if (doneData.rows.length) {
        await supabase
          .from('event_skus')
          .insert(
            doneData.rows.map(r => ({
              packaging_event_id: pe.id,
              sku_id             : r.skuId,
              count              : r.count
            }))
          );
      }
    }
  }

  // ── 4) Finally show success, close modal & refresh ────────────────────
  editSuccess.style.display = 'block';
    setTimeout(() => {
    editSuccess.style.display = 'none';
    hideModal(editModal);
    loadFull();
  }, 1200);
}

// ────────────────────────────────────────────────────────────────────────────
// OPEN & POPULATE EDIT MODAL
// ────────────────────────────────────────────────────────────────────────────
async function openEditModal(id) {

  // 2) Local refs inside the modal
  const e_section = editModal.querySelector('#e_section');
  const e_sub     = editModal.querySelector('#e_sub');
  const e_area    = editModal.querySelector('#e_area');
  const e_plant   = editModal.querySelector('#e_plant');
  const e_item    = editModal.querySelector('#e_item');
  const e_bn      = editModal.querySelector('#e_bn');

  editSkuBody.innerHTML = '';
  editTransBody.innerHTML = '';

  if (!e_section || !e_bn) {
    console.error('Missing edit‑modal elements:', { e_section, e_bn });
    hideModal(editModal);
    return;
  }

  // 3) Fetch the row
  const { data: row, error } = await supabase
    .from('daily_work_log')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !row) { console.error(error); hideModal(editModal); return; }

  // Look up duration_days; fall back to existing due-start diff if needed
currentActDuration = null;
  try {
    const { data: actRow } = await supabase
      .from('activities')            // <== adjust table/column names to yours
      .select('duration_days')
      .eq('activity_name', row.activity)
      .maybeSingle();

    if (actRow?.duration_days != null) {
      currentActDuration = Number(actRow.duration_days);
    } else if (row.started_on && row.due_date) {
      // fallback: compute diff in business days between stored start & due
      const s = new Date(row.started_on);
      const d = new Date(row.due_date);
      let diff = 0;
      const day = new Date(s);
      while (day < d) {
        day.setDate(day.getDate() + 1);
        if (day.getDay() !== 0) diff++;
      }
      currentActDuration = diff || null;
    }
} catch (e) {
  console.error('duration lookup failed:', e);
}

  // 4) Basic fields
  e_id.value   = row.id;
  e_item.value = row.item || '';
  e_size.value = row.batch_size || '';
  e_uom.value  = row.batch_uom || '';
  e_bn.disabled = true;

  // 5) Section → Sub → Area → Plant cascades
  const { data: secs } = await supabase
    .from('sections')
    .select('id,section_name')
    .order('section_name');
  populate(e_section, secs || [], 'id', 'section_name', 'Select Section');
  e_section.value = row.section_id || '';

  async function loadSubs(sectionId, pre = null) {
    if (!sectionId) {
      populate(e_sub, [], '', '', 'Select Sub‑section');
      e_sub.disabled = true;
      return;
    }
    const { data } = await supabase
      .from('subsections')
      .select('id,subsection_name')
      .eq('section_id', sectionId)
      .order('subsection_name');
    populate(e_sub, data || [], 'id', 'subsection_name', 'Select Sub‑section');
    e_sub.disabled = false;
    if (pre) e_sub.value = pre;
  }

  async function loadAreas(sectionId, subId, pre = null) {
    if (!sectionId || !subId) {
      populate(e_area, [], '', '', 'Select Area');
      e_area.disabled = true;
      return;
    }
    const { data } = await supabase
      .from('areas')
      .select('id,area_name')
      .eq('section_id', sectionId)
      .eq('subsection_id', subId)
      .order('area_name');
    populate(e_area, data || [], 'id', 'area_name', 'Select Area');
    e_area.disabled = false;
    if (pre) e_area.value = pre;
  }

  async function loadPlants(areaId, pre = null) {
    if (!areaId) {
      populate(e_plant, [], '', '', 'Select Plant');
      e_plant.disabled = true;
      return;
    }
    const { data } = await supabase
      .from('plant_machinery')
      .select('id,plant_name')
      .eq('area_id', areaId)
      .eq('status', 'O')
      .order('plant_name');
    populate(e_plant, data || [], 'id', 'plant_name', 'Select Plant');
    e_plant.disabled = false;
    if (pre) e_plant.value = pre;
  }

  await loadSubs  (row.section_id,    row.subsection_id);
  await loadAreas (row.section_id,    row.subsection_id, row.area_id);
  await loadPlants(row.area_id,       row.plant_id);

  e_section.onchange = () => {
    loadSubs(e_section.value).then(() => {
      loadAreas(e_section.value, e_sub.value);
      loadPlants(null);
    });
  };
  e_sub.onchange  = () => {
    loadAreas(e_section.value, e_sub.value);
    loadPlants(null);
  };
  e_area.onchange = () => loadPlants(e_area.value);

  // 6) Item → BN
  const allItems = (await supabase
    .from('bmr_details')
    .select('item', { distinct: true })
    .order('item')).data || [];
  populate(e_item, allItems, 'item', 'item', 'Select Item');
  e_item.value = row.item;

  async function loadBNs(item, pre = null) {
    if (!item) {
      populate(e_bn, [], '', '', 'Select Batch Number');
      e_bn.disabled = true;
      return;
    }
    const bns = (await supabase
      .from('bmr_details')
      .select('bn')
      .eq('item', item)
      .order('bn')).data || [];
    const uniq = [...new Set(bns.map(r => r.bn))].map(bn => ({ bn }));
    populate(e_bn, uniq, 'bn', 'bn', 'Select Batch Number');
    e_bn.disabled = false;
    if (pre) e_bn.value = pre;
  }
  await loadBNs(row.item, row.batch_number);
  e_item.onchange = () => loadBNs(e_item.value);

  await refreshActivityFilter();

  // 7) Activity (display only)
  e_activity.innerHTML = `<option>${row.activity}</option>`;
  e_activity.value     = row.activity;

  // 8) Misc fields
  e_juice.value       = row.juice_or_decoction || '';
  e_specify.value     = row.specify            || '';
  e_rmJuiceQty.value  = row.rm_juice_qty ?? '';
  e_rmJuiceUom.value  = row.rm_juice_uom || '';
  e_count.value       = row.count_of_saravam ?? '';
  e_fuel.value        = row.fuel || '';
  e_fuel_under.value  = row.fuel_under || '';
  e_fuel_over.value   = row.fuel_over  || '';
  e_storageQty.value  = row.storage_qty     ?? '';
  e_storageUom.value  = row.storage_qty_uom || '';

  e_start.value  = row.started_on   ? formatDMY(new Date(row.started_on))   : '';
  e_due.value    = row.due_date     ? formatDMY(new Date(row.due_date))     : '';
  e_comp.value   = row.completed_on ? formatDMY(new Date(row.completed_on)) : '';
  e_status.value = row.status || '';

  // Recalc due when start changes
  e_start.addEventListener('change', recalcDueDate);
  e_start.addEventListener('blur',   recalcDueDate);
  e_start.addEventListener('input',  recalcDueDate);
  if (e_start._flatpickr) {
    e_start._flatpickr.config.onChange.push(recalcDueDate);
  }
  // run once now (after duration is known)
  recalcDueDate();

  // 9) Restrict status options if storage activity
  const isStorageAct = /^(fg bulk storage|intermediate storage)$/i.test(row.activity.trim());
  Array.from(e_status.options).forEach(opt => {
    opt.disabled = isStorageAct
      ? !(opt.value === 'In Storage' || opt.value === 'Done')
      : (opt.value === 'In Storage');
  });

  // 10) Toggle helper
  function reToggleOptionalPanels() {
    const currentStat     = e_status.value;
    const currentActLower = e_activity.value.trim().toLowerCase();

    [
      editQtySection,
      labRefSection,
      editSkuSection,
      editTransSection,
      juiceS,
      rmJuiceSection,
      putamS,
      storageSection
    ].forEach(sec => sec.style.display = 'none');

    if (currentStat === 'Doing') {
      // wipe Done-only bits
      e_comp.value     = '';
      e_qty.value      = '';
      e_qty_uom.value  = '';
      e_lab_ref.value  = '';
      editSkuBody.innerHTML   = '';
      editTransBody.innerHTML = '';

      const isJuice = /juice|grinding|kashayam/.test(currentActLower);
      const isPutam = /putam|gaja putam|seelamann/.test(currentActLower);

      juiceS.style.display         = isJuice ? 'flex' : 'none';
      rmJuiceSection.style.display = isJuice ? 'flex' : 'none';
      putamS.style.display         = isPutam ? 'flex' : 'none';
      return;
    }

    if (currentStat === 'In Storage') {
      storageSection.style.display = 'flex';
      const req = /fg bulk storage/i.test(currentActLower);
      e_storageQty.required = req;
      e_storageUom.required = req;
      return;
    }

// Done
if (!e_comp.value) e_comp.value = formatDMY(new Date());

// helper booleans for this block
const isStockTransfer = /stock\s*transfer/i.test(currentActLower);
const isFGTransfer    = currentActLower === 'transfer to fg store';

if (currentActLower === 'finished goods quality assessment') {
  labRefSection.style.display = 'block';

} else if (skuActSet.has(currentActLower)) {
  // Packaging (affects bottled stock)
  editSkuSection.style.display = 'block';

} else if (isFGTransfer) {
  // Existing FG transfer table
  editTransSection.style.display = 'block';

} else if (isStockTransfer) {
  // NEW: Stock transfer → show Storage fields, hide Qty After Process
  storageSection.style.display = 'flex';
  e_storageQty.required  = true;
  e_storageUom.required  = true;

  // Make sure Qty After Process panel stays hidden
  editQtySection.style.display = 'none';

} else {
  // Regular Done → Qty After Process panel
  editQtySection.style.display = 'flex';
}

  }

  // 11) Prefill existing Done data
  if (row.status === 'Done') {
    const actLowerInit = row.activity.trim().toLowerCase();

    if (actLowerInit === 'finished goods quality assessment') {
      labRefSection.style.display = 'block';
      e_lab_ref.value = row.lab_ref_number || '';
    } else if (skuActSet.has(actLowerInit)) {
      editSkuSection.style.display = 'block';

      const { data: pe } = await supabase
        .from('packaging_events')
        .select('id')
        .eq('work_log_id', row.id)
        .maybeSingle();
      if (pe?.id) {
        const { data: skus } = await supabase
          .from('event_skus')
          .select('sku_id,count')
          .eq('packaging_event_id', pe.id);

        const skuRows = [];
for (const es of skus || []) {
  const { data: ps } = await supabase
    .from('product_skus')
    .select('pack_size,uom')
    .eq('id', es.sku_id)
    .single();
  if (!ps) continue;
  skuRows.push({
    pack_size: ps.pack_size,
    uom: ps.uom,
    sku_id: es.sku_id,
    count: es.count || ''
  });
}
renderSkuTable(editSkuBody, skuRows);
      }
    } else if (actLowerInit === 'transfer to fg store') {
      editTransSection.style.display = 'block';

      const { data: pe } = await supabase
        .from('packaging_events')
        .select('id')
        .eq('work_log_id', row.id)
        .maybeSingle();
      if (pe?.id) {
        const { data: skus } = await supabase
          .from('event_skus')
          .select('sku_id,count')
          .eq('packaging_event_id', pe.id);

        const transRows = [];

// ---------------------------------------------------------------
// Build the rows for the “Transfer to FG Store” edit-modal table
// ---------------------------------------------------------------
for (const es of skus || []) {
  /* 1. Look for the SKU in bottled_stock_on_hand
       (batch filter makes sure we fetch the correct lot) */
  const { data: stock } = await supabase
    .from('bottled_stock_on_hand')
    .select('pack_size,uom,on_hand')
    .eq('sku_id',       es.sku_id)
    .eq('batch_number', row.batch_number)      // ← add this line
    .maybeSingle();                            // may legitimately be null

  /* 2. If not found in stock view, fall back to product_skus
        so we still have pack-size & UOM for display. */
  let packSize, uom, onHand;
  if (stock) {
    ({ pack_size: packSize, uom, on_hand: onHand } = stock);
  } else {
    const { data: ps } = await supabase
      .from('product_skus')
      .select('pack_size,uom')
      .eq('id', es.sku_id)
      .single();                               // always exists
    packSize = ps.pack_size;
    uom      = ps.uom;
    onHand   = 0;                              // nothing on-hand for this BN
  }

  /* 3. Push the row – even when onHand is 0 – so the table
        always shows what was transferred earlier. */
  transRows.push({
    pack_size : packSize,
    uom       : uom,
    sku_id    : es.sku_id,
    on_hand   : onHand,        // could be 0 or actual quantity
    count     : es.count || ''
  });
}

renderSkuTable(editTransBody, transRows, true); // includeOnHand = true
      }
    } else {
      editQtySection.style.display = 'flex';
      e_qty.value     = row.qty_after_process || '';
      e_qty_uom.value = row.qty_uom           || '';
    }
  }

// ---- LOCK HELPERS ---------------------------------------------------------
function lock(el){
  if (!el) return;
  if (el.tagName === 'SELECT' || el.tagName === 'BUTTON') {
    el.disabled = true;
  } else {
    el.readOnly = true;
    el.tabIndex = -1;
  }
  el.classList.add('locked');
}

function lockStaticFields(){
  [
    e_section, e_sub, e_area, e_plant, e_item, e_bn,
    e_activity, e_size, e_uom
  ].forEach(lock);
}

  // 12) Wire handlers & initial toggle
  e_status.onchange   = reToggleOptionalPanels;
  e_activity.onchange = reToggleOptionalPanels;
  reToggleOptionalPanels();

  // lock the uneditable fields once everything is ready
  lockStaticFields();

  // reveal modal only after fields are populated & locked
  showModal(editModal);
}

// ────────────────────────────────────────────────────────────────────────────
// HANDLE EDIT FORM SUBMIT (ISO dates  duplicate guard)
// ────────────────────────────────────────────────────────────────────────────
editForm.onsubmit = async ev => {
  ev.preventDefault();

  // 0) Clear any previous validation messages
  editForm.querySelectorAll('input, select, textarea')
          .forEach(el => el.setCustomValidity(''));

  // 1) Let HTML5 handle all the required‐field checks:
  //    this will focus the first empty required field and show its bubble
  if (!editForm.checkValidity()) {
    editForm.reportValidity();
    return;
  }

  // ── 1) Gather common fields ───────────────────────────────────────────────
  const id          = Number(e_id.value);
  const originalAct = e_activity.value.trim();
  const actLower    = originalAct.toLowerCase();
  const newStat     = e_status.value;
  // helper flags we'll reuse
  const isStockTransfer = /stock\s*transfer/i.test(actLower);
  const isFGTransfer    = actLower === 'transfer to fg store';

  // ── 2A) Doing: clear packaging, clear all Done‑only & storage fields, then save juice/putam
  if (newStat === 'Doing') {
    await clearPackaging(id);

    // Reset status and wipe out any Done/storage columns
    const upd = {
      status            : 'Doing',
      completed_on      : null,
      qty_after_process : null,
      qty_uom           : null,
      sku_breakdown     : null,
      lab_ref_number    : null,
      storage_qty       : null,
      storage_qty_uom   : null
    };

    // Re‑apply the Doing‑only juice fields if relevant
    if (/juice|grinding|kashayam/.test(actLower)) {
      upd.juice_or_decoction = e_juice.value || null;
      upd.specify           = e_specify.value || null;
    }

    // Re‑apply the Doing‑only putam fields if relevant
    if (/putam|gaja putam|seelamann/.test(actLower)) {
      upd.count_of_saravam = e_count.value ? Number(e_count.value) : null;
      upd.fuel             = e_fuel.value     || null;
      upd.fuel_under       = e_fuel_under.value || null;
      upd.fuel_over        = e_fuel_over.value  || null;
    }

    const { error: errDoing } = await supabase
      .from('daily_work_log')
      .update(upd)
      .eq('id', id);
    if (errDoing) {
      await showAlert(
        isDuplicateError(errDoing)
          ? duplicateMessage({
              item         : e_item.value,
              batch_number : e_bn.value,
              activity     : originalAct,
              log_date     : '(unchanged)'
            })
          : `Unexpected error: ${errDoing.message || 'see console'}`
      );
      return;
    }

    editSuccess.style.display = 'block';
    setTimeout(() => {
      editSuccess.style.display = 'none';
      hideModal(editModal);
      loadFull();
    }, 1200);

    return;
  }

  // ── 2B) On Hold: clear everything Done‐only
  if (newStat === 'On Hold') {
    await clearPackaging(id);
    const { error: errHold } = await supabase
      .from('daily_work_log')
      .update({
        status            : 'On Hold',
        completed_on      : null,
        qty_after_process : null,
        qty_uom           : null,
        sku_breakdown     : null,
        lab_ref_number    : null,
        juice_or_decoction: null,
        specify           : null,
        count_of_saravam  : null,
        fuel              : null,
        fuel_under        : null,
        fuel_over         : null,
        storage_qty       : null,
        storage_qty_uom   : null
      })
      .eq('id', id);
    if (errHold) {
      await showAlert(`Unexpected error: ${errHold.message || 'see console'}`);
      return;
    }
    editSuccess.style.display = 'block';
    setTimeout(() => {
      editSuccess.style.display = 'none';
      hideModal(editModal);
      loadFull();
    }, 1200);
    return;
  }

  // ── 2C) In Storage: clear packaging, save storage fields, clear others
    if (newStat === 'In Storage') {
    await clearPackaging(id);

    const upd = {
      status          : 'In Storage',
      storage_qty     : e_storageQty.value ? Number(e_storageQty.value) : null,
      storage_qty_uom : e_storageUom.value || null,
      // clear all Done-only & Doing-only fields
      completed_on      : null,
      qty_after_process : null,
      qty_uom           : null,
      sku_breakdown     : null,
      lab_ref_number    : null,
      juice_or_decoction: null,
      specify           : null,
      count_of_saravam  : null,
      fuel              : null,
      fuel_under        : null,
      fuel_over         : null
    };

    // DEBUG: show what is being sent
    console.log('[EDIT] In Storage payload for id', id, upd);

    const { error: errStore } = await supabase
      .from('daily_work_log')
      .update(upd)
      .eq('id', id);

    if (errStore) {
      // surface error visibly
      console.error('Error saving In Storage:', errStore);
      await showAlert(`Error saving In Storage: ${errStore.message || errStore.details || 'see console'}`);
      return;
    }

    editSuccess.style.display = 'block';
    setTimeout(() => {
      editSuccess.style.display = 'none';
      hideModal(editModal);
      loadFull();
    }, 1200);
    return;
  }

  // ── 2D) Done: gather post‐Done values
  const r = {
    choice      : 'just',
    completedOn : e_comp.value,
    qty         : e_qty.value     ? Number(e_qty.value)   : null,
    uom         : e_qty_uom.value ? e_qty_uom.value.trim(): null,
    labRef      : e_lab_ref.value ? e_lab_ref.value.trim(): null,
    rows        : []
  };
  if (pkgActSet.has(actLower) || actLower === 'transfer to fg store') {
    const tbody = skuActSet.has(actLower)
                  ? editSkuBody
                  : editTransBody;
    r.rows = Array.from(tbody.querySelectorAll('input'))
      .map(i => ({
        skuId    : Number(i.dataset.skuId),
        count    : Number(i.value),
        packSize : i.dataset.packSize,
        uom      : i.dataset.uom
      }))
      .filter(x => x.count > 0);
  }
  const needsQty = !skuActSet.has(actLower)
                 && actLower !== 'transfer to fg store'
                 && actLower !== 'finished goods quality assessment';
  if (needsQty && (!r.qty || !r.uom)) {
    if (!await askConfirm('No Qty/UOM provided. Save anyway?')) {
      e_status.value = 'Doing';
      return;
    }
  }

  // NEW: Stock transfer requires storage qty/uom
if (newStat === 'Done' && isStockTransfer) {
  if (!e_storageQty.value || !e_storageUom.value) {
    await showAlert('Storage Qty and UOM are required for Stock transfer.');
    e_status.value = 'Doing';
    return;
  }
}

  // ── PRE-FLIGHT PACKAGING-STOCK CHECK (client-side guard; no tiny-residual bump) ──
  if (skuActSet.has(actLower)) {
    // 1) Get product conversion factor once
    const { data: prod, error: prodErr } = await supabase
     .from('products')
      .select('id, conversion_to_base, uom_base')
      .eq('item', e_item.value)
      .single();

    if (prodErr || !prod) {
     console.error('Product lookup failed', prodErr);
    } else {
      const factor = Number(prod.conversion_to_base) || 1;

      // 2) Sum all SKU pack_size * count (event units), then convert to base
      let totalUnits = 0;
      for (const row of r.rows) {
        // row.packSize comes from the table’s data-* attributes
        totalUnits += (Number(row.packSize) || 0) * (Number(row.count) || 0);
     }
      const totalBaseQty = totalUnits * factor;

      // 3) Read current FG bulk stock (if present)
      //    NOTE: fg_bulk_stock view exposes: item, bn, qty_on_hand
      const { data: stock, error: stockErr } = await supabase
        .from('fg_bulk_stock')
        .select('qty_on_hand')
        .eq('item', e_item.value)
        .eq('bn', e_bn.value)
        .maybeSingle();

      if (stockErr) {
        console.error('fg_bulk_stock lookup error:', stockErr);
      }

     // If a stock record exists, enforce the ceiling
      if (stock) {
        const available = Number(stock.qty_on_hand) || 0;
        const EPS = 0.001;

        if (totalBaseQty > available + EPS) {
         await showAlert(
           `Cannot save Done: packaging ${totalBaseQty.toFixed(3)} ${prod.uom_base} ` +
           `> available ${available.toFixed(3)} ${prod.uom_base} in FG bulk stock.`
         );
         e_status.value = 'Doing';
         return;
       }
     }
     // If there’s no row in fg_bulk_stock, we let it pass — DB trigger will ignore it anyway.
   }
  }

const updDone = {
  status       : 'Done',
  started_on   : toISO(e_start.value),
  due_date     : toISO(e_due.value),
  completed_on : toISO(r.completedOn),

  // defaults – override below
  qty_after_process : null,
  qty_uom           : null,
  sku_breakdown     : null,
  lab_ref_number    : null,
  storage_qty       : null,
  storage_qty_uom   : null
};

if (actLower === 'finished goods quality assessment') {
  updDone.lab_ref_number = r.labRef;

} else if (skuActSet.has(actLower) || isFGTransfer || isStockTransfer) {
  // all transfer/packaging type activities get an SKU breakdown
  updDone.sku_breakdown = r.rows
    .map(x => `${x.packSize} ${x.uom} x ${x.count}`)
    .join('; ');

  // NEW: for stock transfer (Done) also persist storage qty/uom
  if (isStockTransfer) {
  updDone.storage_qty     = e_storageQty.value
                              ? Number(e_storageQty.value)
                              : null;
  updDone.storage_qty_uom = e_storageUom.value || null;
}

} else {
  // “normal” Done: keep Qty After Process
  updDone.qty_after_process = r.qty;
  updDone.qty_uom           = r.uom;
}

  // 3) attempt to update
  const { error: updErr } = await supabase
   .from('daily_work_log')
   .update(updDone)
   .eq('id', id);

  if (updErr) {
   if (isFgNegError(updErr)) {
     await showAlert(updErr.message);
     e_status.value = 'Doing';   // revert UI
     return;
   }
   await showAlert(
     isDuplicateError(updErr)
        ? duplicateMessage({
           item         : e_item.value,
           batch_number : e_bn.value,
           activity     : originalAct,
           log_date     : '(unchanged)'
          })
        : `Unexpected error: ${updErr.message || updErr.details || 'see console'}`
   );
    return;
  }
  // ← success path continues below (NO extra alert, NO extra brace)

  // upsert packaging-events for Done if needed
  if (
    pkgActSet.has(actLower) ||
    actLower === 'transfer to fg store'
  ) {
    const { data: pe } = await supabase
      .from('packaging_events')
      .upsert(
        { work_log_id: id, event_type: originalAct },
        { onConflict: ['work_log_id'] }
      )
      .select('id')
      .maybeSingle();
    if (pe) {
      await supabase.from('event_skus')
        .delete()
        .eq('packaging_event_id', pe.id);
      if (r.rows.length) {
        await supabase.from('event_skus')
          .insert(
            r.rows.map(x => ({
              packaging_event_id: pe.id,
              sku_id            : x.skuId,
              count             : x.count
            }))
          );
      }
    }
  }

  // ── 6) success, close & refresh
  editSuccess.style.display = 'block';
  setTimeout(() => {
    editSuccess.style.display = 'none';
    hideModal(editModal);
    loadFull();
  }, 1200);
};
await loadSkuActivities();
await initFull();
});