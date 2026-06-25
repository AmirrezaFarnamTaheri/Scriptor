use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::error::IndexerError;
use crate::schema::apply_schema;

#[derive(Debug)]
pub struct IndexCache {
    pub path: PathBuf,
    connection: Connection,
}

impl IndexCache {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, IndexerError> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|_| IndexerError::CachePath(path.display().to_string()))?;
        }

        let connection = Connection::open(&path)?;
        let version = read_schema_version(&connection)?;
        if version.is_none() {
            apply_schema(&connection)?;
        } else {
            crate::migration::migrate_cache(&connection)?;
        }

        Ok(Self { path, connection })
    }

    pub fn connection(&self) -> &Connection {
        &self.connection
    }
}

pub fn read_schema_version(connection: &Connection) -> Result<Option<i32>, IndexerError> {
    let table_exists: bool = connection
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'cache_meta'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .is_ok();
    if !table_exists {
        return Ok(None);
    }

    let mut statement = connection.prepare("SELECT value FROM cache_meta WHERE key = 'schema_version'")?;
    let mut rows = statement.query([])?;
    if let Some(row) = rows.next()? {
        let value: String = row.get(0)?;
        return Ok(value.parse().ok());
    }
    Ok(None)
}

pub fn integrity_check_ok(connection: &Connection) -> Result<bool, IndexerError> {
    let mut statement = connection.prepare("PRAGMA integrity_check")?;
    let mut rows = statement.query([])?;
    if let Some(row) = rows.next()? {
        let result: String = row.get(0)?;
        return Ok(result == "ok");
    }
    Ok(false)
}

pub fn orphaned_note_count(
    cache: &IndexCache,
    vault_id: &str,
    note_paths: &[String],
) -> Result<u32, IndexerError> {
    let mut statement = cache
        .connection()
        .prepare("SELECT path FROM notes WHERE vault_id = ?1")?;
    let rows = statement.query_map([vault_id], |row| row.get::<_, String>(0))?;
    let path_set: std::collections::BTreeSet<_> = note_paths.iter().cloned().collect();
    Ok(rows
        .filter_map(Result::ok)
        .filter(|path| !path_set.contains(path))
        .count() as u32)
}

pub fn default_cache_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".scriptor/cache/index.sqlite")
}
