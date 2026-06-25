# Measures warm CLI startup latency after a one-time build.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '../..'
Set-Location $root

cargo build -q -p scriptor-cli
cargo build -q -p scriptor-cli
$exe = Join-Path $root 'target/debug/scriptor.exe'

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
if ($mean -gt 1500) { exit 1 }
