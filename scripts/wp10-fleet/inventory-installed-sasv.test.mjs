// Fail-closed contract for the local PowerShell inventory.
// 1) Static source safeguards (always run).
// 2) Windows PowerShell 5.1 function-level checks on SYNTHETIC values: the guard functions are extracted from the script's AST and
//    run in isolation, so no installation discovery, registry read or hashing happens (safe on any workstation).
// 3) Script invocations that must abort BEFORE discovery (bad -OutFile), also safe anywhere.
// 4) Full end-to-end runs against a FAKE install in a temp folder, only when CI=true (an ephemeral runner) or WP10_FLEET_E2E=1,
//    because discovery also reads the real uninstall registry. Never run on a staff machine by this suite.
// None of this is an installed-workstation result or proof of RPC-only status.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('./inventory-installed-sasv.ps1', import.meta.url));
const script = fs.readFileSync(scriptPath, 'utf8');
const isWindows = process.platform === 'win32';
const skipWin = isWindows ? false : 'Windows PowerShell required';
const e2e = isWindows && (process.env.CI === 'true' || process.env.WP10_FLEET_E2E === '1') ? false : 'end-to-end runs only on CI (ephemeral runner) or with WP10_FLEET_E2E=1 on a disposable machine';

// ---------- 1. static ----------
test('read-only inventory does not launch Electron, modify registry, or use network/updater', () => {
  for (const forbidden of [
    /\bSet-ItemProperty\b/i, /\bNew-ItemProperty\b/i, /\bRemove-ItemProperty\b/i, /\bNew-Item\b/i, /\bRemove-Item\b/i,
    /\bStart-Process\b/i, /\bInvoke-(WebRequest|RestMethod|Expression)\b/i, /\b(Invoke-Command|Enter-PSSession|New-PSSession)\b/i,
    /\bautoUpdater\b/i, /\b(reg\s+(add|delete|import))\b/i, /\b(Grant|Revoke)\b/i, /ExecutionPolicy\s+Bypass/i
  ]) assert.doesNotMatch(script, forbidden);
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
test('fix 1: candidate artifacts are checked for local fixed-drive, no UNC/device path and no link before hashing or reading', () => {
  assert.match(script, /function Test-LocalFixedPath/);
  assert.match(script, /StartsWith\('\\\\'\)/);
  assert.match(script, /-eq 'Fixed'/);
  assert.match(script, /function Test-NoReparsePoint/);
  assert.match(script, /FileAttributes\]::ReparsePoint/);
  // the hash and version readers call the artifact guard before touching the file
  const hashFn = script.slice(script.indexOf('function Get-Sha256OrNull'), script.indexOf('function Get-FileVersionOrNull'));
  assert.ok(hashFn.indexOf('Test-ReadableLocalArtifact') > -1 && hashFn.indexOf('Test-ReadableLocalArtifact') < hashFn.indexOf('Get-FileHash'));
  const verFn = script.slice(script.indexOf('function Get-FileVersionOrNull'), script.indexOf('$locations ='));
  assert.ok(verFn.indexOf('Test-ReadableLocalArtifact') > -1 && verFn.indexOf('Test-ReadableLocalArtifact') < verFn.indexOf('VersionInfo'));
  // install locations are validated before they are probed
  const loop = script.slice(script.indexOf('foreach ($loc in $locations)'));
  assert.ok(loop.indexOf('Test-LocalFixedPath $resolved') > -1 && loop.indexOf('Test-LocalFixedPath $resolved') < loop.indexOf('$exe = Join-Path'));
});
test('fix 2: optional uninstall-registry properties are read StrictMode-safely', () => {
  assert.match(script, /function Get-OptionalProperty/);
  assert.match(script, /PSObject\.Properties\[\$Name\]/);
  for (const name of ['DisplayName', 'InstallLocation', 'DisplayVersion']) {
    assert.match(script, new RegExp(`Get-OptionalProperty \\$p '${name}'`));
    assert.doesNotMatch(script, new RegExp(`\\$p\\.${name}\\b`), `direct $p.${name} access would throw under StrictMode when the property is missing`);
  }
});
test('fix 3: -OutFile is validated before discovery, never overwrites and is created with CreateNew', () => {
  assert.match(script, /function Resolve-SafeOutFile/);
  for (const msg of ['already exists', 'parent directory does not exist', 'local fixed drive', 'junction or symbolic link']) assert.match(script, new RegExp(msg));
  assert.match(script, /FileMode\]::CreateNew/);
  assert.doesNotMatch(script, /WriteAllText/);
  assert.ok(script.indexOf('Resolve-SafeOutFile $OutFile') > -1 && script.indexOf('Resolve-SafeOutFile $OutFile') < script.indexOf('$locations ='), 'validation must precede discovery');
});

