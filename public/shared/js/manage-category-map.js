import { supabase } from "./supabaseClient.js";
import { $, toast, confirmDialog } from "./ui-helpers.js";

// Elements
const treeContainer = $("#treeContainer");
// Removed category creation form (DB constraint restricts top-level categories)
const btnRefreshTree = $("#btnRefreshTree");
const btnCollapseAll = $("#btnCollapseAll");
const btnExpandAll = $("#btnExpandAll");

const q = $("#q");
const selectedNodeBadge = $("#selectedNodeBadge");
const btnClearNode = $("#btnClearNode");
const btnReloadItems = $("#btnReloadItems");
const tbl = $("#tblItems");
const tbody = tbl.querySelector("tbody");
const chkAll = $("#chkAll");
const rowCount = $("#rowCount");

const bulkCat = $("#bulkCat");
const bulkSub = $("#bulkSub");
const bulkGrp = $("#bulkGrp");
const bulkSgrp = $("#bulkSgrp");
const btnBulkAssign = $("#btnBulkAssign");
const btnBulkClear = $("#btnBulkClear");
const btnBulkPreview = $("#btnBulkPreview");
const btnBulkReset = $("#btnBulkReset");
const bulkPreview = $("#bulkPreview");
const bulkPreviewBody = $("#bulkPreviewBody");

let cacheCat = [],
  cacheSub = [],
  cacheGrp = [],
  cacheSGrp = [];
let selectedNode = null; // {level:'cat'|'sub'|'grp'|'sgrp', id:number}
// Pagination state
let currentPage = 1;
let pageSize = 50; // default page size
let totalItems = 0;
let totalPages = 1;
let itemsPage = []; // current page rows
// Floating tooltip element (created lazily)
let treeTooltipEl = null;
let treeTooltipTimer = null;
let treeTooltipVisible = false;
// Track currently open node menu (for layering and accessibility)
let openMenu = null;
let openMenuTrigger = null;
function ensureTreeTooltip() {
  if (!treeTooltipEl) {
    treeTooltipEl = document.createElement("div");
    treeTooltipEl.id = "treeFloatingTooltip";
    treeTooltipEl.style.position = "fixed";
    treeTooltipEl.style.pointerEvents = "none";
    treeTooltipEl.style.zIndex = "4000";
    treeTooltipEl.style.background = "#0f172a";
    treeTooltipEl.style.color = "#f1f5f9";
    treeTooltipEl.style.fontSize = "11px";
    treeTooltipEl.style.lineHeight = "1.4";
    treeTooltipEl.style.padding = "8px 10px";
    treeTooltipEl.style.borderRadius = "6px";
    treeTooltipEl.style.boxShadow = "0 4px 12px rgba(0,0,0,.18)";
    treeTooltipEl.style.opacity = "0";
    treeTooltipEl.style.transition = "opacity .15s ease";
    treeTooltipEl.style.whiteSpace = "pre";
    document.body.appendChild(treeTooltipEl);
  }
  return treeTooltipEl;
}

// Close any open node action menus (dropdowns) in the taxonomy tree
function closeAllMenus() {
  // Close globally managed menu and restore to original parent
  if (openMenu) {
    openMenu.style.display = "none";
    openMenu.style.position = "absolute";
    openMenu.style.visibility = "";
    openMenu.style.left = "";
    openMenu.style.top = "";
    openMenu.style.right = "0";
    openMenu.style.marginTop = "6px";
    if (openMenu._originalParent && openMenu._originalParent.isConnected) {
      openMenu._originalParent.appendChild(openMenu);
    }
    openMenu = null;
  }
  if (openMenuTrigger) {
    openMenuTrigger.setAttribute("aria-expanded", "false");
    openMenuTrigger = null;
  }
}

function positionAndShowMenu(panel, triggerBtn) {
  // Move to body for top-most layering
  if (!panel._originalParent) panel._originalParent = panel.parentElement;
  document.body.appendChild(panel);
  panel.style.position = "fixed";
  panel.style.display = "block";
  panel.style.visibility = "hidden"; // measure first
  panel.style.zIndex = "100000";

  const rect = triggerBtn.getBoundingClientRect();
  const vw = window.innerWidth;
  const gap = 6;
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  let left = rect.right - pw; // align right edges
  let top = rect.bottom + gap;
  if (left < 4) left = 4;
  if (top + ph > window.innerHeight - 4) {
    // if bottom overflows, try opening upward
    const upTop = rect.top - ph - gap;
    if (upTop >= 4) top = upTop;
  }
  if (left + pw > vw - 4) left = vw - pw - 4;

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.right = ""; // not used when fixed-positioned
  panel.style.marginTop = "0";
  panel.style.visibility = "";
}

function focusFirstMenuItem(panel) {
  const items = Array.from(panel.querySelectorAll("button"));
  const first = items.find((b) => !b.classList.contains("node-menu-trigger"));
  if (first) first.focus();
}

function getMenuItems(panel) {
  return Array.from(panel.querySelectorAll("button"));
}

