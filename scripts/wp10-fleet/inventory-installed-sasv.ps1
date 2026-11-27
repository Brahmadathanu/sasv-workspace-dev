# SASV WP10: local, read-only installed Electron inventory
# Windows PowerShell 5.1+; no network, admin rights, app launch, updater invocation or registry writes.
# Run: powershell -NoProfile -File .\scripts\wp10-fleet\inventory-installed-sasv.ps1
# Optional private local receipt (must be a NEW file in an existing local folder; never overwrites):
#   ... -OutFile "$env:TEMP\sasv-fleet-local.json"
[CmdletBinding()]
param(
  [string]$OutFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---- guards (defined first; the optional output path is validated before any discovery) ----

# Reads an optional property without tripping StrictMode when the property does not exist
# (many uninstall-registry keys have no DisplayName / InstallLocation / DisplayVersion).
function Get-OptionalProperty($Object, [string]$Name) {
  if ($null -eq $Object) { return $null }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $null }
  return $prop.Value
}

function Get-DriveTypeName([string]$Root) {
  try { return [string](New-Object System.IO.DriveInfo($Root)).DriveType } catch { return 'Unknown' }
}

# True only for a drive-letter path on a FIXED local drive. Rejects UNC (\\server\share), device paths (\\?\ and \\.\),
# mapped network drives, removable and optical media, and anything that cannot be resolved. No file system access
# other than the drive-type query, so it is safe to call before reading or hashing a candidate.
function Test-LocalFixedPath([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
  try { $full = [IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($Path)) } catch { return $false }
  if ($full.StartsWith('\\') -or $full.StartsWith('//')) { return $false }
  if ($full -notmatch '^[A-Za-z]:\\') { return $false }
  return ((Get-DriveTypeName $full.Substring(0, 3)) -eq 'Fixed')
}

# False when the item, or any existing parent up to the drive root, is a reparse point (junction or symbolic link),
# because a link could silently redirect a read to a network or foreign location.
function Test-NoReparsePoint([string]$Path) {
  $current = $Path
  while (-not [string]::IsNullOrEmpty($current)) {
    if (Test-Path -LiteralPath $current) {
      $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
    }
    $parent = Split-Path -Path $current -Parent
    if ([string]::IsNullOrEmpty($parent) -or $parent -eq $current) { break }
    $current = $parent
  }
  return $true
}

# Validates an explicitly requested output file and returns its full path. Throws (before any discovery) unless the target is a
# NEW file inside an EXISTING local fixed-drive folder that is not a link. Existing files and directories are never overwritten.
function Resolve-SafeOutFile([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw 'OutFile path is empty.' }
  try { $full = [IO.Path]::GetFullPath($Path) } catch { throw 'OutFile path is not a valid path.' }
  if (-not (Test-LocalFixedPath $full)) { throw 'OutFile must be on a local fixed drive (no UNC, network, device or removable path).' }
  $parent = Split-Path -Path $full -Parent
  if ([string]::IsNullOrEmpty($parent) -or -not (Test-Path -LiteralPath $parent -PathType Container)) { throw 'OutFile parent directory does not exist.' }
  if (-not (Test-NoReparsePoint $parent)) { throw 'OutFile parent directory must not be a junction or symbolic link.' }
  if (Test-Path -LiteralPath $full) { throw 'OutFile already exists; refusing to overwrite. Choose a new file name.' }
  return $full
}

$resolvedOutFile = $null
if ($PSBoundParameters.ContainsKey('OutFile')) { $resolvedOutFile = Resolve-SafeOutFile $OutFile }

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

# Every candidate artifact is checked BEFORE it is read: local fixed drive, no link in its path.
function Test-ReadableLocalArtifact([string]$Path) {
  if (-not (Test-LocalFixedPath $Path)) { $script:report.warnings += 'A candidate was rejected (not a local fixed-drive path)'; return $false }
  if (-not (Test-NoReparsePoint $Path)) { $script:report.warnings += 'A candidate was rejected (junction or symbolic link in its path)'; return $false }
  return $true
}

function Get-Sha256OrNull([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  if (-not (Test-ReadableLocalArtifact $Path)) { return $null }
  try { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
  catch { $script:report.warnings += 'A local candidate could not be hashed'; return $null }
}

function Get-FileVersionOrNull([string]$Path) {
  try {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    if (-not (Test-ReadableLocalArtifact $Path)) { return $null }
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
$unreadableRegistryEntries = 0
foreach ($root in $registryRoots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  foreach ($entry in @(Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)) {
    $p = $null
    try { $p = Get-ItemProperty -LiteralPath $entry.PSPath -ErrorAction Stop } catch { $unreadableRegistryEntries++; continue }
    $displayName = [string](Get-OptionalProperty $p 'DisplayName')
    if ([string]::IsNullOrWhiteSpace($displayName) -or $displayName -notmatch '^SASV Workspace(?:\s|$)') { continue }
    $dir = [string](Get-OptionalProperty $p 'InstallLocation')
    if ([string]::IsNullOrWhiteSpace($dir)) { $report.warnings += 'A SASV uninstall-registry entry has no InstallLocation'; continue }
    $locations.Add([pscustomobject]@{dir=$dir; registry_version=[string](Get-OptionalProperty $p 'DisplayVersion'); source='uninstall-registry'})
  }
}
if ($unreadableRegistryEntries -gt 0) { $report.warnings += ('{0} uninstall-registry entries were unreadable and could not be checked' -f $unreadableRegistryEntries) }

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
  if (-not (Test-LocalFixedPath $resolved)) { $report.warnings += 'An install location was rejected (not a local fixed-drive path)'; continue }
  $k = $resolved.TrimEnd('\').ToLowerInvariant()
  if ($seen.ContainsKey($k)) { continue }
  $seen[$k] = $true
  if (-not (Test-NoReparsePoint $resolved)) { $report.warnings += 'An install location was rejected (junction or symbolic link in its path)'; continue }
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
if ($resolvedOutFile) {
  # Explicit requested local output only (validated above): CreateNew fails if the file appeared meanwhile. No network or repo write.
  $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes($json)
  $stream = [IO.File]::Open($resolvedOutFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
  Write-Output 'SASV local inventory saved to the explicit output path. Review privately; do not commit machine-level receipts.'
} else {
  Write-Output $json
}
