import { supabase } from "../public/shared/js/supabaseClient.js";

/** Utilities */
const $ = (id) => document.getElementById(id);
const fmtInt = (v) => (v == null ? "" : Number(v).toString());
const fmtNum = (v) => (v == null ? "" : Number(v).toLocaleString());
const parseMonth = (m) => (m ? `${m}-01` : null);

function getDatalistForElement(el) {
  if (!el) return null;
  try {
    const listId = el.getAttribute && el.getAttribute("list");
    if (listId) return document.getElementById(listId);
  } catch (e) {
    void e;
  }
  return null;
}

/** Simple custom autocomplete panel for inputs with datalist.
 * Shows a limited-height scrollable suggestion box so the native datalist
 * doesn't expand the entire viewport. Lightweight and unobtrusive.
 */
function attachAutocompleteToInput(inputEl, datalistEl, opts = {}) {
  if (!inputEl || !datalistEl) return null;
  const maxHeight = opts.maxHeight || 220; // px
  const maxItems = opts.maxItems || 500; // cap items rendered

  // Build initial options array from datalist <option> values
  const readOptions = () =>
    Array.from(datalistEl.options || []).map((o) => String(o.value || ""));

  // Create panel
  const panel = document.createElement("div");
  panel.className = "autocomplete-panel";
  panel.style.position = "absolute";
  panel.style.background = "#fff";
  panel.style.border = "1px solid #ddd";
  panel.style.boxShadow = "0 6px 18px rgba(0,0,0,0.12)";
  panel.style.zIndex = 9999;
  panel.style.maxHeight = maxHeight + "px";
  panel.style.overflowY = "auto";
  panel.style.display = "none";
  panel.style.padding = "4px 0";
  panel.style.borderRadius = "6px";
  panel.setAttribute("role", "listbox");

  document.body.appendChild(panel);

  let visibleOptions = [];
  let selectedIndex = -1;

  function positionPanel() {
    const rect = inputEl.getBoundingClientRect();
    // desired width should be at least the input width but never exceed viewport
    const viewportW = window.innerWidth || document.documentElement.clientWidth;
    const desiredWidth = Math.min(rect.width, Math.floor(viewportW * 0.95));
    panel.style.minWidth = desiredWidth + "px";
    // also set a maxWidth inline to ensure browser doesn't overflow
    panel.style.maxWidth = Math.floor(viewportW * 0.95) + "px";

    // compute left and clamp to viewport so panel doesn't overflow horizontally
    let left = rect.left + window.scrollX;
    const maxLeft = window.scrollX + viewportW - desiredWidth - 8; // 8px margin
    if (left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft);
    if (left < window.scrollX + 8) left = window.scrollX + 8;
    panel.style.left = left + "px";

    // place below input; if not enough space vertically, prefer above
    const belowSpace = window.innerHeight - rect.bottom;
    if (belowSpace < 80 && rect.top > rect.height + 40) {
      // position above (try to estimate height but clamp via maxHeight)
      panel.style.top =
        Math.max(
          window.scrollY + 8,
          rect.top + window.scrollY - panel.offsetHeight
        ) + "px";
      panel.style.maxHeight = Math.min(maxHeight, rect.top - 20) + "px";
    } else {
      panel.style.top = rect.bottom + window.scrollY + "px";
      panel.style.maxHeight = maxHeight + "px";
    }
  }

  function renderList(items) {
    panel.innerHTML = "";
    const frag = document.createDocumentFragment();
    items.slice(0, maxItems).forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "autocomplete-row";
      row.textContent = it;
      row.style.padding = "6px 10px";
      row.style.cursor = "pointer";
      row.style.whiteSpace = "nowrap";
      row.style.overflow = "hidden";
      row.style.textOverflow = "ellipsis";
      row.dataset.idx = idx;
      row.addEventListener("mousedown", (ev) => {
        // mousedown so it fires before blur on input
        ev.preventDefault();
        pickIndex(idx);
      });
      frag.appendChild(row);
    });
    panel.appendChild(frag);
    visibleOptions = items.slice(0, maxItems);
    selectedIndex = -1;
  }

  function showPanel() {
    if (panel.style.display === "block") return;
    positionPanel();
    panel.style.display = "block";
  }
  function hidePanel() {
    if (panel.style.display === "none") return;
    panel.style.display = "none";
    selectedIndex = -1;
  }

  function pickIndex(idx) {
    const val = visibleOptions[idx];
    if (val == null) return;
    inputEl.value = val;
    // trigger change/input so other listeners notice
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    hidePanel();
  }

  function highlightSelected() {
    Array.from(panel.children).forEach((c, i) => {
      if (i === selectedIndex) {
        c.style.background = "#eef2ff";
      } else {
        c.style.background = "transparent";
      }
    });
    // ensure visible
    const el = panel.children[selectedIndex];
    if (el) {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (top < panel.scrollTop) panel.scrollTop = top;
      else if (bottom > panel.scrollTop + panel.clientHeight)
        panel.scrollTop = bottom - panel.clientHeight;
    }
  }

  function onInput() {
    const q = String(inputEl.value || "")
      .trim()
      .toLowerCase();
    const all = readOptions();
    if (!q) {
      // show all but limited
      renderList(all);
      showPanel();
      return;
    }
    const filtered = all.filter((s) => s.toLowerCase().includes(q));
    if (!filtered.length) {
      hidePanel();
      return;
    }
    renderList(filtered);
    showPanel();
  }

  function onKey(ev) {
    if (panel.style.display !== "block") return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      if (selectedIndex < visibleOptions.length - 1) selectedIndex++;
      highlightSelected();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      if (selectedIndex > 0) selectedIndex--;
      highlightSelected();
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (selectedIndex >= 0) pickIndex(selectedIndex);
      else {
        // if no selection, and there's exactly one visible option, pick it
        if (visibleOptions.length === 1) pickIndex(0);
        hidePanel();
      }
    } else if (ev.key === "Escape") {
      hidePanel();
    }
  }

  function onDocumentClick(e) {
    if (e.target === inputEl || panel.contains(e.target)) return;
    hidePanel();
  }

  inputEl.addEventListener("input", onInput);
  inputEl.addEventListener("keydown", onKey);
  inputEl.addEventListener("focus", onInput);
  window.addEventListener("resize", positionPanel);
  document.addEventListener("click", onDocumentClick);

  // Return a small API to allow teardown if needed
  return {
    detach() {
      inputEl.removeEventListener("input", onInput);
      inputEl.removeEventListener("keydown", onKey);
      inputEl.removeEventListener("focus", onInput);
      window.removeEventListener("resize", positionPanel);
      document.removeEventListener("click", onDocumentClick);
      panel.remove();
    },
  };
}

/** Format month_start (YYYY-MM-01) into 'Mon YYYY' for display */
function fmtMonthLabel(monthStart) {
  if (!monthStart) return "";
  try {
    // Some values may already be YYYY-MM or YYYY-MM-01; Date can parse YYYY-MM-01
    const d = new Date(monthStart);
    return d.toLocaleString("en-US", { month: "short", year: "numeric" });
  } catch {
    return String(monthStart);
  }
}

// (fmtTimestamp removed — Updated column replaced by Actions column)

// Inline SVG icons (use fill/currentColor or stroke=currentColor as appropriate)
const SVG_TRASH =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>';
const SVG_PENCIL =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16" aria-hidden="true"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/></svg>';
const SVG_PROMOTE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-right-square" viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M15 2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1zM0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm4.5 5.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5z"/></svg>';
// active: check-circle, inactive: simple circle
// Active (green) and Inactive (red) filled icons (Bootstrap fill variants)
const SVG_CHECK_CIRCLE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16" aria-hidden="true"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
// We use the same check-circle-fill SVG for both states and color via CSS classes

// --- Lookup caches (sku -> product item/pack/uom, godown -> name/region, region -> code/name)
const skuMap = new Map();
const productMap = new Map();
const godownMap = new Map();
const regionMap = new Map();

// Track products we've already warned about to avoid spamming the console
const _warnedProductsWithoutName = new Set();

// Cache current user id for uploaded_by propagation
let __currentUserId = undefined;
async function getCurrentUserId() {
  if (typeof __currentUserId !== "undefined") return __currentUserId;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("getCurrentUserId: auth.getUser error", error);
      __currentUserId = null;
    } else {
      __currentUserId = data?.user?.id || null;
    }
  } catch (e) {
    console.error("getCurrentUserId error", e);
    __currentUserId = null;
  }
  return __currentUserId;
}

