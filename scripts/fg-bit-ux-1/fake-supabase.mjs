// In-memory Supabase fake for FG-BIT-UX-1 tests. No network, no production access.
// Serves the exact RPC/table names used by fg-bulk-internal-transfer.js and logs every call.
export const SECTIONS = [{ id: 1, section_name: "Bulk Store" }, { id: 2, section_name: "Packing" }];
export const SUBS = [{ id: 11, subsection_name: "Cold Bay", section_id: 1 }];
export const AREAS = [
  { id: 101, area_name: "Aisle A", section_id: 1, subsection_id: 11 },
  { id: 102, area_name: "Aisle B", section_id: 1, subsection_id: null },
  { id: 201, area_name: "Line 1", section_id: 2, subsection_id: null },
];
export const PLANTS = [
  { id: 1001, plant_name: "Tank T1", section_id: 1, area_id: 101, subsection_id: 11 },
  { id: 1002, plant_name: "Tank T2", section_id: 1, area_id: 102, subsection_id: null },
  { id: 2001, plant_name: "Filler F1", section_id: 2, area_id: 201, subsection_id: null },
];

export function makeRows(n = 120) {
  return Array.from({ length: n }, (_, i) => ({
    source_key: `k${i}`, product_id: 500 + i, item: `Item ${String(i).padStart(3, "0")} ${i % 7 === 0 ? "Very long product description for wrapping checks" : ""}`.trim(),
    batch_number: `B${String(i).padStart(4, "0")}`, uom: "L", qty_base: 100 + i,
    section_id: 1, section_name: "Bulk Store", subsection_id: 11, subsection_name: "Cold Bay",
    area_id: 101, area_name: "Aisle A", plant_id: i % 5 === 0 ? null : 1001, plant_name: i % 5 === 0 ? null : "Tank T1",
  }));
}

export function createFake(cfg = {}) {
  const rows = cfg.rows ?? makeRows(cfg.n ?? 120);
  const log = [];
  cfg.log = log;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const table = (name) => {
    const data = { sections: SECTIONS, subsections: SUBS, areas: AREAS, plant_machinery: PLANTS }[name] ?? [];
    let out = data.slice();
    const q = {
      select() { return q; },
      eq(col, v) { out = out.filter((r) => String(r[col]) === String(v)); return q; },
      order() { return q; },
      then(res, rej) { log.push({ kind: "from", table: name }); return Promise.resolve({ data: out, error: null }).then(res, rej); },
    };
    return q;
  };
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: "test" } } } }) },
    schema: () => ({}),
    from: table,
    async rpc(name, args) {
      log.push({ kind: "rpc", name, args: JSON.parse(JSON.stringify(args)) });
      if (name === "rpc_fg_bulk_internal_transfer_source_page") {
        if (cfg.sourceDelayMs) await wait(cfg.sourceDelayMs);
        if (cfg.sourceError) return { data: null, error: { message: "boom" } };
        const f = (args.p_item_filter || "").toLowerCase(), b = (args.p_batch_filter || "").toLowerCase();
        const m = rows.filter((r) => r.qty_base > 0 && r.item.toLowerCase().includes(f) && r.batch_number.toLowerCase().includes(b));
        return { data: m.slice(args.p_offset, args.p_offset + args.p_limit).map((r) => ({ ...r, total_count: m.length })), error: null };
      }
      if (name === "rpc_fg_bulk_internal_transfer_source_by_identity") {
        const r = rows.find((x) => x.product_id === args.p_product_id && x.batch_number === args.p_batch_number && (x.plant_id ?? null) === (args.p_plant_id ?? null) && x.area_id === args.p_area_id);
        return { data: r && r.qty_base > 0 ? [{ ...r }] : [], error: null };
      }
      if (name === "rpc_create_fg_bulk_internal_transfer") {
        if (cfg.postDelayMs) await wait(cfg.postDelayMs);
        if (cfg.postThrows) throw new Error("network down");
        if (cfg.postError) return { data: null, error: { message: cfg.postError } };
        const r = rows.find((x) => x.product_id === args.p_product_id && x.batch_number === args.p_batch_number && (x.plant_id ?? null) === (args.p_from_plant_id ?? null));
        r.qty_base = Math.round((r.qty_base - args.p_qty) * 1e6) / 1e6;
        return { data: null, error: null };
      }
      return { data: null, error: { message: "unexpected rpc " + name } };
    },
  };
}
