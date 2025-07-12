import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  // ───────── Element references ─────────────────────────────────────────
  const homeBtn        = document.getElementById('homeBtn');
  const fullFilters    = document.getElementById('fullFilters');
  const panelFull      = document.getElementById('panelFull');
  const fullBody       = document.getElementById('fullBody');

  const fSection       = document.getElementById('fSection');
  const fSub           = document.getElementById('fSub');
  const fArea          = document.getElementById('fArea');
  const fItem          = document.getElementById('fItem');
  const fBN            = document.getElementById('fBN');
  const clearFull      = document.getElementById('clearFull');

  const doneModal        = document.getElementById('doneModal');
  const doneForm         = document.getElementById('doneForm');
  const doneCompletedOn  = document.getElementById('doneCompletedOn');
  const doneQtySection   = document.getElementById('doneQtySection');
  const doneLabRefSection= document.getElementById('doneLabRefSection');
  const doneSkuSection   = document.getElementById('doneSkuSection');
  const doneSkuBody      = document.querySelector('#doneSkuTable tbody');
  const doneTransSection = document.getElementById('doneTransSection');
  const doneTransBody    = document.querySelector('#doneTransTable tbody');
  const doneCancel       = document.getElementById('doneCancel');
  const doneJust         = document.getElementById('doneJust');
  const doneNew          = document.getElementById('doneNew');

  const editModal        = document.getElementById('editModal');
  const editSuccess      = document.getElementById('editSuccess');
  const editForm         = document.getElementById('editForm');
  const cancelEdit       = document.getElementById('cancelEdit');
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

  const confirmModal   = document.getElementById('confirmModal');
  const confirmText    = document.getElementById('confirmText');
  const confirmYes     = document.getElementById('confirmYes');
  const confirmNo      = document.getElementById('confirmNo');

  // include the two new “monocarton” variants
  const skuActivities = [
    'bottling',
    'bottling and labelling',
    'bottling, labelling and cartoning',
    'capsule monocarton packing',
    'monocarton packing',
    'monocarton packing and cartoning'
  ];

  // ───── Utility functions ─────────────────────────────────────
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
    const ids = (evts||[]).map(e => e.id);
    if (ids.length) {
      await supabase.from('event_skus').delete().in('packaging_event_id', ids);
      await supabase.from('packaging_events').delete().in('id', ids);
    }
  }

  function populate(sel, rows, valueKey, textKey, placeholder) {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    (rows||[]).forEach(r => {
      const o = document.createElement('option');
      o.value = r[valueKey];
      o.textContent = r[textKey];
      sel.append(o);
    });
  }

  // ───── Load & render the “Full Edit” table ──────────────────
  async function loadFull() {
    fullBody.innerHTML = '';
    let q = supabase
      .from('daily_work_log')
      .select('id,log_date,item,batch_number,activity,status')
      .order('log_date',{ascending:false});

    if (fSection.value) q = q.eq('section_id',fSection.value);
    if (fSub.value)     q = q.eq('subsection_id',fSub.value);
    if (fArea.value)    q = q.eq('area_id',fArea.value);
    if (fItem.value)    q = q.eq('item',fItem.value);
    if (fBN.value)      q = q.eq('batch_number',fBN.value);

    const { data } = await q;
    (data||[]).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(r.log_date).toLocaleDateString('en-GB')}</td>
        <td>${r.item}</td>
        <td>${r.batch_number}</td>
        <td>${r.activity}</td>
        <td>${r.status}</td>
        <td>
          <a href="#" class="link-btn editBtn" data-id="${r.id}">Edit</a> |
          <a href="#" class="link-btn deleteBtn" data-id="${r.id}">Delete</a>
        </td>`;
      fullBody.append(tr);
    });

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

  // ───── Initialize filters & first load ──────────────────────
  async function initFull() {
    // Populate Sections
    const { data: secs } = await supabase
      .from('sections')
      .select('id,section_name')
      .order('section_name');
    populate(fSection, secs,'id','section_name','Section');
    [fSub,fArea,fBN].forEach(x=>x.disabled=true);

    // Populate DISTINCT Items
    const { data: itemsF } = await supabase
      .from('bmr_details')
      .select('item',{distinct:true})
      .order('item');
    populate(fItem, itemsF,'item','item','Item');

    // Section → Sub
    fSection.onchange = async () => {
      if (!fSection.value) {
        populate(fSub,[], '','', 'Sub-section');
        fSub.disabled = true;
      } else {
        const { data: subs } = await supabase
          .from('subsections')
          .select('id,subsection_name')
          .eq('section_id',fSection.value)
          .order('subsection_name');
        populate(fSub,subs,'id','subsection_name','Sub-section');
        fSub.disabled = false;
      }
      populate(fArea,[], '','','Area'); fArea.disabled = true;
      populate(fBN,[],   '','','BN');   fBN.disabled = true;
      loadFull();
    };

    // Sub → Area
    fSub.onchange = async () => {
      if (!fSub.value) {
        populate(fArea,[], '','','Area'); fArea.disabled = true;
      } else {
        const { data: areas } = await supabase
          .from('areas')
          .select('id,area_name')
          .eq('section_id',fSection.value)
          .eq('subsection_id',fSub.value)
          .order('area_name');
        populate(fArea,areas,'id','area_name','Area');
        fArea.disabled = false;
      }
      populate(fBN,[], '','','BN'); fBN.disabled = true;
      loadFull();
    };

    // Area → reset BN
    fArea.onchange = () => {
      populate(fBN,[], '','','BN'); fBN.disabled = true;
      loadFull();
    };

    // Item → BN
    fItem.onchange = async () => {
      if (!fItem.value) {
        populate(fBN,[], '','','BN'); fBN.disabled = true;
      } else {
        const { data: bns } = await supabase
          .from('bmr_details')
          .select('bn')
          .eq('item',fItem.value)
          .order('bn');
        const uniq = [...new Set((bns||[]).map(r=>r.bn))];
        fBN.innerHTML = '<option value="">BN</option>' +
          uniq.map(bn=>`<option value="${bn}">${bn}</option>`).join('');
        fBN.disabled = false;
      }
      loadFull();
    };
    fBN.onchange = loadFull;

    // Clear All Filters
    clearFull.onclick = () => {
      [fSection,fSub,fArea,fItem,fBN].forEach(x=>{ x.value=''; x.disabled = (x!==fSection); });
      loadFull();
    };

    // Home → direct
    homeBtn.onclick = () => location.href = 'index.html';

    // First render
    await loadFull();
  }

  // ───── “Done?” modal setup ───────────────────────────────────
  async function configureDoneModal(activity,item,batch) {
    const act = activity.trim().toLowerCase();
    doneQtySection.style.display =
    doneLabRefSection.style.display =
    doneSkuSection.style.display =
    doneTransSection.style.display = 'none';
    doneSkuBody.innerHTML = doneTransBody.innerHTML = '';

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

  // ───── Prompt the Done modal ─────────────────────────────────
  async function promptDone(activity,item,batch) {
    doneForm.reset();
    doneCompletedOn.value = new Date().toISOString().slice(0,10);
    await configureDoneModal(activity,item,batch);
    showModal(doneModal);

    return new Promise(resolve => {
      doneCancel.onclick = () => {
        hideModal(doneModal);
        resolve({ choice: 'cancel' });
      };
      const finish = choice => {
        const act = activity.trim().toLowerCase();
        let rows = [], qty = null, uom = null, labRef = null;

        if (act === 'finished goods quality assessment') {
          labRef = document.getElementById('doneLabRef').value.trim();
        }
        else if (skuActivities.includes(act)) {
          rows = Array.from(doneSkuBody.querySelectorAll('input')).map(i => ({
            skuId:    +i.dataset.skuId,
            count:    +i.value,
            packSize: i.dataset.packSize,
            uom:      i.dataset.uom
          })).filter(r => r.count > 0);
        }
        else if (act === 'transfer to fg store') {
          rows = Array.from(doneTransBody.querySelectorAll('input')).map(i => ({
            skuId:    +i.dataset.skuId,
            count:    +i.value,
            packSize: i.dataset.packSize,
            uom:      i.dataset.uom
          })).filter(r => r.count > 0);
        }
        else {
          qty = +document.getElementById('doneQty').value || null;
          uom = document.getElementById('doneUOM').value.trim() || null;
        }

        hideModal(doneModal);
        resolve({ choice, rows, completedOn: doneCompletedOn.value, qty, uom, labRef });
      };

      doneJust.onclick = () => finish('just');
      doneNew.onclick  = () => finish('new');
    });
  }

  // ───── Save or Save & New logic ─────────────────────────────
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
      const needsQty =
        !skuActivities.includes(act) &&
        act !== 'transfer to fg store' &&
        act !== 'finished goods quality assessment';

      if (needsQty && (!r.qty || !r.uom)) {
        const ok = await askConfirm(
          'You are proceeding without Qty After Process & UOM. Continue anyway?'
        );
        if (!ok) {
          sel.value = 'Doing';
          return;
        }
      }

      // build update payload
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
        upd.sku_breakdown = r.rows
          .map(x => `${x.packSize} ${x.uom} x ${x.count}`)
          .join('; ');
      }
      else {
        upd.qty_after_process = r.qty;
        upd.qty_uom           = r.uom;
      }

      // 1) update daily_work_log
      await supabase
        .from('daily_work_log')
        .update(upd)
        .eq('id', id);

      // 2) upsert packaging_events & event_skus
      if (skuActivities.includes(act) || act === 'transfer to fg store') {
        const { data: pe } = await supabase
          .from('packaging_events')
          .upsert({ work_log_id: id, event_type: activity }, { onConflict: 'work_log_id' })
          .select('id')
          .single();
        if (pe) {
          await supabase.from('event_skus').delete().eq('packaging_event_id', pe.id);
          if (r.rows.length) {
            await supabase.from('event_skus').insert(
              r.rows.map(x => ({
                packaging_event_id: pe.id,
                sku_id:             x.skuId,
                count:              x.count
              }))
            );
          }
        }
      }

      // 3) if Save & New, carry Item & BN to add-log-entry
      if (r.choice === 'new') {
        window.location.href =
          `add-log-entry.html?prefill_item=${encodeURIComponent(sel.dataset.item)}` +
          `&prefill_bn=${encodeURIComponent(sel.dataset.bn)}`;
        return;
      }
    }
    else {
      // reset Done data if not Done
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

    // refresh if not redirected
    loadFull();
  }

  // ───── Open & populate the Edit modal ───────────────────────
  async function openEditModal(id) {
    const { data: rows } = await supabase
      .from('daily_work_log')
      .select('*')
      .eq('id', id)
      .limit(1);
    const row = rows?.[0];
    if (!row) return;

    e_id.value = row.id;

    // Section
    {
      const { data: secs } = await supabase
        .from('sections').select('id,section_name').order('section_name');
      populate(e_section, secs, 'id', 'section_name', 'Select Section');
      e_section.value = row.section_id || '';
    }

    // Sub-section
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
      e_sub.disabled  = true;
      e_sub.innerHTML = `<option value="">Select Sub-section</option>`;
    }

    // Area
    if (row.subsection_id) {
      const { data: areas } = await supabase
        .from('areas')
        .select('id,area_name')
        .eq('section_id', row.section_id)
        .eq('subsection_id', row.subsection_id)
        .order('area_name');
      populate(e_area, areas, 'id', 'area_name', 'Select Area');
      e_area.disabled = false;
      e_area.value    = row.area_id || '';
    } else {
      e_area.disabled  = true;
      e_area.innerHTML = `<option value="">Select Area</option>`;
    }

    // Plant/Machinery
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
      e_plant.disabled  = true;
      e_plant.innerHTML = `<option value="">Select Plant</option>`;
    }

    // Item
    {
      const { data: items } = await supabase
        .from('bmr_details')
        .select('item',{distinct:true})
        .order('item');
      populate(e_item, items, 'item', 'item', 'Select Item');
      e_item.value = row.item || '';
    }

    // Batch Number
    {
      const { data: bns } = await supabase
        .from('bmr_details')
        .select('bn')
        .eq('item', row.item)
        .order('bn');
      const uniq = [...new Set((bns||[]).map(r=>r.bn))];
      e_bn.innerHTML =
        '<option value="">Select Batch Number</option>' +
        uniq.map(bn => `<option value="${bn}">${bn}</option>`).join('');
      e_bn.disabled = false;
      e_bn.value    = row.batch_number || '';
    }

    // Size / UOM / Activity
    e_size.value         = row.batch_size  || '';
    e_uom.value          = row.batch_uom   || '';
    e_activity.innerHTML = `<option>${row.activity}</option>`;
    e_activity.value     = row.activity;

    // Juice/Decoction
    juiceS.style.display = row.juice_or_decoction ? 'flex' : 'none';
    e_juice.value        = row.juice_or_decoction || '';
    e_specify.value      = row.specify               || '';

    // Putam
    putamS.style.display = row.count_of_saravam != null ? 'flex' : 'none';
    e_count.value        = row.count_of_saravam      || '';
    e_fuel.value         = row.fuel                  || '';
    e_fuel_under.value   = row.fuel_under            || '';
    e_fuel_over.value    = row.fuel_over             || '';

    // Dates & Status
    e_start.value  = row.started_on   || '';
    e_due.value    = row.due_date     || '';
    e_comp.value   = row.completed_on || '';
    e_status.value = row.status       || '';

    // Hide all post-Done sections
    [ editQtySection, labRefSection, editSkuSection, editTransSection ]
      .forEach(sec => sec.style.display = 'none');
    editSkuBody.innerHTML = editTransBody.innerHTML = '';
    e_qty.value = e_qty_uom.value = e_lab_ref.value = '';

    // Show existing Done details if status === Done
    const actOrig  = row.activity;
    const actLower = actOrig.trim().toLowerCase();
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
        e_qty.value = row.qty_after_process || '';
        e_qty_uom.value = row.qty_uom || '';
      }
    }

    // Dynamically show/hide post-Done sections on status change
    e_status.onchange = () => {
      [ editQtySection, labRefSection, editSkuSection, editTransSection ]
        .forEach(sec => sec.style.display = 'none');
      editSkuBody.innerHTML = editTransBody.innerHTML = '';
      e_qty.value = e_qty_uom.value = e_lab_ref.value = '';
      e_comp.value = e_status.value === 'Done'
        ? new Date().toISOString().slice(0,10)
        : '';

      if (e_status.value === 'Done') {
        const act2 = actOrig.trim().toLowerCase();
        if (act2 === 'finished goods quality assessment') {
          labRefSection.style.display = 'block';
        }
        else if (skuActivities.includes(act2)) {
          editSkuSection.style.display = 'block';
          (async () => {
            const { data: prod } = await supabase
              .from('products')
              .select('id')
              .eq('item', row.item)
              .single();
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

  // ───── Handle submission of the Full-Edit form ───────────────
  editForm.onsubmit = async ev => {
    ev.preventDefault();

    const id           = e_id.value;
    const originalAct  = e_activity.value.trim();
    const actLower     = originalAct.toLowerCase();
    const newStat      = e_status.value;

    // If not Done, clear and save
    if (newStat !== 'Done') {
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
      hideModal(editModal);
      loadFull();
      return;
    }

    // If Done, confirm qty/UOM if required
    const needsQty =
      !skuActivities.includes(actLower) &&
      actLower !== 'transfer to fg store' &&
      actLower !== 'finished goods quality assessment';

    if (needsQty && (!e_qty.value || !e_qty_uom.value)) {
      const proceed = await askConfirm(
        'You have not provided Qty After Process & UOM. If this is the final process, it’s required. Save anyway?'
      );
      if (!proceed) return;
    }

    // Build update payload
    const upd = {
      status:            'Done',
      completed_on:      e_comp.value,
      qty_after_process: null,
      qty_uom:           null,
      sku_breakdown:     null,
      lab_ref_number:    null
    };

    if (actLower === 'finished goods quality assessment') {
      upd.lab_ref_number = e_lab_ref.value || null;
    }
    else if (skuActivities.includes(actLower) || actLower === 'transfer to fg store') {
      const container = skuActivities.includes(actLower)
                      ? editSkuBody
                      : editTransBody;
      const rows = Array.from(container.querySelectorAll('input')).map(i => ({
        skuId:    +i.dataset.skuId,
        count:    +i.value,
        packSize: i.dataset.packSize,
        uom:      i.dataset.uom
      })).filter(r => r.count > 0);
      upd.sku_breakdown = rows.map(r => `${r.packSize} ${r.uom} x ${r.count}`).join('; ');
    }
    else {
      upd.qty_after_process = e_qty.value || null;
      upd.qty_uom           = e_qty_uom.value || null;
    }

    // Save daily_work_log
    await supabase
      .from('daily_work_log')
      .update(upd)
      .eq('id', id);

    // Upsert packaging_events & event_skus if needed
    if (skuActivities.includes(actLower) || actLower === 'transfer to fg store') {
      const { data: pe } = await supabase
        .from('packaging_events')
        .upsert({ work_log_id: id, event_type: originalAct }, { onConflict: 'work_log_id' })
        .select('id')
        .single();
      if (pe) {
        await supabase.from('event_skus').delete().eq('packaging_event_id', pe.id);
        const container = skuActivities.includes(actLower)
                        ? editSkuBody
                        : editTransBody;
        const evRows = Array.from(container.querySelectorAll('input')).map(i => ({
          packaging_event_id: pe.id,
          sku_id:             +i.dataset.skuId,
          count:              +i.value
        })).filter(r => r.count > 0);
        if (evRows.length) {
          await supabase.from('event_skus').insert(evRows);
        }
      }
    }

    // Show success & refresh
    editSuccess.style.display = 'block';
    setTimeout(() => {
      editSuccess.style.display = 'none';
      hideModal(editModal);
      loadFull();
    }, 1200);
  };

  // ───── Cancel edit ─────────────────────────────────────────
  cancelEdit.onclick = () => hideModal(editModal);

  // Start Full-Edit mode
  initFull();
});