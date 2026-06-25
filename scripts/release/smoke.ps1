param(
    [string]$VaultPath = "packages/test-fixtures/vaults/minimal",
    [string]$Note = "Research Plan.md",
    [switch]$SkipExportDiscover
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

function Invoke-ScriptorCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & cargo run -p scriptor-cli -- @Args
    if ($LASTEXITCODE -ne 0) {
        throw "scriptor-cli failed: $($Args -join ' ')"
    }
}

Write-Host "==> Open vault"
Invoke-ScriptorCli open $VaultPath

Write-Host "==> Scan vault"
Invoke-ScriptorCli scan $VaultPath | Out-Null

Write-Host "==> Read note"
Invoke-ScriptorCli read $VaultPath --note $Note | Out-Null

Write-Host "==> Create note (dry-run)"
Invoke-ScriptorCli note $VaultPath --file "Smoke Created.md" --body "# Smoke Created`n`n" --dry-run | Out-Null

Write-Host "==> Create note"
Invoke-ScriptorCli note $VaultPath --file "Smoke Created.md" --body "# Smoke Created`n`nCreated by release smoke.`n" | Out-Null

Write-Host "==> Rebuild index"
Invoke-ScriptorCli rebuild-index $VaultPath | Out-Null

Write-Host "==> Search"
Invoke-ScriptorCli search $VaultPath "research" --limit 5 | Out-Null

Write-Host "==> Health diagnostics"
Invoke-ScriptorCli health-diagnostics $VaultPath | Out-Null

Write-Host "==> Export dry-run"
Invoke-ScriptorCli export $VaultPath --note $Note --format html --dry-run | Out-Null

Write-Host "==> Export smoke"
& (Join-Path $PSScriptRoot "export-smoke.ps1") -VaultPath $VaultPath -Note $Note

Write-Host "==> Canvas hit-test fixture"
Invoke-ScriptorCli canvas-hit-test packages/test-fixtures/canvas/overlap-blocks.json --x 100 --y 100 | Out-Null

Write-Host "==> Canvas template dry-run"
Invoke-ScriptorCli canvas-template-dry-run packages/test-fixtures/canvas/minimal-board.json --template research-board | Out-Null

Write-Host "==> Canvas SVG snapshot dry-run"
Invoke-ScriptorCli canvas-snapshot packages/test-fixtures/canvas/minimal-board.json --format svg --output .scriptor/exports/smoke-board.svg --dry-run | Out-Null

Write-Host "==> Canvas PNG snapshot dry-run"
Invoke-ScriptorCli canvas-snapshot packages/test-fixtures/canvas/minimal-board.json --format png --output .scriptor/exports/smoke-board.png --dry-run | Out-Null

Write-Host "==> System info"
Invoke-ScriptorCli system-info | Out-Null

Write-Host "==> Canvas store list"
Invoke-ScriptorCli canvas-list-documents $VaultPath | Out-Null

if (-not $SkipExportDiscover) {
    Write-Host "==> Pandoc discovery"
    try {
        Invoke-ScriptorCli export-discover | Out-Null
    } catch {
        Write-Warning "Pandoc not installed on PATH; export-discover skipped in CI when Pandoc is absent."
        Write-Warning $_.Exception.Message
    }
}

Write-Host "Release smoke checks passed."
