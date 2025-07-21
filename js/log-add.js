/***************************************************************************
 * log-add.js                                                               *
 * ----------------------------------------------------------------------- *
 * Powers the “Add Log Entry” screen                                        *
 *  • Supabase for data I/O                                                 *
 *  • Flatpickr date pickers                                                *
 *  • Cascading selects Section → Activity                                  *
 *  • Auto-compute Due Date / Completed On                                  *
 *  • Validation for Transfer & SKU tables                                  *
 *  • Duplicate-row guard (handles 23505 & “duplicate key” text)            *
 ***************************************************************************/

import { supabase } from "./supabaseClient.js";

/* ─────────────────────────────  DATE HELPERS  ────────────────────────── */
const parseDMY  = s => { const [d,m,y] = s.split("-").map(Number); return new Date(y, m-1, d); };
const formatDMY = d => `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
const addBiz    = (start,n)=>{const d=new Date(start);let a=0;while(a<n){d.setDate(d.getDate()+1);if(d.getDay()!==0)a++;}return d;};
const toISO = dmy => {
  if (!dmy) return null;              // keep NULL if field blank
  const [d, m, y] = dmy.split("-");
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
};

/* ────────────────────────────  FLATPICKR CONFIG  ─────────────────────── */
const fpOptions = {
  dateFormat : "d-m-Y",
  allowInput : true,
  clickOpens : true,
  plugins    : [ confirmDatePlugin({
    showTodayButton : true,
    showClearButton : true,
    todayText       : "Today",
    clearText       : "Clear",
    confirmText     : "OK"
  }) ]
};

/* ─────────────────────────────  INPUT MASK  ──────────────────────────── */
const attachMask = el => el.addEventListener("input", () => {
  let v = el.value.replace(/\D/g,"").slice(0,8);
  if (v.length>2) v=v.slice(0,2)+"-"+v.slice(2);
  if (v.length>5) v=v.slice(0,5)+"-"+v.slice(5);
  el.value=v;
});

/* ────────────────────────────  DOM SHORTCUTS  ────────────────────────── */
const $ = id => document.getElementById(id);

const form             = $("logForm");
const homeBtn          = $("homeBtn");
const btnSubmitNew     = $("btnSubmitNew");

const sectionSel       = $("section");
const subSel           = $("sub_section");
const areaSel          = $("area");
const plantSel         = $("plant_or_machinery");
const activitySel      = $("activity");

const itemInput        = $("itemInput");
const itemList         = $("itemList");
const batchSel         = $("batch_number");
const sizeInput        = $("batch_size");
const uomInput         = $("batch_uom");

const logDateInput     = $("log_date");
const startInput       = $("started_on");
const dueInput         = $("due_date");
const statusSel        = $("status");
const compOnInput      = $("completed_on");

const compOnSection    = $("completedOnSection");
const postProcSection  = $("postProcessingSection");
const labRefSection    = $("labRefSection");
const skuSection       = $("skuSection");
const transferSection  = $("transferSection");

const juiceSection     = $("juiceSection");
const putamSection     = $("putamSection");
const rmJuiceQtyInput = $("rm_juice_qty");
const rmJuiceUomSel   = $("rm_juice_uom");

const skuTableBody      = document.querySelector("#skuTable tbody");
const transferTableBody = document.querySelector("#transferTable tbody");

const dialogOverlay     = $("dialogOverlay");
const dialogMessage     = $("dialogMessage");
const btnYes            = $("btnYes");
const btnNo             = $("btnNo");
const btnOk             = $("btnOk");
const storageSection    = $("storageSection");
const storageQtyInput   = $("storage_qty");
const storageUomSel     = $("storage_qty_uom");

/* ─────────────────────────────  STATE  ───────────────────────────────── */
let lastDurations    = {};
let currentItemSkus  = [];
let currentUserEmail = null;
let dirty            = false;

const skuActivities = [
  "bottling",
  "bottling and labelling",
  "bottling, labelling and cartoning",
  "capsule monocarton packing",
  "monocarton packing",
  "monocarton packing and cartoning"
];

/* ─────────────────────────────  MODALS  ──────────────────────────────── */
const showAlert   = msg => new Promise(res => {
  dialogMessage.textContent = msg;
  btnYes.style.display = btnNo.style.display = "none";
  btnOk.style.display  = "inline-block";
  dialogOverlay.style.display = "flex";
  btnOk.onclick = () => { dialogOverlay.style.display="none"; res(); };
});
const askConfirm = msg => new Promise(res => {
  dialogMessage.textContent = msg;
  btnYes.style.display = btnNo.style.display = "inline-block";
  btnOk.style.display  = "none";
  dialogOverlay.style.display = "flex";
  btnYes.onclick = () => { dialogOverlay.style.display="none"; res(true); };
  btnNo.onclick  = () => { dialogOverlay.style.display="none"; res(false); };
});

/* ────────────────────────────  UTIL POPULATE  ───────────────────────── */
const populate = (sel, rows, vKey, tKey, ph) =>
  sel.innerHTML = `<option value="">${ph}</option>` +
    rows.map(r=>`<option value="${r[vKey]}">${r[tKey]}</option>`).join("");
const populateDataList = (dl, items, key) =>
  dl.innerHTML = items.map(i=>`<option value="${i[key]}">`).join("");

/* ───────────────────────────  DUPLICATE MSG  ────────────────────────── */
const duplicateMessage = row => {
  const parts = [
    `Item : ${row.item}`,
    `Batch Number: ${row.batch_number}`,
    `Activity : ${row.activity}`,
    `Log Date : ${row.log_date}`,
  ];
  if (row.started_on && row.started_on !== row.log_date)
    parts.push(`Started On : ${row.started_on}`);
  return (
    "A log with the same details already exists:\n\n" +
    parts.join("\n") +
    "\n\nOpen the existing log entry instead of adding a new one."
  );
};

/* ────────────────────────────  LOAD ACTIVITIES  ─────────────────────── */
async function loadActivities() {
  activitySel.disabled = true;
  activitySel.innerHTML = "<option>-- Select Activity --</option>";

  let q = supabase.from("activities").select("activity_name,duration_days");
  if      (areaSel.value)    q = q.eq("area_id", areaSel.value);
  else if (subSel.value)     q = q.eq("sub_section_id", subSel.value).is("area_id", null);
  else if (sectionSel.value) q = q.eq("section_id", sectionSel.value)
                                   .is("sub_section_id", null)
                                   .is("area_id", null);

  const { data, error } = await q.order("activity_name");
  if (error) { console.error(error); return; }

  lastDurations = {};
  data.forEach(r => (lastDurations[r.activity_name] = r.duration_days));

  if (data.length) {
    populate(activitySel, data, "activity_name", "activity_name", "-- Select Activity --");
    activitySel.disabled = false;
  }
}

/* ───────────────────────────  SECTION VISIBILITY  ───────────────────── */
function updateSections() {
  const actNorm   = (activitySel.value || "").trim().toLowerCase();
  const done      = statusSel.value === "Done";
  const doing     = statusSel.value === "Doing";
  const inStorage = statusSel.value === "In Storage";

  // — Juice/Decoction (and its RM fields) only when Doing + juice‑type activity
  juiceSection.style.display =
    (doing && /juice|grinding|kashayam/.test(actNorm))
      ? "block"
      : "none";

  // — Putam only when Doing + putam‑type activity
  putamSection.style.display =
    (doing && /putam|gaja putam|seelamann/.test(actNorm))
      ? "block"
      : "none";

  // — Storage section only when In Storage
  storageSection.style.display = inStorage ? "block" : "none";

  // — Completed On always when Done
  compOnSection.style.display = done ? "block" : "none";

  // — Post‑processing (Qty/UOM) when Done, but NOT for SKU activities or QA/Transfer
  postProcSection.style.display =
    done
    && !skuActivities.includes(actNorm)
    && !["transfer to fg store","finished goods quality assessment"].includes(actNorm)
      ? "block"
      : "none";

  // — Lab Ref only when Done + FG QA activity
  labRefSection.style.display =
    (done && actNorm === "finished goods quality assessment")
      ? "block"
      : "none";

  // — SKU Breakdown only when Done + SKU activity
  skuSection.style.display =
    (done && skuActivities.includes(actNorm))
      ? "block"
      : "none";
  if (done && skuActivities.includes(actNorm)) renderSkuTable();

  // — Transfer table only when Done + Transfer activity
  transferSection.style.display =
    (done && actNorm === "transfer to fg store")
      ? "block"
      : "none";
  if (done && actNorm === "transfer to fg store") renderTransferTable();

  // — DISABLE “In Storage” in status dropdown unless storage activity
  const allowStorage = ["intermediate storage", "fg bulk storage"].includes(actNorm);
  const storageOpt = Array.from(statusSel.options)
                          .find(opt => opt.value === "In Storage");
  if (storageOpt) storageOpt.disabled = !allowStorage;

  // — If it was selected but now disallowed, clear it & hide fields
  if (!allowStorage && statusSel.value === "In Storage") {
    statusSel.value = "";         // or set to "Doing" if you prefer
    storageSection.style.display = "none";
  }
}

/* ─────────────────────────────  TABLES  ──────────────────────────────── */
function renderSkuTable() {
  skuTableBody.innerHTML = "";
  currentItemSkus.forEach(sku => {
    skuTableBody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${sku.pack_size}</td>
        <td>${sku.uom}</td>
        <td><input type="number" min="0" data-sku-id="${sku.id}"></td>
      </tr>` );
  });
}

