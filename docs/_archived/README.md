# Archived documentation

This directory contains reference material that is **not part of the current Scriptor v1 documentation set**. Files here are preserved for historical context and source archaeology but are not linked from the main documentation index.

The authoritative status of every shipped, experimental, and design-only capability is in [`../CAPABILITY-MATURITY.md`](../CAPABILITY-MATURITY.md).

## Contents

- **`research/`** — upstream-competitor research notes (Obsidian, Logseq, Affine, and related ecosystems) collected before the v1 architecture freeze. Not linked from any current document.

## How these were removed

- `interface-design.md` and `DESIGN-AUDIT-2026-08-25.md` were deleted as superseded; their content is preserved in git history.
- `docs/research/` was relocated here; git history tracks the move.
- 9 stale design and prototype architecture evaluations under `docs/architecture/` were deleted; their status is recorded in `docs/CAPABILITY-MATURITY.md` and preserved in git history:
  - `ENCRYPTION_AT_REST.md`, `WASM_PLUGINS.md`, `I18N_FRAMEWORK.md`, `HEADLESS_SSG.md`, `LOCAL_EMBEDDINGS.md`, `MOBILE_ARCHITECTURE.md`, `CITATION_ENGINE_EVAL.md`, `EDITOR_ENGINES.md`, `TANTIVY_EVAL.md`.
