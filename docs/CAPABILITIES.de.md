# Scriptor-Funktionen

[English](CAPABILITIES.md) · [فارسی](CAPABILITIES.fa.md) · [简体中文](CAPABILITIES.zh-CN.md) · [Русский](CAPABILITIES.ru.md) · **Deutsch** · [Español](CAPABILITIES.es.md)

Visuelle Referenzen für funktionsgesteuerte Oberflächen werden in der [Visual-Review-Galerie](./VISUAL-REVIEW.md) und im [kanonischen Screenshot-Inventar](assets/screenshots/README.de.md) gepflegt, darunter [Graph](assets/screenshots/graph.png), [Canvas](assets/screenshots/canvas.png), [MCP](assets/screenshots/mcp-panel.png) und [Plugins](assets/screenshots/plugins.png). Screenshots zeigen nur den UI-Zustand; native Autorisierung und Vault-Zustand bleiben maßgeblich.

Ausgelieferte Produktoberflächen und Release-Validierung für **v1.0.0**.

Die benutzerorientierte Feature-Tour steht im Haupt-[`README.de.md`](../README.de.md), die maßgebliche Reifegradbewertung in [`CAPABILITY-MATURITY.de.md`](./CAPABILITY-MATURITY.de.md). Diese Seite erfasst das Auslieferungsmanifest von v1.0.0 und die Befehle zur Release-Validierung.

## In v1.0.0 enthalten

| Bereich | Referenz |
|---|---|
| Desktop-Shell (Tauri 2) | `apps/desktop/` |
| Vault-Kernel + Indexer | `crates/vault`, `crates/indexer` |
| Headless-Daemon-IPC | [`architecture/IPC_DAEMON.de.md`](./architecture/IPC_DAEMON.de.md) |
| Terminal-UI | [`architecture/TUI_PARITY.de.md`](./architecture/TUI_PARITY.de.md) |
| Plugin-System (Safe Mode + Marketplace) | [`architecture/PLUGIN_SYSTEM.de.md`](./architecture/PLUGIN_SYSTEM.de.md) |
| Plugin-Autorenleitfaden + Hello World | [`plugins/AUTHOR_GUIDE.de.md`](./plugins/AUTHOR_GUIDE.de.md) |
| MCP: 22 Tools mit geprüften Drafts | `packages/mcp/`; dauerhafte Mutationsprüfung: `crates/vault/src/mcp_audit.rs`, `crates/daemon/src/automation_stdio.rs` |
| Export (Pandoc) | `crates/export-runner`, `@scriptor/export` |
| Canvas-Engine (resvg-Worker-Offload) | `crates/canvas-engine`, `@scriptor/canvas` |
| Virtualisierter Vault-Baum | `src/components/app/VirtualNoteList.tsx` |
| Design-Tokens (414 extrahierte Zeilen) | `src/styles/tokens/components.css` |
| Visual-Regression-Tests | `playwright.visual.config.ts` |
| axe-core-CI-Gate | `check:a11y-axe` in `check:release` |
| Dokumentations-Screenshots | `docs/assets/screenshots/` |
| Release-Packaging + Trust-Nachweise für unsignierte Installer | `scripts/release/`, `.github/workflows/release.yml` |

## Headless Engine

Wenn **Settings → Headless engine** aktiviert ist, laufen Indizierung, Suche, Backlinks, Graph, Git-Status, Gesundheitsdiagnosen, Speichern/Umbenennen von Notizen und Exportjobs über den lokalen Daemon. Vault-Öffnen, Scan und Canvas bleiben für schnelle Reaktion im Prozess. Siehe [`architecture/IPC_DAEMON.de.md`](./architecture/IPC_DAEMON.de.md).

## Release-Validierung

```powershell
pnpm check:release   # Full local release gate (includes axe-core CI gate)
pnpm check:daemon    # IPC smoke
pnpm check:tui       # Terminal UI smoke
pnpm check:a11y      # Static accessibility checks
pnpm check:a11y-axe  # axe-core WCAG 2a/2aa/2.1aa automated audit
pnpm check:plugins   # Plugin manifest + marketplace catalog
pnpm check:mcp       # MCP tool manifest validation
pnpm check:contracts # TypeScript contract packages
pnpm check:canvas    # Canvas engine contracts
pnpm check:editor    # Editor engine contracts
pnpm check:renderer  # Renderer contracts
pnpm check:export    # Export pipeline contracts
pnpm check:knowledge # Knowledge graph contracts
pnpm check:citations # Citation engine contracts
pnpm check:headless  # Headless runner contracts
pnpm check:perf      # Performance baseline check
pnpm test:rust       # Rust unit and integration tests
pnpm test:visual     # Visual regression Playwright tests
pnpm test:e2e        # Playwright end-to-end tests
```

CI spiegelt diese Prüfungen in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## Verwandte Dokumente

| Dokument | Zweck |
|---|---|
| [`guides/GETTING_STARTED.de.md`](./guides/GETTING_STARTED.de.md) | Anleitung für den ersten Start |
| [`release/PANDOC_STRATEGY.de.md`](./release/PANDOC_STRATEGY.de.md) | Export-Voraussetzungen |
| [`release/SIGNING.de.md`](./release/SIGNING.de.md) | Installer-Trust- und Signing-Richtlinie |
| [`../PRODUCT.de.md`](../PRODUCT.de.md) | Produktprinzipien |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Release-Historie |
