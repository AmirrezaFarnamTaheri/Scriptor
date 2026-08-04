param(
    [switch]$SkipTauri,
    [switch]$SkipPerfGate
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $File $Arguments"
    }
}

Write-Host "==> Install dependencies"
Invoke-Checked pnpm @("install", "--frozen-lockfile")

Write-Host "==> Governance and source checks"
Invoke-Checked pnpm @("check:governance")
Invoke-Checked pnpm @("check:source")

Write-Host "==> Contract and plugin checks"
Invoke-Checked pnpm @("check:contracts")
Invoke-Checked pnpm @("check:mcp")
Invoke-Checked pnpm @("check:plugins")
Invoke-Checked pnpm @("check:canvas")
Invoke-Checked pnpm @("check:editor")
Invoke-Checked pnpm @("check:renderer")
Invoke-Checked pnpm @("check:export")
Invoke-Checked pnpm @("check:portal")
Invoke-Checked pnpm @("check:knowledge")
Invoke-Checked pnpm @("check:citations")
Invoke-Checked pnpm @("check:headless")

Write-Host "==> Lint and build frontend"
Invoke-Checked pnpm @("lint")
Invoke-Checked pnpm @("build")

Write-Host "==> Rust tests"
Invoke-Checked cargo @("test", "--workspace", "--exclude", "scriptor-desktop")

Write-Host "==> Release smoke"
& (Join-Path $PSScriptRoot "smoke.ps1")

Write-Host "==> TUI and daemon smoke"
Invoke-Checked pnpm @("check:tui")
Invoke-Checked pnpm @("check:daemon")
Invoke-Checked pnpm @("check:a11y")

if (-not $SkipPerfGate) {
    Write-Host "==> Performance gate"
    & (Join-Path $PSScriptRoot "perf-gate.ps1") -Size 1k
}

if (-not $SkipTauri) {
    Write-Host "==> Tauri desktop bundle"
    Invoke-Checked pnpm @("--dir", "apps/desktop", "build")
    Write-Host "==> Release manifest"
    & (Join-Path $PSScriptRoot "write-manifest.ps1")
    & (Join-Path $PSScriptRoot "verify-manifest.ps1")
    Write-Host "==> Packaged smoke"
    & (Join-Path $PSScriptRoot "packaged-smoke.ps1")
}

Write-Host "Package pipeline complete. Installers are under target/release/bundle/"
