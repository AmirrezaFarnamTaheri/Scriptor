# Changelog

## Unreleased

### Fixed
- Reworked the footer as a compact, expandable status dock. At intermediate widths and saved zoom levels, the write area, vault, and inspector now reflow without overlapping or escaping the viewport.
- Restored the original tile-built Scriptor mark and made its gradients follow the active theme.
- Screenshot capture now waits for fonts, images, lazy panels, previews, and layout to settle, and fails when loading or degraded states remain. Updated the README with current captures.
- Fixed Windows release smoke checks by avoiding a rebuild of the running `xtask` executable and launching package-manager `.cmd` shims correctly.
- Wired the existing template picker and Obsidian importer into the vault menu and command system; replaced the sidebar's unbounded template list with a searchable, keyboard-complete picker.
- Made the inspector store the canonical runtime surface for plugin consent, MCP mode/audit, subsystem hibernation, and workspace layout presets; clarified that the separate palette center controls built-in modules and themes, with a direct route to the runtime marketplace.
- Reduced the recorded initial renderer graph from 442,797 to 427,547 gzip bytes (−3.4%) by deferring the runtime store, built-in module/palette center, Reader, template picker, and Obsidian importer until first use; remote marketplace fetching now waits for the store to open, and store tabs/cards remain navigable at high text zoom.
- Added keyboard-complete, viewport-bounded top-bar customization, including Escape focus restoration and resize, scroll, and high-zoom handling. The Support Scriptor action now uses a filled red heart.
- Corrected the support panel's AGPL license text and replaced its vague donation copy with direct labels and instructions.
- Made plugin installer profiles publish one coherent state transition, preserve third-party plugins, report the actual active preset, serialize native persistence, restore temporary theme previews on close, and remain usable at narrow widths and reduced motion.
- Kept PDF/EPUB documents visible when annotation metadata fails, and removed an invalid empty `tablist` that blocked the axe WCAG gate.
- Hardened the unstaged native/indexer work: authorization capacity now fails explicitly, Google resource IDs are bounded, task filters stay parameterized, v8→v9 alias migration is truly idempotent, wikilink resolution reuses the index cache, and note saves avoid redundant reads.
- Made generated Rust operation catalogs `rustfmt`-stable so contract generation and the workspace formatting gate can remain green together; normalized the existing Rust formatting drift.
- Made release timeout probes tolerate slower PowerShell startup while still proving recursive cleanup, and excluded both functional and visual browser build outputs from lint and Git.
- Enforced the vault-backed `scriptor.gmail-manager` capability at every native Gmail command, including read/auth operations, so a disabled optional plugin cannot be invoked directly through the renderer boundary.
- Raised Light Modern warning-accent and Solarized Dark body-text contrast above the WCAG UI/text floors and added catalog-wide contrast regression coverage.
- Added an incubating native Gmail bridge for message listing, reading, label transitions, trash, and sending. OAuth uses the existing PKCE/keychain integration and every mailbox mutation is native-authorized; the unhandled plugin catalog/UI exposure remains withheld until a real manager surface is composed.
- Preserved spellcheck after the locale catalog was narrowed: previously saved unavailable locales now normalize and persist to the shipped `en-US` dictionary instead of leaving the selector blank and spellcheck empty.
- Added local recovery boundaries for the newly deferred overlays, so a failed lazy chunk can be dismissed without taking down the writing workspace.
- Made the lightweight archive CLI reject missing option values and unknown flags through its normal error path with a nonzero exit code, rather than exposing an uncaught Node exception.
- Reduced the initial renderer bundle from 505,913 to 442,797 gzip bytes (−12.4%) by deferring six conditionally-mounted overlays (writing targets, conflict resolver, cheatsheet, onboarding tour, support, perf HUD) behind `lazy()` boundaries — chart.js no longer loads at startup and is fetched only when the writing-targets panel opens; panel code follows the existing `lazyPanels` + `Suspense` + `PanelFallback` conventions.
- Advertised spellcheck locales now match shipped dictionary assets: the locale picker no longer offers ten locales whose Hunspell `.dic` files do not exist (silent empty word sets), and a new dependency-free contract gate fails the build if `LOCALE_MAP` ever advertises an asset missing from `public/dictionaries/`.
- Ported the packaging archive builder from Python to dependency-free Node (`scripts/packaging/zip-lite.mjs`): excluded dependency/build trees are pruned during traversal instead of enumerated-then-filtered, output archives are now byte-for-byte reproducible (fixed DOS timestamps), and the packaging gate no longer requires Python on the host.
- Removed stale root-level duplicates with zero references (`export-theme.css`, `dictionaries/en_US.dic` — the live copies live in `public/` and `crates/export-runner/assets/`), the served-purpose `fix_lint.py` scratch script, a stray GitHub-404 log, and six empty unreferenced scratch directories.
- Bound daemon-sidecar staging to source identity: local builds are the default, GitHub downloads require an immutable tag matching VERSION plus a version handshake, and every staging writes a SHA-256 receipt; packaged smoke now hard-fails on missing installers, sidecar, or receipt.
- Removed quadratic paths from vault-health diagnostics (per-link index rebuilds and per-asset note rereads) and made incremental indexing skip whole-vault bibliography scans and no-op link updates; task queries fetch tags in bounded batches instead of one query per task.
- Renamed the mislabeled startup benchmark to scan_single_iter_ms so the two-second cold-shell target is no longer claimed by a vault-scan metric.
- Hardened the validation container: base image pinned by digest, Rust toolchain pinned to 1.96.0, and no pipe-to-shell installer.
- Added nightly 5k and weekly 25k performance trend workflows above the mandatory 1k PR gate.
- scriptor-daemon now reports its version via --version for release identity checks.
- Fixed a Git-panel regression where the initial status fetch issued during vault open was discarded as stale, leaving status content empty, commits blocked, and conflicts undetectable; status is now stored per vault so open-flow responses can never be lost or leak across vault switches.
- Normalized Rust formatting drift across publish-runner, capture, indexer, and desktop publish commands, and added a rustfmt workspace check to CI so the documented formatting gate is actually enforced.
- Excluded the Playwright E2E build output directory from ESLint and Git so running browser suites before lint no longer floods the warning-zero gate with minified-bundle errors.
- Stopped tracking generated fixture-vault index caches and excluded them from Git so test and benchmark runs no longer leave binary churn in the working tree.
- Removed the stale pre-Git remediation board from the shipped tree and pointed the product-baseline document at the authoritative VERSION file instead of a pinned number.

