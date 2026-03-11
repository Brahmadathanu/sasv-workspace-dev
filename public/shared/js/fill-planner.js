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

// stronger number helpers for audit lines
const nfmt6 = (v) =>
  typeof v === "number" && isFinite(v) ? Math.round(v * 1e6) / 1e6 : v;

const pct = (x) =>
  typeof x === "number" && isFinite(x) ? `${nfmt6(x * 100)}%` : "—";

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

// copy summary button and cached data
let copyPlanBtn = null;
let latestSummaryData = null;

// Create an inline toggle button for the "Urgent Orders" drawer (keeps HTML unchanged)
let emgToggleBtn = null;
function updateEmgToggle() {
  if (!emgToggleBtn || !emgWrap) return;
  const visible =
    getComputedStyle(emgWrap).display !== "none" &&
    emgWrap.offsetParent !== null;
  // accessibility
  emgToggleBtn.setAttribute("aria-pressed", visible ? "true" : "false");
  emgToggleBtn.title = visible ? "Hide urgent orders" : "Show urgent orders";
  emgToggleBtn.setAttribute(
    "aria-label",
    visible ? "Hide urgent orders" : "Show urgent orders",
  );
  // rotate the SVG to indicate open/closed
  const svg = emgToggleBtn.querySelector("svg");
  if (svg) svg.style.transform = visible ? "rotate(180deg)" : "rotate(0deg)";
}

if (emgTitle) {
  emgToggleBtn = document.createElement("button");
  emgToggleBtn.type = "button";
  emgToggleBtn.id = "fp-emg-toggle";
  emgToggleBtn.className = "fp-small-toggle";
  // ERP-styled icon button (SVG only)
  emgToggleBtn.style.marginLeft = "6px";
  emgToggleBtn.style.width = "24px";
  emgToggleBtn.style.height = "24px";
  emgToggleBtn.style.border = "none";
  emgToggleBtn.style.background = "rgba(0,0,0,0.04)"; // light button background
  emgToggleBtn.style.display = "inline-flex";
  emgToggleBtn.style.alignItems = "center";
  emgToggleBtn.style.justifyContent = "center";
  emgToggleBtn.style.cursor = "pointer";
  emgToggleBtn.style.padding = "3px";
  emgToggleBtn.style.borderRadius = "4px";
  emgToggleBtn.style.verticalAlign = "middle";
  emgToggleBtn.style.transition = "background .12s ease, transform .12s ease";
  emgToggleBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  emgToggleBtn.addEventListener("click", () => {
    if (!emgWrap) return;
    const currentlyVisible =
      getComputedStyle(emgWrap).display !== "none" &&
      emgWrap.offsetParent !== null;
    emgWrap.style.display = currentlyVisible ? "none" : "";
    updateEmgToggle();
    fitVisibleWraps();
  });
  emgToggleBtn.addEventListener(
    "mouseenter",
    () => (emgToggleBtn.style.background = "rgba(0,0,0,0.06)"),
  );
  emgToggleBtn.addEventListener(
    "mouseleave",
    () => (emgToggleBtn.style.background = "rgba(0,0,0,0.04)"),
  );
  emgTitle.appendChild(emgToggleBtn);
  updateEmgToggle();
}

