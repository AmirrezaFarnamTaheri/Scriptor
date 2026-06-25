param(
    [int]$Iterations = 200
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

node --experimental-strip-types packages/editor/src/bench-latency.ts --iterations $Iterations
