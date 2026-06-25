param(
  [string]$Version = "0.1.0",
  [string]$BundleDir = "apps/desktop/src-tauri/target/release/bundle"
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

function Get-Sha256([string]$Path) {
  $hash = Get-FileHash -Path $Path -Algorithm SHA256
  return $hash.Hash.ToLowerInvariant()
}

$artifacts = @()
$patterns = @("msi/*.msi", "nsis/*.exe")
foreach ($pattern in $patterns) {
  $fullPattern = Join-Path $BundleDir $pattern
  Get-ChildItem -Path $fullPattern -ErrorAction SilentlyContinue | ForEach-Object {
    $relative = $_.FullName.Substring((Resolve-Path $root).Path.Length + 1).Replace("\", "/")
    $artifacts += [ordered]@{
      path = $relative
      sha256 = (Get-Sha256 $_.FullName)
      size_bytes = $_.Length
    }
  }
}

if ($artifacts.Count -eq 0) {
  Write-Error "No installer artifacts found under $BundleDir"
}

$manifest = [ordered]@{
  version = $Version
  artifacts = $artifacts
}

$outPath = Join-Path $root "dist/release-manifest.json"
New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
$manifest | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $outPath
Write-Host "Wrote $outPath with $($artifacts.Count) artifact(s)"
