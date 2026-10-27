# Restore Outcome Classification — Design
Date: 2026-10-27

## Problem
Scriptor's native backup restore already reports four terminal outcomes, but `useVaultBackup` directly interprets them alongside UI lifecycle effects. Subsequent integrations risk reproducing different meanings, especially when a restore commits files but fails reopening.

## Chosen approach
A pure status-to-disposition mapping is the first incremental step, rather than introducing a new global operation framework. The existing native restore implementation remains authoritative. The hook keeps all current lifecycle events and UI messaging. This bounded slice is a foundation for MAT-002; it does not claim to solve ambiguous transport failure after a native commit.

## Contract
`rolled-back`: files unchanged, original editor persistence can resume, no restored workspace refresh.
`committed-ready`: files changed, old draft must stay frozen, restored workspace can refresh.
`committed-needs-reopen` and `recovery-required`: treat content as changed/unsafe for old drafts, do not refresh pre-restore session, require reopen/recovery.

## Test and review
Exercise all four status variants with an independent pure test; verify hook wiring and existing restore lifecycle regression; require exact-head hosted CI, desktop compile and relevant functional tests before merge. Keep PR #179's dependency changes separate.

## Scope boundaries
No new Recovery Center, generic receipts, native transaction rework, new permission broker, or production release in this first PR. These are dependency-ordered backlog items.
