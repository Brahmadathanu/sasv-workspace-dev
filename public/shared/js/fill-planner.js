/***************************************************************************
 * fill‑planner.js  –  pivoted table with emergency SKU deduction
 ***************************************************************************/
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

const $ = (id) => document.getElementById(id);

/* ──────────────────────────────────────────────────────────────────────
   WORKINGS PANEL — math-style logging (headings + neat equation lines)
   ----------------------------------------------------------------------
   Usage (from later steps):
     wH("Inputs");
     wEq("Bulk (base units)", "", 8000);
     wDerive(["a = b × c = 10 × 5 = 50"]);
     wNote("✓ Copied.");
     wClear(); // to reset
────────────────────────────────────────────────────────────────────── */

// DOM refs (added in Step 1 HTML)
const wToggle = $("fp-workings-toggle");
const wPanel = $("fp-workings");
const wBody = $("fp-workings-body");
const wCopy = $("fp-workings-copy");
const wAuto = $("fp-workings-autoscroll");

// log buffer
let __work = [];

// number formatter (limits long floats)
const nfmt = (v) =>
  typeof v === "number" && isFinite(v) ? Math.round(v * 1000) / 1000 : v;

// section heading
function wH(title) {
  __work.push(`\n— ${title} —`);
  wRender();
}

// one-line equation: "Label: expr = value  → note"
function wEq(label, expr, value, note) {
  const L = label ? `${label}: ` : "";
  const E = expr ? `${expr} = ` : "";
  const V = value !== undefined && value !== null ? `${nfmt(value)}` : "";
  const N = note ? `  → ${note}` : "";
  __work.push(`${L}${E}${V}${N}`);
  wRender();
}

// multi-line derivation block (indented lines)
function wDerive(lines) {
  lines.forEach((line) => __work.push(`  ${line}`));
  wRender();
}

// plain note line (for remarks/errors)
function wNote(text) {
  __work.push(text);
  wRender();
}

// clear log
function wClear() {
  __work = [];
  wRender();
}

// open/close the <details> panel
function wOpen(open = true) {
  if (wPanel) wPanel.open = !!open;
}

// render into <pre>
function wRender() {
  if (!wBody) return;
  wBody.textContent = __work.join("\n");
  const box = wBody.parentElement; // scroll container
  if (wAuto?.checked && box) box.scrollTop = box.scrollHeight;
}
// show/hide the <details> wrapper (CSS display switch)
function wShow(show) {
  if (wPanel) wPanel.style.display = show ? "" : "none";
}

/* ─────────── Metrics cache for MOS math ───────────
   Will be filled in loadMetrics() and read in Calculate:
   metricsCache[productId] = {
     stock:    { IK: {skuId:units}, KKD:{}, OK:{} },
     stockIKplusKKD: { skuId: units }, // convenience for IK
     forecast: { IK: {skuId:units_pm}, OK:{skuId:units_pm} },
     as_of_date: "YYYY-MM-DD" | ""
   }
*/
const metricsCache = Object.create(null);

// UI wiring
wToggle?.addEventListener("click", () => wOpen(!wPanel.open));
wCopy?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(wBody?.textContent || "");
    wNote("✓ Copied.");
  } catch {
    wNote("✗ Copy failed.");
  }
});

// (Optional test line — uncomment to verify the panel updates on load)
// wNote("Workings panel is ready.");

const elProdInput = $("fp-product-input"); // the visible input
const elProdList = $("fp-product-list"); // the <datalist>
const elBulk = $("fp-bulk");
const elUom = $("fp-uom");
const elRunBtn = $("fp-run");
const elMsg = $("msg");
const elTable = $("fp-table");
const elHead = $("fp-head");
const elBody = $("fp-body");
const homeBtn = $("homeBtn");
const clearBtn = $("fp-clear");
const emgTitle = $("fp-emg-title");
const runWrap = $("fp-run-wrap");
const fpTitle = $("fp-title");
const emgBody = $("fp-emg-body");
const emgTable = $("fp-emg-table");
const metricsTitle = $("fp-metrics-title");
const metricsTable = $("fp-metrics-table");
const metricsHead = $("fp-metrics-head");
const metricsBody = $("fp-metrics-body");
const metricsHeader = $("fp-metrics-header");
const stockUpdated = $("fp-stock-updated");
const metricsWrap = wrapTable(metricsTable); // SKU Metrics
const emgWrap = wrapTable(emgTable); // Urgent Orders
const planWrap = wrapTable(elTable); // Fill Plan

