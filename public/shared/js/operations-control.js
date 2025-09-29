// public/shared/js/etl-control.js
import { supabase } from "./supabaseClient.js";
import { Platform } from "./platform.js";

/* ---------------------------------------------------
  State & helpers
--------------------------------------------------- */
let __starting = false;
let __started = false;
let __sessionWait = null;

let __jobs = [];
let __jobsTotal = 0;
let __page = 1;
let __pageSize = 50;

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, "0");
const todayYmd = (dash = true, dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  const s = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return dash ? s : s.replaceAll("-", "");
};
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d)
    ? "—"
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const debounce = (fn, ms = 300) => {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};
const getColspan = () => {
  const thead = document.querySelector("#card-jobs thead tr");
  return thead ? thead.children.length : 5;
};

/* ---------------------------------------------------
  Top status pill
--------------------------------------------------- */
const setStatus = (text, kind = "ok") => {
  const el = $("ctl-status");
  if (!el) return;
  el.textContent = text;
  el.classList.remove("ok", "warn", "err");
  el.classList.add(kind === "warn" ? "warn" : kind === "error" ? "err" : "ok");
};

/* ---------------------------------------------------
  In-page modal + toast (reusable)
--------------------------------------------------- */
function ensureModalRoot() {
  let root = document.getElementById("modal-root");
  if (root) return root;
  root = document.createElement("div");
  root.id = "modal-root";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.display = "none";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.zIndex = "1000";
  document.body.appendChild(root);
  return root;
}
function openModal({ title = "", body = "", footer = "" } = {}) {
  const root = ensureModalRoot();
  root.innerHTML = `
    <div class="modal-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,.35)"></div>
    <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"
         style="position:relative;max-width:min(720px,95vw);width:100%;border:1px solid var(--card-border);
                border-radius:12px;background:#fff;padding:16px;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <h3 id="modal-title" style="margin:0;font-size:1.05rem;color:#0b1420">${title}</h3>
        <button type="button" id="modal-close" class="button" aria-label="Close">✕</button>
      </div>
      <div id="modal-body" style="margin-top:10px;max-height:60vh;overflow:auto">${body}</div>
      <div id="modal-footer" style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">${footer}</div>
    </div>
  `;
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    const panel = root.querySelector(".modal-panel");
    panel.style.background = "#0b0f14";
    panel.style.borderColor = "#1f2937";
    const titleEl = root.querySelector("#modal-title");
    titleEl.style.color = "#e5e7eb";
  }
  root.style.display = "flex";

  const close = () => {
    root.style.display = "none";
    root.innerHTML = "";
  };
  root.querySelector("#modal-close").addEventListener("click", close);
  root.querySelector(".modal-backdrop").addEventListener("click", close);
  const esc = (e) => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc);
    }
  };
  document.addEventListener("keydown", esc, { once: true });

  return {
    root,
    setBody(html) {
      root.querySelector("#modal-body").innerHTML = html;
    },
    setFooter(html) {
      root.querySelector("#modal-footer").innerHTML = html;
    },
    close,
  };
}
function toast(msg = "Done") {
  let t = document.getElementById("mini-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "mini-toast";
    t.style.position = "fixed";
    t.style.left = "50%";
    t.style.bottom = "24px";
    t.style.transform = "translateX(-50%)";
    t.style.padding = "8px 12px";
    t.style.border = "1px solid var(--card-border)";
    t.style.borderRadius = "10px";
    t.style.background = "#fff";
    t.style.zIndex = "1100";
    t.style.fontSize = "0.9rem";
    document.body.appendChild(t);
  }
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    t.style.background = "#0b0f14";
    t.style.color = "#e5e7eb";
    t.style.borderColor = "#1f2937";
  } else {
    t.style.background = "#fff";
    t.style.color = "#0b1420";
    t.style.borderColor = "var(--card-border)";
  }
  t.textContent = msg;
  t.style.opacity = "0";
  t.style.display = "block";
  requestAnimationFrame(() => {
    t.style.transition = "opacity 150ms ease";
    t.style.opacity = "1";
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => (t.style.display = "none"), 180);
    }, 1200);
  });
}

