/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

// ============= Constants & State =============
const PAGE_SIZE = 50; // Increased from 25 for better performance

let currentUser = null;

// Net SKU plan load guard to drop stale responses
let currentNetSkuLoadId = 0;

// Global Product Name Cache - improves performance by avoiding repeated queries
const productCache = {
  names: new Map(), // product_id -> product_name
  uoms: new Map(), // product_id -> uom_base
  lastUpdated: null,
  isLoading: false,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
};

// Pagination state for each tab
const tabState = {
  netSkuPlan: { page: 0, loading: false, loaded: false },
  bulkRequirements: { page: 0, loading: false, loaded: false },
  netting: { page: 0, loading: false, loaded: false },
  wip: { page: 0, loading: false, loaded: false },
  normalizer: { page: 0, loading: false, loaded: false },
};

// ============= Utility Functions =============
const fmtDate = (d) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${yy}-${mm}-${dd}`;
};

const monthFloor = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);

function fenceStart(today = new Date(), frozenAfter = 25) {
  const base = monthFloor(today);
  if (today.getDate() > frozenAfter) base.setMonth(base.getMonth() + 1);
  return base;
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function showToast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.background =
    type === "error" ? "#dc2626" : type === "success" ? "#10b981" : "#111827";
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 3000);
}

function fmtNum(x) {
  return x === null || x === undefined ? "" : Number(x).toFixed(3);
}

function fmtBatchSize(x) {
  return x === null || x === undefined ? "—" : Number(x).toFixed(3);
}

function formatMonth(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

// Helper function to get product name by ID
// ============= Product Cache Functions =============
async function ensureProductCacheLoaded(productIds = []) {
  // Check if cache is fresh and not loading
  const now = Date.now();
  if (
    !productCache.isLoading &&
    productCache.lastUpdated &&
    now - productCache.lastUpdated < productCache.CACHE_TTL
  ) {
    return; // Cache is fresh
  }

  // If already loading, wait for it to complete
  if (productCache.isLoading) {
    while (productCache.isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return;
  }

  try {
    // Debug: log incoming filter state for troubleshooting (local inputs read below)
    productCache.isLoading = true;

    // Build query - if specific products requested, fetch only those
    let query = supabase
      .from("v_sku_catalog_enriched")
      .select("product_id,item,uom_base");

    if (productIds.length > 0) {
      // Filter to missing products only
      const missingIds = productIds.filter((id) => !productCache.names.has(id));
      if (missingIds.length === 0) return; // All products already cached
      query = query.in("product_id", missingIds);
    }

    const { data: skuData, error } = await query;

    if (!error && skuData) {
      // Update cache with fetched data
      skuData.forEach((sku) => {
        if (sku.product_id && sku.item) {
          productCache.names.set(sku.product_id, sku.item);
          productCache.uoms.set(sku.product_id, sku.uom_base || "");
        }
      });
      productCache.lastUpdated = now;
    }
  } catch (error) {
    console.warn("Failed to load product cache:", error);
  } finally {
    productCache.isLoading = false;
  }
}

async function getProductName(productId) {
  // Check cache first
  if (productCache.names.has(productId)) {
    return productCache.names.get(productId);
  }

  // Load specific product if not in cache
  await ensureProductCacheLoaded([productId]);
  return productCache.names.get(productId) || `Product ${productId}`;
}

async function getProductNames(productIds) {
  // Ensure cache has all needed products
  await ensureProductCacheLoaded(productIds);

  const result = {};
  productIds.forEach((id) => {
    result[id] = productCache.names.get(id) || `Product ${id}`;
  });
  return result;
}

async function getProductUOMs(productIds) {
  // Ensure cache has all needed products
  await ensureProductCacheLoaded(productIds);

  const result = {};
  productIds.forEach((id) => {
    result[id] = productCache.uoms.get(id) || "";
  });
  return result;
}

// ============= Skeleton Loading Functions =============
function showSkeletonLoading(tableBodyId, columnCount = 5, rowCount = 10) {
  const bodyEl = document.getElementById(tableBodyId);
  if (!bodyEl) return;

  const skeletonRows = Array.from({ length: rowCount }, () => {
    const cells = Array.from(
      { length: columnCount },
      () => '<td><div class="skeleton-cell"></div></td>'
    ).join("");
    return `<tr class="skeleton-row">${cells}</tr>`;
  }).join("");

  bodyEl.innerHTML = skeletonRows;
}

function hideSkeletonLoading(tableBodyId) {
  const bodyEl = document.getElementById(tableBodyId);
  if (!bodyEl) return;

  // Remove skeleton rows
  bodyEl.querySelectorAll(".skeleton-row").forEach((row) => row.remove());
}

// ============= Enhanced Filter Functions =============
let filterState = {
  netSkuPlan: {
    fromMonth: null,
    toMonth: null,
    skuId: "",
    productName: "",
    openingStock: "all",
    demandBaseline: "all",
    bottledSohApplied: "all",
  },
  forecastHierarchy: {
    fromMonth: null,
    toMonth: null,
    level: "godown", // godown | region | sku
  },
  bulkRequirements: {
    fromMonth: null,
    toMonth: null,
    productId: "",
    productName: "",
  },
  netting: {
    fromMonth: null,
    toMonth: null,
    productId: "",
    productName: "",
    bulkRequired: "all",
    sohApplied: "all",
    sohRemaining: "all",
  },
  normalizer: {
    fromMonth: null,
    toMonth: null,
    productId: "",
    productName: "",
    needQty: "all",
    needAfterCarry: "all",
    carryToNext: "all",
    needsBatchRef: "all",
  },
  wip: {
    fromMonth: null,
    toMonth: null,
    productId: "",
    productName: "",
    netBeforeWip: "all",
    wipDeducted: "all",
    wipPool: "all",
  },
};

// Small helper to safely inject text into HTML
function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Initialize month inputs
function initializeMonthInputs() {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Set default values to current month (YYYY-MM format for month inputs)
  const defaultMonthValue = `${currentYear}-${String(currentMonth + 1).padStart(
    2,
    "0"
  )}`;

  // Set default values for net sku plan tab
  const netSkuFromInput = document.getElementById("net-sku-plan-from-month");
  const netSkuToInput = document.getElementById("net-sku-plan-to-month");

  if (netSkuFromInput) {
    netSkuFromInput.value = defaultMonthValue;
    filterState.netSkuPlan.fromMonth = new Date(currentYear, currentMonth, 1);
  }

  if (netSkuToInput) {
    netSkuToInput.value = defaultMonthValue;
    filterState.netSkuPlan.toMonth = new Date(currentYear, currentMonth, 1);
  }

  // Set default values for bulk requirements tab
  const bulkFromInput = document.getElementById("bulk-requirements-from-month");
  const bulkToInput = document.getElementById("bulk-requirements-to-month");

  if (bulkFromInput) {
    bulkFromInput.value = defaultMonthValue;
    filterState.bulkRequirements.fromMonth = new Date(
      currentYear,
      currentMonth,
      1
    );
  }

  if (bulkToInput) {
    bulkToInput.value = defaultMonthValue;
    filterState.bulkRequirements.toMonth = new Date(
      currentYear,
      currentMonth,
      1
    );
  }

  // Set default values for netting tab
  const nettingFromInput = document.getElementById("netting-from-month");
  const nettingToInput = document.getElementById("netting-to-month");

  if (nettingFromInput) {
    nettingFromInput.value = defaultMonthValue;
    filterState.netting.fromMonth = new Date(currentYear, currentMonth, 1);
  }

  if (nettingToInput) {
    nettingToInput.value = defaultMonthValue;
    filterState.netting.toMonth = new Date(currentYear, currentMonth, 1);
  }

  // Set default values for wip tab
  const wipFromInput = document.getElementById("wip-from-month");
  const wipToInput = document.getElementById("wip-to-month");

  if (wipFromInput) {
    wipFromInput.value = defaultMonthValue;
    filterState.wip.fromMonth = new Date(currentYear, currentMonth, 1);
  }

  if (wipToInput) {
    wipToInput.value = defaultMonthValue;
    filterState.wip.toMonth = new Date(currentYear, currentMonth, 1);
  }

  // Set default values for normalizer tab
  const normalizerFromInput = document.getElementById("normalizer-from-month");
  const normalizerToInput = document.getElementById("normalizer-to-month");

  if (normalizerFromInput) {
    normalizerFromInput.value = defaultMonthValue;
    filterState.normalizer.fromMonth = new Date(currentYear, currentMonth, 1);
  }

  if (normalizerToInput) {
    normalizerToInput.value = defaultMonthValue;
    filterState.normalizer.toMonth = new Date(currentYear, currentMonth, 1);
  }
}

// Initialize toggle buttons
function initializeToggleButtons() {
  document.querySelectorAll(".toggle-group").forEach((group) => {
    const buttons = group.querySelectorAll(".toggle-option");
    buttons.forEach((button) => {
      button.addEventListener("click", function () {
        // Remove active states from siblings
        buttons.forEach((btn) => btn.classList.remove("active", "inactive"));

        // Set active state
        const value = this.dataset.value;
        if (value === "all") {
          this.classList.add("active");
        } else if (value === "present") {
          this.classList.add("active");
        } else if (value === "absent") {
          this.classList.add("inactive");
        }

        // Update filter state for all toggles
        const filterType = this.dataset.filter;
        switch (filterType) {
          case "bulk-required":
            filterState.netting.bulkRequired = value;
            break;
          case "soh-applied":
            filterState.netting.sohApplied = value;
            break;
          case "soh-remaining":
            filterState.netting.sohRemaining = value;
            break;
          case "net-before-wip":
            filterState.wip.netBeforeWip = value;
            break;
          case "wip-deducted":
            filterState.wip.wipDeducted = value;
            break;
          case "wip-pool":
            filterState.wip.wipPool = value;
            break;
          case "need-qty":
            filterState.normalizer.needQty = value;
            break;
          case "need-after-carry":
            filterState.normalizer.needAfterCarry = value;
            break;
          case "carry-to-next":
            filterState.normalizer.carryToNext = value;
            break;
          case "needs-batch-ref":
            filterState.normalizer.needsBatchRef = value;
            break;
          case "opening-stock":
            filterState.netSkuPlan.openingStock = value;
            break;
          case "demand-baseline":
            filterState.netSkuPlan.demandBaseline = value;
            break;
          case "bottled-soh-applied":
            filterState.netSkuPlan.bottledSohApplied = value;
            break;
        }

        // Debug: log bottled soh toggle changes
        if (filterType === "bottled-soh-applied") {
          try {
            console.debug(
              "[debug] bottled-soh-applied toggled ->",
              value,
              "filterState:",
              JSON.parse(JSON.stringify(filterState.netSkuPlan))
            );
          } catch {
            console.debug(
              "[debug] bottled-soh-applied toggled ->",
              value,
              "(could not stringify filterState)"
            );
          }
        }

        // Auto-apply filters
        // Route toggle actions to the appropriate filter handlers
        if (
          filterType.includes("bulk-required") ||
          filterType.includes("soh-")
        ) {
          filterNettingData();
        } else if (
          filterType.includes("wip") ||
          filterType.includes("net-before")
        ) {
          filterWipData();
        } else if (
          filterType.includes("need-qty") ||
          filterType.includes("batch") ||
          filterType.includes("carry") ||
          filterType.includes("ref")
        ) {
          loadNormalizerData(0);
        } else if (
          filterType === "opening-stock" ||
          filterType === "demand-baseline" ||
          filterType === "bottled-soh-applied"
        ) {
          filterNetSkuPlanData();
        }
      });
    });
  });
}

// Ensure bottled SOH toggles definitely update state and reload the Net SKU table.
function attachBottledSohToggleHandlers() {
  document
    .querySelectorAll('[data-filter="bottled-soh-applied"]')
    .forEach((btn) => {
      // avoid wiring twice
      if (btn.dataset.bottledWired) return;
      btn.dataset.bottledWired = "1";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const group = btn.closest(".toggle-group");
        if (group) {
          group
            .querySelectorAll(".toggle-option")
            .forEach((b) => b.classList.remove("active", "inactive"));
        }

        const value = btn.dataset.value;
        if (value === "absent") {
          btn.classList.add("inactive");
        } else {
          btn.classList.add("active");
        }

        // Update state and reload (reset to first page)
        filterState.netSkuPlan.bottledSohApplied = value;
        tabState.netSkuPlan.page = 0;
        console.debug(
          "[debug] bottled-soh-applied clicked ->",
          value,
          "(attached handler)"
        );
        loadNetSkuPlanData(0).catch((err) =>
          console.error("loadNetSkuPlanData failed:", err)
        );
      });
    });
}

// Initialize text input auto-apply
function initializeTextInputs() {
  // SKU ID input with debounce for net sku plan
  const netSkuIdInput = document.getElementById("net-sku-plan-sku-id");
  if (netSkuIdInput) {
    let netSkuIdTimeout;
    netSkuIdInput.addEventListener("input", function () {
      clearTimeout(netSkuIdTimeout);
      netSkuIdTimeout = setTimeout(() => {
        filterState.netSkuPlan.skuId = this.value.trim();
        filterNetSkuPlanData();
      }, 500); // 500ms debounce
    });
  }

  // Product Name input with debounce for net sku plan
  const netSkuProductNameInput = document.getElementById(
    "net-sku-plan-product-name"
  );
  if (netSkuProductNameInput) {
    let netSkuProductNameTimeout;
    netSkuProductNameInput.addEventListener("input", function () {
      clearTimeout(netSkuProductNameTimeout);
      netSkuProductNameTimeout = setTimeout(() => {
        filterState.netSkuPlan.productName = this.value.trim();
        filterNetSkuPlanData();
      }, 500); // 500ms debounce
    });
  }

  // Forecast SKU ID input (debounced)
  const forecastSkuIdInput = document.getElementById("forecast-sku-id");
  if (forecastSkuIdInput) {
    let forecastSkuIdTimeout;
    forecastSkuIdInput.addEventListener("input", function () {
      clearTimeout(forecastSkuIdTimeout);
      forecastSkuIdTimeout = setTimeout(() => {
        filterState.forecastHierarchy.skuId = this.value.trim();
        // Reset to first page and reload
        forecastState.page = 0;
        loadForecastHierarchyData(0);
      }, 500);
    });
  }

  // Forecast Product Name input (debounced) - will filter by item name in SKU catalog
  const forecastProductNameInput = document.getElementById(
    "forecast-product-name"
  );
  if (forecastProductNameInput) {
    let forecastProductNameTimeout;
    forecastProductNameInput.addEventListener("input", function () {
      clearTimeout(forecastProductNameTimeout);
      forecastProductNameTimeout = setTimeout(() => {
        filterState.forecastHierarchy.productName = this.value.trim();
        forecastState.page = 0;
        loadForecastHierarchyData(0);
      }, 500);
    });
  }

  // Month inputs for net sku plan
  const netSkuFromMonthInput = document.getElementById(
    "net-sku-plan-from-month"
  );
  if (netSkuFromMonthInput) {
    netSkuFromMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.netSkuPlan.fromMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      filterNetSkuPlanData();
    });
  }

  const netSkuToMonthInput = document.getElementById("net-sku-plan-to-month");
  if (netSkuToMonthInput) {
    netSkuToMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.netSkuPlan.toMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      filterNetSkuPlanData();
    });
  }

  // Product ID input with debounce for bulk requirements
  const bulkProductIdInput = document.getElementById(
    "bulk-requirements-product-id"
  );
  if (bulkProductIdInput) {
    let bulkProductIdTimeout;
    bulkProductIdInput.addEventListener("input", function () {
      clearTimeout(bulkProductIdTimeout);
      bulkProductIdTimeout = setTimeout(() => {
        filterState.bulkRequirements.productId = this.value.trim();
        filterBulkRequirementsData();
      }, 500); // 500ms debounce
    });
  }

  // Product Name input with debounce for bulk requirements
  const bulkProductNameInput = document.getElementById(
    "bulk-requirements-product-name"
  );
  if (bulkProductNameInput) {
    let bulkProductNameTimeout;
    bulkProductNameInput.addEventListener("input", function () {
      clearTimeout(bulkProductNameTimeout);
      bulkProductNameTimeout = setTimeout(() => {
        filterState.bulkRequirements.productName = this.value.trim();
        filterBulkRequirementsData();
      }, 500); // 500ms debounce
    });
  }

  // Month inputs for bulk requirements
  const bulkFromMonthInput = document.getElementById(
    "bulk-requirements-from-month"
  );
  if (bulkFromMonthInput) {
    bulkFromMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.bulkRequirements.fromMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      filterBulkRequirementsData();
    });
  }

  const bulkToMonthInput = document.getElementById(
    "bulk-requirements-to-month"
  );
  if (bulkToMonthInput) {
    bulkToMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.bulkRequirements.toMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      filterBulkRequirementsData();
    });
  }

  // Product ID input with debounce for netting
  const nettingProductIdInput = document.getElementById("netting-product-id");
  if (nettingProductIdInput) {
    let productIdTimeout;
    nettingProductIdInput.addEventListener("input", function () {
      clearTimeout(productIdTimeout);
      productIdTimeout = setTimeout(() => {
        filterState.netting.productId = this.value.trim();
        filterNettingData();
      }, 500); // 500ms debounce
    });
  }

  // Product Name input with debounce for netting
  const nettingProductNameInput = document.getElementById(
    "netting-product-name"
  );
  if (nettingProductNameInput) {
    let productNameTimeout;
    nettingProductNameInput.addEventListener("input", function () {
      clearTimeout(productNameTimeout);
      productNameTimeout = setTimeout(() => {
        filterState.netting.productName = this.value.trim();
        filterNettingData();
      }, 500); // 500ms debounce
    });
  }

  // Product ID input with debounce for wip
  const wipProductIdInput = document.getElementById("wip-product-id");
  if (wipProductIdInput) {
    let wipProductIdTimeout;
    wipProductIdInput.addEventListener("input", function () {
      clearTimeout(wipProductIdTimeout);
      wipProductIdTimeout = setTimeout(() => {
        filterState.wip.productId = this.value.trim();
        filterWipData();
      }, 500); // 500ms debounce
    });
  }

  // Product Name input with debounce for wip
  const wipProductNameInput = document.getElementById("wip-product-name");
  if (wipProductNameInput) {
    let wipProductNameTimeout;
    wipProductNameInput.addEventListener("input", function () {
      clearTimeout(wipProductNameTimeout);
      wipProductNameTimeout = setTimeout(() => {
        filterState.wip.productName = this.value.trim();
        filterWipData();
      }, 500); // 500ms debounce
    });
  }

  // Month inputs for netting
  const nettingFromMonthInput = document.getElementById("netting-from-month");
  if (nettingFromMonthInput) {
    nettingFromMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.netting.fromMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      filterNettingData();
    });
  }

  const nettingToMonthInput = document.getElementById("netting-to-month");
  if (nettingToMonthInput) {
    nettingToMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.netting.toMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      filterNettingData();
    });
  }

  // Month inputs for wip
  const wipFromMonthInput = document.getElementById("wip-from-month");
  if (wipFromMonthInput) {
    wipFromMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.wip.fromMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      filterWipData();
    });
  }

  const wipToMonthInput = document.getElementById("wip-to-month");
  if (wipToMonthInput) {
    wipToMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.wip.toMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      filterWipData();
    });
  }

  // Normalizer month inputs
  const normalizerFromMonthInput = document.getElementById(
    "normalizer-from-month"
  );
  if (normalizerFromMonthInput) {
    normalizerFromMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.normalizer.fromMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      loadNormalizerData(0);
    });
  }

  const normalizerToMonthInput = document.getElementById("normalizer-to-month");
  if (normalizerToMonthInput) {
    normalizerToMonthInput.addEventListener("change", function () {
      const [year, month] = this.value.split("-");
      filterState.normalizer.toMonth = new Date(
        parseInt(year),
        parseInt(month) - 1,
        1
      );
      loadNormalizerData(0);
    });
  }

  // Normalizer product ID and name inputs
  const normalizerProductIdInput = document.getElementById(
    "normalizer-product-id"
  );
  if (normalizerProductIdInput) {
    normalizerProductIdInput.addEventListener("change", function () {
      filterState.normalizer.productId = this.value.trim();
      loadNormalizerData(0);
    });
  }

  const normalizerProductNameInput = document.getElementById(
    "normalizer-product-name"
  );
  if (normalizerProductNameInput) {
    normalizerProductNameInput.addEventListener("change", function () {
      filterState.normalizer.productName = this.value.trim();
      loadNormalizerData(0);
    });
  }
}

// Forecast Hierarchy loader
const forecastState = { page: 0, loading: false, loaded: false };

async function loadForecastHierarchyData(page = 0) {
  if (forecastState.loading) return;
  forecastState.loading = true;
  forecastState.page = page;

  const statusEl = document.getElementById("forecast-page-info");
  const bodyEl = document.getElementById("forecast-hierarchy-body");
  const thead = document.getElementById("forecast-hierarchy-thead");

  if (!statusEl || !bodyEl || !thead) {
    forecastState.loading = false;
    setTimeout(() => loadForecastHierarchyData(page), 120);
    return;
  }

  statusEl.textContent = "Loading...";
  showSkeletonLoading("forecast-hierarchy-body", 8, 6);

  try {
    const fromISO = document.getElementById("forecast-from-month").value;
    const toISO = document.getElementById("forecast-to-month").value;
    const start = fromISO ? `${fromISO}-01` : fmtDate(fenceStart());
    const toShown = toISO
      ? new Date(`${toISO}-01T00:00:00`)
      : addMonths(fenceStart(), 12);
    const end = fmtDate(addMonths(monthFloor(toShown), 1));

    const level = filterState.forecastHierarchy.level || "godown";
    let viewName = "v_forecast_production_plan_godown";
    if (level === "region") viewName = "v_forecast_production_plan_region";
    if (level === "sku") viewName = "v_forecast_production_plan_sku";

    // Select columns depending on level
    let selectCols =
      "sku_id,month_start,opening_stock,demand_baseline,target_stock,projected_stock_before_prod,production_qty,projected_stock_after_prod";
    if (level === "godown")
      selectCols =
        "sku_id,region_id,godown_id,month_start,opening_stock_at_start,demand_baseline,target_stock,projected_stock_before_prod,production_qty,projected_stock_after_prod";
    if (level === "region")
      selectCols =
        "sku_id,region_id,month_start,opening_stock,demand_baseline,target_stock,projected_stock_before_prod,production_qty,projected_stock_after_prod";

    // Build base query (without range yet) so we can apply additional filters
    let q = supabase
      .from(viewName)
      .select(selectCols, { count: "exact" })
      .gte("month_start", start)
      .lt("month_start", end)
      .order("sku_id", { ascending: true })
      .order("month_start", { ascending: true });

    // Apply SKU ID filter if provided
    const skuIdFilter =
      filterState.forecastHierarchy.skuId ||
      (document.getElementById("forecast-sku-id") &&
        document.getElementById("forecast-sku-id").value.trim());
    if (skuIdFilter) {
      q = q.eq("sku_id", Number(skuIdFilter));
    }

    // Apply Product Name filter by resolving matching SKU IDs from SKU catalog
    const productNameFilter =
      filterState.forecastHierarchy.productName ||
      (document.getElementById("forecast-product-name") &&
        document.getElementById("forecast-product-name").value.trim());
    if (productNameFilter) {
      const { data: skuData, error: skuError } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id")
        .ilike("item", `%${productNameFilter}%`);

      if (skuError) throw skuError;

      if (skuData && skuData.length > 0) {
        const matchingSkuIds = skuData.map((row) => row.sku_id);
        q = q.in("sku_id", matchingSkuIds);
      } else {
        // No SKUs match the name filter -> show no data
        hideSkeletonLoading("forecast-hierarchy-body");
        bodyEl.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:#666">No SKUs found matching the product name filter</td></tr>`;
        statusEl.textContent = "No data";
        forecastState.loading = false;
        return;
      }
    }

    // Execute paged query
    const { data, error, count } = await q.range(
      page * PAGE_SIZE,
      page * PAGE_SIZE + PAGE_SIZE - 1
    );

    hideSkeletonLoading("forecast-hierarchy-body");

    if (error) throw error;

    if (!data || data.length === 0) {
      bodyEl.innerHTML =
        '<tr><td colspan="8" style="text-align:center;padding:20px;color:#666">No data</td></tr>';
      statusEl.textContent = "No data";
      forecastState.loading = false;
      return;
    }

    // Preload product info (Product Name, UOM) for SKUs present in results
    const skuIds = Array.from(
      new Set(data.map((r) => r.sku_id).filter(Boolean))
    );
    const skuMap = {};
    try {
      if (skuIds.length) {
        const { data: skuData, error: skuErr } = await supabase
          .from("v_sku_catalog_enriched")
          .select("sku_id,item,uom")
          .in("sku_id", skuIds);
        if (skuErr) console.warn("sku lookup error", skuErr);
        if (skuData)
          skuData.forEach(
            (s) => (skuMap[s.sku_id] = { name: s.item, uom: s.uom })
          );
      }
    } catch (skuLookupErr) {
      console.warn("sku lookup fetch error", skuLookupErr);
    }

    // Build headers and rows based on level
    let headersHtml = "";
    if (level === "godown") {
      // For godown level we need to resolve region_code and godown_code
      headersHtml = `<tr>
        <th>SKU ID</th>
        <th>Product Name</th>
        <th>UOM</th>
        <th>Region</th>
        <th>Godown</th>
        <th>Month</th>
        <th>Opening Stock</th>
        <th>Demand (baseline)</th>
        <th>Target Stock</th>
        <th>Proj. Stock before Production</th>
        <th>Production Qty</th>
        <th>Proj. Stock after Production</th>
      </tr>`;

      thead.innerHTML = headersHtml;

      // Build lookup maps for region_code and godown_code
      const regionIds = Array.from(
        new Set(data.map((r) => r.region_id).filter(Boolean))
      );
      const godownIds = Array.from(
        new Set(data.map((r) => r.godown_id).filter(Boolean))
      );
      const regionMap = {};
      const godownMap = {};

      try {
        if (regionIds.length) {
          const { data: regData, error: regErr } = await supabase
            .from("v_sdv_dim_godown_region")
            .select("region_id,region_code")
            .in("region_id", regionIds);
          if (regErr) console.warn("region lookup error", regErr);
          if (regData)
            regData.forEach((r) => (regionMap[r.region_id] = r.region_code));
        }
        if (godownIds.length) {
          const { data: godData, error: godErr } = await supabase
            .from("v_sdv_dim_godown_region")
            .select("godown_id,godown_code")
            .in("godown_id", godownIds);
          if (godErr) console.warn("godown lookup error", godErr);
          if (godData)
            godData.forEach((g) => (godownMap[g.godown_id] = g.godown_code));
        }
      } catch (lookupErr) {
        console.warn("lookup fetch error", lookupErr);
      }

      bodyEl.innerHTML = data
        .map((r) => {
          const skuInfo = skuMap[r.sku_id] || { name: "", uom: "" };
          const productName = skuInfo.name || "";
          const uom = skuInfo.uom || "";
          const regionCode = regionMap[r.region_id] || r.region_id || "";
          const godownCode = godownMap[r.godown_id] || r.godown_id || "";
          const opening = Number(
            r.opening_stock_at_start ?? r.opening_stock ?? 0
          ).toFixed(3);
          const demand = Number(r.demand_baseline ?? 0).toFixed(3);
          const target = Number(r.target_stock ?? 0).toFixed(3);
          const beforeProd = Number(r.projected_stock_before_prod ?? 0).toFixed(
            3
          );
          const prod = Number(r.production_qty ?? 0).toFixed(3);
          const afterProd = Number(r.projected_stock_after_prod ?? 0).toFixed(
            3
          );
          return `<tr>
            <td>${r.sku_id}</td>
            <td>${escapeHtml(productName)}</td>
            <td>${escapeHtml(uom)}</td>
            <td>${regionCode}</td>
            <td>${godownCode}</td>
            <td>${formatMonth(r.month_start)}</td>
            <td>${opening}</td>
            <td>${demand}</td>
            <td>${target}</td>
            <td>${beforeProd}</td>
            <td>${prod}</td>
            <td>${afterProd}</td>
          </tr>`;
        })
        .join("");
    } else if (level === "region") {
      // Region level: SKU ID, Product Name, UOM, Region (code), Month, Opening Stock, Demand (baseline), Target Stock, Proj. Stock before Production, Production Qty, Proj. Stock after Production
      headersHtml = `<tr>
        <th>SKU ID</th>
        <th>Product Name</th>
        <th>UOM</th>
        <th>Region</th>
        <th>Month</th>
        <th>Opening Stock</th>
        <th>Demand (baseline)</th>
        <th>Target Stock</th>
        <th>Proj. Stock before Production</th>
        <th>Production Qty</th>
        <th>Proj. Stock after Production</th>
      </tr>`;
      thead.innerHTML = headersHtml;

      // resolve region codes
      const regionIds = Array.from(
        new Set(data.map((r) => r.region_id).filter(Boolean))
      );
      const regionMap = {};
      try {
        if (regionIds.length) {
          const { data: regData, error: regErr } = await supabase
            .from("v_sdv_dim_godown_region")
            .select("region_id,region_code")
            .in("region_id", regionIds);
          if (regErr) console.warn("region lookup error", regErr);
          if (regData)
            regData.forEach((r) => (regionMap[r.region_id] = r.region_code));
        }
      } catch (e) {
        console.warn("region lookup failed", e);
      }

      bodyEl.innerHTML = data
        .map((r) => {
          const skuInfo = skuMap[r.sku_id] || { name: "", uom: "" };
          const productName = skuInfo.name || "";
          const uom = skuInfo.uom || "";
          const regionCode = regionMap[r.region_id] || r.region_id || "";
          const opening = Number(r.opening_stock ?? 0).toFixed(3);
          const demand = Number(r.demand_baseline ?? 0).toFixed(3);
          const target = Number(r.target_stock ?? 0).toFixed(3);
          const beforeProd = Number(r.projected_stock_before_prod ?? 0).toFixed(
            3
          );
          const prod = Number(r.production_qty ?? 0).toFixed(3);
          const afterProd = Number(r.projected_stock_after_prod ?? 0).toFixed(
            3
          );
          return `<tr>
            <td>${r.sku_id}</td>
            <td>${escapeHtml(productName)}</td>
            <td>${escapeHtml(uom)}</td>
            <td>${regionCode}</td>
            <td>${formatMonth(r.month_start)}</td>
            <td>${opening}</td>
            <td>${demand}</td>
            <td>${target}</td>
            <td>${beforeProd}</td>
            <td>${prod}</td>
            <td>${afterProd}</td>
          </tr>`;
        })
        .join("");
    } else {
      // SKU level: SKU ID, Product Name, UOM, Month, Opening Stock, Demand (baseline), Target Stock, Proj. Stock before Production, Production Qty, Proj. Stock after Production
      headersHtml = `<tr>
        <th>SKU ID</th>
        <th>Product Name</th>
        <th>UOM</th>
        <th>Month</th>
        <th>Opening Stock</th>
        <th>Demand (baseline)</th>
        <th>Target Stock</th>
        <th>Proj. Stock before Production</th>
        <th>Production Qty</th>
        <th>Proj. Stock after Production</th>
      </tr>`;
      thead.innerHTML = headersHtml;

      bodyEl.innerHTML = data
        .map((r) => {
          const skuInfo = skuMap[r.sku_id] || { name: "", uom: "" };
          const productName = skuInfo.name || "";
          const uom = skuInfo.uom || "";
          const opening = Number(r.opening_stock ?? 0).toFixed(3);
          const demand = Number(r.demand_baseline ?? 0).toFixed(3);
          const target = Number(r.target_stock ?? 0).toFixed(3);
          const beforeProd = Number(r.projected_stock_before_prod ?? 0).toFixed(
            3
          );
          const prod = Number(r.production_qty ?? 0).toFixed(3);
          const afterProd = Number(r.projected_stock_after_prod ?? 0).toFixed(
            3
          );
          return `<tr>
            <td>${r.sku_id}</td>
            <td>${escapeHtml(productName)}</td>
            <td>${escapeHtml(uom)}</td>
            <td>${formatMonth(r.month_start)}</td>
            <td>${opening}</td>
            <td>${demand}</td>
            <td>${target}</td>
            <td>${beforeProd}</td>
            <td>${prod}</td>
            <td>${afterProd}</td>
          </tr>`;
        })
        .join("");
    }

    const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
    statusEl.textContent = `Page ${page + 1} of ${totalPages} (${
      count || 0
    } records)`;

    forecastState.loaded = true;
  } catch (err) {
    console.error("Forecast hierarchy load error:", err);
    hideSkeletonLoading("forecast-hierarchy-body");
    bodyEl.innerHTML = `<tr><td colspan=8 style='text-align:center;padding:20px;color:#dc2626'>Error loading: ${err.message}</td></tr>`;
    statusEl.textContent = "Error";
  } finally {
    forecastState.loading = false;
  }
}