let allProducts = [];
let productMap = {}; // id -> { name, uom }
let productByName = {}; // lowercase name -> { id, uom }

initProductList();

// When user finishes typing or picks an option, resolve -> product id
elProdInput.addEventListener("change", resolveAndGo);
elProdInput.addEventListener("blur", resolveAndGo);
elProdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    resolveAndGo();
  }
});

function resolveAndGo() {
  const typed = (elProdInput.value || "").trim().toLowerCase();
  const hit = typed ? productByName[typed] : null;

  if (hit) {
    // store chosen id on the input
    elProdInput.dataset.id = hit.id;
    // set the UOM immediately (nice UX)
    const rec = productMap[hit.id];
    if (rec) elUom.textContent = rec.uom || "(base UOM)";
    // drive the rest
    onProductSelect();
    // move focus to Bulk for convenience
    $("fp-bulk")?.focus();
  } else {
    // unknown text → clear selection and collapse UI
    delete elProdInput.dataset.id;
    onProductSelect(); // will hide the downstream sections
  }
}

function clearPlanner() {
  // clear the type-to-search input + chosen id
  elProdInput.value = "";
  delete elProdInput.dataset.id;

  // clear downstream
  elBulk.value = "";
  elUom.textContent = "(base UOM)";
  elRunBtn.disabled = true;

  // wipe workings panel
  wClear();
  wShow(false);

  // collapse sections
  onProductSelect(); // this already hides tables/sections
}

/* ─── make tables scrollable with sticky headers ─────────────────── */
function wrapTable(el) {
  const wrap = document.createElement("div");
  wrap.className = "fp-table-wrap";
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  // keep wrapper hidden initially (tables already start hidden)
  wrap.style.display = "none";
  return wrap;
}

// Load ALL products once and populate the datalist
async function initProductList() {
  // show a temporary option while loading (harmless in datalist)
  elProdList.innerHTML = `<option value="Loading…"></option>`;

  const { data, error } = await supabase
    .from("products")
    .select("id,item,uom_base,status")
    .eq("status", "Active")
    .order("item");

  if (error) {
    console.error("Product load error:", error);
    elMsg.textContent = "Failed to load products.";
    elProdList.innerHTML = "";
    return;
  }

  allProducts = data || [];
  productMap = {};
  productByName = {};

  // Build <option>s for the datalist and the lookup maps
  const opts = [];
  allProducts.forEach((p) => {
    const name = p.item || "";
    opts.push(`<option value="${escapeHtml(name)}"></option>`);
    productMap[p.id] = { name, uom: p.uom_base };
    productByName[name.toLowerCase()] = { id: String(p.id), uom: p.uom_base };
  });
  elProdList.innerHTML = opts.join("");
}

// tiny helper to safely inject text into HTML
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* resize helpers: keep wrapper within viewport height */
function fitWrap(wrap) {
  if (!wrap || wrap.style.display === "none" || wrap.offsetParent === null)
    return;

  const rect = wrap.getBoundingClientRect();
  const gap = 16; // breathing room at bottom
  const avail = Math.max(200, window.innerHeight - rect.top - gap);
  wrap.style.maxHeight = `${avail}px`;

  /* toggle edge lines only if vertical scrollbar is present */
  if (wrap.scrollHeight > wrap.clientHeight + 1) {
    wrap.classList.add("has-scroll");
  } else {
    wrap.classList.remove("has-scroll");
  }
}
function fitVisibleWraps() {
  [metricsWrap, emgWrap, planWrap].forEach(fitWrap);
}
window.addEventListener("resize", fitVisibleWraps);

async function onProductSelect() {
  const prodId = elProdInput.dataset.id || "";
  const rec = prodId ? productMap[prodId] : null;
  // reset the workings log whenever product changes
  wClear();
  wShow(false);
  if (!rec) {
    wNote("Product cleared.");
  } else {
    wH("Inputs");
    wEq(
      "Product",
      `${rec.name || "(unknown)"}`,
      null,
      `id = ${prodId}, UOM = ${rec.uom || "(base)"}`
    );
  }
  if (!rec) {
    // hide all downstream, as before
    elUom.textContent =
      emgTitle.style.display =
      runWrap.style.display =
      metricsHeader.style.display =
      fpTitle.style.display =
        "none";
    emgTable.style.display =
      metricsTable.style.display =
      elTable.style.display =
        "none";
    emgWrap.style.display =
      metricsWrap.style.display =
      planWrap.style.display =
        "none";
    return;
  }
  elUom.textContent = rec.uom;
  await loadForProduct(prodId);
}

