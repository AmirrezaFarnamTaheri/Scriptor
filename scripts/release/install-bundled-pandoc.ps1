# Optional bundled Pandoc for offline export (Windows).
# Populates resources/pandoc via winget, then sets SCRIPTOR_BUNDLED_PANDOC_DIR for the session.
param(
  [string]$OutputDir = "$PSScriptRoot\..\..\resources\pandoc"
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) {
  Write-Error 'winget is required to download Pandoc for bundling.'
}

winget install --id JohnMacFarlane.Pandoc -e --accept-package-agreements --accept-source-agreements
$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if (-not $pandoc) {
  Write-Error 'Pandoc install did not place pandoc on PATH.'
}

Copy-Item -Force $pandoc.Source (Join-Path $OutputDir 'pandoc.exe')
$env:SCRIPTOR_BUNDLED_PANDOC_DIR = $OutputDir
Write-Host "Bundled Pandoc at $OutputDir"
pnpm --dir (Join-Path $PSScriptRoot '..\..') cli -- export-discover
