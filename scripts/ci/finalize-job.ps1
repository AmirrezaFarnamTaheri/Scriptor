[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Scope,
    [Parameter(Mandatory = $true)][ValidateSet("success", "failure", "cancelled", "skipped")][string]$Status,
    [string]$LogDirectory = $env:CI_LOG_DIR
)

$ErrorActionPreference = "Continue"

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
    $jobName = if ($env:GITHUB_JOB) { $env:GITHUB_JOB } else { "local" }
    $LogDirectory = Join-Path (Get-Location).Path "artifacts/ci-logs/$jobName"
}
$LogDirectory = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $LogDirectory))
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$files = @()
foreach ($item in @(Get-ChildItem -LiteralPath $LogDirectory -File -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName)) {
    $relative = [System.IO.Path]::GetRelativePath($LogDirectory, $item.FullName).Replace('\', '/')
    $files += [ordered]@{
        path = $relative
        bytes = $item.Length
        sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        modified_utc = $item.LastWriteTimeUtc.ToString('o')
    }
}

$manifest = [ordered]@{
    schema_version = 1
    scope = $Scope
    status = $Status
    captured_utc = [DateTimeOffset]::UtcNow.ToString('o')
    repository = $env:GITHUB_REPOSITORY
    workflow = $env:GITHUB_WORKFLOW
    job = $env:GITHUB_JOB
    run_id = $env:GITHUB_RUN_ID
    run_number = $env:GITHUB_RUN_NUMBER
    run_attempt = $env:GITHUB_RUN_ATTEMPT
    event = $env:GITHUB_EVENT_NAME
    ref = $env:GITHUB_REF
    sha = $env:GITHUB_SHA
    runner_os = $env:RUNNER_OS
    runner_arch = $env:RUNNER_ARCH
    file_count = $files.Count
    total_bytes = ($files | Measure-Object -Property bytes -Sum).Sum
    files = $files
}
$manifestPath = Join-Path $LogDirectory "evidence-manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8

# Recompute after adding the manifest so the console inventory includes it.
$allFiles = @(Get-ChildItem -LiteralPath $LogDirectory -File -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName)
$totalBytes = ($allFiles | Measure-Object -Property Length -Sum).Sum

Write-Host "::group::Job evidence manifest - $Scope"
Write-Host "Status: $Status"
Write-Host "Evidence directory: $LogDirectory"
Write-Host "Files: $($allFiles.Count); total bytes: $totalBytes"
foreach ($item in $allFiles) {
    $relative = [System.IO.Path]::GetRelativePath($LogDirectory, $item.FullName).Replace('\', '/')
    Write-Host "$relative`t$($item.Length) bytes"
}
Write-Host "::endgroup::"

if ($env:GITHUB_STEP_SUMMARY) {
    @(
        "",
        "### Final job evidence",
        "",
        "| Field | Value |",
        "|---|---|",
        "| Scope | $($Scope -replace '\|', '\|') |",
        "| Status | **$Status** |",
        "| Evidence files | $($allFiles.Count) |",
        "| Evidence bytes | $totalBytes |",
        "| Manifest | ``evidence-manifest.json`` |",
        "| Run | ``$env:GITHUB_RUN_ID`` attempt ``$env:GITHUB_RUN_ATTEMPT`` |",
        "| Commit | ``$env:GITHUB_SHA`` |"
    ) | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8
}

$annotationLevel = if ($Status -eq "success") { "notice" } elseif ($Status -eq "cancelled") { "warning" } else { "error" }
Write-Host "::$annotationLevel title=$Scope job evidence::$Status; $($allFiles.Count) evidence files; manifest=$manifestPath"
