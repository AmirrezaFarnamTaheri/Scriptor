[English](CONTENT_HASH_AUDIT.md) · [فارسی](CONTENT_HASH_AUDIT.fa.md) · [简体中文](CONTENT_HASH_AUDIT.zh-CN.md) · [Русский](CONTENT_HASH_AUDIT.ru.md) · **Deutsch** · [Español](CONTENT_HASH_AUDIT.es.md)

# Audit der Content-Hash-Skip-Logik auf inkrementellen Pfaden

**Datum:** 2026-06-27  
**Status:** Audit abgeschlossen — keine Code-Lücken gefunden; Desktop-App-Abweichung als Architektur-Trade-off dokumentiert

---

## 1. Zentrale Hash-Prüffunktion

Die einzige maßgebliche Quelle für Skip-Entscheidungen ist `note_needs_reindex` in `crates/indexer/src/notes.rs:82-88`:

```rust
pub fn note_needs_reindex(cache: &IndexCache, metadata: &NoteMetadata, markdown: &str) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    Ok(match note_hash(cache, &metadata.id)? {
        Some(previous) => previous != current_hash,
        None => true,
    })
}
```

Die Funktion berechnet `sha256(markdown)` über `crate::hash::content_hash` und vergleicht den Wert mit dem in der Tabelle `notes` gespeicherten Hash. Stimmen die Hashes überein, wird `false` zurückgegeben und die Arbeit übersprungen.

Alle inkrementellen Pfade laufen durch `apply_note_index_change` (`crates/indexer/src/rebuild.rs:189-213`), das `note_needs_reindex` aufruft, bevor Parsing oder Upsert stattfinden.

---

## 2. Einstiegspunkte der inkrementellen Indizierung

### 2.1 Vollständiger Rebuild

| Einstiegspunkt | Datei | Hash-Prüfung? |
|---|---|---|
| `rebuild_index_with_progress` | `crates/indexer/src/rebuild.rs:98` | **Ja** — ruft `note_needs_reindex` direkt auf |

### 2.2 Daemon (`crates/daemon`)

Alle Daemon-Pfade rufen `incremental_note(s)_index_with_cache` auf, das an `apply_note_index_change` → `note_needs_reindex` delegiert.

| Einstiegspunkt | Datei:Zeile | Trigger | Hash-Prüfung? |
|---|---|---|---|
| `save_note` | `handler.rs:349` | RPC `SaveNote` | **Ja** |
| `update_note_index` | `handler.rs:369` | RPC `UpdateNoteIndex` | **Ja** |
| `rename_note_apply` | `handler.rs:392` | RPC `RenameNoteApply` | **Ja** |
| `open_vault_invoke` (pending reindex) | `handler.rs:207` | Vault-Open-Recovery | **Ja** |
| `cmd_save_note` | `command_gateway.rs:930` | Gateway `vault_save_note` | **Ja** |
| `cmd_rename_apply` | `command_gateway.rs:966` | Gateway `vault_rename_apply` | **Ja** |
| `vault_lint_fix` | `command_gateway.rs:332` | Gateway-Lint-Fix | **Ja** |
| `vault_frontmatter_set` | `command_gateway.rs:409` | Gateway-Frontmatter-Edit | **Ja** |
| `indexer_update_note` | `command_gateway.rs:534` | manueller Gateway-Reindex | **Ja** |
| `indexer_apply_filesystem_changes` | `command_gateway.rs:541` | Gateway-Batchänderungen | **Ja** |
| `vault_restore_note_history_revision` | `command_gateway.rs:516-524` | History-Restore | **Ja** (über Save + Watcher-Catch-up) |
| `apply_watch_batch` (Watcher) | `watcher.rs:53` | Dateisystemereignisse | **Ja** |

**Daemon-Save/Rollback-Muster** (`handler.rs:348-361`, `command_gateway.rs:928-943`): Nach dem Schreiben durch `save_note_with_options` wird `incremental_note_index_with_cache` aufgerufen. Schlägt die Indizierung fehl, stellt `rollback_save_note` den vorherigen Zustand auf dem Datenträger wieder her. Das schützt vor Inkonsistenz zwischen Index und Disk.

