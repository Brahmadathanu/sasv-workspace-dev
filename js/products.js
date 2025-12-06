// js/products.js
import { supabase } from "../public/shared/js/supabaseClient.js";

// DOM refs
// (global +New removed — use inline controls)
const homeBtn = document.getElementById("homeBtn");
const searchInput = document.getElementById("searchInput");
const productList = document.getElementById("productList");
const form = document.getElementById("productForm");
const itemInput = document.getElementById("itemInput");
const malInput = document.getElementById("malInput");
const statusSelect = document.getElementById("statusSelect");
const categorySelect = document.getElementById("categorySelect");
const subcategorySelect = document.getElementById("subcategorySelect");
const groupSelect = document.getElementById("groupSelect");
const subgroupSelect = document.getElementById("subgroupSelect");
const isPtoCheckbox = document.getElementById("isPtoCheckbox");
const uomBaseSelect = document.getElementById("uomBaseSelect");
const conversionInput = document.getElementById("conversionInput");
const isSeasonalCheckbox = document.getElementById("isSeasonalCheckbox");
const seasonProfileSelect = document.getElementById("seasonProfileSelect");
const isLltCheckbox = document.getElementById("isLltCheckbox");
const leadTimeInput = document.getElementById("leadTimeMonths");
const deleteBtn = document.getElementById("deleteBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalMessage = document.getElementById("modalMessage");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");
const editToggleBtn = document.getElementById("editToggleBtn");
const toastEl = document.getElementById("toast");
const loadingOverlay = document.getElementById("loadingOverlay");
const saveIconBtn = document.getElementById("saveIconBtn");
const cancelIconBtn = document.getElementById("cancelIconBtn");
const inlineDeleteBtn = document.getElementById("inlineDeleteBtn");
const newInlineBtn = document.getElementById("newInlineBtn");
const productCountPill = document.getElementById("productCountPill");
const clearSearchBtn = document.getElementById("clearSearchBtn");

let allProducts = [];
let filtered = [];
let selectedId = null;
let unsaved = false;
let editing = false;
let previousSelectedId = null;
let inNewMode = false;
let keyboardIndex = -1; // index into `filtered` for highlighted item via keyboard

// Convenience: show a short in-app toast
function showToast(text, timeout = 3000) {
  try {
    if (!toastEl) return alert(text);
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastEl._hideTimeout);
    toastEl._hideTimeout = setTimeout(() => {
      toastEl.classList.remove("show");
    }, timeout);
  } catch (e) {
    console.error(e);
  }
}

function showLoading() {
  try {
    if (!loadingOverlay) return;
    loadingOverlay.classList.add("show");
    loadingOverlay.setAttribute("aria-hidden", "false");
  } catch (err) {
    console.error(err);
  }
}

function hideLoading() {
  try {
    if (!loadingOverlay) return;
    loadingOverlay.classList.remove("show");
    loadingOverlay.setAttribute("aria-hidden", "true");
  } catch (err) {
    console.error(err);
  }
}

function setEditing(on) {
  editing = !!on;
  // Toggle button appearance
  if (editToggleBtn) {
    editToggleBtn.classList.toggle("active", editing);
    editToggleBtn.title = editing ? "Disable edit" : "Enable edit";
  }
  // Explicitly enable/disable known controls so view-mode is enforced
  const knownControls = [
    itemInput,
    malInput,
    statusSelect,
    categorySelect,
    subcategorySelect,
    groupSelect,
    subgroupSelect,
    isPtoCheckbox,
    uomBaseSelect,
    conversionInput,
    isSeasonalCheckbox,
    seasonProfileSelect,
    isLltCheckbox,
    leadTimeInput,
  ];
  knownControls.forEach((c) => {
    if (!c) return;
    try {
      c.disabled = !editing;
    } catch (err) {
      console.error(err);
    }
  });
  // Save/Delete buttons
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) saveBtn.disabled = !editing;
  if (deleteBtn) deleteBtn.disabled = !editing;

  // Re-evaluate dependent controls when editing enabled
  if (uomBaseSelect)
    conversionInput.disabled = !(
      editing &&
      uomBaseSelect &&
      uomBaseSelect.value
    );
  if (seasonProfileSelect)
    seasonProfileSelect.disabled = !(
      editing &&
      isSeasonalCheckbox &&
      isSeasonalCheckbox.checked
    );
  if (leadTimeInput)
    leadTimeInput.disabled = !(
      editing &&
      isLltCheckbox &&
      isLltCheckbox.checked
    );
  // Ensure classification selects reflect editing state without clearing existing values when in view mode
  updateClassificationState();
  // update visibility of inline save/cancel icons
  updateDirtyIcons();
}

