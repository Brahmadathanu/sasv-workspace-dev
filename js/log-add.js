// js/log-add.js
import { supabase } from './supabaseClient.js';

// ── Element refs ───────────────────────────────────────────────────────
const form              = document.getElementById('logForm');
const homeBtn           = document.getElementById('homeBtn');
const btnSubmitNew      = document.getElementById('btnSubmitNew');
const sectionSel        = document.getElementById('section');
const subSel            = document.getElementById('sub_section');
const areaSel           = document.getElementById('area');
const plantSel          = document.getElementById('plant_or_machinery');
const itemInput         = document.getElementById('itemInput');
const itemList          = document.getElementById('itemList');
const batchSel          = document.getElementById('batch_number');
const sizeInput         = document.getElementById('batch_size');
const uomInput          = document.getElementById('batch_uom');
const activitySel       = document.getElementById('activity');
const startInput        = document.getElementById('started_on');
const dueInput          = document.getElementById('due_date');
const statusSel         = document.getElementById('status');
const compOnSection     = document.getElementById('completedOnSection');
const postProcSection   = document.getElementById('postProcessingSection');
const labRefSection     = document.getElementById('labRefSection');
const skuSection        = document.getElementById('skuSection');
const transferSection   = document.getElementById('transferSection');
const skuTableBody      = document.querySelector('#skuTable tbody');
const transferTableBody = document.querySelector('#transferTable tbody');
const dialogOverlay     = document.getElementById('dialogOverlay');
const dialogMessage     = document.getElementById('dialogMessage');
const btnYes            = document.getElementById('btnYes');
const btnNo             = document.getElementById('btnNo');
const btnOk             = document.getElementById('btnOk');

let lastDurations    = {};
let currentItemSkus  = [];
let currentUserEmail = null;
let dirty            = false;

// packaging activities (lowercased), now including the two new ones
const skuActivities = [
  'bottling',
  'bottling and labelling',
  'bottling, labelling and cartoning',
  'capsule monocarton packing',
  'monocarton packing',
  'monocarton packing and cartoning'
];

// ── Modal helpers ────────────────────────────────────────────────
function showAlert(msg) {
  return new Promise(res => {
    dialogMessage.textContent = msg;
    btnYes.style.display = 'none';
    btnNo.style.display  = 'none';
    btnOk.style.display  = 'inline-block';
    dialogOverlay.style.display = 'flex';
    btnOk.onclick = () => {
      dialogOverlay.style.display = 'none';
      res();
    };
  });
}

function askConfirm(msg) {
  return new Promise(res => {
    dialogMessage.textContent = msg;
    btnYes.style.display = 'inline-block';
    btnNo.style.display  = 'inline-block';
    btnOk.style.display  = 'none';
    dialogOverlay.style.display = 'flex';
    btnYes.onclick = () => { dialogOverlay.style.display = 'none'; res(true); };
    btnNo.onclick  = () => { dialogOverlay.style.display = 'none'; res(false); };
  });
}

// ── Populate helpers ─────────────────────────────────────────────
function populate(sel, rows, vKey, tKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    rows.map(r => `<option value="${r[vKey]}">${r[tKey]}</option>`).join('');
}
function populateDataList(dl, items, key) {
  dl.innerHTML = items.map(i => `<option value="${i[key]}" style="font-weight:normal">`).join('');
}

// ── Date helpers ──────────────────────────────────────────────────
function computeDueFrom(start, days) {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added++;
  }
  return d.toISOString().slice(0,10);
}
function updateDueDate() {
  const act = activitySel.value, st = startInput.value;
  dueInput.value = (act && st && lastDurations[act] != null)
    ? computeDueFrom(st, Number(lastDurations[act]))
    : '';
}

// ── Render SKU & Transfer tables ────────────────────────────────
function renderSkuTable() {
  skuTableBody.innerHTML = '';
  currentItemSkus.forEach(sku => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sku.pack_size}</td>
      <td>${sku.uom}</td>
      <td><input type="number" min="0" data-sku-id="${sku.id}"></td>`;
    skuTableBody.append(tr);
  });
}
async function renderTransferTable() {
  transferTableBody.innerHTML = '';
  if (!batchSel.value) return;
  const { data } = await supabase
    .from('bottled_stock_on_hand')
    .select('sku_id,pack_size,uom,on_hand')
    .eq('batch_number', batchSel.value);
  (data || []).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.pack_size}</td>
      <td>${r.uom}</td>
      <td>${r.on_hand}</td>
      <td><input type="number" min="0" max="${r.on_hand}" data-sku-id="${r.sku_id}"></td>`;
    transferTableBody.append(tr);
  });
}

