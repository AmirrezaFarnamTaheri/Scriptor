# Verification record

**English** · [فارسی](VERIFICATION.fa.md) · [简体中文](VERIFICATION.zh-CN.md) · [Русский](VERIFICATION.ru.md) · [Deutsch](VERIFICATION.de.md) · [Español](VERIFICATION.es.md)

This document defines the evidence required to verify Scriptor. A result must
identify its exact source commit, environment, target architecture and artifacts.
Results from an older commit cannot certify a newer implementation.

## Evidence and current status

All executable verification for the current review runs on GitHub-hosted workers.
No local application, install, test, build, lint, typecheck or formatter is
authorized for this review. Source inspection and authored regression tests are
recorded separately from passing execution.

| Evidence | Meaning |
|---|---|
| Verified | The stated command ran against the identified source and passed. |
| Statically validated | Source or generated metadata was parsed and checked without running the product. |
| Reviewed | Code, contracts or images were inspected without executable proof. |
| Pending | Required execution or manual evidence has not been established. |
| Failed | The stated command ran and did not pass. |

The [Google integration record](validation/GOOGLE-INTEGRATIONS-2026-10-09.md)
holds the current five-service scope, worker results and provider limits.
[Dependency limitations](validation/SUPPLY-CHAIN-2026-10-04.md) remain explicit;
an unrelated passing lane does not clear a failed audit or release gate.

Historical provenance is linked below, while current PR verification outcomes
are consolidated in this record:

- [Cross-product audit](validation/CROSS-PRODUCT-REVIEW-2026-10-04.md)
- [Visual and zoom review](validation/LEGACY-DIALOG-ZOOM-2026-10-08.md)
- [Screenshot provenance](validation/SCREENSHOT-REFRESH-2026-10-08.md)
- [Workspace customization](validation/WORKSPACE-SHORTCUTS-2026-10-08.md)
- [Historical verification records](validation/HISTORICAL_VERIFICATION.md)

Historical source identities, counts and limitations are preserved in those
records. They are provenance, not current completion claims. Localization
enforcement applies to maintained product and contributor documentation.
Provenance-sensitive audit records under `docs/validation/` and archived
documents remain exempt; active user guides do not.

## MAT-005 Obsidian attachment path and publication safety — October 29, 2026

