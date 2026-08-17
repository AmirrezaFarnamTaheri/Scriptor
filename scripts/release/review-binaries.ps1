[CmdletBinding()]
param(
  [string]$Output = 'dist/release-review'
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '../..')
$outputPath = Join-Path $root $Output
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

$suffix = if ($IsWindows) { '.exe' } else { '' }
$targets = @(
  (Join-Path $root "target/release/scriptor-cli$suffix"),
  (Join-Path $root "target/release/scriptor-daemon$suffix")
)
$records = foreach ($target in $targets) {
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "Expected release binary is missing: $target"
  }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash.ToLowerInvariant()
  [ordered]@{
    name = Split-Path $target -Leaf
    path = [IO.Path]::GetRelativePath($root, $target).Replace('\\','/')
    sha256 = $hash
    bytes = (Get-Item -LiteralPath $target).Length
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  generatedAt = [DateTime]::UtcNow.ToString('o')
  sourceCommit = (git -C $root rev-parse HEAD).Trim()
  binaries = @($records)
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $outputPath 'binary-review.json')
Write-Host "Wrote binary review manifest to $outputPath"
