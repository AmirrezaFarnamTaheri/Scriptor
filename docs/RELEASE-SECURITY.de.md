# Release-Sicherheit und Verifikation

[English](RELEASE-SECURITY.md) · [简体中文](RELEASE-SECURITY.zh-CN.md) · [Русский](RELEASE-SECURITY.ru.md) · **Deutsch** · [Español](RELEASE-SECURITY.es.md) · [فارسی](RELEASE-SECURITY.fa.md)

## Quelle der Versionswahrheit

`VERSION` ist kanonisch. `node scripts/release/version.mjs check` schlägt fehl, wenn npm-Paket, Cargo-Paket, Tauri-Konfiguration, explizite Release-Version oder Release-Tag abweichen. Branch-Refs ohne Tag werden nicht als Versionen interpretiert. `node scripts/release/version.mjs sync` wird nur in einem geprüften Version-Change-Branch verwendet; Lockfiles werden vor Merge neu erzeugt und geprüft.

## Kanäle und Release-Ownership

- **Preview:** manueller Lauf mit `publish: false`. Die Version wird aus dem ausgecheckten kanonischen `VERSION` abgeleitet; Workflow-Artefakte werden hochgeladen, ein GitHub Release wird nie erzeugt.
- **Production:** unveränderliches `v<version>`-Tag, dessen Wert `VERSION` entspricht. Nur der primäre `Release`-Workflow darf GitHub Releases erzeugen oder ändern.

Eine in `main` gemergte `VERSION`-Änderung startet `Release Kickoff`. Dieser prüft Versionsparität, erzeugt das Tag nur, wenn es noch nicht existiert, weigert sich ein Tag zu verschieben oder wiederzuverwenden, das auf einen anderen Commit zeigt, und dispatcht den Production-Workflow auf diesem Tag. Der explizite Dispatch ist nötig, weil GitHub normale Workflow-Rekursion für Ereignisse unterdrückt, die mit `GITHUB_TOKEN` erzeugt wurden.

## Vertrauensmodell offizieller Artefakte

Offizielle Scriptor-Installer sind bewusst **unsigniert**. Der Release-Workflow hängt nicht von Zertifikat, Notarisierung, Private Key oder Signing Secret ab. Windows und macOS können daher Warnungen zu unbekanntem Herausgeber bzw. nicht identifiziertem Entwickler anzeigen.

Unterstützte Upstream-Target-Matrix:

| Plattform | Architektur | Veröffentlichte Installer |
|---|---|---|
| Windows | `x86_64` | MSI, NSIS EXE |
| macOS | `aarch64` | DMG |
| Linux | `x86_64` | DEB, AppImage |
| Linux | `aarch64` | DEB, AppImage |

Jeder Packaging Job schreibt einen architekturgebundenen Datensatz `signing-evidence-<platform>-<architecture>.json`. Offizielle Datensätze enthalten:

- `signed: false`;
- `notarized: false`;
- `signatureType: "none"`;
- den exakten Source Commit;
- Release Channel, Target Platform und Architecture;
- Verifier-Anweisung: Checksum plus GitHub Attestation.

Der Publication Job verlangt genau einen Datensatz pro unterstütztem Target. Fehlende, doppelte, unerwartete, falscher Channel oder falscher Commit blockieren die Veröffentlichung.

Release Receipt Schema 4 bettet die verifizierte Target Matrix neben Source Identity, Toolchain Metadata, Checksums und dem exakten Installer Subject Set ein. Ein unsigned Production Record ist erlaubt, fehlender oder falsch beschriebener Trust Status niemals.

## Exakte Artefaktgrenze

Jeder Packaging Job transportiert nur seine verteilbaren Installer und einen architecture-bound Trust-Status-Record. Publication trennt anschließend:

- `release-artifacts`: exakt sieben Installer-Dateien — ein MSI, ein NSIS EXE, ein DMG, zwei DEBs, zwei AppImages;
- `release-evidence`: exakt vier Trust-Status-JSON-Records, anschließend erzeugte SBOM, Checksum-Datei und Receipt.

Entpackte AppDir-Inhalte, `.app`-Interna, DMG-Hilfsskripte, CI-Logs, Caches, Source Maps, temporäres Key Material und beliebige Dateien unter `target/release/bundle` sind niemals Release Subjects.

Publication lädt die staged files herunter und baut nicht neu. Danach werden erzeugt:

- `SHA256SUMS` nur für die sieben Installer Subjects;
- CycloneDX 1.6 SBOM, gebunden an Release Version und Source Identity;
- source-bound Release Receipt Schema 4 mit den vier normalisierten Trust Records;
- GitHub Provenance- und SBOM-Attestations für jedes Installer Subject.

Die vier Trust-Status-Records werden als Metadata veröffentlicht und im Receipt eingebettet, sind aber keine Installer Subjects und stehen daher nicht in `SHA256SUMS`.

## Supply-Chain-Kontrollen

- Externe Actions sind auf geprüfte vollständige Commit-SHAs gepinnt;
- feste Runner Labels und gepinnte Node-, pnpm- und Rust-Versionen;
- frozen pnpm dependency installation und locked Cargo resolution;
- architekturspezifische Artifact-Namen verhindern x86_64/aarch64-Kollisionen;
- immutable Tag-Erzeugung mit Verweigerung, eine existierende Version neu auszurichten;
- exakte Installer-/Metadata-Cardinality-Prüfung vor Evidence Generation;
- exact Subject-Set Verification vor Release Upload;
- Clean-Checkout Source Identity ist an den Release Commit gebunden;
- Packaging-/Publication-Diagnostics werden behalten, aber nicht mit Release Assets vermischt.

## Verifikation durch Nutzer

Laden Sie einen Installer sowie `SHA256SUMS`, `scriptor.cyclonedx.json` und `release-receipt.json` aus demselben GitHub Release herunter.

GitHub Attestation prüfen:

```bash
gh attestation verify <installer> --repo AmirrezaFarnamTaheri/Scriptor
```

Linux-Checksum-Prüfung eines Installers:

```bash
artifact="scriptor-<version>-linux-x86_64.AppImage"
grep -F "  $artifact" SHA256SUMS | sha256sum --check -
```

macOS-Checksum-Prüfung:

```bash
artifact="scriptor-<version>-macos-aarch64.dmg"
expected=$(awk -v name="$artifact" '$2 == name { print $1 }' SHA256SUMS)
actual=$(shasum -a 256 "$artifact" | awk '{ print $1 }')
test -n "$expected" && test "$actual" = "$expected"
```

Windows-PowerShell-Checksum-Prüfung:

```powershell
$artifact = 'scriptor-<version>-windows-x86_64-setup.exe'
$line = Get-Content .\SHA256SUMS | Where-Object { $_ -match "  $([regex]::Escape($artifact))$" }
if (-not $line) { throw 'Installer is not listed in SHA256SUMS.' }
$expected = ($line -split '\s+', 2)[0].ToLowerInvariant()
$actual = (Get-FileHash ".\$artifact" -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Checksum verification failed.' }
```

Maintainer können zusätzlich alle sieben Installer nach `release-artifacts` laden, vier Trust Records plus SBOM/Checksum/Receipt nach `release-evidence` legen, das exakte Tag auschecken und ausführen:

```bash
node scripts/release/verify-signing-evidence.mjs release-evidence production
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```

Eine fehlende oder ungültige Checksum, SBOM, Receipt, Target-Status-Record, Source Identity, Exact-Subject-Übereinstimmung oder GitHub Attestation blockiert einen Production Release. Für offizielle Upstream-Installer wird keine OS-Publisher-Signatur behauptet.
