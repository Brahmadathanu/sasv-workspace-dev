/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

const el = (id) => document.getElementById(id);
const skuPicker = el("skuPicker");
const tplPicker = el("tplPicker");
const setBtn = el("setBtn");
const clearBtn = el("clearBtn");
const toastContainer = el("statusToastContainer");
const homeBtn = el("homeBtn");
const mappedBody = el("mappedBody");
const refreshMapListBtn = el("refreshMapListBtn");

const MODULE_ID = "plm-sku-map";
let PERM_CAN_VIEW = true;
let PERM_CAN_EDIT = true;

function setStatus(msg, kind = "info", timeoutMs = 3500) {
  if (!toastContainer) return;
  toastContainer.innerHTML = "";
  if (!msg) return;
  const n = document.createElement("div");
  n.className = `toast ${kind}`;
  n.innerHTML = `<div style="flex:1">${msg}</div><button class='toast-close' aria-label='Dismiss'>×</button>`;
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

async function loadSkus() {
  const { data, error } = await supabase
    .from("v_sku_catalog_enriched")
    .select("sku_id, sku_label")
    .order("sku_label", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  skuPicker.innerHTML = rows
    .map(
      (r) => `<option value='${r.sku_id}'>${escapeHtml(r.sku_label)}</option>`
    )
    .join("");
}

async function loadTemplates() {
  const { data, error } = await supabase
    .from("plm_tpl_header")
    .select("tpl_id:id, tpl_code:code")
    .order("code", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  tplPicker.innerHTML = rows
    .map(
      (r) => `<option value='${r.tpl_id}'>${escapeHtml(r.tpl_code)}</option>`
    )
    .join("");
}

async function refreshMap() {
  const skuId = parseInt(skuPicker.value, 10);
  const { data, error } = await supabase.rpc("rpc_plm_map_get_for_sku", {
    p_sku_id: skuId,
  });
  if (error) return setStatus(`Load map failed: ${error.message}`, "error");
  if (data?.tpl_id) tplPicker.value = String(data.tpl_id);
}

async function loadMappedList() {
  try {
    const { data, error } = await supabase
      .from("plm_sku_pack_map")
      .select("sku_id, tpl_id, notes, last_updated_at")
      .order("last_updated_at", { ascending: false });
    if (error) throw error;
    const rows = data || [];

    const skuIds = [
      ...new Set(rows.map((r) => Number(r.sku_id)).filter(Boolean)),
    ];
    const tplIds = [
      ...new Set(rows.map((r) => Number(r.tpl_id)).filter(Boolean)),
    ];

    const [skuMetaRes, tplMetaRes] = await Promise.all([
      skuIds.length
        ? supabase
            .from("v_sku_catalog_enriched")
            .select("sku_id, sku_label")
            .in("sku_id", skuIds)
        : Promise.resolve({ data: [] }),
      tplIds.length
        ? supabase.from("plm_tpl_header").select("id, code").in("id", tplIds)
        : Promise.resolve({ data: [] }),
    ]);

    const skuMap = new Map(
      (skuMetaRes.data || []).map((s) => [Number(s.sku_id), s.sku_label])
    );
    const tplMap = new Map(
      (tplMetaRes.data || []).map((t) => [Number(t.id), t.code])
    );

    const fmt = (d) => (d ? new Date(d).toLocaleString() : "");
    mappedBody.innerHTML = rows
      .map((r) => {
        const skuLabel = skuMap.get(Number(r.sku_id)) || r.sku_id;
        const tplCode = tplMap.get(Number(r.tpl_id)) || r.tpl_id;
        return `<tr>
          <td style='padding:6px; border-bottom:1px solid #f1f5f9'>${escapeHtml(
            String(skuLabel)
          )}</td>
          <td style='padding:6px; border-bottom:1px solid #f1f5f9'>${escapeHtml(
            String(tplCode)
          )}</td>
          <td style='padding:6px; border-bottom:1px solid #f1f5f9'>${escapeHtml(
            r.notes || ""
          )}</td>
          <td style='padding:6px; border-bottom:1px solid #f1f5f9'>${escapeHtml(
            fmt(r.last_updated_at)
          )}</td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    console.error(e);
    setStatus(`Load mapped list failed: ${e.message}`, "error");
    if (mappedBody) mappedBody.innerHTML = "";
  }
}

setBtn.addEventListener("click", async () => {
  if (!PERM_CAN_EDIT) return setStatus("No permission to edit.", "error");
  const skuId = parseInt(skuPicker.value, 10);
  const tplId = parseInt(tplPicker.value, 10);
  if (!skuId || !tplId)
    return setStatus("Select both SKU and Template.", "error");
  const { error } = await supabase.rpc("rpc_plm_map_set", {
    p_sku_id: skuId,
    p_tpl_id: tplId,
  });
  if (error) return setStatus(`Set mapping failed: ${error.message}`, "error");
  setStatus("Mapping saved.", "success");
  await loadMappedList();
});

clearBtn.addEventListener("click", async () => {
  if (!PERM_CAN_EDIT) return setStatus("No permission to edit.", "error");
  const skuId = parseInt(skuPicker.value, 10);
  if (!skuId) return setStatus("Select a SKU.", "error");
  const { error } = await supabase.rpc("rpc_plm_map_clear", {
    p_sku_id: skuId,
  });
  if (error) return setStatus(`Clear failed: ${error.message}`, "error");
  setStatus("Mapping cleared.", "success");
  await refreshMap();
  await loadMappedList();
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
    await loadSkus();
    await loadTemplates();
    await refreshMap();
    await loadMappedList();
    skuPicker.addEventListener("change", refreshMap);
    refreshMapListBtn?.addEventListener("click", loadMappedList);
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
