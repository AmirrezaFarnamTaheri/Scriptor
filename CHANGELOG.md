# Changelog

All notable changes to Scriptor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-25

First public release of Scriptor — a local-first Markdown knowledge workspace for serious writing and research.

### Added

#### Workspace

- Desktop shell (Tauri 2) with vault sidebar, Monaco/CodeMirror editor, and inspector rail
- Source, split, and preview editor modes with scroll sync
- Workspace appearance controls: collapsible sidebars, format toolbar, line numbers, font size/family, padding
- Command palette, workspace modes (Writing, Knowledge, Publish, Review, Automation), and distraction-free mode
- Light and dark themes

#### Knowledge

- Vault open, scan, and indexing over plain Markdown on disk
- Backlinks, outgoing links, outline, and citation inspector panels
- Knowledge graph with neighborhood and full-vault views
- Knowledge workbench for vault-wide link and quality review
- Virtualized vault tree for large note collections
- Vault health dashboard with broken links, orphans, duplicates, and citation diagnostics

#### Publishing & export

- Pandoc export profiles (HTML, PDF, DOCX, LaTeX, ePub, Reveal.js slides)
- Publish center for export readiness and batch publishing workflows
- Bibliography and CSL citation support

#### Automation

- Git status, diff, and conflict awareness in the workspace
- MCP read-only tool mode with permissioned plugin dispatch
- Plugin marketplace, safe mode, and bundled first-party plugins
- Optional headless daemon for indexing, search, graph, and export jobs
- Terminal UI (`scriptor tui`) for keyboard-first vault navigation

#### Canvas & capture

- Canvas boards for visual thinking (lazy-loaded)
- Portal quick capture and inbox workflows

#### Settings & support

- Settings panel with engine, editor, appearance, and MCP configuration
- In-app support section with GitHub star link and optional donation wallets

#### Release & platform

- Cross-platform installers: Windows (MSI, NSIS), macOS (DMG), Linux (DEB, AppImage)
- GitHub Actions CI and release workflows with optional code signing
- Container smoke image for headless validation

### Documentation

- Product, design, architecture, contract, and release documentation
- Getting started guide and generated UI screenshots for README and docs
- AGPL-3.0 license with commercial licensing policy, security policy, and contributing guide

[0.1.0]: https://github.com/AmirrezaFarnamTaheri/Scriptor/releases/tag/v0.1.0
