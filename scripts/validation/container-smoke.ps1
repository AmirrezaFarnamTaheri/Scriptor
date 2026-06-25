param(
  [string]$Tag = "scriptor-ci"
)

$ErrorActionPreference = "Stop"

Write-Host "Building container image $Tag"
docker build -t $Tag .

Write-Host "Running container smoke"
docker run --rm $Tag
