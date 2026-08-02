# Verification record

This document defines what constitutes proof for the current source candidate. Update it with the exact commit and command output for each release candidate.

## Claim vocabulary

- **Verified:** command executed against this source state and passed.
- **Statically validated:** source was parsed or checked without compiling/running the full product.
- **Reviewed:** code and contracts were inspected, but no executable proof was available.
- **Pending:** required proof depends on unavailable tooling, credentials, platform, or canonical history.
- **Failed:** command executed and did not pass.

## Repository-native checks

Run from the repository root:

```bash
npm run check:source --silent
npm run check:governance --silent
npm run check:mcp --silent
npm run check:plugins --silent
npm run check:canvas --silent
npm run check:portal --silent
npm run check:export --silent
npm run check:headless --silent
npm run check:citations --silent
npm run check:knowledge --silent
npm run check:merge --silent
```

`check:source` covers canonical IPC generation, Rust source/module/process contracts, native authorization inventory, and frontend quality. `check:governance` covers version parity, immutable Actions, package boundaries, locale parity, documentation/license contracts, and frontend quality.

## Full engineering gate

A release candidate is not verified until these run in a clean environment with the pinned toolchains:

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm build
pnpm check:contracts
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo deny check
```

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

- produce installers from the exact audited source/tag;
- verify Windows Authenticode, macOS Developer ID/notarization/staple, and Linux detached signatures;
- verify `SHA256SUMS`, SBOM, release receipt, and GitHub attestation;
- clean-install each package;
- create an external backup, corrupt a copy, prove rejection, then restore on each supported OS;
- interrupt restore and MCP mutation flows and prove deterministic recovery;
- run startup, idle-memory, index, search, graph, editor, and export performance gates.

## Canonical history gate

Run from a full canonical clone:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

Also run an approved full-history secret scanner and capture branch protection, required reviews, environment protection, signed tags, and release lineage from the hosting platform.

## Environment limitations for this remediation build

The remediation environment provided Node and a TypeScript parser but did not provide the pinned Rust toolchain, an installable pnpm dependency graph, browser binaries, native signing credentials, or canonical Git history. Therefore Cargo, full TypeScript semantic build, Playwright/axe, Tauri package, platform signature, restore-drill, and history claims remain **pending**, not implied by static success.

## Remediation candidate execution record — 2026-08-01

The following checks were executed against the final source candidate in the remediation environment.

### Verified

- `npm run check:source --silent` — 11 source-contract tests passed; 148 Rust source files passed lexical/module/process/unsafe-policy checks; 19 high-impact native commands passed authorization inventory; 389 production TypeScript/CSS files passed frontend policy checks.
- `npm run check:governance --silent` — version parity across 16 npm manifests, 16 Cargo manifests, and Tauri; five workflow files with 45 immutable external action uses mapped to seven verified release identities; 14 deep-module packages/361 source files without boundary violations or cycles; three locales with 256 keys each; 15 required documents.
- `npm run check:contracts --silent` — canonical generated IPC TypeScript contracts passed semantic type checking, including authenticated daemon event resynchronization.
- Repository-native behavior runners passed for MCP, plugins, canvas (8 tests), portal (5), export (17), headless (1), citations (7), knowledge (7), and merge/conflict handling (11).
- `npm run check:frontend-quality --silent` — interaction contracts, focus containment, theme coherence, responsive styles, no production `any`, no emoji glyph controls, no remote fonts, no static inline-style regressions, and no `transition: all` passed across 389 production TypeScript/CSS files.
- Current-tree secret-pattern, data syntax, relative-import, CSS import, lockfile/importer, action-pin, version, documentation, locale, package-boundary, and `git diff --check` validations passed.
- CycloneDX generation completed for the declared npm/Cargo graph. The generated SBOM and release receipt are delivery evidence, not substitutes for package-manager and Cargo vulnerability scans.

### Pending because the environment could not provide the required dependency/toolchain/runtime

- `check:editor` stopped at missing installed `@codemirror/language`; `check:renderer` stopped at missing installed `unified`.
- `npm run build`, lint, browser accessibility, E2E, and visual regression could not start because Corepack could not download pinned pnpm and the frozen dependency graph was not installed (`EAI_AGAIN registry.npmjs.org`).
- TUI, daemon smoke, performance, Cargo formatting, compilation, Clippy, tests, and `cargo-deny` could not run because the pinned Rust toolchain was unavailable.
- Tauri packaging, native signing/notarization, fresh visual snapshots, screen-reader/zoom review, restore drills, and platform performance measurements require supported OS runners, browsers, credentials, and installed tools.
- `scripts/governance/history-audit.sh` correctly refused the one-commit archive-derived working repository; it must run against the canonical full-history clone.

A pending item is a release gate, not an inferred pass. This deliverable is a source-complete remediation candidate. Promotion to a signed production binary requires every applicable clean-environment gate above to pass against the exact packaged source hash.
