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

## MAT-005 Canvas board-list response ordering — October 27, 2026

Draft [PR #209](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/209) is a sibling of #208, stacked on #206. It addresses **derived Canvas inventory freshness**, not native file persistence, conflict resolution or complete MAT-005 maturity.

| Source and environment | Result | Evidence limit |
|---|---|---|
| Test-only `79e4723`, [CI #40562214281](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40562214281) | **Observed behavioral red** in `canvas-persistence-flush.test.mjs`: the slow initial list changed the latest inventory from `fresh-board` to `old-board`; `AssertionError` at line 637 | Uses the actual transpiled Canvas hook with controlled native list/save calls; not a packaged client |
| Fix `5ea8ef4` | Added a separate `OperationGuard` for Canvas list publication, invalidated on vault change, preserving `isCurrent` checks and native result | **Implementation authored, exact-head green pending** |

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

## Canonical history gate

Run from a full canonical clone:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

Also run an approved full-history secret scanner and capture branch protection, required reviews, environment protection, tag lineage, and release lineage from the hosting platform.

A passing source-level contract is not proof of a public release. The authoritative completion evidence is the exact-head CI matrix **plus the exact-head Visual review gate**, followed by the production tag workflow and published release assets. Draft PRs also run hosted CI, desktop compilation and visual review. `ready_for_review` triggers another exact-head validation; newer PR heads cancel stale runs. Release binary review remains a separate manual workflow.
