# Changelog

## Unreleased

### Added
- Opt-in semantic (embedding) search: a vault config `semantic` section enables ollama (local) or OpenAI embeddings; sync embeds only changed notes (sealed spans redacted first, deletions and model changes pruned), and search returns nearest notes for a hybrid overlay. Unconfigured vaults keep keyword-only search with no new network calls.
- Bibliography (`.bib`) parsing now runs through the citation engine (hayagriva's BibLaTeX grammar) instead of a hand-rolled regex scan: quoted values, nested braces, and `@string` macros parse correctly, fields can no longer bleed between entries, and a file that cannot be parsed is skipped with a warning instead of failing the whole vault rebuild. Author names normalize to "Family, Given" and entry types map to their canonical CSL kinds for the citation renderer.
- Source-test and version-contract file discovery now goes through git (`ls-files`, tracked plus untracked-not-ignored), so ignored build output can never enter the gates while brand-new tests still run without a commit.
- Improved high-volume vault performance: wikilink resolution reads the SQLite index instead of scanning every note, full rebuilds commit in 500-note batches, the search index keeps a 256MB memory map, only the word being typed gets a prefix-match wildcard, file watchers ignore internal metadata folders, the graph canvas caches theme colors outside its draw loop, history snapshots are throttled during rapid autosaves, and preview renders are cached by content. Release builds now ship with thin LTO, stripped symbols, and the mimalloc allocator.

### Fixed
- Closed the supply-chain audit failure that turned the `main` branch red: pnpm overrides bump `@xmldom/xmldom` to 0.9.12 (XML fragment injection via epubjs, GHSA-6gmq-8vp8-gcm6) and `dompurify` to 3.4.14 (four advisories via mermaid/monaco-editor), so `pnpm audit --prod` reports no known vulnerabilities again; the renderer XSS suite, build, and workspace e2e flows all pass against the bumped versions.
- The store panel now renders without a single inline style object: the remaining 45 one-off styles (section tab pills, MCP mode radios, audit rows, feature-flag rows, preset cards, plugin consent sections, banners, shell/tablist/body) moved to state-variant classes in `store-panel.css`, with all four store tabs pixel-verified identical to the previous render.
- The status footer collapses to a single slim row (~52px, down from ~105px) by default: the dock tabs and output panel unmount until the chevron next to the Jobs button reveals them, the choice persists per device, and Jobs/programmatic dock jumps still force the dock open.
- Screenshot capture gained `-UpdateBaselines`: `pnpm screenshots:capture -UpdateBaselines` regenerates (instead of verifying) the win32 baselines and also refreshes the visual-review dark/tablet baselines and the mirrored docs PNGs in one run on the Windows runner.
- The editor theme toggle is now three-state — auto (follow the app theme, the default) → pin light → pin dark — with `aria-pressed` and a spoken label that name the current state; an explicit pin survives app theme flips and auto tracks the app theme in both directions.
- Smoothed the keystroke path end to end: draft stats, citation extraction, the inspector rail, and outline/lint/autocomplete work from one shared `useDeferredValue` draft so heavy re-derivation lags the keystroke instead of blocking it (the editor itself still commits immediately).
- The editor workspace, tab strip, inspector rail, and status footer now speak the configured locale (444 keys per locale, en/de/fa): every toolbar tooltip, toggle label, empty state, export/publishing action, and status readout in those shells is translated instead of hardcoded English.
- Dark-theme note-search placeholder text now uses the secondary text token (≥8:1 on dark surfaces) instead of the browser-default ~4.2:1.
- E2E coverage tracks the new dock default: the width-reflow test now exercises the chevron reveal (dock unmounted → expanded → clean → Output panel) and `waitForWorkspace` no longer demands the top-bar vault badge that yields at tight widths by design.
- The store panel's repeated flex/typography patterns moved from 32 inline style objects to shared `store-panel.css` classes; one-off micro-styles stay inline, and the leftover `console.log` in the delete-note controller validation script is gone.
- The right inspector panel no longer overlaps or stacks on top of the editor at desktop widths: the workspace grid now squeezes its vault sidebar and inspector rails proportionally (width caps shared as percentages of the workspace), so all three columns stay docked side by side from ultrawide down to the mobile reflow, and manual resizes still win whenever they fit.
- Hardened the Monaco wrapper against out-of-order value echoes: a stale parent-state re-render could call `setValue` over newer model content under heavy load, reverting just-typed keystrokes; external values (note switches, transforms, file reloads) still apply, echoes never do.
- Added RTL mirroring for the Persian locale: the vault/inspector rails, docked side panel, collapsed-rail placeholders, and tooltips now flip to the right-to-left reading side instead of keeping left-facing artifacts.
- Preview task-list checkboxes now expose an accessible name ("Open task" / "Completed task") instead of an anonymous checkbox for screen readers.
- Docked right-hand panels (Portal, Git, MCP, quick capture, note history) now reserve their real 720px dock width instead of a blanket 480px: they no longer covered the inspector and part of the editor, and the rails share the squeeze so the editor keeps a usable column whenever a dock is open.
- Unified the top bar into a single row: the mode strip, command search, and quick actions no longer wrap into three stacked sub-bars below 1500px (54px tall at every desktop width instead of 166px); sections compress in priority order and the top bar stays a single row.
- Primary top-bar navigation can no longer shrink into an invisible internal scroller: the workspace-mode strip keeps its full width (all five modes always reachable), while redundant lower-priority controls yield at tight widths — the Publish quick-launch icon (still available via the Publish mode and command palette), the MCP status pill (still in the footer subsystem toggles and settings), the vault badge (repeated by the switcher and status footer), and the "Workspaces" switcher label.
- Every modal dialog now dismisses with Escape: the Frontmatter inspector and theme customizer were the only surfaces that ignored it, leaving keyboard users trapped with only a mouse-selectable close button.
- Removed the duplicate "Open vault" icon button inside the workspace switcher (the top bar's "Open Vault" action and the select's "Open another vault…" option already open the same dialog).
- Publish Center no longer prints the format twice per profile ("HTMLHTML", "PDFPDF"); the format chip now appears only when it adds information beyond the profile label.
- The store panel's Plugins/MCP/Features/Layouts tab strip wraps instead of scrolling behind a thin scrollbar, matching every other segmented control in the app.
- The vault name badge and "Open Vault" label now ellipsize or collapse to icon-only instead of wrapping the top bar onto a second line.
- Fixed docked side panels (git, MCP, settings, knowledge) rendering beneath the sticky top bar: the dock now starts below the bar and its header and tabs are always reachable; visual baselines and README captures were regenerated for the corrected geometry.
- Smoothed the typing path: word counting no longer allocates a word array per keystroke, draft stats and citation extraction render from deferred draft values, glass blur tiers were lightened (16px default), and reduced-transparency now strips modal and palette backdrop blurs as well.
- Resolved the 2026-08-30 forensic review findings: OAuth stateless-probe handling, daemon outside-lock read-only scans, truthful export-history running state, chrome preference persistence and validation, top-bar i18n coverage, reduced-transparency and resize coalescing, portable Playwright web servers, a container gate that executes the contract suite, and worktree-proof source-test and version walkers.

## 1.0.7 — 2026-08

### Fixed
- Made verified production releases publish automatically after the immutable exact-commit CI, packaging, quality, provenance, SBOM, checksum, and evidence checks pass; no protected-environment approval wait remains in the release path.

## 1.0.6 — 2026-08

### Fixed
- Removed a stale post-tag `release-smoke` assertion from the unified release-evidence graph; it now validates the complete declared source-bound quality gate, allowing verified installer publication after the protected exact-commit CI checks pass.

## 1.0.5 — 2026-08

### Fixed
- Moved platform-specific release smoke and visual baseline checks to the protected exact-commit CI gate, preventing Linux post-tag runners from requiring Windows tooling or absent Linux snapshot baselines.

## 1.0.4 — 2026-08

### Fixed
- Avoided re-running the protected exact-commit CI Rust suite after tagging, so hosted-runner interruptions cannot prevent the remaining source-bound release checks from publishing verified installers.

## 1.0.3 — 2026-08

### Fixed
- Made release-quality verification portable across hosted operating systems, synchronized the MCP runtime version with the canonical release version, and provisioned the debug-only daemon credential required by headless release checks.

## 1.0.2 — 2026-08

### Fixed
- Restored the onboarding tour's primary-action contrast so the release accessibility audit meets WCAG AA.
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
- Added browser regressions for horizontal and vertical workspace containment, full-width dock composition, dock disclosure semantics, and exclusive write/inspector panes at 200% app zoom; regenerated the reviewed documentation screenshots.
- Added browser coverage for template and Obsidian entry points, interactive store feature/layout controls, and four-section store navigation at 200% text zoom.
- Added browser regressions for top-bar customization at narrow/high-text-zoom layouts, toolbar popover focus, the support-heart treatment, and Reader availability when annotations cannot load; added source tests for atomic plugin-profile derivation and preservation of unknown plugins.
- Added artifact-level regression coverage proving production bundle validation rejects compiled E2E editor crash hooks.
- Added dependency-free contracts for publishing, authorization, Git serialization, workspace boundaries, Tauri command registration, Cargo lock consistency, plugin backend resolution, and complete lightweight test ownership.

## 1.0.1 — 2026-08

### Fixed
- Installed `xdg-utils` in the Linux release environment and prepared the 1.0.1 release.

## 1.0.0 — 2026-08-17

Scriptor 1.0 is the current, single-schema product baseline.

- Plugin capability decisions are vault-backed and enforced by native, daemon, and MCP boundaries.
- Canvas documents use canonical, collision-free file names.
- Browser UI state uses the current versioned envelope only; legacy local-storage formats are rejected and quarantined.
- The release pipeline produces immutable, source-bound artifacts with checksums, SBOMs, receipts, and attestations.
- Historical change entries and migration narratives are intentionally not part of the v1 product contract.
