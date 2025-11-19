/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

const el = (id) => document.getElementById(id);
const skuPicker = el("skuPicker");
const addOverrideBtn = el("addOverrideBtn");
const saveOverridesBtn = el("saveOverridesBtn");
const applyRebuildBtn = el("applyRebuildBtn");
const ovrBody = el("ovrBody");
const previewBody = el("previewBody");
const toastContainer = el("statusToastContainer");
const homeBtn = el("homeBtn");

const MODULE_ID = "plm-overrides";
let PERM_CAN_VIEW = true;
let PERM_CAN_EDIT = true;

let UOMS = [];
let STOCK_ITEMS = [];
let OVERRIDES = []; // {id, op, stock_item_id, qty_per_reference_output, uom_id, wastage_pct, is_optional, remarks}

function setStatus(msg, kind = "info", timeoutMs = 3500) {
  if (!toastContainer) return;
  toastContainer.innerHTML = "";
  const n = document.createElement("div");
  n.className = `toast ${kind}`;
  n.innerHTML = `<div style='flex:1'>${msg}</div><button class='toast-close' aria-label='Dismiss'>×</button>`;
  n.querySelector(".toast-close")?.addEventListener("click", () => n.remove());
  toastContainer.appendChild(n);
  if (timeoutMs) setTimeout(() => n.remove(), timeoutMs);
}

function escapeHtml(s = "") {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}
function getItemCode(id) {
  const it = STOCK_ITEMS.find((x) => x.id === id);
  return it?.code || "";
}

function blankOverride() {
  return {
    id: null,
    op: "set",
    stock_item_id: null,
    qty_per_reference_output: null,
    uom_id: null,
    wastage_pct: null,
    is_optional: null,
    remarks: "",
  };
}

async function loadUoms() {
  const { data, error } = await supabase
    .from("inv_uom")
    .select("id,code")
    .order("code", { ascending: true });
  if (error) throw error;
  UOMS = data || [];
}
async function loadPlmItems() {
  const { data, error } = await supabase
    .from("v_picker_plm_stock_items")
    .select("stock_item_id, stock_item_name, stock_item_code")
    .order("stock_item_name", { ascending: true });
  if (!error && Array.isArray(data)) {
    STOCK_ITEMS = (data || []).map((r) => ({
      id: r.stock_item_id,
      name: r.stock_item_name,
      code: r.stock_item_code || null,
    }));
    return;
  }
  const { data: rows } = await supabase
    .from("inv_stock_item")
    .select(
      "id,name,code, inv_stock_item_class_map(category_id, inv_class_category(code))"
    )
    .order("name", { ascending: true });
  STOCK_ITEMS = (rows || [])
    .filter(
      (r) =>
        Array.isArray(r.inv_stock_item_class_map) &&
        r.inv_stock_item_class_map.some(
          (m) => m.inv_class_category?.code === "PLM"
        )
    )
    .map((r) => ({ id: r.id, name: r.name, code: r.code || null }));
}
async function loadSkus() {
  const { data, error } = await supabase
    .from("v_sku_catalog_enriched")
    .select("sku_id, sku_label")
    .order("sku_label", { ascending: true });
  if (error) throw error;
  skuPicker.innerHTML = (data || [])
    .map(
      (r) => `<option value='${r.sku_id}'>${escapeHtml(r.sku_label)}</option>`
    )
    .join("");
}

async function loadOverridesForSku() {
  const skuId = parseInt(skuPicker.value, 10);
  if (!skuId) {
    OVERRIDES = [];
    renderOverrides();
    renderPreview([]);
    return;
  }
  const { data, error } = await supabase.rpc("rpc_plm_ovr_list", {
    p_sku_id: skuId,
  });
  if (error) {
    setStatus(`Load overrides failed: ${error.message}`, "error");
    OVERRIDES = [];
  } else {
    OVERRIDES = (data || []).map((r) => ({
      id: r.id,
      op: r.op,
      stock_item_id: r.stock_item_id,
      qty_per_reference_output: r.qty_per_reference_output ?? null,
      uom_id: r.uom_id ?? null,
      wastage_pct: r.wastage_pct ?? null,
      is_optional: r.is_optional == null ? null : !!r.is_optional,
      remarks: r.remarks || "",
    }));
  }
  renderOverrides();
  await refreshPreview();
}

