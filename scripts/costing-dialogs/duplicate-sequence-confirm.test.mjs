import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCostingDialogsV1Enabled } from "../../public/shared/js/costing-feature-flags.js";
import {
  buildDuplicateFamilySequenceConfirmMessage,
  openDuplicateFamilySequenceSubmitModal,
} from "../../public/shared/js/costing-dialogs-duplicate-sequence.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("COSTING_DIALOGS_V1 defaults OFF and accepts exactly string 1", () => {
  for (const value of [null, undefined, "", "0", 1, true, "true"]) {
    assert.equal(isCostingDialogsV1Enabled({ getItem: () => value }), false);
  }
  assert.equal(isCostingDialogsV1Enabled({ getItem: () => "1" }), true);
  assert.equal(
    isCostingDialogsV1Enabled({
      getItem: () => {
        throw new Error("blocked");
      },
    }),
    false,
  );
});

test("duplicate-sequence confirm message matches native wording", () => {
  assert.equal(
    buildDuplicateFamilySequenceConfirmMessage([2, 5]),
    "Duplicate sequence number(s) within this route: 2, 5. Server uniqueness remains authoritative. Continue submit?",
  );
});

test("source: OFF path still contains native window.confirm; ON path gates it", () => {
  const src = read("public/shared/js/costing-suite-production-route.js");
  assert.match(
    src,
    /window\.confirm\(\s*`Duplicate sequence number\(s\) within this route: \$\{dupes\.join\(", "\)\}\. Server uniqueness remains authoritative\. Continue submit\?`/,
    "native confirm literal remains for OFF path",
  );
  assert.ok(
    src.includes("isCostingDialogsV1Enabled()"),
    "flag gate is present before the modal path",
  );
  const flagIdx = src.indexOf("if (isCostingDialogsV1Enabled())");
  const confirmIdx = src.indexOf("window.confirm(");
  assert.ok(flagIdx > 0 && confirmIdx > flagIdx, "flag ON branch precedes native confirm");
  assert.ok(
    src.includes("openDuplicateFamilySequenceSubmitModal"),
    "in-page modal helper is used when flag ON",
  );
  assert.match(
    src,
    /window\.prompt\(\s*"Manufacturing Route Family name:"/,
    "item 2 prompt left untouched",
  );
});

test("service worker cache is hub-cache-v383", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /const CACHE_NAME = "hub-cache-v383"/);
  assert.doesNotMatch(sw, /const CACHE_NAME = "hub-cache-v381"/);
});

function formShell({ notice = "", actionsHtml = "" } = {}) {
  return `<div class="cp-prm-form">${notice ? `<p class="cp-prm-form-notice">${notice}</p>` : ""}<div class="cp-prm-form-actions">${actionsHtml}</div></div>`;
}

function makeModalHarness({ withMutationImpl } = {}) {
  const clickHandlers = [];
  const calls = { open: 0, close: 0 };
  let lastBind = null;
  let lastCleanup = null;
  let hostHtml = "";

  const host = {
    querySelector() {
      return null;
    },
  };

  const openModal = (content) => {
    calls.open += 1;
    hostHtml = content.html || "";
    lastBind = content.bind;
    lastCleanup = content.cleanup;
    lastBind?.(host);
  };
  const closeModal = () => {
    calls.close += 1;
    if (typeof lastCleanup === "function") {
      const cleanup = lastCleanup;
      lastCleanup = null;
      cleanup();
    }
  };
  const onModal = (_el, _type, fn) => {
    clickHandlers.push(fn);
  };
  const withMutation =
    withMutationImpl ||
    (async (button, work) => {
      if (button) button.disabled = true;
      try {
        return await work();
      } finally {
        if (button) button.disabled = false;
      }
    });

  function click(kind) {
    const target = {
      closest(s) {
        if (kind === "confirm" && s.includes("dup-seq-confirm")) return target;
        if (kind === "cancel" && s.includes("dup-seq-cancel")) return target;
        return null;
      },
      disabled: false,
      setAttribute() {},
      removeAttribute() {},
    };
    return Promise.all(clickHandlers.map((fn) => fn({ target })));
  }

  return {
    calls,
    hostHtml: () => hostHtml,
    openModal,
    closeModal,
    onModal,
    withMutation,
    formShell,
    click,
    runCleanup: () => {
      if (typeof lastCleanup === "function") {
        const cleanup = lastCleanup;
        lastCleanup = null;
        cleanup();
      }
    },
  };
}

test("Confirm sends exactly one submitFamily write", async () => {
  const h = makeModalHarness();
  const writes = [];
  const done = openDuplicateFamilySequenceSubmitModal({
    dupes: [1, 1],
    openModal: h.openModal,
    closeModal: h.closeModal,
    formShell: h.formShell,
    onModal: h.onModal,
    withMutation: h.withMutation,
    isDetailsModalOpen: () => false,
    escapeHtml: (v) => String(v),
    onConfirmWrite: async () => {
      writes.push(1);
    },
  });
  assert.equal(h.calls.open, 1);
  await h.click("confirm");
  assert.equal(await done, true);
  assert.equal(writes.length, 1);
});

test("Cancel sends no write", async () => {
  const h = makeModalHarness();
  let writes = 0;
  const done = openDuplicateFamilySequenceSubmitModal({
    dupes: [3],
    openModal: h.openModal,
    closeModal: h.closeModal,
    formShell: h.formShell,
    onModal: h.onModal,
    withMutation: h.withMutation,
    escapeHtml: (v) => String(v),
    onConfirmWrite: async () => {
      writes += 1;
    },
  });
  await h.click("cancel");
  assert.equal(await done, false);
  assert.equal(writes, 0);
});

test("Escape/backdrop cleanup sends no write", async () => {
  const h = makeModalHarness();
  let writes = 0;
  const done = openDuplicateFamilySequenceSubmitModal({
    dupes: [4],
    openModal: h.openModal,
    closeModal: h.closeModal,
    formShell: h.formShell,
    onModal: h.onModal,
    withMutation: h.withMutation,
    escapeHtml: (v) => String(v),
    onConfirmWrite: async () => {
      writes += 1;
    },
  });
  h.runCleanup();
  assert.equal(await done, false);
  assert.equal(writes, 0);
});

test("double-click Confirm sends one write only", async () => {
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let inFlight = false;
  const h = makeModalHarness({
    withMutationImpl: async (button, work) => {
      if (inFlight) return { ok: false, reason: "busy" };
      inFlight = true;
      if (button) button.disabled = true;
      try {
        return await work();
      } finally {
        inFlight = false;
        if (button) button.disabled = false;
      }
    },
  });
  const writes = [];
  const done = openDuplicateFamilySequenceSubmitModal({
    dupes: [9],
    openModal: h.openModal,
    closeModal: h.closeModal,
    formShell: h.formShell,
    onModal: h.onModal,
    withMutation: h.withMutation,
    escapeHtml: (v) => String(v),
    onConfirmWrite: async () => {
      writes.push("w");
      await gate;
    },
  });
  const first = h.click("confirm");
  const second = h.click("confirm");
  await Promise.resolve();
  assert.equal(writes.length, 1);
  release();
  await Promise.all([first, second, done]);
  assert.equal(writes.length, 1);
});
