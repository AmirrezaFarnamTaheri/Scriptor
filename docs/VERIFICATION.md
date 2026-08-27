# Verification record

This document defines proof for the current source candidate. A release record must name the exact commit, source-tree hash, command, environment, target architecture, and artifact set.

## Claim vocabulary

- **Verified:** the stated command executed against this source state and passed.
- **Statically validated:** source or generated metadata was parsed and checked without compiling or running the full product.
- **Reviewed:** code and contracts were inspected without executable proof.
- **Pending:** required proof depends on unavailable tooling, dependencies, platform, browser, or canonical history.
- **Failed:** the stated command executed and did not pass.

## Repository-native checks

Run from the repository root:

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

A release candidate is not verified until these commands pass in a clean environment with the pinned toolchains and frozen lockfiles:

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
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
core surfaces; transient/state-review screenshots are attached to the Visual review job instead of
creating missing-baseline failures. Documentation screenshots mirror reviewed Windows baselines
with the platform suffix removed; regenerate them with `scripts/screenshots/capture.ps1`.

## Exploratory ZIP-derived candidate output — 2026-08-19

This section records exploratory baseline checks executed against the working tree reconstructed from the unhashed `Scriptor-lite.zip` artifact during workspace triage. Because the input archive did not record an immutable cryptographic hash, and the inspection environment had Node.js `v22.16.0` without a local Cargo/Rust toolchain, pnpm installation, workspace `node_modules`, PowerShell, or production browser build, this output is retained as informational exploratory notes only. It is **not** auditable candidate evidence or a release-readiness claim. Clean CI environments enforce all repository gates.

| Gate | Result | Evidence |
| --- | --- | --- |
| Source contracts | Verified: 19/19 passed | `node scripts/validation/source-contracts.mjs` |
| Complete lightweight source-test inventory | Verified: 100/100 tests passed across 19 discovered test files | `node scripts/validation/run-source-tests.mjs` |
| Rust source structure | Statically validated: 200 Rust files | `node scripts/validation/rust-source-contracts.mjs` |
| Native authorization inventory | Statically validated: 26 high-impact command bindings brokered | `node scripts/validation/authorization-inventory.mjs` |
| Renderer/native command contract | Statically validated: 135 bridged commands resolve to 152 registered handlers | `node scripts/validation/tauri-command-contracts.mjs` |
| Package boundaries | Statically validated: 15 packages / 482 package source files, no unexported cross-package imports or cycles | `node scripts/validation/deep-module-boundaries.mjs` |
| Cargo manifest/lock workspace dependencies | Statically validated: 19 packages; parser is independent of LF/CRLF checkout normalization | `node scripts/validation/cargo-lock-workspace-deps.mjs` |
| Plugin Rust gates | Statically validated: 5/5 backend package references resolve | `node scripts/validation/plugin-rust-gates.mjs` |
| Frontend policy | Statically validated: 522 production TypeScript/CSS files; CSS token policy also passed | `node scripts/validation/frontend-quality.mjs`; `node scripts/validation/css-custom-properties.mjs` |
| Governance/docs/version/action pins/i18n | Verified/static validators passed | `version.mjs check`, `action-pins.mjs`, `i18n-parity.mjs`, `docs-contracts.mjs` |
| Standalone module runners | Verified where dependency-free: Canvas, Portal, Export, headless contracts, citations, safe external URLs, knowledge, merge/conflict, palette scoring, and Zotero connector tests | direct Node runners |
| Workspace-dependent module runners | Pending: MCP, plugin-api, editor, renderer resolve workspace/external packages only after install | blocked by absent `node_modules` / pnpm |
| Browser accessibility smoke | Pending | runner requires `pnpm build`; pnpm/dependencies unavailable |
| Rust compile/test/fmt/Clippy/deny | Pending | Cargo/Rust toolchain unavailable |
| Full TS/ESLint/Vite/Playwright/release packaging | Pending | pnpm dependencies, browser build, and/or PowerShell unavailable |

Independent audit-only checks also parsed all strict JSON/TOML manifests, syntax-checked every JS/MJS/CJS script, verified pnpm-lock importer dependency contracts for 17 package manifests, found no repository symlinks or unexpected zero-byte files, and found no high-signal credential/private-key patterns outside fixture data. These checks are useful consistency evidence but do not replace repository-native build/test gates.

## Local remediation evidence — 2026-08-23

Executed against the working tree at commit `7981e8f` plus the local Git-panel
remediation described in [`AUDIT-2026-08-23.md`](../AUDIT-2026-08-23.md).
Windows 11 x86_64 host; Node v26.1.0; Rust 1.96.0 (pinned toolchain).

