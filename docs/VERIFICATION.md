# Verification record

This document defines proof for the current source candidate. A release record must name the exact commit, source-tree hash, command, environment, and artifact set.

## Claim vocabulary

- **Verified:** the stated command executed against this source state and passed.
- **Statically validated:** source or generated metadata was parsed and checked without compiling or running the full product.
- **Reviewed:** code and contracts were inspected without executable proof.
- **Pending:** required proof depends on unavailable tooling, dependencies, credentials, platform, browser, or canonical history.
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

`check:source` covers generated IPC contracts, Rust source/module/process/unsafe policy, native authorization, frontend policy, hotspot ownership, benchmark utilities, release signing/evidence contracts, and the RustSec exception ledger. `check:governance` covers version parity, immutable Actions, package boundaries, locale parity, documentation/license contracts, frontend policy, and hotspot ownership.

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

## UI and accessibility gate

```bash
pnpm test:e2e
pnpm test:visual
pnpm check:a11y
pnpm check:a11y-axe
```

Required manual matrix:

- 320, 375, 768, 1024, and 1440 CSS-pixel widths;
- light and dark themes;
- Windows, macOS, and Linux desktop shells;
- keyboard-only primary workflows;
- screen-reader smoke test;
- 200% browser/OS text zoom;
- reduced-motion mode;
- empty, loading, error, success, destructive-confirmation, and long-content states.

## Release and recovery gate

- Build installers from the exact audited source commit.
- Verify Windows Authenticode, macOS Developer ID/notarization/staple, and Linux detached signatures.
- Generate platform signing evidence during each packaging job.
- Run `node scripts/release/verify-signing-evidence.mjs release-artifacts production` before generating the SBOM and receipt.
- Generate receipt schema 3 in the promotion job after all platform artifacts are downloaded.
- Run `node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence`; the verifier rejects source drift, a dirty checkout, missing or extra subjects, unsafe paths, symlinks, checksum/SBOM mismatch, incomplete signing evidence, unsigned production artifacts, and missing macOS notarization.
- Verify GitHub attestations and release-tag lineage.
- Clean-install each package.
- Create an external backup, corrupt a copy, prove rejection, and restore on each supported OS.
- Interrupt restore and MCP mutation flows and prove deterministic recovery.
- Run startup, idle-memory, index, search, graph, editor, and export performance gates.

## Canonical history gate

Run from a full canonical clone:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

Also run an approved full-history secret scanner and capture branch protection, required reviews, environment protection, signed tags, and release lineage from the hosting platform.

## Remediation candidate execution record — 2026-08-03

The following evidence was produced against the source candidate delivered with [`REMEDIATION-2026-08-03.md`](REMEDIATION-2026-08-03.md).

### Verified

- Version parity: `0.1.0` across 16 package manifests, 16 Cargo manifests, and Tauri configuration.
- Action policy: five workflow files, 43 external action uses, and seven immutable release identities.
- Package boundaries: 14 packages and 377 source files with no unexported cross-package import or package cycle.
- Locale parity: three locales with 256 keys each.
- Documentation contracts: 15 required documents and referenced repository paths.
- Source contracts: 13 tests, including lazy editor ownership, canonical 1k benchmark requirements, and exact-source release evidence.
- Rust lexical/module/process/unsafe policy: 151 Rust files.
- Native authorization inventory: 19 high-impact command bindings.
- Frontend policy: 405 production TypeScript/CSS files.
- CSS custom-property policy: 37 files, 77 declarations, and 894 uses.
- Hotspot ratchet: six hotspot ceilings and ten extracted domain owners.
- Note deletion behavior: serialized ordered success, duplicate/cancellation/disk rejection, best-effort post-delete reconciliation, and combined close/rebuild/refresh failures.
- Utility tests: three benchmark, two source-identity, four release-evidence, and three SBOM lockfile tests.
- Repository-native behavior runners passed for MCP, plugins, canvas (8 tests), portal (5), export (17), headless (1), citations (7), knowledge (7), and merge/conflict handling (11).
- JavaScript syntax parsing passed for 33 files. TypeScript/TSX syntax parsing passed for 391 source files with zero parse diagnostics.
- Static security patterns found no private-key header, common live-token prefix, disabled TLS verification, app-source dynamic execution, permissive CORS, or shell-string process construction.
- Source identity tests prove canonical Git-blob hashing across line-ending-normalized clean worktrees, large binary blobs, and dirty-tree rejection.
- New guards were falsified before acceptance: known-bad action pins, process launches, entry-to-editor bundle graphs, undefined CSS tokens, oversized modules, release subject extras, and artifact tampering fail; restored inputs pass. The bundle test uses a generic emitted filename to prove manifest key/source identity matching.

### Pending because this environment lacks the required dependency/toolchain/runtime

- Editor runner stops before tests because the supplied partial dependency tree lacks `style-mod`.
- Renderer runner stops before tests because the supplied partial dependency tree lacks `bail`.
- Full TypeScript semantic build stops at absent installed `vite/client` and Node type libraries.
- ESLint cannot execute because the pinned dependency graph is not installed; its configuration now fails on any warning.
- Cargo formatting, compilation, Clippy, tests, and `cargo-deny` cannot run because the pinned Rust toolchain is unavailable.
- Production Vite output, browser accessibility, E2E, visual regression, Tauri packaging, signing/notarization, clean install, restore drills, and platform performance measurements require clean supported runners and credentials.
- Git-history ownership, hotspot history, signed-tag lineage, and full-history secret scanning require the canonical repository rather than an archive-derived tree.

The release-evidence smoke test uses a temporary Git snapshot only to falsify verifier behavior. It proves pass/tamper/extra/dirty rejection logic; it is not provenance evidence for a canonical release.

A pending item remains a release gate. Static and source-level remediation does not imply a signed production release.