// ---------- Lightweight modal forms (to avoid window.prompt) ----------
async function showFormDialog({
  title = "",
  submitLabel = "Save",
  fields = [
    // { name: 'code', label: 'Code', value: '', placeholder: '', required: true }
  ],
}) {
  return new Promise((resolve) => {
    // Overlay
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(15,23,42,0.35)";
    overlay.style.zIndex = "200000";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    // Dialog
    const dialog = document.createElement("div");
    dialog.role = "dialog";
    dialog.ariaModal = "true";
    dialog.style.background = "#ffffff";
    dialog.style.border = "1px solid #e2e8f0";
    dialog.style.borderRadius = "10px";
    dialog.style.boxShadow = "0 20px 40px rgba(2,6,23,0.2)";
    dialog.style.minWidth = "320px";
    dialog.style.maxWidth = "92vw";
    dialog.style.padding = "14px 16px";
    dialog.style.color = "#0f172a";

    const h = document.createElement("div");
    h.textContent = title || "";
    h.style.fontWeight = "600";
    h.style.fontSize = "14px";
    h.style.marginBottom = "10px";
    h.id = "formDialogTitle";
    dialog.setAttribute("aria-labelledby", h.id);
    dialog.appendChild(h);

    const form = document.createElement("form");
    form.addEventListener("submit", (e) => e.preventDefault());

    const inputs = [];
    fields.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.style.margin = "8px 0";
      const labelEl = document.createElement("label");
      labelEl.textContent = f.label || f.name;
      labelEl.style.display = "block";
      labelEl.style.fontSize = "12px";
      labelEl.style.color = "#475569";
      labelEl.style.marginBottom = "4px";
      const input = document.createElement("input");
      input.type = "text";
      input.name = f.name;
      input.value = f.value || "";
      if (f.placeholder) input.placeholder = f.placeholder;
      input.style.width = "100%";
      input.style.padding = "8px 10px";
      input.style.border = "1px solid #cbd5e1";
      input.style.borderRadius = "6px";
      input.style.fontSize = "13px";
      wrap.appendChild(labelEl);
      wrap.appendChild(input);
      form.appendChild(wrap);
      inputs.push({ def: f, el: input });
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.marginTop = "12px";

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Cancel";
    btnCancel.className = "ghost";
    btnCancel.style.padding = "8px 12px";
    btnCancel.style.border = "1px solid #e2e8f0";
    btnCancel.style.borderRadius = "6px";
    btnCancel.addEventListener("click", () => closeModal(null));

    const btnOk = document.createElement("button");
    btnOk.type = "submit";
    btnOk.textContent = submitLabel || "Save";
    btnOk.className = "primary";
    btnOk.style.padding = "8px 12px";
    btnOk.style.border = "1px solid #0ea5e9";
    btnOk.style.background = "#0ea5e9";
    btnOk.style.color = "#ffffff";
    btnOk.style.borderRadius = "6px";
    btnOk.addEventListener("click", () => {
      // Validate required
      const out = {};
      for (const { def, el } of inputs) {
        const v = (el.value || "").trim();
        if (def.required && !v) {
          el.focus();
          toast(`${def.label || def.name} is required`, "error");
          return;
        }
        out[def.name] = v;
      }
      closeModal(out);
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);
    form.appendChild(actions);
    dialog.appendChild(form);

    const closeOnEsc = (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeModal(null);
      }
    };
    const closeOnOutside = (ev) => {
      if (!dialog.contains(ev.target)) closeModal(null);
    };

    function closeModal(result) {
      document.removeEventListener("keydown", closeOnEsc, true);
      overlay.removeEventListener("click", closeOnOutside, true);
      overlay.remove();
      resolve(result);
    }

    overlay.addEventListener("click", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEsc, true);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus first input
    setTimeout(() => {
      const first = dialog.querySelector("input");
      if (first) first.focus();
    }, 0);
  });
}

// ---------- Load taxonomy ----------
async function loadTaxonomy() {
  const [cat, sub, grp, sgrp] = await Promise.all([
    supabase
      .from("inv_class_category")
      .select("id, code, label, sort_order")
      .order("sort_order", { ascending: true })
      .order("code"),
    supabase
      .from("inv_class_subcategory")
      .select("id, category_id, code, label")
      .order("code"),
    supabase
      .from("inv_class_group")
      .select("id, subcategory_id, code, label")
      .order("code"),
    supabase
      .from("inv_class_subgroup")
      .select("id, group_id, code, label")
      .order("code"),
  ]);
  if (cat.error) throw cat.error;
  if (sub.error) throw sub.error;
  if (grp.error) throw grp.error;
  if (sgrp.error) throw sgrp.error;

  cacheCat = cat.data || [];
  cacheSub = sub.data || [];
  cacheGrp = grp.data || [];
  cacheSGrp = sgrp.data || [];

  renderTree();
  fillBulkSelectors();
}

function fillBulkSelectors() {
  bulkCat.innerHTML =
    `<option value="">(none)</option>` +
    cacheCat
      .map((c) => `<option value="${c.id}">${c.code} — ${c.label}</option>`)
      .join("");
  bulkSub.innerHTML = `<option value="">(none)</option>`;
  bulkGrp.innerHTML = `<option value="">(none)</option>`;
  bulkSgrp.innerHTML = `<option value="">(none)</option>`;
}
bulkCat.addEventListener("change", () => {
  const catId = bulkCat.value || null;
  const subs = cacheSub.filter((s) => String(s.category_id) === String(catId));
  bulkSub.innerHTML =
    `<option value="">(none)</option>` +
    subs
      .map((s) => `<option value="${s.id}">${s.code} — ${s.label}</option>`)
      .join("");
  bulkGrp.innerHTML = `<option value="">(none)</option>`;
  bulkSgrp.innerHTML = `<option value="">(none)</option>`;
});
bulkSub.addEventListener("change", () => {
  const subId = bulkSub.value || null;
  const grps = cacheGrp.filter(
    (g) => String(g.subcategory_id) === String(subId)
  );
  bulkGrp.innerHTML =
    `<option value="">(none)</option>` +
    grps
      .map((g) => `<option value="${g.id}">${g.code} — ${g.label}</option>`)
      .join("");
  bulkSgrp.innerHTML = `<option value="">(none)</option>`;
});
bulkGrp.addEventListener("change", () => {
  const grpId = bulkGrp.value || null;
  const sgs = cacheSGrp.filter((x) => String(x.group_id) === String(grpId));
  bulkSgrp.innerHTML =
    `<option value="">(none)</option>` +
    sgs
      .map((x) => `<option value="${x.id}">${x.code} — ${x.label}</option>`)
      .join("");
});

