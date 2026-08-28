param(
    [ValidateSet('100', '1k', '5k', '25k')]
    [string]$Size = '1k',
    [ValidateSet('scan', 'search')]
    [string]$Mode = 'scan',
    [int]$Iterations = 3,
    [string]$Query = 'note',
    [string]$OutputPath = ''
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $File $Arguments"
    }
}

$vaultMap = @{
    '100' = 'packages/test-fixtures/vaults/synthetic-100'
    '1k' = 'packages/test-fixtures/vaults/synthetic-1k'
    '5k' = 'packages/test-fixtures/vaults/synthetic-5k'
    '25k' = 'packages/test-fixtures/vaults/synthetic-25k'
}
$countMap = @{
    '100' = 100
    '1k' = 1000
    '5k' = 5000
    '25k' = 25000
}

$vault = $vaultMap[$Size]
$count = $countMap[$Size]

if (-not (Test-Path $vault)) {
    Write-Host "Generating $Size synthetic vault at $vault..."
    & (Join-Path $PSScriptRoot "../fixture-import/generate-synthetic-vault.ps1") -Output $vault -Count $count
}

if ($Mode -eq 'scan') {
    $report = cargo run --release -q -p scriptor-cli -- bench-scan $vault --iterations $Iterations
    if ($LASTEXITCODE -ne 0) { exit 1 }
} else {
    Invoke-Checked cargo @("run", "--release", "-q", "-p", "scriptor-cli", "--", "rebuild-index", $vault) | Out-Null
    $report = cargo run --release -q -p scriptor-cli -- bench-search $vault $Query --iterations $Iterations
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

$reportText = ($report | Out-String).Trim()
Write-Output $reportText
if ($OutputPath) {
    $destination = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path (Get-Location) $OutputPath }
    $parent = Split-Path -Parent $destination
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    try {
        $parsed = $reportText | ConvertFrom-Json
    } catch {
        throw "benchmark output is not valid JSON; refusing to write trend evidence"
    }
    $envelope = [ordered]@{
        schemaVersion = 1
        createdAt = [DateTime]::UtcNow.ToString('o')
        size = $Size
        mode = $Mode
        expectedNotes = $count
        report = $parsed
    }
    $envelope | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 -Path $destination
    Write-Host "Benchmark evidence written: $destination"
}
