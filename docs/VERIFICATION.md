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

## MAT-005 Obsidian import initiating-vault guard — October 29, 2026

Stacked draft [PR #227](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/227) builds on [PR #219](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/219). A delayed approval could otherwise bind an old dialog's request to the newly active vault. The TypeScript bridge now requires and forwards the originating vault ID; the native import command checks it against the active session **before** consuming the sensitive-operation token or writing files. This adds an admission guard, not a new permission authority or importer.

The test-only source commit [`4208e00`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/4208e0091f22867b433ef32a39443c8246267c3a) includes bridge and native-order regressions. [Test-only CI #40855794851](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40855794851) was queued at implementation time, so **RED has not been observed**. The related real-dialog JSX harness also verifies forwarding the initiating vault. **Exact implementation-head CI, Rust/Windows/browser/visual and installed-client switch-during-approval acceptance are unverified**; do not merge, publish or graduate MAT-005 based on source inspection. Implementation record: [`tasks/plans/2026-10-29-mat-005-obsidian-import-vault-identity.md`](../tasks/plans/2026-10-29-mat-005-obsidian-import-vault-identity.md).

Hosted source verification: [CI #40881320884](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40881320884), [desktop #40881320881](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40881320881), [visual #40881320887](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40881320887), and [docs #40881320900](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40881320900) passed on old source head `263c6a2`. The current integration merge head requires its own CI, and packaged-client vault-switch/authorization/restart acceptance remains pending.

## MAT-005 Obsidian import lifecycle — October 29, 2026

PR [#219](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/219) addresses renderer-level lifecycle defects in the Obsidian import overlay. Native `ImportVault` authorization and file writes are unchanged.

| Source | Observation | Evidence class |
|---|---|---|
| Test-only head `69a8c3a`, [CI #40783884097](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40783884097) | Three real-dialog JSX behavioral tests were authored; at the time of the fix, hosted CI was queued | **No observed failing-first run**; do not claim TDD RED |
| Implemented follow-up | Synchronous import single-flight, mount-generation check before post-await state/callbacks; failure releases in-flight claim for an explicit user retry | **Authored, not yet verified GREEN** |
| Required acceptance | Current-head source regression, browser, TypeScript, native/Rust, Windows/desktop, visual and clean installed-client import/vault-switch scenarios | **Pending** |
| `54655e6` test-only follow-up · [CI #40850992642](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40850992642) | Real-JSX test covers a native folder chooser resolving after layout cleanup; the originating dialog must not validate the result or update React state after close | **Test authored first; no hosted RED observed before fix**, so browser/native acceptance remains pending |
| Subsequent Browse guard | Capture dialog lifecycle before awaiting plugin-module loading and native picker; ignore selection if that owner has unmounted | **Implemented; exact-head source/functional checks pending** |

A closed dialog does **not** cancel, roll back or establish the outcome of an already submitted native import. It only prevents late renderer feedback.

Source acceptance (October 29, 2026): [CI #40881174514](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40881174514), [visual #40881174519](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40881174519), and [docs #40881174543](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40881174543) passed at exact branch head `c088066`. This establishes hosted source verification, not installed-client vault-switch, restart or lost-response reconciliation acceptance. The initial test-only RED was not observed.
## MAT-001–MAT-003 recovery work — October 27, 2026

The parent-to-child review stack is [PR #180](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/180) → [PR #186](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/186) → [PR #205](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/205). This section records **execution evidence**, distinct from the implementation checklist in [the MAT-003 plan](../tasks/plans/2026-10-27-mat-003-restore-status-preview.md). A pass at an older source commit does not certify a newer head.

| Source / environment | Observed result | Evidence classification and limits |
|---|---|---|
| Initial MAT-003 presenter; isolated Node 22 harness | Seven expected assertion failures with an absent presenter, then 7 passed / 0 failed after mapping seven restore outcomes | Focused red/green **isolated harness** only; not a full checkout, native restore or installed desktop |
| MAT-003 note-history availability; isolated Node 22 harness | Six behavior assertions: five expected failures and one pass before the guard, then 6/6 passed after it | **Isolated harness**; not evidence of native note-history navigation, focus restoration, or installed-client behavior |
| MAT-005 backup confirmation scope; isolated Node 22.16.0 harness | Missing-scope-guard red followed by 6/6 passing tests for vault/folder/name scope | **Isolated harness**; source contract authored separately, no installed-client restore |
| [`c89698d`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/c89698d00dba00ffc879e8757440b32530e45157) · GitHub CI | Source regression suite **734/735 passed**, with the old name-only expectation failing; frontend build failed with TypeScript **TS18047** for nullable `pendingAction` | **Failed**; both regressions subsequently corrected in [`fac0faa`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/fac0faad76cb91fd75163f4c845132846ee3401a) |
| [`a1f3761`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/a1f37616f0d5c102475fbf5a5d5eff1bf2d2dbbe) · GitHub-hosted | [Browser E2E](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40514532907), frontend, source contracts, container and Windows smoke jobs passed; [Visual review](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40514532797) and [workflow screenshots](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40514533136) passed. Rust dependency installation initially exceeded its 900-second runner deadline; a reattempt was requested, but the later parent-branch update superseded current-head certification. | **Mixed historical evidence**; runner `apt-get` timeout was not a Rust assertion failure, and no packaged-client acceptance is shown |
| Latest stacked branches, including PR #205 at the time of this evidence record | New exact-head CI and visuals are linked from the pull requests, and must be checked independently | **Pending** for subsequent source heads; actual lost-reply, restart, journal, recovery, keyboard, RTL and screen-reader acceptance remains unverified |

The source regression and TypeScript correction preserve the stronger scoped confirmation, rather than restoring the unsafe name-only approval. Browser fixtures simulate native responses and therefore cannot establish installed Windows/macOS/Linux restore or journal-recovery behavior. The MAT-003 checkbox remains unchecked pending the broader Recovery Center inventory and platform acceptance.


## MAT-005 failed-create backup inventory settlement — October 27, 2026

Draft [PR #208](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/208) is stacked on #206. This is a renderer-only listing reconciliation, not a new permission or backup-write authority.

| Source/environment | Result | Evidence classification |
|---|---|---|
| Test-only commit `1dcc6f3`, [CI #40560278013](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40560278013) | **740 passed, 1 failed** in the source suite. The only failure was `MAT-005 denied backup creation schedules a read-only list reconciliation`: no replacement read in the failed-create branch | **Observed source-contract red**; browser red and actual native-disk fault were not observed |
| Fix commit `c9c5069` | After a backup create failure, check current vault/folder, preserve error and await an existing read-only `listBackups()` call; no repeat `vaultCreateBackup` call | Implemented, **exact-head green pending** |

The original pending list was invalidated at mutation start. The new read must settle the loading state without accepting the stale response or hiding the authorization failure. Packaged-client acceptance and other MAT-005 owners remain open.
## MAT-005 Canvas explicit-flush ownership — October 27, 2026

[PR #207](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/207) originated as an independent Canvas lifecycle fix and has now been integrated into [PR #209](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/209) alongside same-vault board-list ordering. This integration does not complete MAT-005.

| Source | Observed result | Classification |
|---|---|---|
| Test-only `b3ebaeb` · [CI #40556426344](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40556426344) | Real-hook tests 182 and 183 both failed, expecting `New board ready.` but receiving `Canvas saved.` for old-vault and newer-edit cases | **Two observed behavioral red assertions** |
| Implementation after `b3ebaeb` | Explicit flush checks origin lifecycle, same document object and mount status before accepting any UI completion; keeps native serialized saves and successful durability results | **Implemented; exact-head hosted green and packaged acceptance pending** |
| `c2acae9` · [CI #40558029426](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40558029426) | 684/685 source tests passed; regression 183 failed because the originating explicit flush also submitted a subsequent pending `New unsaved revision`. Other CI lanes passed, including Browser E2E, Rust, frontend, Windows, supply-chain and container smoke | **Observed post-implementation behavioral failure; not a green MAT-005 gate** |
| `1aa05b2` | Explicit flush now bounds its submitted payload/retry to the request's captured sequence and observes only the in-flight save present at invocation. New edits remain independently debounced or explicitly flushable | **Source fix pushed; exact-head GREEN later verified on PR #207, installed-client acceptance pending** |

[PR #207 CI #40584936590](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40584936590) and [visual #40584936811](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40584936811) passed on `7a4578a`; those runs do not verify this **combined** #209 head. Mocks do not certify an installed client's crash/restart recovery. No new native command, permission scope, or file format was introduced.

## MAT-005 Canvas board-list response ordering — October 27, 2026

Draft [PR #209](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/209) is a sibling of #208, stacked on #206. It addresses **derived Canvas inventory freshness**, not native file persistence, conflict resolution or complete MAT-005 maturity.

| Source and environment | Result | Evidence limit |
|---|---|---|
| Test-only `79e4723`, [CI #40562214281](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40562214281) | **Observed behavioral red** in `canvas-persistence-flush.test.mjs`: the slow initial list changed the latest inventory from `fresh-board` to `old-board`; `AssertionError` at line 637 | Uses the actual transpiled Canvas hook with controlled native list/save calls; not a packaged client |
| Fix `5ea8ef4` | Added a separate `OperationGuard` for Canvas list publication, invalidated on vault change, preserving `isCurrent` checks and native result | **Passed on `8503393` in [CI #40762396787](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40762396787); combined head re-verification pending** |

The active document identity guard remained intact; only board inventory could become stale. The fix does not introduce storage, permissions, write retries or new native calls. Full MAT-005 and installed-client evidence remain open.

## MAT-005 backup inventory request ordering — October 27, 2026

PR [#206](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/206) is a bounded mutation-lifecycle slice stacked on #205. Its request-epoch guard is renderer-only; it neither overrides native vault ownership nor replaces backup authorization.

| Source/environment | Result | Classification |
|---|---|---|
| Test-only PR #206 head `1c5c475` · [CI #40523633550](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40523633550) | `Run source regression suite` failed the newly added `MAT-005 backup listing rejects stale same-vault, same-folder completions` assertion: request epoch absent | **Observed failing-first source test**, not browser proof |
| Implementation `213a0c2` followed by parent synchronization `2747f16` | Request epoch added to effect/explicit list paths and mutation boundaries, guarding both success and error updates | **Implemented; current-head hosted green not yet recorded** |
| `3c5374a` · [CI #40528678913](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40528678913) | Browser E2E failed **both** new fixtures at `getByText(backupName)` because it resolved the success notification and inventory row (Playwright strict-mode collision). All other executable CI jobs, visual review and screenshots passed. | **Failed browser assertions before exercising stale responses**; fix narrows selectors to actual `.backup-entry` rows, with no production change |
| Functional Playwright fixtures `e2e/backup-list-race.spec.ts` | Hold old same-scope response, publish newer manual-backup inventory, then release stale success/error; fresh row must remain visible | **Authored; browser execution pending on current head** |

The PR remains draft. This is not proof for editor, Canvas, imports, database, tasks, rename, provider effects, installed desktop recovery or the remaining MAT-005 acceptance scenarios.

## MAT-008 authenticated multi-client Git status CI — October 28, 2026

[PR #213](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/213) retains the daemon's expected-vault identity guard across the typed RPC, handler, and gateway. The authenticated two-client regression must finish without transport errors before it can certify stale-vault denial.

| Head and environment | Evidence | Classification |
|---|---|---|
| `26f024bc`, [CI #40776353451](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40776353451) Linux Rust workspace tests | `authenticated_clients_keep_git_status_bound_after_another_client_switches_vault` failed at `transport/tests.rs:916`: client A `OpenVault` returned `Io(NotFound)` before identity rejection was exercised; other 63 daemon tests passed | **Failed test-harness transport setup, not security denial proof** |
| Follow-up test-fixture correction | Keep the authenticated listener accepting valid client reconnects until both clients finish, signal shutdown using a local wake connection and join all handler threads; retain stale denial and matching-ID assertions | **Authored; new exact-head Rust execution required** |

The current CodeRabbit cross-client thread remains open. The hosted test is not packaged desktop multi-process/restart or real operational acceptance, even if it passes.

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

## MAT-008 — Git status read provenance (draft PR #213)

### Authenticated socket Ping contract and compilation — October 29, 2026

- **Observed failed CI on head `a570403`:** [CI #40770292720](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40770292720) failed `cargo clippy --locked --workspace --all-targets -- -D warnings` at `crates/daemon/src/transport/tests.rs:901` with **E0533**. The newly added test treated `RpcPayload::Pong` as a unit variant, but the IPC protocol defines the struct variant `Pong { version: String }`. It failed at compile time, **before the authenticated two-client wrong-vault security assertion**.
- **Minimal correction:** match `RpcPayload::Pong { .. }` and leave the authenticated B-before-A socket fixture, old-vault denial and current-vault success assertions intact. No product Git status authorization or daemon transport behavior changes.
- **Acceptance:** exact-head Rust/Clippy CI and two-client test, plus packaged authenticated multiprocess and restart evidence, remain mandatory. Compiler repair is not evidence of daemon-vault isolation or MAT-008 completion.

### Two authenticated socket clients — current test-harness correction (2026-10-29)

The exact-head [CI #40762865932](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40762865932) ran the new daemon test `transport::tests::authenticated_clients_keep_git_status_bound_after_another_client_switches_vault`. The daemon crate reported **63 passed, 1 failed**, exit 101. Client B failed to establish transport at `crates/daemon/src/transport/tests.rs:935` with `Io(NotFound)` before the stale vault-status denial was asserted. The other existing daemon status identity tests passed. **This is test-harness socket-admission failure, not evidence of a vault data leak or a passing cross-client isolation case.**

The test's ephemeral listener accepts exactly two connections before closing. The minimal fixture correction establishes client B's authenticated socket through a `Ping` before A opens vault A, reserving the second client connection and leaving the required A→B vault-switch/status-denial assertions unchanged. This is a **hypothesized harness correction pending exact-head Rust green verification**, not a product-security acceptance claim. The parent CodeRabbit daemon-boundary thread must remain open pending exact-head evidence and installed multiprocess/restart acceptance.


- **Observed behavioral RED:** test-only head `caf63390bbbeaa8893af446169c5995a920777cc`, [CI #40599461753](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40599461753), three source regressions: native Git status was invoked without the initiating vault ID, a blank origin was accepted, and the controller did not pass the captured vault ID to its fetcher.
- **Implementation pending exact-head GREEN:** the controller forwards the immutable vault ID, the typed Tauri bridge requires it, native Tauri checks the active session, and headless daemon-backed reads validate under the vault-switch lock. The separately exposed `daemon_git_status` Tauri command and its TypeScript bridge now require the same initiating identity; Browser fixtures refuse mismatched IDs.
- **Outstanding:** current-head source/Rust/Windows/browser/visual checks, installed desktop delayed-read/vault-switch acceptance, and broader daemon/CLI/MCP parity. Read provenance does not imply a committed mutation.

## MAT-008 — Daemon Git status RPC provenance (draft PR #215)

- **Rust lint regression (2026-10-28):** exact-head CI #40671152135 failed `cargo clippy --locked --workspace --all-targets -- -D warnings` because the superseded `daemon_client::open_vault` wrapper became unused at `crates/cli/src/daemon_client.rs:300` when status callers adopted `ensure_vault_open_with_id`. The follow-up deletes this unused wrapper rather than suppressing `dead_code`; fresh exact-head validation is required.
- **Observed RED:** test-only head `d51b0e3`, [CI #40666737446](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40666737446), failed `transport::tests::unscoped_git_status_is_rejected_before_native_read_on_both_daemon_routes` (61 passing daemon tests, 1 failing). The unbound request reached the native Git read.
- **Implementation:** typed `RpcMethod::GitStatus` requires `expected_vault_id`. The daemon's direct handler, outside-lock transport, and Invoke paths verify the same authoritative session before resolving a native Git root. Desktop, CLI and TUI use the ID returned by daemon `OpenVault`. Missing or stale identities fail closed.
- **Pending:** exact-head Rustfmt/Clippy/Rust, IPC bindings, TypeScript, Browser E2E, Windows and visual acceptance; installed authenticated IPC concurrency, restart and reopening. This is one MAT-008 slice and not mutation receipt proof.

- **New authenticated IPC regression authored on PR #213:** two independent daemon clients open A then switch the active daemon to B; a subsequent GitStatus originating from A must fail with identity mismatch, while B's read remains available. Exact-head hosted execution pending; this does not replace installed multi-process/restart acceptance.

## MAT-008 — Daemon Git commit identity (draft PR #212)

- **Observed failing-first:** [CI #40657380487](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40657380487), Rust workspace test lane at test-only commit `eb26a20db7b064ee312397cc579b7455cf71cf29`. Both `command_gateway::tests::git_commit_gateway_rejects_stale_and_missing_vault_before_queueing` and `transport::tests::outside_lock_git_commit_rejects_stale_and_missing_vault_before_queueing` failed because an invalid request reached GitQueue and returned `not a git repository` instead of a vault-identity error.
- **Implementation:** the command gateway owns one session-identity guard requiring nonblank `expected_vault_id` and exact match with the active vault. Both daemon execution paths check it while holding their existing daemon-state lock and before creating/enqueuing a queue. Existing queue serialization and IPC authorization are unchanged.
- **Required verification:** current-head source/Rustfmt/Clippy/Rust tests, Linux/Windows/Browser and applicable visual gates, plus an installed authenticated daemon IPC session switch/restart test. No installed-client acceptance has yet been established; MAT-008 remains open.

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

## MAT-016 — ambiguous Google Tasks mirroring (PR #230)

- **Follow-up ownership case:** test-only `02fe5719` adds two real-hook cases for a remote record shared by scoped A/B owner markers, or by an exact legacy A owner and scoped B owner. The native batch must not update either record. The corresponding renderer guard rejects current-vault claims on records also marked for a different vault. This new patch is **not yet exact-head hosted green**; source tests were written first, but the hosted RED was not observed when implementation began. Live-provider and installed-client acceptance remain pending.

- **RED confirmed:** test-only `12334132dad4e71fc7d54e09543be263f344443a`, hosted [CI #40883180912](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40883180912), source regression suite. Of 685 tests, 683 passed and exactly two new cases failed: duplicate scoped remote markers prepared a provider mutation (1 instead of 0), and duplicate stable IDs from two local notes likewise prepared a provider mutation (1 instead of 0).
- **Implementation:** preflight duplicate local IDs and duplicate current-vault provider ownership markers before `googleCalendarApplyTaskSync`. Ambiguous ownership now produces an actionable review-required error in the existing Tasks panel. No provider write, new permission owner, or automatic duplicate reconciliation is introduced.
- **Extension:** test-only `dd5601a8` added four real-hook cases for multiple scoped local owners on one remote record, two matching legacy markers across records, repeated provider IDs with differing markers, and empty scoped ownership. This test commit was pushed before the implementation; a hosted failing-first result was **not observed** at the time the fix was prepared. The subsequent fix preflights those cases before any approved mutation. No independent Google authorization or task-ID reconciler was added.
- **Further test-first evidence:** `0e1af9f` adds legacy/scoped cross-record collision and blank local-ID regressions before the source guard. No hosted behavioral RED was observed for that intermediate head; do not report a confirmed RED for these six additional cases. The implementation rejects both before native batch admission.
- **Pending:** exact-head GREEN source, frontend/TypeScript, Rust, browser, Windows, visual and docs verification for the final implementation. Real Google provider and installed-desktop collision/restart acceptance remain unavailable. This is one MAT-016 slice, not completion of the 24-item program.

## MAT-009 Database Studio view-result ownership — October 30, 2026
- **CI failure observed:** [CI #40970375883](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40970375883) failed the fast lint job with `react-hooks/set-state-in-effect`, `react-hooks/refs`, and exhaustive-deps warnings. The fix removes new synchronous state updates from the vault effect, replaces render-time ref reads with a stored immutable view/vault/preset identity, and memoizes visible rows/columns. The query cancellation and stale-edit guards still use the ref only in callbacks/effects, where it is valid.
- **Hosted GREEN at `15a1f2f4`:** [CI #41024144641](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41024144641), [Visual #41024144551](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41024144551) and [Docs #41024144556](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41024144556) completed successfully, including the formerly failing Browser E2E layout case.


- A view change could leave previous rows, aggregates and editable callbacks on screen. A pending query could later repopulate rows from a prior view.
- Test-first `02692a0` adds two actual-TSX harness regressions for stale rows/edit callbacks and late query settlement. Hosted behavioral RED was not observed at the time of implementation.
- A view revision and loaded-scope key now invalidate old rows, projections, edit authority and stale query errors, and discard old query completion; native authorization, expected hash, source-editor coordination and 200-candidate/32-MiB budgets stay unchanged.
- Test-only `b9ed54c` additionally covers late native query rejection after switching filters; its hosted RED was not observed at the time the guarded catch was committed.
- Repeat exact-head source/browser/Rust/Windows/visual checks after integration with the latest main. Installed-client concurrency acceptance remains outstanding. MAT-009 complete native projections/pagination and MAT-010 schema/batch edits remain unimplemented.
## MAT-005 Saved Views query ownership — October 29, 2026

[PR #218](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/218) is an independent renderer read-freshness slice. Native Saved Views filtering and vault permissions are unchanged.

| Source / environment | Observed result | Classification |
|---|---|---|
| Test-only `687bd7e` · [CI #40779293100](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40779293100) | Three real-hook assertions failed in `saved-views-query-ownership.test.mjs`: test 345 old Alpha query overwrote Beta; test 346 vault A's path remained on vault B; test 347 new vault's result was absent with unchanged filter. | **Three observed behavioral RED failures**, not test setup or compile failures |
| Implementation following the test-only commit | One shared generation between manual and debounced queries; render-visible results are keyed to vault/filter identity; stale success/error callbacks are ignored; effect cleanup invalidates outstanding operations. | **Implemented — hosted exact-head CI verified on `929619d`** |

A mocked native query is not proof of installed-client vault changes or remote data integrity. Broader MAT-005 mutation acceptance and desktop restart tests remain open.

Exact-head [CI #40784067680](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40784067680), [Visual #40784067783](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40784067783) and [Docs #40784067709](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40784067709) completed successfully before merging current main. Fresh exact-head validation remains required.
## MAT-006 — Health Dashboard note navigation approval (PR #233)

- **Failing-first source test authored:** [`d3e2a68`](https://github.com/AmirrezaFarnamTaheri/Scriptor/commit/d3e2a688edd8dc1dfefd8ddcd74c167d9c77148e) asserts that `App.tsx` does not close Health Dashboard before awaited note navigation. The legacy implementation closed eagerly. Hosted RED is **not yet confirmed**.
- **Behavioral source implementation:** `openNoteBeforeDismissingPanel` awaits the existing workspace-leaf navigation outcome; dismissal occurs only after `true`. A refusal or blank target leaves the panel open; thrown source errors remain identifiable and the App handler reports them through the existing toast service.
- **Tests authored:** four actual TypeScript helper tests cover delayed approval, dirty-editor refusal, native read rejection, and blank targets. The source-shaped App regression also guards the real handler wiring.
- **Pending:** exact-head source suite, TypeScript, lint, Browser E2E, Rust/Windows, docs, visual and installed-client dirty close/restart/vault switch/keyboard/RTL/200% zoom acceptance. This is only a MAT-006 code slice and does not graduate the feature.

- **Head-specific source results:** [CI #41041583823](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41041583823), [Visual #41041583796](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41041583796), and [Docs #41041566586](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/41041566586) passed on `324ea154`. This does not certify the newly reconciled integration head or installed-client workflows.

## Canonical history gate

Run from a full canonical clone:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

Also run an approved full-history secret scanner and capture branch protection, required reviews, environment protection, tag lineage, and release lineage from the hosting platform.

A passing source-level contract is not proof of a public release. The authoritative completion evidence is the exact-head CI matrix **plus the exact-head Visual review gate**, followed by the production tag workflow and published release assets. Draft PRs also run hosted CI, desktop compilation and visual review. `ready_for_review` triggers another exact-head validation; newer PR heads cancel stale runs. Release binary review remains a separate manual workflow.
