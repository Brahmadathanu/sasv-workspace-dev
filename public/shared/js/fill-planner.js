/***************************************************************************
 * fill‑planner.js  –  pivoted table with emergency SKU deduction
 ***************************************************************************/
import { supabase } from "./supabaseClient.js";

const $ = id => document.getElementById(id);

const elProd       = $("fp-product");
const elBulk       = $("fp-bulk");
// global map for hybrid “type‑or‑select” product input
let productMap     = {};
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
const metricsHeader = $("fp-metrics-header");
const stockUpdated  = $("fp-stock-updated");

/* ─── make tables scrollable with sticky headers ─────────────────── */
function wrapTable(el) {
  const wrap = document.createElement('div');
  wrap.className = 'fp-table-wrap';
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  // keep wrapper hidden initially (tables already start hidden)
  wrap.style.display = 'none';
  return wrap;
}

const metricsWrap = wrapTable(metricsTable);  // SKU Metrics
const emgWrap     = wrapTable(emgTable);      // Urgent Orders
const planWrap    = wrapTable(elTable);       // Fill Plan

/* resize helpers: keep wrapper within viewport height */
function fitWrap(wrap) {
  if (!wrap || wrap.style.display === 'none' || wrap.offsetParent === null) return;

  const rect  = wrap.getBoundingClientRect();
  const gap   = 16;                                     // breathing room at bottom
  const avail = Math.max(200, window.innerHeight - rect.top - gap);
  wrap.style.maxHeight = `${avail}px`;

  /* toggle edge lines only if vertical scrollbar is present */
  if (wrap.scrollHeight > wrap.clientHeight + 1) {
    wrap.classList.add('has-scroll');
  } else {
    wrap.classList.remove('has-scroll');
  }
}
function fitVisibleWraps() {
  [metricsWrap, emgWrap, planWrap].forEach(fitWrap);
}
window.addEventListener('resize', fitVisibleWraps);

async function onProductInput() {
  const name = elProd.value.trim();
  const rec  = productMap[name];
  if (!rec) {
    // no valid product selected → hide all the downstream sections
    elUom.textContent =
  emgTitle.style.display =
  runWrap.style.display =
  metricsHeader.style.display =
  fpTitle.style.display =
    "none";

emgTable.style.display =
metricsTable.style.display =
elTable.style.display = "none";   // keep for safety

// hide wrappers too
emgWrap.style.display =
metricsWrap.style.display =
planWrap.style.display = "none";
    return;
  }

  // valid product!  show its UOM label
  elUom.textContent = rec.uom;

  // now fetch SKUs & metrics for rec.id
  await loadForProduct(rec.id);
}

/* ─── populate product list ───────────────────────────────────────── */

window.addEventListener("DOMContentLoaded", async () => {
  const { data, error } = await supabase
    .from("products")
    .select("id,item,uom_base")
    .eq("status","Active")
    .order("item");

  if (error) {
    elMsg.textContent = error.message;
    return;
  }
  // build a name→{id,uom} map and fill datalist
    productMap = {};

  // populate datalist and map
  const dl = document.getElementById("fp-product-list");
  dl.innerHTML = data.map(p => {
    productMap[p.item] = { id: p.id, uom: p.uom_base };
    return `<option value="${p.item}">`;
  }).join("");
});

/* ─── update UOM & emergency dropdown on product change ───────────── */
// when the user types or picks from the datalist:
elProd.addEventListener("input", onProductInput);

