param(
    [switch]$SkipDesktopBuild,
    # Regenerate every stable Windows baseline instead of only snapshots that
    # fail the configured visual tolerance. Required after intentional pixel
    # changes; run on the pinned Windows runner so fonts/rendering match CI.
    [switch]$UpdateBaselines
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

Write-Host "==> Capture documentation screenshots via playwright.e2e.config"
$previousScreenshotMode = $env:VITE_SCREENSHOT_MODE
$previousCaptureScreenshots = $env:SCRIPTOR_CAPTURE_SCREENSHOTS
$captureExitCode = 0
try {
    $env:VITE_SCREENSHOT_MODE = 'true'
    $env:SCRIPTOR_CAPTURE_SCREENSHOTS = 'true'
    # Capture serially so a documentation run has the same deterministic
    # resource profile as the dedicated Windows visual job.
    $screenshotArgs = @("exec", "playwright", "test", "--config", "playwright.e2e.config.ts", "e2e/screenshots.spec.ts", "--workers=1")
    if ($UpdateBaselines) { $screenshotArgs += "--update-snapshots=all" }
    pnpm @screenshotArgs
    $captureExitCode = $LASTEXITCODE

    if ($UpdateBaselines -and $captureExitCode -eq 0) {
        Write-Host "==> Capture docs-only visual-review states"
        pnpm exec playwright test --config playwright.visual.config.ts e2e/visual-review.spec.ts --workers=1
        $captureExitCode = $LASTEXITCODE

        if ($captureExitCode -eq 0) {
            # These four documentation images are intentionally state-review
            # evidence rather than stable toHaveScreenshot baselines. Copy only
            # their freshly rendered test outputs. Never copy stable baseline
            # PNGs over docs captures: a baseline may be accepted within the
            # diff tolerance while still representing older UI pixels.
            $visualDocs = @{
                "visual-editor-recovery.png" = "editor-recovery.png"
                "visual-mcp-sharing-inventory.png" = "mcp-sharing-inventory.png"
                "visual-typography-popover.png" = "toolbar-typography.png"
                "visual-insert-popover.png" = "toolbar-insert.png"
            }
            foreach ($entry in $visualDocs.GetEnumerator()) {
                $source = Get-ChildItem "test-results/visual" -Recurse -File -Filter $entry.Key | Select-Object -First 1
                if (-not $source) {
                    throw "Expected visual-review capture was not produced: $($entry.Key)"
                }
                $destination = Join-Path "docs/assets/screenshots" $entry.Value
                Copy-Item $source.FullName $destination -Force
                Write-Host "  captured: $($entry.Value)"
            }
        }
    }
}
finally {
    if ($null -ne $previousCaptureScreenshots) {
        $env:SCRIPTOR_CAPTURE_SCREENSHOTS = $previousCaptureScreenshots
    } else {
        Remove-Item Env:SCRIPTOR_CAPTURE_SCREENSHOTS -ErrorAction SilentlyContinue
    }
    if ($null -ne $previousScreenshotMode) {
        $env:VITE_SCREENSHOT_MODE = $previousScreenshotMode
    } else {
        Remove-Item Env:VITE_SCREENSHOT_MODE -ErrorAction SilentlyContinue
    }
}
if ($captureExitCode -ne 0) { exit $captureExitCode }

# screenshots.spec.ts writes ready, current-source captures directly here.
# Keep those pixels. The stable Playwright snapshots are a separate comparison
# surface and must never overwrite the documentation output after capture.
$docsDir = "docs/assets/screenshots"
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