// ---------- helpers for PowerShell runs ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sasv-inv-test-'));
test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ } });
const ps = (args, env = {}) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

// ---------- 2. function-level synthetic checks (Windows PowerShell 5.1) ----------
const harness = String.raw`
param([string]$Script, [string]$Work)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($Script, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) { throw 'parse errors' }
$functions = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)
foreach ($f in $functions) { . ([scriptblock]::Create($f.Extent.Text)) }
$script:report = [ordered]@{ warnings = @() }
$r = [ordered]@{}
$systemRoot = [IO.Path]::GetPathRoot($env:SystemRoot)
# Test-LocalFixedPath
$r.fixedOk = Test-LocalFixedPath ($systemRoot + 'Some\SASV Workspace')
$r.unc = Test-LocalFixedPath '\\server\share\SASV Workspace'
$r.uncForward = Test-LocalFixedPath '//server/share/SASV Workspace'
$r.devicePath = Test-LocalFixedPath '\\?\C:\SASV Workspace'
$r.deviceUnc = Test-LocalFixedPath '\\?\UNC\server\share\x'
$r.empty = Test-LocalFixedPath ''
$r.nul = Test-LocalFixedPath $null
$r.invalidChars = Test-LocalFixedPath ($systemRoot + 'a|b?c')
function Get-DriveTypeName([string]$Root) { 'Network' }
$r.networkDrive = Test-LocalFixedPath 'Z:\SASV Workspace'
function Get-DriveTypeName([string]$Root) { 'Removable' }
$r.removableDrive = Test-LocalFixedPath 'E:\SASV Workspace'
function Get-DriveTypeName([string]$Root) { 'CDRom' }
$r.opticalDrive = Test-LocalFixedPath 'D:\SASV Workspace'
function Get-DriveTypeName([string]$Root) { 'Unknown' }
$r.unknownDrive = Test-LocalFixedPath 'D:\SASV Workspace'
function Get-DriveTypeName([string]$Root) { 'Fixed' }
$r.fixedStub = Test-LocalFixedPath 'D:\SASV Workspace'
# Get-OptionalProperty under StrictMode
$obj = [pscustomobject]@{ Other = 1; Present = 'x' }
$r.optMissing = ($null -eq (Get-OptionalProperty $obj 'DisplayName'))
$r.optPresent = (Get-OptionalProperty $obj 'Present')
$r.optNullObject = ($null -eq (Get-OptionalProperty $null 'Anything'))
$threw = $false
try { $null = $obj.DisplayName } catch { $threw = $true }
$r.directAccessWouldThrow = $threw
# Test-NoReparsePoint with a junction
$real = Join-Path $Work 'real'; $null = [IO.Directory]::CreateDirectory($real)
$link = Join-Path $Work 'link'
$null = New-Item -ItemType Junction -Path $link -Target $real
$r.realDir = Test-NoReparsePoint $real
$r.junction = Test-NoReparsePoint $link
$r.pathThroughJunction = Test-NoReparsePoint (Join-Path $link 'child.txt')
# Resolve-SafeOutFile (restore the real drive-type function first)
$tokens2 = $null
foreach ($f in $functions) { if ($f.Name -eq 'Get-DriveTypeName') { . ([scriptblock]::Create($f.Extent.Text)) } }
function Try-Resolve([string]$p) { try { 'OK:' + (Resolve-SafeOutFile $p) } catch { 'ERR:' + $_.Exception.Message } }
$existing = Join-Path $Work 'existing.json'; [IO.File]::WriteAllText($existing, 'keep')
$r.outExisting = Try-Resolve $existing
$r.outDirectory = Try-Resolve $real
$r.outMissingParent = Try-Resolve (Join-Path $Work 'nope\new.json')
$r.outUnc = Try-Resolve '\\server\share\new.json'
$r.outEmpty = Try-Resolve ''
$r.outJunctionParent = Try-Resolve (Join-Path $link 'new.json')
$r.outValid = Try-Resolve (Join-Path $Work 'new.json')
$r.outRelative = (Try-Resolve 'relative-new.json').StartsWith('OK:')
$r.existingUntouched = ([IO.File]::ReadAllText($existing) -eq 'keep')
$r | ConvertTo-Json -Compress
`;
test('guard functions behave correctly on synthetic values (Windows PowerShell 5.1, no discovery)', { skip: skipWin }, () => {
  const harnessPath = path.join(tmp, 'harness.ps1'); fs.writeFileSync(harnessPath, harness);
  const work = path.join(tmp, 'work'); fs.mkdirSync(work);
  const out = ps(['-File', harnessPath, '-Script', scriptPath, '-Work', work]);
  assert.equal(out.status, 0, out.stderr + out.stdout);
  const r = JSON.parse(out.stdout.trim().split(/\r?\n/).pop());
  // fix 1
  assert.equal(r.fixedOk, true, 'a local fixed-drive path is accepted');
  for (const k of ['unc', 'uncForward', 'devicePath', 'deviceUnc', 'empty', 'nul', 'invalidChars', 'networkDrive', 'removableDrive', 'opticalDrive', 'unknownDrive']) assert.equal(r[k], false, `${k} must be rejected`);
  assert.equal(r.fixedStub, true);
  assert.equal(r.realDir, true); assert.equal(r.junction, false, 'a junction is rejected'); assert.equal(r.pathThroughJunction, false, 'a path through a junction is rejected');
  // fix 2
  assert.equal(r.optMissing, true); assert.equal(r.optPresent, 'x'); assert.equal(r.optNullObject, true);
  assert.equal(r.directAccessWouldThrow, true, 'proves the original direct property access fails under StrictMode');
  // fix 3
  assert.match(r.outExisting, /^ERR:.*already exists/); assert.match(r.outDirectory, /^ERR:.*already exists/);
  assert.match(r.outMissingParent, /^ERR:.*parent directory does not exist/);
  assert.match(r.outUnc, /^ERR:.*local fixed drive/); assert.match(r.outEmpty, /^ERR:.*empty/);
  assert.match(r.outJunctionParent, /^ERR:.*junction or symbolic link/);
  assert.match(r.outValid, /^OK:/); assert.equal(r.outRelative, true); assert.equal(r.existingUntouched, true);
});