// Wire forecast controls
function initForecastControls() {
  // Default months
  const from = document.getElementById("forecast-from-month");
  const to = document.getElementById("forecast-to-month");
  const now = new Date();
  const defaultMonthValue = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  if (from) from.value = defaultMonthValue;
  if (to) to.value = defaultMonthValue;

  // Level select (simple ERP-style dropdown)
  const levelSelect = document.getElementById("forecast-level-select");
  if (levelSelect) {
    levelSelect.addEventListener("change", () => {
      filterState.forecastHierarchy.level = levelSelect.value;
      forecastState.page = 0;
      loadForecastHierarchyData(0);
    });
  }

  const forecastResetBtn = document.getElementById("forecast-reset");
  if (forecastResetBtn) {
    forecastResetBtn.addEventListener("click", () => {
      resetForecastFilters();
    });
  }
  // Export CSV button for forecast
  const forecastExportBtn = document.getElementById("forecast-export");
  if (forecastExportBtn) {
    forecastExportBtn.addEventListener("click", () => {
      exportForecastData();
    });
  }

  const forecastPrev = document.getElementById("forecast-prev");
  if (forecastPrev) {
    forecastPrev.addEventListener("click", () => {
      if (forecastState.page > 0)
        loadForecastHierarchyData(forecastState.page - 1);
    });
  }
  const forecastNext = document.getElementById("forecast-next");
  if (forecastNext) {
    forecastNext.addEventListener("click", () => {
      loadForecastHierarchyData(forecastState.page + 1);
    });
  }
}

