// js/log-edit.js

import { supabase } from './supabaseClient.js';

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

// Flatpickr configuration: dd-mm-YYYY, input allowed, Today + Clear, no confirm button
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
  `;
  document.head.append(css);

  // ─── Apply mask + Flatpickr to modal & filter date inputs ─────────
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
  const e_section        = document.getElementById('e_section');
  const e_sub            = document.getElementById('e_sub');
  const e_area           = document.getElementById('e_area');
  const e_plant          = document.getElementById('e_plant');
  const e_item           = document.getElementById('e_item');
  const e_bn             = document.getElementById('e_bn');
  const e_size           = document.getElementById('e_size');
  const e_uom            = document.getElementById('e_uom');
  const e_activity       = document.getElementById('e_activity');
  const juiceS           = document.getElementById('juiceS');
  const e_juice          = document.getElementById('e_juice');
  const e_specify        = document.getElementById('e_specify');
  const putamS           = document.getElementById('putamS');
  const e_count          = document.getElementById('e_count');
  const e_fuel           = document.getElementById('e_fuel');
  const e_fuel_under     = document.getElementById('e_fuel_under');
  const e_fuel_over      = document.getElementById('e_fuel_over');
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

  // Packaging activities (lowercased)
  const skuActivities = [
    'bottling',
    'bottling and labelling',
    'bottling, labelling and cartoning',
    'capsule monocarton packing',
    'monocarton packing',
    'monocarton packing and cartoning'
  ];

/* ────────────────────────────────────────────────────────────────────────────
   BASIC MODAL HELPERS
───────────────────────────────────────────────────────────────────────────*/
function showModal(m) { m.style.display = 'flex'; }
function hideModal(m) { m.style.display = 'none'; }

function askConfirm(msg) {
  confirmText.textContent = msg;
  /* show Yes + No buttons */
  confirmYes.style.display = 'inline-block';
  confirmNo.style.display  = 'inline-block';
  showModal(confirmModal);
  return new Promise(res => {
    confirmYes.onclick = () => { hideModal(confirmModal); res(true);  };
    confirmNo.onclick  = () => { hideModal(confirmModal); res(false); };
  });
}

/* ── NEW: simple OK-only alert ───────────────────────────────────────────*/
function showAlert(msg) {
  confirmText.textContent = msg;
  /* hide Yes / No, show overlay */
  confirmYes.style.display = 'none';
  confirmNo.style.display  = 'none';
  showModal(confirmModal);
  return new Promise(res => {
    /* dismiss on any click inside the modal */
    confirmModal.onclick = () => { hideModal(confirmModal); res(); };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   UTILITY HELPERS  (insert *above* loadFull)
──────────────────────────────────────────────────────────────────────────── */

/** Populate a <select> with rows you pass in */
function populate(selectEl, rows, valueKey, textKey, placeholder) {
  selectEl.innerHTML =
    `<option value="">${placeholder}</option>` +
    (rows || [])
      .map(r => `<option value="${r[valueKey]}">${r[textKey]}</option>`)
      .join('');
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
    item,
    batch_number,
    batch_size,
    batch_uom,
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
      const mm   = String(dt.getMonth()+1).padStart(2,'0');
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
      // d) Plant natural α
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
        <td>${r.plant_machinery?.plant_name || ''}</td>
        <td>${r.activity}</td>
        <td>${r.status}</td>
        <td>
          <a href="#" class="link-btn editBtn"   data-id="${r.id}">Edit</a> |
          <a href="#" class="link-btn deleteBtn" data-id="${r.id}">Delete</a>
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
    // 1) Populate Sections
    {
      const { data: secs } = await supabase
        .from('sections')
        .select('id,section_name')
        .order('section_name');
      populate(fSection, secs, 'id', 'section_name', 'Section');
    }
    [fSub, fArea, fBN].forEach(x => x.disabled = true);

    // 2) Populate DISTINCT Items, deduped client-side
    {
      const { data: itemsRaw, error } = await supabase
        .from('bmr_details')
        .select('item')
        .order('item', { ascending: true });
      if (error) {
        console.error('Error loading items:', error);
      } else {
        const uniqueItems = Array.from(
          new Set(itemsRaw.map(r => r.item))
        ).map(item => ({ item }));
        populate(fItem, uniqueItems, 'item', 'item', 'Item');
      }
    }

    // Cascading: Section → Sub-section
    fSection.onchange = async () => {
      if (!fSection.value) {
        populate(fSub, [], '', '', 'Sub-section');
        fSub.disabled = true;
      } else {
        const { data: subs } = await supabase
          .from('subsections')
          .select('id,subsection_name')
          .eq('section_id', fSection.value)
          .order('subsection_name');
        populate(fSub, subs, 'id', 'subsection_name', 'Sub-section');
        fSub.disabled = false;
      }
      populate(fArea, [], '', '', 'Area');
      fArea.disabled = true;
      populate(fBN,   [], '', '', 'BN');
      fBN.disabled   = true;
      loadFull();
    };

    // Sub-section → Area
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
        populate(fArea, areas, 'id', 'area_name', 'Area');
        fArea.disabled = false;
      }
      populate(fBN, [], '', '', 'BN');
      fBN.disabled = true;
      loadFull();
    };

    // Area → reset BN
    fArea.onchange = () => {
      populate(fBN, [], '', '', 'BN');
      fBN.disabled = true;
      loadFull();
    };

    // Item → BN
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
        const uniq = [...new Set((bns || []).map(r => r.bn))];
        populate(fBN, uniq.map(bn => ({ bn })), 'bn', 'bn', 'BN');
        fBN.disabled = false;
      }
      loadFull();
    };
    fBN.onchange = loadFull;

    // Clear All Filters
    clearFull.onclick = () => {
      fLogDate.value = '';
      [fSection, fSub, fArea, fItem, fBN].forEach(x => {
        x.value = '';
        x.disabled = (x !== fSection);
      });
      loadFull();
    };

    // HOME button
    homeBtn.onclick = () => {
      location.href = 'index.html';
    };

    // First render
    await loadFull();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // “DONE?” MODAL CONFIGURATION (unchanged)
  // ────────────────────────────────────────────────────────────────────────────
  async function configureDoneModal(activity, item, batch) {
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
    else if (skuActivities.includes(act)) {
      doneSkuSection.style.display = 'block';
      const { data: prod } = await supabase
        .from('products').select('id').eq('item', item).single();
      if (prod) {
        const { data: skus } = await supabase
          .from('product_skus')
          .select('id,pack_size,uom')
          .eq('product_id', prod.id)
          .eq('is_active', true)
          .order('pack_size');
        skus.forEach(sku => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${sku.pack_size}</td>
            <td>${sku.uom}</td>
            <td><input type="number" min="0"
                       data-sku-id="${sku.id}"
                       data-pack-size="${sku.pack_size}"
                       data-uom="${sku.uom}"></td>`;
          doneSkuBody.append(tr);
        });
      }
    }
    else if (act === 'transfer to fg store') {
      doneTransSection.style.display = 'block';
      const { data } = await supabase
        .from('bottled_stock_on_hand')
        .select('sku_id,pack_size,uom,on_hand')
        .eq('batch_number', batch);
      (data || []).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.pack_size}</td>
          <td>${r.uom}</td>
          <td>${r.on_hand}</td>
          <td><input type="number" min="0" max="${r.on_hand}"
                     data-sku-id="${r.sku_id}"
                     data-pack-size="${r.pack_size}"
                     data-uom="${r.uom}"></td>`;
        doneTransBody.append(tr);
      });
    }
    else {
      doneQtySection.style.display = 'flex';
      doneForm.qty_after_process_uom.value = '';
    }
  }

  async function promptDone(activity, item, batch) {
    doneForm.reset();
    doneCompletedOn.value = formatDMY(new Date());
    await configureDoneModal(activity, item, batch);
    showModal(doneModal);
    return new Promise(resolve => {
      doneCancel.onclick = () => { hideModal(doneModal); resolve({ choice: 'cancel' }); };
      const finish = choice => {
        const act = activity.trim().toLowerCase();
        let rows = [], qty = null, uom = null, labRef = null;
        if (act === 'finished goods quality assessment') {
          labRef = doneForm.lab_ref_number.value.trim();
        }
        else if (skuActivities.includes(act)) {
          rows = Array.from(doneSkuBody.querySelectorAll('input')).map(i => ({
            skuId: +i.dataset.skuId,
            count: +i.value,
            packSize: i.dataset.packSize,
            uom: i.dataset.uom
          })).filter(r => r.count > 0);
        }
        else if (act === 'transfer to fg store') {
          rows = Array.from(doneTransBody.querySelectorAll('input')).map(i => ({
            skuId: +i.dataset.skuId,
            count: +i.value,
            packSize: i.dataset.packSize,
            uom: i.dataset.uom
          })).filter(r => r.count > 0);
        }
        else {
          qty = +doneForm.qty_after_process.value || null;
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

  // helper to detect unique-constraint failures
  const isDuplicateError = err =>
    err.code === '23505' ||
    /duplicate key/i.test(err.message || '') ||
    /violates unique constraint/i.test(err.message || '');

  // If they clicked “Done?”, collect the post-done info first
  let doneData = null;
  if (newStat === 'Done') {
    doneData = await promptDone(activity, sel.dataset.item, sel.dataset.bn);
    if (doneData.choice === 'cancel') {
      sel.value = 'Doing';
      return;
    }

    // enforce qty/UOM when required
    const needsQty = !skuActivities.includes(actLower)
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
                         && !skuActivities.includes(actLower))
                         ? Number(doneData.qty) || null
                         : null,
    qty_uom           : (newStat === 'Done'
                         && !skuActivities.includes(actLower))
                         ? doneData.uom || null
                         : null,
    sku_breakdown     : (newStat === 'Done'
                         && (skuActivities.includes(actLower)
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

  // ── 1) Attempt to update the work‐log row ───────────────────────────
  const { data: updatedRow, error: updErr } = await supabase
    .from('daily_work_log')
    .update(upd)
    .eq('id', id);

  // ── 2) If the DB rejected it, show alert & bail (modal stays open) ─
  if (updErr) {
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
    // roll the dropdown back to its previous state
    sel.value = newStat === 'Done' ? 'Doing' : 'Done';
    return;
  }

  // ── 3) On real success, upsert packaging events if needed ────────────
  if (newStat === 'Done'
      && (skuActivities.includes(actLower)
          || actLower === 'transfer to fg store')) {
    const { data: pe } = await supabase
      .from('packaging_events')
      .upsert(
        { work_log_id: id, event_type: activity },
        { onConflict: 'work_log_id' }
      )
      .select('id')
      .single();

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
  }, 1200)};

  // ────────────────────────────────────────────────────────────────────────────
  // OPEN & POPULATE EDIT MODAL
  // ────────────────────────────────────────────────────────────────────────────
  async function openEditModal(id) {
    const { data: row } = await supabase
      .from('daily_work_log')
      .select('*')
      .eq('id', id)
      .single();
    if (!row) return;

    e_id.value = row.id;

    // SECTION
    {
      const { data: secs } = await supabase
        .from('sections')
        .select('id,section_name')
        .order('section_name');
      populate(e_section, secs, 'id', 'section_name', 'Select Section');
      e_section.value = row.section_id || '';
    }

    // SUB-SECTION
    if (row.section_id) {
      const { data: subs } = await supabase
        .from('subsections')
        .select('id,subsection_name')
        .eq('section_id', row.section_id)
        .order('subsection_name');
      populate(e_sub, subs, 'id', 'subsection_name', 'Select Sub-section');
      e_sub.disabled = false;
      e_sub.value    = row.subsection_id || '';
    } else {
      e_sub.disabled = true;
      e_sub.innerHTML = `<option value="">Select Sub-section</option>`;
    }

    // AREA
    if (row.subsection_id) {
      const { data: areas } = await supabase
        .from('areas')
        .select('id,area_name')
        .eq('section_id',    row.section_id)
        .eq('subsection_id', row.subsection_id)
        .order('area_name');
      populate(e_area, areas, 'id', 'area_name', 'Select Area');
      e_area.disabled = false;
      e_area.value    = row.area_id || '';
    } else {
      e_area.disabled = true;
      e_area.innerHTML = `<option value="">Select Area</option>`;
    }

    // PLANT / MACHINERY
    if (row.area_id) {
      const { data: plants } = await supabase
        .from('plant_machinery')
        .select('id,plant_name')
        .eq('area_id', row.area_id)
        .order('plant_name');
      populate(e_plant, plants, 'id', 'plant_name', 'Select Plant');
      e_plant.disabled = false;
      e_plant.value    = row.plant_id || '';
    } else {
      e_plant.disabled = true;
      e_plant.innerHTML = `<option value="">Select Plant</option>`;
    }

    // ITEM
    {
      const { data: items } = await supabase
        .from('bmr_details')
        .select('item', { distinct: true })
        .order('item');
      populate(e_item, items, 'item', 'item', 'Select Item');
      e_item.value = row.item || '';
    }

    // BN
    {
      const { data: bns } = await supabase
        .from('bmr_details')
        .select('bn')
        .eq('item', row.item)
        .order('bn');
      const uniq = [...new Set((bns || []).map(r => r.bn))];
      populate(e_bn, uniq.map(bn => ({ bn })), 'bn', 'bn', 'Select Batch Number');
      e_bn.disabled = false;
      e_bn.value    = row.batch_number || '';
    }

    // SIZE / UOM / ACTIVITY
    e_size.value = row.batch_size || '';
    e_uom.value  = row.batch_uom  || '';
    e_activity.innerHTML = `<option>${row.activity}</option>`;
    e_activity.value     = row.activity;

    // JUICE / DECOCTION
    juiceS.style.display = row.juice_or_decoction ? 'flex' : 'none';
    e_juice.value        = row.juice_or_decoction || '';
    e_specify.value      = row.specify               || '';

    // PUTAM
    putamS.style.display     = row.count_of_saravam != null ? 'flex' : 'none';
    e_count.value            = row.count_of_saravam || '';
    e_fuel.value             = row.fuel               || '';
    e_fuel_under.value       = row.fuel_under         || '';
    e_fuel_over.value        = row.fuel_over          || '';

    // DATES & STATUS
    e_start.value = row.started_on   ? formatDMY(new Date(row.started_on))   : '';
    e_due.value   = row.due_date     ? formatDMY(new Date(row.due_date))     : '';
    e_comp.value  = row.completed_on ? formatDMY(new Date(row.completed_on)) : '';
    e_status.value= row.status       || '';

    // Auto-recompute Due Date when Started On changes
    e_start.onchange = async () => {
      const { data } = await supabase
        .from('activities')
        .select('duration_days')
        .eq('activity_name', e_activity.value)
        .single();
      const days   = data?.duration_days || 0;
      const dueDt  = addBusinessDays(parseDMY(e_start.value), days);
      e_due.value  = formatDMY(dueDt);
    };

    // Clear post-Done sections
    [editQtySection, labRefSection, editSkuSection, editTransSection]
      .forEach(sec => sec.style.display = 'none');
    editSkuBody.innerHTML   = '';
    editTransBody.innerHTML = '';
    e_qty.value      = '';
    e_qty_uom.value  = '';
    e_lab_ref.value  = '';

    // Show existing Done-data if status is Done
    const actLower = row.activity.trim().toLowerCase();
    if (row.status === 'Done') {
      if (actLower === 'finished goods quality assessment') {
        labRefSection.style.display = 'block';
        e_lab_ref.value = row.lab_ref_number || '';
      }
      else if (skuActivities.includes(actLower)) {
        editSkuSection.style.display = 'block';
        const { data: pe } = await supabase
          .from('packaging_events')
          .select('id')
          .eq('work_log_id', row.id)
          .single();
        const { data: skus } = await supabase
          .from('event_skus')
          .select('sku_id,count')
          .eq('packaging_event_id', pe.id);
        for (const e of skus) {
          const { data: ps } = await supabase
            .from('product_skus')
            .select('pack_size,uom')
            .eq('id', e.sku_id)
            .single();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${ps.pack_size}</td>
            <td>${ps.uom}</td>
            <td><input type="number" min="0"
                       data-sku-id="${e.sku_id}"
                       data-pack-size="${ps.pack_size}"
                       data-uom="${ps.uom}"
                       value="${e.count}"></td>`;
          editSkuBody.append(tr);
        }
      }
      else if (actLower === 'transfer to fg store') {
        editTransSection.style.display = 'block';
        const { data: pe } = await supabase
          .from('packaging_events')
          .select('id')
          .eq('work_log_id', row.id)
          .single();
        const { data: rows2 } = await supabase
          .from('event_skus')
          .select('sku_id,count')
          .eq('packaging_event_id', pe.id);
        for (const e of rows2) {
          const { data: ps } = await supabase
            .from('bottled_stock_on_hand')
            .select('pack_size,uom,on_hand')
            .eq('sku_id', e.sku_id)
            .single();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${ps.pack_size}</td>
            <td>${ps.uom}</td>
            <td>${ps.on_hand}</td>
            <td><input type="number" min="0" max="${ps.on_hand}"
                       data-sku-id="${e.sku_id}"
                       data-pack-size="${ps.pack_size}"
                       data-uom="${ps.uom}"
                       value="${e.count}"></td>`;
          editTransBody.append(tr);
        }
      }
      else {
        editQtySection.style.display = 'flex';
        e_qty.value      = row.qty_after_process || '';
        e_qty_uom.value  = row.qty_uom           || '';
      }
    }

    // Dynamically adjust when Status changes in the modal
    e_status.onchange = () => {
      if (e_status.value === 'Done') {
        e_comp.value = formatDMY(new Date());
      } else {
        e_comp.value = '';
      }
      [editQtySection, labRefSection, editSkuSection, editTransSection]
        .forEach(sec => sec.style.display = 'none');
      editSkuBody.innerHTML   = '';
      editTransBody.innerHTML = '';
      e_qty.value      = '';
      e_qty_uom.value  = '';
      e_lab_ref.value  = '';

      if (e_status.value === 'Done') {
        const act2 = row.activity.trim().toLowerCase();
        if (act2 === 'finished goods quality assessment') {
          labRefSection.style.display = 'block';
        }
        else if (skuActivities.includes(act2)) {
          editSkuSection.style.display = 'block';
          (async () => {
            const { data: prod } = await supabase
              .from('products').select('id').eq('item', row.item).single();
            if (prod) {
              const { data: skus } = await supabase
                .from('product_skus')
                .select('id,pack_size,uom')
                .eq('product_id', prod.id)
                .eq('is_active', true)
                .order('pack_size');
              skus.forEach(sku => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                  <td>${sku.pack_size}</td>
                  <td>${sku.uom}</td>
                  <td><input type="number" min="0"
                             data-sku-id="${sku.id}"
                             data-pack-size="${sku.pack_size}"
                             data-uom="${sku.uom}"></td>`;
                editSkuBody.append(tr);
              });
            }
          })();
        }
        else if (act2 === 'transfer to fg store') {
          editTransSection.style.display = 'block';
          (async () => {
            const { data } = await supabase
              .from('bottled_stock_on_hand')
              .select('sku_id,pack_size,uom,on_hand')
              .eq('batch_number', row.batch_number);
            (data || []).forEach(r => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                <td>${r.pack_size}</td>
                <td>${r.uom}</td>
                <td>${r.on_hand}</td>
                <td><input type="number" min="0" max="${r.on_hand}"
                           data-sku-id="${r.sku_id}"
                           data-pack-size="${r.pack_size}"
                           data-uom="${r.uom}"></td>`;
              editTransBody.append(tr);
            });
          })();
        }
        else {
          editQtySection.style.display = 'flex';
        }
      }
    };

    showModal(editModal);
  }

// ────────────────────────────────────────────────────────────────────────────
// HANDLE EDIT FORM SUBMIT (ISO dates + duplicate guard)
// ────────────────────────────────────────────────────────────────────────────
editForm.onsubmit = async ev => {
  ev.preventDefault();

  // ── 0) Helper to detect unique-constraint failures ──────────────────
  const isDuplicateError = err =>
    err.code === '23505' ||
    /duplicate key/i.test(err.message || '') ||
    /violates unique constraint/i.test(err.message || '');

  // ── 1) Gather common fields ────────────────────────────────────────
  const id          = e_id.value;
  const originalAct = e_activity.value.trim();
  const actLower    = originalAct.toLowerCase();
  const newStat     = e_status.value;

// ── 2) If switching *away* from “Done”, clear packaging + update ───
if (newStat !== 'Done') {
  // 2a) clear any packaging records
  await clearPackaging(id);

  // 2b) attempt the update
  const { error } = await supabase
    .from('daily_work_log')
    .update({
      status            : newStat,
      completed_on      : null,
      qty_after_process : null,
      qty_uom           : null,
      sku_breakdown     : null,
      lab_ref_number    : null
    })
    .eq('id', id);

  // 2c) handle duplicate or other errors
  if (error) {
    await showAlert(
      isDuplicateError(error)
        ? duplicateMessage({
            item         : e_item.value,
            batch_number : e_bn.value,
            activity     : originalAct,
            log_date     : '(unchanged)'
          })
        : `Unexpected error: ${error.message || error.details || 'see console'}`
    );
    return;  // abort on failure
  }

  // 2d) on real success, show “saved” banner, close Edit modal & refresh
  editSuccess.style.display = 'block';
  setTimeout(() => {
    editSuccess.style.display = 'none';
    hideModal(editModal);
    loadFull();
  }, 1200);

  return;
}

// ── 3) Else: saving *as* “Done” ────────────────────────────────────
// 3a) Read post-Done values directly from the edit modal inputs
  const r = {
    choice      : 'just',                       // we’re finishing, not “Done & New”
    completedOn : e_comp.value,                 // completed date from the modal
    qty         : e_qty.value     ? Number(e_qty.value)   : null,
    uom         : e_qty_uom.value ? e_qty_uom.value.trim() : null,
    labRef      : e_lab_ref.value ? e_lab_ref.value.trim() : null,
    rows        : []                            // for SKU/transfer activities
  };

  // If this is a packaging or transfer activity, gather those SKU rows:
  if (skuActivities.includes(actLower) || actLower === 'transfer to fg store') {
    const tbody = skuActivities.includes(actLower) ? editSkuBody : editTransBody;
    r.rows = Array.from(tbody.querySelectorAll('input'))
      .map(i => ({
        skuId    : Number(i.dataset.skuId),
        count    : Number(i.value),
        packSize : i.dataset.packSize,
        uom      : i.dataset.uom
      }))
      .filter(x => x.count > 0);
  }

  // Optional: still confirm if no Qty/UOM for non-SKU activities
  const needsQty = !skuActivities.includes(actLower)
                 && actLower !== 'transfer to fg store'
                 && actLower !== 'finished goods quality assessment';
  if (needsQty && (!r.qty || !r.uom)) {
    if (!await askConfirm('No Qty/UOM provided. Save anyway?')) {
      sel.value = 'Doing';
      return;
    }
  }

  // 3b) build the update payload
  // 3b) build the update payload (now including started_on & due_date)
  const upd = {
    status            : 'Done',
    // overwrite the timestamps from the modal
    started_on        : toISO(e_start.value),
    due_date          : toISO(e_due.value),
    completed_on      : toISO(r.completedOn),

    qty_after_process : null,
    qty_uom           : null,
    sku_breakdown     : null,
    lab_ref_number    : null,

    // persist any section→plant edits
    section_id    : e_section.value    ? Number(e_section.value)    : null,
    subsection_id : e_sub.value        ? Number(e_sub.value)        : null,
    area_id       : e_area.value       ? Number(e_area.value)       : null,
    plant_id      : e_plant.value      ? Number(e_plant.value)      : null
  };
  if (actLower === 'finished goods quality assessment') {
    upd.lab_ref_number = r.labRef;
  } else if (skuActivities.includes(actLower) || actLower === 'transfer to fg store') {
    upd.sku_breakdown = r.rows.map(x => `${x.packSize} ${x.uom} x ${x.count}`).join('; ');
  } else {
    upd.qty_after_process = r.qty;
    upd.qty_uom           = r.uom;
  }

  // ── 3c) attempt to update the work‐log row
  const { data: updatedRow, error: updErr } = await supabase
    .from('daily_work_log')
    .update(upd)
    .eq('id', id);

  // ── 3d) if the DB rejects it (duplicate or other), show alert & bail
  if (updErr) {
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
    return;     // **do not** close the modal
  }

  // ── 4) on true success, upsert any packaging_events/event_skus
  if (skuActivities.includes(actLower) || actLower === 'transfer to fg store') {
    const { data: pe } = await supabase
      .from('packaging_events')
      .upsert(
        { work_log_id: id, event_type: originalAct },
        { onConflict: 'work_log_id' }
      )
      .select('id')
      .single();

    if (pe) {
      await supabase
        .from('event_skus')
        .delete()
        .eq('packaging_event_id', pe.id);

      if (r.rows && r.rows.length) {
        await supabase
          .from('event_skus')
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

  // ── 5) “Done & New” shortcut (if used)
  if (r.choice === 'new') {
    window.location.href =
      `add-log-entry.html?prefill_item=${encodeURIComponent(e_item.value)}` +
      `&prefill_bn=${encodeURIComponent(e_bn.value)}`;
    return;
  }

  // ── 6) success feedback, then close the editModal & refresh
  editSuccess.style.display = 'block';
  setTimeout(() => {
    editSuccess.style.display = 'none';
    hideModal(editModal);
    loadFull();
  }, 1200);
};
await initFull();
});