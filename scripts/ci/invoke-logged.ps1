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

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
    $jobName = if ($env:GITHUB_JOB) { $env:GITHUB_JOB } else { "local" }
    $LogDirectory = Join-Path (Get-Location).Path "artifacts/ci-logs/$jobName"
}
$LogDirectory = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $LogDirectory))
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$slug = ($Name.ToLowerInvariant() -replace '[^a-z0-9._-]+', '-') -replace '^-+|-+$', ''
if ([string]::IsNullOrWhiteSpace($slug)) {
    $slug = "command"
}
$logPath = Join-Path $LogDirectory "$slug.log"
$summaryPath = Join-Path $LogDirectory "command-summary.md"
$startedAt = [DateTimeOffset]::UtcNow
$displayArguments = $ArgumentList | ForEach-Object {
    $value = [string]$_
    if ($value -match '\s') { '"' + ($value -replace '"', '\"') + '"' } else { $value }
}
$displayCommand = (@($FilePath) + $displayArguments) -join ' '

$header = @(
    "phase: $Name",
    "command: $displayCommand",
    "working_directory: $WorkingDirectory",
    "started_utc: $($startedAt.ToString('o'))",
    "workflow: $env:GITHUB_WORKFLOW",
    "job: $env:GITHUB_JOB",
    "run_id: $env:GITHUB_RUN_ID",
    "run_attempt: $env:GITHUB_RUN_ATTEMPT",
    "runner: $env:RUNNER_OS/$env:RUNNER_ARCH",
    "--- output ---"
)
$header | Set-Content -LiteralPath $logPath -Encoding utf8

Write-Host "::group::$Name"
Write-Host "Command: $displayCommand"
Write-Host "Working directory: $WorkingDirectory"
Write-Host "Timeout: ${TimeoutSeconds}s; heartbeat: ${HeartbeatSeconds}s"
Write-Host "Log: $logPath"

$argumentsJson = ConvertTo-Json -Compress -InputObject @($ArgumentList)
$job = Start-Job -ArgumentList $WorkingDirectory, $FilePath, $argumentsJson -ScriptBlock {
    param($ChildWorkingDirectory, $ChildFilePath, $ChildArgumentsJson)

    $ErrorActionPreference = "Continue"
    $ProgressPreference = "SilentlyContinue"
    Set-Location -LiteralPath $ChildWorkingDirectory
    $childArguments = @()
    if (-not [string]::IsNullOrWhiteSpace($ChildArgumentsJson)) {
        $decoded = ConvertFrom-Json -InputObject $ChildArgumentsJson
        if ($decoded -is [System.Array]) {
            $childArguments = @($decoded | ForEach-Object { [string]$_ })
        }
        elseif ($null -ne $decoded) {
            $childArguments = @([string]$decoded)
        }
    }

    try {
        & $ChildFilePath @childArguments 2>&1 | ForEach-Object {
            $text = ($_ | Out-String).TrimEnd("`r", "`n")
            [pscustomobject]@{ Kind = "output"; Text = $text }
        }
        $nativeExitCode = $LASTEXITCODE
        if ($null -eq $nativeExitCode) {
            $nativeExitCode = if ($?) { 0 } else { 1 }
        }
        [pscustomobject]@{ Kind = "exit"; ExitCode = [int]$nativeExitCode }
    }
    catch {
        [pscustomobject]@{ Kind = "output"; Text = ($_ | Out-String).TrimEnd("`r", "`n") }
        [pscustomobject]@{ Kind = "exit"; ExitCode = 1 }
    }
}

$exitCode = $null
$timedOut = $false
$lastHeartbeat = $startedAt

function Receive-LoggedOutput {
    param([System.Management.Automation.Job]$BackgroundJob)

    foreach ($record in @(Receive-Job -Job $BackgroundJob)) {
        if ($null -eq $record) {
            continue
        }
        if ($record.Kind -eq "exit") {
            $script:exitCode = [int]$record.ExitCode
            continue
        }

        $text = [string]$record.Text
        if ([string]::IsNullOrEmpty($text)) {
            $line = "[$([DateTimeOffset]::UtcNow.ToString('o'))]"
            $line | Add-Content -LiteralPath $logPath -Encoding utf8
            Write-Host ""
            continue
        }

        foreach ($outputLine in ($text -split "`r?`n")) {
            $line = "[$([DateTimeOffset]::UtcNow.ToString('o'))] $outputLine"
            $line | Add-Content -LiteralPath $logPath -Encoding utf8
            Write-Host $line
        }
    }
}

try {
    while ($job.State -in @("NotStarted", "Running")) {
        Receive-LoggedOutput -BackgroundJob $job
        $now = [DateTimeOffset]::UtcNow
        $elapsed = $now - $startedAt

        if ($elapsed.TotalSeconds -ge $TimeoutSeconds) {
            $timedOut = $true
            Write-Host "::error title=$Name timed out::Exceeded the ${TimeoutSeconds}s command deadline."
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            break
        }

        if (($now - $lastHeartbeat).TotalSeconds -ge $HeartbeatSeconds) {
            Write-Host "::notice title=$Name heartbeat::Still running after $([math]::Round($elapsed.TotalSeconds))s. Log: $logPath"
            $lastHeartbeat = $now
        }
        Start-Sleep -Milliseconds 500
        $job = Get-Job -Id $job.Id
    }

    Receive-LoggedOutput -BackgroundJob $job
    if ($timedOut) {
        $exitCode = 124
    }
    elseif ($null -eq $exitCode) {
        $exitCode = if ($job.State -eq "Completed") { 0 } else { 1 }
    }
}
finally {
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
}

$finishedAt = [DateTimeOffset]::UtcNow
$duration = $finishedAt - $startedAt
@(
    "--- result ---",
    "finished_utc: $($finishedAt.ToString('o'))",
    "duration_seconds: $([math]::Round($duration.TotalSeconds, 3))",
    "exit_code: $exitCode",
    "timed_out: $timedOut"
) | Add-Content -LiteralPath $logPath -Encoding utf8

$status = if ($exitCode -eq 0) { "PASS" } elseif ($timedOut) { "TIMEOUT" } else { "FAIL" }
if (-not (Test-Path -LiteralPath $summaryPath)) {
    @(
        "| Phase | Result | Duration | Exit | Log |",
        "|---|---:|---:|---:|---|"
    ) | Set-Content -LiteralPath $summaryPath -Encoding utf8
}
"| $($Name -replace '\|', '\|') | $status | $([math]::Round($duration.TotalSeconds, 1))s | $exitCode | ``$([System.IO.Path]::GetFileName($logPath))`` |" |
    Add-Content -LiteralPath $summaryPath -Encoding utf8

if ($env:GITHUB_STEP_SUMMARY) {
    "| $($Name -replace '\|', '\|') | $status | $([math]::Round($duration.TotalSeconds, 1))s | $exitCode | ``$([System.IO.Path]::GetFileName($logPath))`` |" |
        Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8
}

Write-Host "Result: $status; exit=$exitCode; duration=$([math]::Round($duration.TotalSeconds, 1))s"
Write-Host "::endgroup::"

if ($exitCode -ne 0) {
    $tail = @(Get-Content -LiteralPath $logPath -Tail 20 -ErrorAction SilentlyContinue) -join " | "
    $annotation = $tail -replace '%', '%25' -replace "`r", '%0D' -replace "`n", '%0A'
    if ($annotation.Length -gt 3500) {
        $annotation = $annotation.Substring(0, 3500)
    }
    Write-Host "::error title=$Name failed::$annotation"
    exit $exitCode
}
