# MAT-021 — process broker prelaunch cancellation

**Issue:** https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/201
**Scope:** native process broker in `crates/system-bridge/src/process.rs` only.

## Problem and bounded fix

Previously `run_process` launched a child by calling `spawn_process` before inspecting a pre-set `ProcessSpec.cancel_slot`. As a result an already canceled request could still resolve/hash an executable, start an external process, and then terminate it in the poll loop. Direct `spawn_process` calls also ignored an already-set cancel bit.

The broker now checks the existing caller-owned cancellation slot before executable resolution and again just before the OS spawn call, returning the same `ProcessPolicy("process cancelled by caller")` category already used after launch. No new authority, grant, policy override, executor, environment variable or process lifecycle manager is added. The existing post-spawn cancellation and bounded process-tree termination paths are unchanged. Races after the final pre-spawn check are still handled in the poll loop; this is not a guarantee that concurrent cancellation can atomically prevent a just-starting process.

## Regression and verification

Two targeted Rust unit tests were committed first (`ed3bf71`, corrected borrow in `e3666fe`):

- `cancelled_request_must_not_resolve_or_launch_an_executable`: pre-set cancellation on a deliberately missing executable must return *canceled*, not attempt resolution.
- `direct_spawn_rejects_a_pre_cancelled_process_spec`: direct broker spawn must fail closed on the same pre-set cancellation state.

Implementation commit: `b6e3c53`.

**Behavioral RED not claimed:** the test-only commit was authored before implementation, but no hosted failing result has been observed. Exact-head Rust workspace tests, full CI and Windows/macOS/Linux installed process-tree tests remain required. An offline sandbox without a Rust toolchain cannot independently compile these tests.

## Still open

MAT-021 acceptance also requires cancellation during a hung descendant tree, timeout before/after spawn, stdout/stderr flood, output redaction, path escape, restart after interrupted processes, and adapter-by-adapter validation for LaTeX, Pandoc, Typst, Python, diagrams and publishing. Do not graduate this issue or release based on this slice.