function updateDirtyIcons() {
  const show = !!editing && !!unsaved;
  if (saveIconBtn) saveIconBtn.style.display = show ? "inline-block" : "none";
  if (cancelIconBtn)
    cancelIconBtn.style.display = show ? "inline-block" : "none";
}

// ─── prevent focus loss on Ctrl+Digit ─────────────────────
window.addEventListener(
  "keydown",
  (e) => {
    const a = document.activeElement;
    if (
      a &&
      ["INPUT", "SELECT", "TEXTAREA"].includes(a.tagName) &&
      e.ctrlKey &&
      e.code.startsWith("Digit")
    ) {
      e.preventDefault();
      if (e.code === "Digit5") itemInput.focus();
    }
  },
  true
);

// ─── modal helper (enhanced ERP-styled) ────────────────────
const modalBox = document.getElementById("modalBox");
const modalTitle = document.getElementById("modalTitle");
const modalIcon = document.getElementById("modalIcon");
function showModal(msg, okText = "OK", cancelText = "Cancel", type = null) {
  // type: 'delete' | 'save' | 'warning' | 'confirm' (optional)
  const inferType = (ok) => {
    if (!ok) return "confirm";
    const o = ok.toLowerCase();
    if (o.includes("delete")) return "delete";
    if (o.includes("save")) return "save";
    if (o.includes("discard") || o.includes("cancel")) return "warning";
    return "confirm";
  };
  const t = type || inferType(okText);
  // set classes
  if (modalBox) {
    modalBox.classList.remove(
      "type-delete",
      "type-save",
      "type-warning",
      "type-confirm"
    );
    modalBox.classList.add(`type-${t}`);
  }
  // set title and icon
  const titleMap = {
    delete: "Confirm Delete",
    save: "Confirm Save",
    warning: "Warning",
    confirm: "Confirm",
  };
  const svgMap = {
    delete:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 6h18" stroke="#d9534f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 6l1-2h6l1 2" stroke="#d9534f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="7" y="6" width="10" height="13" rx="2" stroke="#d9534f" stroke-width="1.6" fill="none"/><path d="M10 10v6M14 10v6" stroke="#d9534f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    save: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 3h14v18H5z" stroke="#2d8f46" stroke-width="1.6" fill="none"/><path d="M9 11l2 2 4-4" stroke="#2d8f46" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#b36b00" stroke-width="1.4" fill="none"/><path d="M12 9v4M12 17h.01" stroke="#b36b00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    confirm:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#2b6ea3" stroke-width="1.4" fill="none"/><path d="M9 12l2 2 4-4" stroke="#2b6ea3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  if (modalTitle) modalTitle.textContent = titleMap[t] || "Confirm";
  if (modalIcon) modalIcon.innerHTML = svgMap[t] || svgMap.confirm;

  return new Promise((res) => {
    modalMessage.textContent = msg;
    // set button labels
    if (modalConfirm) {
      modalConfirm.textContent = okText || "OK";
      modalConfirm.className =
        "btn primary" + (t === "delete" ? " danger" : "");
    }
    if (modalCancel) {
      modalCancel.textContent = cancelText || "Cancel";
      modalCancel.className = "btn secondary";
    }
    if (modalOverlay) {
      modalOverlay.classList.add("show");
      modalOverlay.setAttribute("aria-hidden", "false");
    }
    const cleanup = () => {
      if (modalOverlay) {
        modalOverlay.classList.remove("show");
        modalOverlay.setAttribute("aria-hidden", "true");
      }
      if (modalConfirm) modalConfirm.removeEventListener("click", onOk);
      if (modalCancel) modalCancel.removeEventListener("click", onCancel);
    };
    const onOk = () => {
      cleanup();
      res(true);
    };
    const onCancel = () => {
      cleanup();
      res(false);
    };
    if (modalConfirm) modalConfirm.addEventListener("click", onOk);
    if (modalCancel) modalCancel.addEventListener("click", onCancel);
  });
}

// ─── cascading classification loads ────────────────────────
async function loadClassifications() {
  const { data: cats, error } = await supabase
    .from("categories")
    .select("id, category_name")
    .order("category_name");
  if (error) return console.error(error);

  categorySelect.innerHTML = '<option value="">-- Select --</option>';
  cats.forEach((c) => categorySelect.add(new Option(c.category_name, c.id)));

  categorySelect.addEventListener("change", () =>
    loadSubcats(categorySelect.value)
  );
  subcategorySelect.addEventListener("change", () =>
    loadGroups(subcategorySelect.value)
  );
  groupSelect.addEventListener("change", () =>
    loadSubgroups(groupSelect.value)
  );
  // set initial enabled/disabled state
  updateClassificationState();
}

async function loadSubcats(catId) {
  subcategorySelect.innerHTML = '<option value="">-- Select --</option>';
  groupSelect.innerHTML = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
  if (!catId) return;
  const { data, error } = await supabase
    .from("sub_categories")
    .select("id, subcategory_name")
    .eq("category_id", catId)
    .order("subcategory_name");
  if (error) return console.error(error);
  data.forEach((s) =>
    subcategorySelect.add(new Option(s.subcategory_name, s.id))
  );
  updateClassificationState();
}

async function loadGroups(subId) {
  groupSelect.innerHTML = '<option value="">-- Select --</option>';
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
  if (!subId) return;
  const { data, error } = await supabase
    .from("product_groups")
    .select("id, group_name")
    .eq("sub_category_id", subId)
    .order("group_name");
  if (error) return console.error(error);
  data.forEach((g) => groupSelect.add(new Option(g.group_name, g.id)));
  updateClassificationState();
}

async function loadSubgroups(gId) {
  subgroupSelect.innerHTML = '<option value="">-- Select --</option>';
  if (!gId) return;
  const { data, error } = await supabase
    .from("sub_groups")
    .select("id, sub_group_name")
    .eq("product_group_id", gId)
    .order("sub_group_name");
  if (error) return console.error(error);
  data.forEach((sg) =>
    subgroupSelect.add(new Option(sg.sub_group_name, sg.id))
  );
  updateClassificationState();
}

function updateClassificationState() {
  // Enable selects only when editing AND parent selection exists.
  // If parent selection exists but editing is false, keep the value but keep the select disabled (view-only).
  const hasCat = !!categorySelect && !!categorySelect.value;
  if (subcategorySelect) {
    // enable only when editing and parent present
    subcategorySelect.disabled = !(editing && hasCat);
    // clear only when parent absent
    if (!hasCat) subcategorySelect.value = "";
  }
  const hasSub = !!subcategorySelect && !!subcategorySelect.value;
  if (groupSelect) {
    groupSelect.disabled = !(editing && hasSub);
    if (!hasSub) groupSelect.value = "";
  }
  const hasGroup = !!groupSelect && !!groupSelect.value;
  if (subgroupSelect) {
    subgroupSelect.disabled = !(editing && hasGroup);
    if (!hasGroup) subgroupSelect.value = "";
  }
}

// ─── chunked fetch of *all* products ───────────────────────
const CHUNK = 1000;
async function fetchAllProducts() {
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, item")
      .order("item")
      .range(from, from + CHUNK - 1);
    if (error) {
      console.error("fetchAllProducts error:", error);
      break;
    }
    all.push(...data);
    if (data.length < CHUNK) break;
    from += CHUNK;
  }
  return all;
}