// Create a small SVG-only copy button next to the Fill Plan title (hidden until a plan is generated)
if (fpTitle) {
  copyPlanBtn = document.createElement("button");
  copyPlanBtn.type = "button";
  copyPlanBtn.id = "fp-copy-summary";
  copyPlanBtn.className = "fp-small-toggle";
  copyPlanBtn.style.marginLeft = "4px";
  copyPlanBtn.style.width = "20px";
  copyPlanBtn.style.height = "20px";
  copyPlanBtn.style.border = "none";
  copyPlanBtn.style.background = "#e6f8e6"; /* light green */
  copyPlanBtn.style.display = "none"; // hidden until plan available
  copyPlanBtn.style.alignItems = "center";
  copyPlanBtn.style.justifyContent = "center";
  copyPlanBtn.style.cursor = "pointer";
  copyPlanBtn.style.padding = "2px";
  copyPlanBtn.style.borderRadius = "4px";
  copyPlanBtn.style.verticalAlign = "middle";
  copyPlanBtn.style.transition = "background .12s ease";
  copyPlanBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;
  copyPlanBtn.addEventListener(
    "mouseenter",
    () => (copyPlanBtn.style.background = "#d0f0d0"),
  );
  copyPlanBtn.addEventListener(
    "mouseleave",
    () => (copyPlanBtn.style.background = "#e6f8e6"),
  );
  // tooltip + accessibility label for hover/assistive tech
  copyPlanBtn.title = "Copy plan summary to clipboard";
  copyPlanBtn.setAttribute("aria-label", "Copy plan summary to clipboard");
  copyPlanBtn.addEventListener("click", async () => {
    if (!latestSummaryData) {
      wNote("No plan to copy. Run Calculate first.");
      return;
    }
    const s = latestSummaryData;
    const lines = [];
    lines.push(`Date: ${s.date}`);
    lines.push(`Product: ${s.product}`);
    lines.push(`Bulk: ${s.bulk} ${s.uom || "(base)"}`);
    lines.push("");
    if (s.urgents && s.urgents.length) {
      lines.push("URGENT ORDERS");
      s.urgents.forEach((u) => lines.push(`${u.label} x ${u.qty} Nos`));
      lines.push("");
    }
    lines.push("FILL PLAN FOR REMAINING BULK");
    Object.entries(s.fillPlan || {}).forEach(([region, items]) => {
      lines.push(`Region ${region}:`);
      items.forEach((it) => lines.push(`${it.label} x ${it.qty} Nos`));
      lines.push("");
    });

    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      wNote("✓ Summary copied to clipboard.");
    } catch {
      wNote("✗ Copy failed.");
    }
  });
  fpTitle.appendChild(copyPlanBtn);
}

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

// Allow Enter in the Bulk input to trigger Calculate (desktop & mobile keyboards)
elBulk?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    // emulate click on the Calculate button if enabled
    if (elRunBtn && !elRunBtn.disabled) elRunBtn.click();
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
      `id = ${prodId}, UOM = ${rec.uom || "(base)"}`,
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
    // keep toggle label in sync
    try {
      updateEmgToggle();
    } catch {
      void 0;
    }
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
  `,
    )
    .join("");

  emgTitle.style.display = "";
  emgTable.style.display = "";
  // keep urgent-orders drawer closed by default; user may open via the Show button
  emgWrap.style.display = "none";
  try {
    updateEmgToggle();
  } catch {
    void 0;
  }
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
    `,
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

