// WP10 G2 — DOM rendering for the safeguard surfaces. Loaded ONLY by dynamic import() when localStorage WP10_SAFEGUARDS_V1 === "1"
// (see wp10-safeguards.js). Every server-supplied string is shown through textContent or escapeHtml after safeText(); nothing here writes data,
// rebuilds anything, retries a writer or calls a Supabase table. RPC calls go through the host-supplied `costingRpc` function only.
import {
  HORIZON_CLASS_LABELS,
  HORIZON_DAYS,
  HORIZON_MAX_PAGES,
  HORIZON_MAX_ROWS,
  HORIZON_MAX_SCANNED,
  HORIZON_TIME_BUDGET_MS,
  HORIZON_PAGE_LIMIT,
  buildHorizonRequest,
  createLatestGuard,
  isMissingRpcError,
  readinessStateModel,
  safeText,
  validateHorizonEnvelope,
  classifyReadinessError,
} from "./wp10-safeguards.js?v=18f867c0f4";

// Minimal self-contained styles (reuse existing tokens/classes where present); injected once, only when this module is loaded (flag ON).
const CSS = `.wp10-meta{font-size:.78rem;color:var(--sasv-text-muted,#5b6472);overflow-wrap:anywhere}
.wp10-readiness-state{display:block;box-sizing:border-box;max-width:min(100%,calc(100vw - 32px));overflow-wrap:anywhere}.wp10-readiness-state p,.wp10-readiness-state ol{margin:.4rem 0}.wp10-steps{padding-left:1.2rem}
.wp10-horizon{margin:12px 0;padding:10px 12px;border:1px solid var(--sasv-control-border,#d6dbe3);border-radius:8px;background:var(--sasv-surface,#fff);min-width:0}
.wp10-horizon__title{margin:0 0 6px;font-size:1rem}.wp10-horizon__actions{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.wp10-horizon__list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.wp10-horizon__row{padding:8px;border:1px solid var(--sasv-control-border,#e5e7eb);border-radius:8px;min-width:0;overflow-wrap:anywhere}
.wp10-horizon__ess{font-size:.85rem;margin-top:4px}
.wp10-activation{margin-top:8px;padding:8px;border:1px solid var(--sasv-control-border,#d6dbe3);border-radius:8px;overflow-wrap:anywhere;min-width:0}
.wp10-activation--rejected{border-color:#b42318}.wp10-activation__items{margin:6px 0 0;padding-left:1.1rem}`;
function injectStyles(doc) {
  if (!doc || doc.getElementById("wp10SafeguardsStyles")) return;
  const s = doc.createElement("style");
  s.id = "wp10SafeguardsStyles";
  s.textContent = CSS;
  doc.head.appendChild(s);
}

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---- 1. Readiness: explanatory unavailable state (HTML string, replaces the one-line message only when the flag is on) ----
export function readinessUnavailableHtml(err, periodStart) {
  if (typeof document !== "undefined") injectStyles(document);
  const m = readinessStateModel(err, { periodStart });
  return `<div class="cp-readiness-unavailable status error wp10-readiness-state" role="alert" data-wp10-state="${esc(m.kind)}">
    <strong>Readiness unavailable — ${esc(m.title)}</strong>
    <div class="wp10-meta">${esc(m.period)} · status ${esc(m.token)}</div>
    <p>${esc(m.meaning)}</p>
    <p>${esc(m.failClosed)}</p>
    <p><strong>Accountability.</strong> ${esc(m.owner)}</p>
    <p><strong>Review.</strong> ${esc(m.cadence)}</p>
    <ol class="wp10-steps">${m.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <p class="wp10-meta">${esc(m.automatic)}</p>
  </div>`;
}

// ---- 2. Operational expiry horizon panel ----
const PANELS = new WeakMap();