/** Load lookup tables used to render human-readable names */
async function loadLookups() {
  // Fetch in parallel. Use the enriched SKU catalog view which contains
  // product and SKU display fields (item, pack_size, uom, sku_label, etc.).
  // Fetch catalog in pages to avoid server-side limits. We'll request pages of
  // PAGE_SIZE until a page returns fewer rows than PAGE_SIZE.
  const PAGE_SIZE = 1000;
  let page = 0;
  const catalogRows = [];
  let catalogErr = null;
  try {
    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data: pageRows, error: pageErr } = await supabase
        .from("v_sku_catalog_enriched")
        .select(
          "sku_id,product_id,item,malayalam_name,status,uom_base,conversion_to_base,pack_size,uom,is_active,sku_label"
        )
        .range(from, to);
      if (pageErr) {
        catalogErr = pageErr;
        break;
      }
      if (!pageRows || !pageRows.length) break;
      catalogRows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) break;
      page++;
    }
  } catch (e) {
    catalogErr = e;
  }

  const godownsRes = await supabase
    .from("godowns")
    .select("id,code,name,region_id");
  const regionsRes = await supabase.from("regions").select("id,code,name");

  const catalogRes = { data: catalogRows, error: catalogErr };

  if (catalogRes.error)
    console.error(
      "loadLookups: v_sku_catalog_enriched error",
      catalogRes.error
    );
  // products pulled from catalog view; no separate products fetch performed
  if (godownsRes.error)
    console.error("loadLookups: godowns error", godownsRes.error);
  if (regionsRes.error)
    console.error("loadLookups: regions error", regionsRes.error);

  // Normalize keys to numbers to avoid string/number mismatches
  // Catalog view returns sku_id as the SKU identifier
  (catalogRes.data || []).forEach((s) => {
    const norm = {
      sku_id: Number(s.sku_id),
      product_id: s.product_id == null ? null : Number(s.product_id),
      item: s.item,
      malayalam_name: s.malayalam_name,
      status: s.status,
      uom_base: s.uom_base,
      conversion_to_base: s.conversion_to_base,
      pack_size: s.pack_size,
      uom: s.uom,
      is_active: s.is_active,
      sku_label: s.sku_label,
    };
    skuMap.set(Number(s.sku_id), norm);
  });

  // Populate productMap from the catalog so we can build the Product select
  // without a separate products fetch. Use first-seen item as display name.
  productMap.clear();
  Array.from(skuMap.values()).forEach((s) => {
    const pid = s.product_id == null ? null : Number(s.product_id);
    if (pid && !productMap.has(pid)) {
      productMap.set(pid, {
        id: pid,
        item: s.item || "",
        malayalam_name: s.malayalam_name || "",
      });
    }
  });

  // Also fetch products table to ensure we include any products that may not
  // be present (or were filtered out) in the v_sku_catalog_enriched view.
  // This prevents the Add Staging Row product select from showing a limited
  // subset when the catalog view is intentionally or accidentally filtered.
  try {
    const { data: allProducts, error: allProductsErr } = await supabase
      .from("products")
      .select("id,item,malayalam_name");
    if (allProductsErr) {
      console.warn("loadLookups: products fetch error", allProductsErr);
    } else {
      (allProducts || []).forEach((p) => {
        const pid = p && p.id != null ? Number(p.id) : null;
        if (!pid) return;
        if (!productMap.has(pid)) {
          productMap.set(pid, {
            id: pid,
            item: p.item || "",
            malayalam_name: p.malayalam_name || "",
          });
        } else {
          // fill in missing name fields if catalog view lacked them
          const existing = productMap.get(pid);
          if ((!existing.item || existing.item === "") && p.item)
            existing.item = p.item;
          if (
            (!existing.malayalam_name || existing.malayalam_name === "") &&
            p.malayalam_name
          )
            existing.malayalam_name = p.malayalam_name;
        }
      });
    }
  } catch (e) {
    console.warn("loadLookups: exception fetching products", e);
  }
  (godownsRes.data || []).forEach((g) => godownMap.set(Number(g.id), g));
  (regionsRes.data || []).forEach((r) => regionMap.set(Number(r.id), r));

  // Populate baseline filter controls if present
  try {
    // Populate exact-SKU select (IDs) from the baseline view (unique sku_id)
    const skuExactSel = $("filterSkuIdExact");
    const skuSel = $("filterSkuId");
    // Populate exact SKU ID select from v_forecast_baseline_effective so only SKU IDs
    // present in the baseline preview are offered.
    if (skuExactSel) {
      const skuExactList = getDatalistForElement(skuExactSel);
      if (skuExactList) skuExactList.innerHTML = ""; // clear datalist
      else {
        // ensure placeholder exists for select fallback
        if (!skuExactSel.querySelector('option[value=""]'))
          skuExactSel.insertAdjacentHTML(
            "afterbegin",
            `<option value="">All SKU IDs</option>`
          );
      }
      try {
        const fromEl = $("fromMonth");
        const toEl = $("toMonth");
        const regEl = $("filterRegion");
        const gdnEl = $("filterGodown");
        const _from = fromEl && fromEl.value ? parseMonth(fromEl.value) : null;
        const _to = toEl && toEl.value ? parseMonth(toEl.value) : null;
        const _region_id = regEl && regEl.value ? Number(regEl.value) : null;
        const _godown_id = gdnEl && gdnEl.value ? Number(gdnEl.value) : null;

        const { data: rpcRows, error: rpcErr } = await supabase.rpc(
          "get_baseline_sku_ids",
          { _from, _to, _godown_id, _region_id }
        );
        if (rpcErr)
          console.warn("loadLookups: get_baseline_sku_ids RPC failed", rpcErr);

        let ids = (rpcRows || [])
          .map((r) => (r && r.sku_id != null ? Number(r.sku_id) : null))
          .filter((n) => n != null)
          .sort((a, b) => a - b);

        // If RPC returned nothing (or was blocked), fall back to catalog skuMap so the
        // datalist isn't empty — this improves UX until server RPC is available.
        if (!ids.length) {
          ids = Array.from(skuMap.keys()).sort((a, b) => a - b);
          console.debug(
            `loadLookups: baseline sku ids empty, falling back to skuMap (${ids.length})`
          );
        }

        if (skuExactList) {
          ids.forEach((id) =>
            skuExactList.insertAdjacentHTML(
              "beforeend",
              `<option value="${id}">`
            )
          );
        } else {
          ids.forEach((id) =>
            skuExactSel.insertAdjacentHTML(
              "beforeend",
              `<option value="${id}">${id}</option>`
            )
          );
        }

        console.debug(
          `loadLookups: baseline sku ids — rpc:${rpcRows?.length || 0} final:${
            ids.length
          }`
        );
      } catch (e) {
        console.warn("loadLookups: exception fetching baseline sku ids", e);
      }
    }
    if (skuSel) {
      // If the SKU control is now an input with an associated datalist, populate
      // the datalist; otherwise fall back to populating the select element.
      const skuListEl =
        document.getElementById("filterSkuId_list") ||
        getDatalistForElement(skuSel);
      if (skuListEl) skuListEl.innerHTML = "";
      else if (!skuSel.querySelector('option[value=""]'))
        skuSel.insertAdjacentHTML(
          "afterbegin",
          `<option value="">All SKUs</option>`
        );

      try {
        const fromEl = $("fromMonth");
        const toEl = $("toMonth");
        const regEl = $("filterRegion");
        const gdnEl = $("filterGodown");
        const _from = fromEl && fromEl.value ? parseMonth(fromEl.value) : null;
        const _to = toEl && toEl.value ? parseMonth(toEl.value) : null;
        const _region_id = regEl && regEl.value ? Number(regEl.value) : null;
        const _godown_id = gdnEl && gdnEl.value ? Number(gdnEl.value) : null;

        const { data: skuRows, error: skuErr } = await supabase.rpc(
          "get_baseline_skus",
          { _from, _to, _godown_id, _region_id }
        );
        if (skuErr)
          console.warn("loadLookups: get_baseline_skus RPC failed", skuErr);

        if (skuRows && skuRows.length) {
          skuRows.forEach((r) => {
            const sid = r && r.sku_id != null ? Number(r.sku_id) : "";
            const label =
              r && r.sku_label != null ? String(r.sku_label) : String(sid);
            if (skuListEl)
              skuListEl.insertAdjacentHTML(
                "beforeend",
                `<option value="${sid} - ${htmlEscape(label)}">`
              );
            else
              skuSel.insertAdjacentHTML(
                "beforeend",
                `<option value="${sid}">${htmlEscape(label)}</option>`
              );
          });
        } else {
          console.debug(
            "loadLookups: get_baseline_skus returned no rows; sku control left with placeholder only"
          );
        }
      } catch (e) {
        console.warn("loadLookups: exception fetching baseline sku labels", e);
      }
    }

    const prodSel = $("filterProduct");
    if (prodSel) {
      const prodListEl =
        document.getElementById("filterProduct_list") ||
        getDatalistForElement(prodSel);
      if (prodListEl) prodListEl.innerHTML = "";
      else if (!prodSel.querySelector('option[value=""]'))
        prodSel.insertAdjacentHTML(
          "afterbegin",
          `<option value="">All Products</option>`
        );

      try {
        const fromEl = $("fromMonth");
        const toEl = $("toMonth");
        const regEl = $("filterRegion");
        const gdnEl = $("filterGodown");
        const _from = fromEl && fromEl.value ? parseMonth(fromEl.value) : null;
        const _to = toEl && toEl.value ? parseMonth(toEl.value) : null;
        const _region_id = regEl && regEl.value ? Number(regEl.value) : null;
        const _godown_id = gdnEl && gdnEl.value ? Number(gdnEl.value) : null;

        const { data: prodRows, error: prodErr } = await supabase.rpc(
          "get_baseline_products",
          { _from, _to, _godown_id, _region_id }
        );
        if (prodErr)
          console.warn(
            "loadLookups: get_baseline_products RPC failed",
            prodErr
          );

        if (prodRows && prodRows.length) {
          prodRows.forEach((r) => {
            const pid = r && r.product_id != null ? Number(r.product_id) : "";
            const label = r && r.item != null ? String(r.item) : String(pid);
            if (prodListEl)
              prodListEl.insertAdjacentHTML(
                "beforeend",
                `<option value="${pid} - ${htmlEscape(label)}">`
              );
            else
              prodSel.insertAdjacentHTML(
                "beforeend",
                `<option value="${pid}">${htmlEscape(label)}</option>`
              );
          });
        } else {
          console.debug(
            "loadLookups: get_baseline_products returned no rows; prod control left with placeholder only"
          );
        }
      } catch (e) {
        console.warn("loadLookups: exception fetching baseline products", e);
      }
    }

    // Populate staging filters if present
    const stagingProd = $("filterProduct");
    if (stagingProd) {
      // ensure placeholder exists
      if (!stagingProd.querySelector('option[value=""]'))
        stagingProd.insertAdjacentHTML(
          "afterbegin",
          `<option value="">All Products</option>`
        );
      // populate from productMap
      const prods = Array.from(productMap.values()).sort((a, b) =>
        String(a.item || "").localeCompare(String(b.item || ""))
      );
      prods.forEach((p) =>
        stagingProd.insertAdjacentHTML(
          "beforeend",
          `<option value="${p.id}">${htmlEscape(
            p.item || p.malayalam_name || p.id
          )}</option>`
        )
      );
    }
    const stagingReg = $("filterRegion");
    if (stagingReg) {
      if (!stagingReg.querySelector('option[value=""]'))
        stagingReg.insertAdjacentHTML(
          "afterbegin",
          `<option value="">All Regions</option>`
        );
      Array.from(regionMap.entries())
        .map(([id, r]) => ({ id, ...r }))
        .sort((a, b) =>
          String(a.name || a.code || "").localeCompare(b.name || b.code)
        )
        .forEach((r) =>
          stagingReg.insertAdjacentHTML(
            "beforeend",
            `<option value="${r.id}">${htmlEscape(r.code || r.name)}</option>`
          )
        );
    }
    const stagingGdn = $("filterGodown");
    if (stagingGdn) {
      if (!stagingGdn.querySelector('option[value=""]'))
        stagingGdn.insertAdjacentHTML(
          "afterbegin",
          `<option value="">All Godowns</option>`
        );
      Array.from(godownMap.entries())
        .map(([id, g]) => ({ id, ...g }))
        .sort((a, b) =>
          String(a.code || a.name || "").localeCompare(b.code || b.name)
        )
        .forEach((g) =>
          stagingGdn.insertAdjacentHTML(
            "beforeend",
            `<option value="${g.id}">${htmlEscape(g.code || g.name)}</option>`
          )
        );
    }

    const regSel = $("filterRegion");
    if (regSel) {
      const regs = Array.from(regionMap.entries()).map(([id, r]) => ({
        id,
        ...r,
      }));
      regs.sort((a, b) =>
        String(a.name || a.code || "").localeCompare(b.name || b.code || "")
      );
      regs.forEach((r) =>
        regSel.insertAdjacentHTML(
          "beforeend",
          `<option value="${r.id}">${r.code || r.name}</option>`
        )
      );
    }

    const gdnSel = $("filterGodown");
    if (gdnSel) {
      const gds = Array.from(godownMap.entries()).map(([id, g]) => ({
        id,
        ...g,
      }));
      gds.sort((a, b) =>
        String(a.code || a.name || "").localeCompare(b.code || b.name || "")
      );
      gds.forEach((g) =>
        gdnSel.insertAdjacentHTML(
          "beforeend",
          `<option value="${g.id}">${g.code || g.name}</option>`
        )
      );
    }
  } catch (e) {
    console.warn("populate baseline filters failed", e);
  }
}

/** Ensure regions and godowns exist in cache for given ids */
async function ensureRegionsAndGodowns(regionIds = [], godownIds = []) {
  const rids = Array.from(
    new Set(regionIds.filter((v) => v != null).map((v) => Number(v)))
  );
  const gids = Array.from(
    new Set(godownIds.filter((v) => v != null).map((v) => Number(v)))
  );

  const missingR = rids.filter((id) => !regionMap.has(id));
  if (missingR.length) {
    const { data, error } = await supabase
      .from("regions")
      .select("id,code,name")
      .in("id", missingR);
    if (error) console.error("ensureRegions: fetch error", error);
    (data || []).forEach((row) => regionMap.set(Number(row.id), row));
  }

  const missingG = gids.filter((id) => !godownMap.has(id));
  if (missingG.length) {
    const { data, error } = await supabase
      .from("godowns")
      .select("id,code,name,region_id")
      .in("id", missingG);
    if (error) console.error("ensureGodowns: fetch error", error);
    (data || []).forEach((row) => godownMap.set(Number(row.id), row));
  }
}

function csvEscape(v) {
  if (v == null) return '""';
  const s = String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}

function htmlEscape(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Position an action panel using fixed positioning so it is not clipped
 * by ancestor containers that use overflow:auto. This keeps the panel
 * visible above scrollable table containers while preserving the DOM
 * structure so delegated event handlers continue to work.
 */
function positionPanelFixed(panel, toggle) {
  if (!panel || !toggle) return;
  // ensure the panel is measurable
  panel.style.display = "flex";
  panel.style.position = "fixed";
  panel.style.transform = "none";
  panel.style.right = "auto";
  // reset temporary coords so offsetWidth/Height are correct
  panel.style.left = "-9999px";
  panel.style.top = "-9999px";
  // Allow browser to render and compute sizes
  const rect = toggle.getBoundingClientRect();
  const pW = panel.offsetWidth || 160;
  const pH = panel.offsetHeight || 36;
  // vertically center on toggle
  let top = Math.round(rect.top + rect.height / 2 - pH / 2);
  // prefer opening to the left of toggle; if there's no space, open to the right
  let left = Math.round(rect.left - pW - 8);
  if (left < 8) left = Math.round(rect.right + 8);
  // clamp to viewport
  const vw = Math.max(
    document.documentElement.clientWidth || 0,
    window.innerWidth || 0
  );
  const vh = Math.max(
    document.documentElement.clientHeight || 0,
    window.innerHeight || 0
  );
  if (left + pW > vw - 8) left = Math.max(8, vw - pW - 8);
  if (top < 8) top = 8;
  if (top + pH > vh - 8) top = Math.max(8, vh - pH - 8);
  panel.style.left = left + "px";
  panel.style.top = top + "px";
  panel.style.zIndex = 99999;
}

/**
 * Return item/pack/uom for a SKU from local caches. This replaces fmtSkuParts
 * and centralizes the small lookup logic without DB access.
 */
function getSkuLabelParts(skuId) {
  if (!skuId && skuId !== 0) return { item: "", pack: "", uom: "" };
  const sku = skuMap.get(Number(skuId));
  if (!sku) return { item: String(skuId), pack: "", uom: "" };
  const prodId = sku.product_id == null ? null : Number(sku.product_id);
  const product = prodId == null ? null : productMap.get(prodId);
  let item = "";
  if (product) {
    const raw = product.item && String(product.item).trim();
    const mal = product.malayalam_name && String(product.malayalam_name).trim();
    if (raw && raw.length) item = raw;
    else if (mal && mal.length) item = mal;
  }
  const itemFallback = item || (prodId ? `Product #${prodId}` : String(skuId));
  if (!item && prodId) {
    if (!_warnedProductsWithoutName.has(prodId)) {
      console.warn(
        `SKU ${skuId} -> product ${prodId} has no meaningful name, falling back to '${itemFallback}'`
      );
      _warnedProductsWithoutName.add(prodId);
    }
  }
  const pack = sku.pack_size ? String(sku.pack_size) : "";
  const uom = sku.uom ? String(sku.uom) : "";
  return { item: itemFallback, pack, uom };
}

/** In-page modal helpers (info, error, confirm) - all return Promises to unify async flow */
function _makeModal({
  title = "",
  message = "",
  buttons = [{ text: "OK", value: true }],
}) {
  const existing = document.getElementById("globalInpageModal");
  if (existing) existing.remove();
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.id = "globalInpageModal";
    modal.style = `position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:9999;`;

    const card = document.createElement("div");
    card.style = `background:#fff;padding:20px;border-radius:10px;max-width:640px;width:94%;overflow:auto;box-shadow:0 12px 30px rgba(0,0,0,.18);font-family:inherit;border:1px solid #eee`;

    if (title) {
      const h = document.createElement("h3");
      h.textContent = title;
      card.appendChild(h);
    }

    const body = document.createElement("div");
    body.style = "margin:8px 0;color:#222;white-space:pre-wrap;";
    body.textContent = message;
    card.appendChild(body);

    const btnRow = document.createElement("div");
    btnRow.style =
      "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;";
    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = b.text;
      btn.addEventListener("click", () => {
        modal.remove();
        resolve(b.value);
      });
      btnRow.appendChild(btn);
    });

    card.appendChild(btnRow);
    modal.appendChild(card);
    document.body.appendChild(modal);
    // focus first button for keyboard accessibility
    setTimeout(() => {
      const first = btnRow.querySelector("button");
      if (first) first.focus();
    }, 10);
  });
}

function showModalInfo(message, title = "Notice") {
  return _makeModal({ title, message, buttons: [{ text: "OK", value: true }] });
}

function showModalError(message, title = "Error") {
  return _makeModal({ title, message, buttons: [{ text: "OK", value: true }] });
}

function showModalConfirm(message, title = "Confirm") {
  return _makeModal({
    title,
    message,
    buttons: [
      { text: "Cancel", value: false },
      { text: "OK", value: true },
    ],
  });
}

