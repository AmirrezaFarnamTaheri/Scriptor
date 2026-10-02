# Health repair and source-file workflows

## Health repairs

Implemented reviewed creation of missing notes, tag-case normalization, and recoverable unused-asset pruning. Each preview binds the originating vault, request, source content, and fingerprint. Apply regenerates the preview under the vault mutation lock and refuses changed sources. Asset pruning requires a complete bounded physical reference scan; unreadable, oversized, non-UTF-8, or linked scan inputs fail closed. Recovery records use immutable UUID directories, synchronized preimages and receipts, and exact displayed-receipt validation. Restoration checks the applied-state hash and preserves destination collisions and subsequent edits. Pending rename transactions block both apply and restore.

The source-note mutation coordinator flushes active drafts and treats a cancelled coordinator result as cancellation. Explicit in-product review remains required for apply and restore. The repair headings are omitted when they have no available actions.

Verification: five helper behavioral tests passed; root reported all three health browser fixtures passed. TypeScript and focused ESLint passed after coordinator alignment. Six native behavioral tests are present, including rename blocking and references in new source files/Obsidian CSS. TeX image references without an extension conservatively block pruning as well. Coordinated native execution is owned by the root agent and its final result should be recorded in the delivery evidence.

## Source files

The investigation confirmed an unreachable workflow: the vault tree filtered out `.tex` and `.py`, while publishing required an active LaTeX file. The existing note read/write contract accepts paths without distinguishing source files and generates Markdown metadata/history. A dedicated source document and command boundary now avoids that prose pipeline.

`source_file_read`, `source_file_save`, and `source_file_create` handle a bounded allowlist of UTF-8 text formats, including LaTeX, Python, Rust, JavaScript/TypeScript, structured data, and plain text. Reads bound bytes while reading; saves require the original vault and content hash, serialize through the vault mutation lock, respect pending rename transactions, and persist immutable recovery copies before replacement. Creation uses a durable absent-preimage record followed by an exclusive create. Markdown and reader/media documents retain their existing workflows.

The editor supplies explicit open/create/save/reload, preserves CRLF on edits, retains drafts after failures, and asks how to handle unsaved changes before close, navigation, or vault changes. LaTeX compilation requires a saved clean file and explicit source review, and uses the existing authorized process broker and cancellation/results. Python editing does not automatically execute code.

Verification: source helper tests failed before implementation and then passed 2/2. TypeScript and focused ESLint passed. Both source browser fixtures passed after shell integration: explicit create/reviewed saved-source compilation, and stale-save retention plus cancelled close/vault switching at 390px. Three native tests cover creation collisions, exact text bytes/recovery, stale hashes, rename blocking, invalid UTF-8, oversized inputs, and forbidden paths. Coordinated native execution is owned by the root agent.

Saved clean `.tex`, `.ltx`, and `.bib` files can open the Overleaf sync panel. Editing and navigation are disabled while that panel owns the document; an applied source must match its originating vault/path before updating the editor hash and content. The collaboration owner supplies the sync workflow and its separate verification.

## Boilerplate findings applied

Scoped source-editor research inspected `editors.rs`, `files.rs`, `file_io.rs`, `file_types.rs`, `buffers.rs`, and `workspace_state.rs` under `C:/Users/ACER/Desktop/Rust Boilerplate`. Useful patterns were explicit extension/file identity, separate typed file panes, bounded views, and source-mode state. Its external OS opener and unrestricted absolute-path writes are not appropriate for this vault editor; its write allowlist also omitted LaTeX. This scoped inspection supplements the separately maintained comprehensive boilerplate audit, and does not claim every line of those six files was reread in this subtask.

## Independent offline PDF review

The desktop adapter validates active vault and export capability before and after awaiting its worker, copies bounded resources into an isolated compiler world, rejects symlinks, and keeps its compiler lease owned by the worker even if the caller stops waiting. Two limitations were reported to the root owner: the shared asset writer's absence-check-plus-replacement did not enforce strict exclusive creation against external writers, and compiler page/output limits are checked after compilation/serialization, without a CPU deadline. Root owns subsequent PDF changes and their verification. This review does not claim a fresh screenshot check.
