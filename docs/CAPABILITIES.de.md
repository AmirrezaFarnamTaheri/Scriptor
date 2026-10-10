# Scriptor: Fähigkeiten und Arbeitsbereiche

[English](CAPABILITIES.md) · [فارسی](CAPABILITIES.fa.md) · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · **Deutsch** · [Español](CAPABILITIES.es.md)

Scriptor verbindet lokale Markdown-Dateien mit Bearbeitung, Recherche, Veröffentlichung und ausdrücklich erlaubter Automatisierung. Diese Übersicht beschreibt die aktuelle Oberfläche und ihre Zuständigkeiten. Der [Reifegrad-Ledger](CAPABILITY-MATURITY.md) unterscheidet ausgelieferte, experimentelle und reine Designfähigkeiten; ein sichtbarer Schalter allein belegt keinen produktiven Support.

Die [visuelle Galerie](VISUAL-REVIEW.de.md) und das [Screenshot-Verzeichnis](assets/screenshots/README.de.md) zeigen konkrete UI-Zustände. Bilder belegen weder native Berechtigungen noch den tatsächlichen Vault-Zustand.

## Kernbereiche

| Bereich | Referenz |
|---|---|
| Desktop-Shell (Tauri 2) | `apps/desktop/` |
| Vault-Kernel und Indexer | `crates/vault`, `crates/indexer` |
| Lokaler Headless-Daemon und IPC | [IPC](architecture/IPC_DAEMON.md) |
| Terminaloberfläche | [TUI](architecture/TUI_PARITY.md) |
| Plugins, sicherer Modus und eigener Katalog | [Plugin system](architecture/PLUGIN_SYSTEM.md) |
| Plugin-Autorenleitfaden und Hello World | [Author guide](plugins/AUTHOR_GUIDE.md) |
| 22 MCP-Werkzeuge mit geprüften Entwürfen | `packages/mcp/` |
| Export mit Pandoc | `crates/export-runner`, `@scriptor/export` |
| Canvas-Engine mit resvg-Worker | `crates/canvas-engine`, `@scriptor/canvas` |
| Virtualisierter Vault-Baum | `src/components/app/VirtualNoteList.tsx` |
| Design-Tokens | `src/styles/tokens/components.css` |
| Visuelle Regression | `playwright.visual.config.ts` |
| axe-core-Gate in CI | `check:a11y-axe`, `check:release` |
| Dokumentationsbilder | `docs/assets/screenshots/` |
| Release-Paketierung und Evidenz der unsignierten Vertrauenspolitik | `scripts/release/`, `.github/workflows/release.yml` |

Dauerhafte MCP-Mutationsprotokolle liegen in `crates/vault/src/mcp_audit.rs` und `crates/daemon/src/automation_stdio.rs`.

## Experimentelle Abläufe

| Arbeitsablauf | Verhalten und Anleitung |
|---|---|
| Eigenständige Quelldateien | LaTeX, Code und verwandte Textformate mit geschützten Speichervorgängen; Ausführung und Kompilierung erfolgen ausdrücklich. Siehe [Reifegrad](CAPABILITY-MATURITY.md). |
| Google-Verbindungen | Unabhängige Kontoverbindungen, geprüfte Drive/Docs-Revisionen, Calendar/Tasks-Planung und optionales Gmail. Siehe [Google-Leitfaden](guides/GOOGLE_INTEGRATIONS.de.md). |
| Overleaf-Austausch | Geprüfter Quelldateiaustausch über Git mit festem Zielhost. Siehe [Architektur](ARCHITECTURE.de.md). |
| Runtime und semantischer Inspektor | Ausführung mit Berechtigung und anbieterabhängige Embedding-Inspektion. Native, Anbieter- und Paketnachweise bleiben getrennte [Prüfanforderungen](VERIFICATION.de.md). |
| Arbeitsbereich zusammenstellen | Haupt- und Nebenbereiche, verschiebbare Panels und anpassbare Kurzbefehle; versteckte Einträge bleiben über die Befehlspalette erreichbar. Siehe [Erste Schritte](guides/GETTING_STARTED.de.md). |

## Headless-Engine

Mit **Settings → Headless engine** laufen Indexierung, Suche, Rückverweise, Graph, Git-Status, Gesundheitsdiagnosen, Speichern/Umbenennen und Exportjobs über den lokalen Daemon. Vault-Öffnen, Scan und Canvas bleiben zur schnellen Reaktion im Prozess. Der [IPC-Vertrag](architecture/IPC_DAEMON.md) beschreibt die Grenze.

## Verifikation

Verfahren stehen in [CONTRIBUTING.de.md](../CONTRIBUTING.de.md), aktuelle Ergebnisse und offene Gates in [VERIFICATION.de.md](VERIFICATION.de.md). Für die aktuelle Prüfung laufen ausführbare Checks ausschließlich auf GitHub-Workern. Browser-Testdaten belegen kontrolliertes Verhalten und Layout, keine Live-Anbieterzugriffe, installierten Clients oder Release-Reife. Workflow-Evidenz muss Commit und Diagnoseartefakte erhalten.

```powershell
pnpm check:release
pnpm check:daemon
pnpm check:tui
pnpm check:a11y
pnpm check:a11y-axe
pnpm check:plugins
pnpm check:mcp
pnpm check:contracts
pnpm check:canvas
pnpm check:editor
pnpm check:renderer
pnpm check:export
pnpm check:knowledge
pnpm check:citations
pnpm check:headless
pnpm check:perf
pnpm test:rust
pnpm test:visual
pnpm test:e2e
```

[CI](../.github/workflows/ci.yml)

## Weitere Dokumente

[Pandoc-Voraussetzungen](release/PANDOC_STRATEGY.md) · [Installer-Vertrauen](release/SIGNING.md) · [Produktprinzipien](../PRODUCT.md) · [Änderungen](../CHANGELOG.md)