/* ─── update UOM & emergency dropdown on product change ───────────── */

async function loadForProduct(productId) {
  wH("Scope");
  wEq("Loading SKUs for product", "product_id", productId);
  // --- build your Urgent orders rows ---
  const { data: skus, error: skusErr } = await supabase
    .from("product_skus")
    .select("id, pack_size, uom")
    .eq("product_id", productId) // <- use productId, not elProd.value
    .eq("is_active", true)
    .order("pack_size");
  if (skusErr) {
    elMsg.textContent = skusErr.message;
    return;
  }

  emgBody.innerHTML = skus
    .map(
      (s) => `
    <tr>
      <td>${s.pack_size} ${s.uom}</td>
      <td><input class="emg-qty" data-sku-id="${s.id}" type="number" min="0"></td>
    </tr>
  `
    )
    .join("");

  emgTitle.style.display = "";
  emgTable.style.display = "";
  emgWrap.style.display = ""; // show wrapper
  runWrap.style.display = "";
  fitVisibleWraps();

  // --- build your SKU Metrics ---
  await loadMetrics(skus, productId);

  // --- reveal your Fill Plan title, keep table hidden until calculate ---
  fpTitle.style.display = "";
  elTable.style.display = "";
  planWrap.style.display = "";
  fitVisibleWraps();
}

/* ─── helper: pack/UOM + price + conversion_to_base for a set of SKU ids ─── */
async function fetchSkuInfo(skuIds) {
  if (!skuIds.length) return {};
  const { data, error } = await supabase
    .from("product_skus")
    .select(
      `
      id,
      pack_size,
      uom,
      product:product_id ( conversion_to_base ),
      sku_prices ( mrp_ik, mrp_ok )
    `
    )
    .in("id", skuIds);

  if (error) throw error;

  const out = {};
  data.forEach((r) => {
    out[r.id] = {
      label: `${r.pack_size} ${r.uom}`,
      packSize: r.pack_size,
      convBase: r.product?.conversion_to_base ?? 1,
      priceIK: r.sku_prices?.mrp_ik ?? null,
      priceOK: r.sku_prices?.mrp_ok ?? null,
    };
  });
  return out;
}