// ── Show/hide conditional sections ───────────────────────────────
function updateSections() {
  const actNorm = (activitySel.value || '').trim().toLowerCase();
  const done    = statusSel.value === 'Done';

  compOnSection.style.display    = done ? 'block' : 'none';
  postProcSection.style.display  = done
    && !skuActivities.includes(actNorm)
    && actNorm !== 'transfer to fg store'
    && actNorm !== 'finished goods quality assessment'
      ? 'block' : 'none';
  labRefSection.style.display    = (done && actNorm === 'finished goods quality assessment') ? 'block' : 'none';
  skuSection.style.display       = (done && skuActivities.includes(actNorm))            ? 'block' : 'none';
  transferSection.style.display  = (done && actNorm === 'transfer to fg store')         ? 'block' : 'none';

  if (done && skuActivities.includes(actNorm))    renderSkuTable();
  if (done && actNorm === 'transfer to fg store') renderTransferTable();
}

// ── Load activities ─────────────────────────────────────────────
async function loadActivities() {
  activitySel.disabled = true;
  activitySel.innerHTML = '<option>-- Select Activity --</option>';
  let q = supabase.from('activities').select('activity_name,duration_days');
  if      (areaSel.value)    q = q.eq('area_id', areaSel.value);
  else if (subSel.value)     q = q.eq('sub_section_id', subSel.value).is('area_id', null);
  else if (sectionSel.value) q = q.eq('section_id', sectionSel.value)
                                    .is('sub_section_id', null)
                                    .is('area_id', null);
  const { data, error } = await q.order('activity_name');
  if (error) return console.error(error);
  lastDurations = {};
  data.forEach(r => lastDurations[r.activity_name] = r.duration_days);
  if (data.length) {
    populate(activitySel, data, 'activity_name', 'activity_name', '-- Select Activity --');
    activitySel.disabled = false;
  }
}

// ── Carry-forward via URL ───────────────────────────────────────
function applyCarryForward() {
  const p = new URLSearchParams(window.location.search);
  // support both ?prefill_item / ?prefill_bn and ?item / ?bn
  const itemParam = p.get('prefill_item') || p.get('item');
  const bnParam   = p.get('prefill_bn')   || p.get('bn');
  if (itemParam) {
    itemInput.value = itemParam;
    itemInput.dispatchEvent(new Event('change'));
  }
  if (bnParam) {
    const iv = setInterval(() => {
      if (!Array.from(batchSel.options).some(o => o.value === bnParam)) return;
      batchSel.value = bnParam;
      batchSel.dispatchEvent(new Event('change'));
      clearInterval(iv);
    }, 100);
  }
}

// ── INITIAL SETUP ───────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const { data:{ user } } = await supabase.auth.getUser();
  if (user) currentUserEmail = user.email;

  homeBtn.onclick = async () => {
    if (dirty && !await askConfirm('Unsaved changes—leave?')) return;
    window.location.href = 'index.html';
  };

  btnSubmitNew.onclick = e => {
    e.preventDefault();
    handleSubmit(true);
  };

  // initially clear & disable
  [ subSel, areaSel, plantSel, batchSel, activitySel ].forEach(el => {
    el.disabled   = true;
    el.innerHTML  = '';
  });

  // load Sections
  {
    const { data, error } = await supabase
      .from('sections')
      .select('id,section_name')
      .order('section_name');
    if (!error) populate(sectionSel, data, 'id', 'section_name', '-- Select Section --');
  }

  // load Items
  {
    const { data, error } = await supabase
      .from('bmr_details')
      .select('item')
      .order('item');
    if (!error) {
      const uniq = [...new Set(data.map(r => r.item))].map(i => ({ item: i }));
      populateDataList(itemList, uniq, 'item');
    }
  }

  applyCarryForward();
  updateSections();
});

// ── Cascading selects ───────────────────────────────────────────
sectionSel.addEventListener('change', async () => {
  [ subSel, areaSel, plantSel, activitySel ].forEach(el => { el.disabled = true; el.innerHTML = ''; });
  await loadActivities();
  if (!sectionSel.value) return;
  const { data, error } = await supabase
    .from('subsections')
    .select('id,subsection_name')
    .eq('section_id', sectionSel.value)
    .order('subsection_name');
  if (!error && data.length) {
    populate(subSel, data, 'id', 'subsection_name', '-- Select Sub-section --');
    subSel.disabled = false;
  }
});

subSel.addEventListener('change', async () => {
  [ areaSel, plantSel, activitySel ].forEach(el => { el.disabled = true; el.innerHTML = ''; });
  await loadActivities();
  if (!subSel.value) return;
  const { data, error } = await supabase
    .from('areas')
    .select('id,area_name')
    .eq('section_id', sectionSel.value)
    .eq('subsection_id', subSel.value)
    .order('area_name');
  if (!error && data.length) {
    populate(areaSel, data, 'id', 'area_name', '-- Select Area --');
    areaSel.disabled = false;
  }
});

