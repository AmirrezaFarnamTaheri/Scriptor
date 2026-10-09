# Verifikation

[English](VERIFICATION.md) · [فارسی](VERIFICATION.fa.md) · [简体中文](VERIFICATION.zh-CN.md) · [Русский](VERIFICATION.ru.md) · **Deutsch** · [Español](VERIFICATION.es.md)

Jedes Ergebnis muss den exakten Quell-Commit, die Umgebung, Zielarchitektur und Artefakte nennen. Ein älteres Ergebnis bestätigt keinen neueren Stand.

## Evidenz und aktueller Status

Die ausführbaren Prüfungen dieser Review laufen ausschließlich auf GitHub-Workern. Lokale App-Ausführung, Installation, Tests, Build, Lint, Typprüfung und Formatierung sind für diese Review nicht autorisiert. Quellprüfung und verfasste Regressionstests werden getrennt von bestandener Ausführung dokumentiert.

| Evidenz | Bedeutung |
|---|---|
| Verifiziert | Der genannte Befehl lief auf dem angegebenen Stand erfolgreich. |
| Statisch validiert | Quelltext oder Metadaten wurden ohne Produktausführung geprüft. |
| Geprüft | Code, Verträge oder Bilder wurden ohne Ausführungsnachweis begutachtet. |
| Ausstehend | Erforderliche Ausführung oder manuelle Evidenz fehlt. |
| Fehlgeschlagen | Der genannte Befehl lief und bestand nicht. |

Der [Google-Nachweis](validation/GOOGLE-INTEGRATIONS-2026-10-09.md) enthält den Umfang der fünf Dienste, Worker-Ergebnisse und Anbietergrenzen. [Abhängigkeitsgrenzen](validation/SUPPLY-CHAIN-2026-10-04.md) bleiben offen, bis der betroffene Audit oder Release-Gate selbst besteht.

Aktuelle Belege gehören in datierte Nachweise: [Produktreview](validation/CROSS-PRODUCT-REVIEW-2026-10-04.md), [Zoomreview](validation/LEGACY-DIALOG-ZOOM-2026-10-08.md), [Screenshot-Herkunft](validation/SCREENSHOT-REFRESH-2026-10-08.md), [Arbeitsbereich-Anpassung](validation/WORKSPACE-SHORTCUTS-2026-10-08.md) und [historische Verifikation](validation/HISTORICAL_VERIFICATION.md). Die frühere deutsche Fassung bleibt [unverändert archiviert](validation/localized-verification-history/VERIFICATION.de.md). Historische Zahlen sind Herkunftsnachweise, keine aktuelle Freigabe. Aktive Anleitungen unterliegen der Lokalisierung; provenance-sensitive Auditarchive bleiben ausgenommen.

## Repository-Prüfungen

GitHub-Worker führen vom Repository-Stamm aus:

```bash
pnpm check:source
pnpm check:governance
pnpm check:mcp
pnpm check:plugins
pnpm check:canvas
pnpm check:editor
pnpm check:portal
pnpm check:renderer
pnpm check:export
pnpm check:headless
pnpm check:citations
pnpm check:knowledge
pnpm check:merge
```

`check:source` prüft IPC-Verträge, Rust-Module, Prozesse und Unsafe-Regeln, native Autorisierung, Frontend-Richtlinien, Zuständigkeiten, Benchmarks, Release-Vertrauen und RustSec-Ausnahmen. `check:governance` prüft Versionen, unveränderliche Actions, Paketgrenzen, Sprachen und Dokumentations-/Lizenzverträge.

## Vollständiger Engineering-Gate