async function renderTransferTable() {
  transferTableBody.innerHTML = "";
  if (!batchSel.value) return;
  const { data } = await supabase
    .from("bottled_stock_on_hand")
    .select("sku_id,pack_size,uom,on_hand")
    .eq("batch_number", batchSel.value);
  (data||[]).forEach(r=>{
    transferTableBody.insertAdjacentHTML("beforeend",`
      <tr>
        <td>${r.pack_size}</td>
        <td>${r.uom}</td>
        <td>${r.on_hand}</td>
        <td><input type="number" min="0" max="${r.on_hand}" data-sku-id="${r.sku_id}"></td>
      </tr>` );
  });
}

/* ─────────────────────────────  DUE DATE  ───────────────────────────── */
const updateDueDate = () => {
  const a = activitySel.value, s = startInput.value;
  if (a && s && lastDurations[a] != null)
    dueInput.value = formatDMY(addBiz(parseDMY(s), +lastDurations[a]));
  else
    dueInput.value = "";
};

/* ───────────────────────────  CARRY-FORWARD  ────────────────────────── */
function applyCarryForward() {
  const p = new URLSearchParams(window.location.search);
  const item = p.get("prefill_item") || p.get("item");
  const bn   = p.get("prefill_bn")   || p.get("bn");

  if (item) { itemInput.value = item; itemInput.dispatchEvent(new Event("change")); }
  if (bn) {
    const iv = setInterval(()=>{
      if (!Array.from(batchSel.options).some(o=>o.value===bn)) return;
      batchSel.value = bn;
      batchSel.dispatchEvent(new Event("change"));
      clearInterval(iv);
    },100);
  }
}