areaSel.addEventListener('change', async () => {
  [ plantSel, activitySel ].forEach(el => { el.disabled = true; el.innerHTML = ''; });
  await loadActivities();
  if (!areaSel.value) return;
  const { data, error } = await supabase
    .from('plant_machinery')
    .select('id,plant_name')
    .eq('area_id', areaSel.value)
    .order('plant_name');
  if (!error && data.length) {
    populate(plantSel, data, 'id', 'plant_name', '-- Select Plant/Machinery --');
    plantSel.disabled = false;
  }
});

// ── Item → Batch + SKUs ─────────────────────────────────────────
itemInput.addEventListener('change', async () => {
  const val = itemInput.value.trim();
  // validate against datalist
  if (!Array.from(itemList.options).map(o => o.value).includes(val)) {
    await showAlert('Please select a valid item.');
    itemInput.value     = '';
    batchSel.disabled   = true;
    batchSel.innerHTML  = '<option value="">-- Select Batch Number --</option>';
    currentItemSkus     = [];
    updateSections();
    return;
  }

  // batches
  const { data: bns } = await supabase
    .from('bmr_details')
    .select('bn')
    .eq('item', val)
    .order('bn');
  const uniq = [...new Set(bns.map(r => r.bn))].map(bn => ({ bn }));
  populate(batchSel, uniq, 'bn', 'bn', '-- Select Batch Number --');
  batchSel.disabled = !uniq.length;

  // SKUs
  const { data: prod } = await supabase
    .from('products')
    .select('id')
    .eq('item', val)
    .single();
  if (prod) {
    const { data: skus } = await supabase
      .from('product_skus')
      .select('id,pack_size,uom')
      .eq('product_id', prod.id)
      .eq('is_active', true)
      .order('pack_size');
    currentItemSkus = skus || [];
  } else {
    currentItemSkus = [];
  }

  updateSections();
});

batchSel.addEventListener('change', async () => {
  sizeInput.value = '';
  uomInput.value  = '';
  if (!itemInput.value || !batchSel.value) return;
  const { data } = await supabase
    .from('bmr_details')
    .select('batch_size,uom')
    .eq('item', itemInput.value)
    .eq('bn', batchSel.value)
    .limit(1);
  if (data && data.length) {
    sizeInput.value = data[0].batch_size;
    uomInput.value  = data[0].uom;
  }
  updateSections();
});

// ── Activity change + QA guard ───────────────────────────────────
activitySel.addEventListener('change', async () => {
  const actNorm = (activitySel.value || '').trim().toLowerCase();
  if (skuActivities.includes(actNorm) && itemInput.value && batchSel.value) {
    const { data: qa } = await supabase
      .from('daily_work_log')
      .select('id')
      .eq('item', itemInput.value)
      .eq('batch_number', batchSel.value)
      .eq('activity', 'Finished Goods Quality Assessment')
      .eq('status', 'Done')
      .limit(1);
    if (!qa || qa.length === 0) {
      await showAlert('Finished Goods Quality Assessment not completed for this batch. Please complete QA first.');
      activitySel.value = '';
    }
  }
  updateDueDate();
  updateSections();
});

// ── Status & Started On listeners ───────────────────────────────
statusSel.addEventListener('change', () => {
  if (statusSel.value === 'Done') {
    const c = form.querySelector('[name="completed_on"]');
    if (!c.value) c.value = new Date().toISOString().slice(0,10);
  }
  updateSections();
});
startInput.addEventListener('change', updateDueDate);

// ── Track dirty ─────────────────────────────────────────────────
form.addEventListener('input', () => { dirty = true; });

