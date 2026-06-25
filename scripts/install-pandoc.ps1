# Installs Pandoc on Windows via winget when available.
$ErrorActionPreference = 'Stop'
if (Get-Command winget -ErrorAction SilentlyContinue) {
  winget install --id JohnMacFarlane.Pandoc -e --accept-source-agreements --accept-package-agreements
  Write-Output 'Pandoc install requested via winget.'
} else {
  Write-Output 'winget not found. Install Pandoc manually or set SCRIPTOR_PANDOC_PATH.'
  exit 1
}
