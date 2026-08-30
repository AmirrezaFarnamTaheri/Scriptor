param(
    [string]$VaultPath = "packages/test-fixtures/vaults/minimal",
    [string]$Note = "Research Plan.md",
    [switch]$SkipExportDiscover,
    [ValidateRange(1, 900)][int]$CommandTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root
. (Join-Path $PSScriptRoot "process-helpers.ps1")

$isWindowsPlatform =
    $env:OS -eq "Windows_NT" -or
    [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

if ($isWindowsPlatform) {
    Write-Host "==> Verify process deadline and process-tree cleanup"
    & (Join-Path $PSScriptRoot "../ci/test-process-timeouts.ps1")
}

Write-Host "==> Build daemon sidecar and CLI once"
Invoke-BoundedProcess -FilePath "cargo" -Arguments @(
    "build", "-p", "scriptor-daemon", "--bin", "scriptor-daemon"
) -WorkingDirectory $root -TimeoutSeconds 900 | Out-Null
Invoke-BoundedProcess -FilePath "cargo" -Arguments @(
    "build", "-p", "scriptor-cli", "--bin", "scriptor"
) -WorkingDirectory $root -TimeoutSeconds 900 | Out-Null

$daemonName = if ($isWindowsPlatform) { "scriptor-daemon.exe" } else { "scriptor-daemon" }
$cliName = if ($isWindowsPlatform) { "scriptor.exe" } else { "scriptor" }
$daemonPath = Join-Path $root "target/debug/$daemonName"
$cliPath = Join-Path $root "target/debug/$cliName"
foreach ($requiredBinary in @($daemonPath, $cliPath)) {
    if (-not (Test-Path -LiteralPath $requiredBinary -PathType Leaf)) {
        throw "required smoke binary not found after build: $requiredBinary"
    }
}
$daemonPath = (Resolve-Path -LiteralPath $daemonPath).Path
$cliPath = (Resolve-Path -LiteralPath $cliPath).Path
$normalizedDaemonPath = [System.IO.Path]::GetFullPath($daemonPath).TrimEnd('\', '/')

function Invoke-ScriptorCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    Invoke-BoundedProcess -FilePath $cliPath -Arguments $Args -WorkingDirectory $root -TimeoutSeconds $CommandTimeoutSeconds
}

function Stop-SmokeDaemonCandidate {
    <#
    .SYNOPSIS
    Stops only a process proven to be the smoke-owned daemon binary.
    .DESCRIPTION
    A PID alone is unsafe on Windows because it may be recycled after the daemon
    exits. The executable path is mandatory, and the originally observed daemon
    also carries a process-start-time check so cleanup cannot target a reused PID.
    #>
    param(
        [Parameter(Mandatory = $true)][int]$ProcessId,
        [Nullable[datetime]]$ExpectedStartTimeUtc,
        [Parameter(Mandatory = $true)][string]$Reason
    )

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) {
        return
    }

    try {
        $actualPath = [System.IO.Path]::GetFullPath($process.Path).TrimEnd('\', '/')
    }
    catch {
        Write-Warning "Refusing to stop PID $ProcessId ($Reason): executable path could not be verified."
        return
    }
    if (-not $actualPath.Equals($normalizedDaemonPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "Refusing to stop PID $ProcessId ($Reason): executable is '$actualPath', expected '$normalizedDaemonPath'."
        return
    }

    if ($null -ne $ExpectedStartTimeUtc) {
        try {
            $actualStart = $process.StartTime.ToUniversalTime()
        }
        catch {
            Write-Warning "Refusing to stop PID $ProcessId ($Reason): process start time could not be verified."
            return
        }
        if ([math]::Abs(($actualStart - $ExpectedStartTimeUtc.Value).TotalSeconds) -gt 1) {
            Write-Warning "Refusing to stop PID $ProcessId ($Reason): PID was reused after the recorded daemon exited."
            return
        }
    }

    Write-Host "==> Stop smoke daemon $ProcessId ($Reason)"
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            return
        }
        Start-Sleep -Milliseconds 250
    }
    if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
        throw "smoke daemon $ProcessId did not terminate within 10 seconds"
    }
}

$sourceVault = (Resolve-Path -LiteralPath $VaultPath).Path
$smokeId = [guid]::NewGuid().ToString('N')
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "scriptor-release-smoke-$smokeId"
$smokeVault = Join-Path $tempRoot "vault"
$smokeAppData = Join-Path $tempRoot "appdata"
$smokeEndpointPath = Join-Path $smokeAppData "scriptor/daemon-endpoint.json"
$smokeSocket = if ($isWindowsPlatform) {
    "scriptor-smoke-$smokeId"
} else {
    Join-Path $tempRoot 'scriptor-smoke.sock'
}