Stacked draft [PR #229](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/229) addresses two attachment paths beyond the Markdown-only changes in #228. Test-only commit [`de6af81`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/de6af818f83eebd2599b59ce4c26fda9219623fe) adds real Unix filesystem regressions for source attachment symlinks and a destination nested symlink to outside the vault. `WalkDir.follow_links(false)` still yields symlink entries; the previous importer did not reject them and joined paths under `_attachments` without revalidating the nested prefix.

Implementation: skip source symlink/nonregular entries, resolve every destination via `VaultRoot::resolve_relative` after creating parents, copy into a unique create-only staging file, then use atomic `fs::hard_link` publication while holding the existing vault mutation lock. This follows the established offline-PDF publication pattern, not a new authority. Existing destination attachments are reported as skips; staging is removed automatically. The copy may be long, so it runs outside the mutation lock. A source path changed by an adversarial external process after its filesystem-type check is not covered by these ordinary filesystem tests.

Additional filesystem regressions reject the same folder or a nested folder as a destination before any _attachments directory is created; canonical source-path containment is validated before the importer starts walking or writing.

**Verification is pending on the implementation head.** Test-only CI may be queued/canceled and cannot be treated as observed RED; Rustfmt, Clippy, full native tests, browser/desktop/visual and installed-client acceptance are required before merge.

## MAT-005 Obsidian import collision safety — October 29, 2026

Draft [PR #228](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/228) adds two real, filesystem-backed Rust regression cases: an incoming note colliding with authored local content, and repeating an import after editing the previously imported note. The test-only commit [`d8aa3c9`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/d8aa3c9be9342b83bed379f98f1f149a8c099900) predates the implementation; its [CI run #40863276455](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40863276455) was queued, so **no observed failing-first Rust assertion is claimed**.

The importer now calls the existing atomic vault writer with `EXPECTED_MISSING_CONTENT_HASH` rather than a missing precondition. An existing destination note is skipped and reported with a path-specific explanation; new notes still import. No parallel writer, file-existence race, authorization change or silent merge is introduced. **Implementation-head Rust, Clippy, source, desktop, visual and installed-client evidence are pending**, so no release claim follows from this source patch. See `tasks/plans/2026-10-29-obsidian-create-only.md`.

## PR #160 remediation evidence — October 11, 2026

This is the authoritative execution/evidence record for the Canvas, provider Markdown, accessibility and dependency consolidation. All results below are **historical and revision-specific**. They do not certify a newer head or packaged release. The [Canvas engineering analysis](validation/SCRIPTOR-ENGINEERING-AUDIT-2026-10-11.md) and [provider boundary analysis](validation/FORENSIC-REVIEW-2026-10-11.md) contain causes and engineering decisions, not separate outcome ledgers.

| Source and environment | Recorded outcome | Classification and limitation |
|---|---|---|
| `e753f83c6ce2704bdbfaed4d6ddecca6791647b3` · GitHub main | [CI run 38122794749](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/38122794749): 7/8 jobs passed; Browser E2E failed canvas status assertion (465 pass, one fail) | **Failed** at baseline; not evidence about changes on PR #160 |
| Locally patched source archive derived from `e753f83` · Node 22 harness | 19/19 Canvas hook regressions, 245/245 source tests and 63/63 infrastructure/release-contract tests passed | **Isolated source-harness verification**; patch not a Git commit; no native/WebView execution |
| Same patched archive · policy scripts | Frontend quality (793 TS/CSS), documentation contracts (15 documents), Tauri bridge contracts (195 bridged commands / 205 handlers), authorization inventory (55 brokered / 95 read-only / 55 local mutation), immutable actions (13 workflows / 85 uses), locale keys (three locales / 1,102 each), Cargo workspace metadata (21 packages), RustSec exception ledger (12 entries), CSS policy (72 stylesheets) passed | **Static validation only**; no security, cross-platform or provider certification |
| `2df6ca8583b8833c91231bb5904738bc407b7ab0` · GitHub PR #160 | [CI run 38131002060](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/38131002060): Browser E2E, supply chain, Rust tests, container, frontend/a11y, and Windows release/performance passed; contracts/lint failed on `no-useless-escape` in `safeExternalUrl.ts:48` | **Failed overall**; one lint issue, corrected in the subsequent change, requires new exact-head CI |
| `2df6ca85` · GitHub PR #160 auxiliary workflows | [Desktop compile](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/38131002023) passed Linux/macOS/Windows; [Visual review](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/38131002008), [workflow screenshots](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/38131002067), and [documentation localization](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/38131002011) passed | **Verified for that revision only**; newer commits require new runs |

Additional isolated renderer runner results included safe-external-URL, merge, citation, headless and Canvas cases. Full local installation was blocked by package registry access; Cargo, native desktop execution and a supported browser were not available in that earlier local environment. No paired startup, editor-latency, CPU, memory or throughput measurements were obtained.

### Scheduled benchmark failure and remediation

- [Performance Trends run 38129422106](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/38129422106) on `e753f83` **failed** on October 11, 2026. The workflow redundantly generated an already tracked `synthetic-5k` fixture; the CLI refused to replace that path, but PowerShell did not propagate the exit code. The subsequent search producer called a daemon-routed `rebuild-index` without building the daemon binary, so no search evidence was produced.
- The pending PR fix conditionally generates missing fixtures, verifies their note counts, propagates generator failures, and removes the redundant daemon-routed rebuild. The actual `bench-search` CLI performs an in-process SQLite index rebuild before measuring warm queries. The scheduled Windows workflow still requires its own rerun on the updated head; a code review cannot certify performance reports.

### Outstanding engineering and verification

| Priority | Concern | Acceptance evidence still needed |
|---|---|---|
| P1 | Updated exact PR head | Frozen dependency installation, warning-zero lint, contracts, Cargo tests, full Browser E2E, Desktop compile, Visual review and locale workflow on that SHA |
| P2 · CAN-08 | Native save/index partial-success handling | Typed `CanvasSaveOutput` now separates committed persistence from optional relation-index warnings; native forced-index-failure and crash-recovery verification remain required |
| P1 | Vault crash/power-loss and native authorization | Desktop and daemon now reject canvas documents whose embedded vault ID differs from the active session; restore-journal interruption, expired, wrong-vault, denied and oversized command cases still require hosted/native evidence |
| P1 | Live Google/provider and packaged OAuth | Controlled accounts, scope/consent/token lifecycle and disconnect/recovery evidence for packaged apps |
| P2 | Process and plugin isolation | Resource/time/process-tree termination and memory/CPU-bound checks on supported platforms |
| P2 | Editor fidelity | Large documents, IME, RTL, source/preview, tables, math, citations and format round trips with no unintended changes |
| P2 | Manual UI and accessibility | Keyboard/screen-reader checks and 320–1440px, RTL, 200% zoom, high-contrast and reduced-motion review |
| P2 | Performance scale | Comparable same-host before/after startup, search/index, memory and large-vault results |

A missing manual measurement is not a demonstrated product bug. These historical results do not replace the immutable source identity and artifact evidence required for release.
## Repository-native checks

Hosted workers run the repository checks from the repository root:

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

`check:source` covers generated IPC contracts, Rust source/module/process/unsafe policy, native authorization, frontend policy, hotspot ownership, benchmark utilities, release trust/evidence contracts, and the RustSec exception ledger. `check:governance` covers version parity, immutable Actions, package boundaries, locale parity, documentation/license contracts, frontend policy, and hotspot ownership.

## Full engineering gate

A release candidate is not verified until these commands pass on hosted workers in a clean environment with the toolchains pinned by the repository manifests and frozen lockfiles:

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

`pnpm build` includes the production bundle graph and initial gzip budget check. Warning-zero ESLint is part of `pnpm lint`.

`pnpm check:release` invokes PowerShell scripts through PowerShell 7 (`pwsh`), so contributors on Linux and macOS need `pwsh` installed. The axe gate requires a ChromeDriver compatible with the local Chrome build. When its automatic driver discovery is unavailable, set `CHROMEWEBDRIVER` to the directory containing the driver before running `pnpm check:a11y-axe`.

## UI and accessibility gate

```bash
pnpm test:e2e
pnpm test:visual
pnpm check:a11y
pnpm check:a11y-axe
```

Required manual matrix:

- 320, 375, 768, 1024, and 1440 CSS-pixel widths;
- light, dark, and high-contrast themes;
- Windows, macOS, and Linux desktop shells;
- keyboard-only primary workflows;
- screen-reader smoke test;
- 200% browser/OS text zoom;
- reduced-motion mode;
- empty, loading, error, success, destructive-confirmation, and long-content states.

Toolbar-popover verification must prove that Typography and Insert menus:

- are portaled outside `.editor-toolbar` and its horizontal overflow clipping;
- remain inside the visual viewport after resize and ancestor scrolling;
- reposition through bounded DOM style updates without a React render loop;
- focus the first menu item when opened from the keyboard;
- support Arrow Up/Down, Home, End, Escape, Tab, and outside-click dismissal;
- restore focus to the trigger after Escape dismissal.

Visual evidence captures must wait until the rendered preview has settled (the expected preview
heading is visible and no `.preview-error` is present). Baseline assertions are reserved for stable
core surfaces; transient/state-review screenshots are attached to their hosted browser or visual job instead of
creating missing-baseline failures. Documentation screenshots mirror reviewed Windows baselines
with the platform suffix removed; regenerate them with `scripts/screenshots/capture.ps1`.


### MAT-005 Git mutation stale-error scope — October 29, 2026

[PR #210](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/210) adds four real-hook checks: a failed Git commit, pull or push submitted in vault A must not replace vault B's workspace-wide error state; an A→B→A switch must not revive the first session. Test-first detached commit `397cc6a` preceded the implementation; **a failing-first hosted run was not observed**, so this is not claimed as a completed red-green test cycle.

Production now reuses the existing vault lifecycle guard on the three `setError(detail)` completion paths. Original native failure and activity logging remain intact, and the synchronous mutation busy state still settles. Full exact-head CI and installed desktop acceptance are pending.

## Release and recovery gate

- Build every installer from the exact audited tag.
- Assert that each runner architecture matches its declared target before packaging.
- Produce Windows x86_64, macOS aarch64, Linux x86_64, and Linux aarch64 target sets.
- Transport only installer files and one `signing-evidence-<platform>-<architecture>.json` record per target.
- Separate publication inputs into exactly seven installers under `release-artifacts` and exactly four trust records under `release-evidence`.
- Verify that official target records state `signed: false`, `notarized: false`, and `signatureType: "none"`.
- Run `node scripts/release/verify-signing-evidence.mjs release-evidence production` before generating the receipt.
- Generate `SHA256SUMS` over the seven installer subjects only and receipt schema 4 with the four normalized trust records embedded.
- Run `node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence`; the verifier rejects source drift, a dirty checkout, missing or extra installer subjects, unsafe paths, symlinks, checksum/SBOM mismatch, incomplete target status, and target/source identity drift.
- Verify GitHub provenance and SBOM attestations for every installer plus immutable release-tag lineage.
- Confirm that release notes disclose unknown-publisher behavior and provide single-installer checksum and attestation commands.
- Clean-install each package and record operating-system warnings caused by the explicit unsigned policy.
- Create an external backup, corrupt a copy, prove rejection, and restore on each supported OS.
- Interrupt restore and MCP mutation flows and prove deterministic recovery.
- Run single-pass vault-scan, idle-memory, index, search, graph, editor, and export performance gates.

## Release workflow invariants

- Manual dispatch defaults to preview and never publishes unless `publish: true` is supplied on an existing `v*` tag.
- A release operator manually dispatches `Release Kickoff`; the workflow verifies a successful CI run for the exact commit before it creates an immutable tag. A `VERSION` change alone never creates a tag.
- An existing tag that points to another commit is a hard failure; it is never moved.
- The kickoff workflow requires the exact `VERSION`, creates only an unused immutable tag, and explicitly dispatches the release workflow on that tag.
- Production publication proceeds automatically only after the immutable tag's build and release-quality checks succeed; Pages deployment remains gated by the protected `github-pages` environment.
- Update manifests attach to the immutable version release; no mutable rolling tag is created or force-pushed.
- The unified `Release` workflow is the only GitHub Release owner; the former ARM-specific publication workflow is removed.
- Architecture-bearing filenames prevent collisions when artifacts are merged for publication.
- The release upload boundary excludes unpacked bundle internals and CI evidence.
- Checksums and attestations cover installers, while target trust records remain separately verified release metadata.


## MAT-008 — Git commit expected-vault binding (draft PR #211)

- **Hosted RED:** test-only `06a3a4e482b432238b11621807d01e730162bd70`, [CI #40595869204](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40595869204), source regression: 683 pass, 2 expected failures. The Git commit invocation omitted `expectedVaultId`; an empty vault identity was not rejected.
- **Implementation awaiting exact-head checks:** require the initiating vault in the TypeScript bridge and native Tauri commit command, enforce it before GitQueue, and test native denied/accepted outcomes plus the browser mock.
- **Still pending:** source GREEN, Rust/Windows/Browser E2E/visual/docs, installed-client delayed-invoke acceptance, and daemon/CLI/MCP parity under issue #188. This slice does not complete MAT-008.

## RUSTSEC-2026-0414 — pulldown-cmark advisory remediation

- **Failure observed:** [CI #40661251859](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40661251859) at MAT-008 daemon head `eb19fcb42014531026dac9c4d88f01300f223dc8`. Cargo deny rejected `pulldown-cmark 0.13.4` with advisory RUSTSEC-2026-0414: crafted `[[a|]]` input may cause exponential event growth when `ENABLE_WIKILINKS` is on.
- **Patch:** raise direct workspace minimums to `0.13.5` and update the single Cargo.lock entry. The crates.io index confirms checksum `278e9268c93b9e498a2da46c34d90ba93a3255eb99009646398f34bc73ab36eb`; both versions have the same normal dependency set and feature flags. No security ignore is introduced and no application parser feature is disabled.
- **Pending:** exact-head cargo-deny, Cargo.lock parity, Rust tests, production builds, browser and package acceptance. This is an independent dependency fix and does not certify MAT-008.

## PR #222 — local-socket subscription compatibility (October 29, 2026)

- **Observed failure:** [CI #40852302352](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40852302352), exact dependency-upgrade head `8c13a68e1f063712af8c2979830623bab79e7fab`: `Contracts, automation, lint, and Rust tests` failed at `Clippy workspace checks` because `interprocess::local_socket::traits::Stream::split` is deprecated. Other executable jobs and standalone Visual/Desktop workflows passed on that old head. This is a dependency compatibility blocker, not a demonstrated application data regression.
- **Source correction:** [`3708b1c`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/3708b1cb197caa399016e530992ae49a36e49b8a) removes the deprecated split and detached disconnect-probe thread. The authenticated nonblocking stream now checks for EOF/unexpected client data before each event-receive interval, and reuses the same stream for deadline-bounded event writes. Endpoint nonce checks, event encoding, rate limits and the original subscription poll interval are unchanged.
- **Hosted exact-head verification:** [CI #40862620166](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40862620166), plus desktop compile and Visual review, were queued/in progress when this record was authored; no green result is claimed here. The existing daemon event subscription and reconnection Rust tests must pass after the dependency bump.
- **Not yet established:** installed-client disconnect/reconnect and multiprocess shutdown behavior. The source change is not proof of release acceptance.

## MAT-005 / MAT-010 Database Studio source-editor coordination — October 29, 2026

[PR #217](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/217) guards the mutation boundary between Database Studio and the one writable Markdown source editor. It is a focused safety slice, not full MAT-005, MAT-009 or MAT-010 implementation.

| Source or environment | Result | Classification |
|---|---|---|
| Test-only `8bd17fc`, [CI #40776875924](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40776875924) | Two real-component tests authored before the fix. Hosted source-suite outcome not observed when production code was published. | **Observed failing-first result not yet established** |
| Follow-up code to `DatabaseStudioPanel.editCell` | Direct native fallback removed. Without `runSourceNoteMutation`, loaded cells are read-only and direct calls reject; with a coordinator, expected-hash and initiating-vault checks remain. | **Source implementation; current-head green pending** |

No installed-client unsaved-draft, vault-switch, or restart acceptance is asserted. A browser mock cannot certify native rollback or durable success.


## MAT-018 command palette availability — main integration pending hosted checks

### MAT-018 collapsed-rail focus visibility — October 29, 2026

- **Observed RED:** [CI #40769827862](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40769827862), head `802051d`, Browser E2E: 147/148 passed; `e2e/command-palette-focus.spec.ts` failed on `expect(search).not.toBeVisible()` after **Hide vault sidebar**. [Workflow screenshots #40769827908](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40769827908) failed on the same assertion. The underlying desktop rail used `opacity:0` and zero-width grid columns; the input still remained visible to the browser visibility check and was not removed from keyboard navigation.
- **Implementation (new exact-head checks required):** hide the collapsed desktop rail with `visibility:hidden`, retaining the pre-existing opacity/grid animation. Exclude mobile-pane navigation and restore the Vault pane's interactivity at actual mobile width and zoom reflow. Keep the original palette open/close/focus test and add a mobile-pane regression.
- **Verification pending:** exact-head Browser E2E, populated screenshot, frontend/TypeScript, visual, RTL/200% zoom and installed-client keyboard/screen-reader acceptance. These are not satisfied by editing CSS or by the historical failed CI run.



### MAT-018 palette focus after closing dialog — October 29, 2026

- **Source defect:** `focus-search` called `input.focus()` while the command palette's `useFocusTrap` was still active. Its `focusin` listener reclaims focus outside the dialog; if the sidebar is collapsed the target may not be visible at all.
- **Test-only head `0394cf8`:** two Playwright cases require the palette to close and focus the visible vault search, including after hiding the sidebar. The [test-only CI #40769455505](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40769455505) had not reached the browser lane before implementation. **No observed failing-first result.**
- **Implementation:** use the existing Vault sidebar view/toggle owner and defer focus by one animation frame until after modal teardown; a collapsed sidebar without a reopening owner does not advertise the command.
- **Pending:** exact-head browser focus tests, TypeScript, source lint, narrow/mobile/RTL and 200% zoom, and installed-client keyboard acceptance. No MAT-018 graduation claim.



### MAT-018 note-search test harness coverage — October 29, 2026

- CodeRabbit identified a valid gap: the JSX component test did not execute `useEffect`, so it could not detect a native note search incorrectly starting without an `onOpenNote` callback. The test harness now commits the real effect callbacks with deterministic timers and records `searchNotes` calls, asserting no work without an opener and preserved scheduling when one exists.
- **Scope/evidence:** test-only improvement, not a new application behavior fix and not an observed behavioral red. Require a passing exact-head source run before claiming regression coverage green.

### MAT-018 note result availability — October 29, 2026

[PR #216](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/216) adds a second callback-availability regression to the command palette. In its test-only head `8ab1b67`, the real JSX component harness renders a selectable note result despite missing `onOpenNote`; its selection calls an optional callback and closes without opening any note.

A narrow guard now requires both a note-search function **and** an opener before note-result queries or selectable note results can be presented; the existing positive click-through test remains. **No hosted failing-first result was observed before the implementation commit:** CI [#40763493567](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40763493567) was still queued. Exact-head source/TypeScript/browser and installed-client keyboard/RTL/zoom acceptance remain pending. This is not a MAT-018 completion certificate.


The test-only PR #216 head `d12f1a55454592a3e1d1364b0d2a73d08dc30eb8` established failing-first behavior in [CI #40677971239](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40677971239): the palette advertised a missing knowledge-workbench callback and showed a closed-tab restore action with zero closed tabs. The two new tests fail by assertion (683 of 685 source tests passed), not because of import or runner failure.

The implementation restricts command registration to available owner callbacks, an actual active note for organization/history, and a positive closed-tab count with a reopen callback. It preserves available command handlers, keyboard shortcuts, and native authorization boundaries.

**Pending:** exact-head source, TypeScript, browser, accessibility, visual, and installed-client acceptance at 200% zoom/narrow widths. This is a bounded MAT-018 slice, not completion of centralized capability/Help availability.


- **Main integration:** latest main contains PR #217 Database Studio write coordination and PR #231 Kanban geometry regression. No previous-head CI result certifies this integration head; repeat source, browser, visual, docs gates.

## MAT-005 — Git mutation single-flight (draft PR #210)
- **Further observed RED:** [CI #40675186002](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40675186002) failed three new source tests at `f8ba9be6`: old pull refreshed new vault, old commit refreshed another vault's status, and A→B→A revived an earlier refresh. The implementation introduces a generation-scoped UI refresh guard; current-head GREEN and installed-client proof remain pending.

- **Observed RED:** test-only head `6182df80b78b81c8043f3c5364735db3f741839b`, [CI #40585634586](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40585634586), `Run source regression suite`. A repeat commit reached native Git twice (expected one, observed two); a pending pull ceased showing busy after switching vaults (expected true, observed false).
- The initial error-path test failed on a VM cross-realm `Error` prefix, not production behavior. The harness supplies the host `Error` constructor in the implementation commit; this is a test-fixture correction, not a changed product expectation.
- **Implementation:** a synchronous, shared in-flight ref gates all three Git mutation entry points; React state remains the busy indicator and is no longer hidden on vault navigation. Native GitQueue, authorization, command signatures and per-vault status slots remain unchanged.
- **Prior exact-head hosted GREEN:** commit `186a3b3` passed source, Rust, Browser E2E, Windows, frontend, container, docs and visual workflows in [CI #40586771173](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40586771173) and [Visual #40586771362](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40586771362); it does not certify later heads.
- **Next failing-first stage:** test-only commit `32f525d` adds real-hook regressions for stale pull/commit completion refreshing a different vault, including switch-away-and-back. No source fix has been applied and **RED remains unobserved** until hosted source tests execute.
- **Pending:** exact-head hosted source, TypeScript, browser, Rust, Windows, and visual acceptance; installed-client duplicate-submit, vault switch, crash/restart and native failure acceptance. This is one MAT-005 slice, not checklist completion.

## Canonical history gate

Run from a full canonical clone:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

Also run an approved full-history secret scanner and capture branch protection, required reviews, environment protection, tag lineage, and release lineage from the hosting platform.

A passing source-level contract is not proof of a public release. The authoritative completion evidence is the exact-head CI matrix **plus the exact-head Visual review gate**, followed by the production tag workflow and published release assets. Draft PRs also run hosted CI, desktop compilation and visual review. `ready_for_review` triggers another exact-head validation; newer PR heads cancel stale runs. Release binary review remains a separate manual workflow.
