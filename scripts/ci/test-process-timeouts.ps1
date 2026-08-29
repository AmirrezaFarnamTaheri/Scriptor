[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
. (Join-Path $PSScriptRoot '../release/process-helpers.ps1')
$pwsh = (Get-Command pwsh -ErrorAction Stop).Source
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "scriptor-timeout-tests-$([guid]::NewGuid().ToString('N'))"
$probeTimeoutSeconds = 5
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

function New-TreeProbeCommand {
    <# .SYNOPSIS Creates an encoded command that records and waits on a grandchild. #>
    param([Parameter(Mandatory = $true)][string]$PidPath)

    $escapedPidPath = $PidPath.Replace("'", "''")
    $script = @"
`$child = Start-Process -FilePath '$($pwsh.Replace("'", "''"))' -ArgumentList @('-NoProfile', '-Command', 'Start-Sleep -Seconds 60') -PassThru
Set-Content -LiteralPath '$escapedPidPath' -Value `$child.Id -Encoding ascii
Start-Sleep -Seconds 60
"@
    [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
}

function Assert-ProcessAbsent {
    <# .SYNOPSIS Verifies that a recorded process-tree descendant was terminated. #>
    param([Parameter(Mandatory = $true)][string]$PidPath)

    for ($attempt = 0; $attempt -lt 40 -and -not (Test-Path -LiteralPath $PidPath); $attempt++) {
        Start-Sleep -Milliseconds 100
    }
    if (-not (Test-Path -LiteralPath $PidPath)) {
        throw "timeout probe did not record its grandchild PID: $PidPath"
    }
    $pidValue = [int](Get-Content -LiteralPath $PidPath -Raw)
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        if (-not (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)) {
            return
        }
        Start-Sleep -Milliseconds 100
    }
    throw "timeout enforcement left descendant PID $pidValue running"
}

try {
    Write-Host '==> Verify Invoke-BoundedProcess deadline and recursive cleanup'
    $boundedPidPath = Join-Path $tempRoot 'bounded-grandchild.pid'
    $boundedEncoded = New-TreeProbeCommand -PidPath $boundedPidPath
    $stopwatch = [Diagnostics.Stopwatch]::StartNew()
    $didTimeout = $false
    try {
        Invoke-BoundedProcess -FilePath $pwsh -Arguments @(
            '-NoProfile', '-EncodedCommand', $boundedEncoded
        ) -WorkingDirectory $root -TimeoutSeconds $probeTimeoutSeconds -HeartbeatSeconds 5 | Out-Null
    }
    catch {
        if ($_.Exception.Message -notmatch 'timed out') {
            throw
        }
        $didTimeout = $true
    }
    $stopwatch.Stop()
    if (-not $didTimeout) {
        throw 'Invoke-BoundedProcess did not enforce its timeout'
    }
    if ($stopwatch.Elapsed.TotalSeconds -gt 15) {
        throw "Invoke-BoundedProcess timeout took $([math]::Round($stopwatch.Elapsed.TotalSeconds, 2))s"
    }
    Assert-ProcessAbsent -PidPath $boundedPidPath

    Write-Host '==> Verify invoke-logged deadline and recursive cleanup'
    $loggedPidPath = Join-Path $tempRoot 'logged-grandchild.pid'
    $loggedEncoded = New-TreeProbeCommand -PidPath $loggedPidPath
    $logDirectory = Join-Path $tempRoot 'logs'
    $stopwatch.Restart()
    $invokeLoggedPath = (Join-Path $PSScriptRoot 'invoke-logged.ps1').Replace("'", "''")
    $escapedPwsh = $pwsh.Replace("'", "''")
    $escapedRoot = $root.Replace("'", "''")
    $escapedLogDirectory = $logDirectory.Replace("'", "''")
    $loggedDriver = @"
& '$invokeLoggedPath' -Name 'Timeout process-tree probe' -FilePath '$escapedPwsh' -ArgumentList @('-NoProfile', '-EncodedCommand', '$loggedEncoded') -WorkingDirectory '$escapedRoot' -LogDirectory '$escapedLogDirectory' -TimeoutSeconds $probeTimeoutSeconds -HeartbeatSeconds 5
exit `$LASTEXITCODE
"@
    $loggedDriverEncoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($loggedDriver))
    & $pwsh -NoProfile -EncodedCommand $loggedDriverEncoded
    $loggedExit = $LASTEXITCODE
    $stopwatch.Stop()
    if ($loggedExit -ne 124) {
        throw "invoke-logged timeout probe returned $loggedExit instead of 124"
    }
    if ($stopwatch.Elapsed.TotalSeconds -gt 15) {
        throw "invoke-logged timeout took $([math]::Round($stopwatch.Elapsed.TotalSeconds, 2))s"
    }
    Assert-ProcessAbsent -PidPath $loggedPidPath

    Write-Host 'Process timeout enforcement passed.'
}
finally {
    foreach ($pidPath in @($boundedPidPath, $loggedPidPath)) {
        if ($pidPath -and (Test-Path -LiteralPath $pidPath -PathType Leaf)) {
            try {
                $pidValue = [int](Get-Content -LiteralPath $pidPath -Raw)
                Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
            }
            catch { }
        }
    }
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