function renderOverrides() {
  const opOptions = (sel) =>
    ["add", "set", "remove"]
      .map(
        (op) =>
          `<option value='${op}' ${op === sel ? "selected" : ""}>${op}</option>`
      )
      .join("");
  const itemOptions = (sid) =>
    [
      "<option value=''>— select —</option>",
      ...STOCK_ITEMS.map(
        (x) =>
          `<option value='${x.id}' ${
            x.id === sid ? "selected" : ""
          }>${escapeHtml(x.name)}</option>`
      ),
    ].join("");
  const uomOptions = (uid) =>
    [
      "<option value=''>— select —</option>",
      ...UOMS.map(
        (u) =>
          `<option value='${u.id}' ${u.id === uid ? "selected" : ""}>${
            u.code
          }</option>`
      ),
    ].join("");
  ovrBody.innerHTML = (OVERRIDES.length ? OVERRIDES : [blankOverride()])
    .map((ovr, i) => {
      const eff = OVERRIDES.length ? ovr : blankOverride();
      return `
      <tr data-i='${i}'>
        <td><select class='cell op'>${opOptions(eff.op)}</select></td>
        <td><div style='display:flex;gap:8px;align-items:center'><span class='muted'>${escapeHtml(
          getItemCode(eff.stock_item_id)
        )}</span><select class='cell item' style='flex:1'>${itemOptions(
        eff.stock_item_id
      )}</select></div></td>
        <td class='right'><input class='cell qty' type='number' step='0.0001' min='0' value='${
          eff.qty_per_reference_output ?? ""
        }' /></td>
        <td><select class='cell uom'>${uomOptions(eff.uom_id)}</select></td>
        <td class='right'><input class='cell wast' type='number' step='0.0001' min='0' max='0.9999' value='${
          eff.wastage_pct ?? ""
        }' /></td>
        <td><input type='checkbox' class='cell opt' ${
          eff.is_optional ? "checked" : ""
        } /></td>
        <td><input type='text' class='cell rem' value='${escapeHtml(
          eff.remarks || ""
        )}' /></td>
        <td><div class='row-actions'><button class='icon-btn small' data-act='del' title='Delete'>✕</button></div></td>
      </tr>`;
    })
    .join("");
}

function renderPreview(rows) {
  previewBody.innerHTML = (rows || [])
    .map((ln, i) => {
      const wast =
        ln.wastage_pct == null
          ? ""
          : Number(ln.wastage_pct) <= 1.5
          ? Number(ln.wastage_pct) * 100
          : Number(ln.wastage_pct);
      return `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(ln.item_code || "")}</td>
      <td>${escapeHtml(ln.item_name || "")}</td>
      <td class='right'>${ln.qty_per_reference_output ?? ""}</td>
      <td>${escapeHtml(ln.uom_code || "")}</td>
      <td class='right'>${wast === "" ? "" : Number(wast).toFixed(2)}%</td>
      <td>${ln.is_optional ? "Yes" : "No"}</td>
      <td>${escapeHtml(ln.remarks || "")}</td>
    </tr>`;
    })
    .join("");
}

async function refreshPreview() {
  const skuId = parseInt(skuPicker.value, 10);
  if (!skuId) {
    renderPreview([]);
    return;
  }
  const { data, error } = await supabase.rpc("rpc_plm_preview_effective", {
    p_sku_id: skuId,
  });
  if (error) return setStatus(`Preview failed: ${error.message}`, "error");
  renderPreview(data || []);
}

