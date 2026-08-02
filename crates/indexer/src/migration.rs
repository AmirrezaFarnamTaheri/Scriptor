use crate::db::{read_schema_version, IndexCache};
use crate::error::IndexerError;
use crate::schema::{
    apply_schema, CREATE_INDEXES, CREATE_RECENT_ACCESS, MIGRATE_V2_TO_V3, SCHEMA_VERSION,
};

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

/// Add the v3 columns that are not present yet.
///
/// Existing caches may already carry some of the columns if an older build applied the
/// `ALTER TABLE` batch without a transaction and died partway through, so each column is
/// probed before it is added rather than relying on a non-existent `ADD COLUMN IF NOT EXISTS`.
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
        connection.execute("INSERT INTO recent_access(path, opened_at) VALUES ('a.md', 'now')", [])?;
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
            assert!(columns.iter().any(|column| column == expected), "missing {expected}");
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
            assert!(columns.iter().any(|column| column == expected), "missing {expected}");
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
        assert!(result.is_err(), "expected the migration to surface the failure");
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
            assert!(names.iter().any(|name| name == expected), "missing {expected}");
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
        assert!(plan.contains("idx_notes_vault_path"), "unexpected plan: {plan}");
        Ok(())
    }

}
