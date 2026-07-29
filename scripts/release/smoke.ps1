param(
    [string]$VaultPath = "packages/test-fixtures/vaults/minimal",
    [string]$Note = "Research Plan.md",
    [switch]$SkipExportDiscover
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

$isWindowsPlatform =
    $env:OS -eq "Windows_NT" -or
    [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

Write-Host "==> Build daemon sidecar"
& cargo build -p scriptor-daemon --bin scriptor-daemon
if ($LASTEXITCODE -ne 0) {
    throw "failed to build scriptor-daemon sidecar"
}
$daemonName = if ($isWindowsPlatform) { "scriptor-daemon.exe" } else { "scriptor-daemon" }
$daemonPath = Join-Path $root "target/debug/$daemonName"
if (-not (Test-Path -LiteralPath $daemonPath -PathType Leaf)) {
    throw "scriptor-daemon binary not found after build: $daemonPath"
}
$env:SCRIPTOR_DAEMON_BIN = (Resolve-Path -LiteralPath $daemonPath).Path

function Invoke-ScriptorCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & cargo run -p scriptor-cli -- @Args
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "scriptor-cli failed ($exitCode): $($Args -join ' ')"
    }
}

$sourceVault = (Resolve-Path -LiteralPath $VaultPath).Path
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "scriptor-release-smoke-$([guid]::NewGuid().ToString('N'))"
$smokeVault = Join-Path $tempRoot "vault"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
Copy-Item -LiteralPath $sourceVault -Destination $smokeVault -Recurse -Force

try {
    Write-Host "==> Daemon auto-start and ping"
    Invoke-ScriptorCli daemon ping | Out-Null

    Write-Host "==> Open vault"
    Invoke-ScriptorCli open $smokeVault

    Write-Host "==> Scan vault"
    Invoke-ScriptorCli scan $smokeVault | Out-Null

    Write-Host "==> Read note"
    Invoke-ScriptorCli read $smokeVault --note $Note | Out-Null

    Write-Host "==> Create note (dry-run)"
    Invoke-ScriptorCli note $smokeVault --file "Smoke Created.md" --body "# Smoke Created`n`n" --dry-run | Out-Null

    Write-Host "==> Create note"
    Invoke-ScriptorCli note $smokeVault --file "Smoke Created.md" --body "# Smoke Created`n`nCreated by release smoke.`n" | Out-Null

    Write-Host "==> Rebuild index"
    Invoke-ScriptorCli rebuild-index $smokeVault | Out-Null

    Write-Host "==> Search"
    Invoke-ScriptorCli search $smokeVault "research" --limit 5 | Out-Null

    Write-Host "==> Health diagnostics"
    Invoke-ScriptorCli health-diagnostics $smokeVault | Out-Null

    Write-Host "==> Export dry-run"
    Invoke-ScriptorCli export $smokeVault --note $Note --format html --dry-run | Out-Null

    Write-Host "==> Export smoke"
    & (Join-Path $PSScriptRoot "export-smoke.ps1") -VaultPath $smokeVault -Note $Note
    if ($LASTEXITCODE -ne 0) {
        throw "export smoke failed ($LASTEXITCODE)"
    }

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
    Invoke-ScriptorCli canvas-list-documents $smokeVault | Out-Null

    if (-not $SkipExportDiscover) {
        Write-Host "==> Pandoc discovery"
        try {
            Invoke-ScriptorCli export-discover | Out-Null
        }
        catch {
            Write-Warning "Pandoc not installed on PATH; export-discover skipped in CI when Pandoc is absent."
            Write-Warning $_.Exception.Message
        }
    }

    Write-Host "Release smoke checks passed."
}
finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