/** Ensure SKUs and their products exist in caches for the given sku id list */
async function ensureSkusAndProductsForIds(skuIds) {
  const ids = Array.from(
    new Set(skuIds.filter((v) => v != null).map((v) => Number(v)))
  );
  if (!ids.length) return;

  const missingSkuIds = ids.filter((id) => !skuMap.has(id));
  if (missingSkuIds.length) {
    const { data: skusData, error: skusErr } = await supabase
      .from("product_skus")
      .select("id,product_id,pack_size,uom,is_active")
      .in("id", missingSkuIds);
    if (skusErr) console.error("ensureSkus: product_skus fetch error", skusErr);
    (skusData || []).forEach((s) => {
      const norm = {
        ...s,
        product_id: s.product_id == null ? null : Number(s.product_id),
      };
      skuMap.set(Number(s.id), norm);
    });
  }

  // gather product_ids that we still don't have
  const prodIds = new Set();
  ids.forEach((sid) => {
    const s = skuMap.get(sid);
    if (s && s.product_id != null) prodIds.add(Number(s.product_id));
  });
  const missingProdIds = Array.from(prodIds).filter(
    (pid) => !productMap.has(pid)
  );
  if (missingProdIds.length) {
    const { data: prods, error: prodsErr } = await supabase
      .from("products")
      .select("id,item,malayalam_name")
      .in("id", missingProdIds);
    if (prodsErr) console.error("ensureSkus: products fetch error", prodsErr);
    (prods || []).forEach((p) => productMap.set(Number(p.id), p));
  }
}

// fmtSkuParts removed - replaced by getSkuLabelParts above

function fmtGodownDisplay(godownId) {
  if (!godownId && godownId !== 0) return "";
  const g = godownMap.get(Number(godownId));
  // Prefer code first (stable short identifier); fall back to name if missing
  return g ? g.code || g.name : String(godownId);
}

function fmtRegionDisplay(regionId) {
  if (!regionId && regionId !== 0) return "";
  const r = regionMap.get(Number(regionId));
  // Prefer region code first (stable) then name as fallback
  return r ? r.code || r.name : String(regionId);
}

function monthFenceStart(today = new Date()) {
  const d = new Date(today);
  const day = d.getDate();
  // Fence: if day>25, start next month’s 1st; else current month’s 1st.
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  if (day > 25) start.setMonth(start.getMonth() + 1);
  return start;
}
function fmtMonthInput(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function addMonths(dt, n) {
  return new Date(dt.getFullYear(), dt.getMonth() + n, 1);
}

/** Safely read the months window from DOM and return { from, to } or nulls */
function getWindowRange() {
  const fromEl = $("fromMonth");
  const toEl = $("toMonth");
  const from = fromEl ? parseMonth(fromEl.value) : null;
  const to = toEl ? parseMonth(toEl.value) : null;
  return { from, to };
}

// Expose some utility helpers to the global scope for debugging / other modules.
// Guarded so this is a no-op in non-browser environments.
if (typeof window !== "undefined") {
  window.ensureRegionsAndGodowns = ensureRegionsAndGodowns;
}

/**
 * Runtime debug helper to inspect SKU and product cache and fetch DB rows.
 * Usage from browser console: await debugSkuProduct(1148)
 */
async function debugSkuProduct(skuId) {
  const sid = Number(skuId);
  console.group(`debugSkuProduct ${sid}`);
  try {
    const cachedSku = skuMap.get(sid);
    console.log("cached sku:", cachedSku);

    const prodId =
      cachedSku && cachedSku.product_id ? Number(cachedSku.product_id) : null;
    console.log("cached product id:", prodId);
    if (prodId) console.log("cached product:", productMap.get(prodId));

    // fetch fresh from DB to compare
    try {
      const { data: skuRows, error: skuErr } = await supabase
        .from("product_skus")
        .select("id,product_id,pack_size,uom,is_active")
        .eq("id", sid);
      if (skuErr) console.warn("db fetch sku error:", skuErr);
      else console.log("db sku rows:", skuRows);
    } catch (e) {
      console.warn("fetch sku failed", e);
    }

    if (prodId) {
      try {
        const { data: prodRows, error: prodErr } = await supabase
          .from("products")
          .select("id,item,malayalam_name,status")
          .eq("id", prodId);
        if (prodErr) console.warn("db fetch product error:", prodErr);
        else console.log("db product rows:", prodRows);
      } catch (e) {
        console.warn("fetch product failed", e);
      }
    }

    // Also inspect baseline effective rows for this SKU to show what the view returns
    try {
      const { data: viewRows, error: viewErr } = await supabase
        .from("v_forecast_baseline_effective")
        .select(
          "sku_id,product_id,region_id,godown_id,month_start,demand_baseline,override_delta,demand_effective"
        )
        .eq("sku_id", sid)
        .limit(10);
      if (viewErr) console.warn("db fetch view error:", viewErr);
      else console.log("view rows (sample):", viewRows);
    } catch (e) {
      console.warn("fetch view failed", e);
    }
  } finally {
    console.groupEnd();
  }
}

if (typeof window !== "undefined") window.debugSkuProduct = debugSkuProduct;

// Expose internal lookup caches to window for debugging in DevTools.
// These are read-only views of in-memory caches and are only attached when
// running in a browser environment so console inspection is possible.
if (typeof window !== "undefined") {
  try {
    window.skuMap = skuMap;
    window.productMap = productMap;
    window.godownMap = godownMap;
    window.regionMap = regionMap;
    // expose loadLookups for manual refresh from console
    window.loadLookups = loadLookups;
    // helper to query the catalog view for a product id
    window.findCatalogProduct = async (pid) => {
      try {
        const { data, error } = await supabase
          .from("v_sku_catalog_enriched")
          .select("sku_id,product_id,item,sku_label,pack_size,uom")
          .eq("product_id", pid);
        console.log("catalog rows:", data, "error:", error);
        return { data, error };
      } catch (e) {
        console.warn("findCatalogProduct failed", e);
        return { data: null, error: e };
      }
    };
  } catch {
    // ignore failures in non-browser contexts
  }
}

function setStatus(el, text, css = "") {
  el.textContent = text || "";
  el.className = `status ${css}`.trim();
}

/** Show an import validation modal listing invalid rows and errors (and skipped count) */
function showImportValidationModal({ validCount, invalidRows, skippedCount }) {
  const existing = document.getElementById("importValidationModal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "importValidationModal";
  modal.style = `position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:9999;`;

  const card = document.createElement("div");
  card.style = `background:#fff;padding:16px;border-radius:8px;max-width:780px;width:92%;max-height:80vh;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.2);font-family:inherit`;
  const title = document.createElement("h3");
  title.textContent = `Import blocked: ${invalidRows.length} invalid rows`;
  card.appendChild(title);

  const info = document.createElement("div");
  info.style = "margin-bottom:8px;color:#333;";
  info.textContent = `Valid rows: ${validCount}. Skipped (no delta): ${skippedCount}. Invalid rows: ${invalidRows.length}.`;
  card.appendChild(info);

  const list = document.createElement("pre");
  list.style =
    "background:#f7f7f8;padding:8px;border-radius:6px;overflow:auto;font-size:0.9rem;";
  list.textContent = invalidRows
    .slice(0, 200)
    .map((r) => `row ${r.row}: ${r.errors.join(", ")}`)
    .join("\n");
  card.appendChild(list);

  const btnRow = document.createElement("div");
  btnRow.style =
    "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;";
  const copy = document.createElement("button");
  copy.className = "btn";
  copy.textContent = "Copy details";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(list.textContent || "");
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy details"), 1500);
    } catch (e) {
      showModalError("Copy failed: " + e.message);
    }
  });
  btnRow.appendChild(copy);

  const close = document.createElement("button");
  close.className = "btn";
  close.textContent = "Close";
  close.addEventListener("click", () => modal.remove());
  btnRow.appendChild(close);

  card.appendChild(btnRow);
  modal.appendChild(card);
  document.body.appendChild(modal);
}

/** import validation modal (implemented above) */

/** Init default window */
function initWindow() {
  // Ensure selectors exist synchronously before attempting to set values
  try {
    ensureMonthSelectors();
  } catch (e) {
    console.warn("initWindow: ensureMonthSelectors failed", e);
  }
  const start = monthFenceStart();
  const end = addMonths(start, 2); // default 3 months
  const fromEl = $("fromMonth");
  const toEl = $("toMonth");
  if (!fromEl || !toEl) {
    // Be defensive: some embed contexts may not include the month inputs.
    // Set whichever exists and warn instead of throwing.
    if (!fromEl) console.warn("initWindow: fromMonth input not found");
    if (!toEl) console.warn("initWindow: toMonth input not found");
    if (fromEl) fromEl.value = fmtMonthInput(start);
    if (toEl) toEl.value = fmtMonthInput(end);
    return;
  }
  fromEl.value = fmtMonthInput(start);
  toEl.value = fmtMonthInput(end);
}

/** Ensure the from/to month selectors exist in the toolbar; if missing, insert them */
function ensureMonthSelectors() {
  let fromEl = $("fromMonth");
  let toEl = $("toMonth");
  if (fromEl && toEl) return; // already present

  // Prepare container and inputs (create only if missing)
  const container = document.createElement("div");
  container.className = "month-selectors";
  container.style = "display:inline-flex;align-items:center;gap:6px;";

  const label = document.createElement("label");
  label.className = "small muted";
  label.textContent = "Months window:";
  container.appendChild(label);

  if (!fromEl) {
    fromEl = document.createElement("input");
    fromEl.type = "month";
    fromEl.id = "fromMonth";
  }
  container.appendChild(fromEl);

  const arrow = document.createElement("span");
  arrow.innerHTML = "&nbsp;&rarr;&nbsp;";
  container.appendChild(arrow);

  if (!toEl) {
    toEl = document.createElement("input");
    toEl.type = "month";
    toEl.id = "toMonth";
  }
  container.appendChild(toEl);

  // Determine insertion target: prefer .toolbar, then header, then body
  const toolbar = document.querySelector(".toolbar");
  const header = document.querySelector("header");
  const target = toolbar || header || document.body;
  try {
    target.insertBefore(container, target.firstChild);
  } catch {
    // if insertion fails, append as fallback
    target.appendChild(container);
  }

  // Wire change events to refresh views
  fromEl.addEventListener("change", () => {
    loadStaging();
    loadActive();
  });
  toEl.addEventListener("change", () => {
    loadStaging();
    loadActive();
  });
}

