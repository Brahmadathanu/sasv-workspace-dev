// Static fail-closed contract for the local PowerShell inventory. This does not execute
// PowerShell or establish an installed workstation result (requires Windows operator).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync(new URL('./inventory-installed-sasv.ps1', import.meta.url), 'utf8');
test('read-only inventory does not launch Electron, modify registry, or use network/updater', () => {
  for (const forbidden of [
    /\bSet-ItemProperty\b/i,
    /\bNew-ItemProperty\b/i,
    /\bRemove-ItemProperty\b/i,
    /\bNew-Item\b/i,
    /\bRemove-Item\b/i,
    /\bStart-Process\b/i,
    /\bInvoke-(WebRequest|RestMethod|Expression)\b/i,
    /\b(Invoke-Command|Enter-PSSession|New-PSSession)\b/i,
    /\bautoUpdater\b/i,
    /\b(reg\s+(add|delete|import))\b/i,
    /\b(Grant|Revoke)\b/i,
    /ExecutionPolicy\s+Bypass/i
  ]) {
    assert.doesNotMatch(script, forbidden);
  }
  assert.match(script, /Get-ItemProperty/);
  assert.match(script, /Get-FileHash/);
});
test('output omits machine identifiers and file system installation paths', () => {
  assert.doesNotMatch(script, /(?:[a-z_]+)?hostname\s*=/i);
  assert.doesNotMatch(script, /\bComputerName\s*=/i);
  assert.doesNotMatch(script, /\bUserName\s*=/i);
  assert.doesNotMatch(script, /\binstall_path\s*=/i);
  assert.match(script, /installed_executable_product_version/);
  assert.match(script, /app_asar_sha256/);
  assert.match(script, /rpc_only_classification_proven = \$false/);
  assert.match(script, /legacy_direct_dml_absent_proven = \$false/);
});
test('inventory does not infer fleet coverage from a single machine', () => {
  assert.match(script, /current Windows machine only/);
  assert.match(script, /NOT proof no old installations exist/);
  assert.match(script, /migration_disposition = 'UNKNOWN/);
});
