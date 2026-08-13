use crate::db::{IndexCache, read_schema_version};
use crate::error::IndexerError;
use crate::schema::{
    CREATE_ANNOTATIONS, CREATE_BLOCKS, CREATE_FTS_V5, CREATE_INDEXES, CREATE_RECENT_ACCESS,
    CREATE_SRS_CARDS, CREATE_SRS_REVIEWS, CREATE_TASK_TAGS, CREATE_TASKS, MIGRATE_V2_TO_V3,
    MIGRATE_V7_TO_V8_TASKS, SCHEMA_VERSION, apply_schema,
};

/// Optional progress callback used during v5 reindex (which forces a full FTS rebuild).
/// Called with `(indexed_notes, total_notes)`. Pass `None` to suppress progress.
pub type ReindexProgressFn = Box<dyn Fn(usize, usize) + Send + Sync>;

/// Apply versioned migrations or return `SchemaRebuildRequired` when unsafe to migrate in place.
///
/// Every step runs inside a single transaction together with its `schema_version` bump, so a
/// crash mid-migration rolls back completely and the next run retries from the same version
/// instead of leaving a half-migrated cache stamped as current.
pub fn migrate_cache(connection: &rusqlite::Connection) -> Result<(), IndexerError> {
    let mut current = read_schema_version(connection)?.unwrap_or(0);
    if current == SCHEMA_VERSION {
        return Ok(());
    }
    if current == 0 {
        apply_schema(connection)?;
        return Ok(());
    }
    if current > SCHEMA_VERSION {
        return Err(IndexerError::SchemaRebuildRequired {
            found: current,
            expected: SCHEMA_VERSION,
        });
    }

    if current == 1 && SCHEMA_VERSION >= 2 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(CREATE_RECENT_ACCESS)?;
        stamp_schema_version(&transaction, 2)?;
        transaction.commit()?;
        current = 2;
    }

    if current == 2 && SCHEMA_VERSION >= 3 {
        let transaction = connection.unchecked_transaction()?;
        apply_v2_to_v3(&transaction)?;
        stamp_schema_version(&transaction, 3)?;
        transaction.commit()?;
        current = 3;
    }

    if current == 3 && SCHEMA_VERSION >= 4 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(CREATE_INDEXES)?;
        stamp_schema_version(&transaction, 4)?;
        transaction.commit()?;
        current = 4;
    }

    // v4 → v5: drop the v4 single-column FTS table and create the v5
    // multi-column, diacritic-folding table. This is the only migration step
    // that forces a full reindex; the caller must repopulate `note_fts` after
    // calling this function. The `SchemaRebuildRequired` path in
    // `open_cache_migrated` handles the repopulation automatically by
    // deleting the cache file and starting fresh.
    if current == 4 && SCHEMA_VERSION >= 5 {
        migrate_v4_to_v5(connection)?;
        current = 5;
    }

    if current == 5 && SCHEMA_VERSION >= 6 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(CREATE_TASKS)?;
        transaction.execute_batch(CREATE_TASK_TAGS)?;
        stamp_schema_version(&transaction, 6)?;
        transaction.commit()?;
        current = 6;
    }

    if current == 6 && SCHEMA_VERSION >= 7 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(CREATE_ANNOTATIONS)?;
        transaction.execute_batch(CREATE_SRS_CARDS)?;
        transaction.execute_batch(CREATE_SRS_REVIEWS)?;
        stamp_schema_version(&transaction, 7)?;
        transaction.commit()?;
        current = 7;
    }

    // v7 → v8: ADD COLUMN on tasks (line, scheduled_at, start_at, rrule,
    // field_style) + create `blocks` table.
    // Guard each ADD COLUMN with a table_columns check so the step is safely
    // idempotent even without IF NOT EXISTS (SQLite < 3.37 compat).
    if current == 7 && SCHEMA_VERSION >= 8 {
        let transaction = connection.unchecked_transaction()?;
        let existing_cols = table_columns(&transaction, "tasks")?;
        for (col_name, stmt) in MIGRATE_V7_TO_V8_TASKS {
            if existing_cols.contains(*col_name) {
                continue;
            }
            transaction.execute_batch(stmt)?;
        }
        transaction.execute_batch(CREATE_BLOCKS)?;
        stamp_schema_version(&transaction, 8)?;
        transaction.commit()?;
        current = 8;
    }

    if current == SCHEMA_VERSION {
        Ok(())
    } else {
        Err(IndexerError::SchemaRebuildRequired {
            found: current,
            expected: SCHEMA_VERSION,
        })
    }
}