async function loadForProduct(productId) {
  // --- build your Urgent orders rows ---
  const { data: skus, error: skusErr } = await supabase
    .from("product_skus")
    .select("id, pack_size, uom")
    .eq("product_id", productId)   // <- use productId, not elProd.value
    .eq("is_active", true)
    .order("pack_size");
  if (skusErr) { elMsg.textContent = skusErr.message; return; }

  emgBody.innerHTML = skus.map(s=>`
    <tr>
      <td>${s.pack_size} ${s.uom}</td>
      <td><input class="emg-qty" data-sku-id="${s.id}" type="number" min="0"></td>
    </tr>
  `).join("");

  emgTitle.style.display = "";
emgTable.style.display = "";
emgWrap.style.display  = "";   // show wrapper
runWrap.style.display  = "";
fitVisibleWraps();

  // --- build your SKU Metrics ---
  await loadMetrics(skus, productId);

  // --- reveal your Fill Plan title, keep table hidden until calculate ---
  fpTitle.style.display = "";
  elTable.style.display = "";
planWrap.style.display = "";
fitVisibleWraps();
}

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
async function loadMetrics(skus, productId){
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
  .select("sku_id, region_code, godown_code, stock_units, forecast_units_pm")
  .eq("product_id", productId)                 /* only this product */
  .in("region_code", ["IK","KKD","OK"]);          /* three depots     */

if (vfErr){ elMsg.textContent = vfErr.message; return; }

// ─── split stock: IK, KKD, OK ────────────────────────────────
const stockIK  = {};   // Inver Kerala
const stockKKD = {};   // Kozhikode
const stockOK  = {};   // Out-Kerala
const fsum     = {};
const fcount   = {};

vfRows.forEach(r=>{
/* STOCK buckets ──────────────────────────────────────────── */
  /* ── STOCK by godown ─────────────────────────────────────────── */
  const g = (r.godown_code || "").trim().toUpperCase();

  if (g === "HO_IK") {                 // Inside-Kerala godown
    stockIK[r.sku_id]  = (stockIK[r.sku_id]  || 0) + (+r.stock_units || 0);

  } else if (g === "KKD") {            // Kozhikode Depot
    stockKKD[r.sku_id] = (stockKKD[r.sku_id] || 0) + (+r.stock_units || 0);

  } else if (g === "HO_OK") {          // Outside-Kerala godown
    stockOK[r.sku_id]  = (stockOK[r.sku_id]  || 0) + (+r.stock_units || 0);
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
    <th>Stock&nbsp;IK</th><th>Stock&nbsp;KKD</th><th>Stock&nbsp;OK</th>
    <th>Forecast&nbsp;IK</th><th>Forecast&nbsp;OK</th>
  </tr>`;

  metricsBody.innerHTML = skus.map(s => {
  const p = priceMap[s.id] || {};
  return `
    <tr>
      <td>${s.pack_size}&nbsp;${s.uom}</td>
      <td>${p.ik}</td><td>${p.ok}</td>
      <td>${stockIK[s.id]  || 0}</td>
      <td>${stockKKD[s.id] || 0}</td>
      <td>${stockOK[s.id]  || 0}</td>
      <td>${ave(s.id + "_IK")}</td>
      <td>${ave(s.id + "_OK")}</td>
    </tr>`;
  }).join("");

// fetch the most‑recent as_of_date for any of these SKUs
const { data: luRows, error: luErr } = await supabase
  .from('sku_stock_snapshot')
  .select('sku_id,as_of_date')
  .in('sku_id', ids)
  .order('as_of_date', { ascending: false })
  .limit(1);

if (luErr) {
    console.error('Unable to load stock snapshot:', luErr);
    elMsg.textContent = 'Could not load last stock update.';
  } else if (luRows?.length) {
    const dt = new Date(luRows[0].as_of_date);
    stockUpdated.textContent =
      `Last stock update: ${dt.toLocaleDateString('en-GB', {
        day:   'numeric',
        month: 'short',
        year:  'numeric'
      })}`;
    // make sure it’s visible
    stockUpdated.style.display = '';
  } else {
    // no snapshot rows → clear
    stockUpdated.textContent = '';
  }

  metricsHeader.style.display = "";
metricsTable.style.display  = "";
metricsWrap.style.display   = "";
fitVisibleWraps();
}

/* ─── Calculate button ─────────────────────────────────────────────── */
elRunBtn.addEventListener("click", async () => {
  elMsg.textContent = "";
  elBody.innerHTML  = "";
  elTable.style.display = "none";

  const rec    = productMap[ elProd.value.trim() ];
  if (!rec) {
    elMsg.textContent = "Choose a valid product.";
    return;
  }
  const prodId = rec.id;

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

/* ─── Platform-aware button (HOME in Electron, CLEAR in PWA) ───────── */
const runningInIframe = window.top !== window.self; // true only in PWA

if (runningInIframe) {
  homeBtn.textContent = 'CLEAR';
  homeBtn.addEventListener('click', () => {
    elProd.value = '';
    elBulk.value = '';
    onProductInput();            // collapse everything
  });
} else {
  // Electron: navigate two levels up to the app's real home page
  homeBtn.addEventListener('click', () => {
    window.location.href = '../../index.html';
  });
}