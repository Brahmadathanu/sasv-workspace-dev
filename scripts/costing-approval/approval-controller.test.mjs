import test from "node:test";
import assert from "node:assert/strict";
import {
  RPC,
  createCostingApprovalScreenController,
} from "../../public/shared/js/costing-approval-screen.js";

function el(id, extras = {}) {
  return {
    id,
    hidden: extras.hidden === true,
    classList: {
      _set: new Set(
        extras.className ? String(extras.className).split(/\s+/).filter(Boolean) : [],
      ),
      add(name) {
        this._set.add(name);
      },
      remove(name) {
        this._set.delete(name);
      },
      contains(name) {
        return this._set.has(name);
      },
      toggle(name, force) {
        if (force === false) this._set.delete(name);
        else if (force === true) this._set.add(name);
        else if (this._set.has(name)) this._set.delete(name);
        else this._set.add(name);
      },
    },
    attrs: { ...(extras.attrs || {}) },
    value: extras.value ?? "",
    checked: extras.checked === true,
    textContent: extras.textContent ?? "",
    innerHTML: extras.innerHTML ?? "",
    disabled: extras.disabled === true,
    focused: false,
    listeners: {},
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    getAttribute(k) {
      return this.attrs[k] ?? null;
    },
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    focus() {
      this.focused = true;
    },
    querySelector() {
      return null;
    },
    closest() {
      return null;
    },
  };
}