/** Export baseline forecast filtered by godown_id and months window */
async function exportBaselineForGodown(godownId) {
  const { from, to } = getWindowRange();
  if (!from || !to) {
    await showModalInfo("Please set a valid Months window.");
    return;
  }

  // Page through the baseline view in chunks to avoid row caps
  const chunk = 1000;
  let allData = [];
  let offset = 0;
  // show a loading state on active pager to indicate progress
  window.__DO_loading_active = true;
  const activePagerEl = $("activePager");
  if (activePagerEl) activePagerEl.textContent = "Loading…";
  ["activePrev", "activeNext", "activePageSize"].forEach((id) => {
    const e = $(id);
    if (e) e.disabled = true;
  });

  // Columns to request from the baseline view. Keep this list limited to
  // columns that exist in v_marketing_baseline_export to avoid server errors.
  const queryCols = [
    "sku_id",
    "region_id",
    "godown_id",
    "month_start",
    "baseline_demand",
    // note column not present in v_marketing_baseline_export; leave empty in CSV
  ];

  // Desired CSV header order (we'll derive product/pack/uom from skuMap)
  const csvHeaders = [
    "sku_id",
    "product",
    "pack_size",
    "uom",
    "region_id",
    "region_code",
    "godown_id",
    "godown_code",
    "month_start",
    "month",
    "baseline_demand",
    "delta_units",
    "note",
  ];

  try {
    while (true) {
      const { data, error } = await supabase
        .from("v_marketing_baseline_export")
        .select(queryCols.join(","))
        .eq("godown_id", godownId)
        .gte("month_start", from)
        .lte("month_start", to)
        .range(offset, offset + chunk - 1);

      if (error) {
        await showModalError("Failed to fetch baseline: " + error.message);
        return;
      }
      if (!data || !data.length) break;
      allData = allData.concat(data);
      if (data.length < chunk) break;
      offset += chunk;
    }

    // Ensure skuMap/productMap contains any SKU metadata needed for the export.
    try {
      const missing = new Set();
      (allData || []).forEach((r) => {
        const sid = r && r.sku_id != null ? Number(r.sku_id) : null;
        if (sid != null && !skuMap.has(sid)) missing.add(sid);
      });
      if (missing.size) {
        // Fetch catalog entries for missing SKUs
        const ids = Array.from(missing);
        try {
          const { data: catalogRows, error: catErr } = await supabase
            .from("v_sku_catalog_enriched")
            .select(
              "sku_id,product_id,item,malayalam_name,status,uom_base,conversion_to_base,pack_size,uom,is_active,sku_label"
            )
            .in("sku_id", ids)
            .limit(1000);
          if (catErr)
            console.warn(
              "exportBaselineForGodown: catalog fetch failed",
              catErr
            );
          (catalogRows || []).forEach((s) => {
            const norm = {
              sku_id: Number(s.sku_id),
              product_id: s.product_id == null ? null : Number(s.product_id),
              item: s.item,
              malayalam_name: s.malayalam_name,
              status: s.status,
              uom_base: s.uom_base,
              conversion_to_base: s.conversion_to_base,
              pack_size: s.pack_size,
              uom: s.uom,
              is_active: s.is_active,
              sku_label: s.sku_label,
            };
            skuMap.set(Number(s.sku_id), norm);
            if (norm.product_id && !productMap.has(norm.product_id)) {
              productMap.set(norm.product_id, {
                id: norm.product_id,
                item: norm.item || "",
                malayalam_name: norm.malayalam_name || "",
              });
            }
          });
        } catch (e) {
          console.warn(
            "exportBaselineForGodown: exception fetching catalog",
            e
          );
        }
      }
    } catch (e) {
      console.warn("exportBaselineForGodown: ensure catalog error", e);
    }

    const headers = csvHeaders.map((c) => c);
    const rows = (allData || []).map((r) => {
      const sku = skuMap.get(Number(r.sku_id));
      const prod =
        sku && sku.product_id != null
          ? productMap.get(Number(sku.product_id))
          : null;
      const productName = prod
        ? prod.item || prod.malayalam_name || `Product #${prod.id}`
        : "";
      const pack = sku ? sku.pack_size || "" : "";
      const uom = sku ? sku.uom || "" : "";
      const region = regionMap.get(Number(r.region_id));
      const godown = godownMap.get(Number(r.godown_id));
      const monthLabel = (() => {
        try {
          const d = new Date(r.month_start);
          return d.toLocaleString("en-US", { month: "short", year: "numeric" });
        } catch {
          return "";
        }
      })();

      return [
        csvEscape(r.sku_id),
        csvEscape(productName),
        csvEscape(pack),
        csvEscape(uom),
        csvEscape(r.region_id),
        csvEscape(region ? region.code || region.name : ""),
        csvEscape(r.godown_id),
        csvEscape(godown ? godown.code || godown.name : ""),
        csvEscape(r.month_start),
        csvEscape(monthLabel),
        csvEscape(r.baseline_demand != null ? r.baseline_demand : r.y_hat),
        csvEscape(r.delta_units != null ? r.delta_units : ""),
        csvEscape(r.note || ""),
      ].join(",");
    });

    const csv = [headers.map(csvEscape).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    a.download = `${stamp}_baseline_godown_${godownId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    window.__DO_loading_active = false;
    ["activePrev", "activeNext", "activePageSize"].forEach((id) => {
      const e = $(id);
      if (e) e.disabled = false;
    });
    if (activePagerEl)
      activePagerEl.textContent = `Page ${window.__DO_activePage || 1} / 1`;
  }
}

/** Load tables */
async function loadStaging() {
  const { from, to } = getWindowRange();
  // server-side pagination
  const pageSize = window.__DO_pageSize || 50; // default page size
  const page = window.__DO_stagingPage || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  // set loading state for staging (disable pager controls) and show loading label
  window.__DO_loading_staging = true;
  const pager = $("stagingPager");
  if (pager) pager.textContent = "Loading…";
  ["stagingPrev", "stagingNext", "stagingPageSize"].forEach((id) => {
    const e = $(id);
    if (e) e.disabled = true;
  });

  // Build query and apply filters
  const prodFilterEl = $("filterProduct");
  const regionFilterEl = $("filterRegion");
  const godownFilterEl = $("filterGodown");
  const monthFilterEl = $("filterMonth");
  const deltaOpEl = $("filterDeltaOp");
  const deltaVal1El = $("filterDeltaVal1");
  const deltaVal2El = $("filterDeltaVal2");

  const prodId =
    prodFilterEl && prodFilterEl.value ? Number(prodFilterEl.value) : null;
  const regionId =
    regionFilterEl && regionFilterEl.value
      ? Number(regionFilterEl.value)
      : null;
  const godownId =
    godownFilterEl && godownFilterEl.value
      ? Number(godownFilterEl.value)
      : null;
  const monthStart =
    monthFilterEl && monthFilterEl.value ? `${monthFilterEl.value}-01` : null;
  const deltaOp = deltaOpEl && deltaOpEl.value ? String(deltaOpEl.value) : null;
  const deltaVal1 =
    deltaVal1El && deltaVal1El.value !== "" ? Number(deltaVal1El.value) : null;
  const deltaVal2 =
    deltaVal2El && deltaVal2El.value !== "" ? Number(deltaVal2El.value) : null;

  let q = supabase
    .from("marketing_overrides_staging")
    .select(
      "id,sku_id,region_id,godown_id,month_start,delta_units,note,uploaded_by,uploaded_at",
      { count: "exact" }
    );

  // Apply product -> sku_id filter by mapping product id to skus in skuMap
  if (prodId) {
    const skuIds = Array.from(skuMap.entries())
      .filter(
        ([, v]) => v && v.product_id != null && Number(v.product_id) === prodId
      )
      .map(([k]) => Number(k));
    if (!skuIds.length) {
      // No SKUs for selected product — render empty table quickly
      const tbody = $("tblStaging").querySelector("tbody");
      tbody.innerHTML = "";
      $("stagingCounts").textContent = `0 of 0 in window`;
      if (pager) pager.textContent = `Page ${page} / 1`;
      window.__DO_loading_staging = false;
      ["stagingPrev", "stagingNext", "stagingPageSize"].forEach((id) => {
        const e = $(id);
        if (e) e.disabled = false;
      });
      return;
    }
    q = q.in("sku_id", skuIds);
  }

  if (regionId) q = q.eq("region_id", regionId);
  if (godownId) q = q.eq("godown_id", godownId);
  if (monthStart) q = q.eq("month_start", monthStart);

  // delta operator
  if (deltaOp && deltaVal1 != null) {
    if (deltaOp === "lt") q = q.lt("delta_units", deltaVal1);
    else if (deltaOp === "gt") q = q.gt("delta_units", deltaVal1);
    else if (deltaOp === "between" && deltaVal2 != null) {
      const lo = Math.min(deltaVal1, deltaVal2);
      const hi = Math.max(deltaVal1, deltaVal2);
      q = q.gte("delta_units", lo).lte("delta_units", hi);
    }
  }

  // ordering & pagination
  q = q
    .order("month_start", { ascending: true })
    .order("sku_id", { ascending: true })
    .range(start, end);

  let data, error, count;
  try {
    const res = await q;
    data = res.data;
    error = res.error;
    count = res.count;
    if (error) {
      throw error;
    }
  } catch (err) {
    console.error(err);
    setStatus($("stagingCounts"), "Failed to load staging", "danger");
    window.__DO_loading_staging = false;
    ["stagingPrev", "stagingNext", "stagingPageSize"].forEach((id) => {
      const e = $(id);
      if (e) e.disabled = false;
    });
    if (pager) pager.textContent = `Page ${page} / 1`;
    return;
  }
  // Filter to window in JS (the DB filtering could be applied but keeping same semantics)
  const allFetched = data || [];
  const rows = allFetched.filter((r) => {
    if (!from || !to) return true;
    return r.month_start >= from && r.month_start <= to;
  });

  // Ensure lookups exist for SKUs referenced in this dataset
  await ensureSkusAndProductsForIds(rows.map((r) => r.sku_id));

  const tbody = $("tblStaging").querySelector("tbody");
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const skuParts = getSkuLabelParts(r.sku_id);
    tr.innerHTML = `
      <td class="nowrap mono">${fmtInt(r.id)}</td>
      <td>${skuParts.item}</td>
      <td>${skuParts.pack}</td>
      <td>${skuParts.uom}</td>
      <td>${fmtRegionDisplay(r.region_id)}</td>
      <td>${fmtGodownDisplay(r.godown_id)}</td>
  <td>${fmtMonthLabel(r.month_start)}</td>
      <td class="right nowrap mono">${fmtNum(r.delta_units)}</td>
      <td>${r.note || ""}</td>
      <td class="center">
        <div class="action-menu" style="position:relative;display:inline-block">
          <button class="icon-toggle" data-menu-toggle data-id="${
            r.id
          }" title="Actions">⋯</button>
          <div class="action-menu-panel" style="display:none;">
            <button class="action-btn" data-action="delete" data-id="${
              r.id
            }" title="Delete" aria-label="Delete">${SVG_TRASH}</button>
            <button class="action-btn" data-action="edit" data-id="${
              r.id
            }" title="Edit" aria-label="Edit">${SVG_PENCIL}</button>
            <button class="action-btn" data-action="promote" data-id="${
              r.id
            }" title="Promote" aria-label="Promote">${SVG_PROMOTE}</button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
    // wire per-row menu toggle (close others when opening)
    const toggle = tr.querySelector("[data-menu-toggle]");
    const panel = tr.querySelector(".action-menu-panel");
    if (toggle && panel) {
      toggle.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // close other panels
        document.querySelectorAll(".action-menu-panel").forEach((p) => {
          if (p !== panel) p.style.display = "none";
        });
        // toggle: if already visible, hide and clear fixed positioning
        if (panel.style.display === "flex") {
          panel.style.display = "none";
          panel.style.position = "";
          panel.style.left = "";
          panel.style.top = "";
          panel.style.zIndex = "";
          return;
        }
        // show using fixed positioning to avoid clipping by overflow parents
        positionPanelFixed(panel, toggle);
      });
    }
  });
  // Show windowed count and total count (from count if present)
  const stagingTotal = typeof count === "number" ? count : (data || []).length;
  $(
    "stagingCounts"
  ).textContent = `${rows.length} of ${stagingTotal} in window`;
  // update pager display
  const totalPages = Math.max(1, Math.ceil((stagingTotal || 0) / pageSize));
  // range text removed to save horizontal space; pager label already updated above (stagingPager)

  // finalize staging pager and controls
  window.__DO_loading_staging = false;
  const sprev = $("stagingPrev");
  const snext = $("stagingNext");
  if (sprev) sprev.disabled = page <= 1;
  if (snext) snext.disabled = page >= totalPages;
  const spSize = $("stagingPageSize");
  if (spSize) spSize.disabled = false;
  if (pager) pager.textContent = `Page ${page} / ${totalPages}`;
  // Wire row actions: delete, edit, promote
  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id);
    const tr = btn.closest("tr");
    // find the row data from rows by id
    const rowData = rows.find((x) => Number(x.id) === id);
    if (!rowData) return;

    if (action === "delete") {
      btn.addEventListener("click", async () => {
        if (!(await showModalConfirm("Delete this staging row?"))) return;
        const { error } = await supabase
          .from("marketing_overrides_staging")
          .delete()
          .eq("id", id);
        if (error) await showModalError("Delete failed: " + error.message);
        await loadStaging();
      });
    }

    if (action === "promote") {
      btn.addEventListener("click", async () => {
        if (
          !(await showModalConfirm(
            "Promote this staging row to active overrides?"
          ))
        )
          return;
        // Upsert into forecast_demand_overrides
        const payload = [
          {
            sku_id: rowData.sku_id,
            region_id: rowData.region_id,
            godown_id: rowData.godown_id,
            month_start: rowData.month_start,
            delta_units: rowData.delta_units,
            reason: rowData.note || "Promoted from staging",
            is_active: true,
            updated_at: new Date().toISOString(),
          },
        ];
        try {
          const up = await supabase
            .from("forecast_demand_overrides")
            .upsert(payload, {
              onConflict: "sku_id,region_id,godown_id,month_start",
            });

          // Ensure local caches include this SKU/product after promoting
          try {
            await ensureSkusAndProductsForIds([rowData.sku_id]);
          } catch (e) {
            // non-fatal: we attempted to fetch missing lookups
            console.debug("ensureSkusAndProductsForIds error", e);
          }

          if (up.error) {
            await showModalError("Promote failed: " + up.error.message);
            return;
          }

          // success path
          await showModalInfo("Promoted successfully.");
          loadActive();
          loadStaging();
          loadBaseline();
        } catch (e) {
          await showModalError("Promote failed: " + (e.message || e));
        }
      });
    }

    if (action === "edit") {
      btn.addEventListener("click", () => {
        // Inline edit: replace delta and note cells with inputs and offer Save/Cancel
        const deltaTd = tr.children[7];
        const noteTd = tr.children[8];
        const actionsTd = tr.children[9];
        const curDelta = rowData.delta_units == null ? "" : rowData.delta_units;
        const curNote = rowData.note || "";
        // create inputs
        deltaTd.innerHTML = `<input type="number" step="1" style="width:6rem" value="${String(
          curDelta
        )}">`;
        noteTd.innerHTML = `<input type="text" style="width:12rem" value="${String(
          curNote
        ).replace(/"/g, "&quot;")}">`;
        actionsTd.innerHTML = "";
        const wrap = document.createElement("div");
        wrap.className = "inline-edit-actions";
        const saveBtn = document.createElement("button");
        saveBtn.className = "btn primary";
        saveBtn.title = "Save";
        // use transparent background so icon color follows currentColor; size kept compact
        // set color to app primary so the filled SVG (currentColor) is visible on white background
        saveBtn.style =
          "width:34px;height:34px;padding:6px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;color:var(--primary,#2563eb)";
        saveBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-save" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1z"/>
          </svg>`;
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn cancel";
        cancelBtn.title = "Cancel";
        cancelBtn.style =
          "width:34px;height:34px;padding:6px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;color:var(--muted,#6b7280)";
        cancelBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" fill="currentColor" />
          </svg>`;
        wrap.appendChild(saveBtn);
        wrap.appendChild(cancelBtn);
        actionsTd.appendChild(wrap);

        cancelBtn.addEventListener("click", () => loadStaging());

        saveBtn.addEventListener("click", async () => {
          const newDelta = deltaTd.querySelector("input").value;
          const newNote = noteTd.querySelector("input").value;
          if (
            newDelta === "" ||
            Number.isNaN(Number(newDelta)) ||
            !(Math.abs(Number(newDelta)) >= 1)
          ) {
            await showModalInfo("Delta must be a non-zero number (abs >= 1).");
            return;
          }
          const { error } = await supabase
            .from("marketing_overrides_staging")
            .update({ delta_units: Number(newDelta), note: newNote || null })
            .eq("id", id);
          if (error) {
            await showModalError("Update failed: " + error.message);
          } else {
            await loadStaging();
          }
        });
      });
    }
  });
}

// Pagination controls for staging
// Improved pagination defaults & state
window.__DO_pageSize = window.__DO_pageSize || 50; // default to 50 for modern UI
window.__DO_stagingPage = window.__DO_stagingPage || 1;
window.__DO_activePage = window.__DO_activePage || 1;
window.__DO_loading = false;
window.__DO_baselinePage = window.__DO_baselinePage || 1;

async function stagingPrevPage() {
  if (window.__DO_stagingPage > 1) {
    window.__DO_stagingPage -= 1;
    await loadStaging();
  }
}
async function stagingNextPage() {
  window.__DO_stagingPage += 1;
  await loadStaging();
}

// Pagination state for baseline slab
async function baselinePrevPage() {
  if (window.__DO_baselinePage > 1) {
    window.__DO_baselinePage -= 1;
    await loadBaseline();
  }
}
async function baselineNextPage() {
  window.__DO_baselinePage += 1;
  await loadBaseline();
}

