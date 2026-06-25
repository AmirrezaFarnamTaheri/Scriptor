param(
  [string]$Vault = "packages/test-fixtures/vaults/minimal"
)

$ErrorActionPreference = "Stop"

Write-Host "Running Scriptor TUI smoke against $Vault"
cargo run -p scriptor-cli -- tui $Vault --smoke-test