fn stamp_schema_version(
    connection: &rusqlite::Connection,
    version: i32,
) -> Result<(), IndexerError> {
    connection.execute(
        "INSERT OR REPLACE INTO cache_meta(key, value) VALUES ('schema_version', ?1)",
        [version.to_string()],
    )?;
    Ok(())
}

fn apply_v2_to_v3(connection: &rusqlite::Connection) -> Result<(), IndexerError> {
    let existing = table_columns(connection, "notes")?;
    for (column, statement) in MIGRATE_V2_TO_V3 {
        if existing.contains(*column) {
            continue;
        }
        connection.execute_batch(statement)?;
    }
    Ok(())
}

/// v4 → v5: replace the single-column `note_fts` table with the four-column
/// diacritic-folding variant declared in `schema::CREATE_FTS_V5`.
///
/// FTS5 virtual tables cannot be altered in place — we must drop and recreate.
/// Because this empties the FTS index the caller **must** repopulate `note_fts`
/// after this migration. `open_cache_migrated` handles that by using the
/// `SchemaRebuildRequired` → delete-files → fresh-open path so the indexer
/// re-scans the vault.
///
/// Progress during the rebuild is reported via the `ReindexProgressFn` passed
/// to the indexer's rebuild command (not to this function directly).
fn migrate_v4_to_v5(connection: &rusqlite::Connection) -> Result<(), IndexerError> {
    let transaction = connection.unchecked_transaction()?;
    // Drop the old FTS table; SQLite FTS5 does not support ALTER or migration.
    transaction.execute_batch("DROP TABLE IF EXISTS note_fts;")?;
    // Create the v5 multi-column table.
    transaction.execute_batch(CREATE_FTS_V5)?;
    stamp_schema_version(&transaction, 5)?;
    transaction.commit()?;
    Ok(())
}

fn table_columns(
    connection: &rusqlite::Connection,
    table: &str,
) -> Result<std::collections::BTreeSet<String>, IndexerError> {
    let mut statement = connection.prepare("SELECT name FROM pragma_table_info(?1)")?;
    let rows = statement.query_map([table], |row| row.get::<_, String>(0))?;
    let mut columns = std::collections::BTreeSet::new();
    for row in rows {
        columns.insert(row?);
    }
    Ok(columns)
}

/// Open the cache, rebuilding it from scratch when its schema cannot be migrated in place.
///
/// `IndexCache::open` runs `migrate_cache` itself, so the rebuild decision has to be made on the
/// error it returns rather than on a follow-up migration of an already-opened cache.
pub fn open_cache_migrated(path: impl AsRef<std::path::Path>) -> Result<IndexCache, IndexerError> {
    match IndexCache::open(path.as_ref()) {
        Ok(cache) => Ok(cache),
        Err(IndexerError::SchemaRebuildRequired { .. }) => {
            remove_cache_files(path.as_ref())?;
            IndexCache::open(path.as_ref())
        }
        Err(error) => Err(error),
    }
}

