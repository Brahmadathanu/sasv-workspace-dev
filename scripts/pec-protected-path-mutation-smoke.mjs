#!/usr/bin/env node
// Prove the *real static guard*, not merely its helper, rejects new SQL and
// service-worker mutations on an integration-descendant client branch.
// Run in ephemeral CI checkout only; restores touched files in finally.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const sw = "public/sw.js";
const fakeSql = "supabase/migrations/20991231000000_pec_guard_negative_fixture.sql";
const swOriginal = fs.readFileSync(sw);
assert.equal(fs.existsSync(fakeSql), false, "fixture path must not exist");
function guardFailsWith(path) {
  const r = spawnSync(process.execPath, ["scripts/pec-erp-c1-static-smoke.mjs"], {
    encoding:"utf8", env:process.env
  });
  assert.notEqual(r.status,0,"guard must reject new protected file: "+path);
  assert.match(r.stdout+"\n"+r.stderr,/unauthorized new SQL\/SW paths/);
  assert.ok((r.stdout+"\n"+r.stderr).includes(path),"denial names rejected path");
  console.log("PASS actual protected-file mutation rejected:",path);
}
try {
  fs.writeFileSync(fakeSql, "-- test-only untracked SQL mutation; never applied\n");
  guardFailsWith(fakeSql);
  fs.unlinkSync(fakeSql);
  fs.appendFileSync(sw,"\n// CI-only PEC protected-file mutation; never committed\n");
  guardFailsWith(sw);
} finally {
  if(fs.existsSync(fakeSql))fs.unlinkSync(fakeSql);
  fs.writeFileSync(sw,swOriginal);
}
console.log("pec-protected-path-mutation: 2/2 PASS; protected files restored");