function makeDoc(ids) {
  const map = new Map(Object.entries(ids));
  return {
    getElementById(id) {
      return map.get(id) || null;
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
  };
}

function chainableQuery(result) {
  const api = {
    select() {
      return api;
    },
    eq() {
      return api;
    },
    order() {
      return api;
    },
    maybeSingle: async () => result,
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return api;
}

function makeSupabase({ periodRow, runRows }) {
  return {
    from(view) {
      if (String(view).includes("period_run_status")) {
        return chainableQuery({ data: periodRow, error: null });
      }
      return chainableQuery({ data: runRows, error: null });
    },
  };
}

const PERIOD_ROW = {
  period_start: "2026-10-01",
  display_label_v2: "Draft – not for pricing (run 151)",
  pricing_use_label: "Draft – not for pricing",
  official_valuation_date: null,
  latest_draft_valuation_date: "2026-10-31",
  valuation_date: "2026-10-15",
  display_state: "DRAFT",
};

const RUN_ROWS = [
  {
    refresh_run_id: 151,
    display_status: "Draft",
    display_label: "Draft – not for pricing (run 151)",
    pricing_use_label: "Draft – not for pricing",
    valuation_date: "2026-10-31",
  },
];

function basePreview(overrides = {}) {
  return {
    preview_ack_id: 77,
    ack_expires_at: new Date(Date.now() + 60_000).toISOString(),
    run: 151,
    run_valuation_date: "2026-10-31",
    action: "APPROVE",
    can_approve: true,
    checks: [{ code: "OK", pass: true, detail: "ok" }],
    counts: { ready: 1, review_required: 0, blocked: 0, total: 1 },
    cutoff: { message: "ok", moves: false },
    impact: { summary: "none" },
    sku_changes: [],
    staleness: { is_stale: false, acknowledgement_required: false },
    ...overrides,
  };
}

function buildHarness({
  rpcImpl,
  confirm = true,
  confirmFn,
  periodRow = PERIOD_ROW,
  runRows = RUN_ROWS,
  toasts,
} = {}) {
  // Avoid real intervals — countdown would keep node:test alive after the suite.
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};

  const calls = [];
  const ids = {
    costingApprovalPanel: el("costingApprovalPanel", {
      hidden: true,
      className: "hidden",
    }),
    costingApprovalModal: el("costingApprovalModal", {
      hidden: true,
      className: "hidden",
    }),
    casPeriodSummary: el("casPeriodSummary"),
    casRunList: el("casRunList"),
    casPreviewBody: el("casPreviewBody"),
    casApproveForm: el("casApproveForm", { hidden: true }),
    casReason: el("casReason", {
      value: "Board approved October month-end draft",
    }),
    casApprovalReference: el("casApprovalReference", {
      value: "BOARD/2026/10",
    }),
    casStaleAck: el("casStaleAck", { checked: false }),
    casStaleAckWrap: el("casStaleAckWrap", { hidden: true }),
    casFormError: el("casFormError", { hidden: true }),
    casApproveBtn: el("casApproveBtn", {
      disabled: true,
      textContent: "Approve",
    }),
    casFinalizeBtn: el("casFinalizeBtn", {
      disabled: true,
      textContent: "Month-end Finalise",
    }),
    casModalTitle: el("casModalTitle", { textContent: "Review for approval" }),
    casModalSubtitle: el("casModalSubtitle"),
    casModalClose: el("casModalClose"),
    casCancelBtn: el("casCancelBtn"),
    casCopyErrorBtn: el("casCopyErrorBtn"),
  };
  const doc = makeDoc(ids);
  const ctrl = createCostingApprovalScreenController({
    supabase: makeSupabase({ periodRow, runRows }),
    costingRpc: async (name, params) => {
      calls.push({ name, params });
      if (rpcImpl) return rpcImpl(name, params, calls);
      if (name === RPC.preview) return { data: basePreview(), error: null };
      if (name === RPC.approve || name === RPC.finalize) {
        return { data: { new_run: 151, audit_id: 1 }, error: null };
      }
      return { data: null, error: null };
    },
    showToast(msg) {
      toasts?.push(msg);
    },
    getActivePeriodStart: () => "2026-10-01",
    isControlCenterRoute: () => true,
    confirmFn:
      confirmFn ||
      (() => confirm),
    doc,
  });
  const cleanup = () => {
    ctrl.onRouteExit();
    globalThis.setInterval = realSetInterval;
    globalThis.clearInterval = realClearInterval;
  };
  return { ctrl, calls, ids, doc, cleanup };
}

test("mount and reload do not call preview", async () => {
  const { ctrl, calls, cleanup } = buildHarness();
  try {
    ctrl.mount();
    await ctrl.reload();
    assert.equal(calls.filter((c) => c.name === RPC.preview).length, 0);
  } finally {
    cleanup();
  }
});

test("one preview call per Review click", async () => {
  const { ctrl, calls, ids, cleanup } = buildHarness();
  try {
    await ctrl.reload();
    await ctrl.openPreviewForRun(151);
    assert.equal(calls.filter((c) => c.name === RPC.preview).length, 1);
    assert.equal(ids.costingApprovalModal.hidden, false);
    assert.equal(ids.costingApprovalModal.attrs.role, "dialog");
    assert.equal(
      ids.costingApprovalModal.attrs["aria-labelledby"],
      "casModalTitle",
    );
  } finally {
    cleanup();
  }
});

test("Approve and Finalise disable while in flight; double-click sends one call", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const { ctrl, calls, ids, cleanup } = buildHarness({
    rpcImpl: async (name) => {
      if (name === RPC.preview) return { data: basePreview(), error: null };
      await gate;
      return { data: { new_run: 151, audit_id: 9 }, error: null };
    },
  });
  try {
    await ctrl.openPreviewForRun(151);
    const first = ctrl.submitDecision("approve");
    const second = ctrl.submitDecision("approve");
    assert.equal(ids.casApproveBtn.disabled, true);
    assert.equal(ids.casFinalizeBtn.disabled, true);
    release();
    await Promise.all([first, second]);
    assert.equal(calls.filter((c) => c.name === RPC.approve).length, 1);
  } finally {
    cleanup();
  }
});

test("stale tick required and sends p_acknowledge_stale true", async () => {
  const { ctrl, calls, ids, cleanup } = buildHarness({
    rpcImpl: async (name) => {
      if (name === RPC.preview) {
        return {
          data: basePreview({
            staleness: {
              is_stale: true,
              acknowledgement_required: true,
              message: "Later rows",
            },
          }),
          error: null,
        };
      }
      return { data: { new_run: 151, audit_id: 2 }, error: null };
    },
  });
  try {
    await ctrl.openPreviewForRun(151);
    assert.equal(ids.casStaleAckWrap.hidden, false);
    assert.equal(ctrl.canSubmitApprove(), false);
    ids.casStaleAck.checked = true;
    ctrl.syncSubmitButtons();
    assert.equal(ctrl.canSubmitApprove(), true);
    await ctrl.submitDecision("approve");
    const approveCall = calls.find((c) => c.name === RPC.approve);
    assert.equal(approveCall.params.p_acknowledge_stale, true);
  } finally {
    cleanup();
  }
});

