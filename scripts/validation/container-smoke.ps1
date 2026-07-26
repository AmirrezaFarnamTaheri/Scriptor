param(
  [string]$Tag = "scriptor-ci"
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $File $Arguments"
    }
}

Write-Host "Building container image $Tag"
Invoke-Checked docker @("build", "-t", $Tag, ".")

Write-Host "Running container smoke"
Invoke-Checked docker @("run", "--rm", $Tag)
