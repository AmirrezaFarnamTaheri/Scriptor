# Measures warm CLI startup latency after a one-time build.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '../..'
Set-Location $root

cargo build --release -q -p scriptor-cli
$exe = if ($IsWindows -or $env:OS -eq 'Windows_NT') {
    Join-Path $root 'target/release/scriptor.exe'
} else {
    Join-Path $root 'target/release/scriptor'
}

$iterations = 5
$times = @()
for ($i = 0; $i -lt $iterations; $i++) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  & $exe system-info | Out-Null
  $sw.Stop()
  $times += $sw.ElapsedMilliseconds
}
$warm = $times | Select-Object -Skip 1
$mean = ($warm | Measure-Object -Average).Average
Write-Output (@{ benchmark = 'startup'; mean_ms = [math]::Round($mean, 2); samples = $times } | ConvertTo-Json -Compress)
if ($mean -gt 3000) { exit 1 }
