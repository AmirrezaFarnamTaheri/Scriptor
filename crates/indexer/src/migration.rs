use crate::db::{read_schema_version, IndexCache};
use crate::error::IndexerError;
use crate::schema::{apply_schema, CREATE_RECENT_ACCESS, MIGRATE_V2_TO_V3, SCHEMA_VERSION};

/// Apply versioned migrations or return `SchemaRebuildRequired` when unsafe to migrate in place.
pub fn migrate_cache(connection: &rusqlite::Connection) -> Result<(), IndexerError> {
    let current = read_schema_version(connection)?.unwrap_or(0);
    if current == SCHEMA_VERSION {
        return Ok(());
    }
    if current == 0 {
        apply_schema(connection)?;
        return Ok(());
    }
    if current == 1 && SCHEMA_VERSION >= 2 {
        connection.execute_batch(CREATE_RECENT_ACCESS)?;
        connection.execute(
            "INSERT OR REPLACE INTO cache_meta(key, value) VALUES ('schema_version', ?1)",
            ["2".to_string()],
        )?;
        if SCHEMA_VERSION >= 3 {
            let _ = connection.execute_batch(MIGRATE_V2_TO_V3);
            connection.execute(
                "INSERT OR REPLACE INTO cache_meta(key, value) VALUES ('schema_version', ?1)",
                [SCHEMA_VERSION.to_string()],
            )?;
        }
        return Ok(());
    }
    if current == 2 && SCHEMA_VERSION >= 3 {
        let _ = connection.execute_batch(MIGRATE_V2_TO_V3);
        connection.execute(
            "INSERT OR REPLACE INTO cache_meta(key, value) VALUES ('schema_version', ?1)",
            [SCHEMA_VERSION.to_string()],
        )?;
        return Ok(());
    }
    Err(IndexerError::SchemaRebuildRequired { found: current, expected: SCHEMA_VERSION })
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
}

pub fn open_cache_migrated(path: impl AsRef<std::path::Path>) -> Result<IndexCache, IndexerError> {
    match IndexCache::open(path.as_ref()) {
        Ok(cache) => {
            if let Err(IndexerError::SchemaRebuildRequired { .. }) = migrate_cache(cache.connection()) {
                drop(cache);
                let path_buf = path.as_ref().to_path_buf();
                if path_buf.exists() {
                    std::fs::remove_file(&path_buf).map_err(|source| IndexerError::Io {
                        path: path_buf.clone(),
                        source,
                    })?;
                }
                let rebuilt = IndexCache::open(path)?;
                migrate_cache(rebuilt.connection())?;
                return Ok(rebuilt);
            }
            migrate_cache(cache.connection())?;
            Ok(cache)
        }
        Err(error) => Err(error),
    }
}
