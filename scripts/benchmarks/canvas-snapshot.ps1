param(
    [int]$Iterations = 20
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

cargo run -p scriptor-cli -- bench-canvas-snapshot packages/test-fixtures/canvas/overlap-blocks.json --iterations $Iterations