// Export filtered forecast data to CSV
async function exportForecastData() {
  try {
    const fromISO = document.getElementById("forecast-from-month").value;
    const toISO = document.getElementById("forecast-to-month").value;
    const level =
      filterState.forecastHierarchy.level ||
      (document.getElementById("forecast-level-select") &&
        document.getElementById("forecast-level-select").value) ||
      "godown";
    const skuId =
      filterState.forecastHierarchy.skuId ||
      (document.getElementById("forecast-sku-id") &&
        document.getElementById("forecast-sku-id").value.trim());
    const productName =
      filterState.forecastHierarchy.productName ||
      (document.getElementById("forecast-product-name") &&
        document.getElementById("forecast-product-name").value.trim());

    const start = fromISO ? `${fromISO}-01` : fmtDate(fenceStart());
    const toShown = toISO
      ? new Date(`${toISO}-01T00:00:00`)
      : addMonths(fenceStart(), 12);
    const end = fmtDate(addMonths(monthFloor(toShown), 1));

    let viewName = "v_forecast_production_plan_godown";
    if (level === "region") viewName = "v_forecast_production_plan_region";
    if (level === "sku") viewName = "v_forecast_production_plan_sku";

    // Select columns consistent with loader
    let selectCols =
      "sku_id,month_start,opening_stock,demand_baseline,target_stock,projected_stock_before_prod,production_qty,projected_stock_after_prod";
    if (level === "godown")
      selectCols =
        "sku_id,region_id,godown_id,month_start,opening_stock_at_start,demand_baseline,target_stock,projected_stock_before_prod,production_qty,projected_stock_after_prod";
    if (level === "region")
      selectCols =
        "sku_id,region_id,month_start,opening_stock,demand_baseline,target_stock,projected_stock_before_prod,production_qty,projected_stock_after_prod";

    let q = supabase
      .from(viewName)
      .select(selectCols)
      .gte("month_start", start)
      .lt("month_start", end)
      .order("sku_id", { ascending: true })
      .order("month_start", { ascending: true });

    if (skuId) q = q.eq("sku_id", skuId);

    if (productName) {
      const { data: skuData, error: skuError } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id")
        .ilike("item", `%${productName}%`);
      if (skuError) throw skuError;
      if (!skuData || skuData.length === 0) {
        showToast("No data found matching the product name filter", "error");
        return;
      }
      const matchingSkuIds = skuData.map((r) => r.sku_id);
      q = q.in("sku_id", matchingSkuIds);
    }

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) {
      showToast("No data found for export", "error");
      return;
    }

    // Enrich with SKU item and uom
    const skuIds = [...new Set(data.map((r) => r.sku_id))];
    const { data: skuInfoData } = await supabase
      .from("v_sku_catalog_enriched")
      .select("sku_id,item,uom")
      .in("sku_id", skuIds);
    const skuMap = {};
    if (skuInfoData)
      skuInfoData.forEach(
        (s) => (skuMap[s.sku_id] = { item: s.item, uom: s.uom })
      );

    // Build CSV rows
    const headers = [];
    if (level === "godown") {
      headers.push(
        "SKU ID",
        "Product Name",
        "UOM",
        "Region",
        "Godown",
        "Month",
        "Opening Stock",
        "Demand (baseline)",
        "Target Stock",
        "Proj. Stock before Production",
        "Production Qty",
        "Proj. Stock after Production"
      );
    } else if (level === "region") {
      headers.push(
        "SKU ID",
        "Product Name",
        "UOM",
        "Region",
        "Month",
        "Opening Stock",
        "Demand (baseline)",
        "Target Stock",
        "Proj. Stock before Production",
        "Production Qty",
        "Proj. Stock after Production"
      );
    } else {
      headers.push(
        "SKU ID",
        "Product Name",
        "UOM",
        "Month",
        "Opening Stock",
        "Demand (baseline)",
        "Target Stock",
        "Proj. Stock before Production",
        "Production Qty",
        "Proj. Stock after Production"
      );
    }

    const rows = data.map((r) => {
      const s = skuMap[r.sku_id] || { item: "", uom: "" };
      if (level === "godown") {
        return [
          r.sku_id,
          s.item,
          s.uom,
          r.region_id || "",
          r.godown_id || "",
          formatMonth(r.month_start),
          Number(r.opening_stock_at_start ?? r.opening_stock ?? 0).toFixed(3),
          Number(r.demand_baseline ?? 0).toFixed(3),
          Number(r.target_stock ?? 0).toFixed(3),
          Number(r.projected_stock_before_prod ?? 0).toFixed(3),
          Number(r.production_qty ?? 0).toFixed(3),
          Number(r.projected_stock_after_prod ?? 0).toFixed(3),
        ];
      }
      if (level === "region") {
        return [
          r.sku_id,
          s.item,
          s.uom,
          r.region_id || "",
          formatMonth(r.month_start),
          Number(r.opening_stock ?? 0).toFixed(3),
          Number(r.demand_baseline ?? 0).toFixed(3),
          Number(r.target_stock ?? 0).toFixed(3),
          Number(r.projected_stock_before_prod ?? 0).toFixed(3),
          Number(r.production_qty ?? 0).toFixed(3),
          Number(r.projected_stock_after_prod ?? 0).toFixed(3),
        ];
      }
      return [
        r.sku_id,
        s.item,
        s.uom,
        formatMonth(r.month_start),
        Number(r.opening_stock ?? 0).toFixed(3),
        Number(r.demand_baseline ?? 0).toFixed(3),
        Number(r.target_stock ?? 0).toFixed(3),
        Number(r.projected_stock_before_prod ?? 0).toFixed(3),
        Number(r.production_qty ?? 0).toFixed(3),
        Number(r.projected_stock_after_prod ?? 0).toFixed(3),
      ];
    });

    // Build CSV content
    const csvLines = [headers.join(",")].concat(
      rows.map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      )
    );
    const csvContent = csvLines.join("\n");

    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast_export_${level}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // Attempt to stringify Error-like objects, fall back to raw
    let errText;
    try {
      errText = JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
    } catch {
      errText = String(err);
    }
    console.error("Export forecast failed:", errText);
    const msg =
      (err && (err.message || err.error || err.details || errText)) ||
      "Unknown error";
    showToast("Export failed: " + msg, "error");
  }
}

function resetForecastFilters() {
  const now = new Date();
  const defaultMonthValue = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const from = document.getElementById("forecast-from-month");
  const to = document.getElementById("forecast-to-month");
  const level = document.getElementById("forecast-level-select");
  const skuId = document.getElementById("forecast-sku-id");
  const productName = document.getElementById("forecast-product-name");

  if (from) {
    from.value = defaultMonthValue;
    filterState.forecastHierarchy.fromMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
  }
  if (to) {
    to.value = defaultMonthValue;
    filterState.forecastHierarchy.toMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
  }
  if (level) {
    level.value = "godown";
    filterState.forecastHierarchy.level = "godown";
  }
  if (skuId) skuId.value = "";
  if (productName) productName.value = "";

  filterState.forecastHierarchy.skuId = "";
  filterState.forecastHierarchy.productName = "";
  forecastState.page = 0;
  loadForecastHierarchyData(0);
}

// Reset filters to default state
function resetNettingFilters() {
  // Reset date filters to current month
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const defaultMonthValue = `${currentYear}-${String(currentMonth + 1).padStart(
    2,
    "0"
  )}`;

  const nettingFromInput = document.getElementById("netting-from-month");
  const nettingToInput = document.getElementById("netting-to-month");

  if (nettingFromInput) {
    nettingFromInput.value = defaultMonthValue;
    filterState.netting.fromMonth = new Date(currentYear, currentMonth, 1);
  }

  if (nettingToInput) {
    nettingToInput.value = defaultMonthValue;
    filterState.netting.toMonth = new Date(currentYear, currentMonth, 1);
  }

  // Clear text inputs
  document.getElementById("netting-product-id").value = "";
  document.getElementById("netting-product-name").value = "";

  // Reset boolean filters to "All"
  document.querySelectorAll(".toggle-group").forEach((group) => {
    const buttons = group.querySelectorAll(".toggle-option");
    buttons.forEach((btn) => btn.classList.remove("active", "inactive"));
    const allButton = group.querySelector('[data-value="all"]');
    if (allButton) allButton.classList.add("active");
  });

  // Reset filter state
  filterState.netting = {
    fromMonth: new Date(currentYear, currentMonth, 1),
    toMonth: new Date(currentYear, currentMonth, 1),
    productId: "",
    productName: "",
    bulkRequired: "all",
    sohApplied: "all",
    sohRemaining: "all",
  };

  // Reload data
  filterNettingData();
}

// Reset WIP filters to default state
function resetWipFilters() {
  // Reset date filters to current month
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const defaultMonthValue = `${currentYear}-${String(currentMonth + 1).padStart(
    2,
    "0"
  )}`;

  const wipFromInput = document.getElementById("wip-from-month");
  const wipToInput = document.getElementById("wip-to-month");

  if (wipFromInput) {
    wipFromInput.value = defaultMonthValue;
    filterState.wip.fromMonth = new Date(currentYear, currentMonth, 1);
  }

  if (wipToInput) {
    wipToInput.value = defaultMonthValue;
    filterState.wip.toMonth = new Date(currentYear, currentMonth, 1);
  }

  // Clear text inputs
  document.getElementById("wip-product-id").value = "";
  document.getElementById("wip-product-name").value = "";

  // Reset boolean filters to "All"
  document.querySelectorAll("#tab-wip .toggle-group").forEach((group) => {
    const buttons = group.querySelectorAll(".toggle-option");
    buttons.forEach((btn) => btn.classList.remove("active", "inactive"));
    const allButton = group.querySelector('[data-value="all"]');
    if (allButton) allButton.classList.add("active");
  });

  // Reset filter state
  filterState.wip = {
    fromMonth: new Date(currentYear, currentMonth, 1),
    toMonth: new Date(currentYear, currentMonth, 1),
    productId: "",
    productName: "",
    netBeforeWip: "all",
    wipDeducted: "all",
    wipPool: "all",
  };

  // Reload data
  filterWipData();
}

// ============= Authentication =============
async function ensureAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ============= Tab Management =============
function initTabSystem() {
  const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
  const tabPanels = document.querySelectorAll(".tabpanel");
  const tabsEl = document.querySelector(".tabs");
  const leftChevron = document.querySelector(".tabs-chevron.left");
  const rightChevron = document.querySelector(".tabs-chevron.right");
  // Ensure tabindex is set correctly on init
  tabButtons.forEach((btn) => {
    if (btn.getAttribute("aria-selected") === "true")
      btn.setAttribute("tabindex", "0");
    else btn.setAttribute("tabindex", "-1");
  });

  // Click and keyboard handling
  tabButtons.forEach((button, index) => {
    const activate = (btn) => {
      const tabId = btn.getAttribute("aria-controls").replace("tab-", "");
      // Update active states
      tabButtons.forEach((b) => {
        b.setAttribute("aria-selected", "false");
        b.setAttribute("tabindex", "-1");
      });
      tabPanels.forEach((panel) => panel.classList.remove("active"));

      btn.setAttribute("aria-selected", "true");
      btn.setAttribute("tabindex", "0");
      btn.focus();
      document.getElementById(`tab-${tabId}`).classList.add("active");

      // Update workflow steps and auto-load
      updateWorkflowSteps(tabId);
      autoLoadTabData(tabId);
      // Ensure active tab is visible in the scrollable tabs container
      try {
        if (tabsEl && btn) {
          // Precisely center the button inside the tabs container
          const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
          const targetScrollLeft = Math.max(
            0,
            btnCenter - tabsEl.clientWidth / 2
          );
          tabsEl.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
          // ensure chevrons reflect the new scroll position
          updateChevronState();
        }
      } catch {
        // ignore scroll errors
      }
    };

    button.addEventListener("click", () => activate(button));

    button.addEventListener("keydown", (e) => {
      const key = e.key;
      if (key === "ArrowRight") {
        e.preventDefault();
        const next = tabButtons[(index + 1) % tabButtons.length];
        // Move focus and ensure only focused tab is tabbable
        tabButtons.forEach((b) => b.setAttribute("tabindex", "-1"));
        next.setAttribute("tabindex", "0");
        next.focus();
      } else if (key === "ArrowLeft") {
        e.preventDefault();
        const prev =
          tabButtons[(index - 1 + tabButtons.length) % tabButtons.length];
        tabButtons.forEach((b) => b.setAttribute("tabindex", "-1"));
        prev.setAttribute("tabindex", "0");
        prev.focus();
      } else if (key === "Home") {
        e.preventDefault();
        tabButtons.forEach((b) => b.setAttribute("tabindex", "-1"));
        tabButtons[0].setAttribute("tabindex", "0");
        tabButtons[0].focus();
      } else if (key === "End") {
        e.preventDefault();
        tabButtons.forEach((b) => b.setAttribute("tabindex", "-1"));
        const last = tabButtons[tabButtons.length - 1];
        last.setAttribute("tabindex", "0");
        last.focus();
      } else if (key === "Enter" || key === " ") {
        e.preventDefault();
        activate(document.activeElement);
        // also ensure the active element is scrolled into view
        if (tabsEl && document.activeElement.classList.contains("tab-btn")) {
          document.activeElement.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
          });
          updateChevronState();
        }
      }
    });
  });

  // Chevron scrolling helpers
  const SCROLL_DELTA = 200;
  function updateChevronState() {
    if (!tabsEl || !leftChevron || !rightChevron) return;
    const isOverflowing = tabsEl.scrollWidth > tabsEl.clientWidth + 2;
    if (!isOverflowing) {
      // hide chevrons when no overflow
      leftChevron.style.display = "none";
      rightChevron.style.display = "none";
      leftChevron.setAttribute("disabled", "true");
      rightChevron.setAttribute("disabled", "true");
      return;
    }

    // ensure chevrons are visible when overflow exists
    leftChevron.style.display = "inline-flex";
    rightChevron.style.display = "inline-flex";

    const canScrollLeft = tabsEl.scrollLeft > 2;
    const canScrollRight =
      tabsEl.scrollLeft + tabsEl.clientWidth < tabsEl.scrollWidth - 2;
    if (canScrollLeft) leftChevron.removeAttribute("disabled");
    else leftChevron.setAttribute("disabled", "true");
    if (canScrollRight) rightChevron.removeAttribute("disabled");
    else rightChevron.setAttribute("disabled", "true");
  }

  if (leftChevron && rightChevron && tabsEl) {
    leftChevron.addEventListener("click", () => {
      const newLeft = Math.max(0, tabsEl.scrollLeft - SCROLL_DELTA);
      tabsEl.scrollTo({ left: newLeft, behavior: "smooth" });
      setTimeout(updateChevronState, 150);
    });
    rightChevron.addEventListener("click", () => {
      const maxLeft = tabsEl.scrollWidth - tabsEl.clientWidth;
      const newLeft = Math.min(maxLeft, tabsEl.scrollLeft + SCROLL_DELTA);
      tabsEl.scrollTo({ left: newLeft, behavior: "smooth" });
      setTimeout(updateChevronState, 150);
    });

    // Update state on user scroll
    tabsEl.addEventListener("scroll", () => {
      // throttle via requestAnimationFrame
      window.requestAnimationFrame(updateChevronState);
    });

    // initialize chevron state
    updateChevronState();
    // Recompute chevrons when window resizes (debounced-ish)
    let resizeTimeout = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateChevronState, 120);
    });
  }
}

function updateWorkflowSteps(activeTab) {
  const mapping = {
    "bulk-requirements": "step-bulk-requirements",
    "net-sku-plan": "step-net-sku-plan",
    "forecast-hierarchy": "step-forecast-hierarchy",
    "production-netting": "step-production-netting",
    "production-wip": "step-production-wip",
    "production-normalizer": "step-production-normalizer",
  };

  // Remove active from all mapped steps (guarding missing elements)
  Object.values(mapping).forEach((stepId) => {
    const el = document.getElementById(stepId);
    if (el) el.classList.remove("active");
  });

  // Add active to current step if mapping exists
  const activeStepId = mapping[activeTab];
  if (activeStepId) {
    const activeEl = document.getElementById(activeStepId);
    if (activeEl) activeEl.classList.add("active");
  }
}

function autoLoadTabData(tabId) {
  switch (tabId) {
    case "forecast-hierarchy":
      if (!tabState.forecastHierarchy?.loaded && !forecastState.loaded)
        loadForecastHierarchyData();
      break;
    case "net-sku-plan":
      if (!tabState.netSkuPlan.loaded) loadNetSkuPlanData();
      break;
    case "bulk-requirements":
      if (!tabState.bulkRequirements.loaded) loadBulkRequirementsData();
      break;
    case "netting":
      if (!tabState.netting.loaded) loadNettingData();
      break;
    case "wip":
      if (!tabState.wip.loaded) loadWipData();
      break;
    case "normalizer":
      if (!tabState.normalizer.loaded) loadNormalizerData();
      break;
  }
}

// ============= Date Initialization =============
function setDefaultDates() {
  const start = fenceStart(new Date(), 25);
  const end = addMonths(start, 12);
  const endDisplay = addMonths(end, -1);

  // Set default dates for WIP and Normalizer tabs (Netting uses enhanced filters)
  const wipFromEl = document.getElementById("wip-from-date");
  const wipToEl = document.getElementById("wip-to-date");
  const normalizerFromEl = document.getElementById("normalizer-from-date");
  const normalizerToEl = document.getElementById("normalizer-to-date");

  if (wipFromEl) wipFromEl.value = fmtDate(start);
  if (wipToEl) wipToEl.value = fmtDate(endDisplay);

  if (normalizerFromEl) normalizerFromEl.value = fmtDate(start);
  if (normalizerToEl) normalizerToEl.value = fmtDate(endDisplay);
}