// ---------- Counts for guardrails ----------
async function countsForNode(level, id) {
  // Children + mapped items count
  if (level === "cat") {
    const [childSub, mapped] = await Promise.all([
      supabase
        .from("inv_class_subcategory")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id),
      supabase
        .from("inv_stock_item_class_map")
        .select("stock_item_id", { count: "exact", head: true })
        .eq("category_id", id),
    ]);
    return { children: childSub.count || 0, mapped: mapped.count || 0 };
  }
  if (level === "sub") {
    const [childGrp, mapped] = await Promise.all([
      supabase
        .from("inv_class_group")
        .select("id", { count: "exact", head: true })
        .eq("subcategory_id", id),
      supabase
        .from("inv_stock_item_class_map")
        .select("stock_item_id", { count: "exact", head: true })
        .eq("subcategory_id", id),
    ]);
    return { children: childGrp.count || 0, mapped: mapped.count || 0 };
  }
  if (level === "grp") {
    const [childSgrp, mapped] = await Promise.all([
      supabase
        .from("inv_class_subgroup")
        .select("id", { count: "exact", head: true })
        .eq("group_id", id),
      supabase
        .from("inv_stock_item_class_map")
        .select("stock_item_id", { count: "exact", head: true })
        .eq("group_id", id),
    ]);
    return { children: childSgrp.count || 0, mapped: mapped.count || 0 };
  }
  if (level === "sgrp") {
    const mapped = await supabase
      .from("inv_stock_item_class_map")
      .select("stock_item_id", { count: "exact", head: true })
      .eq("subgroup_id", id);
    return { children: 0, mapped: mapped.count || 0 };
  }
  return { children: 0, mapped: 0 };
}

// ---------- Tree rendering ----------
// Maintain expansion state across re-renders
const expanded = new Set(); // keys like cat-12, sub-55, grp-90

function loadExpandedFromStorage() {
  try {
    const raw = localStorage.getItem("taxonomyTreeExpanded");
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      expanded.clear();
      arr.forEach((k) => typeof k === "string" && expanded.add(k));
    }
  } catch {
    // ignore storage parse errors
  }
}
function saveExpandedToStorage() {
  try {
    localStorage.setItem("taxonomyTreeExpanded", JSON.stringify([...expanded]));
  } catch {
    // ignore storage write errors
  }
}

function toggleExpansion(key) {
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
}

function isExpanded(key) {
  return expanded.has(key);
}

