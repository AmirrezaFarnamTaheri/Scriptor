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
$smokeAppData = Join-Path $tempRoot "appdata"
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
New-Item -ItemType Directory -Force -Path $smokeAppData | Out-Null
Copy-Item -LiteralPath $sourceVault -Destination $smokeVault -Recurse -Force

$originalAppData = $env:APPDATA
$originalDaemonBin = $env:SCRIPTOR_DAEMON_BIN
$daemonProcessId = $null

# The daemon endpoint, HMAC key, and process belong exclusively to this smoke
# invocation. This prevents stale user/runner state from satisfying the ping and
# makes it safe to terminate the exact child during cleanup.
if ($isWindowsPlatform) {
    $env:APPDATA = $smokeAppData
}
$env:SCRIPTOR_DAEMON_BIN = (Resolve-Path -LiteralPath $daemonPath).Path

try {
    Write-Host "==> Daemon auto-start and ping"
    Invoke-ScriptorCli daemon ping | Out-Null

    $endpointJson = Invoke-ScriptorCli daemon endpoint | Out-String
    $endpoint = $endpointJson | ConvertFrom-Json
    $daemonProcessId = [int]$endpoint.pid
    if ($daemonProcessId -le 0) {
        throw "daemon endpoint did not expose a valid process id"
    }
    Write-Host "Smoke daemon PID: $daemonProcessId"

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
    if ($daemonProcessId) {
        Write-Host "==> Stop smoke daemon $daemonProcessId"
        Stop-Process -Id $daemonProcessId -Force -ErrorAction SilentlyContinue
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if (-not (Get-Process -Id $daemonProcessId -ErrorAction SilentlyContinue)) {
                break
            }
            Start-Sleep -Milliseconds 250
        }
        if (Get-Process -Id $daemonProcessId -ErrorAction SilentlyContinue) {
            Write-Warning "Smoke daemon $daemonProcessId did not terminate within 10 seconds."
        }
    }

    if ($null -eq $originalAppData) {
        Remove-Item Env:APPDATA -ErrorAction SilentlyContinue
    } else {
        $env:APPDATA = $originalAppData
    }
    if ($null -eq $originalDaemonBin) {
        Remove-Item Env:SCRIPTOR_DAEMON_BIN -ErrorAction SilentlyContinue
    } else {
        $env:SCRIPTOR_DAEMON_BIN = $originalDaemonBin
    }

    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
