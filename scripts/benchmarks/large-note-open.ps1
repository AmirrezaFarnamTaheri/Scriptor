param(
    [int]$Lines = 12000,
    [int]$Iterations = 5
)

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot "../.."
Set-Location $root

$vault = "packages/test-fixtures/vaults/minimal"
$note = "Large Note.md"
$notePath = Join-Path $vault $note

if (-not (Test-Path $notePath)) {
    $body = "# Large Note`n`n" + ((1..$Lines | ForEach-Object { "Paragraph $_ with sample words for open benchmark." }) -join "`n`n")
    Set-Content -Path $notePath -Value $body -Encoding utf8
}

$times = @()
for ($index = 0; $index -lt $Iterations; $index++) {
    $elapsed = Measure-Command {
        cargo run -p scriptor-cli -- read $vault --note $note | Out-Null
    }
    $times += $elapsed.TotalMilliseconds
}

$average = ($times | Measure-Object -Average).Average
Write-Host (@{
    note = $note
    lines = $Lines
    iterations = $Iterations
    average_ms = [math]::Round($average, 2)
    max_ms = [math]::Round(($times | Measure-Object -Maximum).Maximum, 2)
} | ConvertTo-Json -Compress)