/* ─────────────────────────────  INIT  ───────────────────────────────── */
window.addEventListener("DOMContentLoaded", async () => {
  ["log_date","started_on"].forEach(id=>{
    const el=$(id); attachMask(el); flatpickr(el,{...fpOptions,maxDate:"today"});
  });
  ["due_date","completed_on"].forEach(id=>{
    const el=$(id); attachMask(el); flatpickr(el,fpOptions);
  });

  logDateInput.value = startInput.value = formatDMY(new Date());
  updateDueDate();

  const { data:{ user } } = await supabase.auth.getUser();
  if (user) currentUserEmail = user.email;

  homeBtn.onclick      = async()=>{
    if (dirty && !(await askConfirm("Unsaved changes—leave?"))) return;
    window.location.href = "index.html";
  };
  btnSubmitNew.onclick = e => { e.preventDefault(); handleSubmit(true); };

  [subSel,areaSel,plantSel,batchSel,activitySel]
    .forEach(el=>{ el.disabled=true; el.innerHTML=""; });

  {
    const { data } = await supabase
      .from("sections").select("id,section_name").order("section_name");
    if (data) populate(sectionSel, data, "id", "section_name", "-- Select Section --");
  }
  {
    const { data } = await supabase
      .from("bmr_details").select("item").order("item");
    if (data) {
      const uniq=[...new Set(data.map(r=>r.item))].map(item=>({item}));
      populateDataList(itemList, uniq, "item");
    }
  }
  applyCarryForward();
  updateSections();
});

