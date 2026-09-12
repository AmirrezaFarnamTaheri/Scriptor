[English](VERIFICATION.md) · [فارسی](VERIFICATION.fa.md) · [简体中文](VERIFICATION.zh-CN.md) · [Русский](VERIFICATION.ru.md) · **Deutsch** · [Español](VERIFICATION.es.md)

# Verifikationsevidenz

**Datum:** 2026-08-23 (Repository-lokale Evidenz; keine Behauptung, dass jeder unten aufgeführte Befehl in dieser Sitzung erneut ausgeführt wurde)

Dieses Dokument beschreibt die im Repository vorhandene Evidenzkette für Hygiene, Verträge, Security, Build, Tests, Packaging und Release-Provenance. Aufgezeichnete Befehle, Dateinamen, IDs, Hashes und Toolausgaben bleiben unverändert, weil sie technische Evidenz und keine übersetzbare Produktcopy sind.

## 1. Lokale Hygiene, Discovery und Scope-Prüfung

Vor der Interpretation von Testergebnissen wird zuerst geprüft, welcher Commit und welche Quellen tatsächlich maßgeblich sind. Insbesondere werden Working-Tree-Drift, unerwartete generierte Dateien, veraltete lokale Artefakte und widersprüchliche Dokumentation ausgeschlossen.

Typische Repository-native Prüfungen:

```powershell
git status --short
git rev-parse HEAD
git ls-files
pnpm version:check
pnpm check:source
pnpm check:docs
pnpm check:i18n
```

