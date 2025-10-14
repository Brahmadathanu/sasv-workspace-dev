/* eslint-env browser */
import { supabase } from "../public/shared/js/supabaseClient.js";

/* ===== Helpers ===== */
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
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 3000);
}
function fmtNum(x) {
  return x === null || x === undefined ? "" : Number(x).toFixed(3);
}

/* ===== Auth/Init ===== */
async function ensureAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "../../login.html";
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  document.getElementById(
    "sessionUser"
  ).textContent = `Logged in as ${user.email}`;
  return user;
}
function setDefaultWindow() {
  const start = fenceStart(new Date(), 25);
  const end = addMonths(start, 12);
  document.getElementById("fromDate").value = fmtDate(start);
  document.getElementById("toDate").value = fmtDate(addMonths(end, -1)); // display-only
}

/* ===== Grid ===== */
let page = 0;
const PAGE_SIZE = 100;

async function loadGrid() {
  const bodyEl = document.getElementById("gridBody");
  const statusEl = document.getElementById("gridStatus");
  bodyEl.innerHTML = "";
  statusEl.textContent = "Loading…";

  // window → [start, end)
  const fromISO = document.getElementById("fromDate").value;
  const toISO = document.getElementById("toDate").value;
  const productId = document.getElementById("productId").value;
  const onlyNeedsBase = document.getElementById("onlyNeedsBase").value;

  const start = fromISO || fmtDate(fenceStart());
  const toShown = toISO
    ? new Date(toISO + "T00:00:00")
    : addMonths(fenceStart(), 12);
  const end = fmtDate(addMonths(monthFloor(toShown), 1));

  let q = supabase
    .from("v_product_bulk_adjusted_to_base")
    .select(
      "product_id,month_start,net_bulk_to_make_after_wip,base_output_qty,need_after_carry,adjusted_bulk_to_make,overage_carry_to_next,needs_base_qty"
    )
    .gte("month_start", start)
    .lt("month_start", end)
    .order("product_id", { ascending: true })
    .order("month_start", { ascending: true })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (productId) q = q.eq("product_id", Number(productId));
  if (onlyNeedsBase === "true") q = q.eq("needs_base_qty", true);
  if (onlyNeedsBase === "false") q = q.eq("needs_base_qty", false);

  const { data, error } = await q;
  if (error) {
    console.error(error);
    statusEl.textContent = "Error loading.";
    return;
  }

  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.product_id}</td>
      <td>${r.month_start}</td>
  <td>${fmtNum(r.net_bulk_to_make_after_wip)}</td>
      <td>${fmtNum(r.base_output_qty)}</td>
      <td>${fmtNum(r.need_after_carry)}</td>
      <td>${fmtNum(r.adjusted_bulk_to_make)}</td>
      <td>${fmtNum(r.overage_carry_to_next)}</td>
      <td>${
        r.needs_base_qty
          ? '<span class="flag warn">true</span>'
          : '<span class="flag ok">false</span>'
      }</td>
      <td><a href="#" class="drill" data-pid="${r.product_id}" data-month="${
      r.month_start
    }">strip</a></td>
    `;
    bodyEl.appendChild(tr);
  });

  // wire drill
  bodyEl.querySelectorAll("a.drill").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openDrill(Number(a.dataset.pid));
    });
  });

  statusEl.textContent = `${data?.length ?? 0} rows`;
  document.getElementById("pageInfo").textContent = `Page ${page + 1}`;
}

function toCSV(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const head = cols.join(",");
  const body = rows
    .map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? "";
          const s = String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  return head + "\n" + body;
}

async function exportCSV() {
  const fromISO = document.getElementById("fromDate").value;
  const toISO = document.getElementById("toDate").value;
  const productId = document.getElementById("productId").value;
  const onlyNeedsBase = document.getElementById("onlyNeedsBase").value;

  const rows = [];
  const start = fromISO || fmtDate(fenceStart());
  const toShown = toISO
    ? new Date(toISO + "T00:00:00")
    : addMonths(fenceStart(), 12);
  const end = fmtDate(addMonths(monthFloor(toShown), 1));

  let offset = 0;
  const chunk = 2000;
  while (true) {
    let q = supabase
      .from("v_product_bulk_adjusted_to_base")
      .select(
        "product_id,month_start,net_bulk_to_make_after_wip,base_output_qty,need_after_carry,adjusted_bulk_to_make,overage_carry_to_next,needs_base_qty"
      )
      .gte("month_start", start)
      .lt("month_start", end)
      .order("product_id", { ascending: true })
      .order("month_start", { ascending: true })
      .range(offset, offset + chunk - 1);

    if (productId) q = q.eq("product_id", Number(productId));
    if (onlyNeedsBase === "true") q = q.eq("needs_base_qty", true);
    if (onlyNeedsBase === "false") q = q.eq("needs_base_qty", false);

    const { data, error } = await q;
    if (error) {
      console.error(error);
      break;
    }
    if (!data || !data.length) break;

    data.forEach((r) =>
      rows.push({
        product_id: r.product_id,
        month_start: r.month_start,
        net_bulk_to_make_after_wip: r.net_bulk_to_make_after_wip,
        base_output_qty: r.base_output_qty,
        need_after_carry: r.need_after_carry,
        adjusted_bulk_to_make: r.adjusted_bulk_to_make,
        overage_carry_to_next: r.overage_carry_to_next,
        needs_base_qty: r.needs_base_qty,
      })
    );
    if (data.length < chunk) break;
    offset += data.length;
  }

  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `output_normalizer_${start}_to_${end}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} rows`);
}

/* ===== Drilldown ===== */
async function fetchProductItem(product_id) {
  const { data, error } = await supabase
    .from("products")
    .select("item")
    .eq("id", product_id)
    .single();
  if (error) {
    console.error(error);
    return null;
  }
  return data?.item ?? null;
}

async function openDrill(product_id) {
  const dlg = document.getElementById("normModal");
  const title = document.getElementById("normTitle");
  const subtitle = document.getElementById("normSubtitle");
  const chipItem = document.getElementById("chipItem");
  const chipBase = document.getElementById("chipBase");
  const body = document.getElementById("normBody");
  body.innerHTML = "";

  const itemName = await fetchProductItem(product_id);
  title.textContent = `Normalization strip: product #${product_id}`;
  subtitle.textContent = itemName ? `(${itemName})` : "";
  chipItem.textContent = `item: ${itemName ?? "—"}`;

  // Pull 12-month strip from the view for this product (order by month)
  const { data, error } = await supabase
    .from("v_product_bulk_adjusted_to_base")
    .select(
      "month_start,net_bulk_to_make_after_wip,base_output_qty,need_after_carry,adjusted_bulk_to_make,overage_carry_to_next,needs_base_qty,product_id"
    )
    .eq("product_id", product_id)
    .order("month_start", { ascending: true })
    .limit(24);
  if (error) {
    console.error(error);
  }

  const base = data?.[0]?.base_output_qty ?? null;
  chipBase.textContent = `base_output_qty: ${base ?? "—"}`;

  (data || []).forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.month_start}</td>
  <td>${fmtNum(r.net_bulk_to_make_after_wip)}</td>
      <td>${fmtNum(r.need_after_carry)}</td>
      <td>${fmtNum(r.adjusted_bulk_to_make)}</td>
      <td>${fmtNum(r.overage_carry_to_next)}</td>
      <td>${r.needs_base_qty ? "true" : "false"}</td>
    `;
    body.appendChild(tr);
  });

  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
}

function closeDrill() {
  const dlg = document.getElementById("normModal");
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

/* ===== Wire-up ===== */
function wire() {
  document.getElementById("btnLoad").addEventListener("click", () => {
    page = 0;
    loadGrid();
  });
  document.getElementById("btnExport").addEventListener("click", exportCSV);
  document.getElementById("prevPage").addEventListener("click", () => {
    page = Math.max(0, page - 1);
    loadGrid();
  });
  document.getElementById("nextPage").addEventListener("click", () => {
    page += 1;
    loadGrid();
  });

  // modal controls
  document.getElementById("normClose").addEventListener("click", closeDrill);
  document.getElementById("normOk").addEventListener("click", closeDrill);
  const dlg = document.getElementById("normModal");
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDrill();
  });

  // Home button handler (like demand-overrides module)
  const homeBtn = document.getElementById("homeBtn");
  if (homeBtn) {
    homeBtn.onclick = () => {
      window.location.href = "index.html";
    };
  }
}

/* ===== Boot ===== */
(async function boot() {
  const user = await ensureAuth();
  if (!user) return;
  setDefaultWindow();
  wire();
  await loadGrid();
})();
