function ConvertTo-NativeCommandLineArgument {
    <#
    .SYNOPSIS
    Quotes one native-process argument without changing its value.
    .DESCRIPTION
    Applies the CommandLineToArgvW-compatible escaping rules required by
    Rust/Clap on Windows while remaining valid for Start-Process elsewhere.
    #>
    param([AllowEmptyString()][string]$Value)

    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') {
        return $Value
    }

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    $backslashes = 0

    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq [char]92) {
            $backslashes++
            continue
        }

        if ($character -eq '"') {
            for ($index = 0; $index -lt (($backslashes * 2) + 1); $index++) {
                [void]$builder.Append([char]92)
            }
            [void]$builder.Append('"')
            $backslashes = 0
            continue
        }

        for ($index = 0; $index -lt $backslashes; $index++) {
            [void]$builder.Append([char]92)
        }
        $backslashes = 0
        [void]$builder.Append($character)
    }

    for ($index = 0; $index -lt ($backslashes * 2); $index++) {
        [void]$builder.Append([char]92)
    }
    [void]$builder.Append('"')
    $builder.ToString()
}

function Test-NativeWindowsPlatform {
    <# .SYNOPSIS Returns whether the current PowerShell host is running on Windows. #>
    return (
        $env:OS -eq 'Windows_NT' -or
        [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
    )
}

function Start-NativeProcessCapture {
    <#
    .SYNOPSIS
    Starts a native process with stdout and stderr redirected to files.
    .DESCRIPTION
    File redirection avoids pipe-drain deadlocks and lets timeout supervision
    remain independent from descendants that accidentally retain inherited
    output handles.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$StandardOutputPath,
        [Parameter(Mandatory = $true)][string]$StandardErrorPath
    )

    $resolvedFile = (Get-Command $FilePath -ErrorAction Stop).Source
    if (Test-NativeWindowsPlatform) {
        $candidates = Get-Command $FilePath -All -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.exe', '.cmd', '.bat' }
        if ($candidates) {
            $resolvedFile = $candidates[0].Source
        }
    }
    $argumentLine = ($Arguments | ForEach-Object {
        ConvertTo-NativeCommandLineArgument -Value ([string]$_)
    }) -join ' '
    $displayCommand = "$resolvedFile $argumentLine".Trim()

    $startParameters = @{
        FilePath               = $resolvedFile
        WorkingDirectory       = $WorkingDirectory
        RedirectStandardOutput = $StandardOutputPath
        RedirectStandardError  = $StandardErrorPath
        PassThru               = $true
        ErrorAction            = 'Stop'
    }
    if (-not [string]::IsNullOrWhiteSpace($argumentLine)) {
        $startParameters.ArgumentList = $argumentLine
    }
    if (Test-NativeWindowsPlatform) {
        $startParameters.NoNewWindow = $true
    }

    $process = Start-Process @startParameters
    # Retain the native handle before a short-lived process exits. Without
    # touching Handle, Start-Process can leave ExitCode unset on Windows even
    # after HasExited becomes true.
    $null = $process.Handle
    [pscustomobject]@{
        Process        = $process
        ResolvedFile   = $resolvedFile
        ArgumentLine   = $argumentLine
        DisplayCommand = $displayCommand
    }
}

function Stop-NativeProcessTree {
    <#
    .SYNOPSIS
    Terminates a native process and all descendants within a bounded grace period.
    .DESCRIPTION
    Uses Windows taskkill /T when available and .NET recursive termination on
    other platforms. It never performs an unbounded WaitForExit call.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process,
        [ValidateRange(1, 30)][int]$GraceSeconds = 5
    )

    try {
        $Process.Refresh()
        if ($Process.HasExited) {
            return
        }
    }
    catch {
        return
    }

    $killErrors = New-Object System.Collections.Generic.List[string]
    $terminated = $false
    if (Test-NativeWindowsPlatform) {
        $taskkill = Get-Command taskkill.exe -ErrorAction SilentlyContinue
        if ($taskkill) {
            try {
                & $taskkill.Source /PID $Process.Id /T /F 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $terminated = $true
                } else {
                    $killErrors.Add("taskkill exited with $LASTEXITCODE")
                }
            }
            catch {
                $killErrors.Add($_.Exception.Message)
            }
        }
    }

    if (-not $terminated) {
        try {
            $Process.Kill($true)
            $terminated = $true
        }
        catch {
            $killErrors.Add($_.Exception.Message)
            try {
                $Process.Kill()
                $terminated = $true
            }
            catch {
                $killErrors.Add($_.Exception.Message)
            }
        }
    }

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($GraceSeconds)
    do {
        Start-Sleep -Milliseconds 100
        try {
            $Process.Refresh()
            if ($Process.HasExited) {
                return
            }
        }
        catch {
            return
        }
    } while ([DateTimeOffset]::UtcNow -lt $deadline)

    # One final best-effort recursive kill closes races where a child appeared
    # between the first process-tree snapshot and termination.
    try { $Process.Kill($true) } catch { $killErrors.Add($_.Exception.Message) }
    try {
        $Process.Refresh()
        if (-not $Process.HasExited) {
            $detail = if ($killErrors.Count -gt 0) { ": $($killErrors -join '; ')" } else { '' }
            throw "process tree rooted at PID $($Process.Id) did not terminate within ${GraceSeconds}s$detail"
        }
    }
    catch [System.InvalidOperationException] {
        return
    }
}

