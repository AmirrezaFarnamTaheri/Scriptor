param(
  [string]$Manifest = "dist/release-manifest.json"
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

cargo test -p scriptor-system-bridge manifest:: --quiet

if (-not (Test-Path $Manifest)) {
  Write-Error "Manifest not found: $Manifest"
}

$json = Get-Content $Manifest -Raw | ConvertFrom-Json
foreach ($entry in $json.artifacts) {
  $path = Join-Path $root $entry.path
  if (-not (Test-Path $path)) {
    Write-Error "Missing artifact: $($entry.path)"
  }
  $hash = (Get-FileHash -Path $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $entry.sha256) {
    Write-Error "SHA-256 mismatch for $($entry.path)"
  }
  $size = (Get-Item $path).Length
  if ($size -ne [int64]$entry.size_bytes) {
    Write-Error "Size mismatch for $($entry.path)"
  }
}

Write-Host "Release manifest verification passed for $($json.artifacts.Count) artifact(s)"