async function loadActive() {
  const { from, to } = getWindowRange();
  // server-side pagination for active/promoted overrides
  const pageSize = window.__DO_pageSize || 50;
  const page = window.__DO_activePage || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  // set loading state (disable active pager controls)
  window.__DO_loading = true;
  ["activePrev", "activeNext", "activePageSize"].forEach((id) => {
    const e = $(id);
    if (e) e.disabled = true;
  });

  const { data, error, count } = await supabase
    .from("forecast_demand_overrides")
    .select(
      "id,sku_id,region_id,godown_id,month_start,delta_units,reason,updated_at,is_active",
      { count: "exact" }
    )
    .order("month_start", { ascending: true })
    .order("sku_id", { ascending: true })
    .range(start, end);
  if (error) {
    console.error(error);
    setStatus($("activeCounts"), "Failed to load overrides", "danger");
    window.__DO_loading = false;
    ["activePrev", "activeNext", "activePageSize"].forEach((id) => {
      const e = $(id);
      if (e) e.disabled = false;
    });
    // reset pager label so Loading... doesn't persist
    const apg = $("activePager");
    if (apg) apg.textContent = `Page ${page} / 1`;
    return;
  }
  // Filter to the months window
  let rows = (data || []).filter((r) => {
    if (!from || !to) return true;
    return r.month_start >= from && r.month_start <= to;
  });

  // Ensure inactive rows are shown but moved after active rows.
  // Sort by: is_active (active first), month_start asc, sku_id asc
  rows.sort((a, b) => {
    const aActive = a.is_active ? 1 : 0;
    const bActive = b.is_active ? 1 : 0;
    if (bActive - aActive !== 0) return bActive - aActive; // active (1) before inactive (0)
    const ma = new Date(a.month_start).getTime();
    const mb = new Date(b.month_start).getTime();
    if (ma !== mb) return ma - mb;
    const sa = Number(a.sku_id || 0);
    const sb = Number(b.sku_id || 0);
    return sa - sb;
  });

  // Ensure lookups exist for SKUs referenced in this dataset
  await ensureSkusAndProductsForIds(rows.map((r) => r.sku_id));

  const tbody = $("tblActive").querySelector("tbody");
  tbody.innerHTML = "";
  // Keep a map of rows by id so action handlers can inspect fields (sku_id, region_id, etc.)
  const rowsMap = new Map();
  rows.forEach((r) => {
    rowsMap.set(Number(r.id), r);
    const tr = document.createElement("tr");
    const skuParts = getSkuLabelParts(r.sku_id);
    if (r.is_active === false) tr.classList.add("inactive-row");
    tr.innerHTML = `
      <td>${skuParts.item}</td>
      <td>${skuParts.pack}</td>
      <td>${skuParts.uom}</td>
      <td>${fmtRegionDisplay(r.region_id)}</td>
      <td>${fmtGodownDisplay(r.godown_id)}</td>
      <td>${fmtMonthLabel(r.month_start)}</td>
      <td class="right nowrap mono">${fmtNum(r.delta_units)}</td>
      <td>${r.reason || ""}</td>
      <td class="center">
        <div class="action-menu" style="position:relative;display:inline-block">
          <button class="icon-toggle" data-menu-toggle data-id="${
            r.id
          }" title="Actions">⋯</button>
          <div class="action-menu-panel" style="display:none;">
            <button class="action-btn" data-action="delete" data-id="${
              r.id
            }" title="Delete" aria-label="Delete">${SVG_TRASH}</button>
            <button class="action-btn toggle ${
              r.is_active ? "active" : "inactive"
            }" data-action="toggle_active" data-id="${r.id}" data-active="${
      r.is_active
    }" title="Toggle active" aria-label="Toggle active" style="color:${
      r.is_active ? "#16a34a" : "#dc2626"
    }">${
      SVG_CHECK_CIRCLE +
      ' <span class="sr-only">' +
      (r.is_active ? "Deactivate" : "Activate") +
      "</span>"
    }</button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // wire per-row menu toggle (close others when opening)
    const toggle = tr.querySelector("[data-menu-toggle]");
    const panel = tr.querySelector(".action-menu-panel");
    if (toggle && panel) {
      toggle.addEventListener("click", (ev) => {
        ev.stopPropagation();
        document.querySelectorAll(".action-menu-panel").forEach((p) => {
          if (p !== panel) p.style.display = "none";
        });
        if (panel.style.display === "flex") {
          panel.style.display = "none";
          panel.style.position = "";
          panel.style.left = "";
          panel.style.top = "";
          panel.style.zIndex = "";
          return;
        }
        positionPanelFixed(panel, toggle);
      });
    }
  });

  // Delegate delete action to tbody to ensure clicks are handled even when
  // the action buttons are recreated or inside panels with display toggles.
  tbody.addEventListener("click", async (ev) => {
    const btn = ev.target.closest && ev.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action !== "delete") return; // we only handle deletes here
    ev.stopPropagation();
    const id = Number(btn.dataset.id);
    const tr = btn.closest("tr");
    if (!(await showModalConfirm("Delete this override row?"))) return;
    const res = await supabase
      .from("forecast_demand_overrides")
      .delete()
      .eq("id", id);
    // log full response for diagnostics (visible in console)
    console.debug("delete response:", res);
    const { data: delData, error } = res;
    if (error) {
      await showModalError("Delete failed: " + error.message);
    } else if (!delData || (Array.isArray(delData) && delData.length === 0)) {
      // No error but nothing was deleted — this can be an RLS/permission issue
      // However, it's possible a policy was added just now and the row is already gone.
      // Check by attempting to fetch the row id; if it's absent, treat as successful.
      try {
        const { data: checkData, error: checkErr } = await supabase
          .from("forecast_demand_overrides")
          .select("id")
          .eq("id", id)
          .limit(1);
        if (!checkErr && (!checkData || checkData.length === 0)) {
          // Row no longer exists → treat as success
          if (tr) tr.remove();
          await Promise.all([loadActive(), loadBaseline()]);
          return;
        }
      } catch (e) {
        console.debug("delete check error", e);
      }

      await showModalError(
        "Delete did not remove any rows. This may be due to database Row Level Security (RLS) or permission policies that prevent the current client from deleting rows. Check the server logs or use a privileged DB connection to delete."
      );
      // still refresh to show canonical state
      await Promise.all([loadActive(), loadBaseline()]);
    } else {
      if (tr) tr.remove();
      await loadActive();
      await loadBaseline();
    }
  });

  // Wire only toggle_active handlers (per-button) — keep existing logic for toggles
  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    if (action !== "toggle_active") return;
    const id = Number(btn.dataset.id);
    const tr = btn.closest("tr");
    // row object from rowsMap (if available)
    const rowObj = typeof rowsMap !== "undefined" ? rowsMap.get(id) : null;

    btn.addEventListener("click", async () => {
      const cur = btn.dataset.active === "true" || btn.dataset.active === "1";
      const newVal = !cur;
      if (newVal) {
        const { error } = await supabase
          .from("forecast_demand_overrides")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (!error) {
          if (tr) tr.classList.remove("inactive-row");
          const toggleBtn = tr.querySelector('[data-action="toggle_active"]');
          if (toggleBtn) {
            toggleBtn.dataset.active = "true";
            toggleBtn.classList.remove("inactive");
            toggleBtn.classList.add("active");
            toggleBtn.style.color = "#16a34a";
            toggleBtn.innerHTML =
              SVG_CHECK_CIRCLE + ' <span class="sr-only">Deactivate</span>';
            toggleBtn.title = "Deactivate";
            toggleBtn.setAttribute("aria-label", "Deactivate");
          }
          await Promise.all([loadActive(), loadBaseline()]);
          return;
        }

        const msg = String(error.message || "");
        if (msg.toLowerCase().includes("duplicate key")) {
          if (!rowObj) {
            await showModalError(
              "Activation failed due to a duplicate active override (conflict)."
            );
            return;
          }
          const { sku_id, region_id, godown_id, month_start } = rowObj;
          const { data: conflict, error: ce } = await supabase
            .from("forecast_demand_overrides")
            .select("id")
            .eq("sku_id", sku_id)
            .eq("region_id", region_id)
            .eq("godown_id", godown_id)
            .eq("month_start", month_start)
            .eq("is_active", true)
            .neq("id", id)
            .limit(1);
          if (ce) {
            await showModalError("Activation failed: " + ce.message);
            return;
          }
          if (!conflict || !conflict.length) {
            await showModalError(
              "Activation failed due to a duplicate active override (conflict), but the conflicting row could not be located."
            );
            return;
          }
          const conf = conflict[0];
          const ok = await showModalConfirm(
            `Another active override exists (id=${conf.id}). Deactivate it and activate this one?`
          );
          if (!ok) return;

          const { error: e1 } = await supabase
            .from("forecast_demand_overrides")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", conf.id);
          if (e1) {
            await showModalError(
              "Failed to deactivate existing override: " + e1.message
            );
            return;
          }
          const { error: e2 } = await supabase
            .from("forecast_demand_overrides")
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq("id", id);
          if (e2) {
            await showModalError("Activation failed: " + e2.message);
            return;
          }

          if (tr) {
            tr.classList.remove("inactive-row");
            const toggleBtn = tr.querySelector('[data-action="toggle_active"]');
            if (toggleBtn) {
              toggleBtn.dataset.active = "true";
              toggleBtn.classList.remove("inactive");
              toggleBtn.classList.add("active");
              toggleBtn.style.color = "#16a34a";
              toggleBtn.innerHTML =
                SVG_CHECK_CIRCLE + ' <span class="sr-only">Deactivate</span>';
              toggleBtn.title = "Deactivate";
              toggleBtn.setAttribute("aria-label", "Deactivate");
            }
          }
          await Promise.all([loadActive(), loadBaseline()]);
          return;
        }

        await showModalError("Toggle failed: " + error.message);
        return;
      }

      const { error } = await supabase
        .from("forecast_demand_overrides")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        await showModalError("Toggle failed: " + error.message);
      } else {
        if (tr) {
          tr.classList.add("inactive-row");
          const toggleBtn = tr.querySelector('[data-action="toggle_active"]');
          if (toggleBtn) {
            toggleBtn.dataset.active = "false";
            toggleBtn.classList.remove("active");
            toggleBtn.classList.add("inactive");
            toggleBtn.style.color = "#dc2626";
            toggleBtn.innerHTML =
              SVG_CHECK_CIRCLE + ' <span class="sr-only">Activate</span>';
            toggleBtn.title = "Activate";
            toggleBtn.setAttribute("aria-label", "Activate");
          }
        }
        await Promise.all([loadActive(), loadBaseline()]);
      }
    });
  });
  // Show windowed count and total count (use count if available)
  const totalCount = typeof count === "number" ? count : (data || []).length;
  const activeCount = rows.filter((r) => r.is_active).length;
  $(
    "activeCounts"
  ).textContent = `${activeCount} of ${rows.length} active in window`;
  // update pager
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const pager = $("activePager");
  if (pager)
    pager.textContent = window.__DO_loading
      ? "Loading…"
      : `Page ${page} / ${totalPages}`;

  window.__DO_loading = false;
  const aprev = $("activePrev");
  const anext = $("activeNext");
  if (aprev) aprev.disabled = page <= 1;
  if (anext) anext.disabled = page >= totalPages;
  const apSize = $("activePageSize");
  if (apSize) apSize.disabled = false;
  // ensure pager label shows final page info (not the Loading... state)
  if (pager) pager.textContent = `Page ${page} / ${totalPages}`;
}

// Pagination state for active slab (improved)
async function activePrevPage() {
  if (window.__DO_activePage > 1) {
    window.__DO_activePage -= 1;
    await loadActive();
  }
}
async function activeNextPage() {
  window.__DO_activePage += 1;
  await loadActive();
}

async function loadBaseline() {
  const { from, to } = getWindowRange();
  const pageSize = window.__DO_pageSize || 50;
  const page = window.__DO_baselinePage || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  // disable baseline pager controls while loading
  window.__DO_loading = true;
  ["baselinePrev", "baselineNext", "baselinePageSize"].forEach((id) => {
    const e = $(id);
    if (e) e.disabled = true;
  });

  let q = supabase
    .from("v_forecast_baseline_effective")
    .select(
      "sku_id,region_id,godown_id,month_start,demand_baseline,override_delta,demand_effective,product_id,item,pack_size,uom,sku_label",
      { count: "exact" }
    )
    .order("month_start", { ascending: true })
    .order("sku_id", { ascending: true })
    .range(start, end);

  // New filters
  // Prefer exact SKU ID filter if supplied; otherwise use the label-based select
  const skuExact = Number($("filterSkuIdExact")?.value || 0);
  const sku = skuExact || Number($("filterSkuId").value || 0);
  const productFilter = Number($("filterProduct").value || 0);
  const reg = Number($("filterRegion").value || 0);
  const gdn = Number($("filterGodown").value || 0);
  const monthFilter = $("filterMonth").value || null;
  const deltaOnly = $("filterDelta").checked;

  // The view now exposes product_id and item/pack_size/uom columns; filter by
  // product_id directly on the view when supplied.
  if (sku) q = q.eq("sku_id", sku);
  if (productFilter) q = q.eq("product_id", productFilter);
  if (reg) q = q.eq("region_id", reg);
  if (gdn) q = q.eq("godown_id", gdn);

  // Apply explicit month filter if present (overrides the global window)
  if (monthFilter) {
    const mstart = parseMonth(monthFilter);
    q = q.eq("month_start", mstart);
  } else {
    // Also apply months window at the server side to ensure counts/pages match window
    if (from) q = q.gte("month_start", from);
    if (to) q = q.lte("month_start", to);
  }

  // If deltaOnly is set, filter to rows where override_delta != 0
  if (deltaOnly) q = q.neq("override_delta", 0);

  const { data, error, count } = await q;
  if (error) {
    console.error(error);
    setStatus($("baselineCounts"), "Failed to load baseline", "danger");
    window.__DO_loading = false;
    ["baselinePrev", "baselineNext", "baselinePageSize"].forEach((id) => {
      const e = $(id);
      if (e) e.disabled = false;
    });
    // reset pager label so Loading... doesn't persist
    const bpgErr = $("baselinePager");
    if (bpgErr) bpgErr.textContent = `Page ${page} / 1`;
    return;
  }
  const rows = data || [];

  const tbody = $("tblBaseline").querySelector("tbody");
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    // Use metadata supplied by the view directly
    const itemLabel = r.item || "";
    const pack = r.pack_size || "";
    const uom = r.uom || "";
    const skuLabel = r.sku_label || `${r.sku_id} ${itemLabel} ${pack} ${uom}`;
    tr.innerHTML = `
      <td class="nowrap mono">${fmtInt(r.sku_id)}</td>
      <td title="${htmlEscape(skuLabel)}">${htmlEscape(itemLabel)}</td>
      <td>${htmlEscape(pack)}</td>
      <td>${htmlEscape(uom)}</td>
      <td>${fmtRegionDisplay(r.region_id)}</td>
      <td>${fmtGodownDisplay(r.godown_id)}</td>
  <td>${fmtMonthLabel(r.month_start)}</td>
      <td class="right">${fmtNum(r.demand_baseline)}</td>
      <td class="right nowrap mono">${fmtNum(r.override_delta)}</td>
      <td class="right">${fmtNum(r.demand_effective)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Compute totals for display: total rows (baselineTotal) and rows with active (non-zero) overrides
  const baselineTotal = typeof count === "number" ? count : rows.length;
  let overridesCount = 0;
  try {
    let qcount = supabase
      .from("v_forecast_baseline_effective")
      .select("override_delta", { head: true, count: "exact" });
    if (sku) qcount = qcount.eq("sku_id", sku);
    else if (productFilter) qcount = qcount.eq("product_id", productFilter);
    if (reg) qcount = qcount.eq("region_id", reg);
    if (gdn) qcount = qcount.eq("godown_id", gdn);
    if (from) qcount = qcount.gte("month_start", from);
    if (to) qcount = qcount.lte("month_start", to);
    qcount = qcount.neq("override_delta", 0);
    const { error: oerr, count: oc } = await qcount;
    if (!oerr && typeof oc === "number") overridesCount = oc;
  } catch (e) {
    console.warn("Failed to compute overrides count", e);
  }

  $(
    "baselineCounts"
  ).textContent = `${overridesCount} of ${baselineTotal} with active overrides delta`;
  // Update compact pager label (Page X / Y)
  const totalPages = Math.max(1, Math.ceil((baselineTotal || 0) / pageSize));
  const bpg = $("baselinePager");
  if (bpg)
    bpg.textContent = window.__DO_loading
      ? "Loading…"
      : `Page ${page} / ${totalPages}`;

  window.__DO_loading = false;
  const bprev = $("baselinePrev");
  const bnext = $("baselineNext");
  if (bprev) bprev.disabled = page <= 1;
  if (bnext) bnext.disabled = page >= totalPages;
  const bpSize = $("baselinePageSize");
  if (bpSize) bpSize.disabled = false;
  // ensure pager label shows final page info (not the Loading... state)
  if (bpg) bpg.textContent = `Page ${page} / ${totalPages}`;
}

/** Add one manual row to staging (modal with human-readable selects) */
async function addRow() {
  // Ensure lookups are loaded so we can render selects
  try {
    await loadLookups();
  } catch (e) {
    console.warn("addRow: loadLookups failed", e);
  }

  // Remove any existing modal
  const existing = document.getElementById("addRowModal");
  if (existing) existing.remove();

  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.id = "addRowModal";
    modal.style = `position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:9999;`;

    const card = document.createElement("div");
    card.style = `background:#fff;padding:16px;border-radius:8px;max-width:780px;width:92%;max-height:80vh;overflow:auto;overflow-x:hidden;box-sizing:border-box;box-shadow:0 8px 24px rgba(0,0,0,.2);font-family:inherit`;

    const title = document.createElement("h3");
    title.textContent = "Add staging row";
    title.style =
      "margin:0 0 12px;font-size:1.15rem;color:var(--primary,#1f6feb)";
    card.appendChild(title);

    const form = document.createElement("div");
    form.style =
      "display:grid;grid-template-columns:repeat(2,1fr);gap:12px;align-items:start;";

    const mkField = (labelText, innerEl) => {
      const wrap = document.createElement("div");
      // allow grid items to shrink to prevent overflow
      wrap.style = "display:flex;flex-direction:column;gap:6px;min-width:0;";
      const label = document.createElement("label");
      label.textContent = labelText;
      label.className = "small muted";
      label.style = "font-weight:600;color:#374151;font-size:0.9rem";
      // ensure inputs/selects fit inside the grid cell
      innerEl.style.cssText =
        (innerEl.style.cssText || "") +
        ";box-sizing:border-box;width:100%;max-width:100%;padding:10px 12px;border:1px solid #e6e6ea;border-radius:8px;background:#fff;font-size:0.95rem;overflow:hidden";
      wrap.appendChild(label);
      wrap.appendChild(innerEl);
      return wrap;
    };

    // Product select (human readable)
    const prodSelect = document.createElement("select");
    prodSelect.id = "add_product";
    prodSelect.style = "width:100%";
    prodSelect.innerHTML = `<option value="">-- Select product --</option>`;
    // Populate products sorted by name
    const products = Array.from(productMap.entries()).map(([id, p]) => ({
      id,
      name: p.item || p.malayalam_name || `Product #${id}`,
    }));
    products.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    products.forEach((p) =>
      prodSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${p.id}">${p.name}</option>`
      )
    );

    // Pack select (depends on product) and UOM select
    const packSelect = document.createElement("select");
    packSelect.id = "add_pack";
    packSelect.style = "width:100%";
    packSelect.innerHTML = `<option value="">-- Select pack --</option>`;

    // UOM select (populated after pack selection)
    const uomSelect = document.createElement("select");
    uomSelect.id = "add_uom";
    uomSelect.style = "width:100%";
    uomSelect.innerHTML = `<option value="">-- Select UOM --</option>`;

    // Region select
    const regionSelect = document.createElement("select");
    regionSelect.id = "add_region";
    regionSelect.style = "width:100%";
    regionSelect.innerHTML = `<option value="">-- Select region --</option>`;
    const regions = Array.from(regionMap.entries()).map(([id, r]) => ({
      id,
      code: r.code || r.name || `Region #${id}`,
    }));
    regions.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
    regions.forEach((r) =>
      regionSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${r.id}">${r.code}</option>`
      )
    );

    // Godown select (depends on region)
    const godownSelect = document.createElement("select");
    godownSelect.id = "add_godown";
    godownSelect.style = "width:100%";
    godownSelect.innerHTML = `<option value="">-- Select godown --</option>`;

    // Month, delta, note
    const monthInput = document.createElement("input");
    monthInput.type = "month";
    monthInput.id = "add_month";
    monthInput.style = "width:100%";
    // default to fromMonth if present or current fence
    monthInput.value =
      ($("fromMonth") && $("fromMonth").value) ||
      fmtMonthInput(monthFenceStart());

    const deltaInput = document.createElement("input");
    deltaInput.type = "number";
    deltaInput.step = "1";
    deltaInput.id = "add_delta";
    deltaInput.style = "width:100%";

    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.id = "add_note";
    noteInput.placeholder = "optional";
    noteInput.style = "width:100%";

    // Append fields to form
    form.appendChild(mkField("Product", prodSelect));
    form.appendChild(mkField("Pack Size", packSelect));
    form.appendChild(mkField("UOM", uomSelect));
    form.appendChild(mkField("Region", regionSelect));
    form.appendChild(mkField("Godown", godownSelect));
    form.appendChild(mkField("Month", monthInput));
    form.appendChild(mkField("Delta units", deltaInput));
    form.appendChild(mkField("Note", noteInput));

    card.appendChild(form);

    const btnRow = document.createElement("div");
    btnRow.style =
      "display:flex;gap:8px;justify-content:flex-end;margin-top:16px;padding-top:8px;border-top:1px solid #f4f4f6";
    const cancel = document.createElement("button");
    cancel.className = "btn";
    cancel.style =
      "padding:8px 12px;border-radius:8px;border:1px solid #e6e6ea;background:#fff;color:#374151";
    cancel.textContent = "Cancel";
    const save = document.createElement("button");
    save.className = "btn primary";
    save.style =
      "padding:8px 14px;border-radius:8px;background:#2563eb;border-color:#1d4ed8;color:#fff";
    save.textContent = "Save";
    btnRow.appendChild(cancel);
    btnRow.appendChild(save);
    card.appendChild(btnRow);
    modal.appendChild(card);
    document.body.appendChild(modal);

    // Helper: populate packSelect for a product id (distinct pack_size values)
    const populatePacksForProduct = (productId) => {
      packSelect.innerHTML = `<option value="">-- Select pack --</option>`;
      uomSelect.innerHTML = `<option value="">-- Select UOM --</option>`;
      const skus = Array.from(skuMap.values()).filter(
        (s) => Number(s.product_id) === Number(productId)
      );
      const packs = Array.from(
        new Set(
          skus.map((s) => (s.pack_size == null ? "" : String(s.pack_size)))
        )
      )
        .filter((p) => p !== "")
        .sort((a, b) => a.localeCompare(b));
      packs.forEach((p) =>
        packSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${htmlEscape(p)}">${htmlEscape(p)}</option>`
        )
      );
    };

    // Helper: populate uomSelect for product + pack combination
    const populateUomsForPack = (productId, packSize) => {
      uomSelect.innerHTML = `<option value="">-- Select UOM --</option>`;
      const skus = Array.from(skuMap.values()).filter(
        (s) =>
          Number(s.product_id) === Number(productId) &&
          String(s.pack_size) === String(packSize)
      );
      const uoms = Array.from(new Set(skus.map((s) => s.uom || "")))
        .filter((u) => u !== "")
        .sort((a, b) => a.localeCompare(b));
      uoms.forEach((u) =>
        uomSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${htmlEscape(u)}">${htmlEscape(u)}</option>`
        )
      );
      if (uoms.length === 1) uomSelect.value = uoms[0];
    };

    // Helper: populate godownSelect for a region id
    const populateGodownsForRegion = (regionId) => {
      godownSelect.innerHTML = `<option value="">-- Select godown --</option>`;
      const gds = Array.from(godownMap.entries())
        .map(([id, g]) => ({ id, ...g }))
        .filter((g) => Number(g.region_id) === Number(regionId));
      gds.sort((a, b) =>
        String(a.code || a.name || "").localeCompare(b.code || b.name || "")
      );
      gds.forEach((g) =>
        godownSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${g.id}">${g.code || g.name}</option>`
        )
      );
    };

    // Wire changes
    prodSelect.addEventListener("change", async () => {
      const pid = prodSelect.value ? Number(prodSelect.value) : null;
      if (pid) {
        // If skuMap doesn't have any SKUs for this product, fetch them on-demand
        const hasSkuForProduct = Array.from(skuMap.values()).some(
          (s) => Number(s.product_id) === Number(pid)
        );
        if (!hasSkuForProduct) {
          // show a small loading hint for packs
          packSelect.innerHTML = `<option value="">Loading packs…</option>`;
          uomSelect.innerHTML = `<option value="">-- Select UOM --</option>`;
          try {
            const { data: skusData, error: skusErr } = await supabase
              .from("product_skus")
              .select("id,product_id,pack_size,uom,is_active")
              .eq("product_id", pid);
            if (skusErr) {
              console.warn("prodSelect: fetch product_skus error", skusErr);
            } else {
              (skusData || []).forEach((s) => {
                const norm = {
                  ...s,
                  product_id:
                    s.product_id == null ? null : Number(s.product_id),
                };
                skuMap.set(Number(s.id), norm);
              });
            }
          } catch (e) {
            console.warn("prodSelect: exception fetching skus", e);
          }
        }
        populatePacksForProduct(pid);
      } else {
        packSelect.innerHTML = `<option value="">-- Select pack --</option>`;
        uomSelect.innerHTML = `<option value="">-- Select UOM --</option>`;
      }
    });

    // When pack changes, populate UOMs for the selection
    packSelect.addEventListener("change", () => {
      const pid = prodSelect.value ? Number(prodSelect.value) : null;
      const pack = packSelect.value || null;
      if (pid && pack) populateUomsForPack(pid, pack);
      else uomSelect.innerHTML = `<option value="">-- Select UOM --</option>`;
    });

    regionSelect.addEventListener("change", () => {
      const rid = regionSelect.value ? Number(regionSelect.value) : null;
      if (rid) populateGodownsForRegion(rid);
      else
        godownSelect.innerHTML = `<option value="">-- Select godown --</option>`;
    });

    // Cancel
    cancel.addEventListener("click", () => {
      modal.remove();
      resolve();
    });

    // Save handler: validate and upsert
    save.addEventListener("click", async () => {
      // Resolve sku_id from selected product, pack and uom
      let skuId = null;
      const selectedProductId = prodSelect.value
        ? Number(prodSelect.value)
        : null;
      const selectedPack = packSelect.value || null;
      const selectedUom = uomSelect.value || null;
      if (selectedProductId && selectedPack && selectedUom) {
        for (const [id, s] of skuMap.entries()) {
          if (
            Number(s.product_id) === Number(selectedProductId) &&
            String(s.pack_size) === String(selectedPack) &&
            String(s.uom || "").toLowerCase() ===
              String(selectedUom).toLowerCase()
          ) {
            skuId = Number(id);
            break;
          }
        }
      }
      const regionId = regionSelect.value ? Number(regionSelect.value) : null;
      const godownId = godownSelect.value ? Number(godownSelect.value) : null;
      const month = monthInput.value;
      const deltaRaw = deltaInput.value;
      const note = noteInput.value || null;

      const errors = [];
      if (!skuId) errors.push("Pack/SKU required");
      if (!regionId) errors.push("Region required");
      if (!godownId) errors.push("Godown required");
      if (!month) errors.push("Month required");
      if (deltaRaw === "") errors.push("Delta required");
      const delta = Number(deltaRaw);
      if (Number.isNaN(delta) || !(Math.abs(delta) >= 1))
        errors.push("Delta must be a non-zero number (abs >= 1)");

      if (errors.length) {
        await showModalError(errors.join("\n"));
        return;
      }

      const payload = [
        {
          sku_id: skuId,
          region_id: regionId,
          godown_id: godownId,
          month_start: `${month}-01`,
          delta_units: delta,
          note:
            note == null || String(note).trim() === "" ? "MKT Override" : note,
          uploaded_by: (await getCurrentUserId()) || null,
        },
      ];

      const { error } = await supabase
        .from("marketing_overrides_staging")
        .upsert(payload, {
          onConflict: "sku_id,region_id,godown_id,month_start",
        });
      if (error) {
        await showModalError("Insert failed: " + error.message);
        return;
      }
      modal.remove();
      await loadStaging();
      resolve();
    });
  });
}

