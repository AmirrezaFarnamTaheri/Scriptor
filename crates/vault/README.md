# `scriptor-vault`

Rust vault kernel: path safety, scanning, atomic writes, config/snippets, rename integrity, and filesystem watcher batching.

## Shipped

- `VaultRoot` with traversal/symlink guards.
- Open, scan, read, save, delete, frontmatter set, daily-note planning.
- Rename dry-run/apply with link rewrite oracle.
- `.scriptor/config.json`, snippets, recent notes, TextBundle export.

Tauri commands: `vault_*` in `apps/desktop/src-tauri`.
