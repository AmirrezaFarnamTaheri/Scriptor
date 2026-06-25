param(
    [string]$VaultPath = "packages/test-fixtures/vaults/minimal",
    [string]$Note = "Research Plan.md"
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

function Invoke-ScriptorCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & cargo run -p scriptor-cli -- @Args
    if ($LASTEXITCODE -ne 0) {
        throw "scriptor-cli failed: $($Args -join ' ')"
    }
}

$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if (-not $pandoc) {
    Write-Warning "Pandoc not on PATH; running HTML dry-run only."
    Invoke-ScriptorCli export $VaultPath --note $Note --format html --dry-run | Out-Null
    Write-Host "Export smoke (dry-run only) passed."
    exit 0
}

foreach ($format in @('html', 'docx', 'pdf')) {
    Write-Host "==> Export $format"
    $json = Invoke-ScriptorCli export $VaultPath --note $Note --format $format | Out-String
    $artifact = ($json | ConvertFrom-Json).artifact_path
    if (-not (Test-Path $artifact)) {
        throw "Expected artifact missing: $artifact"
    }
    if ((Get-Item $artifact).Length -le 0) {
        throw "Artifact is empty: $artifact"
    }
}

Write-Host "Export smoke (html/docx/pdf) passed."
