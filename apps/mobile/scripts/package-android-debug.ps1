param(
    [Parameter(Mandatory = $true)][string]$NativeLibrary,
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$AndroidHome = $env:ANDROID_HOME
)
$ErrorActionPreference = 'Stop'
if (-not $JavaHome -or -not $AndroidHome) { throw 'Provide JavaHome and AndroidHome for the installed toolchains.' }
$mobileRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$androidRoot = Join-Path $mobileRoot 'src-tauri/gen/android'
$localBuild = Join-Path $mobileRoot '.local-build'
$nativeSource = (Resolve-Path -LiteralPath $NativeLibrary).Path
if ([IO.Path]::GetFileName($nativeSource) -ne 'libscriptor_mobile_lib.so') { throw 'Expected the compiled ARM64 Scriptor mobile native library.' }
$nativeTarget = [IO.Path]::GetFullPath((Join-Path $androidRoot 'app/src/main/jniLibs/arm64-v8a/libscriptor_mobile_lib.so'))
if (-not $nativeTarget.StartsWith($mobileRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Native target must stay inside the mobile workspace.' }
New-Item -ItemType Directory -Path $localBuild, ([IO.Path]::GetDirectoryName($nativeTarget)) -Force | Out-Null
$debugStore = Join-Path $localBuild 'debug.keystore'
$keytool = Join-Path $JavaHome 'bin/keytool.exe'
if (-not (Test-Path -LiteralPath $debugStore)) {
    & $keytool -genkeypair -keystore $debugStore -storetype JKS -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Scriptor local debug,O=Scriptor,C=US' -noprompt
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the project debug signing key.' }
}
& $keytool -list -keystore $debugStore -storepass android -alias androiddebugkey | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Project debug signing key is invalid; inspect it before retrying.' }
Copy-Item -LiteralPath $nativeSource -Destination $nativeTarget -Force
$priorJava = $env:JAVA_HOME
$priorAndroid = $env:ANDROID_HOME
try {
    $env:JAVA_HOME = $JavaHome
    $env:ANDROID_HOME = $AndroidHome
    Push-Location -LiteralPath $androidRoot
    try {
        & ./gradlew.bat ':app:assembleArm64Debug' '-x' ':app:rustBuildArm64Debug' '--no-daemon' '--console=plain' '--max-workers=1' '-Dorg.gradle.jvmargs=-Xmx768m -XX:MaxMetaspaceSize=512m' '-Pkotlin.compiler.execution.strategy=in-process' "-Pscriptor.debugKeystore=$debugStore"
        if ($LASTEXITCODE -ne 0) { throw 'Android debug packaging failed.' }
    } finally { Pop-Location }
} finally {
    $env:JAVA_HOME = $priorJava
    $env:ANDROID_HOME = $priorAndroid
}
$apk = Join-Path $androidRoot 'app/build/outputs/apk/arm64/debug/app-arm64-debug.apk'
if (-not (Test-Path -LiteralPath $apk)) { throw 'Build finished without the expected ARM64 debug APK.' }
Write-Output $apk
