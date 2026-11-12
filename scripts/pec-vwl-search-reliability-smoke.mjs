/**
 * PEC-VWL-R1 — Vendor-wise Buying List search reliability smoke.
 * Deterministic delayed/failing RPC mocks. No network, no Supabase, no DB changes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(
  join(root, "public/shared/js/procurement-execution-console.js"),
  "utf8",
).replace(/\r\n/g, "\n");

const fails = [];
let checks = 0;
const assert = (cond, msg) => {
  checks += 1;
  if (!cond) fails.push(msg);
};

function extractFunction(name) {
  const m = src.match(new RegExp(`(?:async )?function ${name}\\(`));
  if (!m) throw new Error(`missing function ${name}`);
  const start = m.index;
  let pd = 0;
  let close = src.indexOf("(", start);
  for (; close < src.length; close += 1) {
    if (src[close] === "(") pd += 1;
    else if (src[close] === ")" && --pd === 0) break;
  }
  const open = src.indexOf("{", close);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const code = [
  "let vwlLoadSeq = 0;",
  "let vwlLoadAbort = null;",
  "const PEC_PAGE_LIMIT_MAX = 200;",
  "const PEC_EXPORT_MAX_ROWS = 50000;",
  "const DEFAULT_PAGE_SIZE = 30;",
  ...[
    "unpackPagedRows",
    "clampPageLimit",
    "rpcPecPaged",
    "fetchPageWithRecovery",
    "normalizeVwlServerFilterOptions",
    "pickRpcField",
    "buildVwlSplitKey",
    "buildVwlSplitLookup",
    "buildVwlRpcFilterParams",
    "withVwlAbortSignal",
    "refreshVwlSplitLookup",
    "fetchVendorBuylistFilteredRows",
    "loadVendorBuylist",
    "fetchAllVendorBuylistRows",
  ].map(extractFunction),
].join("\n");

function makeHarness() {
  const calls = [];
  const h = {
    calls,
    loadingDepth: 0,
    toasts: [],
    renders: [],
    tbody: { innerHTML: "" },
    input: { value: "" },
    mask: { show: 0, hide: 0 },
  };
  const state = {
    vwlFilters: { splitOnly: false },
    vwl: { page: 0, pageSize: 50, vendorFilterKey: "", rows: [], search: "" },
    vwlMaterialClassOptions: [1],
  };
  h.state = state;
  // rpc mock: each call is a controllable deferred that honours abortSignal.
  const supabase = {
    rpc(name, params) {
      const call = { name, params, aborted: false };
      call.promise = new Promise((resolve) => {
        // Paged RPCs answer [{row_data,total_count}]; tests supply plain rows.
        call.resolve = (data) =>
          resolve({
            data:
              name === "proc_vendorwise_buylist_operational_paged" &&
              Array.isArray(data)
                ? data.map((r) => ({ row_data: r, total_count: data.length }))
                : data,
            error: null,
          });
        call.fail = (message) => resolve({ data: null, error: { message } });
      });
      calls.push(call);
      // The options RPC is not under test here: answer it immediately.
      if (name === "proc_vendorwise_buylist_operational_options") call.resolve([]);
      const builder = {
        abortSignal(signal) {
          signal.addEventListener("abort", () => {
            call.aborted = true;
            call.fail("AbortError: aborted");
          });
          return builder;
        },
        then: (a, b) => call.promise.then(a, b),
      };
      return builder;
    },
  };
  const ctx = vm.createContext({
    state,
    supabase,
    AbortController,
    console: { warn() {}, log() {}, error() {} },
    qs: (id) =>
      id === "vwlSearch" ? h.input : id === "vwlTbody" ? h.tbody : null,
    showLoadingMask: () => (h.mask.show += 1),
    hideLoadingMask: () => (h.mask.hide += 1),
    toast: (m, t) => h.toasts.push([m, t]),
    toastError: (p, e) => h.toasts.push([`${p}: ${e?.message}`, "error"]),
    loadVendorBuylistFilterOptions: async () => {},
    sortVendorBuylistRows: (r) => r,
    populateVwlOperationalVendorFilter: () => {},
    isVwlSplitRow: (r) => Boolean(r.split),
    matchesVwlOperationalFilter: () => true,
    renderVendorBuylistTable: () =>
      h.renders.push(state.vwl.rows.map((r) => r.name).join(",")),
    updateVendorBuylistPager: () => {},
    syncVwlFilterBadge: () => {},
  });
  vm.runInContext(code, ctx);
  h.run = (expr) => vm.runInContext(expr, ctx);
  return h;
}
const tick = () => new Promise((r) => setImmediate(r));
// the list read: server-paged by default, full read only for "split only"/export
const main = (h) =>
  h.calls.filter(
    (c) =>
      c.name === "proc_vendorwise_buylist_operational_paged" ||
      c.name === "proc_vendorwise_buylist_filtered",
  );
const split = (h) =>
  h.calls.filter((c) => c.name === "proc_vendorwise_buylist_split_items");
const type = (h, q) => {
  h.input.value = q;
  h.state.vwl.search = q;
  return h.run("loadVendorBuylist()");
};

// 1+2 initial load and vendor search params
{
  const h = makeHarness();
  const p = h.run("loadVendorBuylist()");
  await tick();
  assert(
    main(h).length === 1 && split(h).length === 1,
    "initial load issues one main and one split RPC",
  );
  assert(main(h)[0].params.p_q === null, "initial load sends p_q=null");
  assert(
    main(h)[0].name === "proc_vendorwise_buylist_operational_paged" &&
      main(h)[0].params.p_limit === 50 &&
      main(h)[0].params.p_offset === 0 &&
      main(h)[0].params.p_operational_filter === null,
    "default list read is server-paged (limit/offset) with no operational filter",
  );
  assert(
    h.calls.filter((c) => c.name === "proc_vendorwise_buylist_operational_options").length === 1,
    "dropdown options come from the options RPC for the upstream filters",
  );
  main(h)[0].resolve([{ name: "A" }]);
  await tick();
  assert(
    h.renders.at(-1) === "A",
    "list renders before the split lookup resolves",
  );
  split(h)[0].resolve([]);
  await p;
  await tick();
  assert(h.mask.show === h.mask.hide, "loading mask balanced after success");
}

// 3-5 rapid typing: only latest wins, older requests aborted, mask balanced
{
  const h = makeHarness();
  const loads = [];
  for (const q of ["k", "ka", "kar", "karp"]) {
    loads.push(type(h, q));
    await tick();
  }
  assert(main(h).length === 4, "one main RPC per search");
  assert(
    main(h)
      .slice(0, 3)
      .every((c) => c.aborted),
    "superseded main RPCs are aborted",
  );
  assert(
    split(h)
      .slice(0, 3)
      .every((c) => c.aborted),
    "superseded split RPCs are aborted",
  );
  assert(!main(h)[3].aborted, "latest main RPC is not aborted");
  // an old response arriving late must not overwrite the latest
  main(h)[3].resolve([{ name: "KARP" }]);
  await tick();
  main(h)[0].resolve([{ name: "OLD" }]);
  await tick();
  assert(
    h.renders.at(-1) === "KARP",
    "latest search is displayed; stale response ignored",
  );
  assert(
    h.state.vwl.rows.map((r) => r.name).join() === "KARP",
    "state rows hold latest results",
  );
  split(h)[3].resolve([]);
  await Promise.all(loads);
  assert(
    h.mask.show === 4 && h.mask.hide === 4,
    "loading mask balanced after rapid typing (4/4)",
  );
  assert(h.toasts.length === 0, "no error toast for superseded requests");
}

// 6 clear restores
{
  const h = makeHarness();
  const a = type(h, "abc");
  await tick();
  main(h)[0].resolve([{ name: "ABC" }]);
  split(h)[0].resolve([]);
  await a;
  const b = type(h, "");
  await tick();
  assert(main(h)[1].params.p_q === null, "clearing search sends p_q=null");
  main(h)[1].resolve([{ name: "ALL1" }, { name: "ALL2" }]);
  split(h)[1].resolve([]);
  await b;
  assert(h.state.vwl.rows.length === 2, "clear restores the full list");
}

// 7 filter change during pending request
{
  const h = makeHarness();
  const a = type(h, "x");
  await tick();
  h.state.vwlFilters.rateStatus = "MISSING";
  const b = h.run("loadVendorBuylist()");
  await tick();
  assert(
    main(h)[1].params.p_rate_status === "MISSING" &&
      main(h)[1].params.p_q === "x",
    "filter + search combine in latest request",
  );
  main(h)[1].resolve([{ name: "F" }]);
  split(h)[1].resolve([]);
  main(h)[0].resolve([{ name: "STALE" }]);
  await Promise.all([a, b]);
  assert(
    h.state.vwl.rows[0].name === "F",
    "filter change wins over pending older request",
  );
}

// 8 server error: understandable, recoverable
{
  const h = makeHarness();
  const a = h.run("loadVendorBuylist()");
  await tick();
  main(h)[0].fail("statement timeout");
  split(h)[0].resolve([]);
  await a;
  assert(
    h.toasts.some(([m, t]) => t === "error" && m.includes("statement timeout")),
    "server error surfaced with its message",
  );
  assert(h.tbody.innerHTML.includes("Failed to load"), "error row shown");
  assert(h.mask.show === h.mask.hide, "mask resolved after error");
  const b = type(h, "again");
  await tick();
  main(h)[1].resolve([{ name: "OK" }]);
  split(h)[1].resolve([]);
  await b;
  assert(
    h.state.vwl.rows[0]?.name === "OK",
    "UI recovers on next search after an error",
  );
}

// 9 empty result is not an error
{
  const h = makeHarness();
  const a = h.run("loadVendorBuylist()");
  await tick();
  main(h)[0].resolve([]);
  split(h)[0].resolve([]);
  await a;
  assert(
    h.toasts.length === 0 && h.state.vwl.totalCount === 0,
    "empty result produces no error",
  );
}

// 10 split lookup: failure flagged, list unaffected; splitOnly fails loudly
{
  const h = makeHarness();
  const a = h.run("loadVendorBuylist()");
  await tick();
  split(h)[0].fail("split boom");
  main(h)[0].resolve([{ name: "A" }]);
  await a;
  await tick();
  assert(
    h.state.vwl.rows.length === 1,
    "split failure does not block the list",
  );
  assert(
    h.state.vwl.splitLookupFailed === true,
    "split failure is flagged, not silent",
  );
  assert(
    h.toasts.some(([m]) => m.includes("Split-vendor")),
    "split failure is visible to the user",
  );

  const h2 = makeHarness();
  h2.state.vwlFilters.splitOnly = true;
  const b = h2.run("loadVendorBuylist()");
  await tick();
  main(h2)[0].resolve([{ name: "A", split: true }]);
  split(h2)[0].fail("split boom");
  await b;
  assert(
    h2.toasts.some(([m]) => m.includes("cannot apply 'split only'")),
    "split-only with failed lookup errors instead of showing wrong rows",
  );

  const h3 = makeHarness();
  h3.state.vwlFilters.splitOnly = true;
  const c = h3.run("loadVendorBuylist()");
  await tick();
  main(h3)[0].resolve([{ name: "S", split: true }, { name: "N" }]);
  split(h3)[0].resolve([{ material_class_id: 1, stock_item_id: 2, uom_id: 3 }]);
  await c;
  assert(
    h3.state.vwl.rows.map((r) => r.name).join() === "S",
    "split-only filter still applied after lookup",
  );
}

// 11 exports use the same params and a single main RPC
{
  const h = makeHarness();
  h.input.value = "kar";
  h.state.vwl.search = "kar";
  h.state.vwlFilters.rateStatus = "MISSING";
  const e = h.run("fetchAllVendorBuylistRows()");
  await tick();
  assert(
    main(h).length === 1 && split(h).length === 0,
    "export issues only the main RPC",
  );
  assert(
    main(h)[0].params.p_q === "kar" &&
      main(h)[0].params.p_rate_status === "MISSING",
    "export uses current search + filters",
  );
  main(h)[0].resolve([{ name: "E" }]);
  assert((await e).length === 1, "export returns the filtered rows");
}

// static contract guards
assert(/p_q: q \|\| null/.test(src), "RPC contract keeps p_q");
assert(
  !/Promise\.all\(\[\s*fetchVendorBuylistFilteredRows\(\),\s*refreshVwlSplitLookup\(\)/.test(
    src,
  ),
  "list render no longer awaits split lookup unconditionally",
);

if (fails.length) {
  console.error(fails.map((m) => `- ${m}`).join("\n"));
  process.exit(1);
}
console.log(`pec-vwl-search-reliability-smoke: PASS (${checks} checks)`);