// ============= Production Netting Functions =============
async function loadNettingData(page = 0) {
  if (tabState.netting.loading) return;

  tabState.netting.loading = true;
  tabState.netting.page = page;

  const statusEl = document.getElementById("netting-page-info");
  const bodyEl = document.getElementById("netting-body");

  statusEl.textContent = "Loading...";
  showSkeletonLoading("netting-body", 8, 8); // Show skeleton for netting table (8 columns)

  try {
    // Use enhanced filters instead of old date inputs
    const start = filterState.netting.fromMonth
      ? fmtDate(filterState.netting.fromMonth)
      : fmtDate(fenceStart());

    const toShown = filterState.netting.toMonth
      ? filterState.netting.toMonth
      : addMonths(fenceStart(), 12);
    const toExclusive = addMonths(monthFloor(toShown), 1);
    const end = fmtDate(toExclusive);

    // Query netting data with count
    let nettingQuery = supabase
      .from("v_product_bulk_net_to_make")
      .select(
        "product_id,month_start,bulk_required,soh_applied,net_bulk_to_make,remaining_soh_after,uom_base",
        { count: "exact" }
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // Apply enhanced filters
    if (filterState.netting.productId) {
      nettingQuery = nettingQuery.eq(
        "product_id",
        Number(filterState.netting.productId)
      );
    }

    // Apply boolean filters
    if (filterState.netting.bulkRequired === "present") {
      nettingQuery = nettingQuery
        .not("bulk_required", "is", null)
        .gt("bulk_required", 0);
    } else if (filterState.netting.bulkRequired === "absent") {
      nettingQuery = nettingQuery.or(
        "bulk_required.is.null,bulk_required.eq.0"
      );
    }

    if (filterState.netting.sohApplied === "present") {
      nettingQuery = nettingQuery
        .not("soh_applied", "is", null)
        .gt("soh_applied", 0);
    } else if (filterState.netting.sohApplied === "absent") {
      nettingQuery = nettingQuery.or("soh_applied.is.null,soh_applied.eq.0");
    }

    if (filterState.netting.sohRemaining === "present") {
      nettingQuery = nettingQuery
        .not("remaining_soh_after", "is", null)
        .gt("remaining_soh_after", 0);
    } else if (filterState.netting.sohRemaining === "absent") {
      nettingQuery = nettingQuery.or(
        "remaining_soh_after.is.null,remaining_soh_after.eq.0"
      );
    }

    const {
      data: nettingData,
      error: nettingError,
      count: totalCount,
    } = await nettingQuery;
    if (nettingError) {
      console.error(nettingError);
      hideSkeletonLoading("netting-body"); // Clear skeleton on error
      statusEl.textContent = "Error loading netting data.";
      showToast("Error loading netting data", "error");
      return;
    }

    // Get unique product IDs from netting data
    const productIds = [
      ...new Set(nettingData?.map((r) => r.product_id) || []),
    ];

    // Query product details for these product IDs (simplified since we have UOM from view)
    let productDetailsMap = {};
    if (productIds.length > 0) {
      const { data: productDetails, error: productError } = await supabase
        .from("products")
        .select("id,item")
        .in("id", productIds);

      if (productError) {
        console.warn("Error loading product details:", productError);
        // Continue without product details if this fails
      } else {
        // Create a map for quick lookup
        productDetails?.forEach((p) => {
          productDetailsMap[p.id] = {
            product_id: p.id,
            product_name: p.item,
          };
        });
      }
    }

    // Apply client-side product name filtering if specified
    let filteredNettingData = nettingData || [];
    if (filterState.netting.productName) {
      const searchTerm = filterState.netting.productName.toLowerCase();
      filteredNettingData = filteredNettingData.filter((r) => {
        const productDetails = productDetailsMap[r.product_id];
        const productName = productDetails?.product_name || "";
        return productName.toLowerCase().includes(searchTerm);
      });
    }

    // Calculate pagination info
    const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);
    const currentPage = page + 1;
    const startRecord = page * PAGE_SIZE + 1;
    const endRecord = Math.min((page + 1) * PAGE_SIZE, totalCount || 0);

    // Update page status
    statusEl.textContent =
      totalCount > 0
        ? `Page ${currentPage} of ${totalPages} (${startRecord}-${endRecord} of ${totalCount} records)`
        : `Page ${currentPage}`;

    // Update pagination buttons
    const prevBtn = document.getElementById("netting-prev");
    const nextBtn = document.getElementById("netting-next");

    prevBtn.disabled = page === 0;
    nextBtn.disabled = page >= totalPages - 1 || totalCount === 0;

    // Clear skeleton loading before rendering actual data
    hideSkeletonLoading("netting-body");

    (filteredNettingData || []).forEach((r) => {
      const productDetails = productDetailsMap[r.product_id];

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.product_id}</td>
        <td>${productDetails?.product_name || "Unknown Product"}</td>
        <td>${r.uom_base || ""}</td>
        <td>${formatMonth(r.month_start)}</td>
        <td>${Number(r.bulk_required ?? 0).toFixed(3)}</td>
        <td>${Number(r.soh_applied ?? 0).toFixed(3)}</td>
        <td>${Number(r.net_bulk_to_make ?? 0).toFixed(3)}</td>
        <td>${Number(r.remaining_soh_after ?? 0).toFixed(3)}</td>
        <td class="actions">
          <a href="#" data-pid="${r.product_id}" data-month="${
        r.month_start
      }" class="drill-netting">View</a>
        </td>
      `;
      bodyEl.appendChild(tr);
    });

    // Wire drill links
    bodyEl.querySelectorAll("a.drill-netting").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const pid = Number(a.dataset.pid);
        const month = a.dataset.month;
        openNettingDrill(pid, month);
      });
    });

    tabState.netting.loaded = true;
  } catch (error) {
    console.error("Netting load error:", error);
    hideSkeletonLoading("netting-body"); // Clear skeleton on error
    showToast("Failed to load netting data", "error");
  } finally {
    tabState.netting.loading = false;
  }
}

async function openNettingDrill(productId, month) {
  const modal = document.getElementById("drill-modal");
  const title = document.getElementById("drill-title");
  const subtitle = document.getElementById("drill-subtitle");
  const itemChip = document.getElementById("drill-item");
  const monthChip = document.getElementById("drill-month");
  const content = document.getElementById("drill-content");

  title.textContent = "Stock Details";
  subtitle.textContent = "Stock breakdown for this product";
  itemChip.textContent = `Product: ${productId}`;
  monthChip.textContent = `Month: ${formatMonth(month)}`;

  content.innerHTML =
    '<div style="text-align: center; padding: 20px;">Loading...</div>';
  modal.showModal();

  console.log(
    `🔍 Debugging Stock Drill-Down for Product ID: ${productId}, Month: ${month}`
  );

  let skuIds = [];
  let productName = "";

  try {
    let stockSections = [];
    let debugInfo = [];

    // First, get SKU IDs for this product from v_sku_catalog_enriched
    console.log("🔍 Looking up SKU IDs for product...");

    try {
      const { data: skuData, error: skuError } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id,item,sku_label")
        .eq("product_id", productId);

      if (skuError) {
        console.error("❌ SKU Lookup Error:", skuError);
        debugInfo.push(`SKU Lookup Error: ${skuError.message}`);
      } else if (skuData && skuData.length > 0) {
        skuIds = skuData.map((row) => row.sku_id);
        productName = skuData[0].item || "";
        console.log(
          `✅ Found ${skuIds.length} SKU IDs: [${skuIds.join(
            ", "
          )}] for product: ${productName}`
        );

        // Update chips with proper formatting
        itemChip.textContent = `Product: ${productName}`;
        monthChip.textContent = `Month: ${formatMonth(month)}`;
      } else {
        console.log("ℹ️ No SKU data found for this product");
        debugInfo.push("No SKU mapping found for this product");
        // Keep the initial formatting if no product name found
      }
    } catch (skuError) {
      console.error("💥 SKU Lookup Exception:", skuError);
      debugInfo.push(`SKU Lookup Exception: ${skuError.message}`);
    }

    // Try to load bottled stock with detailed debugging
    console.log("📦 Attempting to fetch bottled stock...");
    try {
      let bottledData = null;
      let bottledError = null;

      if (skuIds.length > 0) {
        const bottledQuery = supabase
          .from("bottled_stock_on_hand")
          .select(
            "batch_number,sku_id,pack_size,uom,on_hand,item,category,sub_category,group,sub_group"
          )
          .in("sku_id", skuIds);

        console.log("🔗 Bottled Stock Query:", {
          table: "bottled_stock_on_hand",
          columns:
            "batch_number,sku_id,pack_size,uom,on_hand,item,category,sub_category,group,sub_group",
          filter: `sku_id in [${skuIds.join(", ")}]`,
        });

        const result = await bottledQuery;
        bottledData = result.data;
        bottledError = result.error;
      } else {
        console.log("⚠️ No SKU IDs found, skipping bottled stock query");
        bottledData = null;
        bottledError = { message: "No SKU IDs found for this product" };
      }

      console.log("📦 Bottled Stock Result:", {
        data: bottledData ? `${bottledData.length} records` : "null",
        error: bottledError ? bottledError.message : "none",
      });

      if (bottledError) {
        console.error("❌ Bottled Stock Error:", bottledError);
        debugInfo.push(
          `Bottled Stock Error: ${
            bottledError.message || bottledError.code || "Unknown error"
          }`
        );
      } else if (bottledData && bottledData.length > 0) {
        console.log(`✅ Found ${bottledData.length} bottled stock records`);

        // Filter out rows with zero or null SOH (Count)
        const filteredBottledData = bottledData.filter(
          (row) => row.on_hand && row.on_hand > 0
        );

        if (filteredBottledData.length > 0) {
          stockSections.push(`
            <h4>Bottled Stock on Hand</h4>
            <div class="table-container">
              <div class="flex-table bottled-stock">
                <div class="flex-table-header">
                  <div class="flex-table-cell">SKU ID</div>
                  <div class="flex-table-cell">Item</div>
                  <div class="flex-table-cell">Batch Number</div>
                  <div class="flex-table-cell">Pack Size</div>
                  <div class="flex-table-cell">UOM</div>
                  <div class="flex-table-cell">SOH (Count)</div>
                </div>
                ${filteredBottledData
                  .map(
                    (row) => `
                  <div class="flex-table-row">
                    <div class="flex-table-cell">${row.sku_id || ""}</div>
                    <div class="flex-table-cell">${row.item || ""}</div>
                    <div class="flex-table-cell">${row.batch_number || ""}</div>
                    <div class="flex-table-cell">${row.pack_size || ""}</div>
                    <div class="flex-table-cell">${row.uom || ""}</div>
                    <div class="flex-table-cell">${fmtNum(row.on_hand)}</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `);
        } else {
          console.log("ℹ️ All bottled stock records have zero SOH");
          debugInfo.push("Bottled Stock: All records have zero stock on hand");
        }
      } else {
        console.log("ℹ️ No bottled stock data found");
        debugInfo.push("Bottled Stock: No data found for this product");
      }
    } catch (bottledError) {
      console.error("💥 Bottled Stock Exception:", bottledError);
      debugInfo.push(`Bottled Stock Exception: ${bottledError.message}`);
    }

    // Try to load FG bulk stock with detailed debugging
    console.log("🏭 Attempting to fetch FG bulk stock...");
    try {
      let bulkData = null;
      let bulkError = null;

      // Try fg_bulk_stock first
      try {
        let bulkQuery;
        let filterDescription;

        if (productName) {
          // Use the product name from SKU lookup for better matching
          bulkQuery = supabase
            .from("fg_bulk_stock")
            .select("product_id,item,bn,qty_on_hand,on_hand_qty_uom")
            .ilike("item", `%${productName}%`);
          filterDescription = `item contains "${productName}"`;
        } else {
          // Fallback to product ID if no product name found
          bulkQuery = supabase
            .from("fg_bulk_stock")
            .select("product_id,item,bn,qty_on_hand,on_hand_qty_uom")
            .ilike("item", `%${productId}%`);
          filterDescription = `item contains "${productId}"`;
        }

        console.log("🔗 FG Bulk Stock Query:", {
          table: "fg_bulk_stock",
          columns: "product_id,item,bn,qty_on_hand,on_hand_qty_uom",
          filter: filterDescription,
        });

        const result = await bulkQuery;
        bulkData = result.data;
        bulkError = result.error;

        console.log("🏭 FG Bulk Stock Result:", {
          data: bulkData ? `${bulkData.length} records` : "null",
          error: bulkError ? bulkError.message : "none",
        });
      } catch (e) {
        console.error("💥 fg_bulk_stock Exception:", e);
        debugInfo.push(`FG Bulk Stock Exception: ${e.message}`);

        // Try alternative table name or structure
        console.log("🔄 Trying alternative bulk_stock table...");
        try {
          const altQuery = supabase
            .from("bulk_stock")
            .select("product_id,batch_number,quantity,uom")
            .eq("product_id", productId);

          console.log("🔗 Alternative Bulk Stock Query:", {
            table: "bulk_stock",
            columns: "product_id,batch_number,quantity,uom",
            filter: `product_id=${productId}`,
          });

          const result = await altQuery;
          bulkData = result.data?.map((row) => ({
            product_id: row.product_id,
            item: "Unknown Item",
            bn: row.batch_number,
            qty_on_hand: row.quantity,
            on_hand_qty_uom: row.uom,
          }));
          bulkError = result.error;

          console.log("🔄 Alternative Bulk Stock Result:", {
            data: bulkData ? `${bulkData.length} records` : "null",
            error: bulkError ? bulkError.message : "none",
          });
        } catch (e2) {
          console.error("💥 Alternative bulk_stock Exception:", e2);
          debugInfo.push(`Alternative Bulk Stock Exception: ${e2.message}`);
          bulkError = e2;
        }
      }

      if (bulkError) {
        console.error("❌ Bulk Stock Error:", bulkError);
        debugInfo.push(
          `Bulk Stock Error: ${
            bulkError.message || bulkError.code || "Unknown error"
          }`
        );
      } else if (bulkData && bulkData.length > 0) {
        console.log(`✅ Found ${bulkData.length} bulk stock records`);

        // Filter out rows with zero or null SOH
        const filteredBulkData = bulkData.filter(
          (row) => row.qty_on_hand && row.qty_on_hand > 0
        );

        if (filteredBulkData.length > 0) {
          stockSections.push(`
            <h4>FG Bulk Stock</h4>
            <div class="table-container">
              <div class="flex-table bulk-stock">
                <div class="flex-table-header">
                  <div class="flex-table-cell">Product ID</div>
                  <div class="flex-table-cell">Item</div>
                  <div class="flex-table-cell">Batch Number</div>
                  <div class="flex-table-cell">SOH</div>
                  <div class="flex-table-cell">UOM</div>
                </div>
                ${filteredBulkData
                  .map(
                    (row) => `
                  <div class="flex-table-row">
                    <div class="flex-table-cell">${row.product_id || ""}</div>
                    <div class="flex-table-cell">${row.item || ""}</div>
                    <div class="flex-table-cell">${row.bn || ""}</div>
                    <div class="flex-table-cell">${fmtNum(
                      row.qty_on_hand
                    )}</div>
                    <div class="flex-table-cell">${
                      row.on_hand_qty_uom || ""
                    }</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `);
        } else {
          console.log("ℹ️ All bulk stock records have zero SOH");
          debugInfo.push("Bulk Stock: All records have zero stock on hand");
        }
      } else {
        console.log("ℹ️ No bulk stock data found");
        debugInfo.push("Bulk Stock: No data found for this product");
      }
    } catch (bulkError) {
      console.error("💥 Bulk Stock Exception:", bulkError);
      debugInfo.push(`Bulk Stock Exception: ${bulkError.message}`);
    }

    // Display results
    if (stockSections.length > 0) {
      content.innerHTML = stockSections.join(
        '<div style="margin-top: 20px;"></div>'
      );
      console.log(
        `✅ Successfully displayed ${stockSections.length} stock sections`
      );
    } else {
      console.log("❌ No stock data available, showing clean message");
      content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6b7280;">
          <div style="margin-bottom: 16px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 7h-3a2 2 0 0 1-2-2V2"/>
              <path d="M9 2v3a2 2 0 0 0 2 2h3"/>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/>
              <circle cx="10" cy="12" r="2"/>
              <path d="m7 17 6-6"/>
            </svg>
          </div>
          <h4 style="margin: 0 0 8px 0; color: #374151;">No Stock on Hand Available</h4>
          <p style="margin: 0; color: #9ca3af;">There are currently no stock records available for this product.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("💥 Main Drill Error:", error);
    content.innerHTML = `
      <div style="color: #dc2626; text-align: center; padding: 20px;">
        <h4>Error Loading Stock Details</h4>
        <p>Product ID: ${productId}${productName ? ` (${productName})` : ""}</p>
        <p>Month: ${month}</p>
        ${skuIds.length > 0 ? `<p>SKU IDs: [${skuIds.join(", ")}]</p>` : ""}
        
        <div style="text-align: left; margin-top: 15px; padding: 15px; background: #fef2f2; border-radius: 6px; font-family: monospace; font-size: 12px;">
          <strong>Error Details:</strong><br>
          ${error.message || error.toString()}
        </div>
        
        <p class="small" style="margin-top: 15px;">Check browser console for detailed technical information</p>
      </div>
    `;
  }
}

// ============= WIP Deduction Functions =============
async function loadWipData(page = 0) {
  if (tabState.wip.loading) return;

  tabState.wip.loading = true;
  tabState.wip.page = page;

  const statusEl = document.getElementById("wip-page-info");
  const bodyEl = document.getElementById("wip-body");

  statusEl.textContent = "Loading...";
  showSkeletonLoading("wip-body", 9, 8); // Show skeleton for WIP table (9 columns)

  try {
    // Use enhanced filters instead of old date inputs
    const start = filterState.wip.fromMonth
      ? fmtDate(filterState.wip.fromMonth)
      : fmtDate(fenceStart());

    const toShown = filterState.wip.toMonth
      ? filterState.wip.toMonth
      : addMonths(fenceStart(), 12);
    const toExclusive = addMonths(monthFloor(toShown), 1);
    const end = fmtDate(toExclusive);

    // Query WIP data with count
    let wipQuery = supabase
      .from("v_product_bulk_net_to_make_after_wip")
      .select(
        "product_id,month_start,net_bulk_before_wip,wip_deducted_this_month,net_bulk_after_wip,wip_pool_after",
        { count: "exact" }
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // Apply enhanced filters
    if (filterState.wip.productId) {
      wipQuery = wipQuery.eq("product_id", Number(filterState.wip.productId));
    }

    // Apply boolean filters
    if (filterState.wip.netBeforeWip === "present") {
      wipQuery = wipQuery
        .not("net_bulk_before_wip", "is", null)
        .gt("net_bulk_before_wip", 0);
    } else if (filterState.wip.netBeforeWip === "absent") {
      wipQuery = wipQuery.or(
        "net_bulk_before_wip.is.null,net_bulk_before_wip.eq.0"
      );
    }

    if (filterState.wip.wipDeducted === "present") {
      wipQuery = wipQuery
        .not("wip_deducted_this_month", "is", null)
        .gt("wip_deducted_this_month", 0);
    } else if (filterState.wip.wipDeducted === "absent") {
      wipQuery = wipQuery.or(
        "wip_deducted_this_month.is.null,wip_deducted_this_month.eq.0"
      );
    }

    if (filterState.wip.wipPool === "present") {
      wipQuery = wipQuery
        .not("wip_pool_after", "is", null)
        .gt("wip_pool_after", 0);
    } else if (filterState.wip.wipPool === "absent") {
      wipQuery = wipQuery.or("wip_pool_after.is.null,wip_pool_after.eq.0");
    }

    const {
      data: wipData,
      error: wipError,
      count: totalCount,
    } = await wipQuery;
    if (wipError) {
      console.error(wipError);
      hideSkeletonLoading("wip-body"); // Clear skeleton on error
      statusEl.textContent = "Error loading WIP data.";
      showToast("Error loading WIP data", "error");
      return;
    }

    // Get unique product IDs from WIP data
    const productIds = [...new Set(wipData?.map((r) => r.product_id) || [])];

    // Use cached product names and UOMs
    const productNamesMap = await getProductNames(productIds);
    const productUOMsMap = await getProductUOMs(productIds);

    // Apply client-side product name filtering if specified
    let filteredWipData = wipData || [];
    if (filterState.wip.productName) {
      const searchTerm = filterState.wip.productName.toLowerCase();
      filteredWipData = filteredWipData.filter((r) => {
        const productName = productNamesMap[r.product_id] || "";
        return productName.toLowerCase().includes(searchTerm);
      });
    }

    // Calculate pagination info
    const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);
    const currentPage = page + 1;
    const startRecord = page * PAGE_SIZE + 1;
    const endRecord = Math.min((page + 1) * PAGE_SIZE, totalCount || 0);

    // Update page status
    statusEl.textContent =
      totalCount > 0
        ? `Page ${currentPage} of ${totalPages} (${startRecord}-${endRecord} of ${totalCount} records)`
        : `Page ${currentPage}`;

    // Update pagination buttons
    const prevBtn = document.getElementById("wip-prev");
    const nextBtn = document.getElementById("wip-next");

    prevBtn.disabled = page === 0;
    nextBtn.disabled = page >= totalPages - 1 || totalCount === 0;

    // Clear skeleton loading before rendering actual data
    hideSkeletonLoading("wip-body");

    (filteredWipData || []).forEach((r) => {
      const productName = productNamesMap[r.product_id];

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.product_id}</td>
        <td>${productName || "Unknown Product"}</td>
        <td>${productUOMsMap[r.product_id] || "—"}</td>
        <td>${formatMonth(r.month_start)}</td>
        <td>${Number(r.net_bulk_before_wip ?? 0).toFixed(3)}</td>
        <td>${Number(r.wip_deducted_this_month ?? 0).toFixed(3)}</td>
        <td>${Number(r.net_bulk_after_wip ?? 0).toFixed(3)}</td>
        <td>${Number(r.wip_pool_after ?? 0).toFixed(3)}</td>
        <td class="actions">
          <a href="#" data-pid="${r.product_id}" data-month="${
        r.month_start
      }" class="drill-wip">View</a>
        </td>
      `;
      bodyEl.appendChild(tr);
    });

    // Wire drill links
    bodyEl.querySelectorAll("a.drill-wip").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const pid = Number(a.dataset.pid);
        const month = a.dataset.month;
        openWipDrill(pid, month);
      });
    });

    tabState.wip.loaded = true;
  } catch (error) {
    console.error("WIP load error:", error);
    hideSkeletonLoading("wip-body"); // Clear skeleton on error
    showToast("Failed to load WIP data", "error");
  } finally {
    tabState.wip.loading = false;
  }
}