// Fetch product conversion_to_base and UOM for audit/readable maths
async function fetchProductConv(productId) {
  const { data, error } = await supabase
    .from("products")
    .select("id, conversion_to_base, uom_base, item")
    .eq("id", productId)
    .single();
  if (error) throw error;
  return {
    conv: data?.conversion_to_base ?? 1,
    uom: data?.uom_base ?? "(base)",
    name: data?.item ?? "",
  };
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

  // ─── split stock: IK, KKD, OK and accumulate depot-wise forecasts ───
  // We'll keep stock maps as before and also build depot-wise forecast maps
  const forecastIK = {}; // HO_IK
  const forecastKKD = {}; // KKD
  const forecastOK = {}; // HO_OK

  vfRows.forEach((r) => {
    const sku = r.sku_id;
    const god = (r.godown_code || "").trim().toUpperCase();

    // STOCK by depot
    if (god === "HO_IK") {
      stockIK[sku] = (stockIK[sku] || 0) + (+r.stock_units || 0);
      forecastIK[sku] = (forecastIK[sku] || 0) + (+r.forecast_units_pm || 0);
    } else if (god === "KKD") {
      stockKKD[sku] = (stockKKD[sku] || 0) + (+r.stock_units || 0);
      forecastKKD[sku] = (forecastKKD[sku] || 0) + (+r.forecast_units_pm || 0);
    } else if (god === "HO_OK") {
      stockOK[sku] = (stockOK[sku] || 0) + (+r.stock_units || 0);
      forecastOK[sku] = (forecastOK[sku] || 0) + (+r.forecast_units_pm || 0);
    }
    // ignore region roll-up rows for metrics (we want depot-wise forecasts)
  });

  // pretty printer for MOS cells
  const fmtMOS = (x) => (Number.isFinite(x) ? nfmt(x) : "—");

  /* ── Build and cache metrics for later MOS math (depot-wise forecasts) ── */
  // ensure every SKU has a numeric entry (default 0)
  skus.forEach((s) => {
    const id = s.id;
    forecastIK[id] = forecastIK[id] || 0;
    forecastKKD[id] = forecastKKD[id] || 0;
    forecastOK[id] = forecastOK[id] || 0;
  });

  const stockIKplusKKD = {};
  skus.forEach((s) => {
    stockIKplusKKD[s.id] = (stockIK[s.id] || 0) + (stockKKD[s.id] || 0);
  });

  metricsCache[productId] = {
    stock: { IK: stockIK, KKD: stockKKD, OK: stockOK },
    stockIKplusKKD,
    // forecasts are depot-wise: HO_IK, KKD, HO_OK
    forecast: { IK: forecastIK, KKD: forecastKKD, OK: forecastOK },
    as_of_date: "",
  };

  /* ── Log a compact, human-readable metrics snapshot ── */
  wH("SKU Metrics (inputs used)");
  wNote(
    "Note: Metrics are depot-wise. HO_IK, KKD and HO_OK forecasts are read from godown-level rows of v_fill_inputs.",
  );
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
        fKKD,
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
        <td>${fIK || "—"}</td>
        <td>${fKKD || "—"}</td>
        <td>${fOK || "—"}</td>
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
      },
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

  const bulkInput = +elBulk.value;
  let bulk = bulkInput;
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
  let anyEmergency = false;
  wH("Emergency Deduction (client-side, before server plan)");

  for (const inp of qtyInputs) {
    const qty = +inp.value;
    const skuId = +inp.dataset.skuId;
    if (!qty || !skuId) continue; // skip blank rows

    anyEmergency = true;

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

    wDerive([
      `SKU ${skuId}: qty_packs = ${nfmt(qty)}`,
      `  base_per_pack = pack_size × conv_to_base = ${nfmt(meta.pack_size)} × ${nfmt(
        meta.product.conversion_to_base,
      )} = ${nfmt(unitMass)}`,
      `  bulk_needed   = qty_packs × base_per_pack = ${nfmt(qty)} × ${nfmt(
        unitMass,
      )} = ${nfmt(needBulk)}`,
      `  bulk_after    = ${nfmt(bulk)} − ${nfmt(needBulk)} = ${nfmt(bulk - needBulk)}`,
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

  if (!anyEmergency) wNote("No urgent quantities entered.");

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
    const { data: planRows, error: rpcError } = await supabase.rpc(
      "calc_fill_plan",
      {
        p_product_id: +prodId,
        p_bulk_base_qty: +bulk,
        p_allow_overshoot: !!over,
        p_debug: false, // disable diagnostics for cleaner output
      },
    );
    if (rpcError) {
      console.error("RPC calc_fill_plan failed:", rpcError);
      throw new Error(rpcError.message || "RPC calc_fill_plan failed");
    }
    const plan = planRows || [];
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
    wDerive([`Target MOS (this run) = ${nfmt(mosTarget)}`]);

    wH("Allocation Rules (server truth)");
    wDerive([
      "The server plans ONLY in base units and ONLY whole packs are allowed.",
      "",
      "Phase A — Target MOS equalisation:",
      "  Greedy adds packs to bring regions/SKUs toward a common Target MOS.",
      "  Preference lane rule: for each SKU, the higher-effective-demand region is preferred until it is not behind.",
      "",
      "Phase B — Drain remaining bulk (ERP finish):",
      "  Drain is allocated proportionally by REGION effective-demand weight.",
      "  When remaining bulk becomes small, the server switches to smallest-pack-first",
      "  to minimize unpackable residue.",
      "",
      "Demand basis: the server uses effective demand (`fu_eff` / `fu_units_pm`) not raw forecast.",
      "  fu_eff = max(spike-guarded forecast, avg12 × sales_k).",
      "  Spike-guard prevents one-off spikes from inflating demand for a run; avg12 blending smooths extremes.",
      "  Rare/low-throughput SKUs and very large packs may be capped or deprioritised (Policy B).",
      "  Large packs may overshoot MOS at the SKU level because packs are discrete; the global plan still targets overall MOS.",
      "",
      "Stop condition:",
      "  Stops when remaining bulk is smaller than the smallest pack (cannot fit another whole pack).",
      "",
      "Interpretation:",
      "  leftover = unpackable residue due to integer pack constraints (expected, not an error).",
    ]);

    /* 2) Debug diagnostics (use as truth for MOS math in workings)
       Fetch diagnostics first so we compute MOS from server-provided
       effective demand (`fu_units_pm`) and stock used (`su_units`). */
    const skuIds = [...new Set(plan.map((r) => r.sku_id))];

    let planDbg = null;
    const { data: dbgRows, error: dbgErr } = await supabase.rpc(
      "calc_fill_plan",
      {
        p_product_id: +prodId,
        p_bulk_base_qty: +bulk,
        p_allow_overshoot: !!over,
        p_debug: true,
      },
    );
    if (dbgErr) {
      // non-fatal — surface diagnostics failure in console and continue without debug
      console.warn("RPC calc_fill_plan (debug) failed:", dbgErr);
      planDbg = null;
    } else {
      planDbg = dbgRows || null;
    }

    // Build a quick lookup from debug rows keyed by region__sku
    const keyRS = (region, skuId) => `${region}__${skuId}`;
    const dbgByKey = {};
    (planDbg || []).forEach((r) => {
      dbgByKey[keyRS(r.region_code, r.sku_id)] = r;
    });

    // Optional: fetch SKU meta for labels and the UI table only (not used for MOS math)
    const skuMap = await fetchSkuInfo(skuIds);

    // If debug diagnostics are available, surface a concise server-side score log
    if (planDbg && planDbg.length) {
      wH("Server Debug (final scores)");
      (planDbg || []).forEach((r) => {
        if (r.benefit_per_base == null) return;
        const lbl = skuMap[r.sku_id]?.label || r.sku_id;
        const b = Number(r.benefit_per_base);
        const flag =
          b <= -1e8
            ? "FINAL-SNAPSHOT (bulk < smallest pack)"
            : b === 0
              ? "NO-GAP"
              : "ELIGIBLE";
        wDerive([`${r.region_code}  ${lbl}: score = ${nfmt(b)}  → ${flag}`]);
      });
      wNote(
        "Note: Final scores shown here are a post-run snapshot. When remaining bulk is smaller than the smallest pack, the scoring rule sets large negative values (≈ -1e9) — this indicates the run ended, not a per-row eligibility ban.",
      );
      wH("Why a large pack may receive multiple packs");
      wDerive([
        "Server `fu_eff` calculation blends protections and long-term averages to avoid chasing spikes:",
        "  fu_eff = max(spike-guarded forecast, avg12 × sales_k)",
        "  Spike-guard reduces influence of one-off spikes; avg12 blending smooths demand over 12 months.",
        "  The planner may also apply caps or deprioritisation for rare/low-throughput SKUs (Policy B).",
        "  For very large packs, discrete pack sizes can cause per‑SKU MOS to jump — fills may overshoot MOS at SKU level because fractional packs are not allowed, while the global plan still targets overall MOS.",
      ]);
    }

    // NOTE: metricsCache is available at `metricsCache[prodId]` for the UI,
    // but MOS/demand math in the workings uses server debug rows (`planDbg`).

    /* Summarize plan and show MOS math per region & SKU
       Map RPC rows to normalized objects and compute all aggregates from the RPC rows. */
    wH("Calculation Workings");

    // Prefer debug rows (contain fu_units_pm) as the authoritative source
    const sourceRows = planDbg && planDbg.length ? planDbg : plan || [];
    // Normalize rows (use server values as authoritative)
    const rows = sourceRows.map((r) => ({
      skuId: r.sku_id,
      region: r.region_code,
      fillUnits: Number(r.units_to_fill || 0),
      usedBase: Number(r.used_base_qty || 0),
      targetMos: Number(r.mos || 0),
      achievedMos: Number((r.curr_mos ?? r.mos) || 0),
      gapMos: Number(r.gap_mos || 0),
      demandUnitsPm: Number(r.fu_units_pm || 0), // effective demand (fu_eff)
      stockUnits: Number(r.su_units || 0),
      umBase: Number(r.um_base || 0),
    }));

    // helpers for display formatting
    const fmt = (v, d = 3) =>
      Number.isFinite(Number(v)) ? Number(Number(v)).toFixed(d) : "—";
    const fmt5 = (v) => fmt(v, 5);
    const fmt3 = (v) => fmt(v, 3);
    // (fmt1 removed — not needed)

    // Planning Inputs
    wH("Planning Inputs");
    wEq("Bulk (base units)", "", nfmt6(bulk));
    wEq("Allow overshoot", "", over ? "Yes" : "No");
    wEq("Product ID", "", prodId);

    // Demand definition
    wH("Demand definition");
    wDerive([
      "Note: `demand_units_pm` is effective demand (fu_eff), not raw forecast.",
      "  fu_eff is derived by spike-guard + long-term blending: fu_eff = max(spike-guarded forecast, avg12 × sales_k)",
      "  All MOS calculations below use demand_units_pm (fu_eff) provided by the server.",
    ]);

    // Global aggregates — compute from debug rows when available (they include fu_units_pm & um_base)
    const dbgSource = planDbg && planDbg.length ? planDbg : plan || [];
    if (!(planDbg && planDbg.length)) {
      wNote("Debug rows missing; aggregates may be incomplete.");
    }
    const totalStockBase = dbgSource.reduce(
      (s, r) => s + Number(r.su_units || 0) * Number(r.um_base || 0),
      0,
    );
    const totalDemandBase = dbgSource.reduce(
      (s, r) => s + Number(r.fu_units_pm || 0) * Number(r.um_base || 0),
      0,
    );
    const usedBaseTotal = dbgSource.reduce(
      (s, r) => s + Number(r.used_base_qty ?? r.usedBase ?? 0),
      0,
    );
    const leftoverBase = bulk - usedBaseTotal;

    const target_mos_exact = totalDemandBase
      ? (Number(bulk) + totalStockBase) / totalDemandBase
      : 0;
    const achieved_mos_exact = totalDemandBase
      ? (usedBaseTotal + totalStockBase) / totalDemandBase
      : 0;
    const targetMosServer = rows.length ? rows[0].targetMos : mosTarget;

    wH("Global Target MOS (server)");
    wDerive([
      `total_stock_base = Σ(su_units × um_base) = ${nfmt6(totalStockBase)}`,
      `total_demand_base = Σ(fu_units_pm × um_base) = ${nfmt6(totalDemandBase)}`,
      `target_mos_exact = (bulk_input_base + Σ(stock_base)) ÷ Σ(fu_eff×um) = (${nfmt6(bulk)} + ${nfmt6(
        totalStockBase,
      )}) ÷ ${nfmt6(totalDemandBase)} = ${nfmt6(target_mos_exact)}`,
    ]);

    // Per-row breakdown grouped by region
    wH("Per-row breakdown");
    const rowsByRegion = {};
    rows.forEach((r) =>
      (rowsByRegion[r.region] = rowsByRegion[r.region] || []).push(r),
    );
    Object.entries(rowsByRegion).forEach(([region, rr]) => {
      wNote(`Region ${region}`);
      rr.forEach((r) => {
        const mosBefore = r.demandUnitsPm ? r.stockUnits / r.demandUnitsPm : 0;
        const mosAfter = r.demandUnitsPm
          ? (r.stockUnits + r.fillUnits) / r.demandUnitsPm
          : 0;
        const usedBaseCheck = r.fillUnits * r.umBase;
        const baseStock = r.stockUnits * r.umBase;
        const baseDemand = r.demandUnitsPm * r.umBase;

        wDerive([
          `SKU ${r.skuId}: um_base = ${fmt5(r.umBase)}`,
          `  stock_units = ${fmt3(r.stockUnits)}`,
          `  demand_units_pm (effective) = ${fmt3(r.demandUnitsPm)}`,
          `  base_stock = stock_units × um_base = ${fmt3(baseStock)}`,
          `  base_demand = demand_units_pm × um_base = ${fmt3(baseDemand)}`,
          `  mos_before = stock ÷ demand = ${fmt3(mosBefore)}`,
          `  fill_units = ${fmt3(r.fillUnits)}`,
          `  used_base (server) = ${fmt3(r.usedBase)}  (calc = ${fmt3(usedBaseCheck)})`,
          `  mos_after = (stock + fill) ÷ demand = ${fmt3(mosAfter)}  (server achieved = ${fmt3(
            r.achievedMos,
          )})`,
          `  target_mos = ${fmt3(r.targetMos)}  gap_mos = ${fmt3(r.gapMos)}`,
        ]);

        if (r.fillUnits === 0 && r.gapMos > 0) {
          wNote(
            `  ⚠ Not filled in this run (bulk exhausted before reaching it; caps/lane rules may also contribute); remaining gap = ${fmt3(
              r.gapMos,
            )}`,
          );
        }
      });
    });

    // Bulk consumption check
    wH("Bulk consumption check");
    wDerive([
      `used_base_total = Σ(used_base) = ${fmt3(usedBaseTotal)}`,
      `leftover_base = bulk_input_base − used_base_total = ${fmt3(bulk)} − ${fmt3(usedBaseTotal)} = ${fmt3(
        leftoverBase,
      )}`,
    ]);
    wNote(
      "Leftover is expected due to discrete pack sizes; typically < smallest um_base.",
    );

    // Global MOS after plan — clarify target vs achieved
    wH("Global MOS after plan");
    wDerive([
      "Target MOS (server) is computed using the full bulk_input_base:",
      `  target_mos_exact = (bulk_input_base + Σ(stock_base)) ÷ Σ(fu_eff×um) = (${nfmt6(bulk)} + ${nfmt6(
        totalStockBase,
      )}) ÷ ${nfmt6(totalDemandBase)} = ${nfmt6(target_mos_exact)}`,
      "Achieved MOS after the plan uses only the base actually consumed into whole packs (used_base_total):",
      `  achieved_mos_exact = (Σ(stock_base) + used_base_total) ÷ Σ(fu_eff×um) = (${nfmt6(
        totalStockBase,
      )} + ${nfmt6(usedBaseTotal)}) ÷ ${nfmt6(totalDemandBase)} = ${nfmt6(achieved_mos_exact)}`,
      `  leftover_base (unpackable residue) = ${nfmt6(leftoverBase)} — this is why achieved_mos_exact ≈ ${nfmt6(
        achieved_mos_exact,
      )} which is slightly below target ${nfmt6(target_mos_exact)}.`,
      `  delta_mos = target_mos_exact − achieved_mos_exact = ${nfmt6(target_mos_exact - achieved_mos_exact)}`,
    ]);

    // Render a flat table with per-row details (Region × SKU rows)
    const flatCols = [
      { k: "region", label: "Region" },
      { k: "skuId", label: "SKU" },
      { k: "umBase", label: "Pack base" },
      { k: "stockUnits", label: "Stock units" },
      { k: "demandUnitsPm", label: "Effective demand (units/month)" },
      { k: "fillUnits", label: "Fill units" },
      { k: "usedBase", label: "Used base" },
      { k: "mosBefore", label: "MOS before" },
      { k: "mosAfter", label: "MOS after" },
      { k: "gapMos", label: "Gap MOS" },
    ];

    elHead.innerHTML = flatCols.map((c) => `<th>${c.label}</th>`).join("");
    elBody.innerHTML = rows
      .map((r) => {
        const mosBefore = r.demandUnitsPm ? r.stockUnits / r.demandUnitsPm : 0;
        const mosAfter = r.demandUnitsPm
          ? (r.stockUnits + r.fillUnits) / r.demandUnitsPm
          : 0;
        return `<tr>
          <td>${escapeHtml(String(r.region || ""))}</td>
          <td>${escapeHtml(String(r.skuId))}</td>
          <td style="text-align:right">${fmt5(r.umBase)}</td>
          <td style="text-align:right">${fmt3(r.stockUnits)}</td>
          <td style="text-align:right">${fmt3(r.demandUnitsPm)}</td>
          <td style="text-align:right">${fmt3(r.fillUnits)}</td>
          <td style="text-align:right">${fmt3(r.usedBase)}</td>
          <td style="text-align:right">${fmt3(mosBefore)}</td>
          <td style="text-align:right">${fmt3(mosAfter)}</td>
          <td style="text-align:right">${fmt3(r.gapMos)}</td>
        </tr>`;
      })
      .join("");

    // show global target briefly
    wNote(`Server target MOS = ${fmt3(targetMosServer)}`);

    /* Bulk audit: trust server's used_base_qty (sum over normalized rows) */
    const usedBase = rows.reduce((sum, r) => sum + Number(r.usedBase || 0), 0);
    wEq(
      "Bulk used by plan (base units)",
      "",
      usedBase,
      "from server (should ≤ remaining bulk unless overshoot)",
    );

    // Show remaining bulk after plan (base units)
    const bulkLeft = bulk - usedBase;
    wEq("Bulk remaining after plan (base units)", "", nfmt(bulkLeft));

    // --- Coverage / residue audit (base + derived SKU-UOM) ------------------
    wH("Bulk Audit (coverage + residue)");

    // product conversion_to_base: used for UOM audit if available
    let prodConv = null;
    try {
      prodConv = await fetchProductConv(+prodId);
    } catch {
      prodConv = null;
    }

    wDerive([
      `bulk_input_base = ${nfmt6(bulk)}`,
      `used_base_qty   = Σ(server.used_base_qty) = ${nfmt6(usedBase)}`,
      `leftover_base   = bulk_input_base − used_base_qty = ${nfmt6(bulk)} − ${nfmt6(
        usedBase,
      )} = ${nfmt6(bulkLeft)}`,
    ]);

    if (prodConv && prodConv.conv && prodConv.conv > 0) {
      const totalUom = bulk / prodConv.conv;
      const usedUom = usedBase / prodConv.conv;
      const leftUom = bulkLeft / prodConv.conv;
      const coverage = totalUom > 0 ? usedUom / totalUom : 0;

      wDerive([
        "",
        `conversion_to_base = ${nfmt6(prodConv.conv)} (base units per 1 ${prodConv.uom || "uom"} — from products.uom_base)`,
        `total_${prodConv.uom || "uom"} = bulk_base ÷ conversion_to_base = ${nfmt6(bulk)} ÷ ${nfmt6(
          prodConv.conv,
        )} = ${nfmt6(totalUom)}`,
        `used_${prodConv.uom || "uom"}  = used_base ÷ conversion_to_base = ${nfmt6(usedBase)} ÷ ${nfmt6(
          prodConv.conv,
        )} = ${nfmt6(usedUom)}`,
        `left_${prodConv.uom || "uom"}  = leftover_base ÷ conversion_to_base = ${nfmt6(bulkLeft)} ÷ ${nfmt6(
          prodConv.conv,
        )} = ${nfmt6(leftUom)}  (unpackable residue)`,
        `coverage = used_uom ÷ total_uom = ${nfmt6(usedUom)} ÷ ${nfmt6(totalUom)} = ${pct(
          coverage,
        )}`,
      ]);
    } else {
      wNote("Note: could not load product conversion_to_base for UOM audit.");
    }

    // Global MOS check using server debug rows (fu_eff and um_base)
    try {
      const dbgRows = planDbg && planDbg.length ? planDbg : plan || [];
      let totalStockBase_dbg = 0;
      let totalDemandBase_dbg = 0;
      let totalFillBase_dbg = 0;
      dbgRows.forEach((r) => {
        const su = Number(r.su_units || 0);
        const fuEff = Number(r.fu_units_pm || 0);
        const um = Number(r.um_base || 0);
        const fill = Number(r.units_to_fill || 0);
        totalStockBase_dbg += su * um;
        totalDemandBase_dbg += fuEff * um;
        totalFillBase_dbg += fill * um;
      });
      const target_mos_exact_dbg = totalDemandBase_dbg
        ? (Number(bulk) + totalStockBase_dbg) / totalDemandBase_dbg
        : 0;
      const achieved_mos_exact_dbg = totalDemandBase_dbg
        ? (totalStockBase_dbg + totalFillBase_dbg) / totalDemandBase_dbg
        : 0;
      const delta_mos_dbg = target_mos_exact_dbg - achieved_mos_exact_dbg;
      wH("Global MOS check (debug rows)");
      wDerive([
        `total_stock_base = Σ(su_units × um_base) = ${nfmt6(totalStockBase_dbg)}`,
        `total_demand_base = Σ(fu_eff × um_base) = ${nfmt6(totalDemandBase_dbg)}`,
        `total_fill_base = Σ(units_to_fill × um_base) = ${nfmt6(totalFillBase_dbg)}`,
        `target_mos_exact = (${nfmt6(bulk)} + ${nfmt6(totalStockBase_dbg)}) ÷ ${nfmt6(
          totalDemandBase_dbg,
        )} = ${nfmt6(target_mos_exact_dbg)}`,
        `achieved_mos_exact = (${nfmt6(totalStockBase_dbg)} + ${nfmt6(totalFillBase_dbg)}) ÷ ${nfmt6(
          totalDemandBase_dbg,
        )} = ${nfmt6(achieved_mos_exact_dbg)}`,
        `delta_mos = target_mos_exact − achieved_mos_exact = ${nfmt6(delta_mos_dbg)}`,
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

    // Compute achieved MOS per region using server debug rows (fu_eff and um_base)
    const achievedByRegion = {};
    // Build a quick lookup for plan fills by (region, sku) for table rendering
    const fillLookup = {};
    Object.entries(byRegion).forEach(([region, skuRows]) => {
      Object.entries(skuRows).forEach(([skuId, row]) => {
        fillLookup[`${region}_${+skuId}`] = row.units_to_fill || 0;
      });
    });

    const regionsFromDbg = Array.from(
      new Set((planDbg || []).map((r) => r.region_code)),
    );
    regionsFromDbg.forEach((region) => {
      let stockBase = 0,
        demandBase = 0,
        fillBase = 0;
      (planDbg || []).forEach((r) => {
        if (r.region_code !== region) return;
        const su = Number(r.su_units || 0);
        const fuEff = Number(r.fu_units_pm || 0);
        const um = Number(r.um_base || 0);
        const fill = Number(r.units_to_fill || 0);
        stockBase += su * um;
        demandBase += fuEff * um;
        fillBase += fill * um;
      });
      achievedByRegion[region] = demandBase
        ? (stockBase + fillBase) / demandBase
        : 0;
    });

    // Clarify table meaning for layman readers
    wNote(
      "Table note: Target MOS is global from the server; Achieved MOS per region = (Σ su_units×um_base + Σ_plan units_to_fill×um_base) ÷ Σ fu_eff×um_base (from server debug rows).",
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
          2,
        )}</td><td>${achieved.toFixed(2)}</td></tr>`;
      })
      .join("");

    elTable.style.display = "";

    // Cache a simplified summary for the clipboard copy button
    try {
      const urgents = [];
      const qtyInputs = document.querySelectorAll(".emg-qty");
      for (const inp of qtyInputs) {
        const q = +inp.value;
        const skuId = +inp.dataset.skuId;
        if (!q || !skuId) continue;
        urgents.push({ label: skuMap[skuId]?.label || skuId, qty: q });
      }

      const fillPlan = {};
      plan.forEach((r) => {
        const region = r.region_code || "";
        fillPlan[region] = fillPlan[region] || [];
        fillPlan[region].push({
          label: skuMap[r.sku_id]?.label || r.sku_id,
          qty: r.units_to_fill || 0,
        });
      });

      const prodName = productMap[prodId]?.name || "(unknown)";
      const prodUom = productMap[prodId]?.uom || "(base)";
      latestSummaryData = {
        date: new Date().toLocaleString(),
        product: prodName,
        bulk: bulkInput,
        uom: prodUom,
        urgents,
        fillPlan,
      };
      if (copyPlanBtn) copyPlanBtn.style.display = "";
    } catch {
      // non-fatal: ignore summary caching failures
      latestSummaryData = null;
      if (copyPlanBtn) copyPlanBtn.style.display = "none";
    }
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