Ein Kandidat benötigt eine saubere Worker-Umgebung mit den Toolchains der Manifeste und unveränderten Lockfiles:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm check:contracts
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo deny check
pnpm audit --prod
```

`pnpm build` prüft den Produktions-Bundlegraph und das anfängliche gzip-Budget; `pnpm lint` erlaubt keine ESLint-Warnungen. `check:release` benötigt PowerShell 7 (`pwsh`) auch unter Linux/macOS. Die axe-Prüfung benötigt einen zur Chrome-Version passenden ChromeDriver; bei fehlender Erkennung verweist `CHROMEWEBDRIVER` auf dessen Verzeichnis.

## Oberfläche und Barrierefreiheit

```bash
pnpm test:e2e
pnpm test:visual
pnpm check:a11y
pnpm check:a11y-axe
```

Manuell erforderlich sind 320/375/768/1024/1440 CSS-Pixel, helle/dunkle/kontrastreiche Themes, Windows/macOS/Linux, reine Tastaturbedienung, Screenreader-Smoke, 200 % Textzoom, reduzierte Bewegung sowie leere, ladende, fehlerhafte, erfolgreiche, destruktive und lange Inhalte.

Typography-/Insert-Menüs müssen außerhalb des Toolbar-Clippings portaled werden, nach Resize/Scroll im visuellen Viewport bleiben und sich ohne React-Render-Schleife begrenzt neu positionieren. Tastaturöffnung fokussiert den ersten Eintrag; Pfeile, Home, End, Escape, Tab und Außenklick funktionieren. Escape stellt Trigger-Fokus wieder her.

Aufnahmen warten auf die erwartete Preview-Überschrift ohne `.preview-error`. Stabile Kernflächen verwenden Baselines; Zustandsbilder hängen am gehosteten Browser-/Visual-Job. [Screenshot-Katalog](assets/screenshots/README.de.md): Dokumentationsbilder entstehen aus frischen Aufnahmen, getrennt von gespeicherten Baselines.

## Release und Wiederherstellung

Alle Installer entstehen aus dem exakten geprüften Tag. Vor dem Packaging muss die Runner-Architektur zum Ziel passen: Windows x86_64, macOS aarch64, Linux x86_64/aarch64. Die Veröffentlichung enthält genau sieben Installer in `release-artifacts` und vier `signing-evidence-<platform>-<architecture>.json`-Datensätze in `release-evidence`.

Offizielle Datensätze enthalten `signed: false`, `notarized: false`, `signatureType: "none"`. Vor dem Receipt läuft `node scripts/release/verify-signing-evidence.mjs release-evidence production`. `SHA256SUMS` umfasst nur die sieben Installer; Receipt-Schema 4 bettet die vier normalisierten Vertrauensdatensätze ein. `node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence` verwirft Quellabweichung, schmutzigen Checkout, fehlende/zusätzliche Installer, unsichere Pfade, Symlinks, Prüfsummen-/SBOM-Abweichungen und unvollständige Zielidentitäten.

Für jeden Installer sind GitHub-Provenance, SBOM-Attestierung und unveränderliche Tag-Abstammung zu prüfen. Release Notes erklären unbekannte Herausgeber sowie Einzeldatei-Prüfsummen und Attestierungen. Saubere Installation und OS-Warnungen werden je Plattform aufgezeichnet. Externe Backups müssen beschädigte Kopien ablehnen und auf allen OS wiederherstellbar sein; unterbrochene Restores/MCP-Mutationen müssen deterministisch zurückkehren. Scan-, Speicher-, Index-, Such-, Graph-, Editor- und Export-Performance-Gates gehören dazu.

## Release-Invarianten und kanonische Historie

Manuelle Dispatches sind Vorschauen; Veröffentlichung verlangt `publish: true` auf vorhandenem `v*`-Tag. **Release Kickoff** prüft erfolgreiche CI auf dem exakten Commit, verlangt die exakte `VERSION`, erstellt nur einen unbenutzten unveränderlichen Tag und startet Release explizit. Versionsänderungen allein erstellen keinen Tag; widersprüchliche Tags sind ein harter Fehler und werden nie verschoben.

Automatische Produktion folgt erst erfolgreichen Tag-Builds und Qualitätsprüfungen. Pages bleibt durch `github-pages` geschützt. Update-Manifeste hängen am unveränderlichen Release; es gibt keinen rollierenden Force-Push-Tag. **Release** ist der einzige Release-Eigentümer. Architektur-Dateinamen verhindern Kollisionen. Uploads enthalten keine entpackten Interna oder CI-Evidenz; Installer-Prüfsummen und separate Vertrauensmetadaten bleiben getrennt.

Aus einem vollständigen kanonischen Clone:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

Zusätzlich sind ein genehmigter vollständiger Secret-Scan und Hosting-Nachweise zu Branch-/Review-/Environment-Schutz sowie Tag-/Release-Abstammung nötig. Ein Quellvertrag beweist keine öffentliche Veröffentlichung. Maßgeblich sind CI-Matrix und **Visual review** auf dem exakten aktuellen Commit, danach Produktions-Tag-Workflow und veröffentlichte Assets. Draft-PRs verschieben schwere Gates; `ready_for_review` startet die vollständige Matrix.
