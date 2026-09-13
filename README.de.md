<div align="center">

# Scriptor

**Ein Local-first-Markdown-Arbeitsbereich für anspruchsvolles Schreiben und Forschen.**

[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · **Deutsch** · [Español](README.es.md)

[![Version](https://img.shields.io/badge/version-1.0.9-0f766e.svg)](VERSION)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-0f766e.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-0f766e.svg)](#download)
[![Stack](https://img.shields.io/badge/stack-Tauri%202%20%C2%B7%20React%2019%20%C2%B7%20Rust%201.96-0f766e.svg)](#tech-stack)
[![CI](https://img.shields.io/github/actions/workflow/status/AmirrezaFarnamTaheri/Scriptor/ci.yml?branch=main&label=CI)](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/workflows/ci.yml)

Deine Notizen bleiben gewöhnliche Markdown-Dateien. Scriptor ergänzt Bearbeitung, Backlinks, Zitate, Versionsverlauf, Veröffentlichung und Automatisierung mit klaren Berechtigungsgrenzen.

[Download](#download) · [Erste Schritte](docs/guides/GETTING_STARTED.de.md) · [Funktionen](docs/CAPABILITIES.de.md) · [Plugin-Entwicklung](docs/plugins/AUTHOR_GUIDE.de.md) · [Mitwirken](CONTRIBUTING.de.md)

</div>

![Scriptor-Arbeitsbereich mit Editor, gerenderter Vorschau, Inspektor und kompakter Statusleiste](docs/assets/screenshots/workspace-light.png)

## Das Produkt

Scriptor öffnet einen Ordner mit Markdown-Dateien und ergänzt Suche, Backlinks, Verlauf, Vorschauen und Zustandsprüfungen. Markdown bleibt die maßgebliche Datenquelle, sodass jede Notiz auch in anderen Editoren lesbar und nutzbar bleibt.

Scriptor ist für langfristige Projekte wie Bücher, Abschlussarbeiten, technische Dokumentation, Forschungssammlungen und gepflegte Wissensbasen konzipiert. Eine Tauri-Desktop-Shell stellt die Benutzeroberfläche bereit, während Rust-Dienste den Zugriff auf den Vault, Indizierung, Git, Export und lokale IPC übernehmen.

| Arbeit mit deinen Inhalten | Was Scriptor bietet |
|---|---|
| **Schreiben und überarbeiten** | Quelltext-, Split- und gerenderte Ansichten; Gliederungsnavigation; Snippets; konfigurierbarer Editor; Notizverlauf |
| **Belege aufbauen** | Wikilinks, Backlinks, Zitate, Graph-Erkundung, Zustandsprüfungen und Reparatur nicht aufgelöster Links |
| **Reproduzierbar veröffentlichen** | Benannte Pandoc-Profile für HTML, PDF, DOCX, LaTeX, ePub und Reveal.js |
| **Mit klaren Grenzen automatisieren** | Git-aware Workflows, auditierbare MCP-Werkzeuge, berechtigungsgebundene Plugins und ein lokaler daemon |

## Scriptor im Einsatz

| Schreiben mit Quelltext und Vorschau | Struktur und Notizqualität prüfen |
|---|---|
| ![Editor und Vorschau](docs/assets/screenshots/editor-preview.png) | ![Inspektor-Vorschau](docs/assets/screenshots/inspector-preview.png) |

| Verbindungen erkunden | Vault reparieren und organisieren |
|---|---|
| ![Graph](docs/assets/screenshots/graph.png) | ![Knowledge Workbench](docs/assets/screenshots/knowledge-workbench.png) |

| Arbeitsbereich erweitern | Aus benannten Profilen veröffentlichen |
|---|---|
| ![Plugin-Marktplatz](docs/assets/screenshots/plugins.png) | ![Publish Center](docs/assets/screenshots/publish-center.png) |

Der [Screenshot-Katalog](docs/assets/screenshots/README.de.md) umfasst außerdem Dark Mode, Git, Konfliktauflösung, Command Palette, MCP, Einstellungen, Vault-Gesundheit, Notizverlauf, Tastaturkürzel, Onboarding und kompakte Layouts. Das Aufnahmeskript wartet, bis Daten und Panels vollständig geladen sind, und schlägt fehl, wenn ein Bildschirm im Lade- oder Degradationszustand verbleibt.

## Funktionen

- **Schreiben** — CodeMirror 6 standardmäßig, optional Monaco; Split- und Vorschaumodi; Formatierungsleiste; Snippets; ablenkungsfreier Modus; Editor für Tastaturkürzel
- **Organisieren** — virtualisierter Vault-Baum, Inbox, tägliche Notizen, Notiztypen, Vorlagen und gespeicherte Ansichten
- **Verknüpfen** — Wikilinks, Backlinks, Wissensgraph mit Tastaturnavigation, Knowledge Workbench und Reparatur nicht aufgelöster Links
- **Zitieren** — CSL-Stile, Inline-Zitate `[@key]`, Bibliografie-Vorschau und lokale Bibliografiedateien
- **Veröffentlichen** — Pandoc-Exportprofile für HTML, PDF, DOCX, LaTeX, ePub und Reveal.js sowie lokale Starlight-Veröffentlichung
- **Automatisieren** — Git mit 3-Wege-Konfliktauflösung, 22 MCP-Werkzeuge mit hashverketteter JSONL-Mutationsprüfung, Plugin-Katalog mit Safe Mode und headless daemon mit tracing
- **Visualisieren** — Canvas-Boards mit Lazy Loading und Auslagerung von `resvg` in einen worker sowie Portal Quick Capture
- **Betreiben** — Command Palette, Workspace-Modi, Vault-Health-Dashboard, Terminal-UI und geplante Snapshots
- **Rechtschreibprüfung** — Hunspell für mehrere Sprachräume, optional LanguageTool

Den aktuellen Status ausgelieferter, experimenteller und rein konzeptioneller Funktionen findest du in [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md).

<a id="download"></a>
## Scriptor herunterladen

Produktionsinstaller werden als GitHub-Release-Assets veröffentlicht. Die aktuelle Version ist **1.0.9**.

- **Windows x86_64** — `.msi` und `.exe` (NSIS)
- **macOS Apple Silicon (aarch64)** — `.dmg`
- **Linux x86_64 und ARM64** — `.deb` und `.AppImage`

> **Vertrauensstatus.** Die offiziellen Upstream-Installer werden bewusst **unsigniert** veröffentlicht. Releases enthalten SHA-256-Prüfsummen, eine CycloneDX-SBOM, einen Release Receipt, Nachweise zur Quellidentität und GitHub-Provenance-Attestierungen. Den vollständigen Prüfablauf vor der Installation findest du in [`docs/RELEASE-SECURITY.de.md`](docs/RELEASE-SECURITY.de.md).

[Neueste Version herunterladen](https://github.com/AmirrezaFarnamTaheri/Scriptor/releases) oder [aus dem Quellcode bauen](#build-from-source).

<a id="tech-stack"></a>
## Technologie-Stack

- **Desktop-Shell** — Tauri 2
- **Renderer** — React 19, Vite 8, TypeScript 6, Lucide React
- **Kernel** — Rust 1.96 (Edition 2024) workspace crates (`vault`, `indexer`, `native-git`, `daemon`, `ipc`, `system-bridge`, `export-runner`, `publish-runner`, `canvas-engine`, `cli`, `embeddings`, `tantivy-indexer`, `citation-engine`, `wasm-runtime`, `capture`)
- **Persistenz** — SQLite WAL + FTS5 im Vault-Kernel
- **IPC** — lokales RPC mit postcard-Framing und HMAC-Authentifizierung (`scriptor-ipc` → `scriptor-daemon`)
- **Verträge** — aus Rust mit `ts-rs` generierte TypeScript-Typen
- **Styling** — semantische CSS Custom Properties; kein Tailwind, keine Remote-Fonts
- **Editor** — CodeMirror 6 standardmäßig; Monaco als erweiterte, nicht standardmäßige Option

<a id="build-from-source"></a>
## Aus dem Quellcode bauen

### Voraussetzungen

- Node.js `22.16.0` (engines: `>=22.12.0`)
- pnpm `10.33.0` (verwaltet durch Corepack)
- Rust `1.96.0` über `rustup`, Komponenten `rustfmt` und `clippy`
- PowerShell 7 (`pwsh`) für Release-, Container- und Benchmark-Skripte
- Tauri-2-Plattformabhängigkeiten für dein Betriebssystem

### Ersteinrichtung

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
```

### Ausführen

```powershell
pnpm web:dev          # nur Web-Shell (Entwicklung und visuelle Tests)
pnpm desktop:dev      # Tauri-Desktop-Shell
```

### Prüfen

Schnelle, repository-native Prüfungen:

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
```

Vollständiges Release-Gate:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

`pnpm check:release` führt Contract Runner, Rust-Tests, Playwright-E2E- und Visual-Suites, Accessibility-Audits, daemon- und TUI-Smoke-Tests sowie Performance-Gates aus. Verpackung und Prüfung der Release-Evidence sind in [`scripts/release/README.md`](scripts/release/README.md) dokumentiert.

## Architektur

Die aktuelle Laufzeittopologie, Vertrauensgrenzen und crate-Zuständigkeiten sind in [`docs/ARCHITECTURE.de.md`](docs/ARCHITECTURE.de.md) dokumentiert. Container- und Context-Diagramme befinden sich in [`docs/architecture/c4-container.de.md`](docs/architecture/c4-container.de.md) und [`docs/architecture/c4-context.de.md`](docs/architecture/c4-context.de.md).

| Ebene | Einstiegspunkte |
|---|---|
| Desktop | `apps/desktop/src-tauri/src/lib.rs`, `src/App.tsx` |
| Vault | `crates/vault/src/lib.rs` |
| Index / search / graph | `crates/indexer/src/lib.rs` |
| Daemon IPC | `crates/daemon/src/lib.rs`, `crates/ipc/src/lib.rs` |
| Git | `crates/native-git/src/lib.rs` |
| External tools | `crates/system-bridge/src/process.rs` |
| Frontend packages | `packages/*/src/index.ts` |

## Grundsätze

- **Local-first.** Markdown bleibt die maßgebliche Quelle und portabel.
- **Explizite Autorisierung.** Destruktive Aktionen sowie Zugriffe auf Geheimnisse, Netzwerk, Prozesse, Backups und Veröffentlichung benötigen klar abgegrenzte Berechtigungen.
- **Begrenzte Arbeit.** Scans, Graph-Traversierungen, Ereigniswarteschlangen, subprocess-Ausgaben, Logs und Audit-Tails haben explizite Limits.
- **Wiederherstellbare Änderungen.** Git-Commits isolieren den Index, MCP-Schreibvorgänge verwenden intent/outcome-Datensätze, und Restores prüfen Manifeste vor der endgültigen Übernahme.
- **Ein Vertrag pro Grenze.** Rust-IPC-Definitionen erzeugen TypeScript-Verträge; Runtime-JSON wird vor der Verwendung validiert.
- **Ehrliche Reifegrade.** Implementierte, experimentelle und rein konzeptionelle Fähigkeiten werden getrennt in [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md) dokumentiert.

## Dokumentation

| Zielgruppe | Hier beginnen |
|---|---|
| Neue Nutzer | [`docs/guides/GETTING_STARTED.de.md`](docs/guides/GETTING_STARTED.de.md) |
| Funktionsübersicht | [`docs/CAPABILITIES.de.md`](docs/CAPABILITIES.de.md) und [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md) |
| Plugin-Autoren | [`docs/plugins/AUTHOR_GUIDE.de.md`](docs/plugins/AUTHOR_GUIDE.de.md) |
| Beitragende | [`CONTRIBUTING.de.md`](CONTRIBUTING.de.md) und [`AGENTS.md`](AGENTS.md) |
| Sicherheitsforschende | [`SECURITY.de.md`](SECURITY.de.md) und [`docs/ENCRYPTION-THREAT-MODEL.de.md`](docs/ENCRYPTION-THREAT-MODEL.de.md) |
| Release-Verantwortliche | [`docs/RELEASE-CHECKLIST.de.md`](docs/RELEASE-CHECKLIST.de.md) und [`docs/RELEASE-SECURITY.de.md`](docs/RELEASE-SECURITY.de.md) |
| Architekten | [`docs/ARCHITECTURE.de.md`](docs/ARCHITECTURE.de.md) und [`docs/architecture/`](docs/architecture/) |
| Auditoren | [`docs/_archived/AUDIT-2026-08-23.md`](docs/_archived/AUDIT-2026-08-23.md) und [`docs/FINAL-REMEDIATION-REPORT.de.md`](docs/FINAL-REMEDIATION-REPORT.de.md) |

Vollständiger Index: [`docs/README.de.md`](docs/README.de.md).

## Support

- **Issues** — <https://github.com/AmirrezaFarnamTaheri/Scriptor/issues>
- **E-Mail** — Amirreza "Farnam" Taheri, [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)
- **Sicherheit** — befolge [`SECURITY.de.md`](SECURITY.de.md); melde Schwachstellen nicht in öffentlichen Issues

## Mitwirken

Beiträge zu Scriptor sind willkommen. Der vollständige Workflow, die Erwartungen an Beitragende und die erforderlichen Nachweis-Gates stehen in [`CONTRIBUTING.de.md`](CONTRIBUTING.de.md). Vor dem Öffnen eines Pull Requests:

1. Lies [`PRODUCT.de.md`](PRODUCT.de.md), [`DESIGN.de.md`](DESIGN.de.md), [`docs/ARCHITECTURE.de.md`](docs/ARCHITECTURE.de.md) und [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md).
2. Füge, wo praktikabel, zuerst einen Verhaltenstest hinzu, der vor der Korrektur fehlschlägt.
3. Führe die vollständige Prüfliste oben aus; jedes Gate muss auf exakt demselben Commit erfolgreich sein.
4. Aktualisiere [`CHANGELOG.md`](CHANGELOG.md) und alle betroffenen Dokumente zusammen mit der Änderung.

## Projektstatus

**Aktive Entwicklung.** `v1.0.9` ist der aktuelle Produktions-Release-Kandidat. Desktop-, Vault-, Indexer-, Knowledge-, Git-, Export-, daemon- und Web-Oberflächen sind implementiert und werden ausgeliefert. Das Capability-Ledger in [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md) ist die maßgebliche Quelle dafür, was unterstützt, experimentell oder nur konzipiert ist. Mobile, verschlüsselte Vaults, lokale Embeddings, Tantivy und der WASM-Host bleiben experimentell oder design-only.

## Lizenz

Scriptor steht unter der **GNU AGPL-3.0-or-later**. Kommerzielle Nutzung ist erlaubt, sofern die Lizenzpflichten eingehalten werden. Organisationen, die die AGPL-Bedingungen nicht erfüllen möchten, können eine separate kommerzielle Lizenz anfragen; siehe [`COMMERCIAL-LICENSING.de.md`](COMMERCIAL-LICENSING.de.md).

## Maintainer

Amirreza "Farnam" Taheri · [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com) · [GitHub](https://github.com/AmirrezaFarnamTaheri/Scriptor)
