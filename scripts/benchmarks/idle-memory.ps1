# Measures peak working-set memory of a warm CLI system-info probe (idle proxy).
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '../..'
Set-Location $root

cargo build -q -p scriptor-cli
$exe = Join-Path $root 'target/debug/scriptor.exe'

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$process = Start-Process -FilePath $exe -ArgumentList @('system-info') -PassThru -NoNewWindow -Wait
$sw.Stop()
if ($process.ExitCode -ne 0) { exit $process.ExitCode }
$memoryMb = [math]::Round($process.PeakWorkingSet64 / 1MB, 2)
Write-Output (@{ benchmark = 'idle-memory'; peak_working_set_mb = $memoryMb; elapsed_ms = $sw.ElapsedMilliseconds } | ConvertTo-Json -Compress)
if ($memoryMb -gt 512) { exit 1 }
