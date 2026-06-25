param(
    [ValidateSet('100', '1k', '5k', '25k')]
    [string]$Size = '1k',
    [ValidateSet('scan', 'search')]
    [string]$Mode = 'scan',
    [int]$Iterations = 3,
    [string]$Query = 'note'
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "../..")

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
    cargo run -p scriptor-cli -- bench-scan $vault --iterations $Iterations
} else {
    cargo run -p scriptor-cli -- rebuild-index $vault | Out-Null
    cargo run -p scriptor-cli -- bench-search $vault $Query --iterations $Iterations
}
