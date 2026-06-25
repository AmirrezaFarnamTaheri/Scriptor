param(
    [string]$VaultPath = "packages/test-fixtures/vaults/minimal",
    [int]$Iterations = 5
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

cargo run -p scriptor-cli -- bench-scan $VaultPath --iterations $Iterations
