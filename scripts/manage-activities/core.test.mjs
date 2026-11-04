import test from "node:test";
import assert from "node:assert/strict";
import {
  createActivitiesService, validateActivity, validateBulk, classifyError, accessFromPermissions, loadAccess,
  escapeLike, pagerState, formatDuration, activeFilterCount, mergeById, BATCH_SIZE, PAGE_SIZES, MODULE_ID,
} from "../../public/shared/js/manage-activities-core.js";
import { createFake, makeData, permList } from "./fake-supabase.mjs";

const mk = (over = {}) => { const cfg = { data: makeData(60), perms: { list: permList(true, true) }, ...over }; return { cfg, svc: createActivitiesService(createFake(cfg)) }; };
const good = (o = {}) => ({ name: "New Act", section_id: "1", sub_section_id: "11", area_id: "111", kind_id: "k-1", duration_days: "3", ...o });

test("listing: complete count, stable sort, page size and ranges", async () => {
  const { svc, cfg } = mk();
  const p1 = await svc.list({ page: 1, pageSize: 25 });
  assert.equal(p1.total, 60); assert.equal(p1.rows.length, 25); assert.equal(p1.rows[0].activity_name, "Activity 001");
  const p3 = await svc.list({ page: 3, pageSize: 25 });
  assert.equal(p3.rows.length, 10); assert.equal(p3.rows.at(-1).activity_name, "Activity 060");
  assert.deepEqual(cfg.log.at(-1).range, [50, 74]);
  assert.equal((await svc.list({ pageSize: 7 })).pageSize, 25, "unknown page size falls back");
  assert.equal(p1.rows[0].activity_kinds.name.length > 0, true);
});

test("pagination state math", () => {
  assert.deepEqual(pagerState({ page: 1, pageSize: 25, total: 0 }), { page: 1, pages: 1, from: 0, to: 0, hasPrev: false, hasNext: false });
  const s = pagerState({ page: 9, pageSize: 25, total: 60 });
  assert.equal(s.page, 3); assert.equal(s.from, 51); assert.equal(s.to, 60); assert.equal(s.hasNext, false);
  assert.ok(PAGE_SIZES.includes(25));
});

test("filters: section/sub/area/kind and name search combine; wildcards are literal", async () => {
  const { svc, cfg } = mk();
  assert.equal((await svc.list({ sectionId: "2" })).total, 30);
  assert.equal((await svc.list({ sectionId: "2", subId: "21", areaId: "211" })).total, 30);
  assert.equal((await svc.list({ kindId: "k-2" })).total, 20);
  assert.equal((await svc.list({ sectionId: "1", kindId: "k-2" })).total, 10);
  assert.equal((await svc.list({ search: "activity 05" })).total, 10);
  assert.equal((await svc.list({ search: "%" })).total, 0, "% is literal, not a wildcard");
  assert.equal(escapeLike("a%b_c\\"), "a\\%b\\_c\\\\");
  assert.equal(cfg.log.at(-1).like[1], "%\\%%");
});

test("lookups cascade and cache", async () => {
  const { svc, cfg } = mk();
  assert.equal((await svc.sections()).length, 2); assert.equal((await svc.kinds()).length, 2);
  assert.deepEqual((await svc.subsections(1)).map((s) => s.id), [11]);
  assert.deepEqual(await svc.areas(1, null), []);
  assert.deepEqual((await svc.areas(2, 21)).map((a) => a.id), [211]);
  const n = cfg.log.length; await svc.subsections(1); await svc.sections(); assert.equal(cfg.log.length, n, "cached");
});

test("lookup failure rejects and is not cached", async () => {
  const { svc, cfg } = mk({ fail: { sections: { select: { message: "boom" } } } });
  await assert.rejects(svc.sections());
  delete cfg.fail; assert.equal((await svc.sections()).length, 2);
});

test("validation: required fields incl. kind_id, integer duration, name length", () => {
  const v = validateActivity({});
  assert.deepEqual(Object.keys(v.errors).sort(), ["area_id", "duration_days", "kind_id", "name", "section_id", "sub_section_id"]);
  assert.equal(validateActivity(good({ duration_days: "1.5" })).ok, false);
  assert.equal(validateActivity(good({ duration_days: "-1" })).ok, false);
  assert.equal(validateActivity(good({ duration_days: "99999" })).ok, false);
  assert.equal(validateActivity(good({ name: "x".repeat(201) })).ok, false);
  const ok = validateActivity(good({ name: "  Spaced   Name " }));
  assert.equal(ok.ok, true); assert.deepEqual(ok.value, { activity_name: "Spaced Name", section_id: 1, sub_section_id: 11, area_id: 111, kind_id: "k-1", duration_days: 3 });
  assert.equal(validateActivity(good({ duration_days: "0" })).ok, true, "zero days allowed");
});

test("bulk validation flags in-batch duplicates (case/space-insensitive)", () => {
  const r = validateBulk([good({ name: "Same" }), good({ name: " same " }), good({ name: "Other" })]);
  assert.deepEqual(r.map((x) => x.ok), [false, false, true]);
  assert.match(r[0].errors.name, /Duplicate/);
});

test("create includes required kind_id in payload and persists", async () => {
  const { svc, cfg } = mk();
  const r = await svc.create(good());
  assert.equal(r.ok, true);
  assert.equal(cfg.log.at(-1).payload[0].kind_id, "k-1");
  assert.equal(cfg.data.activities.length, 61);
});

