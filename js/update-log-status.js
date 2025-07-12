// js/update-log-status.js

import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // ───────── Element refs ─────────────────────────────────────────
  const homeBtn     = document.getElementById('homeBtn');
  const statusBody  = document.getElementById('statusBody');

  const sSection    = document.getElementById('sSection');
  const sSub        = document.getElementById('sSub');
  const sArea       = document.getElementById('sArea');
  const sItem       = document.getElementById('sItem');
  const sBN         = document.getElementById('sBN');
  const sOverdue    = document.getElementById('sOverdue');
  const clearStatus = document.getElementById('clearStatus');

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

  // Confirm-modal refs
  const confirmModal = document.getElementById('confirmModal');
  const confirmText  = document.getElementById('confirmText');
  const confirmYes   = document.getElementById('confirmYes');
  const confirmNo    = document.getElementById('confirmNo');

  // packaging-activity keys
  const skuActivities = [
    'bottling',
    'bottling and labelling',
    'bottling, labelling and cartoning',
    'capsule monocarton packing',
    'monocarton packing',
    'monocarton packing and cartoning'
  ];

  // map plant_id → plant_name
  const plantMap = {};

  // ───── Utility ─────────────────────────────────────────────────
  function showModal(m) { m.style.display = 'flex'; }
  function hideModal(m) { m.style.display = ''; }

  function askConfirm(msg) {
    confirmText.textContent = msg;
    showModal(confirmModal);
    return new Promise(res => {
      confirmYes.onclick = () => { hideModal(confirmModal); res(true); };
      confirmNo.onclick  = () => { hideModal(confirmModal); res(false); };
    });
  }

  async function clearPackaging(logId) {
    const { data: evts } = await supabase
      .from('packaging_events')
      .select('id')
      .eq('work_log_id', logId);
    const ids = (evts || []).map(e => e.id);
    if (ids.length) {
      await supabase.from('event_skus').delete().in('packaging_event_id', ids);
      await supabase.from('packaging_events').delete().in('id', ids);
    }
  }

  function populate(sel, rows, vKey, tKey, placeholder) {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    (rows || []).forEach(r => {
      const o = document.createElement('option');
      o.value       = r[vKey];
      o.textContent = r[tKey];
      sel.append(o);
    });
  }

  // ───── Load all plant-machinery into plantMap ─────────────────
  async function loadPlants() {
    const { data: plants, error } = await supabase
      .from('plant_machinery')
      .select('id,plant_name');
    if (!error && plants) {
      plants.forEach(p => plantMap[p.id] = p.plant_name);
    }
  }

  // ───── Filters cascading ───────────────────────────────────────
  sSection.onchange = async () => {
    if (!sSection.value) {
      populate(sSub, [], '', '', 'Sub-section');
      sSub.disabled = true;
    } else {
      const { data: subs } = await supabase
        .from('subsections').select('id,subsection_name')
        .eq('section_id', sSection.value)
        .order('subsection_name');
      populate(sSub, subs, 'id','subsection_name','Sub-section');
      sSub.disabled = false;
    }
    populate(sArea, [], '', '', 'Area');  sArea.disabled = true;
    sBN.innerHTML = '<option value="">BN</option>';          sBN.disabled = true;
    await loadStatus();
  };

  sSub.onchange = async () => {
    if (!sSub.value) {
      populate(sArea, [], '', '', 'Area');
      sArea.disabled = true;
    } else {
      const { data: areas } = await supabase
        .from('areas').select('id,area_name')
        .eq('section_id',    sSection.value)
        .eq('subsection_id', sSub.value)
        .order('area_name');
      populate(sArea, areas, 'id','area_name','Area');
      sArea.disabled = false;
    }
    sBN.innerHTML = '<option value="">BN</option>'; sBN.disabled = true;
    await loadStatus();
  };

  sArea.onchange = () => {
    sBN.innerHTML = '<option value="">BN</option>';
    sBN.disabled = true;
    loadStatus();
  };

  sItem.onchange = async () => {
    if (!sItem.value) {
      sBN.innerHTML = '<option value="">BN</option>';
      sBN.disabled = true;
    } else {
      const { data: bns } = await supabase
        .from('bmr_details').select('bn')
        .eq('item', sItem.value)
        .order('bn');
      const uniq = [...new Set((bns||[]).map(r=>r.bn))];
      sBN.innerHTML = '<option value="">BN</option>' +
        uniq.map(bn=>`<option value="${bn}">${bn}</option>`).join('');
      sBN.disabled = false;
    }
    await loadStatus();
  };

  sBN.onchange      = loadStatus;
  sOverdue.onchange = loadStatus;

  clearStatus.onclick = () => {
    [sSection,sSub,sArea,sItem,sBN].forEach(x=>x.value='');
    [sSub,sArea,sBN].forEach(x=>x.disabled=true);
    sOverdue.checked = false;
    loadStatus();
  };

  // ───── “Done?” modal ──────────────────────────────────────────
  async function configureDoneModal(activity,item,batch) {
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
      (data||[]).forEach(r => {
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
      document.getElementById('doneUOM').value = '';
    }
  }

  async function promptDone(activity,item,batch) {
    doneForm.reset();
    doneCompletedOn.value = new Date().toISOString().slice(0,10);
    await configureDoneModal(activity,item,batch);
    showModal(doneModal);

    return new Promise(resolve => {
      doneCancel.onclick = () => {
        hideModal(doneModal);
        resolve({ choice:'cancel' });
      };

      const finish = choice => {
        const act = activity.trim().toLowerCase();
        let rows = [], qty = null, uom = null, labRef = null;

        if (act === 'finished goods quality assessment') {
          labRef = doneForm.lab_ref_number.value.trim();
        }
        else if (skuActivities.includes(act)) {
          rows = Array.from(doneSkuBody.querySelectorAll('input')).map(i=>({
            skuId:+i.dataset.skuId,
            count:+i.value,
            packSize:i.dataset.packSize,
            uom:i.dataset.uom
          })).filter(r=>r.count>0);
        }
        else if (act === 'transfer to fg store') {
          rows = Array.from(doneTransBody.querySelectorAll('input')).map(i=>({
            skuId:+i.dataset.skuId,
            count:+i.value,
            packSize:i.dataset.packSize,
            uom:i.dataset.uom
          })).filter(r=>r.count>0);
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

  // ───── Save logic ────────────────────────────────────────────
  async function saveStatusUpdate(id, sel) {
    const activity = sel.dataset.act;
    const newStat  = sel.value;

    if (newStat === 'Done') {
      const r = await promptDone(activity, sel.dataset.item, sel.dataset.bn);
      if (r.choice === 'cancel') {
        sel.value = 'Doing';
        return;
      }

      const act = activity.trim().toLowerCase();
      const needsQty = !skuActivities.includes(act)
                     && act !== 'transfer to fg store'
                     && act !== 'finished goods quality assessment';

      if (needsQty && (!r.qty || !r.uom)) {
        const ok = await askConfirm(
          'You are proceeding without Qty After Process & UOM. Continue anyway?'
        );
        if (!ok) {
          sel.value = 'Doing';
          return;
        }
      }

      // build update object...
      const upd = {
        status:            'Done',
        completed_on:      r.completedOn,
        qty_after_process: null,
        qty_uom:           null,
        sku_breakdown:     null,
        lab_ref_number:    null
      };
      if (act === 'finished goods quality assessment') {
        upd.lab_ref_number = r.labRef;
      }
      else if (skuActivities.includes(act) || act === 'transfer to fg store') {
        upd.sku_breakdown = r.rows.map(x=>`${x.packSize} ${x.uom} x ${x.count}`).join('; ');
      }
      else {
        upd.qty_after_process = r.qty;
        upd.qty_uom           = r.uom;
      }

      await supabase
        .from('daily_work_log')
        .update(upd)
        .eq('id', id);

      // packaging_events upsert...
      if (skuActivities.includes(act) || act === 'transfer to fg store') {
        const { data: pe } = await supabase
          .from('packaging_events')
          .upsert({ work_log_id: id, event_type: activity }, { onConflict:'work_log_id' })
          .select('id').single();
        if (pe) {
          await supabase.from('event_skus').delete().eq('packaging_event_id', pe.id);
          if (r.rows.length) {
            await supabase.from('event_skus').insert(
              r.rows.map(x=>({
                packaging_event_id: pe.id,
                sku_id:             x.skuId,
                count:              x.count
              }))
            );
          }
        }
      }

      if (r.choice === 'new') {
        window.location.href =
          `add-log-entry.html?item=${encodeURIComponent(sel.dataset.item)}&bn=${encodeURIComponent(sel.dataset.bn)}`;
        return;
      }
    } else {
      // clear done data
      await clearPackaging(id);
      await supabase
        .from('daily_work_log')
        .update({
          status:            newStat,
          completed_on:      null,
          qty_after_process: null,
          qty_uom:           null,
          sku_breakdown:     null,
          lab_ref_number:    null
        })
        .eq('id', id);
    }

    loadStatus();
  }

  // ───── Load & render table ────────────────────────────────────
  async function loadStatus() {
    statusBody.innerHTML = '';
    let q = supabase
      .from('daily_work_log')
      .select('id,log_date,item,batch_number,plant_id,activity,status,due_date')
      .in('status', ['Doing','On Hold'])
      .order('log_date',{ascending:false});

    if (sSection.value) q = q.eq('section_id',    sSection.value);
    if (sSub.value)     q = q.eq('subsection_id', sSub.value);
    if (sArea.value)    q = q.eq('area_id',       sArea.value);
    if (sItem.value)    q = q.eq('item',          sItem.value);
    if (sBN.value)      q = q.eq('batch_number',  sBN.value);
    if (sOverdue.checked) {
      const today = new Date().toISOString().slice(0,10);
      q = q.lt('due_date', today);
    }

    const { data } = await q;
    (data||[]).forEach(r => {
      const plantName = plantMap[r.plant_id] || '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(r.log_date).toLocaleDateString('en-GB')}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${plantName}</td>
        <td>${r.activity}</td>
        <td>
          <select class="statSel"
                  data-id="${r.id}"
                  data-item="${r.item}"
                  data-bn="${r.batch_number}"
                  data-act="${r.activity}">
            <option${r.status==='Doing'   ? ' selected':''}>Doing</option>
            <option${r.status==='On Hold' ? ' selected':''}>On Hold</option>
            <option${r.status==='Done'    ? ' selected':''}>Done</option>
          </select>
        </td>
        <td><a href="#" class="save-link" data-id="${r.id}">Save</a></td>`;
      statusBody.append(tr);
    });

    document.querySelectorAll('.save-link').forEach(a => {
      const sel = document.querySelector(`.statSel[data-id="${a.dataset.id}"]`);
      a.onclick = e => { e.preventDefault(); saveStatusUpdate(a.dataset.id, sel); };
    });
  }

  // ───── Init ────────────────────────────────────────────────────
  async function initStatus() {
    await loadPlants();

    // Sections → Sub
    const { data: secs } = await supabase
      .from('sections').select('id,section_name').order('section_name');
    populate(sSection, secs,'id','section_name','Section');
    [sSub,sArea,sBN].forEach(x=>x.disabled=true);

    // Items → Item
    const { data: items } = await supabase
      .from('bmr_details').select('item',{distinct:true}).order('item');
    populate(sItem, items,'item','item','Item');

    homeBtn.onclick = () => location.href='index.html';

    await loadStatus();
  }

  initStatus();
});