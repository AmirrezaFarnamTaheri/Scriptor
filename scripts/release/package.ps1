param(
    [switch]$SkipTauri,
    [switch]$SkipPerfGate
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

Write-Host "==> Install dependencies"
pnpm install

Write-Host "==> Contract and plugin checks"
pnpm check:contracts
pnpm check:mcp
pnpm check:plugins
pnpm check:canvas
pnpm check:editor
pnpm check:renderer
pnpm check:export
pnpm check:portal
pnpm check:knowledge
pnpm check:citations
pnpm check:headless

Write-Host "==> Lint and build frontend"
pnpm lint
pnpm build

Write-Host "==> Rust tests"
cargo test --workspace

Write-Host "==> Release smoke"
& (Join-Path $PSScriptRoot "smoke.ps1")

Write-Host "==> TUI and daemon smoke"
pnpm check:tui
pnpm check:daemon
pnpm check:a11y

if (-not $SkipPerfGate) {
    Write-Host "==> Performance gate"
    & (Join-Path $PSScriptRoot "perf-gate.ps1") -Size 1k
}

if (-not $SkipTauri) {
    Write-Host "==> Tauri desktop bundle"
    pnpm --dir apps/desktop build
    Write-Host "==> Release manifest"
    & (Join-Path $PSScriptRoot "write-manifest.ps1")
    & (Join-Path $PSScriptRoot "verify-manifest.ps1")
    Write-Host "==> Packaged smoke"
    & (Join-Path $PSScriptRoot "packaged-smoke.ps1")
}

Write-Host "Package pipeline complete. Installers are under target/release/bundle/"