/* ─── build the SKU Metrics table ────────────────────────────────── */
async function loadMetrics(skus, productId) {
  const ids = skus.map((s) => s.id);
  if (!ids.length) {
    metricsTitle.style.display = "none";
    metricsTable.style.display = "none";
    return;
  }

  /* 1) prices */
  const { data: priceRows } = await supabase
    .from("product_skus")
    .select("id, sku_prices(mrp_ik,mrp_ok)")
    .in("id", ids);
  const priceMap = {};
  (priceRows || []).forEach((r) => {
    priceMap[r.id] = {
      ik: r.sku_prices?.mrp_ik ?? "—",
      ok: r.sku_prices?.mrp_ok ?? "—",
    };
  });

  /* 2+3) stock & forecast from existing v_fill_inputs ------------------ */
  const { data: vfRows, error: vfErr } = await supabase
    .from("v_fill_inputs")
    .select("sku_id, region_code, godown_code, stock_units, forecast_units_pm")
    .eq("product_id", productId);

  if (vfErr) {
    elMsg.textContent = vfErr.message;
    return;
  }

  // ─── split stock: IK, KKD, OK ────────────────────────────────
  const stockIK = {}; // HO_IK
  const stockKKD = {}; // KKD
  const stockOK = {}; // HO_OK

  // region-level forecast (IK/OK) via region rows (godown_code IS NULL)
  const fsumRegion = {};
  const fcountRegion = {};

  // depot-level forecast (KKD) via depot row (godown_code='KKD')
  const fsumKKD = {};
  const fcountKKD = {};

  vfRows.forEach((r) => {
    const sku = r.sku_id;
    const reg = (r.region_code || "").trim().toUpperCase();
    const god = (r.godown_code || "").trim().toUpperCase();

    // ── STOCK by depot
    if (god === "HO_IK") {
      stockIK[sku] = (stockIK[sku] || 0) + (+r.stock_units || 0);
    } else if (god === "KKD") {
      stockKKD[sku] = (stockKKD[sku] || 0) + (+r.stock_units || 0);
    } else if (god === "HO_OK") {
      stockOK[sku] = (stockOK[sku] || 0) + (+r.stock_units || 0);
    }

    // ── FORECAST
    // Region roll-up rows: godown_code IS NULL → use for IK / OK
    if (!god) {
      const key = `${sku}_${reg}`;
      if (r.forecast_units_pm != null) {
        fsumRegion[key] = (fsumRegion[key] || 0) + +r.forecast_units_pm;
        fcountRegion[key] = (fcountRegion[key] || 0) + 1;
      }
    }

    // Depot KKD row: godown_code='KKD' → use for "Forecast KKD" column
    if (god === "KKD" && r.forecast_units_pm != null) {
      fsumKKD[sku] = (fsumKKD[sku] || 0) + +r.forecast_units_pm;
      fcountKKD[sku] = (fcountKKD[sku] || 0) + 1;
    }

    // (Note: HO_OK depot forecast equals OK region forecast, but we keep OK from region roll-up for consistency.)
  });
  const aveRegion = (sku, region) => {
    const key = `${sku}_${region}`;
    return fcountRegion[key]
      ? Math.round(fsumRegion[key] / fcountRegion[key])
      : "—";
  };
  const aveKKD = (sku) =>
    fcountKKD[sku] ? Math.round(fsumKKD[sku] / fcountKKD[sku]) : "—";

  // pretty printer for MOS cells
  const fmtMOS = (x) => (Number.isFinite(x) ? nfmt(x) : "—");

  /* ── Build and cache metrics for later MOS math ── */
  const forecastIK = {};
  const forecastOK = {};
  const forecastKKD = {};

  skus.forEach((s) => {
    // region-level (from roll-up rows)
    forecastIK[s.id] =
      aveRegion(s.id, "IK") === "—" ? 0 : aveRegion(s.id, "IK");
    forecastOK[s.id] =
      aveRegion(s.id, "OK") === "—" ? 0 : aveRegion(s.id, "OK");
    // depot-level (KKD) for the UI column
    const k = aveKKD(s.id);
    forecastKKD[s.id] = k === "—" ? 0 : k;
  });

  const stockIKplusKKD = {};
  skus.forEach((s) => {
    stockIKplusKKD[s.id] = (stockIK[s.id] || 0) + (stockKKD[s.id] || 0);
  });

  metricsCache[productId] = {
    stock: { IK: stockIK, KKD: stockKKD, OK: stockOK },
    stockIKplusKKD,
    forecast: { IK: forecastIK, KKD: forecastKKD, OK: forecastOK }, // KKD added (UI only)
    as_of_date: "",
  };

  /* ── Log a compact, human-readable metrics snapshot ── */
  wH("SKU Metrics (inputs used)");
  skus.forEach((s) => {
    const id = s.id;
    const label = `${s.pack_size} ${s.uom}`;
    const stIK = stockIK[id] || 0;
    const stK = stockKKD[id] || 0;
    const stOK = stockOK[id] || 0;
    const fIK = forecastIK[id] || 0;
    const fOK = forecastOK[id] || 0;
    const fKKD = forecastKKD[id] || 0;
    wDerive([
      `${label}`,
      `  Stock_IK = ${stIK}, Stock_KKD = ${stK}, Stock_OK = ${stOK}`,
      `  Forecast_IK ≈ ${nfmt(fIK)}, Forecast_KKD ≈ ${nfmt(
        fKKD
      )}, Forecast_OK ≈ ${nfmt(fOK)}`,
    ]);
  });

  /* 4) render */
  metricsHead.innerHTML = `
  <tr>
    <th>SKU</th>
    <th>MRP&nbsp;IK</th><th>MRP&nbsp;OK</th>
    <th>Stock&nbsp;IK</th><th>Stock&nbsp;KKD</th><th>Stock&nbsp;OK</th>
    <th>Forecast&nbsp;IK</th><th>Forecast&nbsp;KKD</th><th>Forecast&nbsp;OK</th>
    <th>MOS&nbsp;IK</th><th>MOS&nbsp;KKD</th><th>MOS&nbsp;OK</th>
  </tr>`;

  metricsBody.innerHTML = skus
    .map((s) => {
      const p = priceMap[s.id] || {};

      // stocks
      const stIK = stockIK[s.id] || 0;
      const stKKD = stockKKD[s.id] || 0;
      const stOK = stockOK[s.id] || 0;

      // forecasts (you already prepared numeric values earlier)
      const fIK = forecastIK[s.id] || 0;
      const fKKD = forecastKKD[s.id] || 0;
      const fOK = forecastOK[s.id] || 0;

      // Convention used elsewhere in your code:
      //   IK MOS uses IK + KKD as the stock numerator.
      const mosIK = fIK ? (stIK + stKKD) / fIK : NaN;
      const mosKKD = fKKD ? stKKD / fKKD : NaN;
      const mosOK = fOK ? stOK / fOK : NaN;

      return `
      <tr>
        <td>${s.pack_size}&nbsp;${s.uom}</td>
        <td>${p.ik}</td><td>${p.ok}</td>
        <td>${stIK}</td>
        <td>${stKKD}</td>
        <td>${stOK}</td>
        <td>${aveRegion(s.id, "IK")}</td>
        <td>${aveKKD(s.id)}</td>
        <td>${aveRegion(s.id, "OK")}</td>
        <td>${fmtMOS(mosIK)}</td>
        <td>${fmtMOS(mosKKD)}</td>
        <td>${fmtMOS(mosOK)}</td>
      </tr>`;
    })
    .join("");

  // fetch the most‑recent as_of_date for any of these SKUs
  const { data: luRows, error: luErr } = await supabase
    .from("sku_stock_snapshot")
    .select("sku_id,as_of_date")
    .in("sku_id", ids)
    .order("as_of_date", { ascending: false })
    .limit(1);

  if (luErr) {
    console.error("Unable to load stock snapshot:", luErr);
    elMsg.textContent = "Could not load last stock update.";
  } else if (luRows?.length) {
    const dt = new Date(luRows[0].as_of_date);
    stockUpdated.textContent = `Last stock snapshot: ${dt.toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    )}`;
    // make sure it’s visible
    stockUpdated.style.display = "";
    // Cache and log the snapshot date too
    const dstr = dt.toISOString().slice(0, 10);
    if (metricsCache[productId]) metricsCache[productId].as_of_date = dstr;
    wEq("Stock snapshot as_of_date", "", dstr);
  } else {
    // no snapshot rows → clear
    stockUpdated.textContent = "";
  }

  metricsHeader.style.display = "";
  metricsTable.style.display = "";
  metricsWrap.style.display = "";
  fitVisibleWraps();
}