test("create: invalid sends nothing; duplicate / permission / network classified", async () => {
  const { svc, cfg } = mk();
  const n = cfg.log.length;
  const bad = await svc.create(good({ kind_id: "" }));
  assert.equal(bad.ok, false); assert.ok(bad.errors.kind_id); assert.equal(cfg.log.length, n);
  const dup = await svc.create(good({ name: "activity 001" }));
  assert.equal(dup.kind, "duplicate");
  cfg.denyWrites = true;
  assert.equal((await svc.create(good())).kind, "permission");
  delete cfg.denyWrites; cfg.fail = { activities: { insert: { message: "TypeError: Failed to fetch" } } };
  assert.equal((await svc.create(good())).kind, "network");
});

test("update: success, validation, RLS silent zero-row, error classes", async () => {
  const { svc, cfg } = mk();
  assert.equal((await svc.update(1, good({ name: "Renamed" }))).ok, true);
  assert.equal(cfg.data.activities[0].activity_name, "Renamed");
  assert.equal((await svc.update(1, good({ name: "" }))).kind, "invalid");
  cfg.silent = { update: true };
  const s = await svc.update(1, good({ name: "X2" }));
  assert.equal(s.ok, false); assert.equal(s.kind, "not-applied");
  cfg.silent = {}; cfg.fail = { activities: { update: { code: "42501", message: "denied" } } };
  assert.equal((await svc.update(1, good())).kind, "permission");
});

test("delete: success, in-use FK guarded, silent zero-row, failure", async () => {
  const { svc, cfg } = mk({ inUse: new Set([2]) });
  assert.equal((await svc.remove(1)).ok, true); assert.equal(cfg.data.activities.length, 59);
  const used = await svc.remove(2);
  assert.equal(used.ok, false); assert.equal(used.kind, "in-use"); assert.equal(cfg.data.activities.length, 59);
  cfg.silent = { delete: true };
  assert.equal((await svc.remove(3)).kind, "not-applied");
  cfg.silent = {}; cfg.fail = { activities: { delete: { message: "Failed to fetch" } } };
  assert.equal((await svc.remove(3)).kind, "network");
});

test("bulk: invalid batch writes nothing; partial failure preserves per-row results", async () => {
  const { svc, cfg } = mk();
  const n = cfg.data.activities.length;
  const inv = await svc.bulkCreate([good({ name: "A1" }), good({ name: "" })]);
  assert.equal(inv.wrote, false); assert.equal(cfg.data.activities.length, n);
  assert.deepEqual(inv.results.map((r) => r.status), ["skipped", "invalid"]);
  const res = await svc.bulkCreate([good({ name: "B1" }), good({ name: "Activity 002" }), good({ name: "B3" })]);
  assert.deepEqual(res.results.map((r) => r.status), ["created", "failed", "created"]);
  assert.equal(res.results[1].kind, "duplicate"); assert.equal(cfg.data.activities.length, n + 2);
});

test("bulk: permission failure stops the batch (no workaround, no further attempts)", async () => {
  const { svc, cfg } = mk({ fail: { activities: { insert: { code: "42501", message: "row-level security" } } } });
  const res = await svc.bulkCreate([good({ name: "C1" }), good({ name: "C2" }), good({ name: "C3" })]);
  assert.deepEqual(res.results.map((r) => r.status), ["failed", "skipped", "skipped"]);
  assert.equal(cfg.log.filter((l) => l.op === "insert").length, 1);
});

test("permissions: fail closed and view/edit split", async () => {
  assert.deepEqual(accessFromPermissions(null), { view: false, edit: false, reason: "verify-failed" });
  assert.equal(accessFromPermissions([]).reason, "denied");
  assert.deepEqual(accessFromPermissions(permList(true, false)), { view: true, edit: false, reason: "ok" });
  assert.equal(accessFromPermissions([{ target: "module:manage-activities", can_view: false, can_edit: true }]).edit, false, "edit without view is not edit");
  assert.equal(accessFromPermissions([{ target: "module:other", can_view: true, can_edit: true }]).view, false);
  const ok = createFake({ perms: { list: permList(true, true) }, data: makeData(1) });
  assert.equal((await loadAccess(ok, "u-1")).edit, true);
  assert.equal((await loadAccess(ok, null)).reason, "verify-failed");
  const bad = createFake({ perms: {}, rpcError: true, data: makeData(1) });
  assert.equal((await loadAccess(bad, "u-1")).reason, "verify-failed");
  assert.equal(MODULE_ID, "manage-activities");
});

test("classifyError maps codes", () => {
  assert.equal(classifyError({ code: "23505" }).kind, "duplicate");
  assert.equal(classifyError({ code: "23503" }, "delete").kind, "in-use");
  assert.equal(classifyError({ code: "23503" }, "create").kind, "invalid");
  assert.equal(classifyError({ message: "weird" }).kind, "unknown");
  assert.equal(classifyError(new TypeError("x")).kind, "network");
});

test("offset batches are contiguous, ordered and bounded by total", async () => {
  const { svc, cfg } = mk();
  assert.equal(BATCH_SIZE, 25);
  const a = await svc.list({ offset: 0, pageSize: 25 }), b = await svc.list({ offset: 25, pageSize: 25 }), c = await svc.list({ offset: 50, pageSize: 25 }), d = await svc.list({ offset: 75, pageSize: 25 });
  assert.deepEqual([a.rows.length, b.rows.length, c.rows.length, d.rows.length, d.total], [25, 25, 10, 0, 60]);
  assert.equal(b.rows[0].activity_name, "Activity 026");
  assert.deepEqual(cfg.log.at(-1).range, [75, 99]);
});

test("helpers: duration unit, active filter count, merge dedupes", () => {
  assert.equal(formatDuration(1), "1 day"); assert.equal(formatDuration(0), "0 days"); assert.equal(formatDuration(12), "12 days");
  assert.equal(activeFilterCount({ sectionId: "1", subId: "", kindId: "k", search: "x" }), 2);
  assert.deepEqual(mergeById([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]).map((r) => r.id), [1, 2, 3]);
});