// ─── load & render products ────────────────────────────────
async function loadProducts() {
  allProducts = await fetchAllProducts();
  applyFilter();
}

function applyFilter() {
  const term = searchInput.value.trim().toLowerCase();
  filtered = allProducts.filter((p) => p.item.toLowerCase().includes(term));
  productList.innerHTML = filtered
    .map(
      (p) =>
        `<li role="option" id="product-${p.id}" data-id="${
          p.id
        }" aria-selected="${p.id === selectedId ? "true" : "false"}"${
          p.id === selectedId ? ' class="selected"' : ""
        }>${p.item}</li>`
    )
    .join("");
  // if we have a keyboardIndex still set, reapply highlight
  const lis = Array.from(productList.querySelectorAll("li"));
  if (keyboardIndex >= 0 && keyboardIndex < lis.length) {
    updateKeyboardHighlight(lis, keyboardIndex);
  } else {
    // ensure aria-activedescendant cleared when nothing focused
    productList.removeAttribute("aria-activedescendant");
  }
  // update pill: show "matches / total" when filtering, otherwise show total
  try {
    if (productCountPill) {
      const total = allProducts.length || 0;
      if (!term) {
        productCountPill.textContent = `${total} products`;
        productCountPill.title = `${total} products total`;
        productCountPill.setAttribute("aria-label", `${total} products total`);
      } else {
        productCountPill.textContent = `${filtered.length} / ${total}`;
        productCountPill.title = `${filtered.length} matches of ${total} products`;
        productCountPill.setAttribute(
          "aria-label",
          `${filtered.length} matches of ${total} products`
        );
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// ─── load single detail or reset ──────────────────────────
async function loadDetails(id) {
  let loaded = false;
  if (unsaved) {
    const ok = await showModal(
      "You have unsaved changes. Discard?",
      "Discard",
      "Cancel"
    );
    if (!ok) return;
  }

  selectedId = id;
  applyFilter();

  if (!id) {
    form.reset();
    if (isPtoCheckbox) isPtoCheckbox.checked = false;
    if (uomBaseSelect) uomBaseSelect.value = "";
    if (conversionInput) conversionInput.value = "";
    if (isSeasonalCheckbox) isSeasonalCheckbox.checked = false;
    if (seasonProfileSelect) seasonProfileSelect.value = "";
    if (isLltCheckbox) isLltCheckbox.checked = false;
    if (leadTimeInput) leadTimeInput.value = "";
    if (deleteBtn) deleteBtn.disabled = true;
    unsaved = false;
    itemInput.focus();
    // no product selected -> disable edit toggle until a product is chosen
    if (editToggleBtn) {
      editToggleBtn.disabled = true;
      editToggleBtn.title = "Select a product to enable edit";
    }
    // hide inline delete when no product selected
    if (inlineDeleteBtn) inlineDeleteBtn.style.display = "none";
    return true;
  }
  // show overlay only when we are about to perform network loads
  showLoading();
  try {
    const { data: prod, error } = await supabase
      .from("products")
      .select(
        "item, malayalam_name, status, sub_group_id, is_pto, uom_base, conversion_to_base, is_seasonal, season_profile_id, is_llt, manufacture_lead_time_months"
      )
      .eq("id", id)
      .single();
    if (error) return console.error(error);

    // fill fields
    itemInput.value = prod.item;
    malInput.value = prod.malayalam_name;
    statusSelect.value = prod.status;
    if (isPtoCheckbox) isPtoCheckbox.checked = !!prod.is_pto;
    if (uomBaseSelect) uomBaseSelect.value = prod.uom_base || "";
    if (conversionInput) conversionInput.value = prod.conversion_to_base ?? "";
    if (isSeasonalCheckbox) isSeasonalCheckbox.checked = !!prod.is_seasonal;
    if (seasonProfileSelect)
      seasonProfileSelect.value = prod.season_profile_id ?? "";
    if (isLltCheckbox) isLltCheckbox.checked = !!prod.is_llt;
    if (leadTimeInput)
      leadTimeInput.value = prod.manufacture_lead_time_months ?? "";

    // cascade up to category
    const { data: sg } = await supabase
      .from("sub_groups")
      .select("product_group_id")
      .eq("id", prod.sub_group_id)
      .single();
    const pgId = sg.product_group_id;
    const { data: pg } = await supabase
      .from("product_groups")
      .select("sub_category_id")
      .eq("id", pgId)
      .single();
    const scId = pg.sub_category_id;
    const { data: sc } = await supabase
      .from("sub_categories")
      .select("category_id")
      .eq("id", scId)
      .single();

    categorySelect.value = sc.category_id;
    await loadSubcats(categorySelect.value);
    subcategorySelect.value = scId;
    await loadGroups(subcategorySelect.value);
    groupSelect.value = pgId;
    await loadSubgroups(groupSelect.value);
    subgroupSelect.value = prod.sub_group_id;
    if (deleteBtn) deleteBtn.disabled = false;
    unsaved = false;
    loaded = true;
    // show inline delete when a product is loaded
    if (inlineDeleteBtn) {
      inlineDeleteBtn.style.display = "inline-block";
      inlineDeleteBtn.disabled = !window.CAN_EDIT;
    }
  } finally {
    hideLoading();
  }
  return loaded;
}

// ─── save / insert ────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newItem = itemInput.value.trim();
  const newMal = malInput.value.trim();
  const newStat = statusSelect.value;
  const newSg = subgroupSelect.value;
  const newPto = isPtoCheckbox ? isPtoCheckbox.checked : false;
  const newUom = uomBaseSelect ? uomBaseSelect.value || null : null;
  const newConversion =
    conversionInput && conversionInput.value !== ""
      ? Number(conversionInput.value)
      : null;
  const newIsSeasonal = isSeasonalCheckbox ? isSeasonalCheckbox.checked : false;
  const newSeasonProfile =
    seasonProfileSelect && seasonProfileSelect.value
      ? Number(seasonProfileSelect.value)
      : null;
  const newIsLlt = isLltCheckbox ? isLltCheckbox.checked : false;
  const newLeadTime =
    leadTimeInput && leadTimeInput.value !== ""
      ? parseInt(leadTimeInput.value, 10)
      : null;

  // duplicate check on new
  if (!selectedId) {
    const dup = allProducts.find(
      (p) => p.item.toLowerCase() === newItem.toLowerCase()
    );
    if (dup) {
      const edit = await showModal(
        `Product "${newItem}" exists. Edit instead?`,
        "Yes",
        "Cancel"
      );
      if (edit) {
        unsaved = false;
        return loadDetails(dup.id);
      } else {
        form.reset();
        unsaved = false;
        return;
      }
    }
  }

  if (!newItem || !newMal || !newStat || !newSg) {
    return showModal("Please fill in all fields.", "OK", "");
  }

  // conditional validations
  if (
    newUom &&
    (newConversion === null || isNaN(newConversion) || newConversion <= 0)
  ) {
    return showModal(
      "Please provide a positive Conversion To Base when UOM Base is set.",
      "OK",
      ""
    );
  }
  if (newIsSeasonal && !newSeasonProfile) {
    return showModal(
      "Please select a Season Profile when 'Seasonal' is checked.",
      "OK",
      ""
    );
  }
  if (
    newIsLlt &&
    (newLeadTime === null || isNaN(newLeadTime) || newLeadTime < 0)
  ) {
    return showModal(
      "Please provide a non-negative manufacture lead time in months.",
      "OK",
      ""
    );
  }

  // preview
  const names = [
    categorySelect.selectedOptions[0].text,
    subcategorySelect.selectedOptions[0].text,
    groupSelect.selectedOptions[0].text,
    subgroupSelect.selectedOptions[0].text,
  ];
  const msg = [
    `Save this product?`,
    ``,
    `• Item:           ${newItem}`,
    `• Malayalam name: ${newMal}`,
    `• Status:         ${newStat}`,
    `• PTO:            ${newPto ? "Yes" : "No"}`,
    `• UOM Base:       ${newUom || "None"}`,
    `• Conversion:     ${newConversion !== null ? newConversion : "—"}`,
    `• Seasonal:       ${newIsSeasonal ? "Yes" : "No"}`,
    `• Season Profile: ${
      newSeasonProfile
        ? seasonProfileSelect
          ? seasonProfileSelect.selectedOptions[0].text
          : newSeasonProfile
        : "—"
    }`,
    `• LLT:            ${newIsLlt ? "Yes" : "No"}`,
    `• Lead time (m):  ${newLeadTime !== null ? newLeadTime : "—"}`,
    `• Category:       ${names[0]}`,
    `• Sub-category:   ${names[1]}`,
    `• Group:          ${names[2]}`,
    `• Sub-group:      ${names[3]}`,
  ].join("\n");
  if (!(await showModal(msg, "Save", "Cancel"))) return;

  // perform upsert
  if (selectedId) {
    const { error } = await supabase
      .from("products")
      .update({
        item: newItem,
        malayalam_name: newMal,
        status: newStat,
        sub_group_id: newSg,
        is_pto: newPto,
        uom_base: newUom,
        conversion_to_base: newConversion,
        is_seasonal: newIsSeasonal,
        season_profile_id: newSeasonProfile,
        is_llt: newIsLlt,
        manufacture_lead_time_months: newLeadTime,
      })
      .eq("id", selectedId);
    if (error) return console.error(error);
  } else {
    const { data: inserted, error } = await supabase
      .from("products")
      .insert([
        {
          item: newItem,
          malayalam_name: newMal,
          status: newStat,
          sub_group_id: newSg,
          is_pto: newPto,
          uom_base: newUom,
          conversion_to_base: newConversion,
          is_seasonal: newIsSeasonal,
          season_profile_id: newSeasonProfile,
          is_llt: newIsLlt,
          manufacture_lead_time_months: newLeadTime,
        },
      ])
      .select("id")
      .single();
    if (error) return console.error(error);
    if (inserted && inserted.id) selectedId = inserted.id;
  }

  // clear filter and reload everything; if we just inserted, open that item
  searchInput.value = "";
  await loadProducts();
  if (selectedId) {
    await loadDetails(selectedId);
  } else {
    await loadDetails(null);
  }

  // if we were in New-mode, exit it and restore UI state
  if (inNewMode) {
    inNewMode = false;
    previousSelectedId = null;
    unsaved = false;
    if (editToggleBtn) editToggleBtn.disabled = !window.CAN_EDIT;
    setEditing(false);
  }
});

// wire the inline SVG save/cancel buttons
if (saveIconBtn) {
  saveIconBtn.addEventListener("click", () => {
    // delegate to the form submit flow (which shows preview modal)
    try {
      form.requestSubmit();
    } catch {
      // fallback for older browsers
      const ev = new Event("submit", { cancelable: true });
      form.dispatchEvent(ev);
    }
  });
}
if (cancelIconBtn) {
  cancelIconBtn.addEventListener("click", async () => {
    // discard unsaved changes: handle New-mode specially, otherwise reload current product
    if (!selectedId) {
      if (inNewMode) {
        const ok = await showModal("Discard new product?", "Discard", "Cancel");
        if (!ok) return;
        inNewMode = false;
        unsaved = false;
        updateDirtyIcons();
        const prev = previousSelectedId;
        previousSelectedId = null;
        if (prev) {
          await loadDetails(prev);
        } else {
          form.reset();
        }
        if (editToggleBtn) editToggleBtn.disabled = !window.CAN_EDIT;
        return;
      }
      form.reset();
      unsaved = false;
      updateDirtyIcons();
      return;
    }
    // confirm discard once, then clear unsaved BEFORE reloading details
    const ok = await showModal("Discard changes?", "Discard", "Cancel");
    if (!ok) return;
    // clear unsaved so loadDetails doesn't prompt again
    unsaved = false;
    updateDirtyIcons();
    await loadDetails(selectedId);
  });
}

// (global footer Delete removed) — use inline delete icon `inlineDeleteBtn` instead.

// (global +New removed) — use the inline New control `newInlineBtn` instead.

// Inline New button (next to Edit) — behaves like global New but keeps track of previous selection
if (newInlineBtn) {
  newInlineBtn.addEventListener("click", async () => {
    if (!window.CAN_EDIT) {
      showToast("You do not have permission to create products.");
      return;
    }
    if (unsaved) {
      const ok = await showModal(
        "You have unsaved changes. Discard and create a new product?",
        "Discard",
        "Cancel"
      );
      if (!ok) return;
    }
    // remember current selection so Cancel can restore it
    previousSelectedId = selectedId;
    selectedId = null;
    inNewMode = true;
    form.reset();
    if (isPtoCheckbox) isPtoCheckbox.checked = false;
    if (uomBaseSelect) uomBaseSelect.value = "";
    if (conversionInput) conversionInput.value = "";
    if (isSeasonalCheckbox) isSeasonalCheckbox.checked = false;
    if (seasonProfileSelect) seasonProfileSelect.value = "";
    if (isLltCheckbox) isLltCheckbox.checked = false;
    if (leadTimeInput) leadTimeInput.value = "";
    if (deleteBtn) deleteBtn.disabled = true;
    unsaved = false;
    // hide/disable the edit toggle while creating new
    if (editToggleBtn) editToggleBtn.disabled = true;
    setEditing(true);
    if (itemInput) itemInput.focus();
    updateDirtyIcons();
  });
}

// Inline delete icon handler (appears when a product is selected)
if (inlineDeleteBtn) {
  inlineDeleteBtn.addEventListener("click", async () => {
    if (!selectedId) return;
    // show confirmation modal; Cancel should restore saved values
    const ok = await showModal(
      "Delete this product? This action cannot be undone.",
      "Delete",
      "Cancel"
    );
    if (!ok) {
      // restore saved data (clear unsaved first to avoid nested prompts)
      unsaved = false;
      updateDirtyIcons();
      await loadDetails(selectedId);
      return;
    }
    // perform deletion
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", selectedId);
    if (error) {
      console.error(error);
      showToast("Failed to delete product");
      return;
    }
    showToast("Product deleted");
    // reload list and clear details
    await loadProducts();
    await loadDetails(null);
  });
}

// ─── sidebar click & live search ─────────────────────────
productList.addEventListener("click", async (e) => {
  const li = e.target.closest("li");
  if (li) {
    const id = Number(li.dataset.id);
    const ok = await loadDetails(id);
    if (ok) {
      // Exit any New-mode state and ensure the edit toggle is available
      inNewMode = false;
      previousSelectedId = null;
      if (editToggleBtn) editToggleBtn.disabled = !window.CAN_EDIT;
      setEditing(false);
      // clear keyboard highlight when a real product is loaded
      keyboardIndex = -1;
      Array.from(productList.querySelectorAll("li.focused")).forEach((n) =>
        n.classList.remove("focused")
      );
      // set activedescendant for assistive tech to the clicked option
      if (productList)
        productList.setAttribute("aria-activedescendant", `product-${id}`);
    }
  }
});
searchInput.addEventListener("input", () => {
  // clear any prior keyboard highlight when the user types
  keyboardIndex = -1;
  if (productList) {
    Array.from(productList.querySelectorAll("li.focused")).forEach((n) =>
      n.classList.remove("focused")
    );
    productList.removeAttribute("aria-activedescendant");
  }
  // show/hide clear button
  try {
    if (clearSearchBtn) {
      if (searchInput.value && searchInput.value.trim()) {
        clearSearchBtn.classList.add("visible");
        clearSearchBtn.setAttribute("aria-hidden", "false");
      } else {
        clearSearchBtn.classList.remove("visible");
        clearSearchBtn.setAttribute("aria-hidden", "true");
      }
    }
  } catch (e) {
    console.error(e);
  }
  applyFilter();
});

// clear button behaviour
if (clearSearchBtn) {
  clearSearchBtn.addEventListener("click", (e) => {
    e.preventDefault();
    try {
      searchInput.value = "";
      clearSearchBtn.classList.remove("visible");
      clearSearchBtn.setAttribute("aria-hidden", "true");
      // clear keyboard highlight
      keyboardIndex = -1;
      if (productList) {
        Array.from(productList.querySelectorAll("li.focused")).forEach((n) =>
          n.classList.remove("focused")
        );
        productList.removeAttribute("aria-activedescendant");
      }
      applyFilter();
      searchInput.focus();
    } catch (err) {
      console.error(err);
    }
  });
}

// Keyboard navigation for the filtered list (arrow up/down + Enter)
searchInput.addEventListener("keydown", (e) => {
  if (!productList) return;
  const lis = Array.from(productList.querySelectorAll("li"));
  if (!lis.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (keyboardIndex < 0) keyboardIndex = 0;
    else keyboardIndex = Math.min(keyboardIndex + 1, lis.length - 1);
    updateKeyboardHighlight(lis, keyboardIndex);
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (keyboardIndex < 0) keyboardIndex = lis.length - 1;
    else keyboardIndex = Math.max(keyboardIndex - 1, 0);
    updateKeyboardHighlight(lis, keyboardIndex);
    return;
  }
  if (e.key === "Enter") {
    if (keyboardIndex >= 0 && keyboardIndex < lis.length) {
      e.preventDefault();
      const id = Number(lis[keyboardIndex].dataset.id);
      // load details for the highlighted item
      loadDetails(id).then((ok) => {
        if (ok) setEditing(false);
      });
    }
  }
  if (e.key === "Escape") {
    keyboardIndex = -1;
    Array.from(productList.querySelectorAll("li.focused")).forEach((n) =>
      n.classList.remove("focused")
    );
  }
});

function updateKeyboardHighlight(lis, idx) {
  // remove prior focused state and aria-selected on non-selected items
  lis.forEach((li) => {
    li.classList.remove("focused");
    // only unset aria-selected for keyboard navigation; the actual selectedId retains selection
    if (Number(li.dataset.id) !== selectedId)
      li.setAttribute("aria-selected", "false");
  });
  if (idx >= 0 && idx < lis.length) {
    const node = lis[idx];
    node.classList.add("focused");
    node.setAttribute("aria-selected", "true");
    // set activedescendant on the listbox for assistive tech
    if (productList) productList.setAttribute("aria-activedescendant", node.id);
    node.scrollIntoView({ block: "nearest", behavior: "auto" });
  } else {
    if (productList) productList.removeAttribute("aria-activedescendant");
  }
}

// ─── unsaved tracker ─────────────────────────────────────
[
  itemInput,
  malInput,
  statusSelect,
  categorySelect,
  subcategorySelect,
  groupSelect,
  subgroupSelect,
].forEach((el) => el.addEventListener("input", () => (unsaved = true)));

// ensure dirty icon visibility updates when inputs change
[
  itemInput,
  malInput,
  statusSelect,
  categorySelect,
  subcategorySelect,
  groupSelect,
  subgroupSelect,
  isPtoCheckbox,
  uomBaseSelect,
  conversionInput,
  isSeasonalCheckbox,
  seasonProfileSelect,
  isLltCheckbox,
  leadTimeInput,
].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", () => {
    unsaved = true;
    updateDirtyIcons();
  });
  el.addEventListener("change", () => {
    unsaved = true;
    updateDirtyIcons();
  });
});

