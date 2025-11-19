/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

const el = (id) => document.getElementById(id);
const tplPicker = el("tplPicker");
const rebuildTplBtn = el("rebuildTplBtn");
const dryRunBtn = el("dryRunBtn");
const rebuildAllBtn = el("rebuildAllBtn");
const resultBody = el("resultBody");
const toastContainer = el("statusToastContainer");
const homeBtn = el("homeBtn");

const MODULE_ID = "plm-rebuild-dashboard";
let PERM_CAN_VIEW = true;
let PERM_CAN_EDIT = true;

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

function renderDryRun(rows) {
  resultBody.innerHTML = (rows || [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(
          r.sku_label || r.sku_id || ""
        )}</td><td>${escapeHtml(
          r.tpl_code || r.tpl_id || ""
        )}</td><td>${escapeHtml(r.status || "would rebuild")}</td></tr>`
    )
    .join("");
}

rebuildTplBtn.addEventListener("click", async () => {
  if (!PERM_CAN_EDIT) return setStatus("No permission to rebuild.", "error");
  const tplId = parseInt(tplPicker.value, 10);
  if (!tplId) return setStatus("Select a template.", "error");
  const { error } = await supabase.rpc("rpc_plm_rebuild_skus_for_tpl", {
    p_tpl_id: tplId,
  });
  if (error) return setStatus(`Rebuild failed: ${error.message}`, "error");
  setStatus("Rebuild triggered for template.", "success");
});

dryRunBtn.addEventListener("click", async () => {
  const { data, error } = await supabase.rpc("rpc_plm_rebuild_all", {
    p_dry_run: true,
  });
  if (error) return setStatus(`Dry run failed: ${error.message}`, "error");
  renderDryRun(data || []);
  setStatus("Dry run complete.", "success");
});

rebuildAllBtn.addEventListener("click", async () => {
  if (!PERM_CAN_EDIT) return setStatus("No permission to rebuild.", "error");
  const { error } = await supabase.rpc("rpc_plm_rebuild_all", {
    p_dry_run: false,
  });
  if (error) return setStatus(`Rebuild all failed: ${error.message}`, "error");
  setStatus("Rebuild all triggered.", "success");
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
    await loadTemplates();
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
