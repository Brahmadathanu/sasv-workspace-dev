#Requires -Version 5.1
<#
  Route 2 credential helper (ASCII only, Windows PowerShell 5.1 compatible).

  Generate : creates a random 40-character password, stores it ONLY as a DPAPI-protected
             file readable by the current Windows user, and writes R2_02_enable_login.sql
             containing just a SCRAM-SHA-256 verifier (never the password) with a 7-day
             VALID UNTIL. The password is never printed, logged or placed in the repository.
               powershell -NoProfile -File New-ArchiveRoCredential.ps1 -Mode Generate

  LoadEnv  : dot-source to set SASV_ARCHIVE_DATABASE_URL in the CURRENT process only.
               . .\New-ArchiveRoCredential.ps1 -Mode LoadEnv -DbHost <host> -DbName postgres -DbUser <user>
             DbUser for the Supabase pooler is "sasv_archive_ro.<project-ref>".
             Remove with: Remove-Item Env:SASV_ARCHIVE_DATABASE_URL
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidateSet('Generate','LoadEnv')][string]$Mode,
  [string]$SecretDir = (Join-Path $env:LOCALAPPDATA 'SASV-RO-ARCHIVE'),
  [string]$DbHost, [int]$DbPort = 5432, [string]$DbName = 'postgres', [string]$DbUser = 'sasv_archive_ro',
  [string]$SslMode = 'verify-full', [string]$SslRootCert
)
$ErrorActionPreference = 'Stop'
$pwFile = Join-Path $SecretDir 'ro-password.dpapi'

function New-ScramVerifier([string]$password) {
  $salt = New-Object byte[] 16
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); $rng.GetBytes($salt)
  $iter = 4096
  $kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes($password, $salt, $iter, [Security.Cryptography.HashAlgorithmName]::SHA256)
  $salted = $kdf.GetBytes(32)
  $hm = New-Object Security.Cryptography.HMACSHA256(,$salted)
  $clientKey = $hm.ComputeHash([Text.Encoding]::UTF8.GetBytes('Client Key'))
  $serverKey = $hm.ComputeHash([Text.Encoding]::UTF8.GetBytes('Server Key'))
  $stored = [Security.Cryptography.SHA256]::Create().ComputeHash($clientKey)
  return 'SCRAM-SHA-256${0}:{1}${2}:{3}' -f $iter, [Convert]::ToBase64String($salt), [Convert]::ToBase64String($stored), [Convert]::ToBase64String($serverKey)
}

if ($Mode -eq 'Generate') {
  if (Test-Path -LiteralPath $pwFile) { throw "Credential already exists at $pwFile; remove it deliberately to regenerate." }
  New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null
  & icacls $SecretDir /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" | Out-Null
  $chars = (48..57) + (65..90) + (97..122) | ForEach-Object { [char]$_ }
  $bytes = New-Object byte[] 40
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $plain = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Count] })
  (ConvertTo-SecureString $plain -AsPlainText -Force | ConvertFrom-SecureString) | Set-Content -LiteralPath $pwFile -Encoding ascii
  $verifier = New-ScramVerifier $plain
  $plain = $null
  $sql = @"
-- ROUTE 2 / STEP 2 of 4 -- enable login for the temporary archive role (7 days).
-- Generated locally. Contains ONLY a SCRAM-SHA-256 verifier, not the password.
-- Run as administrator after R2_01 and before R2_03.
DO `$r2e`$
DECLARE r pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = 'sasv_archive_ro';
  IF NOT FOUND OR r.rolcanlogin OR r.rolsuper THEN
    RAISE EXCEPTION 'R2E HOLD: role missing, already login-enabled or privileged';
  END IF;
  EXECUTE format('ALTER ROLE sasv_archive_ro LOGIN PASSWORD %L VALID UNTIL %L', '$verifier', (now() + interval '7 days')::text);
  RAISE NOTICE 'R2_02 OK: login enabled until %', (now() + interval '7 days')::text;
END
`$r2e`$;
"@
  $out = Join-Path $SecretDir 'R2_02_enable_login.sql'
  [IO.File]::WriteAllText($out, $sql, (New-Object Text.UTF8Encoding($false)))
  Write-Host "Generated. Password stored (DPAPI, current user only): $pwFile"
  Write-Host "Verifier-only SQL for owner review: $out"
  return
}

# LoadEnv
if (-not (Test-Path -LiteralPath $pwFile)) { throw "No credential at $pwFile; run -Mode Generate first." }
if (-not $DbHost) { throw '-DbHost is required.' }
if ($SslMode -notin @('require','verify-ca','verify-full')) { throw 'TLS is mandatory.' }
$sec = Get-Content -LiteralPath $pwFile | ConvertTo-SecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
$q = "sslmode=$SslMode"
if ($SslRootCert) { $q += '&sslrootcert=' + [uri]::EscapeDataString($SslRootCert) }
$env:SASV_ARCHIVE_DATABASE_URL = 'postgresql://{0}:{1}@{2}:{3}/{4}?{5}' -f [uri]::EscapeDataString($DbUser), $plain, $DbHost, $DbPort, $DbName, $q
$plain = $null
Write-Host 'SASV_ARCHIVE_DATABASE_URL set for this process only (value not shown).'
