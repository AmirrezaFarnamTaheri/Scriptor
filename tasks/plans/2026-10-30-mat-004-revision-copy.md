# MAT-004 — Create a separate note from a reviewed historical revision

## Goal and boundaries

Offer an expressly reviewed, non-destructive alternative to replacing a current note. The user can inspect the existing current-versus-retained-revision diff and then copy the selected revision into a different Markdown path. This first slice adds no storage engine, no new Tauri command, no new permission grant, and no automatic conflict resolution.

## Implementation

- Reuse the existing note-history preview and native revision reader, bound to its initiating vault.
- Show a collapsed, keyboard-reachable "Keep a separate recovered copy" form with a proposed destination, editable path, and separate confirmation.
- Re-read the retained revision before writing and compare its bytes against the reviewed preview. Refuse when the vault or selected revision changes.
- Use the native vault writer's existing atomic "<missing>" content-hash precondition and exact expected vault ID. If the destination already exists, preserve it and show the native collision error. Never retry as overwrite or silently choose another name.
- Leave the original current note and the existing destructive historical restore pathway unchanged.

## Source evidence and remaining acceptance

The focused Node 22 TypeScript-strip harness initially failed because the helper module did not exist, then passed seven assertions covering the create-only precondition, stale preview, vault switch, missing and unsafe paths, collisions, and cancellation. These are isolated behavioral checks and source contract assertions, not real filesystem, browser, or installed-client acceptance.

Before graduating MAT-004: run exact-head full source/Rust/desktop/browser/visual/docs gates; verify real native create-only collisions, read-only preview and a changed target on Windows/macOS/Linux; inspect focus and geometry at 320/375/768/1024/1440 and 200% zoom, keyboard and RTL; add full backup restore preview/diff, changed-source conflicts, explicit per-path approvals, crash/reopen and retry scenarios. Keep issue #183 open until the complete criteria hold.