ovrBody.addEventListener("change", async (e) => {
  const tr = e.target.closest("tr[data-i]");
  if (!tr) return;
  const i = parseInt(tr.dataset.i, 10);
  if (!OVERRIDES.length) OVERRIDES = [blankOverride()];
  const row = OVERRIDES[i] || (OVERRIDES[i] = blankOverride());
  if (e.target.classList.contains("op")) row.op = e.target.value;
  if (e.target.classList.contains("item")) {
    row.stock_item_id = e.target.value ? parseInt(e.target.value, 10) : null;
    tr.querySelector("td .muted").textContent = getItemCode(row.stock_item_id);
  }
  if (e.target.classList.contains("qty"))
    row.qty_per_reference_output =
      e.target.value === "" ? null : parseFloat(e.target.value);
  if (e.target.classList.contains("uom"))
    row.uom_id = e.target.value ? parseInt(e.target.value, 10) : null;
  if (e.target.classList.contains("wast"))
    row.wastage_pct = e.target.value === "" ? null : parseFloat(e.target.value);
  if (e.target.classList.contains("opt")) row.is_optional = e.target.checked;
  if (e.target.classList.contains("rem")) row.remarks = e.target.value || "";
  await refreshPreview();
});

ovrBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act='del']");
  if (!btn) return;
  const tr = e.target.closest("tr[data-i]");
  const i = parseInt(tr.dataset.i, 10);
  const row = OVERRIDES[i];
  if (row?.id) {
    const { error } = await supabase.rpc("rpc_plm_ovr_delete", {
      p_id: row.id,
    });
    if (error) return setStatus(`Delete failed: ${error.message}`, "error");
  }
  OVERRIDES.splice(i, 1);
  renderOverrides();
  await refreshPreview();
});

addOverrideBtn.addEventListener("click", () => {
  OVERRIDES.push(blankOverride());
  renderOverrides();
});

saveOverridesBtn.addEventListener("click", async () => {
  if (!PERM_CAN_EDIT) return setStatus("No permission to edit.", "error");
  const skuId = parseInt(skuPicker.value, 10);
  if (!skuId) return setStatus("Select a SKU.", "error");
  const tasks = OVERRIDES.map((r) => {
    const u = UOMS.find((x) => x.id === r.uom_id);
    const uomCode = u?.code || null;
    return supabase.rpc("rpc_plm_ovr_upsert", {
      p_id: r.id,
      p_sku_id: skuId,
      p_op: r.op,
      p_stock_item_id: r.stock_item_id,
      p_qty: r.qty_per_reference_output,
      p_uom_code: uomCode,
      p_wastage_pct: r.wastage_pct,
      p_is_optional: r.is_optional,
      p_remarks: r.remarks || null,
    });
  });
  try {
    await Promise.all(tasks);
    setStatus("Overrides saved.", "success");
    await loadOverridesForSku();
  } catch (e) {
    console.error(e);
    setStatus(`Save failed: ${e.message}`, "error");
  }
});

applyRebuildBtn.addEventListener("click", async () => {
  const skuId = parseInt(skuPicker.value, 10);
  if (!skuId) return setStatus("Select a SKU.", "error");
  const { error } = await supabase.rpc("rpc_plm_rebuild_sku", {
    p_sku_id: skuId,
  });
  if (error) return setStatus(`Rebuild failed: ${error.message}`, "error");
  setStatus("Rebuild triggered.", "success");
});

(async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "login.html");
    try {
      const { data: permRows } = await supabase
        .from("user_permissions")
        .select("module_id, can_view, can_edit")
        .eq("user_id", session.user.id)
        .eq("module_id", MODULE_ID)
        .limit(1);
      if (Array.isArray(permRows) && permRows.length) {
        PERM_CAN_VIEW = !!permRows[0].can_view;
        PERM_CAN_EDIT = !!permRows[0].can_edit;
      }
    } catch (pErr) {
      console.warn("Permission load failed", pErr);
    }
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.", "error");
      return;
    }
    await loadUoms();
    await loadPlmItems();
    await loadSkus();
    await loadOverridesForSku();
    skuPicker.addEventListener("change", loadOverridesForSku);
    homeBtn?.addEventListener("click", () =>
      window.Platform && typeof window.Platform.goHome === "function"
        ? window.Platform.goHome()
        : (window.location.href = "index.html")
    );
  } catch (err) {
    console.error(err);
    setStatus(`Init error: ${err.message}`, "error");
  }
})();
