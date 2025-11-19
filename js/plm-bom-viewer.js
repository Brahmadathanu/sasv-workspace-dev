/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

const el = (id) => document.getElementById(id);
const skuPicker = el("skuPicker");
const pillRef = el("pillRef");
const pillLoss = el("pillLoss");
const linesBody = el("linesBody");
const exportCsvBtn = el("exportCsvBtn");
const toastContainer = el("statusToastContainer");
const homeBtn = el("homeBtn");

const MODULE_ID = "plm-bom-viewer";
let PERM_CAN_VIEW = true;

let UOMS = [];
let SKUS = [];

function setStatus(msg, kind = "info", timeoutMs = 3200) {
  if (!toastContainer) return;
  toastContainer.innerHTML = "";
  if (!msg) return;
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

async function loadUoms() {
  const { data } = await supabase.from("inv_uom").select("id,code");
  UOMS = data || [];
}
async function loadSkus() {
  const { data, error } = await supabase
    .from("v_sku_catalog_enriched")
    .select("sku_id, sku_label")
    .order("sku_label", { ascending: true });
  if (error) throw error;
  SKUS = data || [];
  skuPicker.innerHTML = SKUS.map(
    (r) => `<option value='${r.sku_id}'>${escapeHtml(r.sku_label)}</option>`
  ).join("");
}

async function loadCompiled() {
  const skuId = parseInt(skuPicker.value, 10);
  if (!skuId) {
    linesBody.innerHTML = "";
    pillRef.textContent = "—";
    pillLoss.textContent = "—";
    return;
  }
  const { data: hdr, error: he } = await supabase.rpc(
    "rpc_plm_bom_get_header",
    { p_sku_id: skuId }
  );
  if (he) {
    setStatus(`Header load failed: ${he.message}`, "error");
    return;
  }
  if (hdr) {
    const qty = hdr.reference_output_qty ?? null;
    const uomId = hdr.reference_output_uom_id ?? null;
    const uomCode = UOMS.find((u) => u.id === uomId)?.code || "";
    pillRef.textContent = qty == null ? "—" : `${qty} ${uomCode}`;
    const loss =
      hdr.process_loss_pct == null
        ? null
        : Number(hdr.process_loss_pct) <= 1.5
        ? Number(hdr.process_loss_pct) * 100
        : Number(hdr.process_loss_pct);
    pillLoss.textContent = loss == null ? "—" : `${Number(loss).toFixed(2)}%`;
  } else {
    pillRef.textContent = "—";
    pillLoss.textContent = "—";
  }

  const { data: rows, error: le } = await supabase.rpc(
    "rpc_plm_bom_list_lines",
    { p_sku_id: skuId }
  );
  if (le) {
    setStatus(`Lines load failed: ${le.message}`, "error");
    linesBody.innerHTML = "";
    return;
  }
  const list = rows || [];
  linesBody.innerHTML = list
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

function exportCsv() {
  const skuId = parseInt(skuPicker.value, 10);
  if (!skuId) return setStatus("Select a SKU to export.", "error");
  const skuLabel =
    SKUS.find((s) => s.sku_id === skuId)?.sku_label || `SKU-${skuId}`;
  // Build snapshot using current table content for simplicity
  const rows = Array.from(linesBody.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.children).map((td) => td.textContent || "")
  );
  const head = [
    ["SKU", skuLabel],
    [],
    [
      "SN",
      "Item Code",
      "Stock Item",
      "Qty per Ref",
      "UOM",
      "Wastage %",
      "Optional",
      "Remarks",
    ],
  ];
  const csvRows = [...head, ...rows];
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = csvRows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plm-bom_${skuLabel
    .replace(/[^a-z0-9\-_]+/gi, "-")
    .slice(0, 80)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
  setStatus("CSV exported.", "success");
}

exportCsvBtn.addEventListener("click", exportCsv);
skuPicker.addEventListener("change", loadCompiled);

(async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return (window.location.href = "login.html");
    try {
      const { data: permRows } = await supabase
        .from("user_permissions")
        .select("module_id, can_view")
        .eq("user_id", session.user.id)
        .eq("module_id", MODULE_ID)
        .limit(1);
      if (Array.isArray(permRows) && permRows.length)
        PERM_CAN_VIEW = !!permRows[0].can_view;
    } catch (pErr) {
      console.warn("Permission load failed", pErr);
    }
    if (!PERM_CAN_VIEW) {
      setStatus("You do not have permission to view this module.", "error");
      return;
    }
    await loadUoms();
    await loadSkus();
    await loadCompiled();
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
