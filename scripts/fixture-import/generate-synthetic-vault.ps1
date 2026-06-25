param(
    [string]$Output = "packages/test-fixtures/vaults/synthetic-100",
    [int]$Count = 100,
    [string]$Prefix = "notes"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

cargo run -p scriptor-cli -- generate-vault $Output --count $Count --prefix $Prefix
