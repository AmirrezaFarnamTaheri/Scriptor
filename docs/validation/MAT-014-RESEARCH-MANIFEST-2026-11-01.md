# MAT-014 — project manifest integrity review (first source slice)

Issue: [MAT-014 #194](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/194).

This first slice defines a **read-only, versioned** research-project manifest and compares it with explicitly supplied current-vault file and tool evidence. It does not write a manifest, invoke a compiler, grant a permission, rebuild an artifact, or claim that an unchanged output was reproducibly built.

## Contract

A schema-1 manifest contains `projectId`, `vaultId`, at most 500 unique vault-relative note/bibliography/source inputs with SHA-256, one disjoint output path with profile and SHA-256, and at most 32 versioned tool identities marked `authorization: review-required`. A snapshot supplies a verified originating vault ID, per-path present/missing/unavailable observations and SHA-256 for present entries, plus tool versions/availability.

`reviewResearchProjectManifest(manifest, snapshot)` returns `current` only if all listed hashes, output and tool versions match. Missing files or changed hashes are `stale`; absent, wrong-vault or unavailable observations remain `unverified`. Every result has `executionAuthorized: false`. Unsupported schema versions, absolute/traversal paths, duplicate records and malformed checksums fail closed.

This is a pure, local helper; no UI or native execution flow calls it yet. The audit does **not** infer that a source is safe from a missing record, and a manifest can never authorize external execution by itself.

## Evidence

- Eight source tests in `src/lib/researchProjectManifest.test.ts` cover matching origin, changed bibliography/output, missing source/tool, absent observation, cross-vault snapshot, schema rejection, path traversal, approval and duplicate/malformed replies.
- An initial test-only file failed to load the absent implementation; that is **not** claimed as a behavioral RED. After implementation, local Node 22 ran eight tests with zero failures on the first-slice equivalent source.
- The GitHub production source blob `969aceed4b8272919ae50d97106a18f1be7ff873` matches the locally tested source. Exact-head CI and the committed source test remain required.

## Still required for MAT-014

Native vault-owned manifest loading and verified revision-sensitive file reads; schema migration and consent UX; project creation and output provenance; deterministic clean rebuild where tools permit; changed-input invalidation; missing-compiler/unapproved/cancelled-process outcomes; publication receipts and byte hashes; installed and user acceptance. The pure validator alone does not establish 50% progress or close this workstream.
