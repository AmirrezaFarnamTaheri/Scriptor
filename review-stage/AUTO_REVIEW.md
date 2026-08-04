# Review evidence ledger

**Date:** 2026-08-04  
**Scope:** Pull request 29, frontend UI architecture and polish

This document records review evidence. It is not a production-readiness certificate. A claim is marked verified only when the named command or inspection completed against the current PR head.

## Corrected findings

- Git status loading and failure states now originate in `useWorkspaceGit` and are rendered by `GitPanel`.
- Git file-row actions are outside the checkbox label, and row callbacks are defined at the panel level.
- Visual tooltips are hidden from assistive technology because triggers already carry complete accessible names.
- Keyboard shortcut labels are platform-aware rather than hard-coded to macOS.
- The panel shell no longer establishes a transformed containing block for fixed descendants.
- Project and design guidance now match `package.json` and `src/index.css`.
- Unsupported plugin and MCP discovery-state props were removed instead of leaving unreachable UI branches.

## Verification status

| Check | Status | Evidence |
|---|---|---|
| Source review of modified components | Reviewed | Current PR head inspected through GitHub file API |
| Review-thread reconciliation | In progress | Each thread is verified against the current head before resolution |
| TypeScript and ESLint | Pending CI | Do not infer success from source inspection |
| Frontend build | Pending CI | Do not infer success from source inspection |
| E2E and accessibility checks | Pending CI | Focused regression coverage is included in this PR |
| Rust, Docker, and repository-wide gates | Pending CI | Report separately from frontend regressions |

## Readiness rule

The PR is ready only after current-head CI is green for required checks, all still-valid review findings are addressed, and any unrelated or environmental failures are identified with evidence. No numeric score is assigned.
