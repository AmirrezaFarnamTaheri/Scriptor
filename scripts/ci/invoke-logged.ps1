[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [string]$WorkingDirectory = (Get-Location).Path,
    [string]$LogDirectory = $env:CI_LOG_DIR,
    [ValidateRange(1, 7200)][int]$TimeoutSeconds = 1800,
    [ValidateRange(5, 300)][int]$HeartbeatSeconds = 30
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot '../release/process-helpers.ps1')

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
    $jobName = if ($env:GITHUB_JOB) { $env:GITHUB_JOB } else { 'local' }
    $LogDirectory = Join-Path (Get-Location).Path "artifacts/ci-logs/$jobName"
}
if ([System.IO.Path]::IsPathRooted($LogDirectory)) {
    $LogDirectory = [System.IO.Path]::GetFullPath($LogDirectory)
} else {
    $LogDirectory = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $LogDirectory))
}
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$slug = ($Name.ToLowerInvariant() -replace '[^a-z0-9._-]+', '-') -replace '^-+|-+$', ''
if ([string]::IsNullOrWhiteSpace($slug)) {
    $slug = 'command'
}
$logPath = Join-Path $LogDirectory "$slug.log"
$summaryPath = Join-Path $LogDirectory 'command-summary.md'
$captureRoot = Join-Path $LogDirectory ".$slug-$([guid]::NewGuid().ToString('N'))"
$stdoutPath = Join-Path $captureRoot 'stdout.log'
$stderrPath = Join-Path $captureRoot 'stderr.log'
New-Item -ItemType Directory -Force -Path $captureRoot | Out-Null

$startedAt = [DateTimeOffset]::UtcNow
$processInfo = $null
$process = $null
$exitCode = 1
$timedOut = $false
$lastHeartbeat = $startedAt

function Add-TimestampedCapture {
    <# .SYNOPSIS Appends captured native output to the durable phase log. #>
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $text = Read-NativeProcessCapture -Path $Path
    if ([string]::IsNullOrEmpty($text)) {
        return
    }
    "--- $Label ---" | Add-Content -LiteralPath $logPath -Encoding utf8
    foreach ($outputLine in ($text -split "`r?`n")) {
        if ([string]::IsNullOrEmpty($outputLine)) {
            continue
        }
        $line = "[$([DateTimeOffset]::UtcNow.ToString('o'))] $outputLine"
        $line | Add-Content -LiteralPath $logPath -Encoding utf8
        Write-Host $line
    }
}

