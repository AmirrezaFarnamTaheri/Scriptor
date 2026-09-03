# Post-package validation: confirm bundle artifacts exist and CLI workflow still passes.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '../..'
Set-Location $root

Write-Host '==> CLI packaged workflow smoke'
& (Join-Path $PSScriptRoot 'smoke.ps1')

# Source-identity gate: the staged sidecar must exist with a staging receipt
# so packaged evidence can pin the exact daemon artifact.
$sidecar = Join-Path $root 'apps/desktop/src-tauri/binaries/scriptor-daemon.exe'
if (-not (Test-Path $sidecar)) {
  throw "Daemon sidecar missing at $sidecar - run stage-daemon-sidecar before packaging."
}
$receipt = Join-Path (Split-Path $sidecar -Parent) 'scriptor-daemon.exe.staging-receipt.json'
if (-not (Test-Path $receipt)) {
  throw "Daemon staging receipt missing at $receipt - re-run stage-daemon-sidecar (identity evidence is mandatory)."
}
$receiptData = Get-Content -LiteralPath $receipt -Raw | ConvertFrom-Json
$actualSidecar = Get-Item -LiteralPath $sidecar
$actualSidecarHash = (Get-FileHash -LiteralPath $sidecar -Algorithm SHA256).Hash.ToLowerInvariant()
if ($receiptData.artifact -ne $actualSidecar.Name) {
  throw "Daemon staging receipt artifact '$($receiptData.artifact)' does not match staged sidecar '$($actualSidecar.Name)'."
}
if ([int64]$receiptData.bytes -ne [int64]$actualSidecar.Length) {
  throw "Daemon staging receipt byte count $($receiptData.bytes) does not match staged sidecar size $($actualSidecar.Length)."
}
if ([string]$receiptData.sha256 -ne $actualSidecarHash) {
  throw "Daemon staging receipt SHA-256 $($receiptData.sha256) does not match staged sidecar SHA-256 $actualSidecarHash."
}
Write-Host "Daemon sidecar receipt verified: $receipt sha256=$actualSidecarHash"

$bundleRoot = Join-Path $root 'target/release/bundle'
if (-not (Test-Path $bundleRoot)) {
  throw "Bundle directory missing at $bundleRoot - desktop packaging was skipped. A packaged smoke run without packages validates nothing."
}
$installers = Get-ChildItem -Path $bundleRoot -Recurse -Include *.msi, *.exe -ErrorAction SilentlyContinue
if ($installers.Count -eq 0) {
  throw "No installer artifacts found under $bundleRoot - run release:package without -SkipTauri first."
}
Write-Host "Found $($installers.Count) installer artifact(s)."
foreach ($installer in $installers) {
  $hash = (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host ("installer {0} sha256={1}" -f $installer.Name, $hash)
}

Write-Host 'Packaged smoke checks complete.'
