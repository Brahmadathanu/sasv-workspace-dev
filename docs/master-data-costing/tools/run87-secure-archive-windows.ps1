#Requires -Version 5.1
<#
  S3R - secure one-time read-only SASV run87 archive on Windows.
  Requires two distinct BitLocker-protected drives and a PostgreSQL
  read-only URL supplied through local process environment, never command args.
  Does NOT perform DELETE, CREATE, ALTER, DROP, or schedule changes.
  Does NOT upload sensitive files to GitHub, chat, or cloud CI.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ArchiveDriveRoot,
  [Parameter(Mandatory=$true)][string]$BackupDriveRoot
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-EncryptedVolume([string]$path) {
  if ($path -notmatch '^[A-Za-z]:\\') {
    throw "Use a full local drive path for both archive destinations."
  }
  $full = [IO.Path]::GetFullPath($path)
  $root = [IO.Path]::GetPathRoot($full)
  if ($root -notmatch '^[A-Za-z]:\\$') {
    throw "Only local Windows drive paths are accepted; network and UNC shares are excluded."
  }
  $drive = $root.Substring(0,2)
  try { $volume = Get-BitLockerVolume -MountPoint $drive -ErrorAction Stop }
  catch { throw "Cannot read BitLocker status for $drive; run from an elevated (Administrator) PowerShell. $($_.Exception.Message)" }
  if ($null -eq $volume -or $volume.ProtectionStatus.ToString() -ne 'On') {
    throw "BitLocker protection must be ON for drive $drive."
  }
  if (-not (Test-Path -LiteralPath $full -PathType Container)) {
    throw "Archive root directory must already exist on a protected volume: $full"
  }
  $part = Get-Partition -DriveLetter $drive.Substring(0,1) -ErrorAction Stop
  $disk = Get-Disk -Number $part.DiskNumber -ErrorAction Stop
  if ($disk.BusType -in @('Virtual','File Backed Virtual','iSCSI','Unknown')) {
    throw "Drive $drive is virtual/network-backed (BusType $($disk.BusType)); not an acceptable archive medium."
  }
  return [pscustomobject]@{ Path=$full; Drive=$drive.ToUpperInvariant(); DiskNumber=$part.DiskNumber }
}

if ([string]::IsNullOrWhiteSpace($env:SASV_ARCHIVE_DATABASE_URL)) {
  throw 'SASV_ARCHIVE_DATABASE_URL is missing. Supply it securely in the local process.'
}
$uri = [uri]$env:SASV_ARCHIVE_DATABASE_URL
if ($uri.Scheme -notin @('postgres','postgresql')) {
  throw "Database URL is not a PostgreSQL URI."
}
if ($uri.Query -notmatch '(^[?&])sslmode=(require|verify-ca|verify-full)(&|$)') {
  throw "TLS must be explicitly requested in connection URL (prefer sslmode=verify-full)."
}

$primary = Assert-EncryptedVolume $ArchiveDriveRoot
$backup = Assert-EncryptedVolume $BackupDriveRoot
if ($primary.Drive -eq $backup.Drive) {
  throw "Backup must be on a distinct BitLocker-protected drive."
}
if ($primary.DiskNumber -eq $backup.DiskNumber) {
  throw "Archive and backup share physical disk $($primary.DiskNumber); not an independent backup."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js must be installed on the local workstation."
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$toolRoot = Join-Path $repoRoot 'docs\master-data-costing\tools'
if (-not (Test-Path (Join-Path $repoRoot 'node_modules\pg'))) {
  throw "Repository dependencies are absent. Run npm ci from the repository first."
}

$archived = Join-Path $primary.Path 'SASV-run87-direct'
$backed = Join-Path $backup.Path 'SASV-run87-direct'
foreach ($target in @($archived,$backed)) {
  if (Test-Path -LiteralPath $target) {
    throw "Target already exists; refuse overwrite or merge: $target"
  }
}
# Explicitly do not log the connection URL or environment values.
Write-Host 'Starting consistent READ ONLY run87 PostgreSQL archive to encrypted local drive.'
& node (Join-Path $toolRoot 'archive-run87-direct-fks.mjs') --run-id 87 --out $archived --expected-relations 64
if ($LASTEXITCODE -ne 0) { throw "Archive exporter failed; no backup is certified." }
& node (Join-Path $toolRoot 'verify-run87-direct-fks.mjs') $archived
if ($LASTEXITCODE -ne 0) { throw 'Primary archive verification failed.' }

# Make an independent byte-for-byte copy; abort if the backup name preexists.
Copy-Item -LiteralPath $archived -Destination $backed -Recurse -ErrorAction Stop
& node (Join-Path $toolRoot 'verify-run87-direct-fks.mjs') $backed
if ($LASTEXITCODE -ne 0) { throw 'Independent backup integrity verification failed.' }

$srcFiles = @(Get-ChildItem -LiteralPath $archived -File | Sort-Object Name)
$dstFiles = @(Get-ChildItem -LiteralPath $backed -File | Sort-Object Name)
if ($srcFiles.Count -ne 65 -or $dstFiles.Count -ne 65) {
  throw "Expected exactly 64 compressed relation files and one manifest at both locations."
}
if (($srcFiles.Name -join ';') -ne ($dstFiles.Name -join ';')) {
  throw 'Primary/backup file lists differ.'
}
$files = @()
for ($i=0; $i -lt $srcFiles.Count; $i++) {
  $a = (Get-FileHash -LiteralPath $srcFiles[$i].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $b = (Get-FileHash -LiteralPath $dstFiles[$i].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($a -ne $b) { throw "Primary/backup byte mismatch on $($srcFiles[$i].Name)" }
  $files += [pscustomobject]@{File=$srcFiles[$i].Name;Sha256=$a;Bytes=$srcFiles[$i].Length}
}
$manifest = Get-Content -LiteralPath (Join-Path $archived 'manifest.json') -Raw | ConvertFrom-Json
if ($manifest.relationCount -ne 64 -or $manifest.sourceRunId -ne 87 -or
    $manifest.restoreVerified -ne $false -or $manifest.productionDeletionAuthorised -ne $false) {
  throw 'Unexpected manifest scope/flags; hold.'
}
$receipt = [pscustomobject]@{
  receiptType = 'SASV_S3R_ARCHIVE_COPY_VERIFIED_NOT_RESTORE_OR_DELETE'
  timestampUtc = (Get-Date).ToUniversalTime().ToString('o')
  runId = 87
  relationCount = 64
  archivedRows = (($manifest.tables | Measure-Object -Property count -Sum).Sum)
  filesChecked = $files.Count
  files = $files
  encryptedSeparateDriveCopies = $true
  independentPhysicalMediaConfirmed = ($primary.DiskNumber -ne $backup.DiskNumber) # distinct Windows disk numbers; operator still confirms not a RAID/partition alias
  restoreVerified = $false
  foreignKeyBusinessParityVerified = $false
  productionDeletionAuthorised = $false
}
# Store receipt beside PRIMARY archive (not within archive directory).
$receiptPath = Join-Path $primary.Path 'SASV-run87-archive-receipt.json'
if (Test-Path -LiteralPath $receiptPath) { throw 'Receipt already exists, refuse overwrite.' }
[IO.File]::WriteAllText($receiptPath, ($receipt | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
Write-Host "PASS - verified encrypted archive and separate-drive copy: $($receipt.archivedRows) rows across 64 relations."
Write-Host "Non-sensitive metadata receipt: $receiptPath"
Write-Host 'HOLD - independent physical-media confirmation, actual FK-preserving restore and deletion approval remain outstanding.'