/* ---------------------------------------------------
  Floating actions popover (singleton)
--------------------------------------------------- */
let __popover = null;
function ensurePopover() {
  if (__popover) return __popover;
  const el = document.createElement("div");
  el.id = "jobs-popover";
  el.className = "popover-menu";
  document.body.appendChild(el);
  __popover = el;
  return __popover;
}
function closePopover() {
  if (!__popover) return;
  __popover.classList.remove("open");
  __popover.innerHTML = "";
  delete __popover.dataset.rowIndex;
}

/* ---------------------------------------------------
  Access check
--------------------------------------------------- */
async function requireAdmin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error("Not signed in.");
  const { data, error } = await supabase.rpc("is_etl_admin", { p_user: uid });
  if (error) throw error;
  if (data === true) return true;
  throw new Error("Access denied.");
}
async function requireAdminWithRetry(tries = 12, delayMs = 500) {
  for (let i = 0; i < tries; i++) {
    try {
      await requireAdmin();
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(1.4, i)));
    }
  }
  throw new Error("Access denied.");
}

/* ---------------------------------------------------
  Presets: server-driven (RPC)
--------------------------------------------------- */
async function loadPresetsIntoSelect() {
  const sel = $("enq-preset");
  if (!sel) return;
  sel.innerHTML = `<option value="">— Choose a preset —</option>`;
  try {
    const { data, error } = await supabase.rpc("list_etl_presets");
    if (error) throw error;
    (data || []).forEach((row) => {
      const opt = document.createElement("option");
      opt.value = row.preset_key;
      opt.textContent = row.label || row.preset_key;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error("list_etl_presets failed", e);
    // leave default <option> — safe fallback
  }
}

function gatherPresetContext() {
  const ymdDash = $("enq-date")?.value || todayYmd(true);
  const ymd = ymdDash.replaceAll("-", "");
  const company = $("enq-company")?.value?.trim() || "SASV 2025-2026";
  const godown = $("enq-godown")?.value?.trim() || null;
  const addFetch = $("enq-do-fetch")?.checked ?? true;
  const addParse = $("enq-do-parse")?.checked ?? true;
  return { ymdDash, ymd, company, godown, addFetch, addParse };
}

function updatePresetDisabling() {
  const preset = $("enq-preset")?.value || "";
  const isMA = preset === "master_aggregator";
  const idsToDisable = [
    "enq-godown",
    "enq-do-fetch",
    "enq-do-parse",
    "enq-json",
  ];
  idsToDisable.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.disabled = isMA;
    if (id === "enq-godown") {
      const wrap = document.getElementById("field-godown");
      if (wrap) wrap.classList.toggle("dimmed", isMA);
    }
  });
  const hint = $("enq-hint");
  if (hint)
    hint.textContent = isMA
      ? "Master Aggregator ignores fetch/parse toggles & godown."
      : "";
}

async function runAggregator() {
  const p_date = $("enq-date")?.value || todayYmd(true);
  const p_company = $("enq-company")?.value || null;
  setStatus("Enqueuing master aggregator…", "warn");
  const { error } = await supabase.rpc("enqueue_all_daily_jobs", {
    p_date,
    p_company,
  });
  if (error) throw error;
  setStatus("Master aggregator enqueued.", "ok");
}

/* Preview uses server builder */
async function fillSample() {
  const preset = $("enq-preset")?.value || "";
  const txt = $("enq-json");
  if (!txt) return;
  if (!preset) {
    txt.value = "";
    return;
  }
  if (preset === "master_aggregator") {
    txt.value = "// No params for Master Aggregator (server macro).";
    return;
  }
  const ctx = gatherPresetContext();
  try {
    const { data, error } = await supabase.rpc("build_preset_jobs", {
      p_preset: preset,
      p_ctx: ctx,
    });
    if (error) throw error;
    const first = (data || [])[0];
    txt.value = first
      ? JSON.stringify(first.params || {}, null, 2)
      : "// No jobs";
  } catch (e) {
    console.error("build_preset_jobs preview failed", e);
    txt.value = "// Preview failed";
  }
}