function renderTree() {
  const ul = document.createElement("ul");
  cacheCat.forEach((c) => {
    const li = document.createElement("li");
    const key = `cat-${c.id}`;
    const catHasChildren = cacheSub.some((s) => s.category_id === c.id);
    li.innerHTML = nodeHTML(
      "cat",
      c.id,
      c.code,
      c.label,
      catHasChildren,
      isExpanded(key)
    );
    if (catHasChildren) {
      const subWrap = document.createElement("div");
      subWrap.className = "children";
      if (!isExpanded(key)) subWrap.style.display = "none";
      const subUl = document.createElement("ul");
      cacheSub
        .filter((s) => s.category_id === c.id)
        .forEach((s) => {
          const sli = document.createElement("li");
          const skey = `sub-${s.id}`;
          const subHasChildren = cacheGrp.some(
            (g) => g.subcategory_id === s.id
          );
          sli.innerHTML = nodeHTML(
            "sub",
            s.id,
            s.code,
            s.label,
            subHasChildren,
            isExpanded(skey)
          );
          if (subHasChildren) {
            const grpWrap = document.createElement("div");
            grpWrap.className = "children";
            if (!isExpanded(skey)) grpWrap.style.display = "none";
            const grpUl = document.createElement("ul");
            cacheGrp
              .filter((g) => g.subcategory_id === s.id)
              .forEach((g) => {
                const gli = document.createElement("li");
                const gkey = `grp-${g.id}`;
                const grpHasChildren = cacheSGrp.some(
                  (x) => x.group_id === g.id
                );
                gli.innerHTML = nodeHTML(
                  "grp",
                  g.id,
                  g.code,
                  g.label,
                  grpHasChildren,
                  isExpanded(gkey)
                );
                if (grpHasChildren) {
                  const sgrpWrap = document.createElement("div");
                  sgrpWrap.className = "children";
                  if (!isExpanded(gkey)) sgrpWrap.style.display = "none";
                  const sgrpUl = document.createElement("ul");
                  cacheSGrp
                    .filter((x) => x.group_id === g.id)
                    .forEach((x) => {
                      const xli = document.createElement("li");
                      xli.innerHTML = nodeHTML(
                        "sgrp",
                        x.id,
                        x.code,
                        x.label,
                        false,
                        false
                      );
                      sgrpUl.appendChild(xli);
                    });
                  sgrpWrap.appendChild(sgrpUl);
                  gli.appendChild(sgrpWrap);
                }
                grpUl.appendChild(gli);
              });
            grpWrap.appendChild(grpUl);
            sli.appendChild(grpWrap);
          }
          subUl.appendChild(sli);
        });
      subWrap.appendChild(subUl);
      li.appendChild(subWrap);
    }
    ul.appendChild(li);
  });
  treeContainer.innerHTML = "";
  treeContainer.appendChild(ul);

  // bind clicks
  treeContainer.querySelectorAll("[data-node]").forEach((el) => {
    el.addEventListener("click", onNodeSelect);
  });
  treeContainer.querySelectorAll("[data-add]").forEach((el) => {
    el.addEventListener("click", onAddChild);
  });
  treeContainer.querySelectorAll("[data-edit]").forEach((el) => {
    el.addEventListener("click", onEditNode);
  });
  treeContainer.querySelectorAll("[data-del]").forEach((el) => {
    el.addEventListener("click", onDeleteNode);
  });
  treeContainer.querySelectorAll("[data-toggle]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = el.dataset.toggle;
      toggleExpansion(key);
      saveExpandedToStorage();
      // Toggle this branch in-place to preserve counts and bindings
      const li = el.closest("li");
      const branch = li && li.querySelector(":scope > .children");
      const svg = el.querySelector("svg");
      if (branch) {
        const willShow = branch.style.display === "none";
        branch.style.display = willShow ? "" : "none";
        if (svg) svg.style.transform = `rotate(${willShow ? 90 : 0}deg)`;
      }
    });
  });

  // Node menu triggers (accessible & body-layered)
  treeContainer.querySelectorAll(".node-menu-trigger").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.menu;
      // Toggle behavior: close if this is already open
      if (openMenu && openMenuTrigger === btn) {
        closeAllMenus();
        return;
      }
      closeAllMenus();
      const panel = treeContainer.querySelector(
        `.menu-panel[data-panel="${id}"]`
      );
      if (!panel) return;
      openMenu = panel;
      openMenuTrigger = btn;
      btn.setAttribute("aria-expanded", "true");
      positionAndShowMenu(panel, btn);
      focusFirstMenuItem(panel);
    });
  });
  if (!window.__taxonomyMenuGlobalBound) {
    // close on outside click
    document.addEventListener("click", (ev) => {
      if (!openMenu) return;
      const t = ev.target;
      if (
        openMenu &&
        !openMenu.contains(t) &&
        openMenuTrigger &&
        t !== openMenuTrigger &&
        !openMenuTrigger.contains(t)
      ) {
        closeAllMenus();
      }
    });
    // close on focus leaving the menu/trigger
    document.addEventListener(
      "focusin",
      (ev) => {
        if (!openMenu) return;
        const t = ev.target;
        if (
          openMenu &&
          !openMenu.contains(t) &&
          openMenuTrigger &&
          t !== openMenuTrigger &&
          !openMenuTrigger.contains(t)
        ) {
          closeAllMenus();
        }
      },
      true
    );
    // keyboard handling: Esc to close, arrows to navigate
    document.addEventListener("keydown", (ev) => {
      if (!openMenu) return;
      const items = getMenuItems(openMenu).filter(
        (b) => !b.classList.contains("node-menu-trigger")
      );
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeAllMenus();
        if (openMenuTrigger) openMenuTrigger.focus();
        return;
      }
      if (!items.length) return;
      const active = document.activeElement;
      let idx = Math.max(0, items.indexOf(active));
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        idx = (idx + 1) % items.length;
        items[idx].focus();
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        idx = (idx - 1 + items.length) % items.length;
        items[idx].focus();
      } else if (ev.key === "Home") {
        ev.preventDefault();
        items[0].focus();
      } else if (ev.key === "End") {
        ev.preventDefault();
        items[items.length - 1].focus();
      }
    });
    // close on scroll/resize to avoid misposition
    const closeOnViewChange = () => openMenu && closeAllMenus();
    window.addEventListener("resize", closeOnViewChange, true);
    document.addEventListener("scroll", closeOnViewChange, true);
    window.__taxonomyMenuGlobalBound = true;
  }
  // (global closeAllMenus declared top-level)

  // Tooltip hover handling (label-only)
  const tooltip = ensureTreeTooltip();
  treeContainer.querySelectorAll(".node .label").forEach((labelEl) => {
    const node = labelEl.closest(".node");
    if (!node) return;
    labelEl.addEventListener("mouseenter", () => {
      const tip = node.getAttribute("data-tip");
      if (!tip) return;
      if (treeTooltipTimer) clearTimeout(treeTooltipTimer);
      tooltip.textContent = tip;
      tooltip.style.opacity = "0";
      const rect = labelEl.getBoundingClientRect();
      treeTooltipTimer = setTimeout(() => {
        const gap = 8;
        let left = rect.right + gap;
        let top = rect.top;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        document.body.appendChild(tooltip);
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        if (left + tw + 8 > vw) left = rect.left - tw - gap;
        if (top + th > vh) top = vh - th - 8;
        if (top < 4) top = 4;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        requestAnimationFrame(() => {
          tooltip.style.opacity = "1";
          treeTooltipVisible = true;
        });
      }, 150);
    });
    labelEl.addEventListener("mouseleave", () => {
      if (treeTooltipTimer) clearTimeout(treeTooltipTimer);
      treeTooltipTimer = null;
      tooltip.style.opacity = "0";
      treeTooltipVisible = false;
    });
    labelEl.addEventListener("mousemove", (e) => {
      if (!treeTooltipVisible) return;
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      const gap = 12;
      let left = e.clientX + gap;
      let top = e.clientY - th / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (left + tw + 4 > vw) left = e.clientX - tw - gap;
      if (top + th > vh) top = vh - th - 8;
      if (top < 4) top = 4;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });
  });
}

// Bulk expansion helpers
function expandAll() {
  expanded.clear();
  // Add all possible keys based on current caches
  cacheCat.forEach((c) => expanded.add(`cat-${c.id}`));
  cacheSub.forEach((s) => expanded.add(`sub-${s.id}`));
  cacheGrp.forEach((g) => expanded.add(`grp-${g.id}`));
  // subgroups are leaves; still mark to keep consistency (though they don't expand)
  cacheSGrp.forEach((x) => expanded.add(`sgrp-${x.id}`));
  saveExpandedToStorage();
  renderTree();
  refreshCounts();
}

function collapseAll() {
  expanded.clear();
  saveExpandedToStorage();
  renderTree();
  refreshCounts();
}