async function openWipDrill(productId, month) {
  const modal = document.getElementById("drill-modal");
  const title = document.getElementById("drill-title");
  const subtitle = document.getElementById("drill-subtitle");
  const itemChip = document.getElementById("drill-item");
  const monthChip = document.getElementById("drill-month");
  const content = document.getElementById("drill-content");

  title.textContent = "WIP Details";
  subtitle.textContent = "Currently running WIP batches for this product";

  // Get product name and update chips
  const productName = await getProductName(productId);
  itemChip.textContent = `Product: ${productName}`;
  monthChip.textContent = `Month: ${formatMonth(month)}`;

  content.innerHTML =
    '<div style="text-align: center; padding: 20px;">Loading...</div>';
  modal.showModal();

  try {
    // Query WIP batch data from v_wip_batches view for the specific product
    const { data: wipData, error: wipError } = await supabase
      .from("v_wip_batches")
      .select(
        "product_id,item,batch_number,batch_size,batch_uom,activity,started_on,due_date,log_date"
      )
      .eq("product_id", productId)
      .order("due_date", { ascending: true });

    if (wipError) {
      throw wipError;
    }

    // Use flex-table system like Production Netting
    content.innerHTML = `
      ${
        (wipData || []).length === 0
          ? '<div style="text-align: center; padding: 20px; color: #666;">No active WIP batches found for this product</div>'
          : `<h4>Current WIP Batches</h4>
        <div class="table-container">
          <div class="flex-table wip-batches">
            <div class="flex-table-header">
              <div class="flex-table-cell">Product ID</div>
              <div class="flex-table-cell">Item</div>
              <div class="flex-table-cell">Batch Number</div>
              <div class="flex-table-cell">Batch Size</div>
              <div class="flex-table-cell">UOM</div>
              <div class="flex-table-cell">Activity</div>
              <div class="flex-table-cell">Due Date</div>
            </div>
            ${(wipData || [])
              .map((batch) => {
                const isOverdue =
                  batch.due_date && new Date(batch.due_date) < new Date();
                return `
              <div class="flex-table-row">
                <div class="flex-table-cell">${batch.product_id}</div>
                <div class="flex-table-cell">${batch.item || "N/A"}</div>
                <div class="flex-table-cell">${
                  batch.batch_number || "N/A"
                }</div>
                <div class="flex-table-cell">${Number(
                  batch.batch_size || 0
                ).toLocaleString()}</div>
                <div class="flex-table-cell">${batch.batch_uom || "N/A"}</div>
                <div class="flex-table-cell">${batch.activity || "N/A"}</div>
                <div class="flex-table-cell${isOverdue ? " overdue" : ""}">
                  ${
                    batch.due_date
                      ? new Date(batch.due_date).toLocaleDateString("en-GB")
                      : "N/A"
                  }
                </div>
              </div>
            `;
              })
              .join("")}
          </div>
        </div>`
      }
    `;
  } catch (error) {
    console.error("WIP drill error:", error);
    content.innerHTML = `
      <div style="color: #dc2626; text-align: center; padding: 20px;">
        <h4>Error Loading WIP Details</h4>
        <p>Unable to load WIP batch information for this product.</p>
        <div style="text-align: left; margin-top: 15px; padding: 15px; background: #fef2f2; border-radius: 6px; font-family: monospace; font-size: 12px;">
          <strong>Error Details:</strong><br>
          ${error.message || error.toString()}
        </div>
      </div>
    `;
  }
}

