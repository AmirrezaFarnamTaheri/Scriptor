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

## Method and coverage

This source/architecture inspection did not certify all first-party lines or
execute the product on every supported platform. Generated/vendored data and
large synthetic fixtures were distinguished from application code. The
[verification record](../VERIFICATION.md#pr-160-remediation-evidence--october-11-2026)
owns execution outcomes, inventory statistics and environment limitations.

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

## Verification provenance

The static policy runs, unsupported local toolchain and later hosted validation
appear in [Verification](../VERIFICATION.md#pr-160-remediation-evidence--october-11-2026).
Static review must not be presented as a native or live-provider result.

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
The regression cases cover canonicalization, Markdown delimiters, opaque `mailto:`
paths and literal provider titles/locations. For command results and execution
limitations, consult the [verification record](../VERIFICATION.md).
