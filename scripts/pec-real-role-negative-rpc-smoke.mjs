#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script = readFileSync(new URL('./pec-phase-a-operator-browser-check.mjs', import.meta.url), 'utf8');

test('negative probes restricted to genuine browser sessions and two denied roles', () => {
  assert.match(script, /role === 'no-access' \|\| role === 'view-only'/);
  assert.match(script, /supabase\.auth\.getUser\(\)/);
  assert.match(script, /if \(identity\.error \|\| !identity\.data\?\.user\)/);
  assert.match(script, /if \(!negative\.authenticated \|\| !negative\.ran\)/);
});
test('denied read is bounded to one row and discards response data', () => {
  assert.match(script, /supabase\.rpc\('proc_pec_pr_headers_paged'/);
  assert.match(script, /p_limit: 1, p_offset: 0/);
  assert.match(script, /denied: \(Number\(res\.status\) \|\| 0\) >= 400 && denied\(res\.error\)/);
  assert.doesNotMatch(script, /return\s*\{[^}]*data:\s*res\.data/);
});
test('writer uses nonexistent indent identity and cannot target genuine business data', () => {
  assert.match(script, /supabase\.rpc\('proc_indent_add_line'/);
  assert.match(script, /p_indent_id: 0, p_material_class_id: 0, p_stock_item_id: 0/);
  assert.match(script, /p_uom_id: 0, p_requested_qty: 0, p_reason: null/);
  assert.doesNotMatch(script, /p_indent_id:\s*[1-9][0-9]*/);
});
test('permission denials are code and message constrained, never any error', () => {
  assert.match(script, /code === '42501'/);
  assert.match(script, /code === 'P0001' \|\| code === 'PGRST301'/);
  assert.match(script, /permission\|access denied\|not authorized/);
  assert.doesNotMatch(script, /denied:\s*Boolean\(res\.error\)/);
});
test('result records have no token or business data fields', () => {
  assert.match(script, /status: Number\(res\.status\) \|\| 0/);
  assert.match(script, /code: String\(res\.error\?\.code \|\| ''\)\.slice\(0, 24\)/);
  assert.doesNotMatch(script, /console\.log\(\s*res\b/);
  assert.doesNotMatch(script, /console\.log\(\s*identity\b/);
});

test('negative probes fail closed on HTTP success and on blocked identity evidence', () => {
  assert.match(script, /denied: \(Number\(res\.status\) \|\| 0\) >= 400 && denied\(res\.error\)/);
  assert.match(script, /else if \(results\.some\(x=>x\.status==='BLOCKED'\)\) process\.exitCode=2/);
});
