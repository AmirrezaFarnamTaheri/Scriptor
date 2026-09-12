# Matriz de paridad TUI

[English](TUI_PARITY.md) · [简体中文](TUI_PARITY.zh-CN.md) · [Русский](TUI_PARITY.ru.md) · [Deutsch](TUI_PARITY.de.md) · **Español** · [فارسی](TUI_PARITY.fa.md)

## Invariante

La superficie de terminal debe exponer el mismo modelo local-first del vault que la shell de escritorio: abrir vault, inspeccionar notas indexadas, buscar, previsualizar, mostrar orientación de exportación, estado Git y diagnósticos de salud, sin introducir un backend paralelo.

## Superficie actual

- `cargo run -p scriptor-cli -- tui <vault>`
  - Navegador de notas keyboard-first con renderizado saneado según ancho de grapheme
  - Entrada de búsqueda incremental con `/`
  - Modos del panel derecho: preview (`p`), backlinks (`b`), graph (`g`), health (`h`); rotación con `Tab`
  - Vista previa Markdown enriquecida mediante renderer terminal pulldown-cmark
  - Scroll de panel con `PgUp` / `PgDn`; overlay de ayuda con `?`
  - El footer muestra Git branch/cleanliness y recuentos de health issues
  - Backend in-process mediante `scriptor-vault` + `scriptor-indexer` + `scriptor-native-git`

- `cargo run -p scriptor-cli -- tui <vault> --via-daemon`
  - La misma UX enrutada mediante RPC de `scriptor-daemon` (OpenVault, ListNotes, SearchNotes, ReadNote, GitStatus, HealthDiagnostics, Backlinks, GraphSummary)

- `cargo run -p scriptor-cli -- tui <vault> --smoke-test`
  - Validación no interactiva: apertura del vault, índice, descubrimiento de notas, todos los modos de panel y carga de preview

## Mapeo Desktop / Terminal

| Capacidad | Desktop | TUI | Reutilización de backend |
|---|---|---|---|
| Abrir vault | `vault_open` | `tui` | `scriptor-vault::open_vault` |
| Reconstruir índice | automatic / command | startup | `scriptor-indexer::rebuild_index` |
| Explorar notas | sidebar | left list pane | `list_note_summaries` |
| Buscar notas | sidebar + dock | modo de consulta `/` | `search_notes` |
| Leer nota | editor/preview | preview pane (`p`) | `read_note` |
| Exportar nota | export profiles | hint CLI del health pane | `scriptor export` command |
| Estado Git | Git panel | footer + refresh `r` | `scriptor-native-git::git_status` |
| Diagnostics | dock / panels | health pane (`h`) | `health_diagnostics_json` |
| Backlinks | inspector | backlinks pane (`b`) | `backlinks_for_path` |
| Graph summary | graph panel | graph pane (`g`) | `query_focused_graph` |

## Validación

- Unit: tests de grapheme `safe_fit`, assertion estilo snapshot `footer_includes_git_and_health_slots`
- Smoke: `pnpm check:tui`, `pnpm check:daemon` (TUI vía daemon)
- CI: TUI smoke + unit tests de daemon IPC en `validate-frontend`
