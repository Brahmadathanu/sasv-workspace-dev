// js/log-add.js
import { supabase } from './supabaseClient.js';

// ── Refs ──────────────────────────────────────────────────────────
const form               = document.getElementById('logForm');
const sectionSel         = document.getElementById('section');
const subSel             = document.getElementById('sub_section');
const areaSel            = document.getElementById('area');
const plantSel           = document.getElementById('plant_or_machinery');
const itemInput          = document.getElementById('itemInput');
const itemList           = document.getElementById('itemList');
const batchSel           = document.getElementById('batch_number');
const sizeInput          = document.getElementById('batch_size');
const uomInput           = document.getElementById('batch_uom');
const activitySel        = document.getElementById('activity');
const startInput         = document.getElementById('started_on');
const dueInput           = document.getElementById('due_date');
const statusSel          = document.getElementById('status');
const compOnSection      = document.getElementById('completedOnSection');
const postProcSection    = document.getElementById('postProcessingSection');
const labRefSection      = document.getElementById('labRefSection');
const skuSection         = document.getElementById('skuSection');
const transferSection    = document.getElementById('transferSection');
const skuTableBody       = document.querySelector('#skuTable tbody');
const transferTableBody  = document.querySelector('#transferTable tbody');
const homeIcon           = document.getElementById('homeIcon');
const dialogOverlay      = document.getElementById('dialogOverlay');
const dialogMessage      = document.getElementById('dialogMessage');
const btnYes             = document.getElementById('btnYes');
const btnNo              = document.getElementById('btnNo');
const btnOk              = document.getElementById('btnOk');

let lastDurations    = {};
let currentItemSkus  = [];
let currentUserEmail = null;
let dirty            = false;

// packaging activities
const skuActivities = [
  'bottling',
  'bottling and labelling',
  'bottling, labelling and cartoning',
  'capsule monocarton packing'
];

// ── Modal helpers ──
function showAlert(msg) {
  return new Promise(res => {
    dialogMessage.textContent = msg;
    btnYes.style.display = 'none';
    btnNo.style.display  = 'none';
    btnOk.style.display  = 'inline-block';
    dialogOverlay.style.display = 'flex';
    btnOk.onclick = () => { dialogOverlay.style.display = 'none'; res(); };
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
    btnNo .onclick = () => { dialogOverlay.style.display = 'none'; res(false); };
  });
}

// ── Populate helpers ──
function populate(sel, rows, vKey, tKey, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    rows.map(r => `<option value="${r[vKey]}">${r[tKey]}</option>`).join('');
}
function populateDataList(dl, items, key) {
  dl.innerHTML = items.map(i =>
    `<option value="${i[key]}" style="font-weight:normal">`
  ).join('');
}

// ── Due date skipping Sundays ──
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
  const act = activitySel.value,
        st  = startInput.value;
  dueInput.value = (act && st && lastDurations[act]!=null)
    ? computeDueFrom(st, Number(lastDurations[act]))
    : '';
}

// ── Render SKU table ──
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

