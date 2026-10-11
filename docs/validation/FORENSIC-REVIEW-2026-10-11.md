# Forensic review — 2026-10-11

## Scope and disposition

This review examines commit `e753f83c6ce2704bdbfaed4d6ddecca6791647b3` after it was
synchronized with `github/main`. It is a source and repository-contract review,
not a release certification. The product's supported claims continue to be
bounded by [CAPABILITY-MATURITY.md](../CAPABILITY-MATURITY.md), and executable
release evidence remains governed by [VERIFICATION.md](../VERIFICATION.md).

The initial static inspection did not confirm a defect with a minimally
supported remedy. A subsequent targeted review identified and addressed the
provider URL-to-Markdown boundary below. The resulting source changes require
exact-head hosted verification.

## Evidence classes

| Class | Evidence used | Disposition |
|---|---|---|
| T2 — implementation | Tracked source tree, package/workspace manifests, lockfiles, architecture/product/design contracts, CI workflow, validation scripts | Inspected and statically checked where the repository provides a deterministic check |
| T3 — history | Current `main` tip and recent remediation commits | Confirms that review findings through 2026-10-10 were actively repaired; it does not certify the current tip |
| T4 — documentation | Product, design, architecture, capability maturity and verification records | Cross-checked against ownership and validation contracts; not used as standalone runtime proof |
| T1 — runtime | No new eligible local product execution | Absent for this revision; hosted workers are required by `docs/VERIFICATION.md` |

## Corpus accounting

| Category | Inventory | Review status | Notes |
|---|---:|---|---|
| Tracked files | 33,172 | Inventory complete | Includes source, fixtures, generated/vendor assets, documentation and release evidence |
| Frontend TypeScript/CSS | 793 policy-scanned | Static policy check passed | Token use, unsafe casts and forbidden UI patterns are covered by `frontend-quality.mjs` and `css-custom-properties.mjs` |
| Rust source | 242 policy-scanned | Static source contract passed | Module resolution, process-broker routing and unsafe-block documentation are checked by `rust-source-contracts.mjs` |
| Package source | 737 files across 16 packages | Static boundary check passed | No undeclared deep imports or package cycles reported by `deep-module-boundaries.mjs` |
| Workspace manifests | 21 Cargo packages | Static lock/dependency check passed | `cargo-lock-workspace-deps.mjs` completed successfully |
| Native bridge | 195 bridge commands / 205 handlers | Static contract check passed | `tauri-command-contracts.mjs` completed successfully |
| Authorization catalog | 205 classified operations | Static inventory passed | 55 brokered, 95 read-only and 55 local-mutation commands reported by `authorization-inventory.mjs` |
| Locales | 3 locales / 1,102 keys each | Static parity check passed | `i18n-parity.mjs` completed successfully |
| Workflows | 13 workflows / 85 third-party action uses | Static pin policy passed | Immutable action identities are enforced by `action-pins.mjs` |
| Vendored PDF bundles | 2 minified artifacts | Inventory-only | Their provenance and delivery boundary, rather than minified semantics, are the relevant review target |

The static totals are tool output, not a claim that every source line received
individual semantic review. Generated, binary and vendored artifacts were not
mistaken for first-party implementation.

## Architecture and cross-layer findings

### FR-01 — Hosted verification is the only valid current runtime evidence

- **Classification:** Confirmed; verification gap, not a product defect.
- **Evidence:** `docs/VERIFICATION.md:11-14` restricts executable verification
  for the current review to GitHub-hosted workers. The CI workflow provisions
  Node 22.16.0, pnpm 10.33.0 and Rust 1.96.0 at
  `.github/workflows/ci.yml:103-123`.
- **Causal chain:** unsupported local toolchain -> unavailable TypeScript loader
  and pnpm/cargo commands -> local execution cannot represent the pinned
  environment -> local results could be misleading.
- **Impact:** Runtime, package, browser, device and release status for this tip
  are unverified until the exact-head hosted matrix finishes.
- **Recommendation:** Preserve the existing exact-head hosted gate. Do not
  weaken the Node/Rust requirements or convert unavailable local execution into
  a passing result.
- **Validation:** Run the commands and matrices enumerated in
  `docs/VERIFICATION.md:46-165` on the exact commit.
- **Residual risk:** Hosted tests do not substitute for live provider accounts,
  packaged-device checks or human screen-reader evaluation.

### FR-02 — Capability claims remain appropriately bounded

- **Classification:** Confirmed.
- **Evidence:** `PRODUCT.md:52-64` and `docs/CAPABILITY-MATURITY.md:5-54`
  distinguish supported, experimental, evaluation and design-only capabilities.
  The runtime topology and authorization boundary are recorded in
  `docs/ARCHITECTURE.md:7-21` and `:107-119`.
