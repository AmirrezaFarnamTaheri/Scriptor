# Changelog

All notable changes to Scriptor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-session-24] - 2026-06-27

### Rust / Kernel

- **BL-28** — Preview worker 250ms CI budget enforced; slow previews fail the perf gate
- **BL-29** — Content-hash skip audit: verified all incremental indexing paths call `note_needs_reindex` before parse+upsert; documented desktop watcher gap as architectural trade-off (`docs/validation/CONTENT_HASH_AUDIT.md`)
- **BL-33** — `tracing` spans added to daemon handler and command gateway for structured telemetry
- **BL-50** — Link-rewrite property tests: 9 `proptest` cases covering rename, symlink, and nested path scenarios in `crates/vault/src/link_rewrite.rs`
- **BL-72** — Canvas `resvg` snapshot offloaded to worker thread for non-blocking renders
- **BL-73** — Background textbundle export runs off the main thread via daemon job queue

### TypeScript / UI

- **BL-17** — Lazy Monaco loading via `React.lazy()`; Monaco ~350 KB gzipped bundle fetched only on first switch; `docs/architecture/EDITOR_ENGINES.md` documents dual-engine roles
- **BL-19** — Keyboard shortcut editor in Settings with per-command rebinding and conflict detection
- **BL-20** — Hunspell 11 locales bundled (en, de, fr, es, pt, it, nl, pl, ru, uk, tr); LanguageTool defaults to self-host endpoint
- **BL-22** — CSS token extraction: 414 lines of component/layout tokens moved from `App.css` to `src/styles/tokens/components.css` (13 shell/layout tokens) and modular CSS files
- **BL-24** — Graph keyboard navigation (arrow keys, Enter to open, Escape to exit); `axe-core` CI gate added (`check:a11y-axe` in `check:release`)
- **BL-25** — Three-way conflict UI with base column, inline line metadata, and accept-left/accept-right/accept-both controls
- **BL-26** — Scheduled vault snapshot UI with cron-style scheduling and retention policy in Settings
- **BL-49** — Visual regression Playwright tests (`playwright.visual.config.ts`, `test:visual` script)

### Automation / MCP

- **BL-85** — MCP stdio expansion: 15 tools (vault CRUD, search, graph, export, git, health, config, canvas, plugin dispatch); enhanced audit with JSONL append and rotation

### Documentation

- **BL-34** — `docs/architecture/CITATION_ENGINE_EVAL.md` — native Rust citation engine evaluation scaffold
- **BL-37** — `docs/architecture/LOCAL_EMBEDDINGS.md` — local embeddings and vector index architecture
- **BL-39** — `docs/architecture/WASM_PLUGINS.md` — WASM plugin runtime architecture
- **BL-41** — `docs/architecture/HEADLESS_SSG.md` — headless SSG/CI export pipeline architecture
- **BL-42** — `docs/architecture/I18N_FRAMEWORK.md` — internationalization framework architecture
- **BL-45** — `docs/architecture/ENCRYPTION_AT_REST.md` — vault encryption at rest architecture
- **BL-40** — Plugin author guide (`docs/plugins/AUTHOR_GUIDE.md`) with hello-world plugin walkthrough and reference plugin catalog

### CI / DevOps

- **BL-48** — Devcontainer configuration (`.devcontainer/`) and Nix flake (`flake.nix`) for reproducible development environments
- `check:a11y-axe` (`axe dist/index.html --rules wcag2a,wcag2aa,wcag21aa --exit`) added to `check:release` pipeline
- `test:visual` (`playwright test --config playwright.visual.config.ts`) added for visual regression
- `check:deny` (`cargo deny check`) and `check:audit` (`pnpm audit --prod`) added to `package.json`

## [0.1.0-session-23] - 2026-06-27

### Rust / Kernel

- **BL-60** — All static-pattern `Regex::new` calls in the vault crate converted to `LazyLock` pools (`lint.rs`, `rename.rs`, `section_rename.rs`, `textbundle.rs`, `tag_rename.rs`)
- **BL-79** — Verified zero-copy `decode_body` already in place (`&[u8]` borrow, no `.to_vec()`)
- **BL-78** — Verified daemon endpoint PID verification (`verify_endpoint_process()` via OS APIs)
- **BL-82** — Verified RAII shutdown cleanup (`EndpointCleanup` Drop removes endpoint file)
- **BL-15** — Added `deny.toml` for `cargo-deny` with advisory, ban, license, and source policies; added `check:deny` and `check:audit` scripts

### TypeScript / UI

- **BL-71** — Fixed React 19 `set-state-in-effect` and `refs` violations in `App.tsx`; added `editorToc` state with `useEffect` sync; layout sync moved to `useLayoutEffect`
- **BL-74** — `tsconfig.contracts.json` now enforces `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true`

### Documentation

- **BL-46** — Expanded `docs/release/PANDOC_STRATEGY.md` with comprehensive Pandoc GPL/AGPL licensing boundary section

### CI / DevOps

- `check:deny` (`cargo deny check`) and `check:audit` (`pnpm audit --prod`) added to `package.json`

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