function el(doc, tag, cls, text) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function mountOperationalHorizonPanel({ host, anchor = null, costingRpc, isActive = () => true, periodStart = null } = {}) {
  const doc = host?.ownerDocument;
  if (!host || !doc || typeof costingRpc !== "function") return null;
  injectStyles(doc);
  let panel = doc.getElementById("wp10HorizonPanel");
  if (panel && PANELS.has(panel)) {
    // R-review: a cached panel must not keep the first caller's closures. Re-bind to the CURRENT controller; a pending read of an older one is discarded.
    const api0 = PANELS.get(panel);
    api0.rebind({ costingRpc, isActive, periodStart });
    return api0;
  }
  if (panel) panel.remove();
  panel = el(doc, "section", "wp10-horizon");
  panel.id = "wp10HorizonPanel";
  panel.setAttribute("aria-label", "Operational expiry horizon");
  (anchor && anchor.parentNode ? anchor.parentNode : host).insertBefore(panel, anchor && anchor.parentNode ? anchor.nextSibling : null);

  const guard = createLatestGuard();
  const bound = { costingRpc, isActive, periodStart };
  const st = { rows: [], context: null, pages: 0, hasMore: false, next: null, loading: false, status: "idle", message: "", scanned: 0, rowIds: new Set(), lastSkuId: 0, startedAt: 0, restarts: 0, disposed: false };

  function render() {
    panel.replaceChildren();
    panel.appendChild(el(doc, "h3", "wp10-horizon__title", `Operational expiry horizon — next ${HORIZON_DAYS} days`));
    panel.appendChild(el(doc, "p", "wp10-meta", "A separate current-operational view of ACTIVE operational SKUs. It is evaluated at today's IST date and every effective-date boundary inside the window — not at the governed period's valuation date — and it does not change Readiness, the activation guard or any status. Dates shown are the first day a requirement is NOT covered (effective-to dates are inclusive). Nothing is notified or deactivated."));
    const status = el(doc, "div", "wp10-horizon__status", "");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    panel.appendChild(status);
    if (st.status === "idle") {
      status.textContent = "Not loaded. Loading reads only; it never rebuilds readiness.";
    } else if (st.status === "loading" && !st.rows.length) {
      status.textContent = "Loading the horizon…";
    } else if (st.status === "unavailable") {
      status.textContent = st.message;
    } else if (st.status === "partial") {
      status.textContent = st.message;
    } else if (st.status === "error") {
      status.textContent = st.message;
      status.setAttribute("role", "alert");
    } else if (st.context) {
      status.textContent = `Evaluated from ${st.context.evaluated_from} (today's IST date) through ${st.context.evaluated_through}. ${st.rows.length} SKU${st.rows.length === 1 ? "" : "s"} flagged after scanning ${st.scanned}${st.hasMore ? "; more pages are available" : ""}. ${st.context.route_boundary_coverage === "PARTIAL" ? "Route boundary coverage is PARTIAL: this assessment does not cover every route dependency. " : "Route boundaries assessed: product routes, route-family routes, family assignments, effective steps and overrides. "}${st.context.amounts_evaluated ? "" : "Amounts (zero/negative) are not evaluated."}`;
    }
    const actions = el(doc, "div", "wp10-horizon__actions");
    const load = el(doc, "button", "btn secondary", st.rows.length || st.status === "ready" ? "Reload from the start" : "Load horizon");
    load.type = "button";
    load.disabled = st.loading;
    load.addEventListener("click", () => fetchPage(true));
    actions.appendChild(load);
    if (st.hasMore && st.pages < HORIZON_MAX_PAGES) {
      const more = el(doc, "button", "btn secondary", "Load more");
      more.type = "button";
      more.disabled = st.loading;
      more.addEventListener("click", () => fetchPage(false));
      actions.appendChild(more);
    } else if (st.hasMore) {
      actions.appendChild(el(doc, "span", "wp10-meta", `Page budget reached (${HORIZON_MAX_PAGES} pages). Narrow the review by owner screen.`));
    }
    panel.appendChild(actions);
    if (st.rows.length) {
      const list = el(doc, "ul", "wp10-horizon__list");
      for (const r of st.rows) {
        const li = el(doc, "li", "wp10-horizon__row");
        li.appendChild(el(doc, "strong", null, `SKU ${r.sku_id} · product ${r.product_id}`));
        for (const e of r.essentials) {
          const line = el(doc, "div", "wp10-horizon__ess");
          const when = e.first_issue_date ? ` from ${e.first_issue_date}` : "";
          const rec = e.recovers_on ? `, recovers ${e.recovers_on}` : e.classification === "GAP_RECOVERS_IN_WINDOW" ? "" : "";
          line.textContent = `${HORIZON_CLASS_LABELS[e.classification]}: ${e.code}${when}${rec} — owner screen: ${e.owner_screen || "—"}`;
          li.appendChild(line);
        }
        list.appendChild(li);
      }
      panel.appendChild(list);
    }
  }

  function reset() { st.rows = []; st.pages = 0; st.next = null; st.hasMore = false; st.scanned = 0; st.context = null; st.rowIds = new Set(); st.lastSkuId = 0; st.startedAt = Date.now(); }
  function stop(status, message) { st.status = status; st.message = message; st.hasMore = false; }

  async function fetchPage(isReset) {
    if (st.disposed || st.loading) return;
    if (!bound.isActive()) { guard.cancel(); st.loading = false; st.status = "idle"; render(); return; }
    if (isReset) { reset(); st.restarts = 0; }
    // Bounds: pages, flagged rows, scanned SKUs and wall-clock time. Hitting one STOPS with a partial label - never a completion claim.
    if (st.pages >= HORIZON_MAX_PAGES || st.rows.length >= HORIZON_MAX_ROWS || st.scanned >= HORIZON_MAX_SCANNED) { stop("partial", "Stopped at the client page/row/scan budget. The list shown is PARTIAL and says nothing about SKUs not yet scanned."); render(); return; }
    if (st.startedAt && Date.now() - st.startedAt > HORIZON_TIME_BUDGET_MS) { stop("partial", "Stopped at the time budget. The list shown is PARTIAL."); render(); return; }
    const token = guard.next();
    st.loading = true; st.status = "loading"; render();
    const sentCursor = isReset ? null : st.next;
    const req = buildHorizonRequest({ afterSkuId: sentCursor, limit: HORIZON_PAGE_LIMIT, days: HORIZON_DAYS });
    const rpc = bound.costingRpc;
    let restart = false;
    try {
      const { data, error } = await rpc(req.rpc, req.args);
      if (!guard.isCurrent(token) || st.disposed) return;
      if (!bound.isActive()) { st.status = "idle"; return; }
      if (error) throw error;
      const v = validateHorizonEnvelope(data, { context: st.context, lastSkuId: st.lastSkuId, rowIds: st.rowIds, expectedCursor: st.next }, { sentCursor });
      if (!v.ok && v.contextChanged && st.restarts < 1) {
        st.restarts += 1; reset(); restart = true; // window crossed midnight / coverage changed: one clean restart from the first page
      } else if (!v.ok) {
        st.hasMore = false;
        st.status = "error"; st.message = `Operational expiry horizon unavailable — ${v.error} Rows shown so far are PARTIAL and not an assessment of every SKU.`;
      } else {
      st.context = v.value.context; st.rows = st.rows.concat(v.value.rows); st.rowIds = new Set(st.rows.map((r) => r.sku_id)); st.lastSkuId = v.value.lastSkuId;
      st.pages += 1; st.hasMore = v.value.hasMore; st.next = v.value.nextAfterSkuId; st.scanned += v.value.scannedCount; st.status = "ready";
      }
    } catch (err) {
      if (!guard.isCurrent(token) || st.disposed) return;
      st.hasMore = false;
      if (isMissingRpcError(err)) { st.status = "unavailable"; st.message = "The operational expiry horizon is not available on this server yet. Nothing has changed; Readiness is unaffected."; }
      else { const c = classifyReadinessError(err); st.status = "error"; st.message = `Operational expiry horizon unavailable — ${c.kind === "PERMISSION" ? "you do not have access" : c.kind === "TIMEOUT" ? "the request timed out" : c.kind === "TRANSPORT" ? "the server could not be reached" : safeText(err?.message, 160) || "unexpected error"}. Nothing was retried automatically.${st.rows.length ? " Rows shown so far are PARTIAL." : ""}`; }
    } finally {
      if (guard.isCurrent(token) && !st.disposed) { st.loading = false; render(); }
    }
    if (restart && !st.disposed) { st.status = "idle"; await fetchPage(false); }
  }
  function rebind(next) { guard.cancel(); st.loading = false; reset(); st.status = "idle"; st.message = ""; Object.assign(bound, next); render(); }
  function dispose() { st.disposed = true; guard.cancel(); st.loading = false; PANELS.delete(panel); panel.remove(); }
  const api = { render, fetchPage, guard, state: st, rebind, dispose, get periodStart() { return bound.periodStart; } };
  PANELS.set(panel, api);
  render();
  return api;
}

