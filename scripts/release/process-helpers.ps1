function ConvertTo-NativeCommandLineArgument {
    param([AllowEmptyString()][string]$Value)

    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') {
        return $Value
    }

    # Follow the CommandLineToArgvW quoting rules used by Rust/Clap on Windows:
    # quote whitespace-bearing arguments, double backslashes before a quote,
    # and double trailing backslashes before the closing quote.
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

function Invoke-BoundedProcess {
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

    $resolvedFile = (Get-Command $FilePath -ErrorAction Stop).Source
    $argumentLine = ($Arguments | ForEach-Object {
        ConvertTo-NativeCommandLineArgument -Value ([string]$_)
    }) -join ' '
    $displayCommand = "$resolvedFile $argumentLine".Trim()
    if ([string]::IsNullOrWhiteSpace($PhaseName)) {
        $PhaseName = [System.IO.Path]::GetFileName($resolvedFile)
    }

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $resolvedFile
    $startInfo.Arguments = $argumentLine
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    $startedAt = [DateTimeOffset]::UtcNow
    $lastHeartbeat = $startedAt

    Write-Host "::group::$PhaseName"
    Write-Host "command: $displayCommand"
    Write-Host "working_directory: $WorkingDirectory"
    Write-Host "started_utc: $($startedAt.ToString('o'))"
    Write-Host "timeout_seconds: $TimeoutSeconds"

    try {
        if (-not $process.Start()) {
            throw "failed to start process: $displayCommand"
        }
        Write-Host "pid: $($process.Id)"

        # Consume both pipes asynchronously so a verbose child cannot deadlock
        # while the parent polls for a bounded completion time.
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()

        while (-not $process.WaitForExit(500)) {
            $now = [DateTimeOffset]::UtcNow
            $elapsed = $now - $startedAt
            if ($elapsed.TotalSeconds -ge $TimeoutSeconds) {
                try { $process.Kill($true) } catch { try { $process.Kill() } catch { } }
                try { $process.WaitForExit() } catch { }
                $stdout = $stdoutTask.Result
                $stderr = $stderrTask.Result
                if ($stdout -and -not $SuppressStandardOutput) {
                    Write-Host $stdout.TrimEnd()
                }
                if ($stderr -and -not $SuppressStandardError) {
                    Write-Host $stderr.TrimEnd()
                }
                throw (
                    "process timed out after ${TimeoutSeconds}s: $displayCommand" +
                    "`nstdout:`n$stdout`nstderr:`n$stderr"
                )
            }

            if (($now - $lastHeartbeat).TotalSeconds -ge $HeartbeatSeconds) {
                Write-Host "::notice title=$PhaseName heartbeat::pid=$($process.Id) elapsed=$([math]::Round($elapsed.TotalSeconds))s deadline=${TimeoutSeconds}s"
                $lastHeartbeat = $now
            }
        }

        # The parameterless call closes the asynchronous stream-drain race before
        # reading task results.
        $process.WaitForExit()
        $stdout = $stdoutTask.Result
        $stderr = $stderrTask.Result
        $finishedAt = [DateTimeOffset]::UtcNow
        $duration = $finishedAt - $startedAt

        if ($stdout -and -not $SuppressStandardOutput) {
            Write-Host "--- stdout ---"
            Write-Host $stdout.TrimEnd()
        }
        if ($stderr -and -not $SuppressStandardError) {
            Write-Host "--- stderr ---"
            Write-Host $stderr.TrimEnd()
        }
        Write-Host "finished_utc: $($finishedAt.ToString('o'))"
        Write-Host "duration_seconds: $([math]::Round($duration.TotalSeconds, 3))"
        Write-Host "exit_code: $($process.ExitCode)"

        if ($process.ExitCode -ne 0) {
            throw (
                "process failed with exit code $($process.ExitCode): $displayCommand" +
                "`nstdout:`n$stdout`nstderr:`n$stderr"
            )
        }

        return $stdout
    }
    finally {
        Write-Host "::endgroup::"
        $process.Dispose()
    }
}
