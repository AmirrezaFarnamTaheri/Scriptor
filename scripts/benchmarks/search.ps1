param(
    [string]$VaultPath = "packages/test-fixtures/vaults/minimal",
    [string]$Query = "Research",
    [int]$Iterations = 10
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

cargo run -p scriptor-cli -- bench-search $VaultPath $Query --iterations $Iterations
