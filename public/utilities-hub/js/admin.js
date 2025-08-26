// public/utilities-hub/js/admin.js
// Admin Dashboard for SASV Utilities Hub
// Requires: ../../shared/js/supabaseClient.js (exporting `supabase`)
/* eslint-env browser */

import { supabase } from "../../shared/js/supabaseClient.js";

/* ---------- DOM ---------- */
const elEmail = document.getElementById("admin-email");
const elGuard = document.getElementById("admin-guard");

const tabs = document.querySelectorAll("nav.tabs button");
const panels = {
  pending: document.getElementById("panel-pending"),
  grant: document.getElementById("panel-grant"),
  access: document.getElementById("panel-access"),
};

/* Pending */
const btnRefreshPending = document.getElementById("refreshPending");
const tbodyPending = document.getElementById("pendingBody");

/* Grant */
const selGrantUtility = document.getElementById("grant-utility");
const selGrantLevel = document.getElementById("grant-level");
const inpGrantEmail = document.getElementById("grant-email");
const btnGrant = document.getElementById("grantBtn");

/* Access */
const inpLookupEmail = document.getElementById("lookup-email");
const btnLookup = document.getElementById("lookupBtn");
const tbodyAccess = document.getElementById("accessBody");

/* ---------- Utils ---------- */
const $el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("data-")) node.setAttribute(k, v);
    else if (k === "html") node.innerHTML = v; // only for trusted text
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
};

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "";
  }
}
function toast(msg) {
  // replace with a nicer toast if you like
  alert(msg);
}

function setActiveTab(name) {
  tabs.forEach((b) => {
    const on = b.dataset.tab === name;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  Object.entries(panels).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });
}

/* ---------- Auth guard: require hub_admin:use ---------- */
async function mustBeAdmin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = "./index.html";
    return false;
  }
  elEmail.textContent = session.user.email || "";

  // find hub_admin id
  const { data: utils, error: uErr } = await supabase
    .from("hub_utilities")
    .select("id, key")
    .eq("key", "hub_admin")
    .limit(1);

  if (uErr || !utils?.length) {
    elGuard.style.display = "";
    toast(
      "Admin utility entry missing. Insert {key:'hub_admin'} in hub_utilities."
    );
    return false;
  }
  const adminId = utils[0].id;

  const { data: acc, error: aErr } = await supabase
    .from("hub_user_access")
    .select("level")
    .eq("user_id", session.user.id)
    .eq("utility_id", adminId)
    .limit(1);

  if (aErr || !acc?.length || acc[0].level !== "use") {
    elGuard.style.display = "";
    return false;
  }
  elGuard.style.display = "none";
  return true;
}

/* ---------- Pending requests ---------- */
let _pendingLoadToken = 0;
let _pendingLoading = false;

function renderPendingEmpty(text) {
  tbodyPending.innerHTML = "";
  const tr = $el("tr", {}, [
    $el("td", { colspan: "5", class: "muted", text }, []),
  ]);
  tbodyPending.appendChild(tr);
}

async function loadPending() {
  if (_pendingLoading) return; // prevent overlaps
  _pendingLoading = true;
  const myToken = ++_pendingLoadToken;

  renderPendingEmpty("Loading…");

  const { data, error } = await supabase
    .from("v_hub_requests_pending")
    .select(
      "request_id, created_at, user_email, user_id, utility_key, utility_label, utility_id, note, status"
    )
    .order("created_at", { ascending: false });

  // If another call started after us, drop this response
  if (myToken !== _pendingLoadToken) {
    _pendingLoading = false;
    return;
  }

  if (error) {
    renderPendingEmpty("Error loading requests.");
    console.error(error);
    _pendingLoading = false;
    return;
  }
  if (!data?.length) {
    renderPendingEmpty("No pending requests.");
    _pendingLoading = false;
    return;
  }

  tbodyPending.innerHTML = "";
  data.forEach((r) => {
    const tr = $el("tr", {
      "data-id": String(r.request_id),
      "data-email": r.user_email || r.email || "",
      "data-utility-id": r.utility_id || "",
      "data-utility-key": r.utility_key || "",
    });

    const tdWhen = $el("td", { text: fmtDate(r.created_at) });
    const tdEmail = $el("td", { text: r.user_email || r.email || "" });
    const tdUtil = $el("td", {
      text: r.utility_label || r.utility_key || "",
    });
    const tdNote = $el("td", { text: r.note || "" });

    const approveBtn = $el("button", {
      class: "button primary",
      text: "Approve",
    });
    const denyBtn = $el("button", { class: "button", text: "Deny" });

    approveBtn.addEventListener("click", async () => {
      approveBtn.disabled = true;
      const { error: err } = await supabase.rpc("approve_hub_request", {
        p_request_id: r.request_id,
      });
      if (err) {
        toast("Approve failed. Check RPC/RLS.");
        console.error(err);
        approveBtn.disabled = false;
        return;
      }
      toast("Approved.");
      await loadPending();
    });

    denyBtn.addEventListener("click", async () => {
      const reason = prompt("Optional reason?");
      denyBtn.disabled = true;
      const { error: err } = await supabase.rpc("deny_hub_request", {
        p_request_id: r.request_id,
        p_reason: reason || null,
      });
      if (err) {
        toast("Deny failed. Check RPC/RLS.");
        console.error(err);
        denyBtn.disabled = false;
        return;
      }
      toast("Denied.");
      await loadPending();
    });

    const tdAction = $el("td", {}, [
      $el("div", { class: "controls" }, [approveBtn, denyBtn]),
    ]);

    [tdWhen, tdEmail, tdUtil, tdNote, tdAction].forEach((td) =>
      tr.appendChild(td)
    );
    tbodyPending.appendChild(tr);
  });

  _pendingLoading = false;
}