function nodeHTML(level, id, code, label, canExpand, expandedState) {
  // Icon set removed (no emoji); we only use label + SVG controls
  const levelInfo = {
    cat: { name: "Sub-category" },
    sub: { name: "Group" },
    grp: { name: "Sub-group" },
    sgrp: { name: "" },
  };

  const addBtn = levelInfo[level].name
    ? `<button class="ghost" data-add="${level}" data-id="${id}" title="Add child" aria-label="Add child">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
           <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
         </svg>
       </button>`
    : "";

  const toggleBtn = canExpand
    ? `<button class="toggle" data-toggle="${level}-${id}" title="${
        expandedState ? "Collapse" : "Expand"
      }">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="transform: rotate(${
          expandedState ? 90 : 0
        }deg); transition: transform .2s;">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
        </svg>
      </button>`
    : `<span class="leaf" style="width:14px;height:14px;display:inline-flex;"></span>`;

  return `
        <div class="node" data-node="${level}" data-id="${id}" data-code="${code}" data-label="${label}">
          ${toggleBtn}
          <span class="label">${label || ""}</span>
          <div class="node-menu" style="margin-left:auto; position:relative; display:inline-block;">
            <button class="ghost node-menu-trigger" data-menu="${level}-${id}" aria-label="Node actions" title="Node actions" style="padding:4px 6px;" aria-haspopup="menu" aria-expanded="false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
            <div class="menu-panel" data-panel="${level}-${id}" role="menu" style="display:none; position:absolute; right:0; top:100%; margin-top:6px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 12px 28px rgba(15,23,42,0.22); z-index:5000; padding:4px; width:fit-content; max-width:240px;">
              <button class="ghost" role="menuitem" data-edit="${level}" data-id="${id}" title="Edit" style="width:100%; justify-content:flex-start;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                Edit
              </button>
              ${addBtn
                .replace(
                  "<button",
                  '<button role="menuitem" style="width:100%; justify-content:flex-start;"'
                )
                .replace(
                  "</svg>",
                  '</svg><span style="margin-left:6px;">Add</span>'
                )}
              <button class="ghost danger" role="menuitem" data-del="${level}" data-id="${id}" title="Delete" style="width:100%; justify-content:flex-start;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      `;
}

// Fetch and show counts async
async function refreshCounts() {
  const nodes = Array.from(treeContainer.querySelectorAll("[data-node]"));
  for (const n of nodes) {
    const level = n.dataset.node;
    const id = Number(n.dataset.id);
    const { children, mapped } = await countsForNode(level, id);
    const code = n.dataset.code || "";
    const labelEl = n.querySelector(".label");
    const label = labelEl ? labelEl.textContent : n.dataset.label || "";
    const header = label ? `${label}${code ? ` (${code})` : ""}` : code;
    const tip = header
      ? `${header}\nChildren: ${children} • Mapped: ${mapped}`
      : `Children: ${children} • Mapped: ${mapped}`;
    n.setAttribute("data-tip", tip);
  }
}

// ---------- Node actions ----------
function onNodeSelect(e) {
  const wrap = e.currentTarget;

  // Remove previous selection
  document
    .querySelectorAll(".node.selected")
    .forEach((n) => n.classList.remove("selected"));

  // Add selection to current node
  wrap.classList.add("selected");

  selectedNode = {
    level: wrap.dataset.node,
    id: Number(wrap.dataset.id),
  };

  const labelText = wrap.querySelector(".label").textContent;
  const levelNames = {
    cat: "Category",
    sub: "Sub-category",
    grp: "Group",
    sgrp: "Sub-group",
  };
  selectedNodeBadge.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
    </svg>
    ${levelNames[selectedNode.level]}: ${labelText}
  `;
  // Reset to first page when taxonomy filter changes
  currentPage = 1;
  loadItems();
}

async function onAddChild(e) {
  const level = e.currentTarget.dataset.add;
  const parentId = Number(e.currentTarget.dataset.id);
  const levelNames = {
    cat: "Sub-category",
    sub: "Group",
    grp: "Sub-group",
  };
  const name = levelNames[level] || "Child";
  closeAllMenus();
  const res = await showFormDialog({
    title: `Add ${name}`,
    submitLabel: "Add",
    fields: [
      {
        name: "code",
        label: "Code",
        value: "",
        placeholder: "Required",
        required: true,
      },
      {
        name: "label",
        label: "Label",
        value: "",
        placeholder: "Required",
        required: true,
      },
    ],
  });
  if (!res) return; // cancelled
  const trimmedCode = (res.code || "").trim();
  const trimmedLabel = (res.label || "").trim();
  if (!trimmedCode) return toast("Code is required", "error");
  if (!trimmedLabel) return toast("Label is required", "error");

  if (level === "cat") {
    const { error } = await supabase.from("inv_class_subcategory").insert({
      category_id: parentId,
      code: trimmedCode,
      label: trimmedLabel,
    });
    if (error) return toast(error.message, "error");
  } else if (level === "sub") {
    const { error } = await supabase.from("inv_class_group").insert({
      subcategory_id: parentId,
      code: trimmedCode,
      label: trimmedLabel,
    });
    if (error) return toast(error.message, "error");
  } else if (level === "grp") {
    const { error } = await supabase
      .from("inv_class_subgroup")
      .insert({ group_id: parentId, code: trimmedCode, label: trimmedLabel });
    if (error) return toast(error.message, "error");
  }
  await loadTaxonomy();
  await refreshCounts();
  toast(`${name} added`, "success");
  // Close any open menus
  closeAllMenus();
}

async function onEditNode(e) {
  const level = e.currentTarget.dataset.edit;
  const id = Number(e.currentTarget.dataset.id);
  closeAllMenus();
  // find current values for placeholders
  const nodeEl = document.querySelector(
    `.node[data-node="${level}"][data-id="${id}"]`
  );
  const currentCode = nodeEl ? nodeEl.getAttribute("data-code") || "" : "";
  const currentLabel = nodeEl ? nodeEl.getAttribute("data-label") || "" : "";
  const res = await showFormDialog({
    title: "Edit Node",
    submitLabel: "Save",
    fields: [
      {
        name: "code",
        label: "New code (leave blank to keep)",
        value: "",
        placeholder: currentCode,
      },
      {
        name: "label",
        label: "New label (leave blank to keep)",
        value: "",
        placeholder: currentLabel,
      },
    ],
  });
  if (!res) return; // cancelled
  const code = (res.code || "").trim();
  const label = (res.label || "").trim();
  if (code === "" && label === "") return;

  if (level === "cat") {
    const patch = {};
    if (code) patch.code = code;
    if (label) patch.label = label;
    const { error } = await supabase
      .from("inv_class_category")
      .update(patch)
      .eq("id", id);
    if (error) return toast(error.message, "error");
  } else if (level === "sub") {
    const patch = {};
    if (code) patch.code = code;
    if (label) patch.label = label;
    const { error } = await supabase
      .from("inv_class_subcategory")
      .update(patch)
      .eq("id", id);
    if (error) return toast(error.message, "error");
  } else if (level === "grp") {
    const patch = {};
    if (code) patch.code = code;
    if (label) patch.label = label;
    const { error } = await supabase
      .from("inv_class_group")
      .update(patch)
      .eq("id", id);
    if (error) return toast(error.message, "error");
  } else if (level === "sgrp") {
    const patch = {};
    if (code) patch.code = code;
    if (label) patch.label = label;
    const { error } = await supabase
      .from("inv_class_subgroup")
      .update(patch)
      .eq("id", id);
    if (error) return toast(error.message, "error");
  }
  await loadTaxonomy();
  await refreshCounts();
  toast("Saved", "success");
  closeAllMenus();
}

async function onDeleteNode(e) {
  const level = e.currentTarget.dataset.del;
  const id = Number(e.currentTarget.dataset.id);
  const { children, mapped } = await countsForNode(level, id);
  if (children > 0) return toast("Cannot delete: node has children", "error");
  if (mapped > 0)
    return toast("Cannot delete: items are mapped to this node", "error");
  const ok = await confirmDialog("Delete this node?");
  if (!ok) return;

  let err = null;
  if (level === "cat")
    err = (await supabase.from("inv_class_category").delete().eq("id", id))
      .error;
  if (level === "sub")
    err = (await supabase.from("inv_class_subcategory").delete().eq("id", id))
      .error;
  if (level === "grp")
    err = (await supabase.from("inv_class_group").delete().eq("id", id)).error;
  if (level === "sgrp")
    err = (await supabase.from("inv_class_subgroup").delete().eq("id", id))
      .error;
  if (err) return toast(err.message, "error");

  await loadTaxonomy();
  await refreshCounts();
  if (selectedNode && selectedNode.level === level && selectedNode.id === id) {
    selectedNode = null;
    selectedNodeBadge.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
      </svg>
      No filter active
    `;
    await loadItems();
  }
  toast("Deleted", "success");
  closeAllMenus();
}

