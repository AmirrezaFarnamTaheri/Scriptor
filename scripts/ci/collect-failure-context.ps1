[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Scope,
    [string]$LogDirectory = $env:CI_LOG_DIR,
    [ValidateRange(10, 500)][int]$TailLines = 100
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
    $jobName = if ($env:GITHUB_JOB) { $env:GITHUB_JOB } else { "local" }
    $LogDirectory = Join-Path (Get-Location).Path "artifacts/ci-logs/$jobName"
}
$LogDirectory = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $LogDirectory))
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
$contextPath = Join-Path $LogDirectory "failure-context.log"

$lines = [System.Collections.Generic.List[string]]::new()
function Add-ContextLine {
    param([string]$Text = "")
    $lines.Add($Text)
    Write-Host $Text
}

function Add-BestEffortCommand {
    param([string]$Title, [string]$Command, [string[]]$Arguments = @())

    Add-ContextLine ""
    Add-ContextLine "## $Title"
    try {
        $resolved = Get-Command $Command -ErrorAction Stop
        $output = & $resolved.Source @Arguments 2>&1 | Out-String
        if ([string]::IsNullOrWhiteSpace($output)) {
            Add-ContextLine "(no output)"
        }
        else {
            foreach ($outputLine in ($output.TrimEnd() -split "`r?`n")) {
                Add-ContextLine $outputLine
            }
        }
        Add-ContextLine "exit_code: $LASTEXITCODE"
    }
    catch {
        Add-ContextLine "unavailable: $($_.Exception.Message)"
    }
}

Write-Host "::group::Failure context - $Scope"
Add-ContextLine "scope: $Scope"
Add-ContextLine "captured_utc: $([DateTimeOffset]::UtcNow.ToString('o'))"
Add-ContextLine "workflow: $env:GITHUB_WORKFLOW"
Add-ContextLine "job: $env:GITHUB_JOB"
Add-ContextLine "run_id: $env:GITHUB_RUN_ID"
Add-ContextLine "run_attempt: $env:GITHUB_RUN_ATTEMPT"
Add-ContextLine "sha: $env:GITHUB_SHA"
Add-ContextLine "runner: $env:RUNNER_OS/$env:RUNNER_ARCH"

Add-BestEffortCommand -Title "Git status" -Command "git" -Arguments @("status", "--short", "--branch")
Add-BestEffortCommand -Title "Recent commit" -Command "git" -Arguments @("log", "-1", "--stat", "--oneline", "--decorate")
Add-BestEffortCommand -Title "Cargo duplicate dependency versions" -Command "cargo" -Arguments @("tree", "--duplicates")
Add-BestEffortCommand -Title "Top-level pnpm graph" -Command "pnpm" -Arguments @("list", "--depth", "0")
Add-BestEffortCommand -Title "Docker state" -Command "docker" -Arguments @("ps", "--all", "--no-trunc")

Add-ContextLine ""
Add-ContextLine "## Filesystem capacity"
foreach ($drive in @(Get-PSDrive -PSProvider FileSystem | Sort-Object Name)) {
    $used = if ($null -ne $drive.Used) { [math]::Round($drive.Used / 1GB, 2) } else { "n/a" }
    $free = if ($null -ne $drive.Free) { [math]::Round($drive.Free / 1GB, 2) } else { "n/a" }
    Add-ContextLine "$($drive.Name): used_gib=$used free_gib=$free root=$($drive.Root)"
}

Add-ContextLine ""
Add-ContextLine "## Highest resource processes"
try {
    foreach ($process in @(Get-Process | Sort-Object CPU -Descending | Select-Object -First 30)) {
        $workingSetMiB = [math]::Round($process.WorkingSet64 / 1MB, 1)
        $cpuSeconds = if ($null -ne $process.CPU) { [math]::Round($process.CPU, 1) } else { "n/a" }
        Add-ContextLine "pid=$($process.Id) name=$($process.ProcessName) cpu_s=$cpuSeconds working_set_mib=$workingSetMiB"
    }
}
catch {
    Add-ContextLine "process inventory unavailable: $($_.Exception.Message)"
}

Add-ContextLine ""
Add-ContextLine "## Generated artifact inventory"
foreach ($root in @("artifacts", "dist", "target/release/bundle", "target/debug/bundle", "release-artifacts")) {
    if (-not (Test-Path -LiteralPath $root)) {
        continue
    }
    Add-ContextLine "### $root"
    foreach ($item in @(Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -First 500)) {
        Add-ContextLine "$($item.FullName) bytes=$($item.Length) modified_utc=$($item.LastWriteTimeUtc.ToString('o'))"
    }
}

Add-ContextLine ""
Add-ContextLine "## Command log tails"
foreach ($log in @(Get-ChildItem -LiteralPath $LogDirectory -File -Filter "*.log" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -ne $contextPath } | Sort-Object Name)) {
    Add-ContextLine ""
    Add-ContextLine "### $($log.Name) (last $TailLines lines)"
    foreach ($tailLine in @(Get-Content -LiteralPath $log.FullName -Tail $TailLines -ErrorAction SilentlyContinue)) {
        Add-ContextLine $tailLine
    }
}

Add-ContextLine ""
Add-ContextLine "## Compiler diagnostics (errors & warnings)"
# Cargo prints errors before warnings and the summary, so a plain log tail omits
# the actual errors. Surface any diagnostic lines explicitly so CI failures are
# self-explanatory in the annotated output.
foreach ($log in @(Get-ChildItem -LiteralPath $LogDirectory -File -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object Name)) {
    $all = @(Get-Content -LiteralPath $log.FullName -ErrorAction SilentlyContinue)
    $markerIndexes = [System.Collections.Generic.List[int]]::new()
    for ($i = 0; $i -lt $all.Count; $i++) {
        # Log lines are timestamp-prefixed, so match substrings, not line start.
        if ($all[$i] -match 'error(\[|: )|warning:|  --> ') {
            $markerIndexes.Add($i)
        }
    }
    if ($markerIndexes.Count -gt 0) {
        Add-ContextLine ""
        Add-ContextLine "### $($log.Name) ($($markerIndexes.Count) diagnostic markers)"
        $handledUntil = -2
        foreach ($idx in $markerIndexes) {
            if ($idx -le $handledUntil) { continue }
            $start = [Math]::Max(0, $idx - 2)
            $end = [Math]::Min($all.Count - 1, $idx + 5)
            for ($j = $start; $j -le $end; $j++) {
                Add-ContextLine $all[$j]
            }
            Add-ContextLine "-----"
            $handledUntil = $end
        }
    }
}

$lines | Set-Content -LiteralPath $contextPath -Encoding utf8
Write-Host "Failure context log: $contextPath"
Write-Host "::endgroup::"

if ($env:GITHUB_STEP_SUMMARY) {
    @(
        "",
        "### Failure context captured",
        "",
        "- Scope: **$Scope**",
        "- Evidence directory: ``$LogDirectory``",
        "- Consolidated context: ``failure-context.log``",
        "- Command tails: last $TailLines lines per log"
    ) | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8
}

Write-Host "::notice title=Failure context captured::$Scope evidence is available in the uploaded CI log artifact."
