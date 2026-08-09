# Changelog

All notable changes to Scriptor are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Repository hardening (2026-08-05)

- Historical hardening made signing fail closed; the 0.1.1 policy supersedes it with explicit unsigned, architecture-bound status evidence and receipt schema 4.
- Added source-bound trust-status evidence and pre-publication verification; official 0.1.1 assets are verified by checksums and GitHub attestations.
- Added dedicated Playwright functional and visual CI gates with retained failure reports.
- Replaced six explicit E2E skips with deterministic canvas, integrity-warning, and native MCP audit coverage.
- Added an executable, expiring RustSec exception ledger with ownership, reachability, upstream references, and exit conditions.
- Deepened the application shell, MCP tool contracts, CLI command-line model, and daemon command catalog into owned modules with tighter size ratchets.
- Reconciled historical frontend audit documentation with the final verified and merged state.

### Audit remediation (2026-08-03)

- Pinned every privileged GitHub Action to an immutable commit and tightened the verified-action inventory.
- Bound SBOMs, receipts, checksums, subjects, and release verification to one clean Git commit and deterministic source-tree hash; the identity hashes canonical Git blobs and modes in one bounded batch, remains stable across line-ending normalization, and rejects staged, unstaged, or untracked drift. Unreceipted artifacts, unsafe paths, symlinks, stale source, and checksum drift now fail promotion.
- Split Monaco and CodeMirror into lazy entry points and added a falsified production-manifest graph and gzip-budget gate.
- Made ESLint warning-zero and refactored React Hooks warning sources instead of suppressing them.
- Centralized destructive note deletion into one ordered, duplicate-safe controller with stage-specific failure tests.
- Replaced file-wide process exceptions with a unique, expiring per-launch inventory and negative-policy tests.
- Split the six largest coordination hotspots into focused owners and added a size/ownership regression ratchet.
- Rebuilt the 1,000-note benchmark around a release executable, exact fixture cardinality/hash, robust JSON parsing, and p50/p95 metrics.
- Added CSS custom-property validation, defined missing semantic tokens, removed the global reduced-motion kill switch, and removed startup debug logging.
- Updated product context and added a finding-by-finding remediation and verification record.

### Security and authority

- Added scoped one-time native authorization for secret, network, process, Git, backup, publish, and destructive operations.
- Removed generic keychain reads from JavaScript; AI provider credentials remain inside the native boundary.
- Added one external-process broker with executable, environment, network, sandbox, timeout, output, and process-tree policy.
- Removed implicit remote PlantUML/font fallbacks, inline-script CSP permission, and incomplete updater exposure.
- Removed stale updater lock entries, generated permission schemas, and UI copy so the disabled capability cannot re-enter through checked-in artifacts.

### Correctness, recovery, and scale

- Fixed graph traversal depth/path provenance and selected-file Git commit isolation.
- Added durable MCP intent/outcome auditing, idempotency, hash chaining, rotation, and pending-intent reconciliation.
- Added bounded daemon event queues, watcher generation recovery, secondary SQLite indexes, batched knowledge/link queries, and bounded scans.
- Split local recovery snapshots from verified external disaster-recovery backups with manifests and restore journals.
- Added runtime JSON validators and versioned/quarantined persisted UI storage.

### Release and governance

- Added canonical `VERSION`, immutable action pins, fixed toolchains/runners, lockfile immutability gates, explicit unsigned status, checksums, CycloneDX SBOM, release receipts, and attestations.
- Corrected AGPL/commercial-license wording and documented contributor relicensing authority.
- Added current architecture, capability maturity, release security, operations, deep-module, and encryption threat-model documents.
- Added repository-native version, action, package-boundary, locale, docs, and source-contract validators.

### UI and accessibility

- Added modal focus containment/restoration and complete tab keyboard semantics.
- Corrected Knowledge Workbench labels and locale parity.
- Standardized semantic tokens, responsive states, reduced motion, and visual/accessibility release expectations.
- Removed unsafe editor/preview type assertions, repaired note-tab composite controls, and added responsive graph, import, empty, and error surfaces.
- Added a fail-closed frontend quality validator for explicit `any`, remote fonts, emoji controls, critical inline styles, typed contracts, modal focus, and compact layouts.
- Made the editor inherit the shell light/dark theme until explicitly overridden and raised tertiary-text contrast across primary surfaces.

### Verification and closure

- Added a finding-by-finding remediation report, exact verification record, production release checklist, frontend quality standard, CODEOWNERS policy, and canonical-history audit script.
- Every due-diligence item now has an explicit source remediation, controlled experimental posture, release-environment gate, or canonical-history gate.

## [0.1.1] - 2026-08-06

### Release reliability

- Removed certificate and signing-secret dependencies from official GitHub Releases; installers are explicitly unsigned and release notes disclose unknown-publisher warnings.
- Unified Windows x86_64, macOS aarch64, Linux x86_64, and Linux aarch64 packaging under one release owner with exact installer staging.
- Added architecture-bound trust-status evidence, receipt schema 4, flat SHA-256 checksums, CycloneDX SBOM, and GitHub attestations.
- Added immutable tag kickoff and safe re-dispatch so a failed publication can recover without moving a tag.

### Editor interface

- Portaled Typography and Insert menus to the viewport so the writing and split-preview surfaces cannot clip them.
- Added keyboard navigation, Escape/outside-click dismissal, focus restoration, and scroll/resize repositioning.

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
- GitHub Actions CI and release workflows (0.1.1+ official assets are intentionally unsigned with explicit status evidence, checksums, and attestations)
- Container smoke image for headless validation
- Devcontainer configuration (`.devcontainer/`) and Nix flake (`flake.nix`) for reproducible development environments
- `check:a11y-axe` (`axe dist/index.html --rules wcag2a,wcag2aa,wcag21aa --exit`) added to `check:release` pipeline
- `test:visual` (`playwright test --config playwright.visual.config.ts`) added for visual regression
- `check:deny` (`cargo deny check`) and `check:audit` (`pnpm audit --prod`) added to `package.json`
- `tsconfig.contracts.json` now enforces `verbatimModuleSyntax: true` and `erasableSyntaxOnly: true`
- Added `deny.toml` for `cargo-deny` with advisory, ban, license, and source policies

**Historical note:** this release description predates the current maturity ledger. Current support and verification status are documented in `docs/CAPABILITY-MATURITY.md` and release evidence.

[0.1.1]: https://github.com/AmirrezaFarnamTaheri/Scriptor/releases/tag/v0.1.1
[0.1.0]: https://github.com/AmirrezaFarnamTaheri/Scriptor/releases/tag/v0.1.0
