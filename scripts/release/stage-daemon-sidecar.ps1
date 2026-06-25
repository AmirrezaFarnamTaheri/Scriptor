param(
  [string]$OutDir = "apps/desktop/src-tauri/binaries"
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

Write-Host "==> Build scriptor-daemon release binary"
cargo build -p scriptor-daemon --release

$hostTriple = (rustc -vV | Select-String "^host: ").ToString().Replace("host: ", "").Trim()
$source = Join-Path $root "target/release/scriptor-daemon.exe"
if (-not (Test-Path $source)) {
  $source = Join-Path $root "target/release/scriptor-daemon"
}
if (-not (Test-Path $source)) {
  Write-Error "Daemon binary not found after build"
}

$destDir = Join-Path $root $OutDir
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$destName = if ($IsWindows -or $env:OS -match "Windows") {
  "scriptor-daemon.exe"
} else {
  "scriptor-daemon"
}
$dest = Join-Path $destDir $destName
Copy-Item -Force $source $dest
Write-Host "Staged daemon sidecar at $dest"