/* ─────────────────────────  CASCADE EVENTS  ─────────────────────────── */
sectionSel.addEventListener("change", async () => {
  [subSel,areaSel,plantSel,activitySel].forEach(el=>{ el.disabled=true; el.innerHTML=""; });
  await loadActivities();
  if (!sectionSel.value) return;
  const { data } = await supabase
    .from("subsections").select("id,subsection_name")
    .eq("section_id", sectionSel.value).order("subsection_name");
  if (data?.length) {
    populate(subSel, data, "id", "subsection_name", "-- Select Sub-section --");
    subSel.disabled = false;
  }
});

subSel.addEventListener("change", async () => {
  [areaSel,plantSel,activitySel].forEach(el=>{ el.disabled=true; el.innerHTML=""; });
  await loadActivities();
  if (!subSel.value) return;
  const { data } = await supabase
    .from("areas").select("id,area_name")
    .eq("section_id", sectionSel.value)
    .eq("subsection_id", subSel.value)
    .order("area_name");
  if (data?.length) {
    populate(areaSel, data, "id", "area_name", "-- Select Area --");
    areaSel.disabled = false;
  }
});

areaSel.addEventListener("change", async () => {
  await loadActivities();
  plantSel.disabled = true;
  plantSel.innerHTML = "";
  if (!areaSel.value) return;
  //Only fetch Operational Plant / Machinery
  const { data } = await supabase
    .from("plant_machinery")
    .select("id,plant_name")
    .eq("area_id", areaSel.value)
    .eq("status","O");

  if (data?.length) {
    data.sort((a,b)=>
      a.plant_name.localeCompare(
      b.plant_name, undefined, { numeric:true, sensitivity:"base" }));
    populate(plantSel, data, "id", "plant_name", "-- Select Plant/Machinery --");
    plantSel.disabled = false;
  }
});

itemInput.addEventListener("change", async () => {
  const val = itemInput.value.trim();
  if (!Array.from(itemList.options).some(o=>o.value===val)) {
    await showAlert("Please select a valid item.");
    itemInput.value="";
    batchSel.disabled=true;
    batchSel.innerHTML="<option value=\"\">-- Select Batch Number --</option>";
    currentItemSkus=[];
    updateSections();
    return;
  }
  // batches
  const { data: bns } = await supabase
    .from("bmr_details").select("bn").eq("item", val).order("bn");
  const uniq = [...new Set(bns.map(r=>r.bn))].map(bn=>({bn}));
  populate(batchSel, uniq, "bn", "bn", "-- Select Batch Number --");
  batchSel.disabled = !uniq.length;
  // SKUs
  const { data: prod } = await supabase
    .from("products").select("id").eq("item", val).single();
  if (prod) {
    const { data: skus } = await supabase
      .from("product_skus")
      .select("id,pack_size,uom")
      .eq("product_id", prod.id)
      .eq("is_active", true)
      .order("pack_size");
    currentItemSkus = skus || [];
  } else currentItemSkus=[];
  updateSections();
});

batchSel.addEventListener("change", async () => {
  sizeInput.value = uomInput.value = "";
  if (!itemInput.value || !batchSel.value) return;
  const { data } = await supabase
    .from("bmr_details").select("batch_size,uom")
    .eq("item", itemInput.value).eq("bn", batchSel.value).limit(1);
  if (data?.length) {
    sizeInput.value = data[0].batch_size;
    uomInput.value  = data[0].uom;
  }
  updateSections();
});