/* ─── Calculate button ─────────────────────────────────────────────── */
elRunBtn.addEventListener("click", async () => {
  elMsg.textContent = "";
  elBody.innerHTML = "";
  elTable.style.display = "none";
  wClear();
  wShow();

  const prodId = elProdInput.dataset.id || "";
  const rec = prodId ? productMap[prodId] : null;
  if (!rec) {
    elMsg.textContent = "Choose a valid product.";
    return;
  }

  let bulk = +elBulk.value;
  const over = $("fp-overshoot").checked;

  wH("Planning Inputs");
  wEq("Bulk (base units)", "", +elBulk.value);
  wEq("Allow overshoot", "", over ? "Yes" : "No");

  if (!prodId) {
    elMsg.textContent = "Choose a product.";
    return;
  }
  if (!bulk) {
    elMsg.textContent = "Enter bulk quantity.";
    return;
  }

  /* --- deduct emergency requirements (all rows) ---------------------- */
  const qtyInputs = document.querySelectorAll(".emg-qty");

  for (const inp of qtyInputs) {
    const qty = +inp.value;
    const skuId = +inp.dataset.skuId;
    if (!qty || !skuId) continue; // skip blank rows

    /* fetch pack_size & conversion_to_base */
    const { data: meta, error } = await supabase
      .from("product_skus")
      .select("pack_size, product:product_id ( conversion_to_base )")
      .eq("id", skuId)
      .single();
    if (error) {
      elMsg.textContent = error.message;
      return;
    }

    const unitMass = meta.pack_size * meta.product.conversion_to_base;
    const needBulk = qty * unitMass;

    wH("Emergency Deduction");
    wDerive([
      `base_per_pack = pack_size × conv_to_base = ${nfmt(
        meta.pack_size
      )} × ${nfmt(meta.product.conversion_to_base)} = ${nfmt(unitMass)}`,
      `bulk_needed   = qty_packs × base_per_pack = ${nfmt(qty)} × ${nfmt(
        unitMass
      )} = ${nfmt(needBulk)}`,
      `bulk_after    = bulk_before − bulk_needed = ${nfmt(bulk)} − ${nfmt(
        needBulk
      )} = ${nfmt(bulk - needBulk)}`,
    ]);

    /* guard – not enough bulk */
    if (needBulk > bulk + 1e-9) {
      elMsg.textContent =
        "Urgent quantities exceed available bulk. Reduce the numbers.";
      wNote("✗ Urgent quantities exceed available bulk.");
      return; // abort Calculate
    }
    bulk -= needBulk; // deduct
  }

  /* guard – bulk now zero */
  if (bulk === 0) {
    elMsg.textContent =
      "Urgent orders consume the entire bulk—nothing left for planning.";
    return; // skip calc_fill_plan
  }

  wH("Remaining Bulk After Deductions");
  wEq("bulk_remaining (base units)", "", bulk);

  elRunBtn.disabled = true;
  try {
    /* 1) RPC */
    wH("Allocation Call");
    wDerive([
      `calc_fill_plan( p_product_id = ${prodId},`,
      `                p_bulk_base_qty = ${nfmt(bulk)},`,
      `                p_allow_overshoot = ${over ? "TRUE" : "FALSE"} )`,
    ]);
    const { data: plan, error } = await supabase.rpc("calc_fill_plan", {
      p_product_id: +prodId,
      p_bulk_base_qty: +bulk,
      p_allow_overshoot: !!over,
      p_debug: false, // disable diagnostics for cleaner output
    });
    if (error) throw error;
    if (!plan?.length) {
      wH("No Allocation");
      elMsg.textContent =
        "Nothing to fill (all SKUs already at/above target or bulk too small for any pack).";
      return;
    }
    /* ── Show the panel now that we have something meaningful to display ── */
    wShow(true);

    /* ── MOS target: use what the function computed (dynamic) ── */
    const mosTarget = plan && plan.length ? Number(plan[0].mos) : null;
    if (isFinite(mosTarget)) {
      wH("Allocation Rules (reference)");
      wDerive([
        "MOS_before(region,sku) = stock ÷ forecast",
        "MOS_target = (bulk + Σ stock×base_per_pack) ÷ Σ forecast×base_per_pack",
        `  = ${nfmt(mosTarget)} (global target)`,
        "Region totals used: prefer region roll-up rows (godown_code IS NULL); else sum depots (no double counting)",
        "Per-SKU MOS gain per pack ≈ min(MOS_gap, pack_base/forecast) / pack_base",
        "Soft region cap: gain scaled by (Target MOS − Region MOS, floored at 0)",
        "  Note: region MOS for the cap uses unit-based sums; the table's Achieved MOS is base-weighted, so they can differ slightly",
        "Greedy loop: choose candidate with highest scaled gain per base (tie: higher forecast, smaller pack)",
        "Trim (if overshoot=FALSE): remove packs with smallest MOS loss per base (≈1/forecast)",
        "Discrete packs cause achieved MOS to vary around target.",
      ]);
      wDerive([
        "(Layman) We aim for one common months-of-stock number.",
        "We prefer SKUs in regions still below target; regions already above target get deprioritized.",
        "We keep adding whole packs while bulk remains, then (if needed) remove the least harmful ones to fit.",
      ]);
    } else {
      // fallback (unlikely) — keep rules without a numeric target
      wH("Allocation Rules (reference)");
      wDerive([
        "MOS_before(region,sku) = stock ÷ forecast",
        "MOS_target = (bulk + Σ stock×base_per_pack) ÷ Σ forecast×base_per_pack",
        "Region totals used: prefer region roll-up rows (godown_code IS NULL); else sum depots (no double counting)",
        "Per-SKU MOS gain per pack ≈ min(MOS_gap, pack_base/forecast) / pack_base",
        "Soft region cap: gain scaled by (Target MOS − Region MOS, floored at 0)",
        "  Note: region MOS for the cap uses unit-based sums; the table's Achieved MOS is base-weighted, so they can differ slightly",
        "Greedy loop: choose candidate with highest scaled gain per base (tie: higher forecast, smaller pack)",
        "Trim (if overshoot=FALSE): remove packs with smallest MOS loss per base (≈1/forecast)",
        "Discrete packs cause achieved MOS to vary around target.",
      ]);
    }

    /* 2) meta / price for SKUs present in the plan */
    const skuIds = [...new Set(plan.map((r) => r.sku_id))];
    const skuMap = await fetchSkuInfo(skuIds);

    /* Pull cached metrics for this product */
    const m = metricsCache[prodId] || {
      stock: { IK: {}, KKD: {}, OK: {} },
      stockIKplusKKD: {},
      forecast: { IK: {}, OK: {} },
      as_of_date: "",
    };

    function stockFor(region, skuId) {
      if (region === "IK") return m.stockIKplusKKD[skuId] || 0;
      if (region === "OK") return m.stock.OK[skuId] || 0;
      if (region === "KKD") return m.stock.KKD[skuId] || 0;
      return 0;
    }
    function forecastFor(region, skuId) {
      if (region === "IK") return m.forecast.IK[skuId] || 0;
      if (region === "OK") return m.forecast.OK[skuId] || 0;
      return 0;
    }
    const safeDiv = (a, b) => (b ? a / b : 0);

    /* Summarize plan and show MOS math per region & SKU */
    wH("Allocation Result (per region & SKU)");
    const perRegion = {};
    let totalPacks = 0;
    plan.forEach((r) => {
      const label = skuMap[r.sku_id]?.label || r.sku_id;
      (perRegion[r.region_code] ||= []).push({
        skuId: r.sku_id,
        label,
        units: r.units_to_fill,
        mos_after: r.mos, // server's mos (target) is the same for all rows
      });
      totalPacks += r.units_to_fill || 0;
    });

    /* base_per_pack per SKU for bulk audit */
    const basePerPack = {};
    skuIds.forEach((id) => {
      const s = skuMap[id];
      basePerPack[id] = s ? s.packSize * (s.convBase || 1) : 0;
    });

    /* Print equations for each region/SKU (using dynamic mosTarget) */
    Object.entries(perRegion).forEach(([region, rows]) => {
      wNote(`Region ${region}`);
      rows.forEach((x) => {
        const f = forecastFor(region, x.skuId);
        const st = stockFor(region, x.skuId);
        const mosBefore = safeDiv(st, f);
        const fill = x.units || 0;
        const mosAfterCalc = f ? safeDiv(st + fill, f) : 0;

        wDerive([
          `MOS_before(${x.label}) = stock ÷ forecast = ${nfmt(st)} ÷ ${nfmt(
            f
          )} = ${nfmt(mosBefore)}`,
          `units_to_fill(${x.label}) = ${nfmt(fill)}  → Target MOS = ${nfmt(
            x.mos_after
          )}  |  Achieved MOS (this SKU) = ${nfmt(mosAfterCalc)}`,
        ]);
      });
    });
    wEq("Total packs to fill", "", totalPacks);

    /* Bulk audit: trust server's used_base_qty (sum over rows) */
    const usedBase = plan.reduce((sum, r) => sum + (+r.used_base_qty || 0), 0);
    wEq(
      "Bulk used by plan (base units)",
      "",
      usedBase,
      "from server (should ≤ remaining bulk unless overshoot)"
    );

    // Global MOS check (base units) — should be close to Target MOS
    try {
      const allSkuIds = Array.from(
        new Set([
          ...Object.keys(m.forecast?.IK || {}),
          ...Object.keys(m.forecast?.OK || {}),
        ])
      )
        .map((x) => +x)
        .filter((x) => Number.isFinite(x));
      const skuInfoAll = await fetchSkuInfo(allSkuIds);
      const basePerPackAll = {};
      allSkuIds.forEach((id) => {
        const s = skuInfoAll[id];
        basePerPackAll[id] = s ? s.packSize * (s.convBase || 1) : 0;
      });
      let totalStockBase = 0;
      let totalForecastBase = 0;
      const addTotals = (region) => {
        allSkuIds.forEach((id) => {
          const st = stockFor(region, id) || 0;
          const f = forecastFor(region, id) || 0;
          const bpp = basePerPackAll[id] || 0;
          totalStockBase += st * bpp;
          totalForecastBase += f * bpp;
        });
      };
      addTotals("IK");
      addTotals("OK");
      const mosAfterGlobal = totalForecastBase
        ? (totalStockBase + usedBase) / totalForecastBase
        : 0;
      wH("Global MOS check");
      wDerive([
        `total_stock_base = Σ(stock × base_per_pack) = ${nfmt(totalStockBase)}`,
        `total_forecast_base = Σ(forecast × base_per_pack) = ${nfmt(
          totalForecastBase
        )}`,
        `MOS_after(global) = (total_stock_base + used_base_qty) ÷ total_forecast_base = (${nfmt(
          totalStockBase
        )} + ${nfmt(usedBase)}) ÷ ${nfmt(totalForecastBase)} = ${nfmt(
          mosAfterGlobal
        )}  ≈ Target MOS ${nfmt(mosTarget)}`,
      ]);
    } catch {
      // Non-fatal if this approximation can't be computed
    }

    /* 3) column order */
    const cols = skuIds
      .map((id) => ({ id, label: skuMap[id]?.label || id }))
      .sort((a, b) => parseFloat(a.label) - parseFloat(b.label));

    /* header */
    elHead.innerHTML =
      "<th>Region</th>" +
      cols.map((c) => `<th>${c.label}</th>`).join("") +
      "<th>Target MOS</th><th>Achieved MOS</th>";

    /* 4) group rows by region & render */
    const byRegion = {};
    plan.forEach((r) => {
      (byRegion[r.region_code] = byRegion[r.region_code] || {})[r.sku_id] = r;
    });

    // Compute achieved MOS per region using ALL SKUs (prevents inflation when only some SKUs are in the plan)
    // Achieved MOS(region) = (Σ_all stock×bpp + Σ_plan fill×bpp) ÷ Σ_all forecast×bpp
    const achievedByRegion = {};
    // Build a quick lookup for plan fills by (region, sku)
    const fillLookup = {};
    Object.entries(byRegion).forEach(([region, skuRows]) => {
      Object.entries(skuRows).forEach(([skuId, row]) => {
        fillLookup[`${region}_${+skuId}`] = row.units_to_fill || 0;
      });
    });
    // Determine the full SKU universe we have metrics for (IK and OK)
    const allSkuIds = Array.from(
      new Set([
        ...Object.keys(m.forecast?.IK || {}),
        ...Object.keys(m.forecast?.OK || {}),
      ])
    )
      .map((x) => +x)
      .filter((x) => Number.isFinite(x));
    const skuInfoAll = await fetchSkuInfo(allSkuIds);
    const basePerPackAll = {};
    allSkuIds.forEach((id) => {
      const s = skuInfoAll[id];
      basePerPackAll[id] = s ? s.packSize * (s.convBase || 1) : 0;
    });
    ["IK", "OK"].forEach((region) => {
      let sumStockBase = 0,
        sumForecastBase = 0,
        sumFillBase = 0;
      allSkuIds.forEach((id) => {
        const bpp = basePerPackAll[id] || 0;
        const st = stockFor(region, id) || 0;
        const f = forecastFor(region, id) || 0;
        const fill = fillLookup[`${region}_${id}`] || 0;
        sumStockBase += st * bpp;
        sumForecastBase += f * bpp;
        sumFillBase += fill * bpp;
      });
      achievedByRegion[region] = sumForecastBase
        ? (sumStockBase + sumFillBase) / sumForecastBase
        : 0;
    });

    // Clarify table meaning for layman readers
    wNote(
      "Table note: Target MOS is global from the server; Achieved MOS per region = (Σ_all stock×base_per_pack + Σ_plan fill×base_per_pack) ÷ Σ_all forecast×base_per_pack."
    );

    elBody.innerHTML = Object.entries(byRegion)
      .map(([region, skuRows]) => {
        const mos = Object.values(skuRows)[0].mos;
        const achieved = achievedByRegion[region] || 0;
        const cells = cols
          .map((c) => {
            const row = skuRows[c.id];
            return row ? `<td>${row.units_to_fill}</td>` : "<td></td>";
          })
          .join("");
        return `<tr><td>${region}</td>${cells}<td>${mos.toFixed(
          2
        )}</td><td>${achieved.toFixed(2)}</td></tr>`;
      })
      .join("");

    elTable.style.display = "";
  } catch (err) {
    wH("Error");
    const msg = err?.message || err;
    const det = err?.details || err?.hint || "";
    wNote(String(msg));
    if (det) wNote(String(det));
    elMsg.textContent = det ? `${msg} — ${det}` : msg;
  } finally {
    elRunBtn.disabled = false;
  }
});

// Unified HOME & CLEAR
homeBtn?.addEventListener("click", () => Platform.goHome());
clearBtn?.addEventListener("click", clearPlanner);
