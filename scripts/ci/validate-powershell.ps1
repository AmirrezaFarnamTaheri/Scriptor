[CmdletBinding()]
param(
    [string]$Root = "scripts"
)

$ErrorActionPreference = "Stop"
$rootPath = (Resolve-Path -LiteralPath $Root).Path
$files = @(Get-ChildItem -LiteralPath $rootPath -Recurse -File -Filter "*.ps1" | Sort-Object FullName)
$failureCount = 0

Write-Host "::group::PowerShell parser validation"
Write-Host "Root: $rootPath"
Write-Host "Files: $($files.Count)"

foreach ($file in $files) {
    $tokens = $null
    $parseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $file.FullName,
        [ref]$tokens,
        [ref]$parseErrors
    )

    if ($parseErrors.Count -eq 0) {
        Write-Host "PASS $($file.FullName)"
        continue
    }

    foreach ($parseError in $parseErrors) {
        $failureCount++
        $line = $parseError.Extent.StartLineNumber
        $column = $parseError.Extent.StartColumnNumber
        $message = $parseError.Message -replace '%', '%25' -replace "`r", '%0D' -replace "`n", '%0A'
        Write-Host "::error file=$($file.FullName),line=$line,col=$column,title=PowerShell parse error::$message"
        Write-Host "FAIL $($file.FullName):${line}:${column} $($parseError.Message)"
    }
}

Write-Host "::endgroup::"
if ($failureCount -gt 0) {
    throw "$failureCount PowerShell parser error(s) found across $($files.Count) files."
}

Write-Host "PowerShell parser validation passed for $($files.Count) files."