// ---------- 3. bad -OutFile aborts before discovery (safe anywhere) ----------
function runScript(args, env) { return ps(['-File', scriptPath, ...args], env); }
test('-OutFile pointing at an existing file aborts before discovery and leaves the file untouched', { skip: skipWin }, () => {
  const f = path.join(tmp, 'receipt.json'); fs.writeFileSync(f, 'ORIGINAL');
  const out = runScript(['-OutFile', f]);
  assert.notEqual(out.status, 0); assert.match(out.stderr, /already exists/);
  assert.doesNotMatch(out.stdout, /sasv-wp10-fleet-inventory/, 'no inventory was produced');
  assert.equal(fs.readFileSync(f, 'utf8'), 'ORIGINAL');
});
test('-OutFile with a missing parent folder or a UNC path aborts before discovery', { skip: skipWin }, () => {
  for (const [target, re] of [[path.join(tmp, 'missing', 'x.json'), /parent directory does not exist/], ['\\\\localhost\\c$\\x.json', /local fixed drive/]]) {
    const out = runScript(['-OutFile', target]);
    assert.notEqual(out.status, 0, target); assert.match(out.stderr, re);
    assert.doesNotMatch(out.stdout, /sasv-wp10-fleet-inventory/);
  }
});

// ---------- 4. end-to-end against a FAKE install (ephemeral CI runner only) ----------
function fakeInstall(base) {
  const dir = path.join(base, 'Programs', 'SASV Workspace');
  fs.mkdirSync(path.join(dir, 'resources'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'SASV Workspace.exe'), 'fake-exe'); fs.writeFileSync(path.join(dir, 'resources', 'app.asar'), 'fake-asar');
  return { exe: 'fake-exe', asar: 'fake-asar' };
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const isolatedEnv = base => ({ LOCALAPPDATA: base, ProgramFiles: path.join(base, 'pf'), 'ProgramFiles(x86)': path.join(base, 'pf86') });
test('e2e: a fake install in a local folder is inventoried with hashes only, no paths or identifiers, RPC-only stays unproven', { skip: e2e }, () => {
  const base = path.join(tmp, 'local-app'); fs.mkdirSync(base); const fake = fakeInstall(base);
  const out = runScript([], isolatedEnv(base)); assert.equal(out.status, 0, out.stderr);
  const rep = JSON.parse(out.stdout);
  const app = rep.apps.find(a => a.discovery === 'known-install-directory'); assert.ok(app, 'fake install discovered');
  assert.equal(app.executable_sha256, sha(fake.exe)); assert.equal(app.app_asar_sha256, sha(fake.asar));
  assert.equal(app.rpc_only_classification_proven, false); assert.equal(app.legacy_direct_dml_absent_proven, false);
  assert.match(app.migration_disposition, /^UNKNOWN/);
  for (const secret of [tmp, base, os.userInfo().username, os.hostname()]) assert.ok(!out.stdout.toLowerCase().includes(String(secret).toLowerCase()), 'report must not contain a path, user or host name');
});
test('e2e: an install reached through a junction is rejected, not hashed', { skip: e2e }, () => {
  const real = path.join(tmp, 'junction-real'); fs.mkdirSync(real); fakeInstall(real);
  const link = path.join(tmp, 'junction-link');
  assert.equal(ps(['-Command', `New-Item -ItemType Junction -Path '${link}' -Target '${real}' | Out-Null`]).status, 0);
  const out = runScript([], isolatedEnv(link)); assert.equal(out.status, 0, out.stderr);
  const rep = JSON.parse(out.stdout);
  assert.equal(rep.apps.filter(a => a.discovery === 'known-install-directory' && a.executable_sha256).length, 0, 'nothing behind the link is hashed');
  assert.ok(rep.warnings.some(w => /junction or symbolic link|rejected/.test(w)));
});
test('e2e: -OutFile writes a new file once, then refuses to overwrite it', { skip: e2e }, () => {
  const base = path.join(tmp, 'out-app'); fs.mkdirSync(base); fakeInstall(base);
  const target = path.join(tmp, 'new-receipt.json');
  assert.equal(runScript(['-OutFile', target], isolatedEnv(base)).status, 0);
  const first = fs.readFileSync(target, 'utf8'); assert.match(first, /sasv-wp10-fleet-inventory-v1/);
  const again = runScript(['-OutFile', target], isolatedEnv(base));
  assert.notEqual(again.status, 0); assert.match(again.stderr, /already exists/); assert.equal(fs.readFileSync(target, 'utf8'), first);
});
