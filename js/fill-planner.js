/***************************************************************************
 * fill‑planner.js  –  pivoted table with emergency SKU deduction
 ***************************************************************************/
import { supabase } from "./supabaseClient.js";

const $ = id => document.getElementById(id);

const elProd       = $("fp-product");
const elBulk       = $("fp-bulk");
const elUom        = $("fp-uom");
const elRunBtn     = $("fp-run");
const elMsg        = $("msg");
const elTable      = $("fp-table");
const elHead       = $("fp-head");
const elBody       = $("fp-body");
const homeBtn      = $("homeBtn");
const emgTitle = $("fp-emg-title");
const runWrap  = $("fp-run-wrap");
const fpTitle  = $("fp-title");
const emgBody      = $("fp-emg-body");
const emgTable     = $("fp-emg-table");
const metricsTitle = $("fp-metrics-title");
const metricsTable = $("fp-metrics-table");
const metricsHead  = $("fp-metrics-head");
const metricsBody  = $("fp-metrics-body");

/* ─── populate product list ───────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", async () => {
  const { data, error } = await supabase
    .from("products")
    .select("id,item,uom_base")
    .eq("status","Active")
    .order("item");

  if (error) { elMsg.textContent = error.message; return; }

  elProd.innerHTML =
    '<option value="">-- select --</option>' +
    data.map(p =>
      `<option value="${p.id}" data-uom="${p.uom_base}">${p.item}</option>`
    ).join("");
});

/* ─── update UOM & emergency dropdown on product change ───────────── */
elProd.addEventListener("change", async () => {

  /* 1 update the UOM label */
  const opt = elProd.selectedOptions[0];
  elUom.textContent = opt?.dataset.uom || "(base UOM)";

  /* 2 fetch active SKUs for this product */
  if (!elProd.value){
  emgBody.innerHTML = "";
  emgTable.style.display   = "none";
  emgTitle.style.display   = "none";
  runWrap.style.display    = "none";
  metricsTitle.style.display = "none";
  metricsTable.style.display = "none";
  fpTitle.style.display    = "none";
  fpTable.style.display    = "none";
  return;
}

  const { data: skus, error } = await supabase
    .from("product_skus")
    .select("id, pack_size, uom")
    .eq("product_id", elProd.value)
    .eq("is_active", true)
    .order("pack_size");

  if (error) { elMsg.textContent = error.message; emgBody.innerHTML=""; emgTable.style.display = "none"; return; }

  /* 3 build one row per SKU: label + Qty input */
  emgBody.innerHTML = (skus || []).map(s => `
    <tr>
      <td>${s.pack_size} ${s.uom}</td>
      <td><input class="emg-qty" data-sku-id="${s.id}"
                 type="number" min="0"></td>
    </tr>`).join("");

    emgTitle.style.display = "";
    emgTable.style.display = "";
    runWrap.style.display  = "";
    fpTitle.style.display = "";
  
  await loadMetrics(skus || []);
});

/* ─── helper: pack/UOM + price map for a set of SKU ids ────────────── */
async function fetchSkuInfo(skuIds) {
  if (!skuIds.length) return {};
  const { data, error } = await supabase
    .from("product_skus")
    .select(`
      id,
      pack_size,
      uom,
      sku_prices ( mrp_ik, mrp_ok )
    `)
    .in("id", skuIds);

  if (error) throw error;

  const out = {};
  data.forEach(r=>{
    out[r.id] = {
      label   : `${r.pack_size} ${r.uom}`,
      priceIK : r.sku_prices?.mrp_ik ?? null,
      priceOK : r.sku_prices?.mrp_ok ?? null
    };
  });
  return out;
}

