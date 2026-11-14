#!/usr/bin/env node
// Static + behavioural contract for the genuine-role operator harness (issue #388 Batch C).
// Fails (never false-PASSes) if the probe drifts from the real server function
// signatures, if the denial classifier would accept a non-permission error, or if
// BLOCKED/FAIL could exit 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compare, PEC_FILES, localManifest, ALLOWED_HOSTS } from './pec-release-provenance-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const harness = readFileSync(path.join(here, 'pec-phase-a-operator-browser-check.mjs'), 'utf8');
const mig = path.join(here, '..', 'supabase', 'migrations');
const sql = (f) => readFileSync(path.join(mig, f), 'utf8').replace(/\r/g, '');

const argNames = (decl) => [...decl.matchAll(/\bp_[a-z_]+\b/g)].map((m) => m[0]);
function sqlArgs(file, fn) {
  const m = new RegExp('function\\s+public\\.' + fn + '\\s*\\(([^)]*)\\)', 'i').exec(sql(file));
  assert.ok(m, fn + ' not found in ' + file);
  return argNames(m[1]);
}
function probeArgs(rpcName) {
  const m = new RegExp("supabase\\.rpc\\('" + rpcName + "',\\s*\\{([^}]*)\\}").exec(harness);
  assert.ok(m, 'probe for ' + rpcName + ' not found');
  return [...m[1].matchAll(/\b(p_[a-z_]+)\s*:/g)].map((x) => x[1]);
}

test('no-access read probe args match proc_pec_pr_headers_paged signature', () => {
  assert.deepEqual(probeArgs('proc_pec_pr_headers_paged'),
    sqlArgs('20261112170000_pec_g1_five_paged_read_contracts.sql', 'proc_pec_pr_headers_paged'));
});
test('view-only writer probe args match proc_indent_add_line (live c6 signature)', () => {
  const server = sqlArgs('20260807164315_pec_c6_writer_invalidation_conversion.sql', 'proc_indent_add_line');
  assert.deepEqual(probeArgs('proc_indent_add_line'), server);
});
test('both probe RPCs are authenticated-only (REVOKE PUBLIC/anon, GRANT authenticated)', () => {
  const g1 = sql('20261112170000_pec_g1_five_paged_read_contracts.sql');
  assert.match(g1, /REVOKE ALL ON FUNCTION public\.proc_pec_pr_headers_paged\(p_limit integer, p_offset integer\) FROM PUBLIC,anon/);
  assert.match(g1, /GRANT EXECUTE ON FUNCTION public\.proc_pec_pr_headers_paged\(p_limit integer, p_offset integer\) TO authenticated/);
});

// Evaluate the harness's own denial classifier against realistic server errors.
const denied = new Function('return ' + /const denied = (\(error\) => \{[\s\S]*?\n      \});/.exec(harness)[1])();
test('denial classifier accepts only authorization failures', () => {
  assert.equal(denied({ code: '42501', message: 'x' }), true);
  assert.equal(denied({ code: 'P0001', message: 'Permission denied for module:procurement-execution-console (edit=true)' }), true);
  assert.equal(denied({ code: 'PGRST301', message: 'JWT expired; not authorized' }), true);
  // Anything that is not a permission denial must NOT count as PASS:
  assert.equal(denied({ code: 'P0001', message: 'Indent not found: 0' }), false);       // Editor reached the writer body
  assert.equal(denied({ code: 'PGRST202', message: 'Could not find the function public.proc_indent_add_line(...)' }), false); // signature drift
  assert.equal(denied({ code: '23514', message: 'New indent lines are allowed only for draft' }), false);
  assert.equal(denied(null), false);
});
test('denial additionally requires HTTP>=400 in both probes; BLOCKED/FAIL exit non-zero', () => {
  assert.equal(harness.split('(Number(res.status) || 0) >= 400 && denied(res.error)').length - 1, 2);
  assert.match(harness, /some\(x=>x\.status==='FAIL'\)\) process\.exitCode=1/);
  assert.match(harness, /some\(x=>x\.status==='BLOCKED'\)\) process\.exitCode=2/);
  assert.match(harness, /No verified active Supabase user session/);
});
test('harness never emits credentials or rows', () => {
  assert.doesNotMatch(harness, /access_token|refresh_token|localStorage|sessionStorage|cookies\(\)|getSession/);
  assert.doesNotMatch(harness, /console\.log\([^)]*\.data\b/);
});
test('provenance checker: allow-list, compare and non-PASS on drift', () => {
  assert.ok(ALLOWED_HOSTS.test('deploy-preview-347--sasv-utilities-hub.netlify.app'));
  assert.ok(!ALLOWED_HOSTS.test('evil.example.com'));
  const local = localManifest();
  assert.deepEqual(Object.keys(local), PEC_FILES);
  const same = JSON.parse(JSON.stringify(local));
  assert.ok(compare(local, same).every((r) => r.status === 'PASS'));
  const drift = JSON.parse(JSON.stringify(local));
  drift['/shared/js/procurement-execution-console.js'].sha256 = '0'.repeat(64);
  assert.ok(compare(local, drift).some((r) => r.status === 'FAIL'));
  const swDrift = JSON.parse(JSON.stringify(local)); swDrift['/sw.js'].cacheName = 'hub-cache-old';
  assert.ok(compare(local, swDrift).some((r) => r.status === 'FAIL'));
  assert.ok(compare(local, { ...same, '/sw.js': { error: 'HTTP 404' } }).some((r) => r.status === 'FAIL'));
});
