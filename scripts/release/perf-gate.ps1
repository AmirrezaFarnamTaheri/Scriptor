param(
    [string]$Output = 'artifacts/performance/release-performance.json'
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '../..'
Set-Location $root
Write-Host '==> Performance gate: canonical baseline evaluator'
node scripts/benchmarks/check-baselines.mjs "--output=$Output"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Performance evidence written to $Output"
