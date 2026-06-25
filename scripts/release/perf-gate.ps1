param(
    [ValidateSet('1k', '5k')]
    [string]$Size = '1k',
    [switch]$IncludeSearch
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

Write-Host "==> Performance gate: scan $Size"
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "../benchmarks/bench-large.ps1") -Size $Size -Mode scan -Iterations 3
if ($LASTEXITCODE -ne 0) {
    throw "Scan benchmark exceeded budget for $Size vault."
}

if ($IncludeSearch) {
    Write-Host "==> Performance gate: search $Size"
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "../benchmarks/bench-large.ps1") -Size $Size -Mode search -Iterations 3
    if ($LASTEXITCODE -ne 0) {
        throw "Search benchmark exceeded budget for $Size vault."
    }
}

Write-Host "Performance gates passed."
