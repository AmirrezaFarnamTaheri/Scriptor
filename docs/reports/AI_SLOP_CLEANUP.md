# Frontend UI cleanup review report

**Date:** 2026-08-04  
**Scope:** Pull request #29  
**Status:** reviewed and corrected; current-head CI passed

## Purpose

This report records concrete defects removed from the frontend-polish change set. It is not a certificate that the repository contains no remaining debt.

## Corrected defects

- **Unreachable Git loading and error states:** status lifecycle now originates in `useWorkspaceGit` and is selected through a pure state helper.
- **Invalid interactive markup:** Git row buttons were moved outside the checkbox label and associated with the checkbox through `htmlFor`.
- **Memoization defeated by inline callbacks:** row handlers now originate at the parent and remain stable across selection-only changes.
- **Tooltip accessibility ambiguity:** visual tooltip content is hidden from assistive technology while triggers expose complete accessible names.
- **Fixed overlay containment risk:** the shared panel shell no longer uses a transform that changes the containing block of fixed descendants.
- **Unowned async states:** plugin and MCP loading/error APIs that callers could not truthfully supply were removed.
- **Documentation drift:** React, TypeScript, Vite, CSS, Tauri, daemon, MCP, token, and font guidance now points to executable sources of truth.
- **Unsupported completion claims:** duplicate task ledgers and claims of universal sub-16 ms rendering, complete visual validation, or zero remaining debt were removed.

## Focused regression evidence

- `scripts/validation/frontend-polish-contracts.test.mjs`
- `scripts/validation/source-contracts.mjs`
- `e2e/frontend-polish-regressions.spec.ts`

The focused Node contracts, source contracts, frontend-quality validation, CSS custom-property validation, action-pin validation, package-boundary validation, i18n parity, documentation contracts, and module-size ratchet completed successfully against the repaired source snapshot.

## Review-thread reconciliation

All inline review threads were checked against the current effective diff. Valid findings were repaired. Release-signing findings were withdrawn as stale-base findings after the branch was synchronized with `main`; release workflow and release-security files are not part of the effective PR diff.

## Verification outcome

GitHub Actions run `30929841904` (CI run 264) completed successfully for head `171d0a2855419d41fe466c41fdec89448e8050d5`. All seven jobs passed: source provenance, supply-chain audit, contracts/lint, Rust tests, frontend/accessibility/TUI/daemon smoke, container smoke, and Windows release/performance gates.

## Remaining release-candidate checks

- Manual screen-reader, native-shell, 200% zoom, and release-candidate visual review are not inferred from source inspection or the current CI matrix.
- Final merge remains subject to repository approval and branch-protection policy.
- Future debt should be reported as scoped findings with reproducible evidence, not as a global “slop” score.
