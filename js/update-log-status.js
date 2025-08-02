import { supabase } from '../public/shared/js/supabaseClient.js';

/**
 * Base Flatpickr configuration shared across date inputs.
 */
const fpBase = {
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

/**
 * Parse a string in "DD-MM-YYYY" format into a Date object.
 * @param {string} s - The date string.
 * @returns {Date}
 */
const parseDMY = s => {
  const [d, m, y] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Format a Date object into "DD-MM-YYYY" string.
 * @param {Date} d - The date to format.
 * @returns {string}
 */
const formatDMY = d =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

/**
 * Attach an input mask to a text field so that only digits and hyphens
 * can be entered, formatted as DD-MM-YYYY.
 * @param {HTMLInputElement} el
 */
const attachMask = el => {
  el.addEventListener('input', () => {
    let v = el.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    el.value = v;
  });
};

const plantMap = {};

const sectionMap = {};

let skuActSet = new Set();

async function loadSkuActivities() {
  const { data, error } = await supabase
    .from('event_type_lkp')
    .select('label')
    .eq('active', true)
    .eq('affects_bottled_stock', 1);  // adjust to true if boolean

  if (error) {
    console.error('loadSkuActivities error:', error);
    skuActSet = new Set();
    return;
  }
  skuActSet = new Set(
    (data || [])
      .map(r => (r.label || '').trim().toLowerCase())
      .filter(Boolean)
  );
}

const $ = sel => document.querySelector(sel);

let homeBtn, bodyTbl;
let sLogDate, sSection, sSub, sArea, sItem, sBN, sActivity, sStatusFilter, sOverdue, clearBtn;

let doneModal, doneForm, doneCompletedOn, doneQtySection, doneLabRefSec;
let doneSkuSec, doneSkuBody, doneTransSec, doneTransBody;
let doneCancel, doneJust, doneNew;

let doneJuiceSection, donePutamSection;
let doneJuiceOrDecoction, doneSpecify;
let doneCountSaravam, doneFuel, doneFuelUnder, doneFuelOver;
let doneCompletedOnSection;

let confirmModal, confirmText, confirmYes, confirmNo;

let storageModal, storageForm, storageQty, storageUom, storageCancel, storageSave;


/**
 * Show an element by setting its display to 'flex'.
 * @param {HTMLElement} el
 */
function show(el) {
  el.style.display = 'flex';
}

/**
 * Hide an element by setting its display to 'none'.
 * @param {HTMLElement} el
 */
function hide(el) {
  el.style.display = 'none';
}

/**
 * Display a confirmation modal with the given message,
 * and resolve to true/false based on user choice.
 * @param {string} msg
 * @returns {Promise<boolean>}
 */
async function askConfirm(msg) {
  confirmText.textContent = msg;
  show(confirmModal);
  return new Promise(res => {
    confirmYes.onclick = () => {
      hide(confirmModal);
      res(true);
    };
    confirmNo.onclick = () => {
      hide(confirmModal);
      res(false);
    };
  });
}

/**
 * Remove any existing packaging events and their SKUs for a given logId.
 * @param {number|string} logId
 */
async function clearPackaging(logId) {
  const { data } = await supabase
    .from('packaging_events')
    .select('id')
    .eq('work_log_id', logId);
  if (data.length) {
    const ids = data.map(x => x.id);
    await supabase.from('event_skus').delete().in('packaging_event_id', ids);
    await supabase.from('packaging_events').delete().in('id', ids);
  }
}

/**
 * Populate a <select> element with an array of row objects.
 * @param {HTMLSelectElement} sel
 * @param {Array<Object>} rows
 * @param {string} vKey - object key for option value
 * @param {string} tKey - object key for option text
 * @param {string} ph - placeholder text
 */
function populate(sel, rows, vKey, tKey, ph) {
  sel.innerHTML =
    `<option value="">${ph}</option>` +
    rows.map(r => `<option value="${r[vKey]}">${r[tKey]}</option>`).join('');
}

/**
 * Reset and disable the Area and Batch Number filters.
 */
function resetAreaBN() {
  populate(sArea, [], '', '', 'Area');
  sArea.disabled = true;
  resetBN();
}

/**
 * Reset and disable the Batch Number filter.
 */
function resetBN() {
  sBN.innerHTML = '<option value="">BN</option>';
  sBN.disabled = true;
}

/**
 * Configure, prefill, and show/hide the Done‐modal sections.
 * @param {string} activity
 * @param {string} item
 * @param {string} batch
 * @param {string|number} id   // record ID
 */
/**
 * Configure, prefill, and show/hide the Done-modal sections based on activity.
 * @param {string} activity
 * @param {string} item
 * @param {string} batch
 * @param {string|number} id     // record ID
 */
async function configureDoneModal(activity, item, batch, id) {
  const act = activity.toLowerCase().trim();

  // 1) Fetch existing Done-fields
  const { data: rec, error: recErr } = await supabase
    .from('daily_work_log')
    .select(`
      completed_on,
      qty_after_process,
      qty_uom,
      lab_ref_number,
      sku_breakdown
    `)
    .eq('id', id)
    .single();
  if (recErr) console.error("Prefill error:", recErr);

  // 2) Hide all optional panels
  [
    doneLabRefSec,
    doneSkuSec,
    doneTransSec,
    doneQtySection,
    doneJuiceSection,
    donePutamSection
  ].forEach(el => el.style.display = 'none');
  doneSkuBody.innerHTML = "";
  doneTransBody.innerHTML = "";

  // 3) Show & prefill the right panel(s)
  if (act === 'finished goods quality assessment') {
    doneLabRefSec.style.display = 'flex';
    document.getElementById('doneLabRef').value = rec?.lab_ref_number || '';

  } else if (skuActSet.has(act)) {
    // SKU breakdown
    doneSkuSec.style.display = 'block';
    const { data: prod } = await supabase
      .from('products')
      .select('id')
      .eq('item', item)
      .single();
    if (prod) {
      const { data: skus } = await supabase
        .from('product_skus')
        .select('id,pack_size,uom')
        .eq('product_id', prod.id)
        .eq('is_active', true)
        .order('pack_size');
      skus.forEach(s => {
        doneSkuBody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${s.pack_size}</td>
            <td>${s.uom}</td>
            <td>
              <input type="number" min="0"
                     data-sku-id="${s.id}"
                     data-pack-size="${s.pack_size}"
                     data-uom="${s.uom}">
            </td>
          </tr>`);
      });
      // prefill counts
      if (rec?.sku_breakdown) {
        rec.sku_breakdown.split(';').forEach(entry => {
          const [ps, uom, , cnt] = entry.trim().split(' ');
          const inp = doneSkuBody.querySelector(
            `input[data-pack-size="${ps}"][data-uom="${uom}"]`
          );
          if (inp) inp.value = cnt;
        });
      }
    }

  } else if (act === 'transfer to fg store') {
    // Transfer table
    doneTransSec.style.display = 'block';
    const { data } = await supabase
      .from('bottled_stock_on_hand')
      .select('sku_id,pack_size,uom,on_hand')
      .eq('batch_number', batch);
    data.forEach(r => {
      doneTransBody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${r.pack_size}</td>
          <td>${r.uom}</td>
          <td>${r.on_hand}</td>
          <td>
            <input type="number"
                   min="0"
                   max="${r.on_hand}"
                   data-sku-id="${r.sku_id}"
                   data-pack-size="${r.pack_size}"
                   data-uom="${r.uom}">
          </td>
        </tr>`);
    });
    // prefill transfer counts
    if (rec?.sku_breakdown) {
      rec.sku_breakdown.split(';').forEach(entry => {
        const [ps, uom, , cnt] = entry.trim().split(' ');
        const inp = doneTransBody.querySelector(
          `input[data-pack-size="${ps}"][data-uom="${uom}"]`
        );
        if (inp) inp.value = cnt;
      });
    }

  } else if (/stock\s*transfer/i.test(act)) {
  // Stock Transfer → we collect Storage Qty in a separate modal; hide qty panel here
  doneQtySection.style.display = 'none';
} else {
  // Post-process qty/UOM
  doneQtySection.style.display = 'flex';
  document.getElementById('doneQty').value = rec?.qty_after_process ?? '';
  document.getElementById('doneUOM').value = rec?.qty_uom           || '';
}

  // 4) Prefill Completed On
  if (rec?.completed_on) {
    doneCompletedOn.value = formatDMY(new Date(rec.completed_on));
  }
}

/**
 * Prompt the Done modal and return the user's choice plus entered values.
 * @param {string} activity
 * @param {string} item
 * @param {string} batch
 * @param {string} id
 * @returns {Promise<{
 *   choice: string,
 *   completedOn: string,
 *   rows: Array<{skuId:number,packSize:string,uom:string,count:number}>,
 *   qty: number|null,
 *   uom: string|null,
 *   labRef: string|null
 * }>}
 */
async function promptDone(activity, item, batch, id) {
  doneForm.reset();
  // Default Completed On to today
  doneCompletedOn.value = formatDMY(new Date());
  await configureDoneModal(activity, item, batch, id);
  show(doneModal);

  return new Promise(res => {
    doneCancel.onclick = () => {
      hide(doneModal);
      res({ choice: 'cancel' });
    };

const finish = async choice => {
  // 1) always require Completed On
  if (!doneCompletedOn.value) {
    await askConfirm("Please enter Completed On date.");
    return;
  }

  // 2) Lab Ref if shown
  if (doneLabRefSec.style.display !== 'none' && !document.querySelector('#doneLabRef').value.trim()) {
    await askConfirm("Please enter Lab Ref Number.");
    return;
  }

  // 3) Post‑processing if shown
  if (doneQtySection.style.display !== 'none') {
    if (!document.querySelector('#doneQty').value || !document.querySelector('#doneUOM').value) {
      if (!await askConfirm("Qty After Process & UOM not entered. Continue?")) return;
    }
  }

  // 4) SKU breakdown if shown
  if (doneSkuSec.style.display !== 'none') {
    const anySku = Array.from(doneSkuBody.querySelectorAll('input'))
                        .some(i => +i.value > 0);
    if (!anySku) {
      await askConfirm("Enter at least one SKU count greater than zero.");
      return;
    }
  }

  // 5) Transfer if shown
  if (doneTransSec.style.display !== 'none') {
    const inputs = Array.from(doneTransBody.querySelectorAll('input'));
    if (!inputs.some(i => +i.value > 0)) {
      await askConfirm("Enter at least one Transfer Qty > 0.");
      return;
    }
    for (let inp of inputs) {
      if (+inp.value > +inp.max) {
        await askConfirm(`Cannot exceed on-hand (${inp.max}).`);
        return;
      }
    }
  }

  // all good → hide & resolve
  const completedOn = doneCompletedOn.value;
  const labRef      = document.querySelector('#doneLabRef')?.value.trim() || null;
  let rows = [];
  const actL = activity.toLowerCase().trim();
  const isStockTransfer = /stock\s*transfer/i.test(actL);

  if (skuActSet.has(actL)) {
    rows = Array.from(doneSkuBody.querySelectorAll('input'))
      .map(i => ({ skuId:+i.dataset.skuId, packSize:i.dataset.packSize, uom:i.dataset.uom, count:+i.value }))
      .filter(r => r.count>0);
  } else if (actL === 'transfer to fg store') {
    rows = Array.from(doneTransBody.querySelectorAll('input'))
      .map(i => ({ skuId:+i.dataset.skuId, packSize:i.dataset.packSize, uom:i.dataset.uom, count:+i.value }))
      .filter(r => r.count>0);
  }
  const qty = Number(document.querySelector('#doneQty')?.value) || null;
  const uom = document.querySelector('#doneUOM')?.value || null;

  hide(doneModal);
  res({ choice, completedOn, rows, qty, uom, labRef });
};

    doneJust.onclick = () => finish('just');
    doneNew .onclick = () => finish('new');
  });
}

/**
 * Configure and hide/show the Doing‐modal sections, and prefill existing values.
 */
async function configureDoingModal(activity, item, batch, id) {
  // Reset & hide Done‐only panels
  doneForm.reset();
  doneCompletedOnSection.style.display = 'none';
  [doneLabRefSec, doneSkuSec, doneTransSec, doneQtySection]
    .forEach(el => el.style.display = 'none');

  // Show only the relevant Doing panels
  const act = activity.toLowerCase().trim();
  doneJuiceSection.style.display = /juice|grinding|kashayam/.test(act) ? 'flex' : 'none';
  donePutamSection.style.display = /putam|gaja putam|seelamann/.test(act) ? 'flex' : 'none';

  // Pull the current values for these fields from the DB
  const { data: rec, error } = await supabase
    .from('daily_work_log')
    .select('juice_or_decoction,specify,count_of_saravam,fuel,fuel_under,fuel_over')
    .eq('id', id)
    .single();
  if (!error && rec) {
    doneJuiceOrDecoction.value = rec.juice_or_decoction || '';
    doneSpecify.value          = rec.specify            || '';
    doneCountSaravam.value     = rec.count_of_saravam   ?? '';
    doneFuel.value             = rec.fuel               || '';
    doneFuelUnder.value        = rec.fuel_under         || '';
    doneFuelOver.value         = rec.fuel_over          || '';
  }
}

/**
 * Prompt the modal for Doing-transition fields (Juice/Putam).
 * @param {string} activity
 * @param {string} item
 * @param {string} batch
 * @param {string} prevStatus
 * @returns {Promise<{choice: string}>}
 */
/**
 * Prompt the Doing modal, prefill existing values, and return the user's choice.
 * @param {string} activity
 * @param {string} item
 * @param {string} batch
 * @param {number|string} id    // log record ID
 * @returns {Promise<{choice: string}>}
 */
async function promptDoing(activity, item, batch, id) {
  // Configure & prefill the Doing-only panels
  await configureDoingModal(activity, item, batch, id);

  // Show the modal
  show(doneModal);

  // Return a promise that resolves when the user clicks Cancel/Just Save/Save & New
  return new Promise(res => {
    doneCancel.onclick = () => {
      hide(doneModal);
      res({ choice: 'cancel' });
    };
const finish = async () => {
  // Juice/Decoction panel?
  if (doneJuiceSection.style.display !== 'none') {
    if (!doneJuiceOrDecoction.value) {
      await askConfirm("Please select Juice/Decoction type.");
      return;
    }
    if (!doneSpecify.value.trim()) {
      await askConfirm("Please enter Specify field.");
      return;
    }
  }

  // Putam panel?
  if (donePutamSection.style.display !== 'none') {
    if (!doneCountSaravam.value) {
      await askConfirm("Please enter Count of Saravam.");
      return;
    }
    if (!doneFuel.value) {
      await askConfirm("Please select Fuel Type.");
      return;
    }
    if (!doneFuelUnder.value.trim()) {
      await askConfirm("Please enter Fuel Under.");
      return;
    }
    if (!doneFuelOver.value.trim()) {
      await askConfirm("Please enter Fuel Over.");
      return;
    }
  }

  // all good → hide & resolve
  hide(doneModal);
  res({ choice: 'ok' });
};
    doneJust.onclick = finish;
    doneNew.onclick  = finish;
  });
}

/**
 * Prompt user for Storage Qty + UOM.
 * @returns {Promise<{choice:string,storageQty:number,storageUom:string}>}
 */
function promptStorage() {
  storageForm.reset();
  show(storageModal);
  return new Promise(res => {
    storageCancel.onclick = () => {
      hide(storageModal);
      res({ choice: 'cancel' });
    };
    storageSave.onclick = async () => {
      if (!storageQty.value || !storageUom.value) {
        await askConfirm("Please enter both Storage Qty and UOM.");
        return;
      }
      hide(storageModal);
      res({
        choice:     'save',
        storageQty: Number(storageQty.value),
        storageUom: storageUom.value
      });
    };
  });
}

/**
 * Handle saving status changes, including prompting for Done or Doing transitions.
 * @param {string|number} id
 * @param {HTMLSelectElement} sel
 */
async function saveStatus(id, sel) {
  const newStat = sel.value.trim();
  const { act: activity, item, bn, prevStatus } = sel.dataset;
  const actL = activity.toLowerCase().trim();
  const isStockTransfer = /stock\s*transfer/i.test(actL);

if (newStat === 'Done') {
  const r = await promptDone(activity, item, bn, id);
  if (r.choice === 'cancel') {
    sel.value = prevStatus;
    return;
  }

  // Ask for Storage Qty/UOM only for Stock Transfer
let storageData = null;
if (isStockTransfer) {
  storageData = await promptStorage();
  if (storageData.choice === 'cancel') {
    sel.value = prevStatus;
    return;
  }
}

   // ── PRE-FLIGHT FG BULK STOCK CHECK (client-side) ─────────────────────
if (skuActSet.has(actL)) {
  // 1) Sum pack_size × count (rows are already numbers)
  const totalUnits = r.rows.reduce(
    (sum, x) => sum + (Number(x.packSize) || 0) * (Number(x.count) || 0),
    0
  );

  // 2) Product-level conversion factor to base unit
  const { data: prod, error: prodErr } = await supabase
    .from('products')
    .select('conversion_to_base, uom_base')
    .eq('item', item)
    .maybeSingle();
  if (prodErr) console.error('Product lookup error:', prodErr);

  const factor = Number(prod?.conversion_to_base) || 1;
  const totalBaseQty = totalUnits * factor;

  // 3) Current FG bulk stock row (skip if none)
  const { data: bulk, error: bulkErr } = await supabase
    .from('fg_bulk_stock')
    .select('qty_on_hand')
    .eq('item', item)
    .eq('bn', bn)
    .maybeSingle();
  if (bulkErr) console.error('FG stock lookup error:', bulkErr);

  if (bulk) {
    const available = Number(bulk.qty_on_hand) || 0;
    const EPS = 0.001;

    if (totalBaseQty > available + EPS) {
  // show in-page warning modal instead of alert/confirm
  stockWarningText.textContent = 
    `Cannot mark Done: packaging ${totalBaseQty.toFixed(3)} ${prod?.uom_base || ''} ` +
    `> available ${available.toFixed(3)} ${prod?.uom_base || ''} in FG bulk stock.`;
  show(stockWarningModal);
  sel.value = prevStatus;
  return;
}
  }
  // If no bulk row, let it pass — DB trigger will ignore/adjust anyway.
}

  // parse & build payload
  const [d, m, y] = r.completedOn.split('-').map(Number);
  const isoDate = new Date(y, m - 1, d).toISOString().slice(0, 10);
  const upd = {
    status: 'Done',
    completed_on: isoDate,
    qty_after_process: null,
    qty_uom: null,
    sku_breakdown: null,
    lab_ref_number: null,
    storage_qty       : storageData ? storageData.storageQty     : null,
    storage_qty_uom   : storageData ? storageData.storageUom     : null
  };

  if (actL === 'finished goods quality assessment') {
    upd.lab_ref_number = r.labRef;
  } else if (
    skuActSet.has(actL) ||
    actL === 'transfer to fg store'
  ) {
    upd.sku_breakdown = r.rows
      .map(x => `${x.packSize} ${x.uom} x ${x.count}`)
      .join('; ');
  } else {
    upd.qty_after_process = r.qty;
    upd.qty_uom           = r.uom;
  }

  // update main record
  const { error: updErr } = await supabase
    .from('daily_work_log')
    .update(upd)
    .eq('id', Number(id));
  if (updErr) {
      console.error('Update failed:', updErr);
      alert(`Could not update record ${id} to Done:\n${updErr.message}`);
      sel.value = prevStatus;
      return;
    }

  // upsert packaging events if needed
  if (skuActSet.has(actL) || actL === 'transfer to fg store') {
    const { data: pe } = await supabase
      .from('packaging_events')
      .upsert(
        { work_log_id: id, event_type: activity },
        { onConflict: 'work_log_id' }
      )
      .select('id')
      .single();
    if (pe) {
      await supabase.from('event_skus').delete().eq('packaging_event_id', pe.id);
      if (r.rows.length) {
        await supabase
          .from('event_skus')
          .insert(
            r.rows.map(x => ({
              packaging_event_id: pe.id,
              sku_id: x.skuId,
              count: x.count
            }))
          );
      }
    }
  }

  // if user wants "Save & New", go to add-log-entry
  if (r.choice === 'new') {
    window.location.href =
      `add-log-entry.html?item=${encodeURIComponent(item)}&bn=${encodeURIComponent(bn)}`;
    return;
  }

  await loadStatus();
  return;
}

  if (newStat === 'Doing') {
    await clearPackaging(id);

    if (/juice|grinding|kashayam/.test(actL) || /putam|gaja putam|seelamann/.test(actL)) {
      const r = await promptDoing(activity, item, bn, id);
      if (r.choice === 'cancel') {
        sel.value = prevStatus;
        return;
      }

      const upd = { status: 'Doing' };
      if (/juice|grinding|kashayam/.test(actL)) {
        upd.juice_or_decoction = doneJuiceOrDecoction.value || null;
        upd.specify            = doneSpecify.value            || null;
      }
      if (/putam|gaja putam|seelamann/.test(actL)) {
        upd.count_of_saravam = doneCountSaravam.value
          ? Number(doneCountSaravam.value)
          : null;
        upd.fuel       = doneFuel.value       || null;
        upd.fuel_under = doneFuelUnder.value  || null;
        upd.fuel_over  = doneFuelOver.value   || null;
      }

      const { error } = await supabase
        .from('daily_work_log')
        .update(upd)
        .eq('id', id);
      if (error) {
        console.error('Update failed:', error);
        sel.value = prevStatus;
      }
    } else {
      const { error } = await supabase
        .from('daily_work_log')
        .update({ status: 'Doing' })
        .eq('id', id);
      if (error) {
        console.error('Update failed:', error);
        sel.value = prevStatus;
      }
    }

    loadStatus();
    return;
  }

    // ── In Storage branch ────────────────────────────────────────────────────
  if (newStat === 'In Storage') {
    const r = await promptStorage();
    if (r.choice === 'cancel') {
      sel.value = prevStatus;
      return;
    }
    // build payload: reset all other fields
    const payload = {
      status:            'In Storage',
      storage_qty:       r.storageQty,
      storage_qty_uom:   r.storageUom,
      completed_on:      null,
      qty_after_process: null,
      qty_uom:           null,
      sku_breakdown:     null,
      lab_ref_number:    null,
      juice_or_decoction:null,
      specify:           null,
      count_of_saravam:  null,
      fuel:              null,
      fuel_under:        null,
      fuel_over:         null
    };
    const { error: updErr } = await supabase
      .from('daily_work_log')
      .update(payload)
      .eq('id', id);
    if (updErr) {
      console.error('Update failed:', updErr);
      sel.value = prevStatus;
      return;
    }
    loadStatus();
    return;
  }

  // On Hold & other transitions
  await clearPackaging(id);
  const { error } = await supabase
    .from('daily_work_log')
    .update({
      status: newStat,
      completed_on: null,
      qty_after_process: null,
      qty_uom: null,
      sku_breakdown: null,
      lab_ref_number: null
    })
    .eq('id', id);
  if (error) console.error('Update failed:', error);

  loadStatus();
}

/**
 * Load and render the status table based on current filters.
 */
async function loadStatus() {
  bodyTbl.replaceChildren();

// Base: only show in-progress statuses in this module.
let q = supabase
  .from('daily_work_log')
  .select('id,log_date,item,batch_number,batch_size,batch_uom,section_id,plant_id,activity,status,due_date')
  .in('status', ['Doing', 'On Hold', 'In Storage']);

// Apply the user-picked filter if it’s one of the allowed statuses.
const filter = (sStatusFilter.value || '').trim();
if (['Doing', 'On Hold', 'In Storage'].includes(filter)) {
  q = q.eq('status', filter);
}

  if (sLogDate.value) {
    const [dd, mm, yyyy] = sLogDate.value.split('-').map(n => n.padStart(2, '0'));
    q = q.eq('log_date', `${yyyy}-${mm}-${dd}`);
  }
  if (sSection.value)      q = q.eq('section_id', sSection.value);
  if (sSub.value)          q = q.eq('subsection_id', sSub.value);
  if (sArea.value)         q = q.eq('area_id', sArea.value);
  if (sItem.value)         q = q.eq('item', sItem.value);
  if (sBN.value)           q = q.eq('batch_number', sBN.value);
  if (sActivity.value)     q = q.eq('activity', sActivity.value);
  if (sOverdue.checked) {
    const today = new Date().toISOString().slice(0,10);
    q = q.lt('due_date', today);
  }

  const { data, error } = await q;
  if (error) return console.error('loadStatus error:', error);

  const coll = new Intl.Collator('en',{ numeric:true, sensitivity:'base' });
  data.sort((a,b) => {
    const da = new Date(a.log_date) - new Date(b.log_date);
    if (da) return da;
    const it = a.item.localeCompare(b.item,undefined,{sensitivity:'base'});
    if (it) return it;
    const bn = a.batch_number.localeCompare(b.batch_number,undefined,{numeric:true});
    if (bn) return bn;
    return coll.compare(plantMap[a.plant_id]||'', plantMap[b.plant_id]||'');
  });

data.forEach(r => {
  const act = r.activity.toLowerCase().trim();
  const allowStorage = ['intermediate storage','fg bulk storage'].includes(act);

  bodyTbl.insertAdjacentHTML('beforeend', `
    <tr>
      <td>${new Date(r.log_date).toLocaleDateString('en-GB')}</td>
      <td>${r.item}</td>
      <td>${r.batch_number}</td>
      <td>${r.batch_size ?? ''}</td>
      <td>${r.batch_uom  ?? ''}</td>
      <td>${sectionMap[r.section_id]||''}</td>
      <td>${plantMap[r.plant_id]||''}</td>
      <td>${r.activity}</td>
      <td>
        <select class="statSel"
        data-id="${r.id}"
        data-act="${r.activity}"
        data-item="${r.item}"
        data-bn="${r.batch_number}"
        data-prev-status="${r.status}">
  <option value="Doing"      ${r.status === 'Doing'      ? 'selected' : ''} ${allowStorage ? 'disabled' : ''}>Doing</option>
  <option value="On Hold"    ${r.status === 'On Hold'    ? 'selected' : ''} ${allowStorage ? 'disabled' : ''}>On Hold</option>
  <option value="In Storage" ${r.status === 'In Storage' ? 'selected' : ''} ${allowStorage ? '' : 'disabled'}>In Storage</option>
  <option value="Done"       ${r.status === 'Done'       ? 'selected' : ''}>Done</option>
</select>
      </td>
      <td>
        <a href="#" class="save-link" data-id="${r.id}">Save</a>
      </td>
    </tr>`);
});

  document.querySelectorAll('.save-link').forEach(a => {
    const sel = document.querySelector(`.statSel[data-id="${a.dataset.id}"]`);
    a.onclick = e => { e.preventDefault(); saveStatus(a.dataset.id, sel); };
  });
}

/**
 * Initialize DOM references, event handlers, and load initial data.
 */
let stockWarningModal, stockWarningOk, stockWarningText;

async function init() {
  homeBtn               = $('#homeBtn');
  bodyTbl               = $('#statusBody');
  sLogDate              = $('#sLogDate');
  sSection              = $('#sSection');
  sSub                  = $('#sSub');
  sArea                 = $('#sArea');
  sItem                 = $('#sItem');
  sBN                   = $('#sBN');
  sActivity             = $('#sActivity');
  sStatusFilter         = $('#sStatusFilter')
  sOverdue              = $('#sOverdue');
  clearBtn              = $('#clearStatus');

  const toggleAdvanced  = $('#toggleAdvanced');
  const advancedFilters = $('#advancedFilters');

  doneModal             = $('#doneModal');
  doneForm              = $('#doneForm');
  doneCompletedOn       = $('#doneCompletedOn');
  doneCompletedOnSection= $('#doneCompletedOn').closest('.form-row');
  doneQtySection        = $('#doneQtySection');
  doneLabRefSec         = $('#doneLabRefSection');
  doneSkuSec            = $('#doneSkuSection');
  doneSkuBody           = $('#doneSkuTable tbody');
  doneTransSec          = $('#doneTransSection');
  doneTransBody         = $('#doneTransTable tbody');
  doneCancel            = $('#doneCancel');
  doneJust              = $('#doneJust');
  doneNew               = $('#doneNew');

  doneJuiceSection      = $('#doneJuiceSection');
  donePutamSection      = $('#donePutamSection');
  doneJuiceOrDecoction  = $('#doneJuiceOrDecoction');
  doneSpecify           = $('#doneSpecify');
  doneCountSaravam      = $('#doneCountSaravam');
  doneFuel              = $('#doneFuel');
  doneFuelUnder         = $('#doneFuelUnder');
  doneFuelOver          = $('#doneFuelOver');

  confirmModal          = $('#confirmModal');
  confirmText           = $('#confirmText');
  confirmYes            = $('#confirmYes');
  confirmNo             = $('#confirmNo');

  storageModal  = $('#storageModal');
  storageForm   = $('#storageForm');
  storageQty    = $('#storageQty');
  storageUom    = $('#storageUom');
  storageCancel = $('#storageCancel');
  storageSave   = $('#storageSave');

  stockWarningModal = $('#stockWarningModal');
  stockWarningOk = $('#stockWarningOk');
  stockWarningText = $('#stockWarningText');

  stockWarningOk.onclick = () => {
    hide(stockWarningModal);
  };

  const { data: pl, error: plErr } = await supabase
    .from('plant_machinery')
    .select('id,plant_name');
  if (!plErr) pl.forEach(p => plantMap[p.id] = p.plant_name);

  const { data: secs, error: secsErr } = await supabase
    .from('sections')
    .select('id,section_name')
    .order('section_name');
  if (!secsErr) {
    secs.forEach(s => sectionMap[s.id] = s.section_name);
    populate(sSection, secs, 'id', 'section_name', 'Section');
  }

  const { data: itemsRaw, error: itemsErr } = await supabase
    .from('bmr_details')
    .select('item')
    .order('item');
  if (!itemsErr) {
    const uniqueItems = Array.from(new Set(itemsRaw.map(r => r.item)))
                             .map(i => ({ item: i }));
    populate(sItem, uniqueItems, 'item', 'item', 'Item');
  }

  // Fetch all activities for Doing/On Hold
  const { data: allActs, error: actsErr } = await supabase
    .from('daily_work_log')
    .select('activity')
    .in('status', ['Doing','On Hold','In Storage'])
    .order('activity');

  if (!actsErr) {
    // Deduplicate & sort in JS
    const uniqueActs = Array
      .from(new Set(allActs.map(r => r.activity)))  // Set → unique strings
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(a => ({ activity: a }));                 // back to [{activity}...]

    populate(sActivity, uniqueActs, 'activity', 'activity', 'Activity');
  }

  sActivity.addEventListener('change', loadStatus);
  sStatusFilter.addEventListener('change',loadStatus);

  homeBtn.addEventListener('click', () => window.location.href = 'index.html');

  sSection.addEventListener('change', () => {
    if (!sSection.value) {
      populate(sSub, [], '', '', 'Sub-section');
      sSub.disabled = true;
    } else {
      supabase
        .from('subsections')
        .select('id,subsection_name')
        .eq('section_id', sSection.value)
        .order('subsection_name')
        .then(({ data }) => {
          populate(sSub, data, 'id', 'subsection_name', 'Sub-section');
          sSub.disabled = false;
        });
    }
    resetAreaBN();
    loadStatus();
  });

  sSub.addEventListener('change', () => {
    if (!sSub.value) {
      resetAreaBN();
    } else {
      supabase
        .from('areas')
        .select('id,area_name')
        .eq('section_id', sSection.value)
        .eq('subsection_id', sSub.value)
        .order('area_name')
        .then(({ data }) => {
          populate(sArea, data, 'id', 'area_name', 'Area');
          sArea.disabled = false;
          resetBN();
        });
    }
    loadStatus();
  });

  sArea.addEventListener('change', () => {
    resetBN();
    loadStatus();
  });

  sItem.addEventListener('change', () => {
    if (!sItem.value) {
      resetBN();
    } else {
      supabase
        .from('bmr_details')
        .select('bn', { distinct: true })
        .eq('item', sItem.value)
        .order('bn')
        .then(({ data }) => {
          populate(sBN, data.map(r => ({ bn: r.bn })), 'bn', 'bn', 'BN');
          sBN.disabled = false;
        });
    }
    loadStatus();
  });

  sBN.addEventListener('change', loadStatus);
  sOverdue.addEventListener('change', loadStatus);

  clearBtn.addEventListener('click', () => {
    [sSection, sSub, sArea, sItem, sBN, sActivity, sStatusFilter].forEach(x => x.value = '');
    [sSub, sArea, sBN].forEach(x => x.disabled = true);
    sOverdue.checked = false;
    sLogDate.value   = '';
    advancedFilters.style.display = 'none';
    toggleAdvanced.textContent    = 'Advanced ▾';

    loadStatus();
  });

  toggleAdvanced.addEventListener('click', () => {
    const isOpen = advancedFilters.style.display === 'flex';
    advancedFilters.style.display = isOpen ? 'none' : 'flex';
    toggleAdvanced.textContent = isOpen ? 'Advanced ▾' : 'Advanced ▴';
  });

  attachMask(sLogDate);
  flatpickr(sLogDate, fpBase);
  sLogDate.addEventListener('change', loadStatus);

  attachMask(doneCompletedOn);
  flatpickr(doneCompletedOn, { ...fpBase, maxDate: 'today' });
  doneCompletedOn.addEventListener('blur', () => {
    const d = parseDMY(doneCompletedOn.value);
    const today = new Date();
    if (+d > +today) doneCompletedOn.value = formatDMY(today);
  });

  await loadSkuActivities();
  await loadStatus();
}

document.addEventListener('DOMContentLoaded', init);