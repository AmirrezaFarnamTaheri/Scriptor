# Workspace/session proposal reconciliation (2026-10-14)

This review reconciles an externally supplied two-part *production-grade workspace viewport* proposal with Scriptor's actual source. The proposal was based on an explicitly truncated archive and synthesized interfaces. Treat its alleged cross-platform invariants and completeness claims as **hypotheses**, not executable contracts.

## Verified source of truth

| Responsibility | Existing implementation | Contract to preserve |
| --- | --- | --- |
| Desktop note session | `crates/vault/src/workspace_session.rs`, `src/hooks/useWorkspaceSession.ts` | Version-1 JSON (`active_path`, `open_tabs`, `collapsed_folders`, `sidebar_view`) stored under the vault; atomic write via `crate::fs::atomic_write` |
| UI workspace leaves | `src/lib/workspaceLeaves.ts`, `src/hooks/useWorkspaceLeaves.ts`, `src/hooks/useWorkspaceComposition.ts` | Separate, vault-scoped, validated version-1 layout with up to 24 references and guarded async transitions |
| Chrome and editor panes | `src/App.tsx`, `src/components/shell/WorkspaceLeafDock.tsx`, `src/styles/app/*` | React/CSS layout owns viewport measurements, independent dock scrolling and responsive reflow |
| Markdown editing/preview | `packages/editor/src/wysiwyg-decorations.ts`, `src/hooks/useEditorPreviewScrollSync.ts` | CodeMirror source and editable-preview content remain synchronized without rewriting Markdown |
| Terminal UI | `crates/cli/src/tui.rs`, `crates/cli/src/term_markdown.rs` | Ratatui with unicode-segmentation and Unicode display width, not a new hand-built fixed-width frame |
| Approved Python execution | `apps/desktop/src-tauri/src/commands/code_chunk/runtime.rs` and `kernel.py` | Bounded, supervised persistent Python execution; it is **not** an AST text chunker |

## Compatibility decisions

1. **Do not replace the existing v1 Rust session with either generated schema.** The supplied proposals contradict one another: schema v1/64 tabs versus schema v2/128 tabs, mutually incompatible tab fields, pane weights, and wire-frame definitions. Neither integrates with Scriptor's current React/bridge contracts, and no migration/rollback strategy was demonstrated.
2. **Do not add a second viewport shell** under `apps/desktop/src/workspace/`. Shared desktop/web UI lives under the root `src/`. A parallel shell would duplicate tab navigation, shortcut ownership, resize observers, and scroll synchronization.
3. **Do not introduce a new zero-copy IPC wire protocol for CSS geometry.** The existing use case crosses Tauri/JSON boundaries with typed commands. Zero-copy transport claims in the proposal lack benchmarks and do not fix the observed viewport/scroll ownership bugs.
4. **Do not remove the Python runtime kernel as a 'chunking helper'.** The existing file executes approved Python cells, streams stdout/stderr, and emits PNG plot output; replacing it with Rust AST chunking would delete a product feature.
5. **Do not merge similarly named citation/publishing modules or externalize committed lock assets solely by filename.** Such changes require ownership/call-graph and reproducibility studies independent of the workspace visual fix.
6. **Do not replace the atomic file writer with a second implementation.** `crate::fs::atomic_write` already centralizes durable writes, permissions, and rename behavior.

## Validated improvements in PR #162

- Stop root-page scrolling and restore independent vault/embedded workspace scroll ownership.
- Remove redundant note tabs without hiding inert restored references or losing tool navigation.
- Restore leaf state only after vault indexing, guard cross-vault stale preview responses, and use composition-aware note navigation.
- Keep editable Markdown GFM checkbox markup and frontmatter controls source-synchronized.
- **Harden persisted v1 sessions** with bounded reads/writes, version/path/duplicate validation, and tests ensuring rejected writes never overwrite the previous valid file.
- **Sanitize terminal-facing text** before Ratatui renders arbitrary filenames and remote diagnostic strings; retain grapheme-safe Unicode truncation.

## Verification and further work

Required gates before merge: CI frontend and Rust builds, Clippy `-D warnings`, `cargo fmt --all --check`, Rust unit tests, Playwright workspace/preview regression tests, Windows desktop/visual workflows, 320–1440 px + high-zoom + RTL checks.

Future independent design work, not a reason to block this visual PR: measure actual multi-window workspace state conflicts, assess whether a versioned cross-process dock layout is needed, and prototype migrations with backwards compatibility and recovery before changing the persisted schema. Evaluate GUI/mobile/TUI feature parity against actual product requirements rather than requiring identical physical layouts.