if (isPtoCheckbox)
  isPtoCheckbox.addEventListener("input", () => (unsaved = true));
if (uomBaseSelect)
  uomBaseSelect.addEventListener("change", () => {
    if (conversionInput) conversionInput.disabled = !uomBaseSelect.value;
    unsaved = true;
  });
if (conversionInput)
  conversionInput.addEventListener("input", () => (unsaved = true));
if (isSeasonalCheckbox)
  isSeasonalCheckbox.addEventListener("input", () => {
    if (seasonProfileSelect)
      seasonProfileSelect.disabled = !isSeasonalCheckbox.checked;
    unsaved = true;
  });
if (seasonProfileSelect)
  seasonProfileSelect.addEventListener("change", () => (unsaved = true));
if (isLltCheckbox)
  isLltCheckbox.addEventListener("input", () => {
    if (leadTimeInput) leadTimeInput.disabled = !isLltCheckbox.checked;
    unsaved = true;
  });
if (leadTimeInput)
  leadTimeInput.addEventListener("input", () => (unsaved = true));

async function loadSeasonProfiles() {
  if (!seasonProfileSelect) return;
  seasonProfileSelect.innerHTML =
    '<option value="">-- Select profile --</option>';
  const { data, error } = await supabase
    .from("season_profile")
    .select("id, label, entity_kind")
    .eq("entity_kind", "product")
    .order("label");
  if (error) return console.error(error);
  data.forEach((p) => {
    const text = p.entity_kind ? `${p.label} (${p.entity_kind})` : p.label;
    seasonProfileSelect.add(new Option(text, p.id));
  });
}