test("Approve and supersede label and confirmation when action is APPROVE_AND_SUPERSEDE", async () => {
  const confirms = [];
  const { ctrl, ids, cleanup } = buildHarness({
    confirmFn: (msg) => {
      confirms.push(msg);
      return true;
    },
    rpcImpl: async (name) => {
      if (name === RPC.preview) {
        return {
          data: basePreview({
            action: "APPROVE_AND_SUPERSEDE",
            current_approved_run: 143,
            current_approved_valuation_date: "2026-10-20",
          }),
          error: null,
        };
      }
      return {
        data: { new_run: 151, old_run: 143, superseded: true },
        error: null,
      };
    },
  });
  try {
    await ctrl.openPreviewForRun(151);
    assert.match(ids.casApproveBtn.textContent, /Approve and supersede run 143/);
    await ctrl.submitDecision("approve");
    assert.match(confirms[0], /supersede run 143/);
  } finally {
    cleanup();
  }
});

test("already used closes and reloads", async () => {
  const { ctrl, calls, ids, cleanup } = buildHarness({
    rpcImpl: async (name) => {
      if (name === RPC.preview) return { data: basePreview(), error: null };
      return {
        data: null,
        error: { message: "W2_PREVIEW_ACK_ALREADY_USED: ack consumed" },
      };
    },
  });
  try {
    await ctrl.openPreviewForRun(151);
    await ctrl.submitDecision("approve");
    assert.equal(ids.costingApprovalModal.hidden, true);
    assert.equal(calls.filter((c) => c.name === RPC.approve).length, 1);
  } finally {
    cleanup();
  }
});

test("open again refusal makes no automatic preview call", async () => {
  const { ctrl, calls, ids, cleanup } = buildHarness({
    rpcImpl: async (name) => {
      if (name === RPC.preview) return { data: basePreview(), error: null };
      return {
        data: null,
        error: { message: "W2_PREVIEW_ACK_EXPIRED: ttl elapsed" },
      };
    },
  });
  try {
    await ctrl.openPreviewForRun(151);
    const before = calls.filter((c) => c.name === RPC.preview).length;
    ids.casReason.value = "Keep this reason text for reopen";
    ids.casApprovalReference.value = "KEEP-REF";
    await ctrl.submitDecision("approve");
    assert.equal(calls.filter((c) => c.name === RPC.preview).length, before);
    assert.equal(ids.casReason.value, "Keep this reason text for reopen");
    assert.equal(ids.casApprovalReference.value, "KEEP-REF");
    assert.equal(ids.casStaleAck.checked, false);
    assert.match(ids.casPreviewBody.innerHTML, /Open preview again/);
    assert.equal(ctrl._state.previewAckId, null);
  } finally {
    cleanup();
  }
});

test("finalise already_approved is treated as success", async () => {
  const toasts = [];
  const { ctrl, ids, cleanup } = buildHarness({
    toasts,
    rpcImpl: async (name) => {
      if (name === RPC.preview) return { data: basePreview(), error: null };
      return {
        data: {
          approval: { already_approved: true },
          lock: null,
          lock_note: "Not locked: lock only before formal Close",
        },
        error: null,
      };
    },
  });
  try {
    await ctrl.openPreviewForRun(151);
    await ctrl.submitDecision("finalize");
    assert.ok(toasts.some((t) => /already approved/i.test(t)));
    assert.equal(ids.costingApprovalModal.hidden, true);
  } finally {
    cleanup();
  }
});

test("legacy stored date is never shown as the official date", async () => {
  const { ctrl, ids, cleanup } = buildHarness();
  try {
    await ctrl.reload();
    assert.match(
      ids.casPeriodSummary.innerHTML,
      /Official \(approved\) date<\/span><strong>Not approved<\/strong>/,
    );
    assert.match(
      ids.casPeriodSummary.innerHTML,
      /Stored month date \(legacy\)<\/span><strong>2026-10-15<\/strong>/,
    );
    assert.doesNotMatch(
      ids.casPeriodSummary.innerHTML,
      /Official \(approved\) date<\/span><strong>2026-10-15<\/strong>/,
    );
  } finally {
    cleanup();
  }
});
