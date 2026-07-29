param(
    [string]$VaultPath = "packages/test-fixtures/vaults/minimal",
    [string]$Note = "Research Plan.md",
    [string]$CliPath,
    [ValidateRange(1, 900)][int]$CommandTimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root
. (Join-Path $PSScriptRoot "process-helpers.ps1")

$isWindowsPlatform =
    $env:OS -eq "Windows_NT" -or
    [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT

if ([string]::IsNullOrWhiteSpace($CliPath)) {
    Write-Host "==> Build CLI for export smoke"
    Invoke-BoundedProcess -FilePath "cargo" -Arguments @(
        "build", "-p", "scriptor-cli", "--bin", "scriptor"
    ) -WorkingDirectory $root -TimeoutSeconds 900 | Out-Null
    $cliName = if ($isWindowsPlatform) { "scriptor.exe" } else { "scriptor" }
    $CliPath = Join-Path $root "target/debug/$cliName"
}

if (-not (Test-Path -LiteralPath $CliPath -PathType Leaf)) {
    throw "scriptor CLI binary not found: $CliPath"
}
$CliPath = (Resolve-Path -LiteralPath $CliPath).Path

function Invoke-ScriptorCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    Invoke-BoundedProcess -FilePath $CliPath -Arguments $Args -WorkingDirectory $root -TimeoutSeconds $CommandTimeoutSeconds
}

$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if (-not $pandoc) {
    Write-Warning "Pandoc not on PATH; running HTML dry-run only."
    Invoke-ScriptorCli export $VaultPath --note $Note --format html --dry-run | Out-Null
    Write-Host "Export smoke (dry-run only) passed."
    exit 0
}

foreach ($format in @("html", "docx", "pdf")) {
    Write-Host "==> Export $format"
    $json = Invoke-ScriptorCli export $VaultPath --note $Note --format $format
    $artifact = ($json | ConvertFrom-Json).artifact_path
    if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) {
        throw "Expected artifact missing: $artifact"
    }
    if ((Get-Item -LiteralPath $artifact).Length -le 0) {
        throw "Artifact is empty: $artifact"
    }
    Write-Host "Verified $format artifact: $artifact ($((Get-Item -LiteralPath $artifact).Length) bytes)"
}

Write-Host "Export smoke (html/docx/pdf) passed."