// ─── HOME nav ────────────────────────────────────────────
homeBtn.addEventListener("click", async () => {
  if (
    unsaved &&
    !(await showModal("You have unsaved changes. Leave anyway?", "Yes", "No"))
  )
    return;
  window.location.href = "index.html";
});

// ─── initialize ──────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  await loadClassifications();
  await loadSeasonProfiles();
  await loadProducts();
  loadDetails(null);
  // ensure dependent controls reflect current state
  if (conversionInput)
    conversionInput.disabled = !(uomBaseSelect && uomBaseSelect.value);
  if (seasonProfileSelect)
    seasonProfileSelect.disabled = !(
      isSeasonalCheckbox && isSeasonalCheckbox.checked
    );
  if (leadTimeInput)
    leadTimeInput.disabled = !(isLltCheckbox && isLltCheckbox.checked);
  // initialize clear search button visibility
  try {
    if (clearSearchBtn) {
      if (searchInput.value && searchInput.value.trim()) {
        clearSearchBtn.classList.add("visible");
        clearSearchBtn.setAttribute("aria-hidden", "false");
      } else {
        clearSearchBtn.classList.remove("visible");
        clearSearchBtn.setAttribute("aria-hidden", "true");
      }
    }
  } catch (e) {
    console.error(e);
  }
  // determine edit permission from Supabase auth/profile
  window.CAN_EDIT = false;
  try {
    const { data } = await supabase.auth.getUser();
    const user = data ? data.user : null;
    if (user) {
      let role = null;
      // try `profiles` table first (common pattern)
      try {
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (!pErr && profile && profile.role) role = profile.role;
      } catch (e) {
        console.error(e);
      }
      // fallback: try `user_roles` table if present
      if (!role) {
        try {
          const { data: ur, error: urErr } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .single();
          if (!urErr && ur && ur.role) role = ur.role;
        } catch (e) {
          console.error(e);
        }
      }
      // as a last resort check JWT metadata which some projects use
      if (!role) {
        try {
          const maybeRole =
            (user.user_metadata && user.user_metadata.role) ||
            (user.user_metadata &&
              user.user_metadata.roles &&
              user.user_metadata.roles[0]) ||
            (user.app_metadata && user.app_metadata.role) ||
            (user.app_metadata &&
              user.app_metadata.roles &&
              user.app_metadata.roles[0]);
          if (maybeRole) role = maybeRole;
        } catch (e) {
          console.error(e);
        }
      }

      // normalize and evaluate role (case-insensitive)
      const r = role ? String(role).toLowerCase() : null;
      window.CAN_EDIT =
        !!r && ["admin", "editor", "product_manager"].includes(r);
      try {
        console.debug &&
          console.debug("products.js: detected role state", {
            userId: user && user.id,
            rawRole: role,
            normalized: r,
            CAN_EDIT: window.CAN_EDIT,
          });
      } catch {
        /* ignore logging errors */
      }
    }
  } catch (e) {
    console.error(e);
    window.CAN_EDIT = false;
  }
  // initialize edit toggle and refresh inline controls according to permission
  if (editToggleBtn) {
    // disable toggle if no privilege OR when no product selected
    editToggleBtn.disabled = !window.CAN_EDIT || !selectedId;
    if (!window.CAN_EDIT) {
      editToggleBtn.title = "You do not have edit permission";
    } else if (!selectedId) {
      editToggleBtn.title = "Select a product to enable edit";
    }
    editToggleBtn.addEventListener("click", () => {
      if (!window.CAN_EDIT) {
        showToast("You do not have permission to edit products.");
        return;
      }
      // Toggle and immediately enforce editing state. Reapply a couple
      // times shortly after to avoid races with other async updates.
      const target = !editing;
      setEditing(target);
      setTimeout(() => setEditing(target), 80);
      setTimeout(() => setEditing(target), 300);
    });
  }

  // ensure any inline delete/save controls reflect current permission
  try {
    if (inlineDeleteBtn && inlineDeleteBtn.style.display !== "none")
      inlineDeleteBtn.disabled = !window.CAN_EDIT;
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.disabled = !window.CAN_EDIT;
  } catch (e) {
    console.error(e);
  }
  // start in view-only mode
  setEditing(false);
});