| Gate | Result | Evidence |
| --- | --- | --- |
| Dependency-free source/governance validators (16 runners) | Verified: all passed | `node scripts/validation/*.mjs` per `check:source`/`check:governance` lists |
| Complete lightweight source-test inventory | Verified: 127/127 across 28 discovered test files (adds `src/hooks/workspace-git-status.test.ts`) | `node scripts/validation/run-source-tests.mjs` |
| Rust workspace tests (CI exclusion list, `SCRIPTOR_TEST_DAEMON_HMAC_KEY` set) | Verified: 38 test binaries, 675 passed, 0 failed | `cargo test --locked --workspace --exclude scriptor-desktop --exclude scriptor-embeddings --exclude scriptor-tantivy-indexer --exclude scriptor-wasm-runtime --jobs 2` |
| Clippy warning-zero (16 product crates) | Verified | `cargo clippy --locked --workspace --exclude scriptor-desktop --exclude scriptor-embeddings --all-targets -- -D warnings` |
| rustfmt check after normalization | Verified: exit 0 (pre-fix HEAD emitted 41 diff hunks across 8 files) | `cargo fmt --all --check` |
| TypeScript build | Verified | `tsc -b --pretty false` |
| ESLint warning-zero, full repository | Verified: exit 0 only after adding missing `dist-e2e` ignores (finding D9) | `eslint . --max-warnings=0` |
| Functional browser suite | Verified locally: 73/73 including the eight Git-panel failures observed in CI run 32632696707 pre-fix | `playwright test --config playwright.e2e.config.ts` |
| Desktop crate release build (incl. aws-lc-sys/reqwest TLS graph) | Verified on this host after exporting `CL`/`CFLAGS=/std:c11 /wd4100 /wd4244 /wd4267 /wd4189` for the MSVC `-WX` feature probes; `target/release/scriptor-desktop.exe` produced | `cargo build --release -p scriptor-desktop` (5 m 24 s) |
| Desktop binary launch smoke | Verified: process started, stayed alive through the observation window, terminated cleanly | manual launch of `target/release/scriptor-desktop.exe` |
| Daemon IPC hermetic smoke | Verified: exit 0 against the minimal fixture vault | `node scripts/validation/daemon-smoke.mjs` |
| TUI hermetic smoke | Verified: exit 0 (`scriptor-cli tui --smoke-test --in-process`) | `node scripts/validation/tui-smoke.mjs` |
| Visual regression suite, axe audit, packaging/release gates | Pending: require pinned browser baselines, ChromeDriver, and packaging tooling | — |


## Historical upstream candidate evidence — 2026-08-17 (not re-run for this ZIP-derived candidate)

This table is retained as historical upstream evidence from the pre-improvement source state. It must not be used as proof that the ZIP-derived candidate above compiles, packages, or passes browser/Rust release gates.

| Gate | Result | Evidence |
| --- | --- | --- |
| Functional browser suite | Passed 71/71 with zero retries | `pnpm test:e2e` |
| Visual regression suite | 28 tests passed; `vault-health` baseline reviewed and intentionally refreshed for the four-note/520-word fixture | `pnpm test:visual` |
| Static accessibility smoke | Passed | `pnpm check:a11y` |
| Axe browser audit | Passed with zero violations | `pnpm check:a11y-axe` with Chrome/Chromedriver 151.0.7922.138 |
| Rust workspace | Passed formatting, warning-zero Clippy, and the full workspace test graph | `cargo fmt --check`; `cargo clippy --locked --workspace --all-targets -- -D warnings`; `cargo test --locked --workspace --jobs 2` |
| Cargo deny | Passed advisories, bans, licenses, and sources | pinned `cargo-deny 0.20.2 check` |
| Release smoke and performance | Passed | `pnpm release:smoke`; `pnpm release:perf-gate` (1k-note scan mean 41 ms; 1500 ms budget) |
| Production dependency audit | Pending external service | `pnpm audit --prod` exhausted retries after registry `ECONNRESET`; no vulnerability verdict was produced |

Visual assets reviewed by this pass are catalogued in [`VISUAL-REVIEW.md`](./VISUAL-REVIEW.md) and the [canonical screenshot inventory](assets/screenshots/README.md).

## 2026-08-13 experimental workspace evidence

The following is implementation evidence for the Reader, Markdown-backed Tasks, and Kanban
workflows. These surfaces remain **Experimental** in the capability ledger until the complete UI
and release gates pass from a clean environment.

| Workflow boundary | Evidence command | Observed result | Remaining proof |
|---|---|---|---|
| Reader native path confinement and annotation restart persistence | `cargo test -p scriptor-desktop reader --lib` | Passed: 2 tests | Desktop-shell PDF/EPUB rendering, keyboard-only and 200% zoom matrix |
| Task parsing, source Markdown updates, and index refresh | `cargo test -p scriptor-indexer -- --nocapture` | Passed: 103 tests | Clean-environment browser mutation/retry proof |
| Reader/Task/Kanban bridge and UI contracts | `node --experimental-strip-types --test scripts/validation/task-kanban-reader-contracts.test.mjs` | Passed | Full Playwright workflow against the configured web server |
| Type, lint, and package contracts | `pnpm exec tsc -b --pretty false`; `pnpm lint`; `pnpm check:contracts` | Passed in the working-tree validation run | Repeat after the worktree is isolated for release |

The intended normal path is: open a PDF/EPUB from the vault tree or command palette; open Tasks
or Kanban from the palette; save an edited note before a task/card mutation; then let the native
write and index refresh complete. A failed save or rejected native mutation leaves the source
unchanged and surfaces an error for retry. Do not assign a default shortcut until the command
palette flow has passed the keyboard-only matrix.

The pinned Vite/Playwright server is required for the browser gate. Record the exact-head result in the release receipt before promotion.

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
- A release operator manually dispatches `Release Kickoff` through the protected `release-production` environment; a `VERSION` change alone never creates a tag.
- An existing tag that points to another commit is a hard failure; it is never moved.
- The kickoff workflow requires the exact `VERSION`, creates only an unused immutable tag, and explicitly dispatches the release workflow on that tag.
- Production publication and Pages deployment are gated by the protected `release-production` and `github-pages` environments respectively.
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

A passing source-level contract is not proof of a public release. The authoritative completion evidence is the exact-head CI matrix plus the production tag workflow and published release assets.