// ── Render Transfer table ──
async function renderTransferTable() {
  transferTableBody.innerHTML = '';
  if (!batchSel.value) return;
  const { data, error } = await supabase
    .from('bottled_stock_on_hand')
    .select('sku_id,pack_size,uom,on_hand')
    .eq('batch_number', batchSel.value);
  if (error) return console.error(error);
  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.pack_size}</td>
      <td>${r.uom}</td>
      <td>${r.on_hand}</td>
      <td><input type="number" min="0" max="${r.on_hand}" data-sku-id="${r.sku_id}"></td>`;
    transferTableBody.append(tr);
  });
}

// ── Show/hide sections ──
function updateSections() {
  const actNorm = (activitySel.value||'').trim().toLowerCase();
  const done    = statusSel.value === 'Done';

  compOnSection.style.display      = done ? 'block' : 'none';
  postProcSection.style.display    = (done && !skuActivities.includes(actNorm) && actNorm!=='transfer to fg store' && actNorm!=='finished goods quality assessment')
                                     ? 'block' : 'none';
  labRefSection.style.display      = (done && actNorm==='finished goods quality assessment') ? 'block':'none';
  skuSection.style.display         = (done && skuActivities.includes(actNorm))            ? 'block':'none';
  transferSection.style.display    = (done && actNorm==='transfer to fg store')           ? 'block':'none';

  if (done && skuActivities.includes(actNorm))   renderSkuTable();
  if (done && actNorm==='transfer to fg store')  renderTransferTable();
}

// ── Load activities for section/sub/area ──
async function loadActivities() {
  activitySel.disabled = true;
  activitySel.innerHTML = '<option>-- Select Activity --</option>';
  let q = supabase.from('activities').select('activity_name,duration_days');
  if      (areaSel.value)    q = q.eq('area_id', areaSel.value);
  else if (subSel.value)     q = q.eq('sub_section_id', subSel.value).is('area_id', null);
  else if (sectionSel.value) q = q.eq('section_id', sectionSel.value).is('sub_section_id', null).is('area_id', null);
  else return;

  const { data, error } = await q.order('activity_name');
  if (error) return console.error(error);
  lastDurations = {};
  data.forEach(r => lastDurations[r.activity_name] = r.duration_days);
  if (data.length) {
    populate(activitySel, data, 'activity_name','activity_name','-- Select Activity --');
    activitySel.disabled = false;
  }
}

// ── Carry-forward from URL ──
function applyCarryForward() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('prefill_item')) {
    itemInput.value = p.get('prefill_item');
    itemInput.dispatchEvent(new Event('change'));
  }
  if (p.has('prefill_bn')) {
    const bn = p.get('prefill_bn');
    const iv = setInterval(() => {
      if (!batchSel.disabled && Array.from(batchSel.options).some(o=>o.value===bn)) {
        batchSel.value = bn;
        batchSel.dispatchEvent(new Event('change'));
        clearInterval(iv);
      }
    }, 100);
  }
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
  // get user
  const { data:{user} } = await supabase.auth.getUser();
  if (user) currentUserEmail = user.email;

  // Home nav
  homeIcon.onclick = async ()=>{
    if (dirty && !await askConfirm('Unsaved changes—leave?')) return;
    location.href='index.html';
  };

  // disable downstream
  [ subSel, areaSel, plantSel, batchSel, activitySel ].forEach(el=>{
    el.disabled=true; el.innerHTML='';
  });

  // Load Sections
  {
    const { data, error } = await supabase.from('sections')
      .select('id,section_name').order('section_name');
    if (!error) populate(sectionSel,data,'id','section_name','-- Select Section --');
  }

  // Load Items
  {
    const { data, error } = await supabase.from('bmr_details')
      .select('item').order('item');
    if (!error) {
      const uniq = [...new Set(data.map(r=>r.item))].map(i=>({item:i}));
      populateDataList(itemList,uniq,'item');
    }
  }

  applyCarryForward();
  updateSections();
});

// ── Cascading selects ──
sectionSel.addEventListener('change', async ()=>{
  [ subSel, areaSel, plantSel, activitySel ].forEach(el=>{
    el.disabled=true; el.innerHTML='';
  });
  await loadActivities();
  if (!sectionSel.value) return;
  const { data, error } = await supabase.from('subsections')
    .select('id,subsection_name').eq('section_id',sectionSel.value).order('subsection_name');
  if (!error && data.length) {
    populate(subSel,data,'id','subsection_name','-- Select Sub-section --');
    subSel.disabled=false;
  }
});

subSel.addEventListener('change', async ()=>{
  [ areaSel, plantSel, activitySel ].forEach(el=>{
    el.disabled=true; el.innerHTML='';
  });
  await loadActivities();
  if (!subSel.value) return;
  const { data, error } = await supabase.from('areas')
    .select('id,area_name')
    .eq('section_id',sectionSel.value)
    .eq('subsection_id',subSel.value)
    .order('area_name');
  if (!error && data.length) {
    populate(areaSel,data,'id','area_name','-- Select Area --');
    areaSel.disabled=false;
  }
});

areaSel.addEventListener('change', async ()=>{
  [ plantSel, activitySel ].forEach(el=>{
    el.disabled=true; el.innerHTML='';
  });
  await loadActivities();
  if (!areaSel.value) return;
  const { data, error } = await supabase.from('plant_machinery')
    .select('id,plant_name').eq('area_id',areaSel.value).order('plant_name');
  if (!error && data.length) {
    populate(plantSel,data,'id','plant_name','-- Select Plant/Machinery --');
    plantSel.disabled=false;
  }
});

// ── Item → Batch + SKUs ──
itemInput.addEventListener('change', async ()=>{
  if (!Array.from(itemList.options).map(o=>o.value).includes(itemInput.value)) {
    await showAlert('Please select a valid item.');
    itemInput.value=''; batchSel.disabled=true; batchSel.innerHTML='';
    currentItemSkus=[]; updateSections();
    return;
  }
  // batches
  const { data:bns } = await supabase.from('bmr_details')
    .select('bn').eq('item',itemInput.value).order('bn');
  const uniq = [...new Set(bns.map(r=>r.bn))].map(bn=>({bn}));
  populate(batchSel,uniq,'bn','bn','-- Select Batch Number --');
  batchSel.disabled = !uniq.length;

  // SKUs
  const { data:prod } = await supabase.from('products')
    .select('id').eq('item',itemInput.value).single();
  if (prod) {
    const { data:skus } = await supabase.from('product_skus')
      .select('id,pack_size,uom')
      .eq('product_id',prod.id)
      .eq('is_active',true)
      .order('pack_size');
    currentItemSkus = skus||[];
  } else {
    currentItemSkus = [];
  }
  updateSections();
});

batchSel.addEventListener('change', async ()=>{
  sizeInput.value=''; uomInput.value='';
  if (!itemInput.value||!batchSel.value) return;
  const { data } = await supabase.from('bmr_details')
    .select('batch_size,uom')
    .eq('item',itemInput.value)
    .eq('bn',batchSel.value)
    .limit(1);
  if (data&&data.length) {
    sizeInput.value = data[0].batch_size;
    uomInput.value  = data[0].uom;
  }
  updateSections();
});

// ── Activity change + QA check ──
activitySel.addEventListener('change', async ()=>{
  const actNorm = (activitySel.value||'').trim().toLowerCase();
  if (skuActivities.includes(actNorm) && itemInput.value && batchSel.value) {
    const { data:qa } = await supabase.from('daily_work_log')
      .select('id')
      .eq('item',itemInput.value)
      .eq('batch_number',batchSel.value)
      .eq('activity','Finished Goods Quality Assessment')
      .eq('status','Done')
      .limit(1);
    if (!qa || qa.length===0) {
      await showAlert(
        'Finished Goods Quality Assessment not completed for this batch.\n' +
        'Please complete QA first.'
      );
      activitySel.value = '';
    }
  }
  updateDueDate();
  updateSections();
});

// ── Status + Start listeners ──
statusSel.addEventListener('change', ()=>{
  if (statusSel.value==='Done'){
    const c = form.querySelector('[name="completed_on"]');
    if (!c.value) c.value = new Date().toISOString().slice(0,10);
  }
  updateSections();
});
startInput.addEventListener('change', updateDueDate);

// ── Track dirty ──
form.addEventListener('input', ()=>{ dirty=true; });

// ── Submit ──
form.addEventListener('submit', async e=>{
  e.preventDefault(); dirty=false;

  // build row
  const row = {
    log_date:            form.log_date.value,
    section_id:          sectionSel.value,
    subsection_id:       subSel.value           || null,
    area_id:             areaSel.value          || null,
    plant_id:            plantSel.value         || null,
    item:                itemInput.value,
    batch_number:        batchSel.value,
    batch_size:          sizeInput.value        || null,
    batch_uom:           uomInput.value         || null,
    activity:            activitySel.value,
    juice_or_decoction:  form.juice_or_decoction?.value || null,
    specify:             form.specify?.value          || null,
    count_of_saravam:    form.count_of_saravam?.value || null,
    fuel:                form.fuel?.value            || null,
    fuel_under:          form.fuel_under?.value      || null,
    fuel_over:           form.fuel_over?.value       || null,
    started_on:          form.started_on.value  || null,
    due_date:            form.due_date.value    || null,
    status:              form.status.value,
    completed_on:        form.completed_on?.value || null,
    qty_after_process:   null,
    qty_uom:             null,
    sku_breakdown:       null,
    lab_ref_number:      form.lab_ref_number?.value || null,
    remarks:             form.remarks?.value         || null,
    uploaded_by:         currentUserEmail
  };

  // SKU breakdown if packaging+Done
  const actNorm = row.activity.trim().toLowerCase();
  if (row.status==='Done' && skuActivities.includes(actNorm)) {
    const parts = Array.from(skuTableBody.querySelectorAll('input')).map(i=>{
      const cnt = Number(i.value);
      if (!cnt) return null;
      const sku = currentItemSkus.find(s=>s.id==i.dataset.skuId);
      return `${sku.pack_size} ${sku.uom} x ${cnt}`;
    }).filter(p=>p);
    row.sku_breakdown = parts.join('; ');
    row.qty_uom       = 'Nos';
  }

  // Insert daily_work_log
  const { data: inserted, error: insErr } = await supabase.from('daily_work_log')
    .insert([row])
    .select('id')
    .single();
  if (insErr) {
    console.error('Insert error:', insErr);
    return showAlert('Error saving log; see console.');
  }
  const newId = inserted.id;

  // Packaging_events + event_skus if needed
  if (row.status==='Done' && (skuActivities.includes(actNorm) || actNorm==='transfer to fg store')) {
    const { data: pe, error: peErr } = await supabase.from('packaging_events')
      .insert({ work_log_id:newId, event_type:row.activity })
      .select('id')
      .single();
    if (peErr) console.error('PE insert error', peErr);
    else {
      const rows = [];
      if (skuActivities.includes(actNorm)) {
        skuTableBody.querySelectorAll('input').forEach(i=>{
          const cnt = Number(i.value);
          if (cnt>0) rows.push({
            packaging_event_id: pe.id,
            sku_id: +i.dataset.skuId,
            count: cnt
          });
        });
      } else {
        transferTableBody.querySelectorAll('input').forEach(i=>{
          const cnt = Number(i.value);
          if (cnt>0) rows.push({
            packaging_event_id: pe.id,
            sku_id: +i.dataset.skuId,
            count: cnt
          });
        });
      }
      if (rows.length) {
        const { error: esErr } = await supabase.from('event_skus').insert(rows);
        if (esErr) console.error('ES insert error', esErr);
      }
    }
  }

  // Success
  await showAlert('Log saved successfully!');
  form.reset();
  skuTableBody.innerHTML      = '';
  transferTableBody.innerHTML = '';
  ['completedOnSection',
   'postProcessingSection',
   'labRefSection',
   'skuSection',
   'transferSection']
    .forEach(id=>document.getElementById(id).style.display='none');
});