import { supabase } from './supabaseClient.js';

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

const parseDMY = s => {
  const [d, m, y] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDMY = d =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

const attachMask = el => {
  el.addEventListener('input', () => {
    let v = el.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 2) v = v.slice(0, 2) + '-' + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    el.value = v;
  });
};

const plantMap = {};
const skuActivities = [
  'bottling',
  'bottling and labelling',
  'bottling, labelling and cartoning',
  'capsule monocarton packing',
  'monocarton packing',
  'monocarton packing and cartoning'
];

const $ = sel => document.querySelector(sel);

let homeBtn, bodyTbl;
let sLogDate, sSection, sSub, sArea, sItem, sBN, sOverdue, clearBtn;
let doneModal, doneForm, doneCompletedOn, doneQtySection, doneLabRefSec;
let doneSkuSec, doneSkuBody, doneTransSec, doneTransBody;
let doneCancel, doneJust, doneNew;
let confirmModal, confirmText, confirmYes, confirmNo;

function show(el) {
  el.style.display = 'flex';
}

function hide(el) {
  el.style.display = 'none';
}

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

function populate(sel, rows, vKey, tKey, ph) {
  sel.innerHTML =
    `<option value="">${ph}</option>` +
    rows.map(r => `<option value="${r[vKey]}">${r[tKey]}</option>`).join('');
}

function resetAreaBN() {
  populate(sArea, [], '', '', 'Area');
  sArea.disabled = true;
  resetBN();
}

function resetBN() {
  sBN.innerHTML = '<option value="">BN</option>';
  sBN.disabled = true;
}

async function configureDoneModal(activity, item, batch) {
  const act = activity.toLowerCase().trim();
  doneQtySection.style.display =
    doneLabRefSec.style.display =
    doneSkuSec.style.display =
    doneTransSec.style.display =
      'none';
  doneSkuBody.innerHTML = '';
  doneTransBody.innerHTML = '';

  if (act === 'finished goods quality assessment') {
    doneLabRefSec.style.display = 'flex';
  } else if (skuActivities.includes(act)) {
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
        doneSkuBody.insertAdjacentHTML(
          'beforeend',
          `<tr>
             <td>${s.pack_size}</td>
             <td>${s.uom}</td>
             <td>
               <input type="number" min="0"
                      data-sku-id="${s.id}"
                      data-pack-size="${s.pack_size}"
                      data-uom="${s.uom}">
             </td>
           </tr>`
        );
      });
    }
  } else if (act === 'transfer to fg store') {
    doneTransSec.style.display = 'block';
    const { data } = await supabase
      .from('bottled_stock_on_hand')
      .select('sku_id,pack_size,uom,on_hand')
      .eq('batch_number', batch);
    data.forEach(r => {
      doneTransBody.insertAdjacentHTML(
        'beforeend',
        `<tr>
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
         </tr>`
      );
    });
  } else {
    doneQtySection.style.display = 'flex';
    $('#doneUOM').value = '';
  }
}

async function promptDone(activity, item, batch) {
  doneForm.reset();
  doneCompletedOn.value = formatDMY(new Date());
  await configureDoneModal(activity, item, batch);
  show(doneModal);
  return new Promise(res => {
    doneCancel.onclick = () => {
      hide(doneModal);
      res({ choice: 'cancel' });
    };
    const finish = choice => {
      const actL = activity.toLowerCase().trim();
      let rows = [];
      let qty = null;
      let uom = null;
      let lab = null;
      if (actL === 'finished goods quality assessment') {
        lab = $('#doneLabRef').value.trim();
      } else if (skuActivities.includes(actL)) {
        rows = [...doneSkuBody.querySelectorAll('input')]
          .map(i => ({
            skuId: +i.dataset.skuId,
            count: +i.value,
            packSize: i.dataset.packSize,
            uom: i.dataset.uom
          }))
          .filter(r => r.count > 0);
      } else if (actL === 'transfer to fg store') {
        rows = [...doneTransBody.querySelectorAll('input')]
          .map(i => ({
            skuId: +i.dataset.skuId,
            count: +i.value,
            packSize: i.dataset.packSize,
            uom: i.dataset.uom
          }))
          .filter(r => r.count > 0);
      } else {
        qty = +$('#doneQty').value || null;
        uom = $('#doneUOM').value || null;
      }
      hide(doneModal);
      res({ choice, rows, completedOn: doneCompletedOn.value, qty, uom, labRef: lab });
    };
    doneJust.onclick = () => finish('just');
    doneNew.onclick = () => finish('new');
  });
}

