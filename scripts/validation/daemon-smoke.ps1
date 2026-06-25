param(
  [string]$Vault = "packages/test-fixtures/vaults/minimal"
)

$ErrorActionPreference = "Stop"
$socketDir = $null

$socketName = if ($IsWindows -or $env:OS -match "Windows") {
  "scriptor-smoke-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
} else {
  $socketDir = Join-Path $env:TEMP "scriptor-daemon-smoke-$([guid]::NewGuid().ToString())"
  New-Item -ItemType Directory -Path $socketDir | Out-Null
  Join-Path $socketDir "daemon.sock"
}

Write-Host "Starting scriptor-daemon on $socketName"
$daemon = Start-Process -FilePath "cargo" -ArgumentList @("run", "-p", "scriptor-daemon", "--", "serve", "--socket", $socketName) -PassThru -NoNewWindow

Start-Sleep -Seconds 4

try {
  Write-Host "Pinging daemon"
  cargo run -p scriptor-cli -- daemon ping

  Write-Host "Running TUI smoke via daemon against $Vault"
  cargo run -p scriptor-cli -- tui $Vault --smoke-test --via-daemon
}
finally {
  if (-not $daemon.HasExited) {
    Stop-Process -Id $daemon.Id -Force
  }
  if ($socketDir) {
    Remove-Item -Recurse -Force $socketDir -ErrorAction SilentlyContinue
  }
}
