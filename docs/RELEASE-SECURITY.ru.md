# Безопасность и проверка релиза

[English](RELEASE-SECURITY.md) · [简体中文](RELEASE-SECURITY.zh-CN.md) · **Русский** · [Deutsch](RELEASE-SECURITY.de.md) · [Español](RELEASE-SECURITY.es.md) · [فارسی](RELEASE-SECURITY.fa.md)

## Источник версии

`VERSION` является каноническим. `node scripts/release/version.mjs check` завершается ошибкой, если npm package, Cargo package, Tauri config, явно указанная release version или release tag не совпадает. Branch refs без tag не интерпретируются как версии. `node scripts/release/version.mjs sync` используется только в проверенной ветке изменения версии; lockfiles регенерируются и проверяются до merge.

## Каналы и владение релизом

- **Preview:** ручной запуск с `publish: false`. Версия берётся из canonical `VERSION` checkout; workflow artifacts загружаются, GitHub Release не создаётся.
- **Production:** неизменяемый tag `v<version>`, совпадающий с `VERSION`. Только основной workflow `Release` может создавать или изменять GitHub Release.

Изменение `VERSION`, смерженное в `main`, запускает `Release Kickoff`. Он проверяет parity версии, создаёт tag только если его нет, отказывается двигать или переиспользовать tag, указывающий на другой commit, и dispatch-ит production workflow на этом tag. Явный dispatch нужен потому, что GitHub подавляет обычную workflow recursion для событий, созданных через `GITHUB_TOKEN`.

## Модель доверия официальных артефактов

Официальные установщики Scriptor намеренно **не подписаны издателем**. Release workflow не зависит от сертификатов, notarization, private key или signing secret. Поэтому Windows/macOS могут показывать unknown-publisher или unidentified-developer предупреждения.

Поддерживаемая upstream target matrix:

| Платформа | Архитектура | Типы установщиков |
|---|---|---|
| Windows | `x86_64` | MSI, NSIS EXE |
| macOS | `aarch64` | DMG |
| Linux | `x86_64` | DEB, AppImage |
| Linux | `aarch64` | DEB, AppImage |

Каждый packaging job записывает одну architecture-bound запись `signing-evidence-<platform>-<architecture>.json`. Официальные записи содержат:

- `signed: false`;
- `notarized: false`;
- `signatureType: "none"`;
- точный source commit;
- release channel, target platform и architecture;
- инструкцию verifier: checksum + GitHub attestation.

Publication job требует ровно одну запись на каждый поддерживаемый target. Missing, duplicate, unexpected, wrong-channel и wrong-commit records блокируют публикацию.

Release receipt schema 4 включает проверенную target matrix вместе с source identity, toolchain metadata, checksums и точным installer subject set. Unsigned production record допустим, отсутствующий или ложно описанный trust status — нет.

## Точная граница artifact

Каждый packaging job переносит только распространяемые installers и одну architecture-bound trust-status запись. Publication разделяет их на:

- `release-artifacts`: ровно семь installer files — MSI, NSIS EXE, DMG, два DEB и два AppImage;
- `release-evidence`: ровно четыре trust-status JSON records, затем генерируемые SBOM, checksum file и receipt.

Распакованные AppDir contents, внутренности `.app`, DMG helper scripts, CI logs, caches, source maps, временный key material и произвольные файлы из `target/release/bundle` никогда не являются release subjects.

Publication скачивает staged files и не rebuild-ит. Затем создаются:

- `SHA256SUMS` только для семи installer subjects;
- CycloneDX 1.6 SBOM, связанный с release version и source identity;
- source-bound release receipt schema 4 с четырьмя normalized trust records;
- GitHub provenance и SBOM attestations для каждого installer subject.

Четыре trust-status records публикуются как metadata и включаются в receipt, но не являются installer subjects и потому не входят в `SHA256SUMS`.

## Supply-chain controls

- External actions закреплены на проверенных full commit SHA;
- фиксированные runner labels и pinned Node, pnpm, Rust;
- frozen pnpm install и locked Cargo resolution;
- architecture-specific artifact names предотвращают x86_64/aarch64 collisions;
- immutable tag creation с запретом retarget существующей версии;
- точные проверки cardinality installer/metadata до генерации evidence;
- exact subject-set verification до release upload;
- source identity clean checkout связан с release commit;
- сохранённые diagnostics packaging/publication не смешиваются с release assets.

## Проверка пользователем

Скачайте один installer и `SHA256SUMS`, `scriptor.cyclonedx.json`, `release-receipt.json` из одного GitHub Release.

Проверка GitHub attestation:

```bash
gh attestation verify <installer> --repo AmirrezaFarnamTaheri/Scriptor
```

Linux checksum для одного installer:

```bash
artifact="scriptor-<version>-linux-x86_64.AppImage"
grep -F "  $artifact" SHA256SUMS | sha256sum --check -
```

macOS checksum:

```bash
artifact="scriptor-<version>-macos-aarch64.dmg"
expected=$(awk -v name="$artifact" '$2 == name { print $1 }' SHA256SUMS)
actual=$(shasum -a 256 "$artifact" | awk '{ print $1 }')
test -n "$expected" && test "$actual" = "$expected"
```

Windows PowerShell checksum:

```powershell
$artifact = 'scriptor-<version>-windows-x86_64-setup.exe'
$line = Get-Content .\SHA256SUMS | Where-Object { $_ -match "  $([regex]::Escape($artifact))$" }
if (-not $line) { throw 'Installer is not listed in SHA256SUMS.' }
$expected = ($line -split '\s+', 2)[0].ToLowerInvariant()
$actual = (Get-FileHash ".\$artifact" -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Checksum verification failed.' }
```

Maintainer может дополнительно скачать все семь installers в `release-artifacts`, поместить четыре trust records и SBOM/checksum/receipt в `release-evidence`, checkout-нуть точный tag и выполнить:

```bash
node scripts/release/verify-signing-evidence.mjs release-evidence production
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```

Любой отсутствующий/невалидный checksum, SBOM, receipt, target-status record, source identity, exact-subject match или GitHub attestation блокирует production release. Для официальных upstream installers не заявляется OS publisher signature.
