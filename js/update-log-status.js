  /* ===========================================================================
    update-log-status.js  —  Status dashboard
    ---------------------------------------------------------------------------
    • Adds a “Log Date” filter that behaves like dd-mm-yyyy everywhere else.
    • Harmonises Completed-On date input with the same Flatpickr + mask stack.
    • Client-side “ghost row” issue solved by clearing <tbody> before repop.
  =========================================================================== */

  /* ── Supabase ---------------------------------------------------------------- */
  import { supabase } from './supabaseClient.js';

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

  /* Parse/format helpers for DD-MM-YYYY */
  const parseDMY  = s => { const [d,m,y] = s.split('-').map(Number); return new Date(y, m-1, d); };
  const formatDMY = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

  /* Simple auto-mask to insert “-” */
  const attachMask = el =>
    el.addEventListener('input', ()=> {
      let v = el.value.replace(/\D/g,'').slice(0,8);
      if (v.length>2) v = v.slice(0,2)+'-'+v.slice(2);
      if (v.length>5) v = v.slice(0,5)+'-'+v.slice(5);
      el.value = v;
    });

  /* ── Cached plant-name lookup ------------------------------------------------ */
  const plantMap = {};          // id ➜ plant_name

  /* ── Packaging activities that need SKU tables ----------------------------- */
  const skuActivities = [
    'bottling','bottling and labelling','bottling, labelling and cartoning',
    'capsule monocarton packing','monocarton packing',
    'monocarton packing and cartoning'
  ];

  /* ── Short DOM helper ------------------------------------------------------- */
  const $ = s => document.querySelector(s);

  /* ── Bootstrapping after DOMContentLoaded ---------------------------------- */
  document.addEventListener('DOMContentLoaded', async () => {

    /* ---------- MAIN ELEMENT REFERENCES ----------------------------------- */
    const homeBtn   = $('#homeBtn');
    const bodyTbl   = $('#statusBody');

    /* filter bar */
    const sLogDate  = $('#sLogDate');
    const sSection  = $('#sSection');
    const sSub      = $('#sSub');
    const sArea     = $('#sArea');
    const sItem     = $('#sItem');
    const sBN       = $('#sBN');
    const sOverdue  = $('#sOverdue');
    const clearBtn  = $('#clearStatus');

    /* done modal */
    const doneModal       = $('#doneModal');
    const doneForm        = $('#doneForm');
    const doneCompletedOn = $('#doneCompletedOn');
    const doneQtySection  = $('#doneQtySection');
    const doneLabRefSec   = $('#doneLabRefSection');
    const doneSkuSec      = $('#doneSkuSection');
    const doneSkuBody     = $('#doneSkuTable tbody');
    const doneTransSec    = $('#doneTransSection');
    const doneTransBody   = $('#doneTransTable tbody');
    const doneCancel      = $('#doneCancel');
    const doneJust        = $('#doneJust');
    const doneNew         = $('#doneNew');

    /* confirm modal */
    const confirmModal = $('#confirmModal');
    const confirmText  = $('#confirmText');
    const confirmYes   = $('#confirmYes');
    const confirmNo    = $('#confirmNo');

    /* ---------- ONE-TIME INIT: Flatpickr + mask --------------------------- */
    attachMask(sLogDate);
    flatpickr(sLogDate, fpBase);        // no maxDate restriction
    sLogDate.addEventListener('change', loadStatus);

    attachMask(doneCompletedOn);
    flatpickr(doneCompletedOn, {...fpBase, maxDate:'today'});
    doneCompletedOn.addEventListener('blur', ()=> {
      const d = parseDMY(doneCompletedOn.value);
      const today = new Date();
      if (+d > +today) doneCompletedOn.value = formatDMY(today);
    });

    /* ---------- BASIC HELPERS -------------------------------------------- */
    const show  = m => m.style.display = 'flex';
    const hide  = m => m.style.display = 'none';

    async function askConfirm(msg){
      confirmText.textContent = msg;
      show(confirmModal);
      return new Promise(res=>{
        confirmYes.onclick = ()=>{ hide(confirmModal); res(true); };
        confirmNo .onclick = ()=>{ hide(confirmModal); res(false); };
      });
    }

    const populate = (sel, rows, valKey, txtKey, ph) =>
      sel.innerHTML = `<option value="">${ph}</option>` +
        rows.map(r=>`<option value="${r[valKey]}">${r[txtKey]}</option>`).join('');

    /* ---------- Supabase helpers ----------------------------------------- */
    async function clearPackaging(logId){
      const {data} = await supabase.from('packaging_events')
                                  .select('id').eq('work_log_id',logId);
      if (data?.length){
        const ids = data.map(x=>x.id);
        await supabase.from('event_skus').delete().in('packaging_event_id',ids);
        await supabase.from('packaging_events').delete().in('id',ids);
      }
    }

    /* ---------- Cascading filter wiring ---------------------------------- */
    sSection.onchange = async () => {
      if (!sSection.value){
        populate(sSub,[],'','','Sub-section'); sSub.disabled = true;
      }else{
        const {data} = await supabase.from('subsections')
          .select('id,subsection_name').eq('section_id',sSection.value)
          .order('subsection_name');
        populate(sSub,data,'id','subsection_name','Sub-section'); sSub.disabled=false;
      }
      resetAreaBN(); loadStatus();
    };

    sSub.onchange = async () => {
      if (!sSub.value){ resetAreaBN(); }
      else{
        const {data} = await supabase.from('areas')
          .select('id,area_name')
          .eq('section_id',sSection.value).eq('subsection_id',sSub.value)
          .order('area_name');
        populate(sArea,data,'id','area_name','Area'); sArea.disabled=false;
        resetBN();
      }
      loadStatus();
    };

    const resetAreaBN = ()=>{ populate(sArea,[],'','','Area'); sArea.disabled=true; resetBN(); };
    const resetBN     = ()=>{ sBN.innerHTML='<option value="">BN</option>'; sBN.disabled=true; };

    sArea.onchange = ()=>{ resetBN(); loadStatus(); };

    sItem.onchange = async ()=>{
      if (!sItem.value){ resetBN(); }
      else{
        const {data} = await supabase.from('bmr_details')
          .select('bn').eq('item',sItem.value).order('bn');
        const uniq = [...new Set(data.map(r=>r.bn))];
        populate(sBN, uniq.map(bn=>({bn})), 'bn','bn','BN'); sBN.disabled=false;
      }
      loadStatus();
    };

    sBN     .onchange = loadStatus;
    sOverdue.onchange = loadStatus;

    clearBtn.onclick = ()=>{
      [sSection,sSub,sArea,sItem,sBN].forEach(x=>x.value='');
      [sSub,sArea,sBN].forEach(x=>x.disabled=true);
      sOverdue.checked=false;
      sLogDate.value='';
      loadStatus();
    };

    /* ---------- “Done?” modal (identical logic to your working copy) ----- */
    async function configureDoneModal(activity,item,batch){
      const act = activity.toLowerCase().trim();
      doneQtySection.style.display =
      doneLabRefSec.style.display =
      doneSkuSec.style.display =
      doneTransSec.style.display = 'none';
      doneSkuBody.innerHTML=''; doneTransBody.innerHTML='';

      if (act==='finished goods quality assessment'){
        doneLabRefSec.style.display='flex';
      }else if (skuActivities.includes(act)){
        doneSkuSec.style.display='block';
        const {data:prod}=await supabase.from('products')
                                        .select('id').eq('item',item).single();
        if (prod){
          const {data:skus}=await supabase.from('product_skus')
            .select('id,pack_size,uom')
            .eq('product_id',prod.id).eq('is_active',true).order('pack_size');
          skus.forEach(s=>{
            doneSkuBody.insertAdjacentHTML('beforeend',`
              <tr><td>${s.pack_size}</td><td>${s.uom}</td>
              <td><input type="number" min="0" data-sku-id="${s.id}"
                        data-pack-size="${s.pack_size}" data-uom="${s.uom}"></td></tr>`);
          });
        }
      }else if (act==='transfer to fg store'){
        doneTransSec.style.display='block';
        const {data}=await supabase.from('bottled_stock_on_hand')
          .select('sku_id,pack_size,uom,on_hand').eq('batch_number',batch);
        data.forEach(r=>{
          doneTransBody.insertAdjacentHTML('beforeend',`
            <tr><td>${r.pack_size}</td><td>${r.uom}</td><td>${r.on_hand}</td>
            <td><input type="number" min="0" max="${r.on_hand}" data-sku-id="${r.sku_id}"
                      data-pack-size="${r.pack_size}" data-uom="${r.uom}"></td></tr>`);
        });
      }else{
        doneQtySection.style.display='flex';
        $('#doneUOM').value='';
      }
    }

    async function promptDone(activity,item,batch){
      doneForm.reset();
      doneCompletedOn.value = formatDMY(new Date());
      await configureDoneModal(activity,item,batch);
      show(doneModal);
      return new Promise(res=>{
        doneCancel.onclick = ()=>{ hide(doneModal); res({choice:'cancel'}); };
        const finish=choice=>{
          const act = activity.toLowerCase().trim();
          let rows=[],qty=null,uom=null,lab=null;
          if (act==='finished goods quality assessment'){
            lab = $('#doneLabRef').value.trim();
          }else if (skuActivities.includes(act)){
            rows=[...doneSkuBody.querySelectorAll('input')].map(i=>({
              skuId:+i.dataset.skuId,count:+i.value,packSize:i.dataset.packSize,uom:i.dataset.uom
            })).filter(r=>r.count>0);
          }else if (act==='transfer to fg store'){
            rows=[...doneTransBody.querySelectorAll('input')].map(i=>({
              skuId:+i.dataset.skuId,count:+i.value,packSize:i.dataset.packSize,uom:i.dataset.uom
            })).filter(r=>r.count>0);
          }else{
            qty = +$('#doneQty').value||null;
            uom = $('#doneUOM').value||null;
          }
          hide(doneModal);
          res({choice,rows,completedOn:doneCompletedOn.value,qty,uom,labRef:lab});
        };
        doneJust.onclick = ()=>finish('just');
        doneNew .onclick = ()=>finish('new');
      });
    }

    /* ---------- row save handler ----------------------------------------- */
    async function saveStatus(id,sel){
      const {act,item,bn}=sel.dataset, newStat=sel.value;
      if (newStat==='Done'){
        const r = await promptDone(act,item,bn);
        if (r.choice==='cancel'){ sel.value='Doing'; return; }

        const actL = act.toLowerCase().trim();
        const needsQty = !skuActivities.includes(actL)
                      && actL!=='transfer to fg store'
                      && actL!=='finished goods quality assessment';
        if (needsQty && (!r.qty||!r.uom)){
          if (!await askConfirm('No Qty/UOM provided. Continue anyway?')){
            sel.value='Doing'; return;
          }
        }

        const upd = {
          status:'Done', completed_on:r.completedOn,
          qty_after_process:null, qty_uom:null,
          sku_breakdown:null, lab_ref_number:null
        };
        if (actL==='finished goods quality assessment'){
          upd.lab_ref_number = r.labRef;
        }else if (skuActivities.includes(actL)||actL==='transfer to fg store'){
          upd.sku_breakdown = r.rows.map(x=>`${x.packSize} ${x.uom} x ${x.count}`).join('; ');
        }else{
          upd.qty_after_process = r.qty; upd.qty_uom = r.uom;
        }

        await supabase.from('daily_work_log').update(upd).eq('id',id);

        if (skuActivities.includes(actL)||actL==='transfer to fg store'){
          const {data:pe}=await supabase.from('packaging_events')
            .upsert({work_log_id:id,event_type:act},{onConflict:'work_log_id'})
            .select('id').single();
          if (pe){
            await supabase.from('event_skus').delete().eq('packaging_event_id',pe.id);
            if (r.rows.length){
              await supabase.from('event_skus').insert(
                r.rows.map(x=>({packaging_event_id:pe.id,sku_id:x.skuId,count:x.count}))
              );
            }
          }
        }

        if (r.choice==='new'){
          location.href=`add-log-entry.html?item=${encodeURIComponent(item)}&bn=${encodeURIComponent(bn)}`;
          return;
        }
      }else{
        await clearPackaging(id);
        await supabase.from('daily_work_log').update({
          status:newStat, completed_on:null,
          qty_after_process:null, qty_uom:null, sku_breakdown:null, lab_ref_number:null
        }).eq('id',id);
      }
      loadStatus();
    }

    /* ---------- main table refresh --------------------------------------- */
    async function loadStatus(){
      /* purge previous rows to avoid duplicate rendering */
      bodyTbl.replaceChildren();

      let q = supabase.from('daily_work_log')
        .select('id,log_date,item,batch_number,plant_id,activity,status,due_date')
        .in('status',['Doing','On Hold']);

  if (sLogDate.value) {
    /* convert dd-mm-yyyy → yyyy-mm-dd without hitting Date() / UTC */
    const [dd, mm, yyyy] = sLogDate.value.split('-');
    const iso = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
    q = q.eq('log_date', iso);
  }

  if (sSection.value) q = q.eq('section_id',    sSection.value);
  if (sSub.value)     q = q.eq('subsection_id', sSub.value);
  if (sArea.value)    q = q.eq('area_id',       sArea.value);
  if (sItem.value)    q = q.eq('item',          sItem.value);
  if (sBN.value)      q = q.eq('batch_number',  sBN.value);

  if (sOverdue.checked) {
    const todayIso = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
    q = q.lt('due_date', todayIso);
  }

      const {data} = await q;
      /* natural sort identical to Edit module */
      const coll = new Intl.Collator('en',{numeric:true,sensitivity:'base'});
      data.sort((a,b)=>{
        const dt = new Date(a.log_date)-new Date(b.log_date); if (dt) return dt;
        const itm=a.item.localeCompare(b.item,undefined,{sensitivity:'base'}); if(itm) return itm;
        const bn = a.batch_number.localeCompare(b.batch_number,undefined,{numeric:true}); if(bn) return bn;
        return coll.compare(plantMap[a.plant_id]||'',plantMap[b.plant_id]||'');
      });

      data.forEach(r=>{
        bodyTbl.insertAdjacentHTML('beforeend',`
          <tr>
            <td>${new Date(r.log_date).toLocaleDateString('en-GB')}</td>
            <td>${r.item}</td>
            <td>${r.batch_number}</td>
            <td>${plantMap[r.plant_id]||''}</td>
            <td>${r.activity}</td>
            <td>
              <select class="statSel" data-id="${r.id}" data-act="${r.activity}"
                      data-item="${r.item}" data-bn="${r.batch_number}">
                <option${r.status==='Doing'?' selected':''}>Doing</option>
                <option${r.status==='On Hold'?' selected':''}>On Hold</option>
                <option${r.status==='Done'?' selected':''}>Done</option>
              </select>
            </td>
            <td><a href="#" class="save-link" data-id="${r.id}">Save</a></td>
          </tr>`);
      });

      [...document.querySelectorAll('.save-link')].forEach(a=>{
        const sel = $(`.statSel[data-id="${a.dataset.id}"]`);
        a.onclick = e=>{e.preventDefault(); saveStatus(a.dataset.id,sel);};
      });
    }

    /* ---------- Initial bootstrap ---------------------------------------- */
    async function init(){
      /* plant lookup */
      const {data:pl}=await supabase.from('plant_machinery').select('id,plant_name');
      pl.forEach(p=>plantMap[p.id]=p.plant_name);

      /* section & item dropdowns */
      const {data:secs}=await supabase.from('sections')
        .select('id,section_name').order('section_name');
      populate(sSection,secs,'id','section_name','Section');

      // FETCH *ALL* ITEMS, DEDUPE CLIENT-SIDE
      const { data: itemsRaw, error: itemsErr } = await supabase
        .from('bmr_details')
        .select('item')
        .order('item');
      if (itemsErr) {
        console.error('Error loading items:', itemsErr);
      } else {
        // build a unique list of { item } objects
        const uniqueItems = Array.from(
          new Set(itemsRaw.map(r => r.item))
        ).map(item => ({ item }));
        populate(sItem, uniqueItems, 'item', 'item', 'Item');
      }

      homeBtn.onclick = ()=>location.href='index.html';
      await loadStatus();
    }

    init();
  });