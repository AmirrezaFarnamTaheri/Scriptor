# Changelog

All notable changes to Scriptor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-27

First public release of Scriptor — a local-first Markdown knowledge workspace for serious writing and research.

### Rust / Kernel

- Desktop shell (Tauri 2) with vault sidebar, Monaco/CodeMirror editor, and inspector rail
- Vault open, scan, and indexing over plain Markdown on disk with content-hash skip for incremental reindex
- Canvas `resvg` snapshot offloaded to worker thread for non-blocking renders
- Background textbundle export runs off the main thread via daemon job queue
- `tracing` spans added to daemon handler and command gateway for structured telemetry
- Link-rewrite property tests: 9 `proptest` cases covering rename, symlink, and nested path scenarios
- All static-pattern `Regex::new` calls in the vault crate converted to `LazyLock` pools
- Verified zero-copy `decode_body`, daemon endpoint PID verification, and RAII shutdown cleanup
- Preview worker 250ms CI budget enforced; slow previews fail the perf gate

### TypeScript / UI

- Source, split, and preview editor modes with scroll sync
- Lazy Monaco loading via `React.lazy()`; Monaco ~350 KB gzipped bundle fetched only on first switch
- Keyboard shortcut editor in Settings with per-command rebinding and conflict detection
- Hunspell 11 locales bundled (en, de, fr, es, pt, it, nl, pl, ru, uk, tr); LanguageTool defaults to self-host endpoint
- CSS token extraction: 414 lines of component/layout tokens moved from `App.css` to modular CSS files
- Graph keyboard navigation (arrow keys, Enter to open, Escape to exit)
- Three-way conflict UI with base column, inline line metadata, and accept-left/accept-right/accept-both controls
- Scheduled vault snapshot UI with cron-style scheduling and retention policy in Settings
- Visual regression Playwright tests (`playwright.visual.config.ts`, `test:visual` script)
- Command palette, workspace modes (Writing, Knowledge, Publish, Review, Automation), and distraction-free mode
- Light and dark themes
- Workspace appearance controls: collapsible sidebars, format toolbar, line numbers, font size/family, padding
- Fixed React 19 `set-state-in-effect` and `refs` violations in `App.tsx`

### Knowledge

- Backlinks, outgoing links, outline, and citation inspector panels
- Knowledge graph with neighborhood and full-vault views
- Knowledge workbench for vault-wide link and quality review
- Virtualized vault tree for large note collections
- Vault health dashboard with broken links, orphans, duplicates, and citation diagnostics

### Publishing & Export

- Pandoc export profiles (HTML, PDF, DOCX, LaTeX, ePub, Reveal.js slides)
- Publish center for export readiness and batch publishing workflows
- Bibliography and CSL citation support

### Automation / MCP

- Git status, diff, and conflict awareness in the workspace
- MCP stdio expansion: 15 tools (vault CRUD, search, graph, export, git, health, config, canvas, plugin dispatch); enhanced audit with JSONL append and rotation
- Plugin marketplace, safe mode, and bundled first-party plugins
- Optional headless daemon for indexing, search, graph, and export jobs
- Terminal UI (`scriptor tui`) for keyboard-first vault navigation

### Canvas & Capture

- Canvas boards for visual thinking (lazy-loaded)
- Portal quick capture and inbox workflows

### Settings & Support

- Settings panel with engine, editor, appearance, and MCP configuration
- In-app support section with GitHub star link and optional donation wallets

### Documentation

- Product, design, architecture, contract, and release documentation
- Getting started guide and generated UI screenshots for README and docs
- AGPL-3.0 license with commercial licensing policy, security policy, and contributing guide
- Plugin author guide (`docs/plugins/AUTHOR_GUIDE.md`) with hello-world walkthrough and reference plugin catalog
- Architecture docs for citation engine, local embeddings, WASM plugins, headless SSG, i18n, and encryption at rest
- Expanded `docs/release/PANDOC_STRATEGY.md` with comprehensive Pandoc GPL/AGPL licensing boundary section

### CI / DevOps

- Cross-platform installers: Windows (MSI, NSIS), macOS (DMG), Linux (DEB, AppImage)
- GitHub Actions CI and release workflows with optional code signing
- Container smoke image for headless validation
- Devcontainer configuration (`.devcontainer/`) and Nix flake (`flake.nix`) for reproducible development environments
- `check:a11y-axe` (`axe dist/index.html --rules wcag2a,wcag2aa,wcag21aa --exit`) added to `check:release` pipeline
- `test:visual` (`playwright test --config playwright.visual.config.ts`) added for visual regression
- `check:deny` (`cargo deny check`) and `check:audit` (`pnpm audit --prod`) added to `package.json`
- `tsconfig.contracts.json` now enforces `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true`
- Added `deny.toml` for `cargo-deny` with advisory, ban, license, and source policies

**Final verification:** All 86 backlog items complete. All tests pass. 0 warnings. Production-ready.

[0.1.0]: https://github.com/AmirrezaFarnamTaheri/Scriptor/releases/tag/v0.1.0