activitySel.addEventListener("change", async () => {
  const actNorm      = (activitySel.value||"").trim().toLowerCase();
  const isStorageAct = ["intermediate storage","fg bulk storage"].includes(actNorm);

  // ─── Restrict Status options ───────────────────────────────────────────
  Array.from(statusSel.options).forEach(opt => {
    const v = opt.value;
    if (isStorageAct) {
      // only Done or In Storage allowed
      opt.disabled = !(v === "Done" || v === "In Storage");
    } else {
      // for non-storage activities, disallow In Storage
      opt.disabled = (v === "In Storage");
    }
  });
  // If the currently selected status is now disabled, clear it
  if (statusSel.value && statusSel.selectedOptions[0].disabled) {
    statusSel.value = "";
  }

  // ─── Finished Goods QA guard (existing logic) ─────────────────────────
  if (skuActivities.includes(actNorm) && itemInput.value && batchSel.value) {
    const { data: qa } = await supabase
      .from("daily_work_log")
      .select("id")
      .eq("item", itemInput.value)
      .eq("batch_number", batchSel.value)
      .eq("activity", "Finished Goods Quality Assessment")
      .eq("status", "Done")
      .limit(1);
    if (!qa?.length) {
      await showAlert(
        "Finished Goods Quality Assessment not completed for this batch."
      );
      activitySel.value = "";
    }
  }

  // ─── Recompute dates & show/hide sections ─────────────────────────────
  updateDueDate();
  updateSections();
});

statusSel.addEventListener("change", () => {
  const done = statusSel.value === "Done";

  if (done) {
    // Auto‑fill Completed On when switching into Done
    if (!compOnInput.value) {
      compOnInput.value = formatDMY(new Date());
    }
  } else {
    // Clear Completed On
    compOnInput.value = "";

    // Clear Post‑Processing fields
    const qtyInput = form.querySelector("input[name='qty_after_process']");
    const uomSelect = form.querySelector("select[name='qty_after_process_uom']");
    if (qtyInput)  qtyInput.value = "";
    if (uomSelect) uomSelect.value = "";
  }

  updateSections();
});

startInput.addEventListener("change", updateDueDate);
form.addEventListener("input", ()=>{ dirty=true; });