// ── Submit logic ────────────────────────────────────────────────
async function handleSubmit(isNew) {
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const actNorm    = (activitySel.value || '').trim().toLowerCase();
  const isTransfer = actNorm === 'transfer to fg store';
  const isDone     = statusSel.value === 'Done';

  // Transfer validations
  if (isDone && isTransfer) {
    const inputs = Array.from(transferTableBody.querySelectorAll('input[type="number"]'));
    if (!inputs.some(i => Number(i.value) > 0)) {
      inputs[0].setCustomValidity('Enter a Transfer Qty > 0.');
      inputs[0].reportValidity();
      inputs[0].setCustomValidity('');
      return;
    }
    for (const inp of inputs) {
      const cnt = Number(inp.value) || 0, max = Number(inp.max) || 0;
      if (cnt > max) {
        inp.setCustomValidity(`Cannot exceed on-hand (${max}).`);
        inp.reportValidity();
        inp.setCustomValidity('');
        return;
      }
    }
  }

  // Build payload
  const row = {
    log_date:            form.log_date.value,
    section_id:          sectionSel.value,
    subsection_id:       subSel.value || null,
    area_id:             areaSel.value || null,
    plant_id:            plantSel.value || null,
    item:                itemInput.value,
    batch_number:        batchSel.value,
    batch_size:          sizeInput.value || null,
    batch_uom:           uomInput.value || null,
    activity:            activitySel.value,
    juice_or_decoction:  form.juice_or_decoction?.value || null,
    specify:             form.specify?.value || null,
    count_of_saravam:    form.count_of_saravam?.value || null,
    fuel:                form.fuel?.value || null,
    fuel_under:          form.fuel_under?.value || null,
    fuel_over:           form.fuel_over?.value || null,
    started_on:          form.started_on?.value || null,
    due_date:            form.due_date?.value || null,
    status:              form.status?.value,
    completed_on:        form.completed_on?.value || null,
    qty_after_process:   null,
    qty_uom:             null,
    sku_breakdown:       null,
    lab_ref_number:      form.lab_ref_number?.value || null,
    remarks:             form.remarks?.value || null,
    uploaded_by:         currentUserEmail
  };

  // Optional Qty/UOM confirm
  if (isDone
      && !skuActivities.includes(actNorm)
      && actNorm !== 'transfer to fg store'
      && actNorm !== 'finished goods quality assessment') {
    const qv = form.querySelector('[name="qty_after_process"]').value;
    const uv = form.querySelector('[name="qty_after_process_uom"]').value;
    if (!qv || !uv) {
      const ok = await askConfirm(
        'You have not provided Qty After Process & UOM. Continue anyway?'
      );
      if (!ok) return;
    } else {
      row.qty_after_process = qv;
      row.qty_uom           = uv;
    }
  }

  // SKU breakdown
  if (isDone && skuActivities.includes(actNorm)) {
    const parts = Array.from(skuTableBody.querySelectorAll('input')).map(i => {
      const cnt = Number(i.value), sku = currentItemSkus.find(s=>s.id==i.dataset.skuId);
      return cnt>0 ? `${sku.pack_size} ${sku.uom} x ${cnt}` : null;
    }).filter(p=>p);
    row.sku_breakdown = parts.join('; ');
    row.qty_uom       = 'Nos';
  }
  if (isDone && isTransfer) {
    const parts = Array.from(transferTableBody.querySelectorAll('input')).map(i => {
      const cnt = Number(i.value), sku = currentItemSkus.find(s=>s.id==i.dataset.skuId);
      return cnt>0 ? `${sku.pack_size} ${sku.uom} x ${cnt}` : null;
    }).filter(p=>p);
    row.sku_breakdown = parts.join('; ');
  }

  // Insert work log
  const { data: ins, error: insErr } = await supabase
    .from('daily_work_log')
    .insert([ row ])
    .select('id')
    .single();
  if (insErr) {
    console.error(insErr);
    return showAlert('Error saving; check console.');
  }
  const newId = ins.id;

  // Insert packaging events
  if (isDone && (skuActivities.includes(actNorm) || isTransfer)) {
    const { data: pe, error: peErr } = await supabase
      .from('packaging_events')
      .insert([{ work_log_id: newId, event_type: row.activity }])
      .select('id')
      .single();
    if (!peErr) {
      const inputs = skuActivities.includes(actNorm)
        ? skuTableBody.querySelectorAll('input')
        : transferTableBody.querySelectorAll('input');
      const evRows = Array.from(inputs).map(i => {
        const cnt = Number(i.value);
        if (cnt <= 0) return null;
        return {
          packaging_event_id: pe.id,
          sku_id:             +i.dataset.skuId,
          count:              cnt
        };
      }).filter(x=>x);
      if (evRows.length) {
        const { error: esErr } = await supabase.from('event_skus').insert(evRows);
        if (esErr) console.error(esErr);
      }
    } else {
      console.error(peErr);
    }
  }

  // Success & next
  await showAlert('Log saved successfully!');
  if (isNew) {
    // pass both styles of params
    const params = new URLSearchParams();
    params.set('prefill_item', row.item);
    params.set('prefill_bn',    row.batch_number);
    params.set('item',          row.item);
    params.set('bn',            row.batch_number);
    window.location.href = `add-log-entry.html?${params.toString()}`;
  } else {
    form.reset();
    skuTableBody.innerHTML      = '';
    transferTableBody.innerHTML = '';
    [ compOnSection, postProcSection, labRefSection, skuSection, transferSection ]
      .forEach(sec => sec.style.display = 'none');
  }
}

// Attach form submit
form.addEventListener('submit', e => {
  e.preventDefault();
  handleSubmit(false);
});