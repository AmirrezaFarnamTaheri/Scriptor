# Final native review — 2026-10-04

This is the native evidence lane of the final polish review starting at
`19ff396a27d0c7e289ed82ca3d0b942f23f17c19`. This ledger is updated as findings
are investigated; inventory or static scanning does not imply semantic review.

Checkpoint update: NATIVE-01, NATIVE-02 and NATIVE-04 have implementation repairs
and regression tests in the current changes. Their runtime proof is pending
GitHub workers, including Unix execution for NATIVE-01. The descriptions below
record discovery evidence and are not current execution results. No further
local full tests/builds are authorized by the user.

## Coverage and evidence

| Area | Inspection | Disposition |
|---|---|---|
| Product, design, architecture, capability contracts and final review plan | Contract review | Experimental and packaged/live-provider limitations remain authoritative |
| `commands/source_files.rs` | Complete semantic inspection | Bounded UTF-8/format/path checks, originating vault, locked CAS, recovery preimages, strict creation; no confirmed defect so far |
| `commands/overleaf.rs` | Complete semantic inspection | Fixed remote host, brokered execution, complete index preservation, raw blob identity and ordinary non-force pushes; no confirmed defect so far |
| `commands/collaboration.rs` | Complete semantic inspection | Validation, bounded JSON/envelopes, origin/grant scope, read/write dispatch and finite polling checked; ambiguous Drive JSON revisions require refusal (NATIVE-02) |
| `commands/code_chunk/runtime.rs` | Complete semantic inspection | Startup reservations, transition guard, source-bound grants, cell/output bounds, cleanup and tests checked; process-tree guarantee depends on NATIVE-01 |
| `crates/system-bridge/src/process.rs` | Complete semantic inspection | Unix descendant escalation requires investigation (NATIVE-01) |
| `commands/publishing.rs` | Complete semantic inspection | Receipt-bound deployment snapshot and bounded processes checked; timeout credential redaction requires repair (NATIVE-04) |
| `commands/health_repair.rs` | Complete semantic inspection | Reviewed fingerprints, source/reference proof, durable preimage, rename interlock and restore CAS checked; no confirmed defect so far |
| `crates/vault/src/fs.rs` | Partial semantic inspection | Mutation lock, atomic-write, destination permissions and orphan cleanup checked |
| `crates/ipc/src/lib.rs` | Partial semantic inspection | Frame bounds and resynchronization checked; scanner over-read repaired (NATIVE-03) |
| Remaining native/core modules | Pending | No whole-corpus audit claim |

## NATIVE-01 — Unix descendants can survive termination

**State:** strongly inferred from the current implementation; regression and
remediation are being developed. **Category:** cancellation/reliability.
**Priority:** medium. **Platform:** Linux/macOS.

`terminate_process_tree` sends SIGTERM to the launch process group, waits, then
sends SIGKILL only if the direct child is still running. A leader that exits on
SIGTERM and a descendant that ignores SIGTERM satisfy that branch condition:
the remaining descendant is never escalated. It can keep a captured pipe open,
causing the drain deadline to expire, and survive the returned cancellation or
timeout. Kernel stop and publishing/export cancellation consequently cannot
rely on complete process-tree shutdown for that case.

The recommended repair escalates the launch group regardless of leader status
and reaps the direct child on cancellation. A Unix subprocess regression must
exercise the real leader/descendant interleaving. Windows-only execution does
not establish the Unix regression's result.

## Rejected or constrained hypotheses

## NATIVE-02 — Drive JSON revision duplicates are silently ambiguous

**State:** source-confirmed; failing regression awaiting the serialized native
test lane. **Category:** data integrity. **Priority:** medium.

JSON append queries request up to two matching immutable identities, but the
current branch chooses the first record even when both exist. A retry or
concurrent append can consequently produce ambiguity that an idempotent append
does not surface. The Google Docs branch already refuses duplicates. Both
transports should share a strict zero-or-one existing-record check, preserving
idempotent reuse only when the unique stored record has identical content.

Regression: `immutable_revision_identity_rejects_ambiguous_existing_records`.

## NATIVE-03 — IPC recovery consumes recovered bodies and later frames

**State:** runtime-confirmed and repaired. **Category:** framing/reliability.
**Priority:** medium.

After a corrupt initial header, `sync_to_length_field` read up to 4096 bytes
and returned every byte after the next magic marker as a partial length. The
next function rejected a partial length longer than four bytes; the body and
following frame had already been consumed. A five-byte junk prefix followed
by two valid frames is a concrete trigger. Recovery now stops exactly after
magic, preserves subsequent bytes, and retains the finite scan budget with a
constant-size rolling window.

The root ran the new regression against the original implementation and
observed `Codec("length prefix longer than 4 bytes")`. After repair,
`cargo test --locked -p scriptor-ipc --jobs 1` passed all 24 tests on Windows,
including the multi-frame regression and the 10,000-input malformed corpus.

## NATIVE-04 — Publication timeout errors bypass credential redaction

**State:** source-confirmed; failing regression awaiting the serialized native
test lane. **Category:** diagnostic confidentiality. **Priority:** medium.

Successful deployment receipts redact the configured API token from stdout and
stderr, but `run_process` errors were converted to strings before that closure.
`BridgeError::ProcessTimeout` includes captured stderr in its display text, so
a tool's diagnostic containing that token is returned to the renderer intact.
The same redaction must apply before returning any process error; the timeout
status and useful non-secret diagnostic should remain visible.

Regression: `deployment_timeout_diagnostics_do_not_expose_api_credentials`.

## Rejected or constrained hypotheses

- Source file content hashes retain raw line endings and invalid UTF-8 fails
  explicitly. Recovery storage is separate from prose history.
- Overleaf sparse materialization does not erase unrelated files: the complete
  remote tree is loaded before updating the selected index entry. The existing
  selective-commit test characterizes that behavior.
- Source operations bind to a cloned originating session rather than silently
  applying the same relative path to a newly selected vault. Filesystem races
  with an independently hostile local actor have not been reproduced and are
  not promoted to security findings.

## Verification and limits

The root review owns Cargo gates; this lane has not launched competing Cargo
processes. The root reported a full build disk and corrupt cached metadata and
is repairing that environment before retrying. These environmental failures
are not classified as application defects.

Live provider writes, packaged WebViews, physical mobile devices, and Unix
execution are not implied by desktop renderer fixtures or Windows test runs.