### 2.3 Desktop-App (`apps/desktop/src-tauri`)

Die Desktop-App verwendet eine **Watcher-vermittelte** Architektur: Tauri-Befehle schreiben auf Disk; ein `VaultWatcher` im Hintergrund erkennt Änderungen mit 300-ms-Debounce und ruft automatisch `incremental_notes_index` auf.

| Einstiegspunkt | Datei:Zeile | Trigger | Expliziter Index-Aufruf? | Hash-Prüfung? |
|---|---|---|---|---|
| `vault_save_note` | `vault.rs:48-72` | Tauri command | Nein — Watcher übernimmt | **Ja** (über Watcher) |
| `vault_rename_apply` | `vault.rs:110-131` | Tauri command | Nein — Watcher übernimmt | **Ja** (über Watcher) |
| `vault_frontmatter_set` | `vault.rs:321-347` | Tauri command | Nein — Watcher übernimmt | **Ja** (über Watcher) |
| `vault_restore_note_history_revision` | `vault.rs:479-497` | Tauri command | Nein — Watcher übernimmt | **Ja** (über Watcher) |
| `vault_delete_note` | `vault.rs:240-244` | Tauri command | Nein — Watcher übernimmt | **Ja** (Watcher + Entfernung in `apply_note_index_change`) |
| `vault_lint_fix` | `vault.rs:439-450` | Tauri command | **Ja** | **Ja** |
| `indexer_update_note` | `indexer.rs:33-38` | Tauri command | **Ja** | **Ja** |
| `indexer_apply_filesystem_changes` | `indexer.rs:42-48` | Tauri command | **Ja** | **Ja** |

---

## 3. Gap-Analyse

### 3.1 Hash-Prüfungsabdeckung: VOLLSTÄNDIG

Jeder inkrementelle Indizierungspfad — explizit oder Watcher-vermittelt — läuft über `apply_note_index_change` → `note_needs_reindex`. Kein Pfad umgeht den Content-Hash-Vergleich.

### 3.2 Desktop-App: kein Rollback beim Speichern

Der Save-Pfad des Daemons besitzt transaktionales Rollback: wenn `incremental_note_index` nach dem Disk-Write fehlschlägt, stellt `rollback_save_note` den vorherigen Inhalt wieder her.

`vault_save_note` der Desktop-App (`vault.rs:48-72`) schreibt auf Disk und kehrt sofort zurück. Der Watcher indiziert asynchron. Falls die Indizierung fehlschlägt, gibt es keinen Rollback. Die Datei bleibt im neuen Zustand auf Disk, während der Index veraltet bleibt.

**Auswirkung:** Gering. Der Watcher versucht es beim nächsten Dateisystemereignis erneut; ein vollständiger `rebuild_index` kann jederzeit wiederherstellen. Das ist ein bewusster Einfachheits-Trade-off des Desktop-Pfads.

### 3.3 Watcher-Ausfallfenster

Wenn der Watcher nicht läuft, etwa weil Start oder Laufzeit fehlschlägt, werden Änderungen durch Tauri-Befehle erst beim nächsten `rebuild_index` oder expliziten `indexer_update_note` indiziert.

**Auswirkung:** Gering. Der Watcher startet beim Öffnen eines Vaults und erneut beim Transport-Reconnect (`crates/daemon/src/transport.rs:244-245, 322-323`).

---

## 4. Fazit

**Keine Code-Lücken gefunden.** Alle inkrementellen Indizierungspfade prüfen über `note_needs_reindex` den Content-Hash vor vollständigem Parse+Upsert. Nur der Trigger unterscheidet sich:

- **Daemon:** explizite Aufrufe mit Rollback-Schutz
- **Desktop:** Watcher-vermittelt ohne Rollback

Beide überspringen unveränderte Notizen korrekt.
