# Changelog

## Unreleased

### Added
- Opt-in semantic (embedding) search: a vault config `semantic` section enables ollama (local) or OpenAI embeddings; sync embeds only changed notes (sealed spans redacted first, deletions and model changes pruned), and search returns nearest notes for a hybrid overlay. Unconfigured vaults keep keyword-only search with no new network calls.
- Bibliography (`.bib`) parsing now runs through the citation engine (hayagriva's BibLaTeX grammar) instead of a hand-rolled regex scan: quoted values, nested braces, and `@string` macros parse correctly, fields can no longer bleed between entries, and a file that cannot be parsed is skipped with a warning instead of failing the whole vault rebuild. Author names normalize to "Family, Given" and entry types map to their canonical CSL kinds for the citation renderer.
- Source-test and version-contract file discovery now goes through git (`ls-files`, tracked plus untracked-not-ignored), so ignored build output can never enter the gates while brand-new tests still run without a commit.
- Improved high-volume vault performance: wikilink resolution reads the SQLite index instead of scanning every note, full rebuilds commit in 500-note batches, the search index keeps a 256MB memory map, only the word being typed gets a prefix-match wildcard, file watchers ignore internal metadata folders, the graph canvas caches theme colors outside its draw loop, history snapshots are throttled during rapid autosaves, and preview renders are cached by content. Release builds now ship with thin LTO, stripped symbols, and the mimalloc allocator.

### Fixed
- The daemon's transport tests import the two framing helpers they use. Moving frame I/O into
  `transport/framing.rs` trimmed the parent module's imports, and the test module had been resolving
  `read_frame_resyncing`/`write_frame` through that parent scope, so `scriptor-daemon (lib test)`
  failed to compile with four `E0425` errors - invisible for a while because clippy's other errors
  ran first and the log tail only showed those.
- The daemon no longer stores an endpoint nonce that nothing reads. `main` verified each request
  against that `DaemonState` copy and skipped authentication when it was unset; the transport now
  compares requests against the nonce taken from the endpoint file it wrote and refuses to serve
  without one, and the field's leftover has been removed along with the IPC source contract that
  asserted the copy instead of the check.
- The daemon no longer carries an endpoint nonce in `DaemonState` that nothing reads. The IPC
  contract test asserted that field's construction, which hid the point of the refactor: the
  transport now compares each request against the nonce it took from the endpoint file it just
  wrote, and refuses to serve at all when that nonce is missing, so an endpoint file that failed to
  record a nonce can no longer leave requests unauthenticated. The contract test asserts the
  comparison and the refusal instead of the vestigial field.
- Loading a canvas board validates the parsed file instead of casting it. A `.canvas` file that is
  valid JSON but not a canvas document (a truncated write, an edit made outside the app) used to be
  handed straight to the renderer, where the missing layers or blocks array threw; the board is now
  left as it was and the panel says why.
- `clip` names a new note after the captured page title even when that title has no ASCII
  alphanumerics. The filename slug kept only ASCII letters and digits, so a Japanese, Greek, or
  emoji title slugged to nothing and produced a note named after the timestamp alone; the title is
  now used directly, minus path separators and control characters, with its limit counted in
  characters so a multi-byte title cannot be cut in half.
- `scripts/ci/invoke-logged.ps1` keeps the *end* of a failed step's log when it shortens the CI
  annotation and strips the per-line timestamp prefixes. The old truncation kept the first 3 500
  characters of a 20-line tail, which is exactly the part that never contains the failing
  diagnostic, so heavy steps reported "exit code 1" with the real error cut off; the annotation now
  also lists the last `==>` stage markers so the running step is identifiable.
- Renaming a note no longer rewrites wikilinks, markdown links, and reference definitions that a
  note quotes inside a fenced code block or an inline code span. The rename rewriter replaced
  matches across the whole document, so documentation *about* links was silently edited, while the
  tag rewriter already skipped those regions; link rewriting now follows the same rule and keeps
  every byte outside the rewritten links, including CRLF endings and trailing blank lines, intact.
- Truncating a public error message in the daemon walks back to a UTF-8 char boundary before
  cutting at 2048 bytes. `String::truncate` panics on a mid-character index, so an error naming a
  note with a non-ASCII title or path long enough to hit that limit could panic the request handler
  instead of being redacted; the ellipsis is also appended with `push` now that it is a char.
- Task indexing writes the canonical note id into `tasks.source_note_id` again. Separating that
  column from `source_note_path` left every producer still passing a vault-relative path, and
  because the column carries a foreign key on `notes(id)` with `foreign_keys=ON`, an incremental
  index (a note save, `indexer_sync_note_tasks`, a single-note rebuild) aborted with
  `FOREIGN KEY constraint failed` and rolled the whole write transaction back — the failure the
  Windows release smoke reported. `sync_note_tasks` now also mirrors `source_note_path` from the
  notes row, so the navigation path no longer survives only in migrated caches while every
  re-index leaves it null, and the task row, the DQL `task:` projector, and the desktop task
  update all read the path from that column instead of decoding a note id as a path.
- Deleting or moving a note out of the index reconciles its task rows by canonical note id. The
  `tasks` filter still matched on `source_note_id` with a vault-relative path, so the retired
  note's tasks and their tags survived in the cache and kept appearing in task queries.
- The MCP browser end-to-end harness now binds a vault identity. The draft tools started requiring
  a stable `vaultId` to stamp a proposal, so `mcp.proposePatch` threw inside the harness, every
  write-approved scenario came back `mcp.invoke_failed` with an empty draft queue, and all five
  MCP specs failed. `packages/mcp` additionally pins the new guards with behavioral tests: a
  missing vault identity is refused, a runtime without a write bridge must not advertise its tool,
  a draft cannot be approved twice, and a draft cannot be approved after the runtime is rebound
  to another vault.
- Cleared the remaining `clippy -D warnings` failures in the daemon: the outside-lock capability
  check in `transport.rs` is a single let-chain, and the subscriber snapshot in
  `events.rs` documents why its `collect` has to stay (it releases the lock before delivery)
  instead of tripping `needless_collect`.
- `scripts/validation/tui-smoke.mjs` streams the smoke output live *and* re-emits its tail when
  the run fails. The child previously inherited stdio, so the CI annotation carried only
  "command failed with exit code 1" and gave no way to distinguish a compile error from a
  runtime panic.
- Recovering or aborting an interrupted note rename whose transaction manifest predates the
  original/intended hash records again restores every rewritten note's backup and rolls the file
  move back. Previously those manifests either kept links pointing at a file the rename never
  created, or the rollback was rejected outright as a hash mismatch against an empty expectation.
- Reader panels derive the viewer location and frame readiness from the document type they were
  resolved for, instead of clearing that state from inside an effect. Switching documents no longer
  renders the previous viewer for a frame, and the React cascading-render lint rule passes again.
- Pinned the transitive `@xmldom/xmldom` that `epubjs` pulls into the desktop bundle to 0.9.12, so
  `pnpm audit --prod` and the supply-chain gate no longer report GHSA-6gmq-8vp8-gcm6.
- Restored the logged invocation of the desktop crate compile step: a Rust compile failure now keeps
  reporting its compiler diagnostics as a check annotation, with the per-step timeout and evidence
  log the inline wrapper had dropped.
- Split the daemon transport module's deadline-bounded frame I/O into
  `crates/daemon/src/transport/framing.rs`, bringing `transport.rs` back under its module-size
  ratchet instead of leaving the split half-finished.
- Adapted `crates/vault` to the `fs4` 1.x API it was bumped to (1.x has no `fs_std` module and names
  the exclusive lock `FileExt::lock` instead of `lock_exclusive`; the call is written as a qualified
  path because std's newer inherent `File::lock` would otherwise shadow the trait method), which was
  the sole reason every Rust job on the branch failed: the unresolved import aborted the build before
  any other crate was checked. With vault
  compiling again, three further errors in the daemon transport surfaced and are fixed here: the
  endpoint nonce is cloned into `DaemonState` instead of moved out of the endpoint that is still
  needed for the expected nonce and endpoint recovery, the nonblocking disconnect probe reads
  through `std::io::Read` (which the module no longer imported), and the queued `git_push` call is
  wrapped in a closure so the queue's `&PathBuf` repository root coerces to the `&Path` the git
  helper takes. The nested `if let` in `save_note_with_options` that
  `cargo clippy --workspace --all-targets -- -D warnings` rejected is now a single let-chain.
- Re-exported the guarded rename entry points (`rename_apply_guarded`, `rename_apply_staged_guarded`)
  from `scriptor-vault`'s crate root. The rename pre-condition was added to the rename module without
  extending the root re-export list, so the daemon's rename dispatch and the desktop
  `vault_rename_apply` command referenced names that were never in scope; the desktop command also
  still imported the unguarded `rename_apply` while calling the guarded form.
- Fixed docked side panels (git, MCP, settings, knowledge) rendering beneath the sticky top bar: the dock now starts below the bar and its header and tabs are always reachable; visual baselines and README captures were regenerated for the corrected geometry.
- Smoothed the typing path: word counting no longer allocates a word array per keystroke, draft stats and citation extraction render from deferred draft values, glass blur tiers were lightened (16px default), and reduced-transparency now strips modal and palette backdrop blurs as well.
- Resolved the 2026-08-30 forensic review findings: OAuth stateless-probe handling, daemon outside-lock read-only scans, truthful export-history running state, chrome preference persistence and validation, top-bar i18n coverage, reduced-transparency and resize coalescing, portable Playwright web servers, a container gate that executes the contract suite, and worktree-proof source-test and version walkers.

### Changed (behavior that may affect existing vaults)
- **Vault scan no longer hides notes under `target/` and `dist/`.** Only unambiguous tool directories (`.git`, `.scriptor`, `.obsidian`, `.trash`, `node_modules`) are excluded from the recursive scan and incremental watcher. If you kept authored `.md` notes under a `target/` or `dist/` folder, they are now indexed, searchable, and resolvable again; conversely, a genuine build cache inside the vault will again generate scan/watcher activity.
- **Path-portability restrictions are now enforced on Windows only.** NTFS alternate-data-stream aliases (`note.md::$DATA`), reserved device names (`CON`, `NUL`, `AUX`, `COM1..9`, `LPT1..9`, `CLOCK$`), and trailing dots/spaces are rejected when running on Windows (where they are unsafe). On Unix/macOS these are legal file names and are no longer rejected, so notes titled e.g. `Meeting: notes.md` work again. Vaults intended to sync to Windows should still prefer Windows-safe names.
- **Save CAS treats a blank expected-content-hash as "no precondition".** An empty/whitespace expected hash no longer fails a create-new save; callers that genuinely require the note to be absent pass the `<missing>` sentinel, and a real hash against a missing file is still rejected (to avoid resurrecting a concurrently deleted note).
- **MCP mutation-audit verification now anchors the oldest retained segment.** Because segment rotation prunes the oldest file, the head record of the remaining oldest segment legitimately references a pruned predecessor; verification no longer misreports that as a fork/tamper, while every retained record's own hash and all later links are still checked.

- **A rename no longer overwrites a destination that appeared mid-transaction.** The create-only
  write of the renamed note now carries the `<missing>` sentinel, so a note created at the target
  path after the dry-run collision check fails the rename instead of being replaced by it.
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
