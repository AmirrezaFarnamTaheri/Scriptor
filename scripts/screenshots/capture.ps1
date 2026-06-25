param(
    [switch]$SkipDesktopBuild
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

if (-not $env:PLAYWRIGHT_CHANNEL) {
  $env:PLAYWRIGHT_CHANNEL = 'msedge'
}
if (-not $env:CI) {
  $env:CI = 'true'
}
Write-Host "==> Browser channel: $env:PLAYWRIGHT_CHANNEL"

Write-Host "==> Build screenshot frontend (mock Tauri bridge)"
$env:VITE_SCREENSHOT_MODE = "true"
pnpm build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item Env:VITE_SCREENSHOT_MODE -ErrorAction SilentlyContinue

Write-Host "==> Capture screenshots into docs/assets/screenshots"
pnpm exec playwright test --config playwright.config.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Screenshot capture complete"
Get-ChildItem "docs/assets/screenshots" -Filter *.png | ForEach-Object { Write-Host "  $($_.Name)" }

if (-not $SkipDesktopBuild) {
    Write-Host "==> Build final desktop app"
    pnpm prepare:desktop
    pnpm --dir apps/desktop build
    Write-Host "Installers: target/release/bundle/"
}