/* ---------- Manual grant ---------- */
async function loadUtilitiesForGrant() {
  selGrantUtility.innerHTML = "";
  const optLoading = $el("option", { value: "", text: "Loading…" });
  selGrantUtility.appendChild(optLoading);

  const { data, error } = await supabase
    .from("hub_utilities")
    .select("key, label")
    .order("label", { ascending: true });

  selGrantUtility.innerHTML = "";
  if (error) {
    const opt = $el("option", { value: "", text: "(error loading utilities)" });
    selGrantUtility.appendChild(opt);
    console.error(error);
    return;
  }

  data.forEach((u) => {
    const opt = $el("option", {
      value: u.key,
      text: `${u.label} (${u.key})`,
    });
    selGrantUtility.appendChild(opt);
  });
}

async function grantByEmail() {
  const email = inpGrantEmail.value.trim();
  const uKey = selGrantUtility.value;
  const level = selGrantLevel.value;

  if (!email || !uKey || !level) {
    toast("Fill email, utility and level.");
    return;
  }
  btnGrant.disabled = true;

  const { error } = await supabase.rpc("set_user_access_by_email_key", {
    p_email: email,
    p_utility_key: uKey,
    p_level: level,
  });

  btnGrant.disabled = false;

  if (error) {
    toast("Grant failed. Check RPC/RLS.");
    console.error(error);
    return;
  }
  toast("Access granted.");
}

/* ---------- Current access ---------- */
function renderAccessEmpty(text) {
  tbodyAccess.innerHTML = "";
  tbodyAccess.appendChild(
    $el("tr", {}, [$el("td", { colspan: "4", class: "muted", text })])
  );
}

async function loadAccessForEmail() {
  const email = inpLookupEmail.value.trim();
  if (!email) return toast("Enter email.");
  renderAccessEmpty("Loading…");

  const { data, error } = await supabase.rpc("list_hub_access_by_email", {
    p_email: email,
  });

  if (error) {
    renderAccessEmpty("Error or RPC missing.");
    console.error(error);
    return;
  }
  if (!data?.length) {
    renderAccessEmpty("No access yet.");
    return;
  }

  tbodyAccess.innerHTML = "";
  data.forEach((row) => {
    const tr = $el("tr", {
      "data-user-id": row.user_id,
      "data-utility-id": row.utility_id,
    });

    const tdEmail = $el("td", { text: email });
    const tdUtil = $el("td", {
      text: row.utility_label || row.utility_key || "",
    });
    const tdLevel = $el("td", {}, [
      $el("span", { class: "pill", text: row.level }),
    ]);

    const revokeBtn = $el("button", { class: "button", text: "Revoke" });
    revokeBtn.addEventListener("click", async () => {
      revokeBtn.disabled = true;
      const { error: err } = await supabase.rpc("revoke_user_access", {
        p_user_id: row.user_id,
        p_utility_key: row.utility_key,
      });
      revokeBtn.disabled = false;
      if (err) {
        toast("Revoke failed.");
        console.error(err);
        return;
      }
      toast("Revoked.");
      await loadAccessForEmail();
    });

    const tdAction = $el("td", {}, [revokeBtn]);

    [tdEmail, tdUtil, tdLevel, tdAction].forEach((td) => tr.appendChild(td));
    tbodyAccess.appendChild(tr);
  });
}

/* ---------- Tabs ---------- */
tabs.forEach((b) => {
  b.addEventListener("click", () => setActiveTab(b.dataset.tab));
});

/* ---------- Buttons ---------- */
let _lastRefreshAt = 0;
btnRefreshPending?.addEventListener("click", () => {
  const now = Date.now();
  if (now - _lastRefreshAt < 600) return; // 600ms debounce
  _lastRefreshAt = now;
  loadPending();
});
btnGrant?.addEventListener("click", grantByEmail);
btnLookup?.addEventListener("click", loadAccessForEmail);

/* ---------- Boot ---------- */
(async function boot() {
  const ok = await mustBeAdmin();
  if (!ok) return;

  await Promise.all([loadPending(), loadUtilitiesForGrant()]);
})();