/* Enqueue uses server builder */
let __enqueueBusy = false;
async function enqueueJob() {
  if (__enqueueBusy) return;
  __enqueueBusy = true;

  const preset = $("enq-preset")?.value?.trim();
  const priority = Number($("enq-priority")?.value || 50) || 50;

  if (!preset) {
    setStatus("Choose a preset first.", "warn");
    __enqueueBusy = false;
    return;
  }

  // Disable button to prevent double-submits
  const btn = $("btn-enq");
  btn && (btn.disabled = true);

  if (preset === "master_aggregator") {
    try {
      await runAggregator();
    } catch (e) {
      console.error(e);
      setStatus("Enqueue failed.", "error");
    } finally {
      if (btn) btn.disabled = false;
      __enqueueBusy = false;
    }
    return;
  }

  const ctx = gatherPresetContext();
  try {
    const { data, error } = await supabase.rpc("build_preset_jobs", {
      p_preset: preset,
      p_ctx: ctx,
    });
    if (error) throw error;
    const jobs = data || [];
    if (!jobs.length) {
      setStatus("Nothing to enqueue for this preset.", "warn");
      return;
    }
    setStatus("Enqueuing…", "warn");
    await Promise.all(
      jobs.map((j) =>
        supabase.rpc("enqueue_job", {
          p_job_type: j.job_type,
          p_params: j.params,
          p_priority: priority,
        })
      )
    );
    setStatus("Preset enqueued.", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Enqueue failed.", "error");
  } finally {
    if (btn) btn.disabled = false;
    __enqueueBusy = false;
  }
}

/* Forecast helpers */
async function enqueueForecast(jobType, asOfDate, dryRun = false) {
  const p_as_of_date =
    asOfDate || document.getElementById("fc-date")?.value || null;
  const p_dry_run = !!dryRun;
  const { data, error } = await supabase.rpc("enqueue_forecast_job", {
    job_type: jobType,
    p_as_of_date,
    p_dry_run,
  });
  if (error) throw error;
  return data; // server returns { job_id, job_type, queued_at } or similar
}

/* ---------------------------------------------------
  Jobs table (filters + pagination)
--------------------------------------------------- */
function statusChip(s) {
  const key = (s || "").toLowerCase();
  const map = {
    queued: "q",
    in_progress: "ip",
    running: "ip",
    done: "d",
    error: "f",
  };
  const cls = map[key] || "q";
  return `<span class="status-chip ${cls}">${s || "—"}</span>`;
}
function getFilters() {
  return {
    from: $("jobs-from")?.value || null,
    to: $("jobs-to")?.value || null,
    status: $("jobs-status")?.value || "",
    typeLike: $("jobs-type")?.value?.trim() || "",
  };
}
async function queryJobs(fromIdx, toIdx) {
  const f = getFilters();

  let q = supabase
    .from("etl_jobs")
    .select("id, job_type, status, created_at, finished_at, error_text", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lte("created_at", f.to + "T23:59:59");
  if (f.status) q = q.eq("status", f.status);
  if (f.typeLike) q = q.ilike("job_type", `%${f.typeLike}%`);

  const { data, error, count } = await q;
  if (error) throw error;

  const rows = (data ?? []).map((r) => ({
    job_id: r.id,
    job_type: r.job_type,
    status: r.status,
    created_at: r.created_at,
    finished_at: r.finished_at,
    error_text: r.error_text,
  }));

  return { rows, total: count ?? 0 };
}
function actionMatrix(status) {
  // returns { retry, cancel, jobid, params, error_text }
  switch (status) {
    case "queued":
      return {
        retry: false,
        cancel: true,
        jobid: true,
        params: true,
        error_text: false,
      };
    case "in_progress":
      return {
        retry: false,
        cancel: true,
        jobid: true,
        params: true,
        error_text: false,
      };
    case "done":
      return {
        retry: false,
        cancel: false,
        jobid: true,
        params: true,
        error_text: false,
      };
    case "error":
      return {
        retry: true,
        cancel: false,
        jobid: true,
        params: true,
        error_text: true,
      };
    default:
      return {
        retry: false,
        cancel: false,
        jobid: true,
        params: true,
        error_text: false,
      };
  }
}
async function loadJobs(page = 1) {
  __page = page;
  const from = (page - 1) * __pageSize;
  const to = from + __pageSize - 1;

  const tbody = $("jobs-rows");
  const colspan = getColspan();
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="hint">Loading…</td></tr>`;
  setStatus("Loading jobs…", "warn");
  closePopover(); // avoid stale popover when re-rendering

  try {
    const { rows, total } = await queryJobs(from, to);
    __jobs = rows;
    __jobsTotal = total;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}" class="hint">No jobs match the filters.</td></tr>`;
      setStatus("Loaded 0 job(s).", "ok");
    } else {
      tbody.innerHTML = rows
        .map(
          (r, idx) => `
          <tr data-row="${idx}">
            <td>${r.job_type || "—"}</td>
            <td>${statusChip(r.status)}</td>
            <td>${fmtDateTime(r.created_at)}</td>
            <td>${fmtDateTime(r.finished_at)}</td>
            <td class="row-actions">
              <button class="button" data-act="menu" aria-haspopup="menu" aria-expanded="false">⋯</button>
            </td>
          </tr>`
        )
        .join("");
      setStatus(`Loaded ${total} job(s).`, "ok");
    }

    const start = total === 0 ? 0 : (page - 1) * __pageSize + 1;
    const end = Math.min(page * __pageSize, total);
    $("jobs-range").textContent = `${start}–${end} of ${total}`;

    wireRowActions(); // bind once (guarded)
  } catch (e) {
    console.error(e);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="${colspan}" style="color:#991b1b;">Failed to load jobs.</td></tr>`;
    }
    setStatus("Failed to load jobs.", "error");
  }
}

/* ---------------------------------------------------
  Row actions (floating popover + commands)
--------------------------------------------------- */
function wireRowActions() {
  const tbody = $("jobs-rows");
  if (!tbody) return;
  if (wireRowActions._wired) return; // prevent duplicate bindings
  wireRowActions._wired = true;

  // Close popover on outside click
  document.addEventListener("click", (ev) => {
    const pop = ensurePopover();
    if (ev.target.closest('button[data-act="menu"]')) return; // toggle handler will manage
    if (pop.contains(ev.target)) return;
    closePopover();
  });

  // Close popover on Esc
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closePopover();
  });

  // Toggle popover from the table
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.dataset.act === "menu") {
      e.preventDefault();
      e.stopPropagation();

      const row = btn.closest("tr");
      const idx = Number(row.getAttribute("data-row"));
      const rec = __jobs[idx];
      if (!rec) return;

      const pop = ensurePopover();

      // Toggle off if the same row's popover is already open
      if (
        pop.classList.contains("open") &&
        pop.dataset.rowIndex === String(idx)
      ) {
        closePopover();
        return;
      }

      // Build the actions for this row's status
      const perms = actionMatrix(rec.status);
      const mkBtn = (key, label) =>
        `<button data-rowact="${key}" ${
          perms[key]
            ? ""
            : 'class="disabled" aria-disabled="true" tabindex="-1"'
        }>${label}</button>`;

      pop.dataset.rowIndex = String(idx);
      pop.innerHTML = `
        ${mkBtn("retry", "Retry")}
        ${mkBtn("cancel", "Cancel")}
        ${mkBtn("jobid", "Job ID")}
        ${mkBtn("params", "View Params")}
        ${mkBtn("error_text", "Error Text")}
      `;

      // --- Fixed width & measured positioning ---
      const WIDTH_PX = 160;
      pop.style.width = `${WIDTH_PX}px`;

      pop.classList.add("open");

      const r = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const m = pop.getBoundingClientRect();

      // Right-align to the button, open below by default
      let left = r.right - m.width;
      let top = r.bottom;

      // Flip up if near bottom
      if (top + m.height > vh - 8) top = r.top - m.height;

      // Clamp to viewport
      if (left < 8) left = 8;
      if (left + m.width > vw - 8) left = vw - 8 - m.width;
      if (top < 8) top = 8;

      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
    }
  });

  // Handle actions chosen from the floating popover
  ensurePopover().onclick = async (evt) => {
    const actBtn = evt.target.closest("button[data-rowact]");
    if (!actBtn || actBtn.classList.contains("disabled")) return;

    const idx = Number(ensurePopover().dataset.rowIndex || -1);
    const rec = __jobs[idx];
    if (!rec) return;

    try {
      switch (actBtn.dataset.rowact) {
        case "retry": {
          setStatus("Retrying…", "warn");
          const { error } = await supabase.rpc("retry_jobs_by_ids", {
            p_job_ids: [rec.job_id],
          });
          if (error) throw error;
          setStatus("Retry enqueued.", "ok");
          break;
        }
        case "cancel": {
          const modal = openModal({
            title: "Cancel job?",
            body: `<p class="hint">This will request cancellation for the selected job.</p>`,
            footer: `
              <button type="button" id="confirm-cancel" class="button">Confirm</button>
              <button type="button" id="cancel-close" class="button">Close</button>
            `,
          });
          modal.root
            .querySelector("#cancel-close")
            .addEventListener("click", () => modal.close());
          modal.root
            .querySelector("#confirm-cancel")
            .addEventListener("click", async () => {
              try {
                setStatus("Canceling…", "warn");
                const { error } = await supabase.rpc("cancel_jobs", {
                  p_job_ids: [rec.job_id],
                });
                if (error) throw error;
                setStatus("Cancel requested.", "ok");
                toast("Cancel requested");
              } catch (err) {
                console.error(err);
                setStatus("Action failed.", "error");
              } finally {
                modal.close();
                closePopover();
                await loadJobs(__page);
              }
            });
          return;
        }
        case "jobid": {
          const modal = openModal({
            title: "Job ID",
            body: `
              <div class="field">
                <label style="font-size:.9rem;color:var(--muted)">Identifier</label>
                <div class="mono" style="word-break:break-all">${String(
                  rec.job_id
                )}</div>
              </div>
            `,
            footer: `<button type="button" id="copy-id" class="button">COPY ID</button>`,
          });
          modal.root
            .querySelector("#copy-id")
            .addEventListener("click", async () => {
              await navigator.clipboard.writeText(String(rec.job_id));
              toast("ID copied");
            });
          break;
        }
        case "params": {
          const { data, error } = await supabase
            .from("etl_jobs")
            .select("params")
            .eq("id", rec.job_id)
            .single();
          if (error) {
            const m = openModal({
              title: "Job Params",
              body: `<p style="color:#991b1b">Could not load params.</p>`,
            });
            setTimeout(() => m.close(), 1400);
          } else {
            const pretty = JSON.stringify(data?.params ?? {}, null, 2);
            openModal({
              title: "Job Params",
              body: `<pre class="mono" style="white-space:pre-wrap;word-break:break-word;margin:0">${pretty}</pre>`,
            });
          }
          break;
        }
        case "error_text": {
          let text = rec.error_text;
          if (text == null || text === undefined) {
            const { data, error } = await supabase
              .from("etl_jobs")
              .select("error_text")
              .eq("id", rec.job_id)
              .single();
            if (!error) text = data?.error_text ?? "";
          }
          const pretty = text && String(text).trim() ? text : "—";
          const modal = openModal({
            title: "Error Text",
            body: `<pre class="mono" style="white-space:pre-wrap;word-break:break-word;margin:0">${pretty}</pre>`,
            footer: `<button type="button" id="copy-err" class="button">COPY</button>`,
          });
          modal.root
            .querySelector("#copy-err")
            .addEventListener("click", async () => {
              await navigator.clipboard.writeText(pretty);
              toast("Error text copied");
            });
          break;
        }
      }
    } catch (err) {
      console.error(err);
      setStatus("Action failed.", "error");
    } finally {
      closePopover();
    }
  };
}

/* ---------------------------------------------------
  Wiring
--------------------------------------------------- */
function ensureStatusFilterOptions() {
  const select = $("jobs-status");
  if (!select) return;
  const desired = ["", "queued", "in_progress", "done", "error"];
  const current = Array.from(select.querySelectorAll("option")).map(
    (o) => o.value
  );
  const same =
    desired.length === current.length &&
    desired.every((v, i) => v === current[i]);
  if (same) return;

  select.innerHTML = `
    <option value="">Any</option>
    <option value="queued">queued</option>
    <option value="in_progress">in_progress</option>
    <option value="done">done</option>
    <option value="error">error</option>
  `;
}

function defaultDatesIfEmpty() {
  // Enqueue date
  if ($("enq-date") && !$("enq-date").value)
    $("enq-date").value = todayYmd(true);
  // Forecast date
  const fc = $("fc-date");
  if (fc && !fc.value) fc.value = todayYmd(true);
}

function wireUI() {
  if (wireUI._wired) return;
  wireUI._wired = true;

  $("homeBtn")?.addEventListener("click", () => Platform.goHome());

  // Enqueue (presets)
  $("enq-preset")?.addEventListener("change", () => {
    updatePresetDisabling();
    fillSample();
  });
  $("btn-enq")?.addEventListener("click", () =>
    enqueueJob().catch(console.error)
  );

  // Auto-refresh preview when inputs change
  [
    "enq-date",
    "enq-company",
    "enq-godown",
    "enq-do-fetch",
    "enq-do-parse",
  ].forEach((id) => {
    const el = $(id);
    if (!el) return;
    const ev = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(ev, fillSample);
  });

  // Jobs: filters (debounced)
  const debouncedLoad = debounce(() => loadJobs(1), 300);
  [
    "jobs-from",
    "jobs-to",
    "jobs-status",
    "jobs-type",
    "jobs-page-size",
  ].forEach((id) => {
    const el = $(id);
    if (!el) return;
    const ev =
      id === "jobs-page-size" || id === "jobs-status" ? "change" : "input";
    el.addEventListener(ev, () => {
      if (id === "jobs-page-size") __pageSize = Number(el.value) || 50;
      debouncedLoad();
    });
  });

  $("jobs-prev")?.addEventListener("click", () => {
    if (__page > 1) loadJobs(__page - 1);
  });
  $("jobs-next")?.addEventListener("click", () => {
    const maxPage = Math.max(1, Math.ceil(__jobsTotal / __pageSize));
    if (__page < maxPage) loadJobs(__page + 1);
  });

  // Forecast quick actions
  const fDate = document.getElementById("fc-date");
  const fDry = document.getElementById("fc-dry");
  const withGuard = (fn) => async () => {
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setStatus("Enqueue failed.", "error");
    }
  };

  document.getElementById("btn-fc-baseline")?.addEventListener(
    "click",
    withGuard(async () => {
      setStatus("Enqueuing baseline…", "warn");
      await enqueueForecast("FORECAST_BASELINE", fDate?.value, fDry?.checked);
      setStatus("Baseline enqueued.", "ok");
    })
  );

  document.getElementById("btn-fc-llt")?.addEventListener(
    "click",
    withGuard(async () => {
      setStatus("Enqueuing LLT…", "warn");
      await enqueueForecast("FORECAST_LLT", fDate?.value, fDry?.checked);
      setStatus("LLT enqueued.", "ok");
    })
  );

  document.getElementById("btn-fc-seasonal")?.addEventListener(
    "click",
    withGuard(async () => {
      setStatus("Enqueuing Seasonal…", "warn");
      await enqueueForecast("FORECAST_SEASONAL", fDate?.value, fDry?.checked);
      setStatus("Seasonal enqueued.", "ok");
    })
  );

  document.getElementById("btn-fc-all")?.addEventListener(
    "click",
    withGuard(async () => {
      setStatus("Enqueuing All (chain)…", "warn");
      await enqueueForecast("FORECAST_ALL", fDate?.value, fDry?.checked);
      setStatus("All enqueued.", "ok");
    })
  );

  // Defaults & preset menu
  defaultDatesIfEmpty();
  ensureStatusFilterOptions();

  (async () => {
    await loadPresetsIntoSelect();
    updatePresetDisabling();
    await fillSample();
  })();

  // Initial jobs load
  loadJobs(1);
}

/* ---------------------------------------------------
  Boot
--------------------------------------------------- */
async function waitForSessionReady(timeoutMs = 5000) {
  const now = await supabase.auth.getSession();
  if (now?.data?.session?.user?.id) return now.data.session;
  if (!__sessionWait) {
    __sessionWait = new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);
      const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
        if (session?.user?.id) {
          cleanup();
          resolve(session);
        }
      });
      function cleanup() {
        clearTimeout(timer);
        try {
          sub?.subscription?.unsubscribe();
        } catch (e) {
          console.debug("unsubscribe cleanup failed (safe to ignore)", e);
        }
        __sessionWait = null;
      }
    });
  }
  return await __sessionWait;
}
async function start() {
  if (__started || __starting) return;
  __starting = true;
  setStatus("Checking access…", "warn");
  try {
    await supabase.auth.refreshSession();
  } catch (e) {
    console.debug("[boot] refreshSession skipped:", e?.message || e);
  }
  try {
    const session = await waitForSessionReady(5000);
    if (!session?.user?.id) {
      setStatus("Waiting for sign-in…", "warn");
      __starting = false;
      setTimeout(() => start(), 1200);
      return;
    }
    await requireAdminWithRetry(60, 500);
    wireUI();
    setStatus("Ready", "ok");
    __started = true;
  } catch (e) {
    console.error(e);
    setStatus(e.message || "Access denied.", "error");
    __starting = false;
  }
}
(function boot() {
  setStatus("Loading…", "warn");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

// Auto-refresh jobs table every 1 minute
setInterval(() => {
  if (__started) loadJobs(__page);
}, 60000);
