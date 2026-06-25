# TUI Parity Matrix

## Invariant
The terminal surface must expose the same local-first vault model as the desktop shell: open vault, inspect indexed notes, search, preview, export guidance, git state, and health diagnostics without introducing a parallel backend.

## Current Surface

- `cargo run -p scriptor-cli -- tui <vault>`
  - Keyboard-first note browser with grapheme-width-sanitized rendering
  - Incremental search entry with `/`
  - Right-pane modes: preview (`p`), backlinks (`b`), graph (`g`), health (`h`); cycle with `Tab`
  - Rich markdown preview via pulldown-cmark terminal renderer
  - Pane scroll with `PgUp` / `PgDn`; `?` help overlay
  - Footer shows git branch/cleanliness and health issue counts
  - In-process backend via `scriptor-vault` + `scriptor-indexer` + `scriptor-native-git`

- `cargo run -p scriptor-cli -- tui <vault> --via-daemon`
  - Same UX routed through `scriptor-daemon` RPC (OpenVault, ListNotes, SearchNotes, ReadNote, GitStatus, HealthDiagnostics, Backlinks, GraphSummary)

- `cargo run -p scriptor-cli -- tui <vault> --smoke-test`
  - Noninteractive validation: vault open, index, note discovery, all pane modes, preview load

## Desktop / Terminal Mapping

| Capability | Desktop | TUI | Backend Reuse |
| --- | --- | --- | --- |
| Open vault | `vault_open` | `tui` | `scriptor-vault::open_vault` |
| Rebuild index | automatic / command | startup | `scriptor-indexer::rebuild_index` |
| Browse notes | sidebar | left list pane | `list_note_summaries` |
| Search notes | sidebar + dock | `/` query mode | `search_notes` |
| Read note | editor/preview | preview pane (`p`) | `read_note` |
| Export note | export profiles | health pane CLI hint | `scriptor export` command |
| Git state | Git panel | footer + `r` refresh | `scriptor-native-git::git_status` |
| Diagnostics | dock / panels | health pane (`h`) | `health_diagnostics_json` |
| Backlinks | inspector | backlinks pane (`b`) | `backlinks_for_path` |
| Graph summary | graph panel | graph pane (`g`) | `query_focused_graph` |

## Validation

- Unit: `safe_fit` grapheme tests, `footer_includes_git_and_health_slots` snapshot-style assertion
- Smoke: `pnpm check:tui`, `pnpm check:daemon` (TUI via daemon)
- CI: TUI smoke + daemon IPC unit tests on `validate-frontend`