/** Remove the horizon panel of a document (lens exit / controller disposal); a pending read of it is cancelled and its result discarded. */
export function disposeHorizonPanel(doc) {
  const panel = doc?.getElementById?.("wp10HorizonPanel");
  const api = panel && PANELS.get(panel);
  if (api) api.dispose(); else panel?.remove();
}

// ---- 3. Manage Products: activation pre-check / rejection detail (DOM nodes; every string via textContent) ----
export function statusNode(doc, text, role = "status") {
  injectStyles(doc);
  const n = el(doc, "div", "wp10-activation__status", text);
  n.setAttribute("role", role);
  return n;
}

/** result: {ok:true, complete, items, asOf} | {ok:false, reason} | error info from parseActivationError. linkFor(item) → {href,label}|null (verified only). */
export function buildActivationCheckNode(doc, check, { linkFor = () => null } = {}) {
  const box = el(doc, "div", "wp10-activation");
  box.setAttribute("data-wp10-activation", check?.ok ? (check.complete ? "complete" : "missing") : "unavailable");
  if (!check?.ok) {
    const ambiguous = check?.reason === "AMBIGUOUS_PM_BOM";
    box.appendChild(statusNode(doc, ambiguous
      ? "More than one PM BOM revision applies to this SKU, so the requirement cannot be evaluated. Resolve the ambiguity in PM BOM Manager; the server will still decide when you confirm."
      : `Activation requirements could not be checked (${safeText(check?.reason || "unavailable", 60)}). The server will still check them when you confirm.`));
    return box;
  }
  if (check.complete) {
    box.appendChild(statusNode(doc, `The pre-check found no missing requirement${check.asOf ? ` as of ${check.asOf}` : ""}. This does not guarantee activation: the server checks again when you confirm, and activation does not make costing READY.`));
    return box;
  }
  box.appendChild(statusNode(doc, `The pre-check found missing requirements${check.asOf ? ` as of ${check.asOf} (the activation guard's own date rule)` : ""}. You may still try: the server decides when you confirm.`));
  box.appendChild(buildItemList(doc, check.items, linkFor));
  return box;
}

export function buildItemList(doc, items, linkFor) {
  const ul = el(doc, "ul", "wp10-activation__items");
  for (const it of items || []) {
    const li = el(doc, "li");
    li.appendChild(el(doc, "strong", null, it.label));
    li.appendChild(doc.createTextNode(it.known ? ` (${it.code})` : ""));
    if (it.screen) li.appendChild(el(doc, "div", "wp10-meta", `Resolve in: ${it.screen}`));
    const link = typeof linkFor === "function" ? linkFor(it) : null;
    if (link?.href) {
      const a = el(doc, "a", "btn secondary", link.label || "Open");
      a.href = link.href; a.target = "_blank"; a.rel = "noopener noreferrer";
      li.appendChild(a);
    } else if (it.screen) {
      li.appendChild(el(doc, "div", "wp10-meta", "No verified direct destination: open the screen from the launcher."));
    }
    ul.appendChild(li);
  }
  return ul;
}

/** parsed: result of parseActivationError. */
export function buildRejectionNode(doc, parsed, { linkFor = () => null } = {}) {
  const box = el(doc, "div", "wp10-activation wp10-activation--rejected");
  box.setAttribute("role", "alert");
  box.setAttribute("data-wp10-activation", `rejected-${parsed.kind}`);
  const headline = {
    MISSING_ESSENTIALS: "Activation was refused by the server: required items are missing.",
    AMBIGUOUS_PM_BOM: "Activation was refused: more than one approved PM BOM revision applies, so the PM BOM cannot be resolved.",
    PERMISSION: "Activation was refused: you do not have permission to activate SKUs.",
    NOT_AUTHENTICATED: "Activation was refused: you are not signed in.",
    PARENT_OR_MISSING: "Activation was refused: the product is not active or does not exist.",
    STATE_CHANGED: "Activation was not applied: the SKU's state changed.",
    UNAVAILABLE: "Activation could not be completed: the server could not be reached. Nothing was changed by this screen; check the SKU state before retrying.",
    OTHER: "Activation was refused by the server.",
  }[parsed.kind];
  box.appendChild(el(doc, "strong", null, headline));
  if (parsed.message) box.appendChild(el(doc, "div", "wp10-meta", parsed.message));
  if (parsed.kind === "AMBIGUOUS_PM_BOM") box.appendChild(el(doc, "div", "wp10-meta", "Resolve in: PM BOM Manager (end or supersede the overlapping approved revision)."));
  if (parsed.items?.length) box.appendChild(buildItemList(doc, parsed.items, linkFor));
  if (parsed.hint) box.appendChild(el(doc, "div", "wp10-meta", `Server hint: ${parsed.hint}`));
  return box;
}