/* ─── build the SKU Metrics table ────────────────────────────────── */
async function loadMetrics(skus){
  const ids = skus.map(s=>s.id);
  if (!ids.length){ metricsTitle.style.display="none";
                    metricsTable.style.display="none"; return; }

  /* 1) prices */
  const { data: priceRows } = await supabase
    .from("product_skus")
    .select("id, sku_prices(mrp_ik,mrp_ok)")
    .in("id", ids);
  const priceMap = {};
  (priceRows||[]).forEach(r=>{
    priceMap[r.id] = {
      ik : r.sku_prices?.mrp_ik ?? "—",
      ok : r.sku_prices?.mrp_ok ?? "—"
    };
  });

/* 2+3) stock & forecast from existing v_fill_inputs ------------------ */
const { data: vfRows, error: vfErr } = await supabase
  .from("v_fill_inputs")
  .select("sku_id, region_code, stock_units, forecast_units_pm")
  .eq("product_id", elProd.value)                 /* only this product */
  .in("region_code", ["IK","KKD","OK"]);          /* three depots     */

if (vfErr){ elMsg.textContent = vfErr.message; return; }

/* split into maps ---------------------------------------------------- */
const stockIK={}, stockOK={}, fsum={}, fcount={};

vfRows.forEach(r=>{
  /* STOCK ------------------------------------------------------------ */
  if (r.region_code === "OK"){
    stockOK[r.sku_id] = (stockOK[r.sku_id]||0) + (+r.stock_units||0);
  }else{                       /* IK + KKD combined */
    stockIK[r.sku_id] = (stockIK[r.sku_id]||0) + (+r.stock_units||0);
  }

  /* FORECAST (Average of all months in view) ------------------------- */
  const key = r.sku_id + "_" + r.region_code;
  if (r.forecast_units_pm != null){
    fsum[key]   = (fsum[key]  ||0) + (+r.forecast_units_pm);
    fcount[key] = (fcount[key]||0) + 1;
  }
});
const ave = k => fcount[k] ? Math.round(fsum[k] / fcount[k]) : "—";

  /* 4) render */
  metricsHead.innerHTML = `
    <tr>
      <th>SKU</th>
      <th>MRP&nbsp;IK</th><th>MRP&nbsp;OK</th>
      <th>Stock&nbsp;IK</th><th>Stock&nbsp;OK</th>
      <th>Forecast&nbsp;IK</th><th>Forecast&nbsp;OK</th>
    </tr>`;

  metricsBody.innerHTML = skus.map(s=>{
    const p = priceMap[s.id] || {};
    return `
      <tr>
        <td>${s.pack_size}&nbsp;${s.uom}</td>
        <td>${p.ik}</td><td>${p.ok}</td>
        <td>${(stockIK[s.id]||0)}</td><td>${(stockOK[s.id]||0)}</td>
        <td>${ave(s.id+"_IK")}</td><td>${ave(s.id+"_OK")}</td>
      </tr>`;
  }).join("");

  metricsTitle.style.display="";
  metricsTable.style.display="";
}

/* ─── Calculate button ─────────────────────────────────────────────── */
elRunBtn.addEventListener("click", async () => {
  elMsg.textContent = "";
  elBody.innerHTML  = "";
  elTable.style.display = "none";

  const prodId = +elProd.value;
  let   bulk   = +elBulk.value;
  const over   = $("fp-overshoot").checked;

  if (!prodId) { elMsg.textContent = "Choose a product."; return; }
  if (!bulk)   { elMsg.textContent = "Enter bulk quantity."; return; }


/* --- deduct emergency requirements (all rows) ---------------------- */
const qtyInputs = document.querySelectorAll(".emg-qty");

for (const inp of qtyInputs) {
  const qty   = +inp.value;
  const skuId = +inp.dataset.skuId;
  if (!qty || !skuId) continue;                // skip blank rows

  /* fetch pack_size & conversion_to_base */
  const { data: meta, error } = await supabase
    .from("product_skus")
    .select("pack_size, product:product_id ( conversion_to_base )")
    .eq("id", skuId)
    .single();
  if (error) { elMsg.textContent = error.message; return; }

  const unitMass = meta.pack_size * meta.product.conversion_to_base;
  const needBulk = qty * unitMass;

  /* guard – not enough bulk */
  if (needBulk > bulk + 1e-9) {
    elMsg.textContent =
      "Urgent quantities exceed available bulk. Reduce the numbers.";
    return;                                 // abort Calculate
  }
  bulk -= needBulk;                          // deduct
}

/* guard – bulk now zero */
if (bulk === 0) {
  elMsg.textContent =
    "Urgent orders consume the entire bulk—nothing left for planning.";
  return;                                    // skip calc_fill_plan
}

  elRunBtn.disabled = true;
  try {
    /* 1) RPC */
    const { data: plan, error } = await supabase.rpc("calc_fill_plan", {
      p_product_id     : prodId,
      p_bulk_base_qty  : bulk,
      p_allow_overshoot: over
    });
    if (error) throw error;
    if (!plan?.length) { elMsg.textContent = "Nothing to fill."; return; }

    /* 2) meta / price */
    const skuIds = [...new Set(plan.map(r=>r.sku_id))];
    const skuMap = await fetchSkuInfo(skuIds);

    /* 3) column order */
    const cols = skuIds
      .map(id=>({ id, label: skuMap[id]?.label || id }))
      .sort((a,b)=> parseFloat(a.label)-parseFloat(b.label));

    /* header */
    elHead.innerHTML =
      "<th>Region</th>" +
      cols.map(c=>`<th>${c.label}</th>`).join("") +
      "<th>MOS</th>";

    /* 4) group rows by region & render */
    const byRegion = {};
    plan.forEach(r=>{
      (byRegion[r.region_code] = byRegion[r.region_code] || {})[r.sku_id] = r;
    });

    elBody.innerHTML = Object.entries(byRegion).map(([region, skuRows])=>{
      const mos = Object.values(skuRows)[0].mos;
      const cells = cols.map(c=>{
        const row = skuRows[c.id];
        return row ? `<td>${row.units_to_fill}</td>` : "<td></td>";
      }).join("");
      return `<tr><td>${region}</td>${cells}<td>${mos.toFixed(2)}</td></tr>`;
    }).join("");

    elTable.style.display = "";
  } catch(err){
    elMsg.textContent = err.message || err;
  } finally {
    elRunBtn.disabled = false;
  }
});

/* ─── Home button ──────────────────────────────────────────────────── */
homeBtn.addEventListener("click", ()=> window.location.href="index.html");