async function saveStatus(id, sel) {
  const newStat = sel.value;
  const { act, item, bn, prevStatus } = sel.dataset;
  if (newStat === 'Done') {
    const r = await promptDone(act, item, bn);
    if (r.choice === 'cancel') {
      sel.value = prevStatus;
      return;
    }
    const [d, m, y] = r.completedOn.split('-').map(Number);
    const isoDate = new Date(y, m - 1, d).toISOString().slice(0, 10);
    const upd = {
      status: 'Done',
      completed_on: isoDate,
      qty_after_process: null,
      qty_uom: null,
      sku_breakdown: null,
      lab_ref_number: null
    };
    const actL = act.toLowerCase().trim();
    if (actL === 'finished goods quality assessment') {
      upd.lab_ref_number = r.labRef;
    } else if (
      skuActivities.includes(actL) ||
      actL === 'transfer to fg store'
    ) {
      upd.sku_breakdown = r.rows
        .map(x => `${x.packSize} ${x.uom} x ${x.count}`)
        .join('; ');
    } else {
      upd.qty_after_process = r.qty;
      upd.qty_uom = r.uom;
    }
    const { error: updErr } = await supabase
      .from('daily_work_log')
      .update(upd)
      .eq('id', id);
    if (updErr) {
      console.error('Update failed:', updErr);
      sel.value = prevStatus;
      return;
    }
    if (
      skuActivities.includes(actL) ||
      actL === 'transfer to fg store'
    ) {
      const { data: pe } = await supabase
        .from('packaging_events')
        .upsert(
          { work_log_id: id, event_type: act },
          { onConflict: 'work_log_id' }
        )
        .select('id')
        .single();
      if (pe) {
        await supabase
          .from('event_skus')
          .delete()
          .eq('packaging_event_id', pe.id);
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
    if (r.choice === 'new') {
      window.location.href = `add-log-entry.html?item=${encodeURIComponent(
        item
      )}&bn=${encodeURIComponent(bn)}`;
      return;
    }
  } else {
    await clearPackaging(id);
    const { error: updErr } = await supabase
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
    if (updErr) {
      console.error('Update failed:', updErr);
    }
  }
  loadStatus();
}

async function loadStatus() {
  // 1. Clear existing rows
  bodyTbl.replaceChildren();

  // 2. Fetch from daily_work_log, including batch_size & batch_uom
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
      activity,
      status,
      due_date
    `)
    .in('status', ['Doing','On Hold']);

  // 3. Apply filters
  if (sLogDate.value) {
    const [dd, mm, yyyy] = sLogDate.value
      .split('-')
      .map(n => n.padStart(2, '0'));
    q = q.eq('log_date', `${yyyy}-${mm}-${dd}`);
  }
  if (sSection.value) q = q.eq('section_id',    sSection.value);
  if (sSub.value)     q = q.eq('subsection_id', sSub.value);
  if (sArea.value)    q = q.eq('area_id',       sArea.value);
  if (sItem.value)    q = q.eq('item',          sItem.value);
  if (sBN.value)      q = q.eq('batch_number',  sBN.value);
  if (sOverdue.checked) {
    const today = new Date().toISOString().slice(0,10);
    q = q.lt('due_date', today);
  }

  // 4. Execute
  const { data, error } = await q;
  if (error) {
    console.error('loadStatus error:', error);
    return;
  }

  // 5. Sort: date → item → bn → plant
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

  // 6. Render rows (now has r.batch_size & r.batch_uom)
  data.forEach(r => {
    bodyTbl.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${new Date(r.log_date).toLocaleDateString('en-GB')}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${r.batch_size  ?? ''}</td>
        <td>${r.batch_uom   ?? ''}</td>
        <td>${plantMap[r.plant_id]||''}</td>
        <td>${r.activity}</td>
        <td>
          <select class="statSel"
                  data-id="${r.id}"
                  data-act="${r.activity}"
                  data-item="${r.item}"
                  data-bn="${r.batch_number}"
                  data-prev-status="${r.status}">
            <option${r.status==='Doing'   ? ' selected' : ''}>Doing</option>
            <option${r.status==='On Hold' ? ' selected' : ''}>On Hold</option>
            <option${r.status==='Done'    ? ' selected' : ''}>Done</option>
          </select>
        </td>
        <td>
          <a href="#" class="save-link" data-id="${r.id}">Save</a>
        </td>
      </tr>`);
  });

  // 7. Re‑attach Save handlers
  document.querySelectorAll('.save-link').forEach(a => {
    const sel = document.querySelector(`.statSel[data-id="${a.dataset.id}"]`);
    a.onclick = e => { e.preventDefault(); saveStatus(a.dataset.id, sel); };
  });
}