/** CSV import */
function openCsv() {
  $("csvFile").value = "";
  $("csvFile").click();
}
$("csvFile")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = await parseCsv(text);
  if (!rows.length) {
    await showModalInfo("No rows detected or CSV format not recognized.");
    return;
  }

  // Pre-import validation: collect valid rows and errors
  const valid = [];
  const invalid = [];
  let skippedCount = 0;
  const monthRe = /^\d{4}-\d{2}-01$/; // expects YYYY-MM-01
  rows.forEach((r, idx) => {
    const errors = [];
    if (!r.sku_id || Number.isNaN(Number(r.sku_id)))
      errors.push("invalid sku_id");
    if (!r.region_id || Number.isNaN(Number(r.region_id)))
      errors.push("invalid region_id");
    if (!r.godown_id || Number.isNaN(Number(r.godown_id)))
      errors.push("invalid godown_id");
    if (!r.month_start || !monthRe.test(r.month_start))
      errors.push("month_start must be YYYY-MM-01");
    // Treat null delta_units as skipped (no change requested)
    if (r.delta_units == null) {
      skippedCount++;
    } else if (Number.isNaN(Number(r.delta_units))) {
      errors.push("invalid delta_units");
    } else {
      const dv = Number(r.delta_units);
      if (!(Math.abs(dv) >= 1))
        errors.push("delta_units must be non-zero (abs >= 1)");
    }

    if (errors.length) invalid.push({ row: idx + 1, errors, raw: r });
    else if (r.delta_units == null) {
      // skip rows without delta_units (do not include in valid)
    } else {
      valid.push({
        sku_id: Number(r.sku_id),
        region_id: Number(r.region_id),
        godown_id: Number(r.godown_id),
        month_start: r.month_start,
        delta_units: Number(r.delta_units),
        note:
          r.note == null || String(r.note).trim() === ""
            ? "MKT Override"
            : r.note,
        originalRow: idx + 1,
      });
    }
  });

  // detect duplicates inside the uploaded file (same sku/region/godown/month)
  const seen = new Map();
  const dupInvalid = [];
  valid.forEach((v) => {
    const key = `${v.sku_id}:${v.region_id}:${v.godown_id}:${v.month_start}`;
    if (seen.has(key)) {
      dupInvalid.push({
        row: v.originalRow,
        errors: ["duplicate in upload: same sku/region/godown/month"],
        raw: v,
      });
    } else seen.set(key, v.originalRow);
  });
  if (dupInvalid.length) {
    showImportValidationModal({
      validCount: Math.max(0, valid.length - dupInvalid.length),
      invalidRows: dupInvalid,
      skippedCount,
    });
    return; // abort import on duplicates in file
  }

  if (!valid.length) {
    await showModalInfo(
      "No valid rows found for import. First errors:\n" +
        (invalid[0] ? invalid[0].errors.join(", ") : "none")
    );
    return;
  }

  // If any invalid rows exist, abort the import and show a helper modal
  if (invalid.length) {
    showImportValidationModal({
      validCount: valid.length,
      invalidRows: invalid,
      skippedCount,
    });
    return; // abort import — do not skip invalid rows
  }

  // Summarize and confirm for all-valid file
  let msg = `Found ${valid.length} valid rows.` + "\nProceed to import?";
  const ok = await showModalConfirm(msg);
  if (!ok) return;

  // Bulk insert valid rows in chunks into marketing_overrides_staging
  const chunkSize = 500;
  for (let i = 0; i < valid.length; i += chunkSize) {
    const chunk = valid.slice(i, i + chunkSize);
    // Strip transient fields and include uploaded_by; DB will handle uploaded_at
    const uid = await getCurrentUserId();
    const payload = chunk.map((r) => ({
      sku_id: r.sku_id,
      region_id: r.region_id,
      godown_id: r.godown_id,
      month_start: r.month_start,
      delta_units: r.delta_units,
      note:
        r.note == null || String(r.note).trim() === ""
          ? "MKT Override"
          : r.note,
      uploaded_by: uid || null,
    }));
    const { error } = await supabase
      .from("marketing_overrides_staging")
      .upsert(payload, {
        onConflict: "sku_id,region_id,godown_id,month_start",
      });
    if (error) {
      await showModalError(
        "Import failed at chunk " + (i / chunkSize + 1) + ": " + error.message
      );
      break;
    }
  }
  loadStaging();
});
async function parseCsv(text) {
  // Enhanced CSV parser supporting two formats:
  // - Import template: sku_id,region_id,godown_id,month_start,delta_units[,note]
  // - Baseline export: sku_id,product,pack_size,uom,region_id/region_code,godown_id/godown_code,month_start,month,y_hat,...
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  // Simple CSV line parser that respects quoted fields and double quotes
  const parseLine = (line) => {
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQ = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQ = true;
        } else if (ch === ",") {
          cols.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    cols.push(cur);
    return cols.map((s) => s.trim());
  };

  const header = parseLine(lines[0]).map((s) => s.toLowerCase());
  const idx = (name) => header.indexOf(name);

  // Determine which mode we're in
  const hasTemplate = [
    "sku_id",
    "region_id",
    "godown_id",
    "month_start",
    "delta_units",
  ].every((n) => idx(n) !== -1);
  const hasBaselineLike =
    idx("sku_id") !== -1 &&
    idx("month_start") !== -1 &&
    (idx("y_hat") !== -1 || idx("delta_units") !== -1);

  // Helper to resolve region/godown codes to ids (checks caches then queries supabase)
  const resolveRegionByCode = async (code) => {
    if (!code && code !== 0) return null;
    // try numeric
    const n = Number(code);
    if (!Number.isNaN(n) && regionMap.has(n)) return n;
    // search cache by code or name
    for (const [id, r] of regionMap.entries()) {
      if (
        (r.code &&
          String(r.code).toLowerCase() === String(code).toLowerCase()) ||
        (r.name && String(r.name).toLowerCase() === String(code).toLowerCase())
      )
        return id;
    }
    // query server
    try {
      const { data } = await supabase
        .from("regions")
        .select("id,code,name")
        .or(`code.eq.${code},name.eq.${code}`)
        .limit(1);
      if (data && data.length) {
        const row = data[0];
        regionMap.set(Number(row.id), row);
        return Number(row.id);
      }
    } catch (e) {
      console.error("resolveRegionByCode error", e);
    }
    return null;
  };
  const resolveGodownByCode = async (code) => {
    if (!code && code !== 0) return null;
    const n = Number(code);
    if (!Number.isNaN(n) && godownMap.has(n)) return n;
    for (const [id, g] of godownMap.entries()) {
      if (
        (g.code &&
          String(g.code).toLowerCase() === String(code).toLowerCase()) ||
        (g.name && String(g.name).toLowerCase() === String(code).toLowerCase())
      )
        return id;
    }
    try {
      const { data } = await supabase
        .from("godowns")
        .select("id,code,name,region_id")
        .or(`code.eq.${code},name.eq.${code}`)
        .limit(1);
      if (data && data.length) {
        const row = data[0];
        godownMap.set(Number(row.id), row);
        return Number(row.id);
      }
    } catch (e) {
      console.error("resolveGodownByCode error", e);
    }
    return null;
  };

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseLine(line);
    if (!cols.length || !cols[0]) continue;

    if (hasTemplate) {
      const rawDelta =
        idx("delta_units") !== -1 ? cols[idx("delta_units")].trim() : "";
      out.push({
        sku_id: Number(cols[idx("sku_id")]),
        region_id: Number(cols[idx("region_id")]),
        godown_id: Number(cols[idx("godown_id")]),
        month_start: cols[idx("month_start")],
        delta_units: rawDelta === "" ? null : Number(rawDelta),
        note: idx("note") !== -1 ? cols[idx("note")] || null : null,
      });
      continue;
    }

    if (hasBaselineLike) {
      // For baseline-like rows, accept region_id or region_code, godown_id or godown_code
      let regionId = null;
      let godownId = null;
      if (idx("region_id") !== -1) regionId = Number(cols[idx("region_id")]);
      else if (idx("region_code") !== -1)
        regionId = await resolveRegionByCode(cols[idx("region_code")]);

      if (idx("godown_id") !== -1) godownId = Number(cols[idx("godown_id")]);
      else if (idx("godown_code") !== -1)
        godownId = await resolveGodownByCode(cols[idx("godown_code")]);

      // Only use delta_units if present; do not fall back to y_hat for import
      const rawDelta =
        idx("delta_units") !== -1 ? cols[idx("delta_units")].trim() : "";
      const deltaVal = rawDelta === "" ? null : Number(rawDelta);

      out.push({
        sku_id: Number(cols[idx("sku_id")]),
        region_id: regionId,
        godown_id: godownId,
        month_start: cols[idx("month_start")],
        delta_units: deltaVal,
        note: idx("note") !== -1 ? cols[idx("note")] || null : null,
      });
      continue;
    }

    // Unknown format for this row set
    return [];
  }
  return out;
}

