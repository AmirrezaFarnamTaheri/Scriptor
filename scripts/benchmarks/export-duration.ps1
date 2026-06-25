# Proxy for export duration using CLI textbundle export on a fixture note.
$ErrorActionPreference = 'Stop'
$vault = 'packages/test-fixtures/vaults/minimal'
$note = 'Research Plan.md'
$out = Join-Path $env:TEMP "scriptor-export-bench.zip"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
cargo run -q -p scriptor-cli -- textbundle-export --vault $vault --note $note --output $out | Out-Null
$sw.Stop()
Write-Output (@{ benchmark = 'export-duration'; ms = $sw.ElapsedMilliseconds; output = $out } | ConvertTo-Json -Compress)
if ($sw.ElapsedMilliseconds -gt 10000) { exit 1 }