Zu dieser Stufe gehört außerdem die Prüfung von `package.json`, `pnpm-lock.yaml`, `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, Tauri-Konfiguration, Workflows unter `.github/workflows/`, Release-Skripten sowie der Capability-/Architektur-Dokumentation. Der maßgebliche Zustand ist die Implementierung des exakten Commits; historische Audit- oder Planungsdokumente ersetzen diese Prüfung nicht.

**Akzeptanzregel:** Evidenz wird nur dann einem Release-Kandidaten zugerechnet, wenn sie an denselben Source-Commit gebunden ist oder ihr Provenance-Vertrag eine ausdrücklich verifizierte Ableitung belegt.

## 2. Security- und Dependency-Gate

Die Dependency- und Security-Prüfung umfasst Node/pnpm, Rust/Cargo, GitHub Actions und externe Tools. Repo-native Gates prüfen unter anderem Workflow-Pinning, Dependency-Policies, Prozess-Launch-Inventar und bekannte Advisories.

```powershell
pnpm lint:actions
pnpm check:release-security
cargo deny check
cargo tree --workspace
```

RustSec-Ausnahmen werden nicht als generelle Unterdrückung behandelt. Die einzige erlaubte Ausnahmeoberfläche ist das versionierte Ledger [`security/RUSTSEC-EXCEPTIONS.de.md`](security/RUSTSEC-EXCEPTIONS.de.md), das Owner, Reachability, Review-Datum und Exit-Bedingung enthält. Neue oder upgradebare Vulnerability-Class-Advisories bleiben Release-Blocker.

Die Prozessgrenze ist ebenfalls Teil des Security-Gates: Produktionsstarts externer Programme müssen über die genehmigte System-Bridge laufen und gegen das Prozessinventar geprüft werden. Secrets, Netzwerk, Dateisystem, MCP-Mutationen und Plugin-Berechtigungen müssen an ihrer nativen Vertrauensgrenze fail-closed validiert werden.

## 3. Typ-, Contract- und Boundary-Oberfläche

Scriptor verwendet generierte Rust/TypeScript-Verträge und zusätzliche Source-Contracts, damit Renderer, Tauri, Daemon, CLI/TUI und MCP keine still auseinanderlaufenden Payloads besitzen.

Relevante Prüfungen:

```powershell
pnpm check:contracts
pnpm check:generated-contracts
pnpm lint:boundaries
pnpm check:source
pnpm check:frontend-quality
pnpm check:i18n
```

Die Befehlsoberfläche ist in [`contracts/COMMAND_CATALOG.de.md`](contracts/COMMAND_CATALOG.de.md) beschrieben. Boundary-Ergebnisse folgen [`contracts/BOUNDARY_OUTCOMES.de.md`](contracts/BOUNDARY_OUTCOMES.de.md): `value`, `absent-optional`, `invalid`, `degraded`, `failed` und `recovered` dürfen nicht zu einem gemeinsamen Defaultwert kollabieren.

**Akzeptanzregel:** Ein neu hinzugefügter Command, RPC, MCP-Tool oder CLI-Einstiegspunkt muss Owner, Permission-Klasse, typisierte Ein-/Ausgabe, Failure-Semantik, Audit-Verhalten und Rollback-/No-Mutation-Vertrag besitzen.

## 4. Build und UI-Smoke

Der Frontend- und Desktop-Build prüft, dass die TypeScript-/React-Oberfläche, der Tauri-Host und die gebündelten Assets zusammenpassen.

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
cargo check --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

Für Desktop-spezifische Release-Evidenz werden die Tauri-Buildpfade auf den unterstützten Betriebssystemen ausgeführt. Ein grüner Web-Build allein beweist keine korrekte Desktop-Integration, native Capability oder Installer-Erzeugung.

UI-Smoke-Evidenz umfasst mindestens das Öffnen eines Vaults, Lesen/Schreiben von Notizen, Index-/Search-Bereitschaft, Fehler-/Recovery-Zustände und die Hauptnavigation. Test-/Screenshot-Modi dürfen nicht in Produktionsbundles gelangen.

## 5. Test-Suites

Die Verifikation kombiniert schnelle Source-Contracts, JavaScript/TypeScript-Tests, Rust-Tests, Playwright-E2E, Accessibility und visuelle Regression. Kein einzelner Testtyp ersetzt die anderen.

```powershell
pnpm test:source
pnpm test:rust
pnpm test:e2e
pnpm test:visual
pnpm test:a11y
pnpm check:release
```

`pnpm check:release` ist das zusammengefasste Release-Gate und führt die für einen Kandidaten geforderten Contract Runner, Rust-Prüfungen, Playwright-Suites, Accessibility-Audits, Daemon/TUI-Smokes und Performance-Gates aus.

### E2E und Visual

Playwright verwendet getrennte Konfigurationen und Output-Verzeichnisse für funktionale E2E- und stabile Visual-Suites. Die kanonischen Dokumentations-Screenshots sind frische Aufnahmen des aktuellen Source-Zustands; gespeicherte Windows-Snapshots sind eine separate Regression-Akzeptanzoberfläche. Details stehen in [`assets/screenshots/README.de.md`](assets/screenshots/README.de.md) und [`VISUAL-REVIEW.de.md`](VISUAL-REVIEW.de.md).

Absichtliche Pixeländerungen werden geprüft und ausdrücklich aktualisiert. Die globale visuelle Toleranz wird nicht erhöht, um Regressionen zu verstecken.

### Accessibility

Accessibility-Evidenz kombiniert automatisierte axe-Prüfungen mit Keyboard-/Focus-Verträgen für Modalflächen, Menüs, Canvas/Graph, virtualisierte Listen und Security-State-Controls. Mindestziel für produktseitige Oberflächen ist WCAG 2.2 AA; Coarse-Pointer-Ziele bleiben mindestens 44×44 px.

### Performance

Benchmarks besitzen versionierte Baselines und definierte Schwellen. Performance-Gates sollen Regressionen bei Start, Indexierung, Search, Graph, großen Vaults und speicherintensiven Oberflächen erkennen, nicht absolute Hardware-Vergleiche zwischen beliebigen Hosts liefern.

## 6. Packaging- und Installer-Prüfung

Ein Release ist erst nach erfolgreicher Plattform-Paketierung ein Desktop-Release. Die unterstützte Matrix umfasst die in README/Release-Dokumentation deklarierte Windows-, macOS- und Linux-Oberfläche.

Packaging-Evidenz prüft insbesondere:

- erwartete Dateitypen und Architekturen;
- Versionsgleichheit zwischen `VERSION`, npm, Cargo und Tauri;
- Release-Bundle-Inhalt ohne E2E-/Fault-Injection-Marker;
- Installer-/Bundle-Namen und Checksums;
- keine unerwarteten symbolischen Links oder Pfadtraversal-Einträge;
- reproduzierbare Zuordnung zum Release-Commit.

Relevante Einstiegspunkte sind unter `scripts/release/` dokumentiert; der Release-Workflow erzeugt Plattformartefakte und sammelt sie anschließend in einer gemeinsamen Evidenzstufe.

## 7. Release-Evidenz, SBOM und Provenance

Die Release-Pipeline erzeugt ihre finalen Nachweise **nach** dem Download aller Plattformartefakte. Maßgebliche Dateien sind unter anderem:

```text
release-receipt.json
scriptor.cyclonedx.json
SHA256SUMS
```

Der Verifier behandelt den Receipt als exakte Allowlist. Fehlende Artefakte, zusätzliche nicht quittierte Artefakte, doppelte Checksum-Einträge, symbolische Links, absolute/Traversal-Pfade, Source-Tree-Drift oder SBOM-Metadaten-Drift blockieren die Promotion. Siehe [`evidence/README.de.md`](evidence/README.de.md) und [`RELEASE-SECURITY.de.md`](RELEASE-SECURITY.de.md).

GitHub-Provenance-Attestations und die aufgezeichnete Source-Identity werden erst nach erfolgreicher lokaler Evidenzprüfung erstellt. Ein lokal erzeugtes Archiv ohne kanonischen Git-Checkout ist diagnostisch nützlich, aber keine akzeptierte Produktions-Provenance.

## Visuelle Verifikation und Dokumentationsartefakte

Screenshots im Repository sind Dokumentationsartefakte. Sie belegen allein keinen Release. Ein belastbarer visueller Nachweis nennt den exakten Commit, Betriebssystem/Runner, Browser/Channel, Viewport bzw. Device Scale und das Ergebnis der zugehörigen Playwright-Suite.

Die Screenshot-Galerie, ihre Capture-Regeln und die Reviewer-Disziplin sind in [`assets/screenshots/README.de.md`](assets/screenshots/README.de.md) und [`VISUAL-REVIEW.de.md`](VISUAL-REVIEW.de.md) dokumentiert.

## Bekannte Grenzen der Repository-Evidenz

- Dieses Dokument ist eine Aufzeichnung repository-lokaler Evidenz; das Datum oben bedeutet nicht, dass in jeder späteren Sitzung alle Befehle erneut ausgeführt wurden.
- Ein grüner Einzeljob ersetzt nicht die Commit-genaue Release-Gate-Kette.
- Lokale oder historische CI-Logs dürfen nicht auf einen anderen Commit übertragen werden.
- Plattformabhängige Packaging-/Signing-/Installer-Evidenz muss auf der jeweiligen unterstützten Plattform bzw. im dafür vorgesehenen Workflow entstehen.
- Design-only oder experimentelle Fähigkeiten werden nicht durch das Vorhandensein von Tests automatisch zu unterstützten Produktionsfeatures. Der Reifegrad-Ledger bleibt maßgeblich.

## Release-Interpretation

Für eine Produktionsfreigabe müssen die aktuellen Gates auf dem exakten Release-Commit grün sein und die erzeugten Artefakte denselben Commit nachweisbar referenzieren. Bei Widerspruch zwischen historischer Evidenz und aktueller Implementierung gewinnt die aktuelle, reproduzierbare Implementierung plus commitgebundene Verifikation.
