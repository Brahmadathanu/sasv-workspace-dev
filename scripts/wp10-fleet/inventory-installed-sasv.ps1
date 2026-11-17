# SASV WP10: local, read-only installed Electron inventory
# Windows PowerShell 5.1+; no network, admin rights, app launch, updater invocation or registry writes.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\wp10-fleet\inventory-installed-sasv.ps1
# Optional private local receipt: ... -OutFile "$env:TEMP\sasv-fleet-local.json"
[CmdletBinding()]
param(
  [string]$OutFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$report = [ordered]@{
  schema = 'sasv-wp10-fleet-inventory-v1'
  observed_utc = [DateTime]::UtcNow.ToString('o')
  scope = 'current Windows machine only; no remote fleet scan'
  installed_app_count = 0
  apps = @()
  warnings = @()
  limitations = @(
    'Installed executable version/hash is not an independently verified release/source provenance.',
    'An updater download does not prove a version was installed or restarted.',
    'RPC-only capability and role/security acceptance are UNKNOWN until binary provenance and installed tests are verified.',
    'No workstation names, usernames, user IDs, paths, tokens, sessions, or Supabase data are collected.'
  )
}

function Get-Sha256OrNull([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  try { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
  catch { $script:report.warnings += 'A local candidate could not be hashed'; return $null }
}

function Get-FileVersionOrNull([string]$Path) {
  try {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $v = (Get-Item -LiteralPath $Path).VersionInfo.ProductVersion
    if ([string]::IsNullOrWhiteSpace($v)) { return $null }
    return [string]$v
  } catch { return $null }
}

$locations = New-Object System.Collections.Generic.List[object]
$registryRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)
foreach ($root in $registryRoots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  foreach ($entry in @(Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)) {
    try {
      $p = Get-ItemProperty -LiteralPath $entry.PSPath -ErrorAction Stop
      if ($p.DisplayName -notmatch '^SASV Workspace(?:\s|$)') { continue }
      $dir = [string]$p.InstallLocation
      if (-not [string]::IsNullOrWhiteSpace($dir)) {
        $locations.Add([pscustomobject]@{dir=$dir; registry_version=[string]$p.DisplayVersion; source='uninstall-registry'})
      }
    } catch { $report.warnings += 'An uninstall-registry entry was unreadable' }
  }
}

# Target only the documented Electron-builder per-user/per-machine install locations.
$roots = @($env:LOCALAPPDATA, $env:ProgramFiles, [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'))
foreach ($root in $roots) {
  if ([string]::IsNullOrWhiteSpace($root)) { continue }
  foreach ($relative in @('Programs\SASV Workspace', 'SASV Workspace', 'Programs\sasv-workspace', 'sasv-workspace')) {
    $dir = Join-Path -Path $root -ChildPath $relative
    if (Test-Path -LiteralPath (Join-Path $dir 'SASV Workspace.exe') -PathType Leaf) {
      $locations.Add([pscustomobject]@{dir=$dir; registry_version=''; source='known-install-directory'})
    }
  }
}

$seen = @{}
foreach ($loc in $locations) {
  # Internal-only comparison key: never disclose paths in the report.
  try { $resolved = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($loc.dir)) }
  catch { $report.warnings += 'An install location was invalid'; continue }
  $k = $resolved.TrimEnd('\').ToLowerInvariant()
  if ($seen.ContainsKey($k)) { continue }
  $seen[$k] = $true
  $exe = Join-Path $resolved 'SASV Workspace.exe'
  $asar = Join-Path $resolved 'resources\app.asar'
  $hasExe = Test-Path -LiteralPath $exe -PathType Leaf
  $hasAsar = Test-Path -LiteralPath $asar -PathType Leaf
  $entry = [ordered]@{
    discovery = $loc.source
    executable_present = [bool]$hasExe
    installed_executable_product_version = Get-FileVersionOrNull $exe
    uninstall_registry_display_version = if ($loc.registry_version) { $loc.registry_version } else { $null }
    executable_sha256 = Get-Sha256OrNull $exe
    app_asar_present = [bool]$hasAsar
    app_asar_sha256 = Get-Sha256OrNull $asar
    rpc_only_classification_proven = $false
    legacy_direct_dml_absent_proven = $false
    migration_disposition = 'UNKNOWN - compare hashes with a separately approved binary/release manifest'
  }
  $report.apps += [pscustomobject]$entry
}
$report.installed_app_count = $report.apps.Count
if ($report.installed_app_count -eq 0) {
  $report.warnings += 'No matching installation found in scoped known directories/registry entries; this is NOT proof no old installations exist'
}
$json = $report | ConvertTo-Json -Depth 7
if ($OutFile) {
  $full = [IO.Path]::GetFullPath($OutFile)
  # Explicit requested local output only. No network or repo write.
  [IO.File]::WriteAllText($full, $json, (New-Object Text.UTF8Encoding($false)))
  Write-Output 'SASV local inventory saved to the explicit output path. Review privately; do not commit machine-level receipts.'
} else {
  Write-Output $json
}
