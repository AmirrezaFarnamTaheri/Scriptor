# Seguridad y verificación de releases

[English](RELEASE-SECURITY.md) · [简体中文](RELEASE-SECURITY.zh-CN.md) · [Русский](RELEASE-SECURITY.ru.md) · [Deutsch](RELEASE-SECURITY.de.md) · **Español** · [فارسی](RELEASE-SECURITY.fa.md)

## Fuente de verdad de la versión

`VERSION` es canónico. `node scripts/release/version.mjs check` falla si un paquete npm, paquete Cargo, config Tauri, versión explícita de release o tag no coincide. Los branch refs que no sean tags no se interpretan como versiones. `node scripts/release/version.mjs sync` solo se usa en una branch revisada de cambio de versión; los lockfiles se regeneran y revisan antes del merge.

## Canales y ownership del release

- **Preview:** ejecución manual con `publish: false`. Deriva la versión del `VERSION` canónico checkout, sube workflow artifacts y nunca crea un GitHub Release.
- **Production:** tag inmutable `v<version>` cuyo valor coincide con `VERSION`. El workflow principal `Release` es el único autorizado a crear o modificar GitHub Releases.

Un cambio de `VERSION` fusionado en `main` inicia `Release Kickoff`. Valida la paridad de versión, crea el tag solo si no existe, rechaza mover o reutilizar un tag que apunte a otro commit y despacha el workflow de producción sobre ese tag. El dispatch explícito es necesario porque GitHub suprime la recursión normal de workflows para eventos creados con `GITHUB_TOKEN`.

## Modelo de confianza de artefactos oficiales

Los instaladores oficiales de Scriptor están deliberadamente **sin firma de editor**. El workflow de release no depende de certificado, notarización, clave privada ni signing secret. Windows y macOS pueden mostrar avisos de editor desconocido o desarrollador no identificado.

Matriz upstream soportada:

| Plataforma | Arquitectura | Tipos de instalador publicados |
|---|---|---|
| Windows | `x86_64` | MSI, NSIS EXE |
| macOS | `aarch64` | DMG |
| Linux | `x86_64` | DEB, AppImage |
| Linux | `aarch64` | DEB, AppImage |

Cada packaging job escribe un registro ligado a arquitectura llamado `signing-evidence-<platform>-<architecture>.json`. Los registros oficiales indican:

- `signed: false`;
- `notarized: false`;
- `signatureType: "none"`;
- source commit exacto;
- release channel, target platform y architecture;
- instrucción de verificación: checksum más GitHub attestation.

El publication job exige exactamente un registro por cada target soportado. Registros ausentes, duplicados, inesperados, de canal incorrecto o commit incorrecto bloquean la publicación.

Release receipt schema 4 incorpora la target matrix verificada junto con source identity, toolchain metadata, checksums y el conjunto exacto de installer subjects. Permite un production record unsigned, pero nunca trust status ausente o descrito falsamente.

## Frontera exacta de artefactos

Cada packaging job transporta únicamente los instaladores distribuibles y un architecture-bound trust-status record. Publication los separa en:

- `release-artifacts`: exactamente siete instaladores — un MSI, un NSIS EXE, un DMG, dos DEB y dos AppImage;
- `release-evidence`: exactamente cuatro registros JSON de trust status, más SBOM, archivo de checksums y receipt generados.

Contenido AppDir desempaquetado, internos `.app`, helper scripts DMG, logs CI, caches, source maps, material temporal de claves y archivos arbitrarios bajo `target/release/bundle` nunca son release subjects.

Publication descarga los archivos staged y no recompila. Después genera:

- `SHA256SUMS` solo para los siete installer subjects;
- SBOM CycloneDX 1.6 ligado a release version y source identity;
- release receipt schema 4 ligado al source con cuatro trust records normalizados;
- GitHub provenance y SBOM attestations para cada installer subject.

Los cuatro trust-status records se publican como metadata y se incorporan al receipt, pero no son installer subjects y no aparecen en `SHA256SUMS`.

## Controles de supply chain

- actions externas fijadas a full commit SHA revisados;
- runner labels fijos y versiones fijadas de Node, pnpm y Rust;
- instalación pnpm frozen y resolución Cargo locked;
- nombres de artifact específicos por arquitectura para evitar colisiones x86_64/aarch64;
- creación inmutable de tags con rechazo de retarget de una versión existente;
- comprobaciones exactas de cardinalidad installer/metadata antes de generar evidencia;
- verificación del exact subject set antes de subir el release;
- source identity de clean checkout ligada al release commit;
- diagnostics de packaging/publication retenidos pero no mezclados con release assets.

## Verificación por el usuario

Descargue un instalador junto con `SHA256SUMS`, `scriptor.cyclonedx.json` y `release-receipt.json` del mismo GitHub Release.

Verificar GitHub attestation:

```bash
gh attestation verify <installer> --repo AmirrezaFarnamTaheri/Scriptor
```

Checksum Linux de un instalador descargado:

```bash
artifact="scriptor-<version>-linux-x86_64.AppImage"
grep -F "  $artifact" SHA256SUMS | sha256sum --check -
```

Checksum macOS:

```bash
artifact="scriptor-<version>-macos-aarch64.dmg"
expected=$(awk -v name="$artifact" '$2 == name { print $1 }' SHA256SUMS)
actual=$(shasum -a 256 "$artifact" | awk '{ print $1 }')
test -n "$expected" && test "$actual" = "$expected"
```

Checksum Windows PowerShell:

```powershell
$artifact = 'scriptor-<version>-windows-x86_64-setup.exe'
$line = Get-Content .\SHA256SUMS | Where-Object { $_ -match "  $([regex]::Escape($artifact))$" }
if (-not $line) { throw 'Installer is not listed in SHA256SUMS.' }
$expected = ($line -split '\s+', 2)[0].ToLowerInvariant()
$actual = (Get-FileHash ".\$artifact" -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Checksum verification failed.' }
```

Los maintainers también pueden descargar los siete instaladores en `release-artifacts`, colocar los cuatro trust records y SBOM/checksum/receipt en `release-evidence`, hacer checkout del tag exacto y ejecutar:

```bash
node scripts/release/verify-signing-evidence.mjs release-evidence production
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```

Un checksum, SBOM, receipt, target-status record, source identity, exact-subject match o GitHub attestation ausente o inválido bloquea producción. No se afirma ninguna firma de editor del sistema operativo para los instaladores upstream oficiales.