// ============= Output Normalizer Functions =============
// Output Normalization: Apply batch sizing rules to convert net requirements into manufacturable, rule-compliant production quantities.
// Source: v_product_bulk_consolidated
async function loadNormalizerData(page = 0) {
  if (tabState.normalizer.loading) return;

  tabState.normalizer.loading = true;
  tabState.normalizer.page = page;

  const statusEl = document.getElementById("normalizer-page-info");
  const bodyEl = document.getElementById("normalizer-body");

  statusEl.textContent = "Loading...";
  showSkeletonLoading("normalizer-body", 13, 8); // Show skeleton for normalizer table (13 columns)

  try {
    // Use enhanced filters instead of old date inputs
    const start = filterState.normalizer.fromMonth
      ? fmtDate(filterState.normalizer.fromMonth)
      : fmtDate(fenceStart());

    const toShown = filterState.normalizer.toMonth
      ? filterState.normalizer.toMonth
      : addMonths(fenceStart(), 12);
    const toExclusive = addMonths(monthFloor(toShown), 1);
    const end = fmtDate(toExclusive);

    let q = supabase
      .from("v_product_bulk_consolidated")
      .select(
        "product_id,month_start,need_qty,preferred_batch_size,min_batch_size,max_batch_size,need_after_carry,adjusted_bulk_to_make,carry_to_next,needs_batch_ref",
        { count: "exact" }
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // Apply enhanced filters
    if (filterState.normalizer.productId) {
      q = q.eq("product_id", Number(filterState.normalizer.productId));
    }

    // Handle product name filter by looking up product IDs first
    if (filterState.normalizer.productName) {
      const { data: nameFilterProducts, error: nameError } = await supabase
        .from("products")
        .select("id")
        .ilike("item", `%${filterState.normalizer.productName}%`);

      if (nameError) {
        console.error("Error filtering by product name:", nameError);
      } else if (nameFilterProducts && nameFilterProducts.length > 0) {
        const productIds = nameFilterProducts.map((p) => p.id);
        q = q.in("product_id", productIds);
      } else {
        // No products match the name filter, return empty result
        q = q.eq("product_id", -1); // This will return no results
      }
    }

    // Apply boolean filters
    if (filterState.normalizer.needQty === "present") {
      q = q.not("need_qty", "is", null).gt("need_qty", 0);
    } else if (filterState.normalizer.needQty === "absent") {
      q = q.or("need_qty.is.null,need_qty.eq.0");
    }

    if (filterState.normalizer.needAfterCarry === "present") {
      q = q.not("need_after_carry", "is", null).gt("need_after_carry", 0);
    } else if (filterState.normalizer.needAfterCarry === "absent") {
      q = q.or("need_after_carry.is.null,need_after_carry.eq.0");
    }

    if (filterState.normalizer.carryToNext === "present") {
      q = q.not("carry_to_next", "is", null).gt("carry_to_next", 0);
    } else if (filterState.normalizer.carryToNext === "absent") {
      q = q.or("carry_to_next.is.null,carry_to_next.eq.0");
    }

    if (filterState.normalizer.needsBatchRef === "present") {
      q = q.eq("needs_batch_ref", true);
    } else if (filterState.normalizer.needsBatchRef === "absent") {
      q = q.eq("needs_batch_ref", false);
    }

    const { data, error, count: totalCount } = await q;
    if (error) {
      console.error(error);
      hideSkeletonLoading("normalizer-body"); // Clear skeleton on error
      statusEl.textContent = "Error loading.";
      showToast("Error loading normalizer data", "error");
      return;
    }

    // Get unique product IDs from normalizer data
    const productIds = [...new Set((data || []).map((r) => r.product_id))];

    // Use the product cache system (same as other tabs)
    const productNamesMap = await getProductNames(productIds);
    const productUOMsMap = await getProductUOMs(productIds);

    // Calculate pagination info
    const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);
    const currentPage = page + 1;
    const startRecord = page * PAGE_SIZE + 1;
    const endRecord = Math.min((page + 1) * PAGE_SIZE, totalCount || 0);

    // Update page status
    statusEl.textContent =
      totalCount > 0
        ? `Page ${currentPage} of ${totalPages} (${startRecord}-${endRecord} of ${totalCount} records)`
        : `Page ${currentPage}`;

    // Update pagination buttons
    const prevBtn = document.getElementById("normalizer-prev");
    const nextBtn = document.getElementById("normalizer-next");

    prevBtn.disabled = page === 0;
    nextBtn.disabled = page >= totalPages - 1 || totalCount === 0;

    // Clear skeleton loading before rendering actual data
    hideSkeletonLoading("normalizer-body");

    (data || []).forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.product_id}</td>
        <td>${productNamesMap[r.product_id] || "Unknown Product"}</td>
        <td>${productUOMsMap[r.product_id] || "—"}</td>
        <td>${formatMonth(r.month_start)}</td>
        <td>${fmtNum(r.need_qty)}</td>
        <td>${fmtBatchSize(r.preferred_batch_size)}</td>
        <td>${fmtBatchSize(r.min_batch_size)}</td>
        <td>${fmtBatchSize(r.max_batch_size)}</td>
        <td>${fmtNum(r.need_after_carry)}</td>
        <td>${fmtNum(r.adjusted_bulk_to_make)}</td>
        <td>${fmtNum(r.carry_to_next)}</td>
        <td>${
          r.needs_batch_ref
            ? '<span class="flag warn">true</span>'
            : '<span class="flag ok">false</span>'
        }</td>
        <td class="actions">
          <a href="#" class="drill-normalizer" data-pid="${
            r.product_id
          }" data-month="${r.month_start}">details</a>
        </td>
      `;
      bodyEl.appendChild(tr);
    });

    // Wire drill links
    bodyEl.querySelectorAll("a.drill-normalizer").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const pid = Number(a.dataset.pid);
        const month = a.dataset.month;
        openNormalizerDrill(pid, month);
      });
    });

    tabState.normalizer.loaded = true;
  } catch (error) {
    console.error("Normalizer load error:", error);
    hideSkeletonLoading("normalizer-body"); // Clear skeleton on error
    showToast("Failed to load normalizer data", "error");
  } finally {
    tabState.normalizer.loading = false;
  }
}

async function openNormalizerDrill(productId, month) {
  const modal = document.getElementById("drill-modal");
  const title = document.getElementById("drill-title");
  const subtitle = document.getElementById("drill-subtitle");
  const itemChip = document.getElementById("drill-item");
  const monthChip = document.getElementById("drill-month");
  const content = document.getElementById("drill-content");

  title.textContent = "Normalization Details";
  subtitle.textContent = "Batch sizing rules and calculations";

  // Get product name and update chips
  const productName = await getProductName(productId);
  itemChip.textContent = `Product: ${productName}`;
  monthChip.textContent = `Month: ${formatMonth(month)}`;

  content.innerHTML =
    '<div style="text-align: center; padding: 20px;">Loading...</div>';
  modal.showModal();

  try {
    // Get detailed normalization data for this specific product/month
    const { data: detailData } = await supabase
      .from("v_product_bulk_consolidated")
      .select("*")
      .eq("product_id", productId)
      .eq("month_start", month)
      .single();

    if (detailData) {
      content.innerHTML = `
        <h4>Normalization Breakdown</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div>
            <strong>Need Quantity:</strong><br>
            <span style="font-size: 1.2em; color: var(--primary);">${fmtNum(
              detailData.need_qty
            )}</span>
          </div>
          <div>
            <strong>Need After Carry:</strong><br>
            <span style="font-size: 1.2em; color: var(--primary);">${fmtNum(
              detailData.need_after_carry
            )}</span>
          </div>
          <div>
            <strong>Adjusted Bulk to Make:</strong><br>
            <span style="font-size: 1.2em; color: #10b981;">${fmtNum(
              detailData.adjusted_bulk_to_make
            )}</span>
          </div>
          <div>
            <strong>Carry to Next:</strong><br>
            <span style="font-size: 1.2em; color: #f59e0b;">${fmtNum(
              detailData.carry_to_next
            )}</span>
          </div>
          <div>
            <strong>Needs Batch Ref:</strong><br>
            <span class="flag ${detailData.needs_batch_ref ? "warn" : "ok"}">${
        detailData.needs_batch_ref
      }</span>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <div>
            <strong>Pref. Batch Size:</strong><br>
            <span style="font-size: 1.1em; color: #6b7280;">${fmtBatchSize(
              detailData.preferred_batch_size
            )}</span>
          </div>
          <div>
            <strong>Min. Batch Size:</strong><br>
            <span style="font-size: 1.1em; color: #6b7280;">${fmtBatchSize(
              detailData.min_batch_size
            )}</span>
          </div>
          <div>
            <strong>Max. Batch Size:</strong><br>
            <span style="font-size: 1.1em; color: #6b7280;">${fmtBatchSize(
              detailData.max_batch_size
            )}</span>
          </div>
        </div>
        
        ${
          detailData.source_rule
            ? `<div style="margin-bottom: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <div>
              <strong>Source Rule:</strong><br>
              <span style="font-size: 1.1em; color: #6b7280;">${
                detailData.source_rule || "N/A"
              }</span>
            </div>
          </div>`
            : ""
        }
        
        <div style="padding: 12px; background: #f9fafb; border-radius: 6px; font-size: 13px; color: #6b7280;">
          <strong>Note:</strong> This shows the final normalized quantities ready for batch planning.
          The adjusted bulk quantity incorporates batch sizing rules and carryover logic.
        </div>
      `;
    } else {
      content.innerHTML =
        '<div style="text-align: center; padding: 20px;">No detailed data found</div>';
    }
  } catch (error) {
    console.error("Normalizer drill error:", error);
    content.innerHTML =
      '<div style="color: #dc2626; text-align: center; padding: 20px;">Error loading normalization details</div>';
  }
}

// ============= Export Functions =============
async function exportNettingData() {
  try {
    showToast("Preparing CSV export...", "info");

    // Use enhanced filters to get the same data as displayed (but all pages)
    const start = filterState.netting.fromMonth
      ? fmtDate(filterState.netting.fromMonth)
      : fmtDate(fenceStart());

    const toShown = filterState.netting.toMonth
      ? filterState.netting.toMonth
      : addMonths(fenceStart(), 12);
    const toExclusive = addMonths(monthFloor(toShown), 1);
    const end = fmtDate(toExclusive);

    // Query all matching data (without pagination)
    let nettingQuery = supabase
      .from("v_product_bulk_net_to_make")
      .select(
        "product_id,month_start,bulk_required,soh_applied,net_bulk_to_make,remaining_soh_after,uom_base"
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true });

    // Apply same filters as the UI
    if (filterState.netting.productId) {
      nettingQuery = nettingQuery.eq(
        "product_id",
        Number(filterState.netting.productId)
      );
    }

    // Apply boolean filters
    if (filterState.netting.bulkRequired === "present") {
      nettingQuery = nettingQuery
        .not("bulk_required", "is", null)
        .gt("bulk_required", 0);
    } else if (filterState.netting.bulkRequired === "absent") {
      nettingQuery = nettingQuery.or(
        "bulk_required.is.null,bulk_required.eq.0"
      );
    }

    if (filterState.netting.sohApplied === "present") {
      nettingQuery = nettingQuery
        .not("soh_applied", "is", null)
        .gt("soh_applied", 0);
    } else if (filterState.netting.sohApplied === "absent") {
      nettingQuery = nettingQuery.or("soh_applied.is.null,soh_applied.eq.0");
    }

    if (filterState.netting.sohRemaining === "present") {
      nettingQuery = nettingQuery
        .not("remaining_soh_after", "is", null)
        .gt("remaining_soh_after", 0);
    } else if (filterState.netting.sohRemaining === "absent") {
      nettingQuery = nettingQuery.or(
        "remaining_soh_after.is.null,remaining_soh_after.eq.0"
      );
    }

    const { data: nettingData, error: nettingError } = await nettingQuery;

    if (nettingError) {
      console.error("Export error:", nettingError);
      showToast("Error fetching data for export", "error");
      return;
    }

    if (!nettingData || nettingData.length === 0) {
      showToast("No data to export with current filters", "info");
      return;
    }

    // Get product details for the export data
    const productIds = [...new Set(nettingData.map((r) => r.product_id))];
    let productDetailsMap = {};

    if (productIds.length > 0) {
      const { data: productDetails } = await supabase
        .from("products")
        .select("id,item")
        .in("id", productIds);

      if (productDetails) {
        productDetails.forEach((p) => {
          productDetailsMap[p.id] = {
            product_id: p.id,
            product_name: p.item,
          };
        });
      }
    }

    // Apply client-side product name filtering if specified
    let filteredData = nettingData;
    if (filterState.netting.productName) {
      const searchTerm = filterState.netting.productName.toLowerCase();
      filteredData = filteredData.filter((r) => {
        const productDetails = productDetailsMap[r.product_id];
        const productName = productDetails?.product_name || "";
        return productName.toLowerCase().includes(searchTerm);
      });
    }

    if (filteredData.length === 0) {
      showToast("No data matches the current filters", "info");
      return;
    }

    // Create CSV content
    const headers = [
      "Product ID",
      "Product Name",
      "UOM",
      "Month",
      "Bulk Required",
      "SOH Applied",
      "Net Bulk to Make",
      "Remaining SOH After",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredData.map((row) => {
        const productDetails = productDetailsMap[row.product_id];
        return [
          row.product_id,
          `"${(productDetails?.product_name || "Unknown Product").replace(
            /"/g,
            '""'
          )}"`,
          `"${(row.uom_base || "").replace(/"/g, '""')}"`,
          `"${formatMonth(row.month_start)}"`,
          Number(row.bulk_required ?? 0).toFixed(3),
          Number(row.soh_applied ?? 0).toFixed(3),
          Number(row.net_bulk_to_make ?? 0).toFixed(3),
          Number(row.remaining_soh_after ?? 0).toFixed(3),
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);

      // Generate professional filename with date range, filters, and timestamp
      const fromMonthFormatted = formatMonth(start).replace(" ", "-");
      const toMonthFormatted = formatMonth(
        fmtDate(addMonths(monthFloor(toShown), -1))
      ).replace(" ", "-");

      // Create timestamp in IST for file uniqueness
      const now = new Date();
      const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // Convert to IST (UTC+5:30)
      const timestamp = istTime
        .toISOString()
        .slice(0, 19)
        .replace(/[-:]/g, "")
        .replace("T", "_");

      let filename = `ProductionNetting_${fromMonthFormatted}_to_${toMonthFormatted}_${timestamp}`;

      if (filterState.netting.productId) {
        filename += `_ProductID${filterState.netting.productId}`;
      }
      if (filterState.netting.productName) {
        const cleanProductName = filterState.netting.productName
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 20); // Limit length
        filename += `_${cleanProductName}`;
      }

      link.setAttribute("download", `${filename}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(
        `CSV exported successfully (${filteredData.length} records)`,
        "success"
      );
    } else {
      showToast("CSV download not supported in this browser", "error");
    }
  } catch (error) {
    console.error("Export error:", error);
    showToast("Error during CSV export", "error");
  }
}

async function exportWipData() {
  try {
    showToast("Preparing CSV export...", "info");

    // Use enhanced filters to get the same data as displayed (but all pages)
    const start = filterState.wip.fromMonth
      ? fmtDate(filterState.wip.fromMonth)
      : fmtDate(fenceStart());

    const toShown = filterState.wip.toMonth
      ? filterState.wip.toMonth
      : addMonths(fenceStart(), 12);
    const toExclusive = addMonths(monthFloor(toShown), 1);
    const end = fmtDate(toExclusive);

    // Query all matching data (without pagination)
    let wipQuery = supabase
      .from("v_product_bulk_net_to_make_after_wip")
      .select(
        "product_id,month_start,net_bulk_before_wip,wip_deducted_this_month,net_bulk_after_wip,wip_pool_after"
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true });

    // Apply same filters as the UI
    if (filterState.wip.productId) {
      wipQuery = wipQuery.eq("product_id", Number(filterState.wip.productId));
    }

    // Apply boolean filters
    if (filterState.wip.netBeforeWip === "present") {
      wipQuery = wipQuery
        .not("net_bulk_before_wip", "is", null)
        .gt("net_bulk_before_wip", 0);
    } else if (filterState.wip.netBeforeWip === "absent") {
      wipQuery = wipQuery.or(
        "net_bulk_before_wip.is.null,net_bulk_before_wip.eq.0"
      );
    }

    if (filterState.wip.wipDeducted === "present") {
      wipQuery = wipQuery
        .not("wip_deducted_this_month", "is", null)
        .gt("wip_deducted_this_month", 0);
    } else if (filterState.wip.wipDeducted === "absent") {
      wipQuery = wipQuery.or(
        "wip_deducted_this_month.is.null,wip_deducted_this_month.eq.0"
      );
    }

    if (filterState.wip.wipPool === "present") {
      wipQuery = wipQuery
        .not("wip_pool_after", "is", null)
        .gt("wip_pool_after", 0);
    } else if (filterState.wip.wipPool === "absent") {
      wipQuery = wipQuery.or("wip_pool_after.is.null,wip_pool_after.eq.0");
    }

    const { data: wipData, error: wipError } = await wipQuery;

    if (wipError) {
      console.error("Export error:", wipError);
      showToast("Error fetching data for export", "error");
      return;
    }

    if (!wipData || wipData.length === 0) {
      showToast("No data to export with current filters", "info");
      return;
    }

    // Get product details for the export data
    const productIds = [...new Set(wipData.map((r) => r.product_id))];
    const productNamesMap = await getProductNames(productIds);
    const productUOMsMap = await getProductUOMs(productIds);

    // Apply client-side product name filtering if specified
    let filteredData = wipData;
    if (filterState.wip.productName) {
      const searchTerm = filterState.wip.productName.toLowerCase();
      filteredData = filteredData.filter((r) => {
        const productName = productNamesMap[r.product_id] || "";
        return productName.toLowerCase().includes(searchTerm);
      });
    }

    if (filteredData.length === 0) {
      showToast("No data matches the current filters", "info");
      return;
    }

    // Create CSV content
    const headers = [
      "Product ID",
      "Product Name",
      "UOM",
      "Month",
      "Net Before WIP",
      "WIP Deducted",
      "Net After WIP",
      "WIP Pool After",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredData.map((row) => {
        return [
          row.product_id,
          `"${(productNamesMap[row.product_id] || "Unknown Product").replace(
            /"/g,
            '""'
          )}"`,
          productUOMsMap[row.product_id] || "",
          `"${formatMonth(row.month_start)}"`,
          Number(row.net_bulk_before_wip ?? 0).toFixed(3),
          Number(row.wip_deducted_this_month ?? 0).toFixed(3),
          Number(row.net_bulk_after_wip ?? 0).toFixed(3),
          Number(row.wip_pool_after ?? 0).toFixed(3),
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);

      // Generate professional filename with date range, filters, and timestamp
      const fromMonthFormatted = formatMonth(start).replace(" ", "-");
      const toMonthFormatted = formatMonth(
        fmtDate(addMonths(monthFloor(toShown), -1))
      ).replace(" ", "-");

      // Create timestamp in IST for file uniqueness
      const now = new Date();
      const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // Convert to IST (UTC+5:30)
      const timestamp = istTime
        .toISOString()
        .slice(0, 19)
        .replace(/[-:]/g, "")
        .replace("T", "_");

      let filename = `WIPDeduction_${fromMonthFormatted}_to_${toMonthFormatted}_${timestamp}`;

      if (filterState.wip.productId) {
        filename += `_ProductID${filterState.wip.productId}`;
      }
      if (filterState.wip.productName) {
        const cleanProductName = filterState.wip.productName
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 20); // Limit length
        filename += `_${cleanProductName}`;
      }

      link.setAttribute("download", `${filename}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(
        `CSV exported successfully (${filteredData.length} records)`,
        "success"
      );
    } else {
      showToast("CSV download not supported in this browser", "error");
    }
  } catch (error) {
    console.error("Export error:", error);
    showToast("Error during CSV export", "error");
  }
}

async function exportNormalizerData() {
  try {
    showToast("Preparing CSV export...", "info");

    // Use enhanced filters instead of old inputs
    const start = filterState.normalizer.fromMonth
      ? fmtDate(filterState.normalizer.fromMonth)
      : fmtDate(fenceStart());

    const toShown = filterState.normalizer.toMonth
      ? filterState.normalizer.toMonth
      : addMonths(fenceStart(), 12);
    const toExclusive = addMonths(monthFloor(toShown), 1);
    const end = fmtDate(toExclusive);

    // Query all matching data (without pagination)
    let normalizerQuery = supabase
      .from("v_product_bulk_consolidated")
      .select(
        "product_id,month_start,need_qty,preferred_batch_size,min_batch_size,max_batch_size,need_after_carry,adjusted_bulk_to_make,carry_to_next,needs_batch_ref"
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true });

    // Apply enhanced filters
    if (filterState.normalizer.productId) {
      normalizerQuery = normalizerQuery.eq(
        "product_id",
        Number(filterState.normalizer.productId)
      );
    }

    // Handle product name filter by looking up product IDs first
    if (filterState.normalizer.productName) {
      const { data: nameFilterProducts, error: nameError } = await supabase
        .from("products")
        .select("id")
        .ilike("item", `%${filterState.normalizer.productName}%`);

      if (nameError) {
        console.error("Error filtering by product name:", nameError);
      } else if (nameFilterProducts && nameFilterProducts.length > 0) {
        const productIds = nameFilterProducts.map((p) => p.id);
        normalizerQuery = normalizerQuery.in("product_id", productIds);
      } else {
        // No products match the name filter, return empty result
        normalizerQuery = normalizerQuery.eq("product_id", -1);
      }
    }

    // Apply boolean filters
    if (filterState.normalizer.needQty === "present") {
      normalizerQuery = normalizerQuery
        .not("need_qty", "is", null)
        .gt("need_qty", 0);
    } else if (filterState.normalizer.needQty === "absent") {
      normalizerQuery = normalizerQuery.or("need_qty.is.null,need_qty.eq.0");
    }

    if (filterState.normalizer.needAfterCarry === "present") {
      normalizerQuery = normalizerQuery
        .not("need_after_carry", "is", null)
        .gt("need_after_carry", 0);
    } else if (filterState.normalizer.needAfterCarry === "absent") {
      normalizerQuery = normalizerQuery.or(
        "need_after_carry.is.null,need_after_carry.eq.0"
      );
    }

    if (filterState.normalizer.carryToNext === "present") {
      normalizerQuery = normalizerQuery
        .not("carry_to_next", "is", null)
        .gt("carry_to_next", 0);
    } else if (filterState.normalizer.carryToNext === "absent") {
      normalizerQuery = normalizerQuery.or(
        "carry_to_next.is.null,carry_to_next.eq.0"
      );
    }

    if (filterState.normalizer.needsBatchRef === "present") {
      normalizerQuery = normalizerQuery.eq("needs_batch_ref", true);
    } else if (filterState.normalizer.needsBatchRef === "absent") {
      normalizerQuery = normalizerQuery.eq("needs_batch_ref", false);
    }

    const { data: normalizerData, error: normalizerError } =
      await normalizerQuery;

    if (normalizerError) {
      console.error("Export error:", normalizerError);
      showToast("Error fetching data for export", "error");
      return;
    }

    if (!normalizerData || normalizerData.length === 0) {
      showToast("No data to export with current filters", "info");
      return;
    }

    // Get product details for the export data
    const productIds = [...new Set(normalizerData.map((r) => r.product_id))];
    const productNamesMap = await getProductNames(productIds);
    const productUOMsMap = await getProductUOMs(productIds);

    // Create CSV content
    const headers = [
      "Product ID",
      "Product Name",
      "UOM",
      "Month Start",
      "Need Qty",
      "Preferred Batch Size",
      "Min Batch Size",
      "Max Batch Size",
      "Need After Carry",
      "Adjusted Bulk to Make",
      "Carry to Next",
      "Needs Batch Ref",
    ];

    const csvRows = [
      headers.join(","),
      ...normalizerData.map((row) => {
        const productName =
          productNamesMap[row.product_id] || "Unknown Product";
        return [
          row.product_id,
          `"${productName.replace(/"/g, '""')}"`, // Escape quotes in product name
          productUOMsMap[row.product_id] || "",
          formatMonth(row.month_start),
          fmtNum(row.need_qty),
          fmtBatchSize(row.preferred_batch_size),
          fmtBatchSize(row.min_batch_size),
          fmtBatchSize(row.max_batch_size),
          fmtNum(row.need_after_carry),
          fmtNum(row.adjusted_bulk_to_make),
          fmtNum(row.carry_to_next),
          row.needs_batch_ref ? "true" : "false",
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:.]/g, "-");
      const filename = `output-normalizer-export-${timestamp}.csv`;

      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(
        `Exported ${normalizerData.length} records to ${filename}`,
        "success"
      );
    } else {
      showToast("CSV download not supported in this browser", "error");
    }
  } catch (error) {
    console.error("Export error:", error);
    showToast("Error during CSV export", "error");
  }
}

// ============= Pagination Functions =============
function setupPagination() {
  // Net SKU Plan pagination
  document.getElementById("net-sku-plan-prev").addEventListener("click", () => {
    if (tabState.netSkuPlan.page > 0) {
      loadNetSkuPlanData(tabState.netSkuPlan.page - 1);
    }
  });

  document.getElementById("net-sku-plan-next").addEventListener("click", () => {
    loadNetSkuPlanData(tabState.netSkuPlan.page + 1);
  });

  // Bulk Requirements pagination
  document
    .getElementById("bulk-requirements-prev")
    .addEventListener("click", () => {
      if (tabState.bulkRequirements.page > 0) {
        loadBulkRequirementsData(tabState.bulkRequirements.page - 1);
      }
    });

  document
    .getElementById("bulk-requirements-next")
    .addEventListener("click", () => {
      loadBulkRequirementsData(tabState.bulkRequirements.page + 1);
    });

  // Netting pagination
  document.getElementById("netting-prev").addEventListener("click", () => {
    if (tabState.netting.page > 0) {
      loadNettingData(tabState.netting.page - 1);
    }
  });

  document.getElementById("netting-next").addEventListener("click", () => {
    loadNettingData(tabState.netting.page + 1);
  });

  // WIP pagination
  document.getElementById("wip-prev").addEventListener("click", () => {
    if (tabState.wip.page > 0) {
      loadWipData(tabState.wip.page - 1);
    }
  });

  document.getElementById("wip-next").addEventListener("click", () => {
    loadWipData(tabState.wip.page + 1);
  });

  // Normalizer pagination
  document.getElementById("normalizer-prev").addEventListener("click", () => {
    if (tabState.normalizer.page > 0) {
      loadNormalizerData(tabState.normalizer.page - 1);
    }
  });

  document.getElementById("normalizer-next").addEventListener("click", () => {
    loadNormalizerData(tabState.normalizer.page + 1);
  });
}