/// Delete the SQLite database and its WAL/SHM siblings so a rebuild starts from a clean slate.
fn remove_cache_files(path: &std::path::Path) -> Result<(), IndexerError> {
    let mut candidates = vec![path.to_path_buf()];
    if let Some(name) = path.file_name().and_then(|name| name.to_str()) {
        for suffix in ["-wal", "-shm"] {
            candidates.push(path.with_file_name(format!("{name}{suffix}")));
        }
    }

    for candidate in candidates {
        if !candidate.exists() {
            continue;
        }
        std::fs::remove_file(&candidate).map_err(|source| IndexerError::Io {
            path: candidate.clone(),
            source,
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::{CREATE_META, CREATE_NOTES};
    use rusqlite::Connection;

    #[test]
    fn migrates_schema_v1_to_v2() -> Result<(), IndexerError> {
        let connection = Connection::open_in_memory()?;
        connection.execute_batch(CREATE_META)?;
        connection.execute_batch(CREATE_NOTES)?;
        connection.execute_batch(crate::schema::CREATE_LINKS)?;
        connection.execute_batch(crate::schema::CREATE_CITATIONS)?;
        connection.execute(
            "INSERT INTO cache_meta(key, value) VALUES ('schema_version', '1')",
            [],
        )?;
        migrate_cache(&connection)?;
        let version: String = connection.query_row(
            "SELECT value FROM cache_meta WHERE key = 'schema_version'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(version, SCHEMA_VERSION.to_string());
        connection.execute(
            "INSERT INTO recent_access(path, opened_at) VALUES ('a.md', 'now')",
            [],
        )?;
        Ok(())
    }

    /// v1 notes tables predate the v3 columns, so migrating must add them.
    const CREATE_NOTES_V1: &str = "
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]'
);
";

    fn open_legacy_cache(version: i32) -> Result<Connection, IndexerError> {
        let connection = Connection::open_in_memory()?;
        connection.execute_batch(CREATE_META)?;
        connection.execute_batch(CREATE_NOTES_V1)?;
        connection.execute_batch(crate::schema::CREATE_LINKS)?;
        connection.execute_batch(crate::schema::CREATE_CITATIONS)?;
        connection.execute(
            "INSERT INTO cache_meta(key, value) VALUES ('schema_version', ?1)",
            [version.to_string()],
        )?;
        Ok(connection)
    }

    fn column_names(connection: &Connection) -> Result<Vec<String>, IndexerError> {
        Ok(table_columns(connection, "notes")?.into_iter().collect())
    }

    #[test]
    fn migrates_v2_cache_and_adds_v3_columns() -> Result<(), IndexerError> {
        let connection = open_legacy_cache(2)?;
        connection.execute_batch(CREATE_RECENT_ACCESS)?;
        migrate_cache(&connection)?;

        let columns = column_names(&connection)?;
        for expected in ["note_type", "organized", "archived"] {
            assert!(
                columns.iter().any(|column| column == expected),
                "missing {expected}"
            );
        }
        assert_eq!(read_schema_version(&connection)?, Some(SCHEMA_VERSION));
        Ok(())
    }

    #[test]
    fn migrates_v2_cache_whose_columns_were_partially_applied() -> Result<(), IndexerError> {
        let connection = open_legacy_cache(2)?;
        connection.execute_batch(CREATE_RECENT_ACCESS)?;
        // Simulate an older build that crashed after the first ALTER TABLE committed.
        connection.execute_batch("ALTER TABLE notes ADD COLUMN note_type TEXT")?;

        migrate_cache(&connection)?;

        let columns = column_names(&connection)?;
        for expected in ["note_type", "organized", "archived"] {
            assert!(
                columns.iter().any(|column| column == expected),
                "missing {expected}"
            );
        }
        assert_eq!(read_schema_version(&connection)?, Some(SCHEMA_VERSION));
        Ok(())
    }

    #[test]
    fn failed_migration_does_not_stamp_new_version() -> Result<(), IndexerError> {
        let connection = open_legacy_cache(2)?;
        connection.execute_batch(CREATE_RECENT_ACCESS)?;
        // Dropping `notes` makes every v3 ALTER fail; the version must stay at 2.
        connection.execute_batch("DROP TABLE notes")?;

        let result = migrate_cache(&connection);
        assert!(
            result.is_err(),
            "expected the migration to surface the failure"
        );
        assert_eq!(read_schema_version(&connection)?, Some(2));
        Ok(())
    }

    #[test]
    fn newer_schema_version_requests_rebuild() -> Result<(), IndexerError> {
        let connection = open_legacy_cache(SCHEMA_VERSION + 1)?;
        assert!(matches!(
            migrate_cache(&connection),
            Err(IndexerError::SchemaRebuildRequired { .. })
        ));
        Ok(())
    }

    #[test]
    fn open_cache_migrated_rebuilds_a_newer_cache() -> Result<(), IndexerError> {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("index.sqlite");
        {
            let connection = Connection::open(&path)?;
            connection.execute_batch(CREATE_META)?;
            connection.execute_batch(CREATE_NOTES_V1)?;
            connection.execute(
                "INSERT INTO cache_meta(key, value) VALUES ('schema_version', ?1)",
                [(SCHEMA_VERSION + 5).to_string()],
            )?;
        }

        let cache = open_cache_migrated(&path)?;
        let connection = cache.connection()?;
        assert_eq!(read_schema_version(&connection)?, Some(SCHEMA_VERSION));
        Ok(())
    }
    #[test]
    fn schema_v4_creates_indexes_for_core_vault_queries() -> Result<(), IndexerError> {
        let connection = Connection::open_in_memory()?;
        apply_schema(&connection)?;
        let mut statement = connection.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name",
        )?;
        let names = statement
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        for expected in [
            "idx_notes_vault_path",
            "idx_notes_vault_modified",
            "idx_links_vault_from",
            "idx_links_vault_to_note",
            "idx_links_vault_to_path",
        ] {
            assert!(
                names.iter().any(|name| name == expected),
                "missing {expected}"
            );
        }
        Ok(())
    }

    #[test]
    fn vault_path_lookup_uses_secondary_index() -> Result<(), IndexerError> {
        let connection = Connection::open_in_memory()?;
        apply_schema(&connection)?;
        let plan: String = connection.query_row(
            "EXPLAIN QUERY PLAN SELECT title FROM notes WHERE vault_id = ?1 AND path = ?2",
            ["vault", "note.md"],
            |row| row.get(3),
        )?;
        assert!(
            plan.contains("idx_notes_vault_path"),
            "unexpected plan: {plan}"
        );
        Ok(())
    }

    // ── v4 → v5 FTS migration tests ─────────────────────────────────────────

    /// Build a minimal v4 cache in memory (only the tables that matter for the migration).
    fn open_v4_cache() -> Result<Connection, IndexerError> {
        let connection = Connection::open_in_memory()?;
        connection.execute_batch(CREATE_META)?;
        connection.execute_batch(crate::schema::CREATE_NOTES)?;
        connection.execute_batch(crate::schema::CREATE_LINKS)?;
        connection.execute_batch(crate::schema::CREATE_CITATIONS)?;
        connection.execute_batch(CREATE_RECENT_ACCESS)?;
        connection.execute_batch(CREATE_INDEXES)?;
        // v4 FTS: single body column.
        connection.execute_batch(crate::schema::CREATE_FTS_V4)?;
        connection.execute(
            "INSERT INTO cache_meta(key, value) VALUES ('schema_version', '4')",
            [],
        )?;
        Ok(connection)
    }

    #[test]
    fn migration_v4_to_v5_creates_fts_with_correct_columns() -> Result<(), IndexerError> {
        let connection = open_v4_cache()?;
        migrate_cache(&connection)?;

        // Migration runs all pending steps from v4 through to the current
        // SCHEMA_VERSION (currently 7).  Assert we reached the latest version.
        assert_eq!(
            read_schema_version(&connection)?,
            Some(crate::schema::SCHEMA_VERSION),
            "migration from v4 should reach the current schema version"
        );

        // The v5 FTS table must still have the four content columns.
        let mut stmt =
            connection.prepare("SELECT name FROM pragma_table_info('note_fts') ORDER BY cid")?;
        let cols: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;

        for expected in ["note_id", "title", "headings", "tags", "body"] {
            assert!(
                cols.iter().any(|c| c == expected),
                "v5 note_fts missing column '{expected}'; actual columns: {cols:?}"
            );
        }
        Ok(())
    }

    #[test]
    fn migration_v4_to_v5_allows_fts_insert_and_search() -> Result<(), IndexerError> {
        let connection = open_v4_cache()?;
        migrate_cache(&connection)?;

        // Insert a row into the v5 FTS table and verify it is searchable.
        connection.execute(
            "INSERT INTO note_fts(note_id, title, headings, tags, body)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            [
                "id-1",
                "Résumé Tips", // diacritic in title
                "Introduction Skills",
                "career",
                "Polish your résumé before applying.",
            ],
        )?;

        // FTS5 search — diacritics should fold so "resume" matches "résumé".
        let count: i64 = connection.query_row(
            "SELECT count(*) FROM note_fts WHERE note_fts MATCH 'resume'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(count, 1, "diacritic folding: 'resume' must match 'résumé'");
        Ok(())
    }

    // ── v5 → v6 task-capture migration tests ────────────────────────────────

    /// Build a minimal v5 cache in memory.
    fn open_v5_cache() -> Result<Connection, IndexerError> {
        let connection = Connection::open_in_memory()?;
        connection.execute_batch(CREATE_META)?;
        connection.execute_batch(crate::schema::CREATE_NOTES)?;
        connection.execute_batch(crate::schema::CREATE_LINKS)?;
        connection.execute_batch(crate::schema::CREATE_CITATIONS)?;
        connection.execute_batch(CREATE_RECENT_ACCESS)?;
        connection.execute_batch(CREATE_INDEXES)?;
        connection.execute_batch(CREATE_FTS_V5)?;
        connection.execute(
            "INSERT INTO cache_meta(key, value) VALUES ('schema_version', '5')",
            [],
        )?;
        Ok(connection)
    }

    #[test]
    fn migration_v5_to_v6_creates_tasks_and_task_tags() -> Result<(), IndexerError> {
        let connection = open_v5_cache()?;
        migrate_cache(&connection)?;

        assert_eq!(read_schema_version(&connection)?, Some(SCHEMA_VERSION));

        // tasks table must exist and accept a row.
        connection.execute(
            "INSERT INTO tasks(id, vault_id, title, created_at, updated_at)
             VALUES ('t-1', 'v-1', 'Buy oat milk', 'now', 'now')",
            [],
        )?;
        // task_tags junction must exist.
        connection.execute(
            "INSERT INTO task_tags(task_id, tag) VALUES ('t-1', 'shopping')",
            [],
        )?;
        let tag: String = connection.query_row(
            "SELECT tag FROM task_tags WHERE task_id = 't-1'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(tag, "shopping");
        Ok(())
    }

    // ── v6 → v7 annotations + SRS migration tests ───────────────────────────

    /// Build a minimal v6 cache in memory.
    fn open_v6_cache() -> Result<Connection, IndexerError> {
        let connection = open_v5_cache()?;
        // Apply v6 tables manually so we can test the v6→v7 step in isolation.
        connection.execute_batch(CREATE_TASKS)?;
        connection.execute_batch(CREATE_TASK_TAGS)?;
        connection.execute(
            "UPDATE cache_meta SET value = '6' WHERE key = 'schema_version'",
            [],
        )?;
        Ok(connection)
    }

    #[test]
    fn migration_v6_to_v7_creates_annotations_and_srs_tables() -> Result<(), IndexerError> {
        let connection = open_v6_cache()?;
        migrate_cache(&connection)?;

        assert_eq!(read_schema_version(&connection)?, Some(SCHEMA_VERSION));

        // annotations: verify the table accepts a row.
        connection.execute(
            "INSERT INTO annotations(id, vault_id, note_id, anchor_json, created_at, updated_at)
             VALUES ('a-1', 'v-1', 'n-1', '{\"start\":0,\"end\":10}', 'now', 'now')",
            [],
        )?;

        // srs_cards: FK to annotations must work.
        connection.execute(
            "INSERT INTO srs_cards(id, annotation_id, front, back, due_at)
             VALUES ('c-1', 'a-1', 'What is TDD?', 'Test-first dev cycle', '2026-09-01')",
            [],
        )?;

        // srs_reviews: FK to srs_cards must work.
        connection.execute(
            "INSERT INTO srs_reviews(
               id, card_id, reviewed_at, quality,
               interval_before, interval_after, ease_before, ease_after
             ) VALUES ('r-1', 'c-1', 'now', 4, 1.0, 2.0, 2.5, 2.6)",
            [],
        )?;

        let quality: i64 = connection.query_row(
            "SELECT quality FROM srs_reviews WHERE id = 'r-1'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(quality, 4);
        Ok(())
    }

    #[test]
    fn full_fresh_schema_has_current_tables() -> Result<(), IndexerError> {
        let connection = Connection::open_in_memory()?;
        apply_schema(&connection)?;

        // Verify v6 tables (tasks with v8 extended columns).
        connection.execute(
            "INSERT INTO tasks(id, vault_id, title, line, field_style, created_at, updated_at)
             VALUES ('t-1', 'v-1', 'Test task', 0, 'emoji', 'now', 'now')",
            [],
        )?;
        // Verify v7 table.
        connection.execute(
            "INSERT INTO annotations(id, vault_id, note_id, anchor_json, created_at, updated_at)
             VALUES ('a-1', 'v-1', 'n-1', '{\"start\":0,\"end\":5}', 'now', 'now')",
            [],
        )?;
        // Verify v8 table.
        connection.execute(
            "INSERT INTO blocks(id, note_id, vault_id, block_type, content, created_at)
             VALUES ('b-1', 'n-1', 'v-1', 'paragraph', 'hello', 'now')",
            [],
        )?;
        // Schema version must be current.
        assert_eq!(read_schema_version(&connection)?, Some(SCHEMA_VERSION));
        Ok(())
    }

    // ── v7 → v8 migration tests ───────────────────────────────────────────────

    /// Build a minimal v7 in-memory database (no new task columns, no blocks).
    fn open_v7_cache() -> Result<Connection, IndexerError> {
        let connection = Connection::open_in_memory()?;
        connection.execute_batch(CREATE_META)?;
        connection.execute_batch(crate::schema::CREATE_NOTES)?;
        connection.execute_batch(crate::schema::CREATE_LINKS)?;
        connection.execute_batch(crate::schema::CREATE_FTS_V5)?;
        connection.execute_batch(crate::schema::CREATE_CITATIONS)?;
        connection.execute_batch(CREATE_RECENT_ACCESS)?;
        connection.execute_batch(CREATE_INDEXES)?;
        // v6 tasks — old schema WITHOUT extended columns.
        connection.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
               id TEXT PRIMARY KEY,
               vault_id TEXT NOT NULL,
               source_note_id TEXT,
               title TEXT NOT NULL,
               body TEXT NOT NULL DEFAULT '',
               status TEXT NOT NULL DEFAULT 'open',
               priority INTEGER NOT NULL DEFAULT 0,
               due_at TEXT,
               completed_at TEXT,
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );",
        )?;
        connection.execute_batch(CREATE_TASK_TAGS)?;
        connection.execute_batch(CREATE_ANNOTATIONS)?;
        connection.execute_batch(CREATE_SRS_CARDS)?;
        connection.execute_batch(CREATE_SRS_REVIEWS)?;
        connection.execute(
            "INSERT INTO cache_meta(key, value) VALUES ('schema_version', '7')",
            [],
        )?;
        Ok(connection)
    }

    #[test]
    fn migration_v7_to_v8_adds_task_columns_and_blocks() -> Result<(), IndexerError> {
        let connection = open_v7_cache()?;
        migrate_cache(&connection)?;

        assert_eq!(read_schema_version(&connection)?, Some(SCHEMA_VERSION));

        // Insert a task using the new columns — if the migration ran correctly this succeeds.
        connection.execute(
            "INSERT INTO tasks(id, vault_id, title, line, scheduled_at, start_at, rrule, field_style, created_at, updated_at)
             VALUES ('t-1', 'v-1', 'Migrated task', 5, '2026-04-01', '2026-03-28', 'FREQ=DAILY', 'emoji', 'now', 'now')",
            [],
        )?;

        let line: i64 =
            connection.query_row("SELECT line FROM tasks WHERE id = 't-1'", [], |row| {
                row.get(0)
            })?;
        assert_eq!(line, 5);

        // blocks table must exist.
        connection.execute(
            "INSERT INTO blocks(id, note_id, vault_id, block_type, content, created_at)
             VALUES ('b-1', 'n-1', 'v-1', 'paragraph', 'hello', 'now')",
            [],
        )?;
        Ok(())
    }
}
