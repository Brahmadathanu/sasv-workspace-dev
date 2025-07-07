// js/log-edit.js
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // ─── Refs ──────────────────────────────────────────────────────────
  const homeBtn        = document.getElementById('homeBtn');
  const modeStatus     = document.getElementById('modeStatus');
  const modeFull       = document.getElementById('modeFull');
  const statusFilters  = document.getElementById('statusFilters');
  const panelStatus    = document.getElementById('panelStatus');
  const statusBody     = document.getElementById('statusBody');
  const fullFilters    = document.getElementById('fullFilters');
  const panelFull      = document.getElementById('panelFull');
  const fullBody       = document.getElementById('fullBody');

  const sSection       = document.getElementById('sSection');
  const sSub           = document.getElementById('sSub');
  const sArea          = document.getElementById('sArea');
  const sItem          = document.getElementById('sItem');
  const sBN            = document.getElementById('sBN');
  const clearStatus    = document.getElementById('clearStatus');

  const fSection       = document.getElementById('fSection');
  const fSub           = document.getElementById('fSub');
  const fArea          = document.getElementById('fArea');
  const fItem          = document.getElementById('fItem');
  const fBN            = document.getElementById('fBN');
  const clearFull      = document.getElementById('clearFull');

  const doneModal      = document.getElementById('doneModal');
  const doneForm       = document.getElementById('doneForm');
  const doneCompletedOn= document.getElementById('doneCompletedOn');
  const doneQtySection = document.getElementById('doneQtySection');
  const doneQty        = document.getElementById('doneQty');
  const doneUOM        = document.getElementById('doneUOM');
  const doneSkuSection = document.getElementById('doneSkuSection');
  const doneSkuBody    = document.querySelector('#doneSkuTable tbody');
  const doneTransSection = document.getElementById('doneTransSection');
  const doneTransBody  = document.querySelector('#doneTransTable tbody');
  const doneCancel     = document.getElementById('doneCancel');
  const doneJust       = document.getElementById('doneJust');
  const doneNew        = document.getElementById('doneNew');

  const editModal      = document.getElementById('editModal');
  const editSuccess    = document.getElementById('editSuccess');
  const editForm       = document.getElementById('editForm');
  const cancelEdit     = document.getElementById('cancelEdit');

  const e_id           = document.getElementById('e_id');
  const e_section      = document.getElementById('e_section');
  const e_sub          = document.getElementById('e_sub');
  const e_area         = document.getElementById('e_area');
  const e_plant        = document.getElementById('e_plant');
  const e_item         = document.getElementById('e_item');
  const e_bn           = document.getElementById('e_bn');
  const e_size         = document.getElementById('e_size');
  const e_uom          = document.getElementById('e_uom');
  const e_activity     = document.getElementById('e_activity');
  const juiceS         = document.getElementById('juiceS');
  const e_juice        = document.getElementById('e_juice');
  const e_specify      = document.getElementById('e_specify');
  const putamS         = document.getElementById('putamS');
  const e_count        = document.getElementById('e_count');
  const e_fuel         = document.getElementById('e_fuel');
  const e_fuel_under   = document.getElementById('e_fuel_under');
  const e_fuel_over    = document.getElementById('e_fuel_over');
  const e_start        = document.getElementById('e_start');
  const e_due          = document.getElementById('e_due');
  const e_comp         = document.getElementById('e_comp');
  const e_status       = document.getElementById('e_status');

  const editQtySection = document.getElementById('editQtySection');
  const e_qty          = document.getElementById('e_qty');
  const e_qty_uom      = document.getElementById('e_qty_uom');

  const labRefSection  = document.getElementById('labRefSection');
  const e_lab_ref      = document.getElementById('e_lab_ref');

  const editSkuSection = document.getElementById('editSkuSection');
  const editSkuBody    = document.querySelector('#editSkuTable tbody');

  const editTransSection = document.getElementById('editTransSection');
  const editTransBody  = document.querySelector('#editTransTable tbody');

  const e_remarks      = document.getElementById('e_remarks');

  const confirmModal   = document.getElementById('confirmModal');
  const confirmText    = document.getElementById('confirmText');
  const confirmYes     = document.getElementById('confirmYes');
  const confirmNo      = document.getElementById('confirmNo');

  const skuActivities = [
    'bottling',
    'bottling and labelling',
    'bottling, labelling and cartoning',
    'capsule monocarton packing'
  ];

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function showModal(m){ m.style.display = 'flex'; }
  function hideModal(m){ m.style.display = 'none'; }

  function askConfirm(msg){
    confirmText.textContent = msg;
    showModal(confirmModal);
    return new Promise(res => {
      confirmYes.onclick = () => { hideModal(confirmModal); res(true); };
      confirmNo .onclick = () => { hideModal(confirmModal); res(false); };
    });
  }

  async function deleteEntry(id){
    // cascade delete packaging & skus
    const { data: evts } = await supabase
      .from('packaging_events')
      .select('id')
      .eq('work_log_id', id);

    const ids = (evts || []).map(e => e.id);
    if (ids.length) {
      await supabase
        .from('event_skus')
        .delete()
        .in('packaging_event_id', ids);
      await supabase
        .from('packaging_events')
        .delete()
        .in('id', ids);
    }
    await supabase
      .from('daily_work_log')
      .delete()
      .eq('id', id);
  }

  // ─── Prompt Done ─────────────────────────────────────────────────────────────
  async function promptDone(act, item, batch) {
    doneForm.reset();
    doneCompletedOn.value = new Date().toISOString().slice(0,10);
    doneQtySection.style.display   = 'flex';
    doneSkuSection.style.display   = 'none';
    doneTransSection.style.display = 'none';
    doneSkuBody.innerHTML          = '';
    doneTransBody.innerHTML        = '';

    if (skuActivities.includes(act)) {
      doneQtySection.style.display = 'none';
      doneSkuSection.style.display = 'block';
      const { data: prod } = await supabase
        .from('products')
        .select('id')
        .eq('item', item)
        .single();
      let skus = [];
      if (prod) {
        const { data } = await supabase
          .from('product_skus')
          .select('id,pack_size,uom')
          .eq('product_id', prod.id)
          .eq('is_active', true)
          .order('pack_size');
        skus = data || [];
      }
      skus.forEach(sku => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${sku.pack_size}</td>
          <td>${sku.uom}</td>
          <td><input type="number" min="0" data-sku-id="${sku.id}"></td>`;
        doneSkuBody.append(tr);
      });
    }
    else if (act === 'transfer to fg store') {
      doneQtySection.style.display   = 'none';
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
          <td><input type="number" min="0" max="${r.on_hand}" data-sku-id="${r.sku_id}"></td>`;
        doneTransBody.append(tr);
      });
    }

    showModal(doneModal);
    return new Promise(res => {
      doneCancel.onclick = () => { hideModal(doneModal); res({ choice: 'cancel' }); };
      doneJust.onclick   = () => {
        const rows = skuActivities.includes(act)
          ? Array.from(doneSkuBody.querySelectorAll('input'))
              .map(i => ({ sku_id: +i.dataset.skuId, count: +i.value }))
              .filter(r => r.count > 0)
          : Array.from(doneTransBody.querySelectorAll('input'))
              .map(i => ({ sku_id: +i.dataset.skuId, count: +i.value }))
              .filter(r => r.count > 0);

        hideModal(doneModal);
        res({
          choice:      'just',
          rows,
          completedOn: doneCompletedOn.value,
          qty:         +doneQty.value,
          uom:         doneUOM.value
        });
      };
      doneNew.onclick   = () => {
        const rows = skuActivities.includes(act)
          ? Array.from(doneSkuBody.querySelectorAll('input'))
              .map(i => ({ sku_id: +i.dataset.skuId, count: +i.value }))
              .filter(r => r.count > 0)
          : Array.from(doneTransBody.querySelectorAll('input'))
              .map(i => ({ sku_id: +i.dataset.skuId, count: +i.value }))
              .filter(r => r.count > 0);

        hideModal(doneModal);
        res({
          choice:      'new',
          rows,
          completedOn: doneCompletedOn.value,
          qty:         +doneQty.value,
          uom:         doneUOM.value
        });
      };
    });
  }

  // ─── STATUS MODE ───────────────────────────────────────────────────────────
  async function initStatus() {
    // populate sections
    const { data: secs } = await supabase
      .from('sections')
      .select('id,section_name')
      .order('section_name');
    populate(sSection, secs, 'id', 'section_name', 'Section');
    [sSub, sArea, sItem, sBN].forEach(el => { el.disabled = true; });

    // cascades
    sSection.onchange = async () => {
      if (!sSection.value) {
        populate(sSub, [], '', '', 'Sub-section');
        sSub.disabled = true;
      } else {
        const { data: subs } = await supabase
          .from('subsections')
          .select('id,subsection_name')
          .eq('section_id', sSection.value)
          .order('subsection_name');
        populate(sSub, subs, 'id', 'subsection_name', 'Sub-section');
        sSub.disabled = false;
      }
      [sArea, sBN].forEach(el => {
        populate(el, [], '', '', el === sArea ? 'Area' : 'BN');
        el.disabled = true;
      });
      await loadStatus();
    };
    sSub.onchange = async () => {
      if (!sSub.value) {
        populate(sArea, [], '', '', 'Area');
        sArea.disabled = true;
      } else {
        const { data: areas } = await supabase
          .from('areas')
          .select('id,area_name')
          .eq('section_id', sSection.value)
          .eq('subsection_id', sSub.value)
          .order('area_name');
        populate(sArea, areas, 'id', 'area_name', 'Area');
        sArea.disabled = false;
      }
      populate(sBN, [], '', '', 'BN');
      sBN.disabled = true;
      await loadStatus();
    };
    sArea.onchange = () => {
      populate(sBN, [], '', '', 'BN');
      sBN.disabled = true;
      loadStatus();
    };

    // item → BN
    const { data: items } = await supabase
      .from('bmr_details')
      .select('item', { distinct: true })
      .order('item');
    populate(sItem, items, 'item', 'item', 'Item');
    sItem.onchange = async () => {
      if (!sItem.value) {
        populate(sBN, [], '', '', 'BN');
        sBN.disabled = true;
      } else {
        const { data: bns } = await supabase
          .from('bmr_details')
          .select('bn')
          .eq('item', sItem.value)
          .order('bn');
        const uniq = [...new Set((bns||[]).map(r => r.bn))]
          .map(bn => ({ bn }));
        populate(sBN, uniq, 'bn', 'bn', 'BN');
        sBN.disabled = false;
      }
      await loadStatus();
    };

    clearStatus.onclick = () => {
      [sSection, sSub, sArea, sItem, sBN].forEach(x => x.value = '');
      [sSub, sArea, sBN].forEach(x => x.disabled = true);
      loadStatus();
    };

    await loadStatus();
  }

  async function loadStatus() {
    statusBody.innerHTML = '';
    let q = supabase
      .from('daily_work_log')
      .select('id,log_date,item,batch_number,activity,status')
      .in('status', ['Doing','On Hold'])
      .order('log_date', { ascending: false });

    if (sSection.value) q = q.eq('section_id', sSection.value);
    if (sSub.value)     q = q.eq('subsection_id', sSub.value);
    if (sArea.value)    q = q.eq('area_id', sArea.value);
    if (sItem.value)    q = q.eq('item', sItem.value);
    if (sBN.value)      q = q.eq('batch_number', sBN.value);

    const { data } = await q;
    (data || []).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(r.log_date).toLocaleDateString('en-GB')}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${r.activity}</td>
        <td>
          <select class="statSel"
                  data-id="${r.id}"
                  data-item="${r.item}"
                  data-bn="${r.batch_number}"
                  data-act="${r.activity.trim().toLowerCase()}">
            <option${r.status==='Doing'    ? ' selected':''}>Doing</option>
            <option${r.status==='On Hold' ? ' selected':''}>On Hold</option>
            <option${r.status==='Done'     ? ' selected':''}>Done</option>
          </select>
        </td>
        <td><a href="#" class="save-link" data-id="${r.id}">Save</a></td>`;
      statusBody.append(tr);
    });

    document.querySelectorAll('.save-link').forEach(a => {
      a.onclick = async e => {
        e.preventDefault();
        const id   = a.dataset.id;
        const sel  = document.querySelector(`.statSel[data-id="${id}"]`);
        const ns   = sel.value;
        const act  = sel.dataset.act;
        const item = sel.dataset.item;
        const bn   = sel.dataset.bn;

        if (ns === 'Done') {
          const result = await promptDone(act, item, bn);
          if (result.choice === 'cancel') {
            sel.value = 'Doing';
            return;
          }

          const upd = {
            status:       'Done',
            completed_on: result.completedOn,
            qty_after_process: null,
            qty_uom:           null,
            sku_breakdown:     null
          };

          if (skuActivities.includes(act)) {
            upd.sku_breakdown = result.rows
              .map(r => `${r.sku_id} x ${r.count}`)
              .join('; ');
          }

          await supabase
            .from('daily_work_log')
            .update(upd)
            .eq('id', id);

          if (skuActivities.includes(act)) {
            const { data: pe } = await supabase
              .from('packaging_events')
              .upsert({ work_log_id: id, event_type: sel.dataset.act }, { onConflict: 'work_log_id' })
              .select('id')
              .single();

            await supabase
              .from('event_skus')
              .delete()
              .eq('packaging_event_id', pe.id);

            const rows = (result.rows || []).map(r => ({
              packaging_event_id: pe.id,
              sku_id: r.sku_id,
              count: r.count
            }));
            if (rows.length) {
              await supabase.from('event_skus').insert(rows);
            }
          }

          if (result.choice === 'new') {
            window.location.href =
              `add-log-entry.html?prefill_item=${encodeURIComponent(item)}&prefill_bn=${encodeURIComponent(bn)}`;
            return;
          }
        } else {
          await supabase
            .from('daily_work_log')
            .update({ status: ns, completed_on: null })
            .eq('id', id);
        }
        loadStatus();
      };
    });
  }

  // ─── FULL EDIT MODE ────────────────────────────────────────────────────────
  async function initFull() {
    const { data: secs } = await supabase
      .from('sections')
      .select('id,section_name')
      .order('section_name');
    populate(fSection, secs, 'id', 'section_name', 'Section');
    [fSub, fArea, fBN].forEach(x => { x.disabled = true; });

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
      [fArea, fBN].forEach(x => {
        populate(x, [], '', '', x === fArea ? 'Area' : 'BN');
        x.disabled = true;
      });
      loadFull();
    };

    fSub.onchange = async () => {
      if (!fSub.value) {
        populate(fArea, [], '', '', 'Area');
        fArea.disabled = true;
      } else {
        const { data: areas } = await supabase
          .from('areas')
          .select('id,area_name')
          .eq('section_id', fSection.value)
          .eq('subsection_id', fSub.value)
          .order('area_name');
        populate(fArea, areas, 'id', 'area_name', 'Area');
        fArea.disabled = false;
      }
      populate(fBN, [], '', '', 'BN');
      fBN.disabled = true;
      loadFull();
    };

    fArea.onchange = () => {
      populate(fBN, [], '', '', 'BN');
      fBN.disabled = true;
      loadFull();
    };

    const { data: items } = await supabase
      .from('bmr_details')
      .select('item', { distinct: true })
      .order('item');
    populate(fItem, items, 'item', 'item', 'Item');
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
        const uniq = [...new Set((bns || []).map(r => r.bn))]
          .map(bn => ({ bn }));
        populate(fBN, uniq, 'bn', 'bn', 'BN');
        fBN.disabled = false;
      }
      loadFull();
    };

    clearFull.onclick = () => {
      [fSection, fSub, fArea, fItem, fBN].forEach(x => x.value = '');
      [fSub, fArea, fBN].forEach(x => x.disabled = true);
      loadFull();
    };

    await loadFull();
  }

  async function loadFull() {
    fullBody.innerHTML = '';
    let q = supabase
      .from('daily_work_log')
      .select('id,log_date,item,batch_number,activity,status')
      .order('log_date', { ascending: false });

    if (fSection.value) q = q.eq('section_id', fSection.value);
    if (fSub.value)     q = q.eq('subsection_id', fSub.value);
    if (fArea.value)    q = q.eq('area_id', fArea.value);
    if (fItem.value)    q = q.eq('item', fItem.value);
    if (fBN.value)      q = q.eq('batch_number', fBN.value);

    const { data } = await q;
    (data || []).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(r.log_date).toLocaleDateString('en-GB')}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${r.activity}</td>
        <td>${r.status}</td>
        <td>
          <a href="#" class="link-btn editBtn"   data-id="${r.id}">Edit</a> |
          <a href="#" class="link-btn deleteBtn" data-id="${r.id}">Delete</a>
        </td>`;
      fullBody.append(tr);
    });

    document.querySelectorAll('.editBtn').forEach(btn => {
      btn.onclick = e => {
        e.preventDefault();
        openEditModal(btn.dataset.id);
      };
    });

    document.querySelectorAll('.deleteBtn').forEach(btn => {
      btn.onclick = async e => {
        e.preventDefault();
        if (await askConfirm('Delete this entry?')) {
          await deleteEntry(btn.dataset.id);
          loadFull();
        }
      };
    });
  }

  // ─── OPEN EDIT MODAL ────────────────────────────────────────────────────────
  async function openEditModal(id) {
    const { data: rowArr } = await supabase
      .from('daily_work_log')
      .select('*')
      .eq('id', id)
      .limit(1);
    const row = rowArr[0];
    if (!row) return;

    // Populate Section/Sub/Area/Plant
    const { data: secs } = await supabase
      .from('sections')
      .select('id,section_name')
      .order('section_name');
    populate(e_section, secs, 'id', 'section_name', 'Select Section');
    e_section.value = row.section_id || '';

    if (row.section_id) {
      const { data: subs } = await supabase
        .from('subsections')
        .select('id,subsection_name')
        .eq('section_id', row.section_id)
        .order('subsection_name');
      populate(e_sub, subs, 'id', 'subsection_name', 'Select Sub-section');
      e_sub.disabled = false;
      e_sub.value = row.subsection_id || '';
    } else {
      e_sub.disabled = true;
    }

    if (row.subsection_id) {
      const { data: areas } = await supabase
        .from('areas')
        .select('id,area_name')
        .eq('section_id', row.section_id)
        .eq('subsection_id', row.subsection_id)
        .order('area_name');
      populate(e_area, areas, 'id', 'area_name', 'Select Area');
      e_area.disabled = false;
      e_area.value = row.area_id || '';
    } else {
      e_area.disabled = true;
    }

    if (row.area_id) {
      const { data: plants } = await supabase
        .from('plant_machinery')
        .select('id,plant_name')
        .eq('area_id', row.area_id)
        .order('plant_name');
      populate(e_plant, plants, 'id', 'plant_name', 'Select Plant');
      e_plant.disabled = false;
      e_plant.value = row.plant_id || '';
    } else {
      e_plant.disabled = true;
    }

    // Item → BN
    const { data: items } = await supabase
      .from('bmr_details')
      .select('item', { distinct: true })
      .order('item');
    populate(e_item, items, 'item', 'item', 'Select Item');
    e_item.value = row.item || '';

    const { data: bns } = await supabase
      .from('bmr_details')
      .select('bn')
      .eq('item', row.item)
      .order('bn');
    const uniqBN = [...new Set((bns||[]).map(r => r.bn))]
      .map(bn => ({ bn }));
    populate(e_bn, uniqBN, 'bn', 'bn', 'Select Batch Number');
    e_bn.disabled = false;
    e_bn.value = row.batch_number || '';

    // Size/UOM/Activity
    e_size.value     = row.batch_size || '';
    e_uom.value      = row.batch_uom || '';
    e_activity.innerHTML = `<option>${row.activity}</option>`;
    e_activity.value = row.activity || '';

    // Juice
    juiceS.style.display = row.juice_or_decoction ? 'flex' : 'none';
    e_juice.value = row.juice_or_decoction || '';
    e_specify.value = row.specify || '';

    // Putam
    putamS.style.display = row.count_of_saravam != null ? 'flex' : 'none';
    e_count.value       = row.count_of_saravam || '';
    e_fuel.value        = row.fuel || '';
    e_fuel_under.value  = row.fuel_under || '';
    e_fuel_over.value   = row.fuel_over || '';

    // Dates & status
    e_start.value  = row.started_on || '';
    e_due.value    = row.due_date || '';
    e_comp.value   = row.completed_on || '';
    e_status.value = row.status || '';

    // Hide all post-processing sections
    editQtySection.style.display   = 'none';
    labRefSection.style.display    = 'none';
    editSkuSection.style.display   = 'none';
    editTransSection.style.display = 'none';

    const act = (row.activity || '').trim().toLowerCase();

    if (row.status === 'Done') {
      if (act === 'finished goods quality assessment') {
        labRefSection.style.display = 'block';
        e_lab_ref.value = row.lab_ref_number || '';
      }
      else if (skuActivities.includes(act)) {
        editSkuSection.style.display = 'block';
        editSkuBody.innerHTML = '';
        const { data: prod } = await supabase
          .from('products')
          .select('id')
          .eq('item', row.item)
          .single();
        let skus = [];
        if (prod) {
          const { data } = await supabase
            .from('product_skus')
            .select('id,pack_size,uom')
            .eq('product_id', prod.id)
            .eq('is_active', true)
            .order('pack_size');
          skus = data || [];
        }
        const { data: pe } = await supabase
          .from('packaging_events')
          .select('id')
          .eq('work_log_id', id)
          .single();
        let existing = [];
        if (pe) {
          const { data } = await supabase
            .from('event_skus')
            .select('sku_id,count')
            .eq('packaging_event_id', pe.id);
          existing = data || [];
        }
        skus.forEach(sku => {
          const prev = existing.find(e => e.sku_id === sku.id);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${sku.pack_size}</td>
            <td>${sku.uom}</td>
            <td><input type="number" min="0" data-sku-id="${sku.id}" value="${prev ? prev.count : ''}"></td>`;
          editSkuBody.append(tr);
        });
      }
      else if (act === 'transfer to fg store') {
        editTransSection.style.display = 'block';
        editTransBody.innerHTML = '';
        const { data } = await supabase
          .from('bottled_stock_on_hand')
          .select('sku_id,pack_size,uom,on_hand')
          .eq('batch_number', row.batch_number);
        const { data: pe } = await supabase
          .from('packaging_events')
          .select('id')
          .eq('work_log_id', id)
          .single();
        let existing = [];
        if (pe) {
          const { data } = await supabase
            .from('event_skus')
            .select('sku_id,count')
            .eq('packaging_event_id', pe.id);
          existing = data || [];
        }
        (data || []).forEach(r => {
          const prev = existing.find(e => e.sku_id === r.sku_id);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${r.pack_size}</td>
            <td>${r.uom}</td>
            <td>${r.on_hand}</td>
            <td><input type="number" min="0" max="${r.on_hand}" data-sku-id="${r.sku_id}" value="${prev ? prev.count : ''}"></td>`;
          editTransBody.append(tr);
        });
      }
      else {
        editQtySection.style.display = 'flex';
        e_qty.value = row.qty_after_process || '';
        e_qty_uom.value = row.qty_uom || '';
      }
    }

    e_remarks.value = row.remarks || '';
    e_id.value = row.id;

    showModal(editModal);
  }

  // ─── SAVE EDIT ───────────────────────────────────────────────────────────────
  editForm.onsubmit = async ev => {
    ev.preventDefault();
    const id = e_id.value;

    const upd = {
      section_id:        e_section.value,
      subsection_id:     e_sub.value    || null,
      area_id:           e_area.value   || null,
      plant_id:          e_plant.value  || null,
      item:              e_item.value,
      batch_number:      e_bn.value,
      started_on:        e_start.value  || null,
      due_date:          e_due.value    || null,
      completed_on:      e_comp.value   || null,
      status:            e_status.value,
      remarks:           e_remarks.value|| null,
      lab_ref_number:    null,
      qty_after_process: null,
      qty_uom:           null,
      sku_breakdown:     null
    };

    const act = (e_activity.value || '').trim().toLowerCase();

    if (upd.status === 'Done') {
      if (act === 'finished goods quality assessment') {
        upd.lab_ref_number = e_lab_ref.value || null;
      }
      else if (skuActivities.includes(act)) {
        const rows = Array.from(editSkuBody.querySelectorAll('input'))
          .map(i => ({ sku_id: +i.dataset.skuId, count: +i.value }))
          .filter(r => r.count > 0);
        upd.sku_breakdown = rows.map(r => `${r.sku_id} x ${r.count}`).join('; ');
        upd.qty_uom = 'Nos';
      }
      else if (act === 'transfer to fg store') {
        // nothing extra
      }
      else {
        upd.qty_after_process = e_qty.value || null;
        upd.qty_uom           = e_qty_uom.value;
      }
    }

    await supabase
      .from('daily_work_log')
      .update(upd)
      .eq('id', id);

    if (upd.status === 'Done' && (skuActivities.includes(act) || act === 'transfer to fg store')) {
      const { data: pe } = await supabase
        .from('packaging_events')
        .upsert({ work_log_id: id, event_type: e_activity.value }, { onConflict: 'work_log_id' })
        .select('id')
        .single();

      await supabase
        .from('event_skus')
        .delete()
        .eq('packaging_event_id', pe.id);

      let rows = [];
      if (skuActivities.includes(act)) {
        rows = Array.from(editSkuBody.querySelectorAll('input'))
          .map(i => ({ sku_id: +i.dataset.skuId, count: +i.value }));
      } else {
        rows = Array.from(editTransBody.querySelectorAll('input'))
          .map(i => ({ sku_id: +i.dataset.skuId, count: +i.value }));
      }
      rows = rows.filter(r => r.count > 0)
                 .map(r => ({ packaging_event_id: pe.id, ...r }));

      if (rows.length) {
        await supabase.from('event_skus').insert(rows);
      }
    }

    // show inline success & auto-close
    editSuccess.style.display = 'block';
    setTimeout(() => {
      editSuccess.style.display = 'none';
      hideModal(editModal);
      loadFull();
    }, 1200);
  };

  cancelEdit.onclick = () => hideModal(editModal);
  homeBtn.onclick   = () => location.href = 'index.html';

  modeStatus.onclick = () => {
    modeStatus.classList.add('active');
    modeFull.classList.remove('active');
    statusFilters.style.display = 'flex';
    panelStatus.style.display   = 'block';
    fullFilters.style.display   = 'none';
    panelFull.style.display     = 'none';
    initStatus();
  };
  modeFull.onclick = () => {
    modeFull.classList.add('active');
    modeStatus.classList.remove('active');
    fullFilters.style.display   = 'flex';
    panelFull.style.display     = 'block';
    statusFilters.style.display = 'none';
    panelStatus.style.display   = 'none';
    initFull();
  };

  // kick off in Status mode
  modeStatus.click();

  // ─── Populate helper ───────────────────────────────────────────────────────
  function populate(sel, rows, vKey, tKey, placeholder) {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    (rows || []).forEach(r => {
      const o = document.createElement('option');
      o.value = r[vKey];
      o.textContent = r[tKey];
      sel.append(o);
    });
  }
});