- **Causal chain:** maturity ledger -> explicit evidence prerequisites ->
  capability labels -> prevents experimental integrations from inheriting the
  desktop product's support claim.
- **Impact:** Limits documentation and release overclaiming for Google,
  Overleaf, mobile, encrypted vaults, embeddings, Tantivy, WASM and plugins.
- **Recommendation:** Keep graduation conditional on the existing eight-item
  gate at `docs/CAPABILITY-MATURITY.md:56-67`; no broad status promotion is
  justified by static evidence.
- **Validation:** Require a named owner, authorization/recovery cases, bounded
  performance evidence, release inclusion and exact-head hosted proof per
  capability.
- **Residual risk:** Documentation cannot prove a remote account or device path.

### FR-03 — Supply-chain, authorization and module boundaries have enforceable gates

- **Classification:** Confirmed for source policy; unverified for current
  dependency advisory state.
- **Evidence:** `.github/workflows/ci.yml:91-211` freezes installs, checks lock
  immutability and makes cargo-deny/npm audit failures fatal. Static checks
  passed for action pins, package boundaries, Cargo dependencies, command
  classification and bridge handler resolution.
- **Causal chain:** pinned workflow actions and frozen lockfiles -> deterministic
  dependency graph -> audited dependency and command catalogs -> rejected
  unclassified authority and dependency drift.
- **Impact:** Reduces supply-chain and authority-expansion risk while preserving
  CI as the current advisory authority.
- **Recommendation:** Retain fatal hosted audit outcomes. Do not suppress an
  advisory without a recorded compatibility and reachability disposition.
- **Validation:** Re-run CI supply-chain and fast-validation jobs at the exact
  commit; inspect any audit failure in its published logs.
- **Residual risk:** An audit can only report known advisories and cannot prove
  a dependency is exploit-free.

## Static validation recorded during this review

The following dependency-free repository checks completed successfully before
an environment-dependent check was reached:

- module-size/ownership ratchet;
- CSS custom-property policy;
- frontend-quality policy;
- action pin policy;
- deep module-boundary and package-cycle policy;
- locale parity;
- documentation contracts;
- Rust source contracts;
- authorization inventory;
- Tauri command contracts;
- Cargo workspace dependency/lock contract.

`source-contracts.mjs` reached its embedded TypeScript test dispatch, but the
local Node 20 executable rejected `--experimental-strip-types`, a Node 22
feature required by this repository. `plugin-rust-gates.mjs` could not invoke
Cargo because Cargo is not installed locally. These are environment limitations,
not pass or failure evidence for the source under review.

## Rejected and unverified hypotheses

| Hypothesis | Disposition | Basis |
|---|---|---|
| The local Node failure identifies an application regression | Rejected | The repository requires Node >=22 and CI pins Node 22.16.0; failure occurs before TypeScript test loading |
| All product capabilities are release-ready because static checks pass | Rejected | Capability ledger and verification record explicitly require hosted, provider, package or device evidence for several surfaces |
| Recent fixes justify a large architectural rewrite | Rejected | Recent commits target concrete regressions; static policy checks show declared ownership and boundary contracts remain intact |
| No runtime risks remain | Unverified | Exact-head hosted execution and non-automated acceptance evidence are unavailable in this environment |

## Initial static assessment

The evidence supports a maintainable, policy-governed multi-surface workspace
with explicit authority, maturity and verification boundaries. It does not
support inventing a rewrite, relaxing release gates, promoting experimental
features, or claiming current runtime certification. The highest-value next
step is the existing hosted exact-head verification matrix; any failing job
should be traced from its artifact and fixed minimally with a regression test.

## Follow-up remediation — provider URL Markdown boundary

A deeper review found one concrete P2 data-integrity/security issue in the
calendar agenda export path. `safeExternalUrl` returned the trimmed input after
checking the parsed scheme. The URL parser removes control characters while
building its canonical `href`, but the original value was then interpolated
into Markdown. A provider value containing a newline could therefore influence
Markdown structure even though it passed the scheme allow-list.

The fix returns `URL.href` for canonical external values and adds
`safeExternalMarkdownDestination`, which wraps canonical destinations in angle
brackets. Calendar agenda generation now uses that Markdown-specific helper.
The regression suite covers control-character normalization and URLs containing
spaces/parentheses. `git diff --check` passed; TypeScript execution remains
blocked locally by the repository's Node 22 requirement and must be run on the
hosted exact-head matrix.
