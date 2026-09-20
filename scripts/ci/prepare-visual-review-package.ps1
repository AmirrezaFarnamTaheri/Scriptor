[CmdletBinding()]
param(
    [string]$PackageRoot = "artifacts/visual-review-package",
    [string]$EvidenceRoot = $env:CI_LOG_DIR
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))

function Resolve-RepoPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $repoRoot $Path))
}

$packagePath = Resolve-RepoPath -Path $PackageRoot
$imagesPath = Join-Path $packagePath 'images'
$evidencePath = Join-Path $packagePath 'evidence'

if (Test-Path -LiteralPath $packagePath) {
    Remove-Item -LiteralPath $packagePath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $imagesPath | Out-Null
New-Item -ItemType Directory -Force -Path $evidencePath | Out-Null

$imageExtensions = @('.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif')
$manifest = [System.Collections.Generic.List[object]]::new()
$seenHashes = @{}
$sourceImageCount = 0

function Add-VisualImages {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$Prefix
    )

    $sourcePath = Resolve-RepoPath -Path $SourceRoot
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        Write-Host "Visual source absent: $SourceRoot"
        return
    }

    $resolvedSource = (Resolve-Path -LiteralPath $sourcePath).Path
    foreach ($file in Get-ChildItem -LiteralPath $resolvedSource -Recurse -File | Sort-Object FullName) {
        if ($imageExtensions -notcontains $file.Extension.ToLowerInvariant()) {
            continue
        }

        $relative = [System.IO.Path]::GetRelativePath($resolvedSource, $file.FullName)
        $source = "$SourceRoot/$($relative -replace '\\', '/')"
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        $script:sourceImageCount += 1

        if ($script:seenHashes.ContainsKey($hash)) {
            $index = [int]$script:seenHashes[$hash]
            $entry = $script:manifest[$index]
            $entry.sources = @($entry.sources) + $source
            continue
        }

        $safeRelative = ($relative -replace '[\\/]+', '--') -replace '[^A-Za-z0-9._-]+', '-'
        $destinationName = "$Prefix--$safeRelative"
        $destinationPath = Join-Path $imagesPath $destinationName

        if (Test-Path -LiteralPath $destinationPath) {
            $stem = [System.IO.Path]::GetFileNameWithoutExtension($destinationName)
            $destinationName = "$stem--$($hash.Substring(0, 10))$($file.Extension.ToLowerInvariant())"
            $destinationPath = Join-Path $imagesPath $destinationName
        }

        Copy-Item -LiteralPath $file.FullName -Destination $destinationPath -Force
        $entry = [pscustomobject]@{
            file = "images/$destinationName"
            source = $source
            sources = @($source)
            sha256 = $hash
            bytes = $file.Length
        }
        $script:seenHashes[$hash] = $script:manifest.Count
        $script:manifest.Add($entry)
    }
}

# Keep every visual source current, but publish all image bytes through one flat
# directory. Prefixes retain provenance without reintroducing parallel trees.
Add-VisualImages -SourceRoot 'test-results/visual' -Prefix 'comparison'
Add-VisualImages -SourceRoot 'e2e/screenshots.spec.ts-snapshots' -Prefix 'baseline-screenshots'
Add-VisualImages -SourceRoot 'docs/assets/screenshots' -Prefix 'capture'
Add-VisualImages -SourceRoot 'artifacts/screenshots-before' -Prefix 'before'

if (-not [string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $resolvedEvidence = Resolve-RepoPath -Path $EvidenceRoot
    if (Test-Path -LiteralPath $resolvedEvidence) {
        foreach ($file in Get-ChildItem -LiteralPath $resolvedEvidence -Recurse -File | Sort-Object FullName) {
            if ($imageExtensions -contains $file.Extension.ToLowerInvariant()) {
                continue
            }
            $relative = [System.IO.Path]::GetRelativePath($resolvedEvidence, $file.FullName)
            $destination = Join-Path $evidencePath $relative
            $destinationDirectory = Split-Path -Parent $destination
            New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        }
    }
}

$manifestPayload = [ordered]@{
    schemaVersion = 2
    generatedUtc = [DateTimeOffset]::UtcNow.ToString('o')
    imageDirectory = 'images'
    imageCount = $manifest.Count
    sourceImageCount = $sourceImageCount
    deduplicatedSourceCount = $sourceImageCount - $manifest.Count
    images = $manifest
}
$manifestPayload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $packagePath 'image-manifest.json') -Encoding utf8

if ($manifest.Count -eq 0) {
    throw 'Visual review package contains no images.'
}

Write-Host "Prepared unified visual review package: $packagePath"
Write-Host "Images (unique): $($manifest.Count)"
Write-Host "Image sources: $sourceImageCount"
Write-Host "Duplicate image sources removed: $($sourceImageCount - $manifest.Count)"
