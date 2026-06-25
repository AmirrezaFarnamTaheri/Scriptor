param(
    [string]$Fixture = "packages/test-fixtures/canvas/overlap-blocks.json",
    [int]$Iterations = 120
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

cargo run -p scriptor-cli -- bench-canvas-hit-test $Fixture --iterations $Iterations