// ============= Modal Functions =============
function setupModal() {
  const modal = document.getElementById("drill-modal");
  const closeBtn = document.getElementById("drill-close");

  if (!modal) return; // nothing to wire if markup missing

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (modal.open) modal.close();
    });
  }

  // Close on backdrop click (only close when clicking outside the content)
  modal.addEventListener("click", (e) => {
    if (e.target === modal && modal.open) {
      modal.close();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.open) {
      modal.close();
    }
  });
}

// Generic open helper for the drill modal. Useful for other modules to reuse.
function openDrillModal({
  title = "Details",
  subtitle = "",
  item = null,
  month = null,
  html = "",
} = {}) {
  const modal = document.getElementById("drill-modal");
  if (!modal) return;
  const titleEl = document.getElementById("drill-title");
  const subtitleEl = document.getElementById("drill-subtitle");
  const itemEl = document.getElementById("drill-item");
  const monthEl = document.getElementById("drill-month");
  const content = document.getElementById("drill-content");

  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
  if (itemEl) itemEl.textContent = item ? `Item: ${item}` : "";
  if (monthEl) monthEl.textContent = month ? `Month: ${month}` : "";
  if (content) content.innerHTML = html;

  try {
    modal.showModal();
  } catch (err) {
    // Some environments may not support <dialog>. Fallback: reveal an element-based modal if present.
    console.warn("Failed to show dialog element:", err);
  }
}

function closeDrillModal() {
  const modal = document.getElementById("drill-modal");
  if (!modal) return;
  if (modal.open) modal.close();
}

