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

Write-Host "==> Capture screenshots via playwright.e2e.config"
pnpm exec playwright test --config playwright.e2e.config.ts e2e/screenshots.spec.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$docsDir = "docs/assets/screenshots"
$snapshotDir = "e2e/screenshots.spec.ts-snapshots"
if (Test-Path $snapshotDir) {
    Write-Host "==> Copying visual regression snapshots to $docsDir"
    New-Item -ItemType Directory -Force -Path $docsDir | Out-Null
    Get-ChildItem $snapshotDir -Filter *.png | ForEach-Object {
        $docName = $_.Name -replace '-(win32|linux|darwin)(?=\.png$)', ''
        $docPath = Join-Path $docsDir $docName
        Copy-Item $_.FullName $docPath -Force
        Write-Host "  copied: $($_.Name) -> $docName"
    }
}

Write-Host "==> Screenshot capture complete"
Get-ChildItem $docsDir -Filter *.png | ForEach-Object { Write-Host "  $($_.Name)" }

if (-not $SkipDesktopBuild) {
    Write-Host "==> Build final desktop app"
    $previousE2EMode = $env:VITE_E2E_MODE
    Remove-Item Env:VITE_E2E_MODE -ErrorAction SilentlyContinue
    try {
        pnpm prepare:desktop
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        pnpm --dir apps/desktop build
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    finally {
        if ($null -ne $previousE2EMode) {
            $env:VITE_E2E_MODE = $previousE2EMode
        }
    }
    Write-Host "Installers: target/release/bundle/"
}