$originalAppData = $env:APPDATA
$originalDaemonBin = $env:SCRIPTOR_DAEMON_BIN
$originalDaemonSocket = $env:SCRIPTOR_DAEMON_SOCKET
$originalDaemonHmacKey = $env:SCRIPTOR_TEST_DAEMON_HMAC_KEY
$daemonProcessId = $null
$daemonProcessStartTimeUtc = $null

try {
    # Creation and copying are inside the cleanup region so even a partial or
    # failed fixture copy cannot strand a temporary directory.
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    New-Item -ItemType Directory -Force -Path $smokeAppData | Out-Null
    Copy-Item -LiteralPath $sourceVault -Destination $smokeVault -Recurse -Force

    # The endpoint, HMAC key, named pipe, and process belong exclusively to this
    # invocation. APPDATA alone is insufficient on Windows because namespaced
    # local sockets otherwise share the global `scriptor-core` pipe name.
    if ($isWindowsPlatform) {
        $env:APPDATA = $smokeAppData
    }
    $env:SCRIPTOR_DAEMON_BIN = $daemonPath
    $env:SCRIPTOR_DAEMON_SOCKET = $smokeSocket
    # Debug-only daemon authentication override for a headless smoke run. The
    # production daemon always uses the operating-system keychain.
    $env:SCRIPTOR_TEST_DAEMON_HMAC_KEY = ("$smokeId$smokeId").Replace('-', '')

    Write-Host "==> Daemon auto-start and ping ($smokeSocket)"
    Invoke-ScriptorCli daemon ping | Out-Null

    $endpointJson = Invoke-ScriptorCli daemon endpoint
    $endpoint = $endpointJson | ConvertFrom-Json
    $daemonProcessId = [int]$endpoint.pid
    if ($daemonProcessId -le 0) {
        throw "daemon endpoint did not expose a valid process id"
    }
    try {
        $daemonProcessStartTimeUtc = (Get-Process -Id $daemonProcessId -ErrorAction Stop).StartTime.ToUniversalTime()
    }
    catch {
        Write-Warning "Could not capture initial smoke daemon start time for PID $daemonProcessId."
    }
    Write-Host "Smoke daemon PID: $daemonProcessId"

    Write-Host "==> Open vault"
    Invoke-ScriptorCli open $smokeVault | Write-Host

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
    & (Join-Path $PSScriptRoot "export-smoke.ps1") -VaultPath $smokeVault -Note $Note -CliPath $cliPath -CommandTimeoutSeconds $CommandTimeoutSeconds

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
    $cleanupCandidates = @{}
    if ($daemonProcessId) {
        $cleanupCandidates[[string]$daemonProcessId] = [pscustomobject]@{
            ProcessId = [int]$daemonProcessId
            ExpectedStartTimeUtc = $daemonProcessStartTimeUtc
            Reason = 'initial signed endpoint'
        }
    }

    if (Test-Path -LiteralPath $smokeEndpointPath -PathType Leaf) {
        try {
            $currentEndpoint = Get-Content -LiteralPath $smokeEndpointPath -Raw | ConvertFrom-Json
            if ([string]$currentEndpoint.socket_name -eq $smokeSocket -and [int]$currentEndpoint.pid -gt 0) {
                $currentPid = [int]$currentEndpoint.pid
                $cleanupCandidates[[string]$currentPid] = [pscustomobject]@{
                    ProcessId = $currentPid
                    ExpectedStartTimeUtc = $null
                    Reason = 'current signed smoke endpoint'
                }
            } else {
                Write-Warning "Refusing endpoint cleanup because its socket does not match '$smokeSocket'."
            }
        }
        catch {
            Write-Warning "Could not parse current smoke endpoint at $smokeEndpointPath."
        }
    }

    foreach ($candidate in $cleanupCandidates.Values) {
        Stop-SmokeDaemonCandidate -ProcessId $candidate.ProcessId -ExpectedStartTimeUtc $candidate.ExpectedStartTimeUtc -Reason $candidate.Reason
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
    if ($null -eq $originalDaemonSocket) {
        Remove-Item Env:SCRIPTOR_DAEMON_SOCKET -ErrorAction SilentlyContinue
    } else {
        $env:SCRIPTOR_DAEMON_SOCKET = $originalDaemonSocket
    }
    if ($null -eq $originalDaemonHmacKey) {
        Remove-Item Env:SCRIPTOR_TEST_DAEMON_HMAC_KEY -ErrorAction SilentlyContinue
    } else {
        $env:SCRIPTOR_TEST_DAEMON_HMAC_KEY = $originalDaemonHmacKey
    }

    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
