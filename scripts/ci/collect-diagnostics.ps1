[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Scope,
    [string]$LogDirectory = $env:CI_LOG_DIR
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
    $jobName = if ($env:GITHUB_JOB) { $env:GITHUB_JOB } else { "local" }
    $LogDirectory = Join-Path (Get-Location).Path "artifacts/ci-logs/$jobName"
}
$LogDirectory = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $LogDirectory))
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
$logPath = Join-Path $LogDirectory "diagnostics.log"

$lines = [System.Collections.Generic.List[string]]::new()
function Add-DiagnosticLine {
    param([string]$Text = "")
    $lines.Add($Text)
    Write-Host $Text
}

function Get-ToolVersion {
    param([string]$Command, [string[]]$Arguments = @("--version"))
    try {
        $resolved = Get-Command $Command -ErrorAction Stop
        $result = (& $resolved.Source @Arguments 2>&1 | Out-String).Trim()
        if ([string]::IsNullOrWhiteSpace($result)) {
            return "$Command: available at $($resolved.Source)"
        }
        return ($result -replace "`r?`n", " | ")
    }
    catch {
        return "$Command: unavailable"
    }
}

Write-Host "::group::Environment diagnostics - $Scope"
Add-DiagnosticLine "scope: $Scope"
Add-DiagnosticLine "captured_utc: $([DateTimeOffset]::UtcNow.ToString('o'))"
Add-DiagnosticLine "workspace: $((Get-Location).Path)"
Add-DiagnosticLine "os: $([System.Environment]::OSVersion.VersionString)"
Add-DiagnosticLine "process_architecture: $([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture)"
Add-DiagnosticLine "os_architecture: $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"
Add-DiagnosticLine "powershell: $($PSVersionTable.PSEdition) $($PSVersionTable.PSVersion)"
Add-DiagnosticLine "dotnet_runtime: $([System.Runtime.InteropServices.RuntimeInformation]::FrameworkDescription)"
Add-DiagnosticLine "timezone: $([System.TimeZoneInfo]::Local.Id)"
Add-DiagnosticLine ""

Add-DiagnosticLine "github_context:"
$contextVariables = @(
    "GITHUB_WORKFLOW",
    "GITHUB_JOB",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_NUMBER",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_EVENT_NAME",
    "GITHUB_REPOSITORY",
    "GITHUB_ACTOR",
    "GITHUB_REF",
    "GITHUB_REF_NAME",
    "GITHUB_REF_TYPE",
    "GITHUB_SHA",
    "GITHUB_HEAD_REF",
    "GITHUB_BASE_REF",
    "RUNNER_NAME",
    "RUNNER_OS",
    "RUNNER_ARCH",
    "RUNNER_ENVIRONMENT",
    "ImageOS",
    "ImageVersion"
)
foreach ($name in $contextVariables) {
    $value = [System.Environment]::GetEnvironmentVariable($name)
    if ($null -ne $value) {
        Add-DiagnosticLine "  ${name}: $value"
    }
}
Add-DiagnosticLine ""

Add-DiagnosticLine "toolchain_versions:"
foreach ($tool in @(
    @{ Command = "git"; Arguments = @("--version") },
    @{ Command = "node"; Arguments = @("--version") },
    @{ Command = "pnpm"; Arguments = @("--version") },
    @{ Command = "rustc"; Arguments = @("--version", "--verbose") },
    @{ Command = "cargo"; Arguments = @("--version", "--verbose") },
    @{ Command = "go"; Arguments = @("version") },
    @{ Command = "docker"; Arguments = @("version", "--format", "{{.Client.Version}}") }
)) {
    Add-DiagnosticLine "  $($tool.Command): $(Get-ToolVersion -Command $tool.Command -Arguments $tool.Arguments)"
}
Add-DiagnosticLine ""

Add-DiagnosticLine "git_state:"
try {
    Add-DiagnosticLine "  head: $((& git rev-parse HEAD 2>&1 | Out-String).Trim())"
    Add-DiagnosticLine "  branch: $((& git rev-parse --abbrev-ref HEAD 2>&1 | Out-String).Trim())"
    Add-DiagnosticLine "  commit: $((& git log -1 --pretty=format:'%H %cI %s' 2>&1 | Out-String).Trim())"
    $status = (& git status --short --branch 2>&1 | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($status)) {
        Add-DiagnosticLine "  status: clean"
    }
    else {
        Add-DiagnosticLine "  status:"
        foreach ($statusLine in ($status -split "`r?`n")) {
            Add-DiagnosticLine "    $statusLine"
        }
    }
}
catch {
    Add-DiagnosticLine "  unavailable: $($_.Exception.Message)"
}
Add-DiagnosticLine ""

Add-DiagnosticLine "lockfile_fingerprints:"
foreach ($path in @("Cargo.lock", "pnpm-lock.yaml", "package.json", "Cargo.toml")) {
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $item = Get-Item -LiteralPath $path
        $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        Add-DiagnosticLine "  ${path}: bytes=$($item.Length) sha256=$hash"
    }
}
Add-DiagnosticLine ""

Add-DiagnosticLine "filesystem_capacity:"
foreach ($drive in @(Get-PSDrive -PSProvider FileSystem | Sort-Object Name)) {
    $used = if ($null -ne $drive.Used) { [math]::Round($drive.Used / 1GB, 2) } else { "n/a" }
    $free = if ($null -ne $drive.Free) { [math]::Round($drive.Free / 1GB, 2) } else { "n/a" }
    Add-DiagnosticLine "  $($drive.Name): used_gib=$used free_gib=$free root=$($drive.Root)"
}
Add-DiagnosticLine ""

Add-DiagnosticLine "repository_inventory:"
foreach ($item in @(Get-ChildItem -Force | Sort-Object PSIsContainer -Descending, Name | Select-Object -First 100)) {
    $kind = if ($item.PSIsContainer) { "dir" } else { "file" }
    $size = if ($item.PSIsContainer) { "-" } else { $item.Length }
    Add-DiagnosticLine "  ${kind}: $($item.Name) bytes=$size"
}

$lines | Set-Content -LiteralPath $logPath -Encoding utf8
Write-Host "Diagnostics log: $logPath"
Write-Host "::endgroup::"

if ($env:GITHUB_STEP_SUMMARY) {
    @(
        "## $Scope",
        "",
        "- **Workflow:** ``$env:GITHUB_WORKFLOW``",
        "- **Job:** ``$env:GITHUB_JOB``",
        "- **Run:** ``$env:GITHUB_RUN_ID`` attempt ``$env:GITHUB_RUN_ATTEMPT``",
        "- **Commit:** ``$env:GITHUB_SHA``",
        "- **Runner:** ``$env:RUNNER_OS`` / ``$env:RUNNER_ARCH``",
        "- **Diagnostics artifact path:** ``$LogDirectory``",
        "",
        "### Command phases",
        "",
        "| Phase | Result | Duration | Exit | Log |",
        "|---|---:|---:|---:|---|"
    ) | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding utf8
}
