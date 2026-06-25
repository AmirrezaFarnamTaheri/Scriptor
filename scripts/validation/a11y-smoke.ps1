# Lightweight accessibility smoke: verifies core shell landmarks exist in built HTML.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '../..'
Set-Location $root

if (-not (Test-Path (Join-Path $root 'dist/index.html'))) {
  Write-Host 'Building frontend for a11y smoke...'
  pnpm build | Out-Null
}

$failures = @()

$html = Get-Content (Join-Path $root 'dist/index.html') -Raw
$htmlChecks = @(
  @{ name = 'root mount'; pattern = 'id="root"' },
  @{ name = 'document title'; pattern = '<title>' }
)
foreach ($check in $htmlChecks) {
  if ($html -notmatch $check.pattern) {
    $failures += $check.name
  }
}

$cssPath = Join-Path $root 'src/index.css'
if (Test-Path $cssPath) {
  $css = Get-Content $cssPath -Raw
  foreach ($token in @('--focus-ring', '--focus-outline')) {
    if ($css -notmatch [regex]::Escape($token)) {
      $failures += "focus token $token"
    }
  }
} else {
  $failures += 'index.css'
}

$appPath = Join-Path $root 'src/App.tsx'
if (Test-Path $appPath) {
  $appSource = Get-Content $appPath -Raw
  if ($appSource -notmatch 'BRAND_WORKSPACE_LABEL') {
    $failures += 'workspace landmark'
  }
  if ($appSource -notmatch 'role="status"') {
    $failures += 'live status region'
  }
} else {
  $failures += 'App.tsx'
}

if ($failures.Count -gt 0) {
  Write-Error ("A11y smoke failed: missing " + ($failures -join ', '))
}

Write-Host 'A11y smoke passed (static shell checks). See docs/validation/ACCESSIBILITY_AUDIT.md for manual sign-off.'