/** Clear staging */
async function clearStaging() {
  if (!(await showModalConfirm("Delete ALL rows in staging?"))) return;
  const { error } = await supabase
    .from("marketing_overrides_staging")
    .delete()
    .neq("id", -1);
  if (error) {
    await showModalError("Clear failed: " + error.message);
    return;
  }
  loadStaging();
}

/** Promote all staging rows within the months window into forecast_demand_overrides */
async function promoteAllStaging() {
  const { from, to } = getWindowRange();
  if (!from || !to) {
    await showModalInfo("Please set a valid Months window.");
    return;
  }
  const ok = await showModalConfirm(
    `Promote ALL staged overrides between ${from} and ${to}? This will upsert into active overrides and mark them active.`
  );
  if (!ok) return;

  // Fetch staging rows in window (limit reasonably large)
  const { data, error } = await supabase
    .from("marketing_overrides_staging")
    .select("id,sku_id,region_id,godown_id,month_start,delta_units,note")
    .gte("month_start", from)
    .lte("month_start", to)
    .order("month_start", { ascending: true })
    .limit(5000);
  if (error) {
    await showModalError("Failed to fetch staging rows: " + error.message);
    return;
  }
  const rows = data || [];
  if (!rows.length) {
    await showModalInfo("No staged overrides found in the selected window.");
    return;
  }

  // Confirm count and proceed
  const proceed = await showModalConfirm(
    `About to promote ${rows.length} rows. Continue?`
  );
  if (!proceed) return;

  // Build payloads and promote in chunks, using upsert with onConflict and fallback per-chunk
  const payloads = rows.map((r) => ({
    sku_id: r.sku_id,
    region_id: r.region_id,
    godown_id: r.godown_id,
    month_start: r.month_start,
    delta_units: r.delta_units,
    reason: r.note || "Promoted from staging (bulk)",
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const chunkSize = 500;
  for (let i = 0; i < payloads.length; i += chunkSize) {
    const chunk = payloads.slice(i, i + chunkSize);
    try {
      const up = await supabase
        .from("forecast_demand_overrides")
        .upsert(chunk, {
          onConflict: "sku_id,region_id,godown_id,month_start",
        });
      if (up.error) {
        const msg = String(up.error.message || "").toLowerCase();
        if (
          msg.includes("no unique") ||
          msg.includes("on conflict") ||
          msg.includes("unique or exclusion constraint")
        ) {
          // Fallback: for each row in chunk, select existing -> update or insert
          for (const p of chunk) {
            const { data: existing, error: se } = await supabase
              .from("forecast_demand_overrides")
              .select("id")
              .eq("sku_id", p.sku_id)
              .eq("region_id", p.region_id)
              .eq("godown_id", p.godown_id)
              .eq("month_start", p.month_start)
              .limit(1);
            if (se) {
              console.warn("promoteAll: fallback select error", se);
              continue;
            }
            if (existing && existing.length) {
              const idToUpdate = existing[0].id;
              const { error: ue } = await supabase
                .from("forecast_demand_overrides")
                .update({
                  delta_units: p.delta_units,
                  reason: p.reason,
                  is_active: true,
                  updated_at: p.updated_at,
                })
                .eq("id", idToUpdate);
              if (ue) console.warn("promoteAll: update failed", ue);
            } else {
              const { error: ie } = await supabase
                .from("forecast_demand_overrides")
                .insert([p]);
              if (ie) console.warn("promoteAll: insert failed", ie);
            }
          }
        } else {
          await showModalError("Promote failed: " + up.error.message);
          return;
        }
      }
    } catch (e) {
      console.error("promoteAll chunk error", e);
      await showModalError("Promote failed: " + (e.message || e));
      return;
    }
  }

  // Optional: remove staged rows that were promoted (best-effort)
  try {
    const stagingIds = rows.map((r) => r.id);
    const { error: delErr } = await supabase
      .from("marketing_overrides_staging")
      .delete()
      .in("id", stagingIds);
    if (delErr)
      console.warn("promoteAll: failed to delete staging rows", delErr);
  } catch (e) {
    console.warn("promoteAll: delete staging cleanup failed", e);
  }

  await showModalInfo(`Promoted ${rows.length} staged overrides.`);
  await Promise.all([loadStaging(), loadActive(), loadBaseline()]);
}

/** Apply staging → forecast_demand_overrides via RPC */
async function applyOverrides() {
  const { from, to } = getWindowRange();
  if (!from || !to) {
    await showModalInfo("Please set a valid Months window.");
    return;
  }
  setStatus($("applyStatus"), "Applying…");
  const { data, error } = await supabase.rpc("apply_marketing_overrides", {
    p_from: from,
    p_to: to,
  });
  if (error) {
    console.error(error);
    setStatus($("applyStatus"), "Apply failed", "danger");
    await showModalError("Apply failed: " + error.message);
    return;
  }
  const { inserted_count, updated_count, deactivated_count } = data || {};
  setStatus(
    $("applyStatus"),
    `Done: +${inserted_count || 0} / ~${updated_count || 0} / -${
      deactivated_count || 0
    }`
  );

  // Refresh both panes + baseline preview
  loadActive();
  loadStaging();
  loadBaseline();
}

/** Deactivate active overrides in the window */
async function deactivateInWindow() {
  const { from, to } = getWindowRange();
  if (!from || !to) {
    await showModalInfo("Please set a valid Months window.");
    return;
  }
  if (
    !(await showModalConfirm(
      `Deactivate all active overrides between ${from} and ${to}?`
    ))
  )
    return;

  // Select IDs first (limit large fanout)
  const { data, error } = await supabase
    .from("forecast_demand_overrides")
    .select("id")
    .eq("is_active", true)
    .gte("month_start", from)
    .lte("month_start", to)
    .limit(5000);

  if (error) {
    await showModalError("Fetch failed: " + error.message);
    return;
  }
  const ids = (data || []).map((r) => r.id);
  const chunk = 500;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { error: e2 } = await supabase
      .from("forecast_demand_overrides")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", slice);
    if (e2) {
      await showModalError("Deactivate failed: " + e2.message);
      break;
    }
  }
  loadActive();
  loadBaseline();
}

/** Delete all promoted overrides within the months window (careful) */
async function clearActiveWindow() {
  const { from, to } = getWindowRange();
  if (!from || !to) {
    await showModalInfo("Please set a valid Months window.");
    return;
  }
  const ok = await showModalConfirm(
    `Delete ALL promoted overrides between ${from} and ${to}? This operation cannot be undone.`
  );
  if (!ok) return;

  // Select IDs within window (limit large) then delete in chunks
  const { data, error } = await supabase
    .from("forecast_demand_overrides")
    .select("id")
    .gte("month_start", from)
    .lte("month_start", to)
    .limit(10000);
  if (error) {
    await showModalError("Fetch failed: " + error.message);
    return;
  }
  const ids = (data || []).map((r) => r.id);
  if (!ids.length) {
    await showModalInfo("No promoted overrides found in the selected window.");
    return;
  }
  const chunk = 500;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const res = await supabase
      .from("forecast_demand_overrides")
      .delete()
      .in("id", slice);
    if (res.error) {
      await showModalError("Delete failed: " + res.error.message);
      return;
    }
    const delData = res.data;
    if (!delData || (Array.isArray(delData) && delData.length === 0)) {
      // verify whether rows remain — if so, likely RLS preventing deletion
      try {
        const { data: check, error: checkErr } = await supabase
          .from("forecast_demand_overrides")
          .select("id")
          .in("id", slice)
          .limit(slice.length);
        if (checkErr) {
          console.warn("clearActiveWindow: verify check failed", checkErr);
          await showModalError(
            "Delete did not remove rows and verification failed. This may be due to Row Level Security (RLS) policies."
          );
          return;
        }
        if (check && check.length) {
          await showModalError(
            "Delete did not remove some rows. This may be due to Row Level Security (RLS) or insufficient permissions."
          );
          return;
        }
      } catch (e) {
        console.warn("clearActiveWindow verify exception", e);
        await showModalError(
          "Delete did not remove rows; verification failed. Check server logs or permissions."
        );
        return;
      }
    }
  }

  await showModalInfo(`Deleted ${ids.length} promoted overrides.`);
  await Promise.all([loadActive(), loadBaseline()]);
}

/** Wire up buttons and initial load */
function wire() {
  // Parent download button is a menu toggle; child buttons trigger actual downloads
  const el = (id, fn) => {
    const e = $(id);
    if (e) e.addEventListener("click", fn);
  };
  el("btnImportCsv", openCsv);
  el("btnAddRow", addRow);
  el("btnClearStaging", clearStaging);
  el("btnPromoteAll", promoteAllStaging);
  el("btnClearFilters", clearFilters);
  // Pager controls
  el("stagingPrev", stagingPrevPage);
  el("stagingNext", stagingNextPage);

  const sp = $("stagingPageSize");
  if (sp)
    sp.addEventListener("change", (e) => {
      window.__DO_pageSize = Number(e.target.value || 50);
      window.__DO_stagingPage = 1;
      loadStaging();
    });
  // numeric page input removed for compact pager

  // Refresh button removed; staging/active will refresh automatically on actions/window changes
  el("btnDeactivateAll", deactivateInWindow);
  el("btnDeleteAllActive", clearActiveWindow);
  el("activePrev", activePrevPage);
  el("activeNext", activeNextPage);
  const ap = $("activePageSize");
  if (ap)
    ap.addEventListener("change", (e) => {
      window.__DO_pageSize = Number(e.target.value || 50);
      window.__DO_activePage = 1;
      loadActive();
    });
  // numeric page input removed for compact pager

  el("btnApply", applyOverrides);

  // Auto-refresh baseline when any filter changes. Debounce to avoid rapid repeated calls.
  const debounce = (fn, wait) => {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const debouncedReload = debounce(() => {
    // reset baseline paging to first page when filters change
    window.__DO_baselinePage = 1;
    loadBaseline();
  }, 220);

  // Staging filters change should reload staging (debounced)
  const debouncedStagingReload = debounce(() => {
    window.__DO_stagingPage = 1;
    loadStaging();
  }, 180);

  [
    "filterProduct",
    "filterRegion",
    "filterGodown",
    "filterMonth",
    "filterDeltaOp",
    "filterDeltaVal1",
    "filterDeltaVal2",
  ].forEach((id) => {
    const e = $(id);
    if (!e) return;
    e.addEventListener("change", () => {
      // toggle second delta input when operator = between
      const opEl = $("filterDeltaOp");
      const v2 = $("filterDeltaVal2");
      if (opEl && v2) {
        v2.style.display = opEl.value === "between" ? "inline-block" : "none";
      }
      debouncedStagingReload();
    });
    // also trigger input events for number fields
    if (e.tagName === "INPUT" && e.type === "number") {
      e.addEventListener("input", debouncedStagingReload);
    }
  });

  // List of filter element ids to watch
  const filterIds = [
    "filterSkuIdExact",
    "filterSkuId",
    "filterProduct",
    "filterRegion",
    "filterGodown",
    "filterMonth",
    "filterDelta",
  ];
  // Helper: make the three SKU/Product selects mutually exclusive toggles
  const skuProductIds = ["filterSkuIdExact", "filterSkuId", "filterProduct"];
  function toggleMutualExclusion() {
    try {
      const values = skuProductIds.map((id) => {
        const el = $(id);
        return el && !el.disabled ? String(el.value || "").trim() : "";
      });
      // If any has a non-empty value, disable the others
      const any = values.some((v) => v !== "");
      if (any) {
        skuProductIds.forEach((id, idx) => {
          const el = $(id);
          if (!el) return;
          const has = values[idx] !== "";
          // keep the selected one enabled, others disabled
          el.disabled = !has;
        });
      } else {
        // none selected: re-enable all
        skuProductIds.forEach((id) => {
          const el = $(id);
          if (!el) return;
          el.disabled = false;
        });
      }
    } catch (e) {
      console.warn("toggleMutualExclusion failed", e);
    }
  }

  // Helper: clear all filters back to defaults and trigger a reload
  function clearFilters() {
    try {
      // Clear text inputs and datalist inputs
      ["filterSkuIdExact", "filterSkuId", "filterProduct"].forEach((id) => {
        const e = $(id);
        if (!e) return;
        e.value = "";
        // re-enable if previously disabled due to mutual exclusion
        e.disabled = false;
      });
      // Reset selects to empty (All)
      ["filterRegion", "filterGodown"].forEach((id) => {
        const s = $(id);
        if (!s) return;
        s.value = "";
      });
      // Clear month and delta
      const fm = $("filterMonth");
      if (fm) fm.value = "";
      const fd = $("filterDelta");
      if (fd) fd.checked = false;

      // Reset baseline page state
      window.__DO_baselinePage = 1;
      // Ensure mutual exclusion reset
      toggleMutualExclusion();
      // Trigger reload via debounced helper
      debouncedReload();
    } catch (e) {
      console.warn("clearFilters failed", e);
    }
  }
  filterIds.forEach((id) => {
    const eln = $(id);
    if (!eln) return;
    // Use input for month and checkbox for delta; selects use change
    if (eln.tagName === "INPUT" && eln.type === "month") {
      eln.addEventListener("change", debouncedReload);
    } else if (eln.tagName === "INPUT" && eln.type === "checkbox") {
      eln.addEventListener("change", debouncedReload);
    } else {
      // select elements
      eln.addEventListener("change", (ev) => {
        // Update mutual exclusion state for SKU/Product selects
        if (skuProductIds.includes(id)) toggleMutualExclusion();
        debouncedReload(ev);
      });
    }
  });

  // Ensure mutual exclusion state is correct after population
  toggleMutualExclusion();

  // Attach custom autocomplete for inputs that use datalist to avoid
  // native datalist expanding to full viewport. Prefer targeting SKU ID exact.
  try {
    const skuExact = $("filterSkuIdExact");
    const skuExactList = getDatalistForElement(skuExact);
    if (skuExact && skuExactList && skuExact.tagName === "INPUT") {
      // small delay to ensure datalist was populated by loadLookups
      setTimeout(() => {
        try {
          attachAutocompleteToInput(skuExact, skuExactList, { maxHeight: 260 });
          // Remove the native list attribute so the browser doesn't show its
          // built-in datalist popup (which can open upwards and clash with our panel).
          try {
            skuExact.removeAttribute && skuExact.removeAttribute("list");
          } catch (e) {
            void e;
          }
        } catch (e) {
          console.warn("attachAutocomplete failed", e);
        }
      }, 80);
    }
    // Also attach to SKU label and Product inputs (if they are inputs with datalists)
    const skuLabelInput = $("filterSkuId");
    const skuLabelList =
      document.getElementById("filterSkuId_list") ||
      getDatalistForElement(skuLabelInput);
    if (skuLabelInput && skuLabelList && skuLabelInput.tagName === "INPUT") {
      setTimeout(() => {
        try {
          attachAutocompleteToInput(skuLabelInput, skuLabelList, {
            maxHeight: 260,
          });
          try {
            skuLabelInput.removeAttribute &&
              skuLabelInput.removeAttribute("list");
          } catch (e) {
            void e;
          }
        } catch (e) {
          console.warn("attachAutocomplete skuLabel failed", e);
        }
      }, 120);
    }
    const prodInput = $("filterProduct");
    const prodList =
      document.getElementById("filterProduct_list") ||
      getDatalistForElement(prodInput);
    if (prodInput && prodList && prodInput.tagName === "INPUT") {
      setTimeout(() => {
        try {
          attachAutocompleteToInput(prodInput, prodList, { maxHeight: 260 });
          try {
            prodInput.removeAttribute && prodInput.removeAttribute("list");
          } catch (e) {
            void e;
          }
        } catch (e) {
          console.warn("attachAutocomplete prod failed", e);
        }
      }, 140);
    }
  } catch (e) {
    console.warn("wire: autocomplete wiring failed", e);
  }

  // Baseline pager wiring
  el("baselinePrev", baselinePrevPage);
  el("baselineNext", baselineNextPage);
  const bp = $("baselinePageSize");
  if (bp)
    bp.addEventListener("change", (e) => {
      window.__DO_pageSize = Number(e.target.value || 50);
      window.__DO_baselinePage = 1;
      loadBaseline();
    });
  // numeric page input removed for compact pager

  const fromEl = $("fromMonth");
  const toEl = $("toMonth");
  if (fromEl) {
    fromEl.addEventListener("change", () => {
      window.__DO_stagingPage = 1;
      window.__DO_activePage = 1;
      loadStaging();
      loadActive();
    });
  }
  if (toEl) {
    toEl.addEventListener("change", () => {
      window.__DO_stagingPage = 1;
      window.__DO_activePage = 1;
      loadStaging();
      loadActive();
    });
  }

  // Home button handler (like log-add module)
  const homeBtn = $("homeBtn");
  if (homeBtn) {
    homeBtn.onclick = () => {
      window.location.href = "index.html";
    };
  }
}

/** Boot */
document.addEventListener("DOMContentLoaded", async () => {
  // Require auth
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session) {
    // In the Electron app this will usually be present; if not, bounce to login.
    // window.location.href = "../../login.html";
  }

  // Load lookups first so we can render human-readable names
  await loadLookups();
  // Ensure month selectors exist (inject them if the HTML omitted them), then init
  try {
    ensureMonthSelectors();
  } catch (e) {
    console.warn("ensureMonthSelectors error", e);
  }
  initWindow();
  wire();
  // Initialize pager control defaults
  const sp = $("stagingPageSize");
  if (sp) sp.value = String(window.__DO_pageSize || 50);
  const ap = $("activePageSize");
  if (ap) ap.value = String(window.__DO_pageSize || 50);
  const bp = $("baselinePageSize");
  if (bp) bp.value = String(window.__DO_pageSize || 50);
  // initialize compact pager labels
  const spg = $("stagingPager");
  if (spg) spg.textContent = `Page ${window.__DO_stagingPage || 1} / 1`;
  const apg = $("activePager");
  if (apg) apg.textContent = `Page ${window.__DO_activePage || 1} / 1`;
  const bpg = $("baselinePager");
  if (bpg) bpg.textContent = `Page ${window.__DO_baselinePage || 1} / 1`;
  // Close action menus when clicking outside
  document.addEventListener("click", () => {
    document.querySelectorAll(".action-menu-panel").forEach((p) => {
      p.style.display = "none";
      // clear any fixed positioning
      p.style.position = "";
      p.style.left = "";
      p.style.top = "";
      p.style.zIndex = "";
    });
  });
  // Hide panels on window resize or scroll to avoid orphaned/floating panels
  window.addEventListener("resize", () => {
    document
      .querySelectorAll(".action-menu-panel")
      .forEach((p) => (p.style.display = "none"));
  });
  window.addEventListener(
    "scroll",
    () => {
      document
        .querySelectorAll(".action-menu-panel")
        .forEach((p) => (p.style.display = "none"));
    },
    { passive: true }
  );
  // Wire baseline download UI
  const dlToggle = document.getElementById("btnDownloadTemplate");
  const dlMenu = document.getElementById("baselineDownloads");
  if (dlToggle && dlMenu) {
    dlToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      dlMenu.style.display =
        dlMenu.style.display === "block" ? "none" : "block";
    });
    // hide when clicking outside
    document.addEventListener("click", () => {
      dlMenu.style.display = "none";
    });
  }
  document
    .getElementById("downloadBaseline1")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      exportBaselineForGodown(1);
    });
  document
    .getElementById("downloadBaseline2")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      exportBaselineForGodown(2);
    });
  document
    .getElementById("downloadBaseline3")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      exportBaselineForGodown(3);
    });
  // first load (include baseline)
  await Promise.all([loadStaging(), loadActive(), loadBaseline()]);
});