// ============= Filter Functions (Reset to Page 0) =============
// ============= Net SKU Plan Functions =============
async function loadNetSkuPlanData(page = 0) {
  if (tabState.netSkuPlan.loading) return;

  // Increment load id to identify this invocation; used to drop stale async results
  const myLoadId = ++currentNetSkuLoadId;

  tabState.netSkuPlan.loading = true;
  tabState.netSkuPlan.page = page;

  const statusEl = document.getElementById("net-sku-plan-page-info");
  const bodyEl = document.getElementById("net-sku-plan-body");
  // If DOM isn't ready (element missing), retry shortly to avoid uncaught exceptions
  if (!statusEl || !bodyEl) {
    console.warn("Net SKU Plan DOM not ready, retrying load shortly");
    tabState.netSkuPlan.loading = false;
    setTimeout(() => loadNetSkuPlanData(page), 120);
    return;
  }

  statusEl.textContent = "Loading...";
  showSkeletonLoading("net-sku-plan-body", 13, 8); // Show skeleton instead of empty table

  try {
    const fromISO = document.getElementById("net-sku-plan-from-month").value;
    const toISO = document.getElementById("net-sku-plan-to-month").value;
    const skuId = document.getElementById("net-sku-plan-sku-id").value;

    // Debug: log incoming filter state for troubleshooting
    console.debug(
      "[debug] loadNetSkuPlanData start - bottledSohApplied:",
      filterState.netSkuPlan.bottledSohApplied,
      "fromMonth:",
      fromISO,
      "toMonth:",
      toISO,
      "skuId:",
      skuId
    );

    // Convert month inputs (YYYY-MM) to proper date strings
    const start = fromISO ? `${fromISO}-01` : fmtDate(fenceStart());
    const toShown = toISO
      ? new Date(`${toISO}-01T00:00:00`)
      : addMonths(fenceStart(), 12);
    const end = fmtDate(addMonths(monthFloor(toShown), 1));

    // Build base query (without bottled_soh_applied clause yet)
    let qBase = supabase
      .from("v_forecast_production_plan_net_sku")
      .select(
        "sku_id,month_start,opening_stock,demand_baseline,target_stock,projected_stock_before_prod,production_qty,bottled_soh_applied,net_production_qty,projected_stock_after_prod_net",
        {
          count: "exact",
        }
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("sku_id", { ascending: true })
      .order("month_start", { ascending: true });

    if (skuId) qBase = qBase.eq("sku_id", Number(skuId));

    // Apply product name filter if provided
    const productName = filterState.netSkuPlan.productName;
    if (productName) {
      // Search directly in SKU catalog by item name
      const { data: skuData, error: skuError } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id")
        .ilike("item", `%${productName}%`);

      if (skuError) throw skuError;

      if (skuData.length > 0) {
        const matchingSkuIds = skuData.map((row) => row.sku_id);
        qBase = qBase.in("sku_id", matchingSkuIds);
      } else {
        // No SKUs match the name filter
        hideSkeletonLoading("net-sku-plan-body");
        bodyEl.innerHTML =
          '<tr><td colspan="13" style="text-align: center; padding: 20px; color: #666;">No SKUs found matching the product name filter</td></tr>';
        statusEl.textContent = "No data";
        tabState.netSkuPlan.loading = false;
        return;
      }
    }

    // Apply boolean filters for net SKU plan (except bottled_soh_applied which may be applied client-side)
    if (filterState.netSkuPlan.openingStock === "present") {
      qBase = qBase.not("opening_stock", "is", null).gt("opening_stock", 0);
    } else if (filterState.netSkuPlan.openingStock === "absent") {
      qBase = qBase.or("opening_stock.is.null,opening_stock.eq.0");
    }

    if (filterState.netSkuPlan.demandBaseline === "present") {
      qBase = qBase.not("demand_baseline", "is", null).gt("demand_baseline", 0);
    } else if (filterState.netSkuPlan.demandBaseline === "absent") {
      qBase = qBase.or("demand_baseline.is.null,demand_baseline.eq.0");
    }
    // We'll handle bottled_soh_applied specially: if it's 'all' we use server-side pagination and (optionally) server filter.
    let data;
    let error;
    let totalCount = 0;

    const bottledFilter = filterState.netSkuPlan.bottledSohApplied;

    // Apply the opening/demand filters to qBase by reusing the same logic above but on qBase
    // (we already applied some filters to q / qBase inconsistently above; to be safe, re-create q for these filters)
    let q = qBase;
    if (filterState.netSkuPlan.openingStock === "present") {
      q = q.not("opening_stock", "is", null).gt("opening_stock", 0);
    } else if (filterState.netSkuPlan.openingStock === "absent") {
      q = q.or("opening_stock.is.null,opening_stock.eq.0");
    }
    if (filterState.netSkuPlan.demandBaseline === "present") {
      q = q.not("demand_baseline", "is", null).gt("demand_baseline", 0);
    } else if (filterState.netSkuPlan.demandBaseline === "absent") {
      q = q.or("demand_baseline.is.null,demand_baseline.eq.0");
    }

    if (bottledFilter === "all") {
      console.debug("[debug] no bottled_soh_applied filter applied (all)");
      // Server-side paged query
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const res = await q;
      data = res.data;
      error = res.error;
      totalCount = res.count || 0;
    } else {
      // Bottled filter is active -> fetch everything (within other filters) and filter client-side
      console.debug(
        `[debug] bottled_soh_applied filter active (${bottledFilter}), fetching unpaged and filtering client-side`
      );
      const res = await q; // no range
      data = res.data;
      error = res.error;

      if (!error && data) {
        // store fetched count for debug
        const fetchedCount = data.length;
        // Apply client-side bottled filter using numeric semantics
        const filtered = data.filter((r) => {
          const raw = r.bottled_soh_applied;
          let val;
          if (typeof raw === "number") val = raw;
          else if (raw == null) val = 0;
          else val = Number(raw);

          if (Number.isNaN(val)) {
            // treat NaN/invalid as 0 (absent)
            val = 0;
          }
          if (bottledFilter === "present") return val > 0;
          if (bottledFilter === "absent") return val === 0;
          return true;
        });
        totalCount = filtered.length;
        console.debug(
          `[debug] bottled filter: fetched=${fetchedCount}, kept=${totalCount}`
        );
        // Paginate client-side
        const startIdx = page * PAGE_SIZE;
        data = filtered.slice(startIdx, startIdx + PAGE_SIZE);
      } else {
        totalCount = 0;
        data = [];
      }
    }

    // Debug: show how many rows returned and sample bottled_soh_applied values
    try {
      console.debug(
        "[debug] loadNetSkuPlanData result count:",
        totalCount,
        "rows:",
        data ? data.length : 0
      );
      if (data && data.length > 0) {
        const sample = data.slice(0, 5).map((r) => ({
          sku_id: r.sku_id,
          month_start: r.month_start,
          bottled_soh_applied: r.bottled_soh_applied,
        }));
        console.debug("[debug] sample rows:", sample);
      }
    } catch {
      console.debug("[debug] could not log sample rows");
    }

    if (error) {
      throw error;
    }

    // If another load has started since we initiated this one, drop these results
    if (myLoadId !== currentNetSkuLoadId) {
      console.debug(
        "Dropping stale Net SKU load result (myLoadId=",
        myLoadId,
        ", current=",
        currentNetSkuLoadId,
        ")"
      );
      tabState.netSkuPlan.loading = false;
      return;
    }

    // Get SKU and product information from cache for display
    const skuIds = [...new Set(data.map((row) => row.sku_id))];
    const skuInfo = await getSkuProductInfo(skuIds);

    // Clear skeleton loading before rendering actual data
    hideSkeletonLoading("net-sku-plan-body");

    // Render table
    if (!data || data.length === 0) {
      bodyEl.innerHTML =
        '<tr><td colspan="13" style="text-align: center; padding: 20px; color: #666;">No net SKU plan data found for the selected criteria</td></tr>';
      statusEl.textContent = "No data";
    } else {
      bodyEl.innerHTML = data
        .map((row) => {
          const sku = skuInfo[row.sku_id] || {};
          const productName = sku.item || `SKU ${row.sku_id}`;
          const packSize = sku.pack_size || "—";
          const packUom = sku.uom || "—";

          return `
            <tr>
              <td>${row.sku_id}</td>
              <td>${productName}</td>
              <td>${packSize}</td>
              <td>${packUom}</td>
              <td style="text-align: center;">${formatMonth(
                row.month_start
              )}</td>
              <td>${Number(row.opening_stock ?? 0).toFixed(3)}</td>
              <td>${Number(row.demand_baseline ?? 0).toFixed(3)}</td>
              <td>${Number(row.target_stock ?? 0).toFixed(3)}</td>
              <td>${Number(row.projected_stock_before_prod ?? 0).toFixed(
                3
              )}</td>
              <td>${Number(row.production_qty ?? 0).toFixed(3)}</td>
              <td>${Number(row.bottled_soh_applied ?? 0).toFixed(3)}</td>
              <td>${Number(row.net_production_qty ?? 0).toFixed(3)}</td>
              <td>${Number(row.projected_stock_after_prod_net ?? 0).toFixed(
                3
              )}</td>
            </tr>
          `;
        })
        .join("");

      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      statusEl.textContent = `Page ${
        page + 1
      } of ${totalPages} (${totalCount} records)`;

      // Update pagination buttons
      document.getElementById("net-sku-plan-prev").disabled = page === 0;
      document.getElementById("net-sku-plan-next").disabled =
        page >= totalPages - 1;
    }

    tabState.netSkuPlan.loaded = true;
  } catch (error) {
    console.error("Net SKU plan loading error:", error);
    hideSkeletonLoading("net-sku-plan-body");
    bodyEl.innerHTML = `<tr><td colspan="13" style="text-align: center; padding: 20px; color: #dc2626;">Error loading data: ${error.message}</td></tr>`;
    statusEl.textContent = "Error";
    showToast(`Error loading net SKU plan: ${error.message}`, "error");
  } finally {
    tabState.netSkuPlan.loading = false;
  }
}

function resetNetSkuPlanFilters() {
  // Reset date filters to current month
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const defaultMonthValue = `${currentYear}-${String(currentMonth + 1).padStart(
    2,
    "0"
  )}`;

  const fromInput = document.getElementById("net-sku-plan-from-month");
  const toInput = document.getElementById("net-sku-plan-to-month");
  const skuIdInput = document.getElementById("net-sku-plan-sku-id");
  const productNameInput = document.getElementById("net-sku-plan-product-name");

  if (fromInput) {
    fromInput.value = defaultMonthValue;
    filterState.netSkuPlan.fromMonth = new Date(currentYear, currentMonth, 1);
  }

  if (toInput) {
    toInput.value = defaultMonthValue;
    filterState.netSkuPlan.toMonth = new Date(currentYear, currentMonth, 1);
  }

  // Reset other filters
  filterState.netSkuPlan = {
    fromMonth: filterState.netSkuPlan.fromMonth,
    toMonth: filterState.netSkuPlan.toMonth,
    skuId: "",
    productName: "",
    openingStock: "all",
    demandBaseline: "all",
    bottledSohApplied: "all",
  };

  // Clear input values
  if (skuIdInput) skuIdInput.value = "";
  if (productNameInput) productNameInput.value = "";

  // Update state from cleared inputs
  filterState.netSkuPlan.skuId = "";
  filterState.netSkuPlan.productName = "";
  filterState.netSkuPlan.openingStock = "all";
  filterState.netSkuPlan.demandBaseline = "all";
  filterState.netSkuPlan.bottledSohApplied = "all";

  // Reset toggle UI to All
  document
    .querySelectorAll('[data-filter="opening-stock"]')
    .forEach((btn) => btn.classList.remove("active", "inactive"));
  document
    .querySelector('[data-filter="opening-stock"][data-value="all"]')
    .classList.add("active");
  document
    .querySelectorAll('[data-filter="demand-baseline"]')
    .forEach((btn) => btn.classList.remove("active", "inactive"));
  document
    .querySelector('[data-filter="demand-baseline"][data-value="all"]')
    .classList.add("active");
  document
    .querySelectorAll('[data-filter="bottled-soh-applied"]')
    .forEach((btn) => btn.classList.remove("active", "inactive"));
  document
    .querySelector('[data-filter="bottled-soh-applied"][data-value="all"]')
    .classList.add("active");

  // Reload data
  loadNetSkuPlanData(0);
}

function filterNetSkuPlanData() {
  loadNetSkuPlanData(0);
}

async function exportNetSkuPlanData() {
  try {
    const fromISO = document.getElementById("net-sku-plan-from-month").value;
    const toISO = document.getElementById("net-sku-plan-to-month").value;
    const skuId = document.getElementById("net-sku-plan-sku-id").value;

    // Convert month inputs to proper date strings
    const start = fromISO ? `${fromISO}-01` : fmtDate(fenceStart());
    const toShown = toISO
      ? new Date(`${toISO}-01T00:00:00`)
      : addMonths(fenceStart(), 12);
    const end = fmtDate(addMonths(monthFloor(toShown), 1));

    let q = supabase
      .from("v_forecast_production_plan_net_sku")
      .select(
        "sku_id,month_start,opening_stock,demand_baseline,target_stock,projected_stock_before_prod,production_qty,bottled_soh_applied,net_production_qty,projected_stock_after_prod_net"
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("sku_id", { ascending: true })
      .order("month_start", { ascending: true });

    if (skuId) q = q.eq("sku_id", Number(skuId));

    // Apply product name filter if provided
    const productName = filterState.netSkuPlan.productName;
    if (productName) {
      // Search directly in SKU catalog by item name
      const { data: skuData, error: skuError } = await supabase
        .from("v_sku_catalog_enriched")
        .select("sku_id")
        .ilike("item", `%${productName}%`);

      if (skuError) throw skuError;

      if (skuData.length > 0) {
        const matchingSkuIds = skuData.map((row) => row.sku_id);
        q = q.in("sku_id", matchingSkuIds);
      } else {
        showToast("No data found matching the filters", "error");
        return;
      }
    }

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0) {
      showToast("No data found for export", "error");
      return;
    }

    // Get SKU and product information for export
    const skuIds = [...new Set(data.map((row) => row.sku_id))];
    const skuInfo = await getSkuProductInfo(skuIds);

    // Create CSV content
    const headers = [
      "SKU ID",
      "Product Name",
      "Pack Size",
      "UOM",
      "Month",
      "Opening Stock",
      "Demand Baseline",
      "Target Stock",
      "Projected Before Prod",
      "Production Qty",
      "Bottled SOH Applied",
      "Net Production Qty",
      "Projected After Net Prod",
    ];

    const csvContent = [
      headers.join(","),
      ...data.map((row) => {
        const sku = skuInfo[row.sku_id] || {};
        const productName = sku.item || `SKU ${row.sku_id}`;
        const packSize = sku.pack_size || "";
        const packUom = sku.uom || "";

        return [
          row.sku_id,
          `"${productName.replace(/"/g, '""')}"`,
          packSize,
          packUom,
          formatMonth(row.month_start),
          Number(row.opening_stock ?? 0).toFixed(3),
          Number(row.demand_baseline ?? 0).toFixed(3),
          Number(row.target_stock ?? 0).toFixed(3),
          Number(row.projected_stock_before_prod ?? 0).toFixed(3),
          Number(row.production_qty ?? 0).toFixed(3),
          Number(row.bottled_soh_applied ?? 0).toFixed(3),
          Number(row.net_production_qty ?? 0).toFixed(3),
          Number(row.projected_stock_after_prod_net ?? 0).toFixed(3),
        ].join(",");
      }),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `net_sku_plan_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${data.length} records successfully`, "success");
  } catch (error) {
    console.error("Export error:", error);
    showToast("Error during CSV export", "error");
  }
}

// Helper function to get SKU and product information
async function getSkuProductInfo(skuIds) {
  if (skuIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from("v_sku_catalog_enriched")
      .select("sku_id, product_id, item, pack_size, uom, uom_base")
      .in("sku_id", skuIds);

    if (error) throw error;

    // Build the result map with all SKU information
    const result = {};
    data.forEach((row) => {
      result[row.sku_id] = {
        product_id: row.product_id,
        item: row.item, // This is the product name
        pack_size: row.pack_size,
        uom: row.uom, // Pack UOM (e.g., mL)
        uom_base: row.uom_base, // Base UOM (e.g., L)
      };
    });

    return result;
  } catch (error) {
    console.error("Error fetching SKU product info:", error);
    return {};
  }
}

// ============= Bulk Requirements Functions =============
async function loadBulkRequirementsData(page = 0) {
  if (tabState.bulkRequirements.loading) return;

  tabState.bulkRequirements.loading = true;
  tabState.bulkRequirements.page = page;

  const statusEl = document.getElementById("bulk-requirements-page-info");
  const bodyEl = document.getElementById("bulk-requirements-body");

  statusEl.textContent = "Loading...";
  showSkeletonLoading("bulk-requirements-body", 5, 8); // Show skeleton instead of empty table

  try {
    const fromISO = document.getElementById(
      "bulk-requirements-from-month"
    ).value;
    const toISO = document.getElementById("bulk-requirements-to-month").value;
    const productId = document.getElementById(
      "bulk-requirements-product-id"
    ).value;

    // Convert month inputs (YYYY-MM) to proper date strings
    const start = fromISO ? `${fromISO}-01` : fmtDate(fenceStart());
    const toShown = toISO
      ? new Date(`${toISO}-01T00:00:00`)
      : addMonths(fenceStart(), 12);
    const end = fmtDate(addMonths(monthFloor(toShown), 1));

    let q = supabase
      .from("v_product_bulk_required_monthly")
      .select("product_id,month_start,bulk_required,uom_base", {
        count: "exact",
      })
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (productId) q = q.eq("product_id", Number(productId));

    // Apply product name filter if provided
    const productName = filterState.bulkRequirements.productName;
    if (productName) {
      // Use cached product lookup for better performance
      await ensureProductCacheLoaded();

      // Find matching product IDs from cache
      const matchingProductIds = [];
      for (const [productId, cachedName] of productCache.names) {
        if (cachedName.toLowerCase().includes(productName.toLowerCase())) {
          matchingProductIds.push(productId);
        }
      }

      if (matchingProductIds.length > 0) {
        q = q.in("product_id", matchingProductIds);
      } else {
        // No products match the name filter
        hideSkeletonLoading("bulk-requirements-body"); // Clear skeleton when no data
        bodyEl.innerHTML =
          '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #666;">No products found matching the name filter</td></tr>';
        statusEl.textContent = "No data";
        tabState.bulkRequirements.loading = false;
        return;
      }
    }

    const { data, error, count: totalCount } = await q;

    if (error) {
      throw error;
    }

    // Get product names from cache for display - much faster than separate query
    const productIds = [...new Set(data.map((row) => row.product_id))];
    const productNames = await getProductNames(productIds);

    // Clear skeleton loading before rendering actual data
    hideSkeletonLoading("bulk-requirements-body");

    // Render table
    if (!data || data.length === 0) {
      bodyEl.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #666;">No bulk requirements data found for the selected criteria</td></tr>';
      statusEl.textContent = "No data";
    } else {
      bodyEl.innerHTML = data
        .map((row) => {
          const productName =
            productNames[row.product_id] || `Product ${row.product_id}`;
          return `
            <tr>
              <td>${row.product_id}</td>
              <td>${productName}</td>
              <td>${row.uom_base || "N/A"}</td>
              <td style="text-align: center;">${formatMonth(
                row.month_start
              )}</td>
              <td>${Number(row.bulk_required ?? 0).toFixed(3)}</td>
            </tr>
          `;
        })
        .join("");

      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      statusEl.textContent = `Page ${
        page + 1
      } of ${totalPages} (${totalCount} records)`;

      // Update pagination buttons
      document.getElementById("bulk-requirements-prev").disabled = page === 0;
      document.getElementById("bulk-requirements-next").disabled =
        page >= totalPages - 1;
    }
  } catch (error) {
    console.error("Bulk requirements loading error:", error);
    hideSkeletonLoading("bulk-requirements-body"); // Clear skeleton on error too
    bodyEl.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #dc2626;">Error loading data: ${error.message}</td></tr>`;
    statusEl.textContent = "Error";
    showToast(`Error loading bulk requirements: ${error.message}`, "error");
  } finally {
    tabState.bulkRequirements.loading = false;
  }
}

function resetBulkRequirementsFilters() {
  // Reset date filters to current month
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const defaultMonthValue = `${currentYear}-${String(currentMonth + 1).padStart(
    2,
    "0"
  )}`;

  const fromInput = document.getElementById("bulk-requirements-from-month");
  const toInput = document.getElementById("bulk-requirements-to-month");

  if (fromInput) {
    fromInput.value = defaultMonthValue;
    filterState.bulkRequirements.fromMonth = new Date(
      currentYear,
      currentMonth,
      1
    );
  }

  if (toInput) {
    toInput.value = defaultMonthValue;
    filterState.bulkRequirements.toMonth = new Date(
      currentYear,
      currentMonth,
      1
    );
  }

  // Clear text inputs
  document.getElementById("bulk-requirements-product-id").value = "";
  document.getElementById("bulk-requirements-product-name").value = "";

  // Reset filter state
  filterState.bulkRequirements = {
    fromMonth: new Date(currentYear, currentMonth, 1),
    toMonth: new Date(currentYear, currentMonth, 1),
    productId: "",
    productName: "",
  };

  // Reload data
  loadBulkRequirementsData(0);
}

function filterBulkRequirementsData() {
  // Collect filter values
  filterState.bulkRequirements.productId = document
    .getElementById("bulk-requirements-product-id")
    .value.trim();
  filterState.bulkRequirements.productName = document
    .getElementById("bulk-requirements-product-name")
    .value.trim();

  // Reset to first page and load data
  tabState.bulkRequirements.page = 0;
  loadBulkRequirementsData(0);
}

async function openBulkRequirementsDrill(productId, month, productName) {
  const modal = document.getElementById("drill-modal");
  const title = document.getElementById("drill-title");
  const subtitle = document.getElementById("drill-subtitle");
  const itemChip = document.getElementById("drill-item");
  const monthChip = document.getElementById("drill-month");
  const content = document.getElementById("drill-content");

  title.textContent = "Bulk Requirements Details";
  subtitle.textContent = "Detailed breakdown of bulk requirements calculation";
  itemChip.textContent = `Product: ${productName}`;
  monthChip.textContent = `Month: ${formatMonth(month)}`;

  content.innerHTML =
    '<div style="text-align: center; padding: 20px;">Loading detailed breakdown...</div>';
  modal.showModal();

  try {
    // Get the source data from v_forecast_production_plan_net_sku for this product and month
    const { data: planData, error: planError } = await supabase
      .from("v_forecast_production_plan_net_sku")
      .select("sku_id,net_production_qty")
      .gte("month_start", month)
      .lt(
        "month_start",
        fmtDate(addMonths(new Date(month + "-01T00:00:00"), 1))
      )
      .gt("net_production_qty", 0)
      .order("sku_id");

    if (planError) throw planError;

    // Get SKU details and filter by product
    const { data: skuData, error: skuError } = await supabase
      .from("v_sku_catalog_enriched")
      .select("sku_id,product_id,item,pack_size,conversion_to_base,uom_base")
      .eq("product_id", productId);

    if (skuError) throw skuError;

    // Join the data
    const detailData = planData
      .map((plan) => {
        const sku = skuData.find((s) => s.sku_id === plan.sku_id);
        if (!sku) return null;

        const bulkContribution =
          Math.max(plan.net_production_qty, 0) *
          sku.pack_size *
          sku.conversion_to_base;
        return {
          sku_id: plan.sku_id,
          item: sku.item,
          net_units: plan.net_production_qty,
          pack_size: sku.pack_size,
          conversion: sku.conversion_to_base,
          uom_base: sku.uom_base,
          bulk_contribution: bulkContribution,
        };
      })
      .filter((item) => item !== null);

    const totalBulk = detailData.reduce(
      (sum, item) => sum + item.bulk_contribution,
      0
    );

    content.innerHTML = `
      <h4>SKU-Level Requirements Breakdown</h4>
      <div class="table-container">
        <div class="flex-table bulk-requirements-detail">
          <div class="flex-table-header">
            <div class="flex-table-cell">SKU ID</div>
            <div class="flex-table-cell">Item</div>
            <div class="flex-table-cell">Net Units</div>
            <div class="flex-table-cell">Pack Size</div>
            <div class="flex-table-cell">Conversion</div>
            <div class="flex-table-cell">Bulk Contribution</div>
          </div>
          ${detailData
            .map(
              (item) => `
            <div class="flex-table-row">
              <div class="flex-table-cell">${item.sku_id}</div>
              <div class="flex-table-cell">${item.item}</div>
              <div class="flex-table-cell">${fmtNum(item.net_units)}</div>
              <div class="flex-table-cell">${fmtNum(item.pack_size)}</div>
              <div class="flex-table-cell">${fmtNum(item.conversion)}</div>
              <div class="flex-table-cell">${fmtNum(
                item.bulk_contribution
              )}</div>
            </div>
          `
            )
            .join("")}
          <div class="flex-table-row" style="background: #f0f9ff; font-weight: 600;">
            <div class="flex-table-cell" colspan="5" style="text-align: right;">Total Bulk Required:</div>
            <div class="flex-table-cell">${fmtNum(totalBulk)} ${
      detailData[0]?.uom_base || ""
    }</div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Bulk requirements drill error:", error);
    content.innerHTML = `
      <div style="color: #dc2626; text-align: center; padding: 20px;">
        <h4>Error Loading Details</h4>
        <p>Unable to load detailed breakdown for this bulk requirement.</p>
        <div style="text-align: left; margin-top: 15px; padding: 15px; background: #fef2f2; border-radius: 6px; font-family: monospace; font-size: 12px;">
          <strong>Error Details:</strong><br>
          ${error.message || error.toString()}
        </div>
      </div>
    `;
  }
}

function filterNettingData() {
  // Collect filter values from enhanced UI
  filterState.netting.productId = document
    .getElementById("netting-product-id")
    .value.trim();
  filterState.netting.productName = document
    .getElementById("netting-product-name")
    .value.trim();

  // Reset to first page and load data
  tabState.netting.page = 0;
  loadNettingData(0);
}

function filterWipData() {
  // Collect filter values from enhanced UI
  filterState.wip.productId = document
    .getElementById("wip-product-id")
    .value.trim();
  filterState.wip.productName = document
    .getElementById("wip-product-name")
    .value.trim();

  // Reset to first page and load data
  tabState.wip.page = 0;
  loadWipData(0);
}

function filterNormalizerData() {
  tabState.normalizer.page = 0;
  loadNormalizerData(0);
}

async function exportBulkRequirementsData() {
  try {
    showToast("Preparing CSV export...", "info");

    // Use same date logic as loadBulkRequirementsData
    const fromISO = document.getElementById(
      "bulk-requirements-from-month"
    ).value;
    const toISO = document.getElementById("bulk-requirements-to-month").value;

    const start = fromISO ? `${fromISO}-01` : fmtDate(fenceStart());
    const toShown = toISO
      ? new Date(`${toISO}-01T00:00:00`)
      : addMonths(fenceStart(), 12);
    const end = fmtDate(addMonths(monthFloor(toShown), 1));

    // Query all matching data (without pagination)
    let bulkQuery = supabase
      .from("v_product_bulk_required_monthly")
      .select("product_id,month_start,bulk_required,uom_base")
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true });

    // Apply same filters as the UI
    if (filterState.bulkRequirements.productId) {
      bulkQuery = bulkQuery.eq(
        "product_id",
        Number(filterState.bulkRequirements.productId)
      );
    }

    // Apply product name filter if provided
    if (filterState.bulkRequirements.productName) {
      const { data: skuData } = await supabase
        .from("v_sku_catalog_enriched")
        .select("product_id")
        .ilike("item", `%${filterState.bulkRequirements.productName}%`);

      if (skuData && skuData.length > 0) {
        const productIds = [...new Set(skuData.map((s) => s.product_id))];
        bulkQuery = bulkQuery.in("product_id", productIds);
      } else {
        showToast("No products found matching the name filter", "info");
        return;
      }
    }

    const { data: bulkData, error: bulkError } = await bulkQuery;

    if (bulkError) {
      throw bulkError;
    }

    if (!bulkData || bulkData.length === 0) {
      showToast("No data to export", "info");
      return;
    }

    // Get product names for the export
    const productIds = [...new Set(bulkData.map((row) => row.product_id))];
    const productNames = {};

    if (productIds.length > 0) {
      const { data: skuData } = await supabase
        .from("v_sku_catalog_enriched")
        .select("product_id,item")
        .in("product_id", productIds);

      if (skuData) {
        skuData.forEach((sku) => {
          if (!productNames[sku.product_id]) {
            productNames[sku.product_id] = sku.item;
          }
        });
      }
    }

    // Create CSV content
    const headers = [
      "Product ID",
      "Product Name",
      "UOM",
      "Month",
      "Bulk Required",
    ];
    const csvRows = [headers.join(",")];

    bulkData.forEach((row) => {
      const productName =
        productNames[row.product_id] || `Product ${row.product_id}`;
      const csvRow = [
        row.product_id,
        `"${productName}"`, // Quote product name in case it contains commas
        row.uom_base || "N/A",
        formatMonth(row.month_start),
        fmtNum(row.bulk_required),
      ];
      csvRows.push(csvRow.join(","));
    });

    // Download the CSV
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `bulk_requirements_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${bulkData.length} records to CSV`, "success");
  } catch (error) {
    console.error("Export error:", error);
    showToast(`Export failed: ${error.message}`, "error");
  }
}

// ============= Global Functions (called from HTML) =============
window.loadBulkRequirementsData = loadBulkRequirementsData;
window.resetBulkRequirementsFilters = resetBulkRequirementsFilters;
window.filterBulkRequirementsData = filterBulkRequirementsData;
window.exportBulkRequirementsData = exportBulkRequirementsData;
window.openBulkRequirementsDrill = openBulkRequirementsDrill;
window.loadNettingData = loadNettingData;
window.loadWipData = loadWipData;
window.loadNormalizerData = loadNormalizerData;
window.filterNettingData = filterNettingData;
window.filterWipData = filterWipData;
window.filterNormalizerData = filterNormalizerData;
window.exportNettingData = exportNettingData;
window.exportWipData = exportWipData;
window.exportNormalizerData = exportNormalizerData;
window.closeDrillModal = closeDrillModal;

// Expose generic modal opener
window.openDrillModal = openDrillModal;

// Net SKU Plan globals
window.loadNetSkuPlanData = loadNetSkuPlanData;
window.resetNetSkuPlanFilters = resetNetSkuPlanFilters;
window.exportNetSkuPlanData = exportNetSkuPlanData;
window.loadForecastHierarchyData = loadForecastHierarchyData;

// Enhanced filter functions
window.resetNettingFilters = resetNettingFilters;
window.resetWipFilters = resetWipFilters;

// ============= Initialization =============
document.addEventListener("DOMContentLoaded", async () => {
  // Ensure authentication
  currentUser = await ensureAuth();
  if (!currentUser) return;

  // Setup home button
  document.getElementById("homeBtn").addEventListener("click", () => {
    window.location.href = "index.html";
  });

  // Set default dates
  setDefaultDates();

  // Initialize month inputs
  initializeMonthInputs();
  initializeToggleButtons();
  initializeTextInputs();
  // Ensure bottled soh toggle handlers are attached (defensive)
  attachBottledSohToggleHandlers();
  // Initialize forecast controls
  if (typeof initForecastControls === "function") initForecastControls();

  // Initialize tab system
  initTabSystem();

  // Setup pagination
  setupPagination();

  // Setup modal
  setupModal();

  // Load initial data for the currently active tab (respect the DOM's default)
  const activeTabBtn =
    document.querySelector('.tab-btn[aria-selected="true"]') ||
    document.querySelector(".tab-btn");
  if (activeTabBtn) {
    const tabId = activeTabBtn
      .getAttribute("aria-controls")
      .replace("tab-", "");
    // Ensure we trigger the same auto-load behavior as when a user clicks a tab
    autoLoadTabData(tabId);
    // Also update the workflow progress indicator to reflect the active tab
    if (typeof updateWorkflowSteps === "function") updateWorkflowSteps(tabId);
  }

  console.log("Production Planning Workbench initialized");
});