- Prevented E2E editor fault injection from leaking into desktop builds by rejecting test-only markers in production assets and clearing inherited E2E mode during screenshot-to-desktop builds.
- Made the editor render fallback recover Monaco crashes into the supported CodeMirror editor instead of retrying the same failing engine loop.
- Made Cargo lockfile validation independent of Windows CRLF checkout normalization, so source and governance gates use the same semantics locally and in CI.
- Added behavioral loopback coverage for capture HTTP responses and strengthened HTML-to-Markdown table assertions after dependency upgrades.
- Made search cancellation clear its loading state, protected native Canvas template failures from being reported as successful local insertions, and restored full modal semantics to Canvas.
- Prevented workspace shortcuts from intercepting keyboard interaction inside native select controls.
- Updated release kickoff concurrency so a newer explicit request can replace an unapproved stale request; missing Rust evidence artifacts now fail CI visibly.
- Standardized local release scripts on PowerShell 7 and documented browser-driver requirements for the axe gate.
- Hardened local Starlight publishing around a server-derived plan, explicit `publish: true` opt-in, stale-hash checks, managed-only deletion, atomic writes, symlink/path confinement, output-drift repair, and native one-time authorization.
- Corrected FTS5 body snippets and BM25 column weighting, and removed the phantom ranked-search Tauri call from Smart Collections in favor of the implemented DQL engine.
- Serialized desktop Git mutations and bounded the reusable native Git mutation queue.
- Fenced vault switches behind active native command leases; serialized overlapping opens; and prevented stale editor, workspace, session, Git, Canvas, plugin-state, and preset completions from replacing a newer vault's state.
- Made vault JSON history/recent updates cross-process safe, hardened watcher replacement, and moved native Git execution and conflict writes through bounded, atomic platform boundaries.
- Closed Google Calendar disconnect authorization, restored the renderer/native bridge boundary, and removed unreachable incubating embeddings from the default desktop product graph.
- Corrected workspace package declarations/lock metadata, Tauri command contracts, plugin Rust backend identities, and source-test discovery so hidden dependency and phantom-command drift fails fast.
- Removed the unimplemented Zotero-sync product claim; the standalone connector now validates credentials at Zotero's current-key endpoint, confines credentials to the official HTTPS API origin, and does not write arbitrary vault paths.
- Reconciled release documentation with the intentional unsigned-but-attested upstream installer policy.

### Verification

- Added browser regressions for horizontal and vertical workspace containment, full-width dock composition, dock disclosure semantics, and exclusive write/inspector panes at 200% app zoom; regenerated the reviewed documentation screenshots.
- Added browser coverage for template and Obsidian entry points, interactive store feature/layout controls, and four-section store navigation at 200% text zoom.
- Added browser regressions for top-bar customization at narrow/high-text-zoom layouts, toolbar popover focus, the support-heart treatment, and Reader availability when annotations cannot load; added source tests for atomic plugin-profile derivation and preservation of unknown plugins.
- Added artifact-level regression coverage proving production bundle validation rejects compiled E2E editor crash hooks.
- Added dependency-free contracts for publishing, authorization, Git serialization, workspace boundaries, Tauri command registration, Cargo lock consistency, plugin backend resolution, and complete lightweight test ownership.

## 1.0.0 — 2026-08-17

Scriptor 1.0 is the current, single-schema product baseline.

- Plugin capability decisions are vault-backed and enforced by native, daemon, and MCP boundaries.
- Canvas documents use canonical, collision-free file names.
- Browser UI state uses the current versioned envelope only; legacy local-storage formats are rejected and quarantined.
- The release pipeline produces immutable, source-bound artifacts with checksums, SBOMs, receipts, and attestations.
- Historical change entries and migration narratives are intentionally not part of the v1 product contract.