async function init() {
  homeBtn = $('#homeBtn');
  bodyTbl = $('#statusBody');
  sLogDate = $('#sLogDate');
  sSection = $('#sSection');
  sSub = $('#sSub');
  sArea = $('#sArea');
  sItem = $('#sItem');
  sBN = $('#sBN');
  sOverdue = $('#sOverdue');
  clearBtn = $('#clearStatus');

  doneModal = $('#doneModal');
  doneForm = $('#doneForm');
  doneCompletedOn = $('#doneCompletedOn');
  doneQtySection = $('#doneQtySection');
  doneLabRefSec = $('#doneLabRefSection');
  doneSkuSec = $('#doneSkuSection');
  doneSkuBody = $('#doneSkuTable tbody');
  doneTransSec = $('#doneTransSection');
  doneTransBody = $('#doneTransTable tbody');
  doneCancel = $('#doneCancel');
  doneJust = $('#doneJust');
  doneNew = $('#doneNew');

  confirmModal = $('#confirmModal');
  confirmText = $('#confirmText');
  confirmYes = $('#confirmYes');
  confirmNo = $('#confirmNo');

  const { data: pl, error: plErr } = await supabase
    .from('plant_machinery')
    .select('id,plant_name');
  if (!plErr) {
    pl.forEach(p => {
      plantMap[p.id] = p.plant_name;
    });
  }

  const { data: secs, error: secsErr } = await supabase
    .from('sections')
    .select('id,section_name')
    .order('section_name');
  if (!secsErr) {
    populate(sSection, secs, 'id', 'section_name', 'Section');
  }

  const { data: itemsRaw, error: itemsErr } = await supabase
    .from('bmr_details')
    .select('item')
    .order('item');
  if (!itemsErr) {
    const uniqueItems = Array.from(new Set(itemsRaw.map(r => r.item))).map(
      i => ({ item: i })
    );
    populate(sItem, uniqueItems, 'item', 'item', 'Item');
  }

  homeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

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
    [sSection, sSub, sArea, sItem, sBN].forEach(x => {
      x.value = '';
    });
    [sSub, sArea, sBN].forEach(x => {
      x.disabled = true;
    });
    sOverdue.checked = false;
    sLogDate.value = '';
    loadStatus();
  });

  attachMask(sLogDate);
  flatpickr(sLogDate, fpBase);

  attachMask(doneCompletedOn);
  flatpickr(doneCompletedOn, { ...fpBase, maxDate: 'today' });
  doneCompletedOn.addEventListener('blur', () => {
    const d = parseDMY(doneCompletedOn.value);
    const today = new Date();
    if (+d > +today) {
      doneCompletedOn.value = formatDMY(today);
    }
  });

  await loadStatus();
}

document.addEventListener('DOMContentLoaded', init);