function Read-NativeProcessCapture {
    <# .SYNOPSIS Reads a redirected native-process output file without failing cleanup. #>
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ''
    }
    try {
        return [string](Get-Content -LiteralPath $Path -Raw -ErrorAction Stop)
    }
    catch {
        return "<capture unavailable: $($_.Exception.Message)>"
    }
}

function Invoke-BoundedProcess {
    <#
    .SYNOPSIS
    Runs a native command with a hard whole-process-tree deadline.
    .DESCRIPTION
    Supervises a directly owned Process handle, emits heartbeats, redirects
    output to files to avoid pipe deadlocks, and recursively terminates the
    process tree when the deadline expires.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [ValidateRange(1, 3600)][int]$TimeoutSeconds = 180,
        [ValidateRange(5, 300)][int]$HeartbeatSeconds = 15,
        [string]$PhaseName,
        [switch]$SuppressStandardOutput,
        [switch]$SuppressStandardError
    )

    $captureRoot = Join-Path ([System.IO.Path]::GetTempPath()) "scriptor-process-$([guid]::NewGuid().ToString('N'))"
    $stdoutPath = Join-Path $captureRoot 'stdout.log'
    $stderrPath = Join-Path $captureRoot 'stderr.log'
    New-Item -ItemType Directory -Force -Path $captureRoot | Out-Null

    $processInfo = $null
    $process = $null
    $timedOut = $false
    $startedAt = [DateTimeOffset]::UtcNow
    $lastHeartbeat = $startedAt

    try {
        $captureParameters = @{
            FilePath           = $FilePath
            Arguments          = $Arguments
            WorkingDirectory   = $WorkingDirectory
            StandardOutputPath = $stdoutPath
            StandardErrorPath  = $stderrPath
        }
        $processInfo = Start-NativeProcessCapture @captureParameters
        $process = $processInfo.Process
        if ([string]::IsNullOrWhiteSpace($PhaseName)) {
            $PhaseName = [System.IO.Path]::GetFileName($processInfo.ResolvedFile)
        }

        Write-Host "::group::$PhaseName"
        Write-Host "command: $($processInfo.DisplayCommand)"
        Write-Host "working_directory: $WorkingDirectory"
        Write-Host "started_utc: $($startedAt.ToString('o'))"
        Write-Host "timeout_seconds: $TimeoutSeconds"
        Write-Host "pid: $($process.Id)"

        while ($true) {
            $process.Refresh()
            if ($process.HasExited) {
                # Start-Process can report HasExited before its asynchronous
                # bookkeeping has populated ExitCode. This bounded call returns
                # immediately for an exited process and completes that handoff.
                [void]$process.WaitForExit(5000)
                break
            }

            $now = [DateTimeOffset]::UtcNow
            $elapsed = $now - $startedAt
            if ($elapsed.TotalSeconds -ge $TimeoutSeconds) {
                $timedOut = $true
                Stop-NativeProcessTree -Process $process -GraceSeconds 5
                break
            }

            if (($now - $lastHeartbeat).TotalSeconds -ge $HeartbeatSeconds) {
                Write-Host "::notice title=$PhaseName heartbeat::pid=$($process.Id) elapsed=$([math]::Round($elapsed.TotalSeconds))s deadline=${TimeoutSeconds}s"
                $lastHeartbeat = $now
            }
            Start-Sleep -Milliseconds 250
        }

        $stdout = Read-NativeProcessCapture -Path $stdoutPath
        $stderr = Read-NativeProcessCapture -Path $stderrPath
        if ($stdout -and -not $SuppressStandardOutput) {
            Write-Host '--- stdout ---'
            Write-Host $stdout.TrimEnd()
        }
        if ($stderr -and -not $SuppressStandardError) {
            Write-Host '--- stderr ---'
            Write-Host $stderr.TrimEnd()
        }

        $finishedAt = [DateTimeOffset]::UtcNow
        $duration = $finishedAt - $startedAt
        Write-Host "finished_utc: $($finishedAt.ToString('o'))"
        Write-Host "duration_seconds: $([math]::Round($duration.TotalSeconds, 3))"

        if ($timedOut) {
            Write-Host 'exit_code: 124'
            throw (
                "process timed out after ${TimeoutSeconds}s: $($processInfo.DisplayCommand)" +
                "`nstdout:`n$stdout`nstderr:`n$stderr"
            )
        }

        $exitCode = $process.ExitCode
        Write-Host "exit_code: $exitCode"
        if ($exitCode -ne 0) {
            throw (
                "process failed with exit code ${exitCode}: $($processInfo.DisplayCommand)" +
                "`nstdout:`n$stdout`nstderr:`n$stderr"
            )
        }

        return $stdout
    }
    finally {
        if ($process) {
            try {
                $process.Refresh()
                if (-not $process.HasExited) {
                    Stop-NativeProcessTree -Process $process -GraceSeconds 5
                }
            }
            catch {
                Write-Warning $_.Exception.Message
            }
        }
        if ($process) {
            $process.Dispose()
        }
        Write-Host '::endgroup::'
        Remove-Item -LiteralPath $captureRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
