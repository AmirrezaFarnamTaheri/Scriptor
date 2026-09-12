# TUI-Paritätsmatrix

[English](TUI_PARITY.md) · [简体中文](TUI_PARITY.zh-CN.md) · [Русский](TUI_PARITY.ru.md) · **Deutsch** · [Español](TUI_PARITY.es.md) · [فارسی](TUI_PARITY.fa.md)

## Invariante

Die Terminaloberfläche muss dasselbe local-first Vault-Modell wie die Desktop-Shell bereitstellen: Vault öffnen, indexierte Notizen prüfen, suchen, Vorschau anzeigen, Exporthinweise, Git-Status und Health Diagnostics — ohne paralleles Backend einzuführen.

## Aktuelle Oberfläche

- `cargo run -p scriptor-cli -- tui <vault>`
  - Keyboard-first Notizbrowser mit nach Grapheme-Breite bereinigtem Rendering
  - Inkrementelle Suche über `/`
  - Modi der rechten Pane: Preview (`p`), Backlinks (`b`), Graph (`g`), Health (`h`); Wechsel mit `Tab`
  - Rich-Markdown-Vorschau über den pulldown-cmark Terminal Renderer
  - Pane-Scroll mit `PgUp` / `PgDn`; Hilfe-Overlay mit `?`
  - Footer zeigt Git-Branch/Cleanliness und Anzahl der Health Issues
  - In-process Backend über `scriptor-vault` + `scriptor-indexer` + `scriptor-native-git`

- `cargo run -p scriptor-cli -- tui <vault> --via-daemon`
  - Dasselbe UX über RPC des `scriptor-daemon` geroutet (OpenVault, ListNotes, SearchNotes, ReadNote, GitStatus, HealthDiagnostics, Backlinks, GraphSummary)

- `cargo run -p scriptor-cli -- tui <vault> --smoke-test`
  - Nichtinteraktive Validierung: Vault öffnen, Index, Notizerkennung, alle Pane-Modi, Preview-Load

## Desktop-/Terminal-Zuordnung

| Fähigkeit | Desktop | TUI | Backend-Wiederverwendung |
|---|---|---|---|
| Vault öffnen | `vault_open` | `tui` | `scriptor-vault::open_vault` |
| Index neu aufbauen | automatic / command | startup | `scriptor-indexer::rebuild_index` |
| Notizen durchsuchen | sidebar | left list pane | `list_note_summaries` |
| Notizen suchen | sidebar + dock | `/` query mode | `search_notes` |
| Notiz lesen | editor/preview | preview pane (`p`) | `read_note` |
| Notiz exportieren | export profiles | CLI-Hinweis in Health Pane | `scriptor export` command |
| Git-Status | Git panel | footer + `r` refresh | `scriptor-native-git::git_status` |
| Diagnostics | dock / panels | health pane (`h`) | `health_diagnostics_json` |
| Backlinks | inspector | backlinks pane (`b`) | `backlinks_for_path` |
| Graph Summary | graph panel | graph pane (`g`) | `query_focused_graph` |

## Validierung

- Unit: `safe_fit`-Grapheme-Tests, Snapshot-artige Assertion `footer_includes_git_and_health_slots`
- Smoke: `pnpm check:tui`, `pnpm check:daemon` (TUI über Daemon)
- CI: TUI Smoke + Daemon-IPC-Unit-Tests in `validate-frontend`