// ---------- Items ----------
async function fetchItems() {
  // Server-side pagination & filtering to overcome 1000 row cap
  const offset = (currentPage - 1) * pageSize;
  const to = offset + pageSize - 1;
  // Use inner join on map when filtering by classification to enable server-side filtering
  const useInner = Boolean(selectedNode);
  const mapSel = useInner
    ? "map:inv_stock_item_class_map!inner(category_id, subcategory_id, group_id, subgroup_id)"
    : "map:inv_stock_item_class_map(category_id, subcategory_id, group_id, subgroup_id)";
  let query = supabase
    .from("inv_stock_item")
    .select(`id, code, name, active, ${mapSel}`, { count: "exact" })
    .order("code")
    .range(offset, to);

  // Server-side classification filters
  if (selectedNode) {
    const { level, id } = selectedNode;
    if (level === "cat") query = query.eq("map.category_id", id);
    if (level === "sub") query = query.eq("map.subcategory_id", id);
    if (level === "grp") query = query.eq("map.group_id", id);
    if (level === "sgrp") query = query.eq("map.subgroup_id", id);
  }

  const qv = (q.value || "").trim();
  if (qv) {
    const pattern = `%${qv.replace(/[%_]/g, "")}%`;
    query = query.or(`code.ilike.${pattern},name.ilike.${pattern}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  totalItems = count || 0;
  totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // If page exceeds bounds (e.g., after filter reducing total), reset and refetch
  if (currentPage > totalPages) {
    currentPage = 1;
    return fetchItems();
  }
  itemsPage = (data || []).map((r) => ({
    ...r,
    map: Array.isArray(r.map) ? r.map[0] : r.map,
  }));
}

function mapBadge(map) {
  // If still an array somehow, use first
  if (Array.isArray(map)) map = map[0];
  if (!map || !map.category_id)
    return `<span class="pill" style="opacity:.6; background: #f8fafc; color: #94a3b8;">Unmapped</span>`;
  const cat = cacheCat.find((c) => c.id === map.category_id);
  const sub = cacheSub.find((s) => s.id === map.subcategory_id);
  const grp = cacheGrp.find((g) => g.id === map.group_id);
  const sgrp = cacheSGrp.find((x) => x.id === map.subgroup_id);

  const parts = [cat?.code, sub?.code, grp?.code, sgrp?.code].filter(Boolean);
  const sep = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px; margin: 0 6px;"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>`;
  return `<span class="pill" style="background: #e0f2fe; color: #0c4a6e; border-color: #0ea5e9; display:inline-flex; align-items:center;">
    ${parts.map((p) => `<span>${p}</span>`).join(sep)}
  </span>`;
}

function renderItems() {
  tbody.innerHTML = "";
  itemsPage.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td><input type="checkbox" class="chkRow" data-id="${r.id}"></td>
          <td><code>${r.code}</code></td>
          <td>${r.name ?? ""}</td>
          <td>
            <span class="pill ${
              r.active ? "success" : "muted"
            }" style="background: ${r.active ? "#dcfce7" : "#f1f5f9"}; color: ${
      r.active ? "#166534" : "#64748b"
    };">
              ${r.active ? "Active" : "Inactive"}
            </span>
          </td>
          <td>${mapBadge(r.map)}</td>
        `;
    tbody.appendChild(tr);
  });
  updateRowCount();
  updatePaginator();

  // binds
}

async function loadItems() {
  await fetchItems();
  renderItems();
}

function selectedIds() {
  return Array.from(tbody.querySelectorAll(".chkRow"))
    .filter((ch) => ch.checked)
    .map((ch) => Number(ch.dataset.id));
}

// (Row-level quick ops removed; use bulk operations instead)

// (helper removed with quick actions)

// ---------- Bulk ops ----------
async function bulkAssign() {
  const ids = selectedIds();
  if (ids.length === 0) return toast("Select at least one row", "error");
  const rows = buildBulkRows(ids);
  if (!rows) return; // buildBulkRows shows toast
  // Dry-run first to surface detailed issues before apply
  const preview = await applyBulkMap(rows, true);
  if (preview.failures && preview.failures.length) {
    renderBulkPreview(preview.raw || []);
    const firstMsg =
      preview.raw?.find((x) => !x.ok)?.message || "Validation failed";
    toast(`Preview failed: ${firstMsg}`, "error");
    return;
  }
  const { successes, clears, failures, raw } = await applyBulkMap(rows, false);
  if (failures.length) {
    const firstMsg = raw?.find((x) => !x.ok)?.message || "Apply failed";
    toast(`${failures.length} failed. ${firstMsg}`, "error");
  }
  if (successes.length) toast(`${successes.length} upserted`, "success");
  if (clears.length) toast(`${clears.length} cleared`, "success");
  await loadItems();
  await refreshCounts();
}

async function bulkClear() {
  const ids = selectedIds();
  if (ids.length === 0) return toast("Select at least one row", "error");
  const ok = await confirmDialog(`Clear mapping for ${ids.length} item(s)?`);
  if (!ok) return;
  const rows = ids.map((id) => ({ stock_item_id: id, clear: true }));
  const { failures, raw } = await applyBulkMap(rows, false);
  if (failures.length) {
    const firstMsg = raw?.find((x) => !x.ok)?.message || "Clear failed";
    toast(`${failures.length} failed. ${firstMsg}`, "error");
  }
  await loadItems();
  await refreshCounts();
  toast("Cleared", "success");
}

// ---------- RPC-based bulk map ----------
function buildBulkRows(ids) {
  let catId = bulkCat.value ? Number(bulkCat.value) : null;
  let subId = bulkSub.value ? Number(bulkSub.value) : null;
  let grpId = bulkGrp.value ? Number(bulkGrp.value) : null;
  let sgrpId = bulkSgrp.value ? Number(bulkSgrp.value) : null;
  if (!catId && !subId && !grpId && !sgrpId) {
    toast("Choose a classification in bulk selectors", "error");
    return null;
  }
  // Derive full path from deepest selection to ensure parent chain consistency
  const mismatch = (a, b) => a != null && b != null && String(a) !== String(b);
  if (sgrpId) {
    const sg = cacheSGrp.find((x) => x.id === sgrpId);
    if (!sg) return toast("Invalid sub-group selection", "error"), null;
    const g = cacheGrp.find((x) => x.id === sg.group_id);
    const s = g ? cacheSub.find((y) => y.id === g.subcategory_id) : null;
    if (mismatch(grpId, sg.group_id))
      return toast("Sub-group doesn't belong to chosen group", "error"), null;
    if (g && mismatch(subId, g.subcategory_id))
      return (
        toast(
          "Sub-group's group doesn't belong to chosen sub-category",
          "error"
        ),
        null
      );
    if (s && mismatch(catId, s.category_id))
      return (
        toast("Sub-group path conflicts with chosen category", "error"), null
      );
    grpId = sg.group_id;
    if (g) subId = g.subcategory_id;
    if (s) catId = s.category_id;
  } else if (grpId) {
    const g = cacheGrp.find((x) => x.id === grpId);
    if (!g) return toast("Invalid group selection", "error"), null;
    const s = cacheSub.find((y) => y.id === g.subcategory_id);
    if (mismatch(subId, g.subcategory_id))
      return (
        toast("Group doesn't belong to chosen sub-category", "error"), null
      );
    if (s && mismatch(catId, s.category_id))
      return toast("Group path conflicts with chosen category", "error"), null;
    subId = g.subcategory_id;
    if (s) catId = s.category_id;
  } else if (subId) {
    const s = cacheSub.find((y) => y.id === subId);
    if (!s) return toast("Invalid sub-category selection", "error"), null;
    if (mismatch(catId, s.category_id))
      return (
        toast("Sub-category doesn't belong to chosen category", "error"), null
      );
    catId = s.category_id;
  }
  return ids.map((id) => ({
    stock_item_id: id,
    category_id: catId,
    subcategory_id: subId,
    group_id: grpId,
    subgroup_id: sgrpId,
  }));
}

async function applyBulkMap(rows, dryRun = false) {
  try {
    const { data, error } = await supabase.rpc(
      "fn_bulk_upsert_item_class_map",
      {
        p_rows: rows,
        p_dry_run: dryRun,
      }
    );
    if (error) {
      const msg = error.message || "Bulk map error";
      toast(msg, "error");
      console.error("Bulk mapping RPC failed", error);
      return { successes: [], clears: [], failures: [{ error }], raw: [] };
    }
    const arr = data || [];
    const failures = arr.filter((x) => !x.ok);
    const clears = arr.filter(
      (x) => x.ok && (x.action === "cleared" || x.action === "would_clear")
    );
    const successes = arr.filter((x) => x.ok && !clears.includes(x));
    return { successes, clears, failures, raw: arr };
  } catch (ex) {
    console.error("Bulk mapping unexpected failure", ex);
    toast(ex.message || "Unexpected bulk mapping failure", "error");
    return { successes: [], clears: [], failures: [{ error: ex }], raw: [] };
  }
}

function renderBulkPreview(rows) {
  if (!rows || rows.length === 0) {
    bulkPreview.style.display = "none";
    return;
  }
  bulkPreviewBody.innerHTML = rows
    .map((r) => {
      const id = r.stock_item_id ?? r.out_stock_item_id ?? "";
      const before = formatSnapshotPath(r.before);
      const after = formatSnapshotPath(r.after);
      return `<tr>
          <td>${id}</td>
          <td>${r.action ?? ""}</td>
          <td class="${r.changed ? "ok" : "fail"}">${
        r.changed ? "Yes" : "No"
      }</td>
          <td>${before}</td>
          <td>${after}</td>
          <td>${r.message ?? ""}</td>
        </tr>`;
    })
    .join("");
  bulkPreview.style.display = "block";
}

function formatSnapshotPath(snapshot) {
  if (!snapshot) return `<span class="muted">—</span>`;
  const parts = [];
  const sep = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-2px; margin: 0 6px;"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>`;
  const addSeg = (code, label) => {
    if (!code && !label) return;
    parts.push(
      `<span class="seg"><span class="seg-label">${label ?? ""}</span>${
        code ? ` <span class="seg-code">(${code})</span>` : ""
      }</span>`
    );
  };
  const cat = snapshot.category_id
    ? cacheCat.find((c) => c.id === snapshot.category_id)
    : null;
  const sub = snapshot.subcategory_id
    ? cacheSub.find((s) => s.id === snapshot.subcategory_id)
    : null;
  const grp = snapshot.group_id
    ? cacheGrp.find((g) => g.id === snapshot.group_id)
    : null;
  const sgrp = snapshot.subgroup_id
    ? cacheSGrp.find((x) => x.id === snapshot.subgroup_id)
    : null;
  addSeg(cat?.code, cat?.label);
  addSeg(sub?.code, sub?.label);
  addSeg(grp?.code, grp?.label);
  addSeg(sgrp?.code, sgrp?.label);
  if (parts.length === 0) return `<span class="muted">Empty</span>`;
  return `<span class="path">${parts.join(sep)}</span>`;
}

// ---------- Top-level actions ----------
// Top-level category creation removed

btnRefreshTree.addEventListener("click", async () => {
  await loadTaxonomy();
  await refreshCounts();
});
btnClearNode.addEventListener("click", () => {
  // Remove selection styling
  document
    .querySelectorAll(".node.selected")
    .forEach((n) => n.classList.remove("selected"));

  selectedNode = null;
  selectedNodeBadge.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
    </svg>
    No filter active
  `;
  currentPage = 1;
  loadItems();
});
btnReloadItems.addEventListener("click", loadItems);

q.addEventListener("input", () => {
  currentPage = 1; // reset when search changes
  loadItems();
});
chkAll.addEventListener("change", () => {
  tbody
    .querySelectorAll(".chkRow")
    .forEach((ch) => (ch.checked = chkAll.checked));
});

btnBulkAssign.addEventListener("click", bulkAssign);
btnBulkClear.addEventListener("click", bulkClear);
btnBulkPreview.addEventListener("click", async () => {
  const ids = selectedIds();
  if (ids.length === 0) return toast("Select at least one row", "error");
  const rows = buildBulkRows(ids);
  if (!rows) return;
  const { raw } = await applyBulkMap(rows, true);
  renderBulkPreview(raw);
  const failures = raw.filter((x) => !x.ok);
  if (failures.length) toast(`${failures.length} issue(s) found`, "error");
  else toast("No issues. Ready to apply.", "success");
});
btnBulkReset.addEventListener("click", () => {
  // Clear selectors to defaults
  bulkCat.value = "";
  // Trigger cascading clears
  bulkCat.dispatchEvent(new Event("change"));
  bulkSub.value = "";
  bulkGrp.value = "";
  bulkSgrp.value = "";
  // Hide and clear preview
  bulkPreviewBody.innerHTML = "";
  bulkPreview.style.display = "none";
  toast("Bulk fields cleared", "success");
});

// ---------- Pagination UI ----------
function updateRowCount() {
  if (!rowCount) return;
  if (totalItems === 0) {
    rowCount.textContent = "0 items";
    return;
  }
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);
  rowCount.textContent = `${start}-${end} of ${totalItems}`;
}

function updatePaginator() {
  const pageInfo = document.getElementById("pageInfo");
  const curDisp = document.getElementById("currentPageDisplay");
  if (pageInfo) {
    if (totalItems === 0) pageInfo.textContent = "No results";
    else {
      const start = (currentPage - 1) * pageSize + 1;
      const end = Math.min(totalItems, currentPage * pageSize);
      pageInfo.textContent = `Showing ${start}-${end} of ${totalItems}`;
    }
  }
  if (curDisp) curDisp.textContent = `${currentPage} / ${totalPages}`;
  const setDisabled = (id, cond) => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = cond;
      el.style.opacity = cond ? 0.4 : 1;
      el.style.pointerEvents = cond ? "none" : "auto";
    }
  };
  setDisabled("btnFirstPage", currentPage === 1);
  setDisabled("btnPrevPage", currentPage === 1);
  setDisabled("btnNextPage", currentPage === totalPages);
  setDisabled("btnLastPage", currentPage === totalPages);
  const sizeSel = document.getElementById("pageSizeSel");
  if (sizeSel && Number(sizeSel.value) !== pageSize)
    sizeSel.value = String(pageSize);
}

function goToPage(p) {
  const target = Math.min(Math.max(1, p), totalPages);
  if (target === currentPage) return;
  currentPage = target;
  loadItems();
}

function initPaginatorControls() {
  const sizeSel = document.getElementById("pageSizeSel");
  if (sizeSel) {
    sizeSel.addEventListener("change", () => {
      pageSize = parseInt(sizeSel.value, 10) || 50;
      currentPage = 1;
      loadItems();
    });
  }
  const first = document.getElementById("btnFirstPage");
  const prev = document.getElementById("btnPrevPage");
  const next = document.getElementById("btnNextPage");
  const last = document.getElementById("btnLastPage");
  first && first.addEventListener("click", () => goToPage(1));
  prev && prev.addEventListener("click", () => goToPage(currentPage - 1));
  next && next.addEventListener("click", () => goToPage(currentPage + 1));
  last && last.addEventListener("click", () => goToPage(totalPages));
  updatePaginator();
}

// ---------- Boot ----------
(function init() {
  loadExpandedFromStorage();
})();
(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return (window.location.href = "login.html");
  // Initialize paginator controls now that DOM is ready
  initPaginatorControls();
  await loadTaxonomy();
  await refreshCounts();
  await loadItems();
})();

// Wire collapse/expand all buttons
if (btnCollapseAll) {
  btnCollapseAll.addEventListener("click", () => {
    collapseAll();
    toast("All nodes collapsed", "info");
  });
}
if (btnExpandAll) {
  btnExpandAll.addEventListener("click", () => {
    expandAll();
    toast("All nodes expanded", "info");
  });
}
