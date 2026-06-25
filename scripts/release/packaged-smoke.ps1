# Post-package validation: confirm bundle artifacts exist and CLI workflow still passes.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '../..'
Set-Location $root

Write-Host '==> CLI packaged workflow smoke'
& (Join-Path $PSScriptRoot 'smoke.ps1')

$bundleRoot = Join-Path $root 'target/release/bundle'
if (Test-Path $bundleRoot) {
  $installers = Get-ChildItem -Path $bundleRoot -Recurse -Include *.msi, *.exe -ErrorAction SilentlyContinue
  if ($installers.Count -eq 0) {
    Write-Warning 'No installer artifacts found under bundle/. Run release:package without -SkipTauri first.'
  } else {
    Write-Host "Found $($installers.Count) installer artifact(s)."
  }
} else {
  Write-Warning 'Bundle directory missing. Desktop packaging step was skipped or not run yet.'
}

Write-Host 'Packaged smoke checks complete.'