try {
    $captureParameters = @{
        FilePath           = $FilePath
        Arguments          = $ArgumentList
        WorkingDirectory   = $WorkingDirectory
        StandardOutputPath = $stdoutPath
        StandardErrorPath  = $stderrPath
    }
    $processInfo = Start-NativeProcessCapture @captureParameters
    $process = $processInfo.Process

    @(
        "phase: $Name",
        "command: $($processInfo.DisplayCommand)",
        "working_directory: $WorkingDirectory",
        "started_utc: $($startedAt.ToString('o'))",
        "workflow: $env:GITHUB_WORKFLOW",
        "job: $env:GITHUB_JOB",
        "run_id: $env:GITHUB_RUN_ID",
        "run_attempt: $env:GITHUB_RUN_ATTEMPT",
        "runner: $env:RUNNER_OS/$env:RUNNER_ARCH",
        "pid: $($process.Id)",
        '--- output ---'
    ) | Set-Content -LiteralPath $logPath -Encoding utf8

    Write-Host "::group::$Name"
    Write-Host "Command: $($processInfo.DisplayCommand)"
    Write-Host "Working directory: $WorkingDirectory"
    Write-Host "PID: $($process.Id)"
    Write-Host "Timeout: ${TimeoutSeconds}s; heartbeat: ${HeartbeatSeconds}s"
    Write-Host "Log: $logPath"

    while ($true) {
        $process.Refresh()
        if ($process.HasExited) {
            # Ensure Start-Process has finalized the native exit-code handle.
            [void]$process.WaitForExit(5000)
            break
        }

        $now = [DateTimeOffset]::UtcNow
        $elapsed = $now - $startedAt
        if ($elapsed.TotalSeconds -ge $TimeoutSeconds) {
            $timedOut = $true
            $exitCode = 124
            Write-Host "::error title=$Name timed out::Exceeded the ${TimeoutSeconds}s command deadline; terminating PID $($process.Id) and descendants."
            Stop-NativeProcessTree -Process $process -GraceSeconds 5
            break
        }

        if (($now - $lastHeartbeat).TotalSeconds -ge $HeartbeatSeconds) {
            Write-Host "::notice title=$Name heartbeat::PID $($process.Id) still running after $([math]::Round($elapsed.TotalSeconds))s. Log: $logPath"
            $lastHeartbeat = $now
        }
        Start-Sleep -Milliseconds 500
    }

    if (-not $timedOut) {
        $exitCode = $process.ExitCode
    }
    Add-TimestampedCapture -Path $stdoutPath -Label 'stdout'
    Add-TimestampedCapture -Path $stderrPath -Label 'stderr'
}
catch {
    $message = ($_ | Out-String).TrimEnd("`r", "`n")
    "[$([DateTimeOffset]::UtcNow.ToString('o'))] $message" | Add-Content -LiteralPath $logPath -Encoding utf8
    Write-Host $message
    if (-not $timedOut) {
        $exitCode = 1
    }
}
finally {
    if ($process) {
        try {
            $process.Refresh()
            if (-not $process.HasExited) {
                Stop-NativeProcessTree -Process $process -GraceSeconds 5
            }
        }
        catch {
            Write-Warning $_.Exception.Message
        }
    }
    if ($process) {
        $process.Dispose()
    }
    Remove-Item -LiteralPath $captureRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$finishedAt = [DateTimeOffset]::UtcNow
$duration = $finishedAt - $startedAt
@(
    '--- result ---',
    "finished_utc: $($finishedAt.ToString('o'))",
    "duration_seconds: $([math]::Round($duration.TotalSeconds, 3))",
    "exit_code: $exitCode",
    "timed_out: $timedOut"
) | Add-Content -LiteralPath $logPath -Encoding utf8

$status = if ($exitCode -eq 0) { 'PASS' } elseif ($timedOut) { 'TIMEOUT' } else { 'FAIL' }
if (-not (Test-Path -LiteralPath $summaryPath)) {
    @(
        '| Phase | Result | Duration | Exit | Log |',
        '|---|---:|---:|---:|---|'
    ) | Set-Content -LiteralPath $summaryPath -Encoding utf8
}
$summaryRow = "| $($Name -replace '\|', '\|') | $status | $([math]::Round($duration.TotalSeconds, 1))s | $exitCode | ``$([System.IO.Path]::GetFileName($logPath))`` |"
$summaryRow | Add-Content -LiteralPath $summaryPath -Encoding utf8
if ($env:GITHUB_STEP_SUMMARY) {
    $summaryRow | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8
}

Write-Host "Result: $status; exit=$exitCode; duration=$([math]::Round($duration.TotalSeconds, 1))s"
Write-Host '::endgroup::'

if ($exitCode -ne 0) {
    # The failing child writes its own diagnostic last, so the annotation has to
    # keep the *end* of the log. Truncating from the front used to drop the error
    # line itself, leaving only the surrounding build noise in the check.
    $tailLines = @(Get-Content -LiteralPath $logPath -Tail 40 -ErrorAction SilentlyContinue)
    $tailLines = @($tailLines | ForEach-Object { $_ -replace '^\[[^\]]+\]\s*', '' })
    $tail = ($tailLines -join ' | ')
    $maxTail = 3000
    if ($tail.Length -gt $maxTail) {
        $tail = '...' + $tail.Substring($tail.Length - $maxTail)
    }

    # The stage markers name the step that was running, which a tail of a long
    # log cannot show on its own.
    $stages = @(Select-String -LiteralPath $logPath -Pattern '==> ' -ErrorAction SilentlyContinue |
        Select-Object -Last 3 | ForEach-Object { $_.Line.Trim() })
    if ($stages.Count -gt 0) {
        $annotation = ('last stages: ' + ($stages -join ' | ') + ' || ') + $tail
    } else {
        $annotation = $tail
    }

    $annotation = $annotation -replace '%', '%25' -replace "`r", '%0D' -replace "`n", '%0A'
    if ($annotation.Length -gt 4000) {
        $annotation = $annotation.Substring($annotation.Length - 4000)
    }
    Write-Host "::error title=$Name failed::$annotation"
    exit $exitCode
}
