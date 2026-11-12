import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { formatSchemeMasterAuditActor as display } from "../../public/shared/js/costing-suite-scheme-audit-actor.mjs";

const actorId = "a1b2c3d4-1111-4222-8333-aaaabbbbcccc";

test("live view actor_user_id displays an abbreviated ID, never full UUID", () => {
  assert.equal(display({ actor_user_id: actorId }), "Actor ID a1b2c3d4…cccc");
  assert.equal(display({ actor_user_id: actorId }).includes(actorId), false);
});

test("missing/no-row actor returns explicit placeholder", () => {
  assert.equal(display({}), "--");
  assert.equal(display(null), "--");
  assert.equal(display({ actor_user_id: null }), "--");
});

test("legacy actor text is retained before UUID fallback", () => {
  assert.equal(display({ actor: " Existing actor ", actor_user_id: actorId }), "Existing actor");
  assert.equal(display({ event_actor: "Event actor", actor_user_id: actorId }), "Event actor");
  assert.equal(display({ created_by: "Creator", actor_user_id: actorId }), "Creator");
});

test("blank legacy aliases fall through to live actor_user_id", () => {
  assert.equal(display({ actor: "", created_by: "  ", actor_user_id: actorId }), "Actor ID a1b2c3d4…cccc");
});

test("invalid or non-string identifiers do not render", () => {
  assert.equal(display({ actor_user_id: "<script>alert(1)</script>" }), "--");
  assert.equal(display({ actor_user_id: 123 }), "--");
});

test("different UUIDs generate stable distinct abbreviated actor tokens", () => {
  const other = "b5e6f7a8-1111-4222-8333-0123456789ab";
  assert.notEqual(display({ actor_user_id: actorId }), display({ actor_user_id: other }));
  assert.equal(display({ actor_user_id: other }), "Actor ID b5e6f7a8…89ab");
});

test("parent renderer escapes the actor formatter result", () => {
  const parent = readFileSync(fileURLToPath(new URL("../../public/shared/js/costing-suite-pricing-policy.js", import.meta.url)), "utf8");
  assert.match(parent, /import \{ formatSchemeMasterAuditActor \} from "\.\/costing-suite-scheme-audit-actor\.mjs"/);
  assert.ok(parent.includes("text(formatSchemeMasterAuditActor(auditRow))"));
  assert.ok(!parent.includes("text(auditRow.actor || auditRow.event_actor || auditRow.created_by)"));
});

test("the PWA uses network-first routing for the new child module", () => {
  const sw = readFileSync(fileURLToPath(new URL("../../public/sw.js", import.meta.url)), "utf8");
  assert.ok(sw.includes("costing-suite-scheme-audit-actor\\.mjs$"));
  assert.ok(sw.includes('hub-cache-v393'));
});
