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
        [switch]$SuppressStandardError
    )

    $resolvedFile = (Get-Command $FilePath -ErrorAction Stop).Source
    $argumentLine = ($Arguments | ForEach-Object {
        ConvertTo-NativeCommandLineArgument -Value ([string]$_)
    }) -join ' '

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

    try {
        if (-not $process.Start()) {
            throw "failed to start process: $resolvedFile $argumentLine"
        }

        # Consume both pipes asynchronously so a verbose child cannot deadlock
        # while the parent is waiting for it to exit.
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()

        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            try { $process.Kill() } catch { }
            try { $process.WaitForExit() } catch { }
            $stdout = $stdoutTask.Result
            $stderr = $stderrTask.Result
            throw (
                "process timed out after ${TimeoutSeconds}s: $resolvedFile $argumentLine" +
                "`nstdout:`n$stdout`nstderr:`n$stderr"
            )
        }

        # WaitForExit(milliseconds) can return before asynchronous stream events
        # are fully drained on .NET Framework; the parameterless call closes that
        # race before reading task results.
        $process.WaitForExit()
        $stdout = $stdoutTask.Result
        $stderr = $stderrTask.Result

        if ($stderr -and -not $SuppressStandardError) {
            Write-Host $stderr.TrimEnd()
        }
        if ($process.ExitCode -ne 0) {
            throw (
                "process failed with exit code $($process.ExitCode): $resolvedFile $argumentLine" +
                "`nstdout:`n$stdout`nstderr:`n$stderr"
            )
        }

        return $stdout
    }
    finally {
        $process.Dispose()
    }
}