/* ──────────────────────────  SUBMIT HANDLER  ─────────────────────────── */
async function handleSubmit(isNew) {
  // 1) Basic HTML5 validation
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // 2) Derive flags
  const actNorm    = (activitySel.value || "").trim().toLowerCase();
  const isTransfer = actNorm === "transfer to fg store";
  const isDone     = statusSel.value === "Done";
  const isStorage  = statusSel.value === "In Storage";
  const doing      = statusSel.value === "Doing";

  // 3) Juice/Decoction required when visible
  if (doing && /juice|grinding|kashayam/.test(actNorm)) {
    if (!form.juice_or_decoction.value) {
      await showAlert("Please select Juice/Decoction type.");
      return;
    }
    if (!form.rm_juice_qty.value) {
      await showAlert("Please enter RM Qty.");
      return;
    }
    if (!form.rm_juice_uom.value) {
      await showAlert("Please select RM UOM.");
      return;
    }
  }

  // 4) Putam required when visible
  if (doing && /putam|gaja putam|seelamann/.test(actNorm)) {
    if (!form.count_of_saravam.value) {
      await showAlert("Please enter Count of Saravam.");
      return;
    }
    if (!form.fuel.value) {
      await showAlert("Please select Fuel Type.");
      return;
    }
    if (!form.fuel_under.value) {
      await showAlert("Please enter Fuel Under.");
      return;
    }
    if (!form.fuel_over.value) {
      await showAlert("Please enter Fuel Over.");
      return;
    }
  }

  // 5) Completed On required whenever Done
  if (isDone) {
    if (!form.completed_on.value) {
      await showAlert("Please enter Completed On date.");
      return;
    }
  }

  // 6) Lab Ref Number required for FG QA
  if (isDone && actNorm === "finished goods quality assessment") {
    if (!form.lab_ref_number.value) {
      await showAlert("Please enter Lab Ref Number.");
      return;
    }
  }

  // 7) SKU Breakdown must have at least one count > 0
  if (isDone && skuActivities.includes(actNorm)) {
    const skuInputs = Array.from(skuTableBody.querySelectorAll("input"));
    if (!skuInputs.some(i => +i.value > 0)) {
      await showAlert("Enter at least one SKU count greater than zero.");
      return;
    }
  }

  // 8) Storage Qty & UOM for FG bulk storage
  if (isStorage && actNorm === "fg bulk storage") {
    if (!storageQtyInput.value || !storageUomSel.value) {
      await showAlert(
        "Storage Qty and UOM are required when Activity is “FG bulk storage” and Status is “In Storage.”"
      );
      return;
    }
  }

  // 9) Transfer qty validations
  if (isDone && isTransfer) {
    const inputs = [...transferTableBody.querySelectorAll("input")];
    if (!inputs.some(i => +i.value > 0)) {
      inputs[0].setCustomValidity("Enter a Transfer Qty > 0.");
      inputs[0].reportValidity();
      inputs[0].setCustomValidity("");
      return;
    }
    for (const inp of inputs) {
      const cnt = +inp.value || 0, max = +inp.max || 0;
      if (cnt > max) {
        inp.setCustomValidity(`Cannot exceed on-hand (${max}).`);
        inp.reportValidity();
        inp.setCustomValidity("");
        return;
      }
    }
  }

  /* ---- Build payload -------------------------------------------------- */
  const row = {
    log_date           : toISO(form.log_date.value),
    section_id         : sectionSel.value,
    subsection_id      : subSel.value || null,
    area_id            : areaSel.value || null,
    plant_id           : plantSel.value || null,
    item               : itemInput.value,
    batch_number       : batchSel.value,
    batch_size         : sizeInput.value || null,
    batch_uom          : uomInput.value || null,
    activity           : activitySel.value,
    juice_or_decoction : form.juice_or_decoction?.value || null,
    specify            : form.specify?.value || null,
    rm_juice_qty       : form.rm_juice_qty?.value ? Number(form.rm_juice_qty.value) : null,
    rm_juice_uom       : form.rm_juice_uom?.value || null,
    count_of_saravam   : form.count_of_saravam?.value || null,
    fuel               : form.fuel?.value || null,
    fuel_under         : form.fuel_under?.value || null,
    fuel_over          : form.fuel_over?.value || null,
    started_on         : toISO(form.started_on?.value) || null,
    due_date           : toISO(form.due_date?.value) || null,
    status             : form.status?.value,
    storage_qty        : isStorage ? Number(storageQtyInput.value) || null : null,
    storage_qty_uom    : isStorage ? storageUomSel.value || null : null,
    completed_on       : toISO(form.completed_on?.value) || null,
    qty_after_process  : null,
    qty_uom            : null,
    sku_breakdown      : null,
    lab_ref_number     : form.lab_ref_number?.value || null,
    remarks            : form.remarks?.value || null,
    uploaded_by        : currentUserEmail
  };

  /* ---- Optional Qty/UOM ---------------------------------------------- */
  const needsQty = isDone
    && !skuActivities.includes(actNorm)
    && !["transfer to fg store", "finished goods quality assessment"].includes(actNorm);

  if (needsQty) {
    const qv = form.querySelector("[name=\"qty_after_process\"]").value;
    const uv = form.querySelector("[name=\"qty_after_process_uom\"]").value;
    if (!qv || !uv) {
      if (!await askConfirm("Qty After Process & UOM not entered. Continue?")) return;
    } else {
      row.qty_after_process = qv;
      row.qty_uom           = uv;
    }
  }

  /* ---- SKU / Transfer breakdown -------------------------------------- */
  if (isDone && skuActivities.includes(actNorm)) {
    const parts = [...skuTableBody.querySelectorAll("input")].map(i => {
      const cnt = +i.value;
      const sku = currentItemSkus.find(s => s.id == i.dataset.skuId);
      return cnt > 0 ? `${sku.pack_size} ${sku.uom} x ${cnt}` : null;
    }).filter(Boolean);
    row.sku_breakdown = parts.join("; ");
    row.qty_uom       = "Nos";
  }
  if (isDone && isTransfer) {
    const parts = [...transferTableBody.querySelectorAll("input")].map(i => {
      const cnt = +i.value;
      const sku = currentItemSkus.find(s => s.id == i.dataset.skuId);
      return cnt > 0 ? `${sku.pack_size} ${sku.uom} x ${cnt}` : null;
    }).filter(Boolean);
    row.sku_breakdown = parts.join("; ");
  }

    // ── PRE‑FLIGHT STOCK CHECK (multi‑SKU + tiny‑residual) ───────────────
  if (isDone && (skuActivities.includes(actNorm) || isTransfer)) {
    // 1) sum all pack_size × count
    let totalUnits = 0;
    const inputs = skuActivities.includes(actNorm)
      ? skuTableBody.querySelectorAll("input")
      : transferTableBody.querySelectorAll("input");
    inputs.forEach(i => {
      const cnt = Number(i.value) || 0;
      if (cnt > 0) {
        const sku = currentItemSkus.find(s => s.id == i.dataset.skuId);
        totalUnits += sku.pack_size * cnt;
      }
    });

    // 2) fetch conversion factor & base‑uom
    const { data: prod } = await supabase
      .from("products")
      .select("conversion_to_base,uom_base")
      .eq("item", row.item)
      .single();
    const factor = prod?.conversion_to_base || 1;

    // 3) compute total in base units
    const totalBase = totalUnits * factor;

    // 4) fetch current FG‑bulk stock from our view
    const { data: st } = await supabase
      .from("fg_bulk_stock")
      .select("qty_on_hand")
      .eq("item", row.item)
      .eq("bn",   row.batch_number)
      .single();
    const avail = st?.qty_on_hand ?? 0;

    // 5) allow a tiny epsilon (0.001); otherwise block
    const eps = 0.001;
    if (totalBase - avail > eps) {
      await showAlert(
        `Cannot package ${totalBase.toFixed(3)} ${prod.uom_base}; ` +
        `only ${avail.toFixed(3)} ${prod.uom_base} available.`
      );
      return;
    }
    // if it would leave a teeny bit (<eps), treat it as exact
    if (avail - totalBase < eps) {
      // automatically bump the qty to exactly avail so DB ends at zero
      totalUnits = avail / factor;
    }
  }

  /* ---- INSERT --------------------------------------------------------- */
  let newId;
  const { data, error } = await supabase
    .from("daily_work_log")
    .insert([row])
    .select("id");

  if (error) {
    console.error("Supabase error:", error);
    const isDup = error.code === "23505" ||
                  /duplicate key/i.test(error.message || "") ||
                  /duplicate key/i.test(error.details || "");
    await showAlert(isDup ? duplicateMessage(row)
                          : `Unexpected error: ${error.message || "see console"}`);
    return;
  }
  newId = data[0].id;

  /* ---- Packaging events ---------------------------------------------- */
  if (isDone && (skuActivities.includes(actNorm) || isTransfer)) {
    const { data: pe } = await supabase
      .from("packaging_events")
      .insert([{ work_log_id:newId, event_type:row.activity }])
      .select("id");
    if (pe?.length) {
      const inputs = skuActivities.includes(actNorm)
        ? skuTableBody.querySelectorAll("input")
        : transferTableBody.querySelectorAll("input");
      const evRows = [...inputs].map(i=>{
        const cnt=+i.value; if (cnt<=0) return null;
        return { packaging_event_id:pe[0].id, sku_id:+i.dataset.skuId, count:cnt };
      }).filter(Boolean);
      if (evRows.length) await supabase.from("event_skus").insert(evRows);
    }
  }

  /* ---- SUCCESS -------------------------------------------------------- */
  await showAlert("Log saved successfully!");
    // ← RESET dirty flag so “unsaved changes” won’t fire after saving
    dirty = false;
    
  if (isNew) {
    const p = new URLSearchParams();
    p.set("prefill_item", row.item);
    p.set("prefill_bn",   row.batch_number);
    window.location.href = `add-log-entry.html?${p.toString()}`;
  } else {
    form.reset();
    skuTableBody.innerHTML = transferTableBody.innerHTML = "";
    [compOnSection,postProcSection,labRefSection,skuSection,transferSection]
      .forEach(sec=>sec.style.display="none");
  }
}

form.addEventListener("submit",e=>{ e.preventDefault(); handleSubmit(false); });