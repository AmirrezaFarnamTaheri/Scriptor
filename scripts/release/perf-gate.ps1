param(
    [ValidateSet('1k', '5k')]
    [string]$Size = '1k',
    [switch]$IncludeSearch
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

Write-Host "==> Performance gate: scan $Size"
& (Join-Path $PSScriptRoot "../benchmarks/bench-large.ps1") -Size $Size -Mode scan -Iterations 3

if ($IncludeSearch) {
    Write-Host "==> Performance gate: search $Size"
    & (Join-Path $PSScriptRoot "../benchmarks/bench-large.ps1") -Size $Size -Mode search -Iterations 3
}

Write-Host "Performance gates passed."
