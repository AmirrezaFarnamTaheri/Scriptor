param(
  [string]$BundleRoot = "target/release/bundle"
)

$ErrorActionPreference = "Stop"

$channel = if ([string]::IsNullOrWhiteSpace($env:SCRIPTOR_RELEASE_CHANNEL)) { 'preview' } else { $env:SCRIPTOR_RELEASE_CHANNEL }

if ([string]::IsNullOrWhiteSpace($env:WINDOWS_CERTIFICATE)) {
  if ($channel -eq 'production') {
    Write-Error 'WINDOWS_CERTIFICATE is required for production releases.'
  }
  Write-Host 'WINDOWS_CERTIFICATE not set; preview artifact will remain unsigned.'
  exit 0
}

$password = $env:WINDOWS_CERTIFICATE_PASSWORD
if ([string]::IsNullOrWhiteSpace($password)) {
  Write-Error 'WINDOWS_CERTIFICATE_PASSWORD is required when WINDOWS_CERTIFICATE is set.'
}

$certPath = Join-Path $env:RUNNER_TEMP 'scriptor-sign.pfx'
[System.IO.File]::WriteAllBytes($certPath, [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE))

$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) {
  $sdkBin = Get-ChildItem -Path "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($sdkBin) {
    $signtool = $sdkBin.FullName
  }
}

if (-not $signtool) {
  Write-Error 'signtool.exe not found. Install the Windows SDK or add signtool to PATH.'
}

$artifacts = @(
  Get-ChildItem -Path (Join-Path $BundleRoot 'msi\*.msi') -ErrorAction SilentlyContinue
  Get-ChildItem -Path (Join-Path $BundleRoot 'nsis\*.exe') -ErrorAction SilentlyContinue
) | Where-Object { $_ -ne $null }

if ($artifacts.Count -eq 0) {
  Write-Error "No installer artifacts found under $BundleRoot"
}

foreach ($artifact in $artifacts) {
  Write-Host "Signing $($artifact.FullName)"
  & $signtool sign /f $certPath /p $password /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $artifact.FullName
  if ($LASTEXITCODE -ne 0) {
    Write-Error "signtool failed for $($artifact.FullName)"
  }
  & $signtool verify /pa $artifact.FullName
  if ($LASTEXITCODE -ne 0) {
    Write-Error "signature verification failed for $($artifact.FullName)"
  }
}

Write-Host ('Signed {0} installer artifacts.' -f $artifacts.Count)
