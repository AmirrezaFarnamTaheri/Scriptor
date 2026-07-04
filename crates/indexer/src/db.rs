use std::path::{Path, PathBuf};
use std::sync::Arc;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

use crate::error::IndexerError;
use crate::schema::apply_schema;

pub type CachePool = Pool<SqliteConnectionManager>;
pub type PooledCacheConnection = r2d2::PooledConnection<SqliteConnectionManager>;

const DEFAULT_POOL_SIZE: u32 = 8;

#[derive(Clone)]
pub struct IndexCache {
    pub path: PathBuf,
    pool: Arc<CachePool>,
}

impl std::fmt::Debug for IndexCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("IndexCache")
            .field("path", &self.path)
            .field("pool_state", &self.pool.state())
            .finish()
    }
}

impl IndexCache {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, IndexerError> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|_| IndexerError::CachePath(path.display().to_string()))?;
        }

        {
            let connection = Connection::open(&path)?;
            apply_connection_pragmas(&connection).map_err(IndexerError::from)?;
            let version = read_schema_version(&connection)?;
            if version.is_none() {
                apply_schema(&connection)?;
            } else {
                crate::migration::migrate_cache(&connection)?;
            }
        }

        let manager = SqliteConnectionManager::file(&path).with_init(|connection| {
            apply_connection_pragmas(connection)
        });
        let pool = Pool::builder()
            .max_size(DEFAULT_POOL_SIZE)
            .build(manager)
            .map_err(|error| IndexerError::Pool(error.to_string()))?;

        Ok(Self {
            path,
            pool: Arc::new(pool),
        })
    }

    pub fn connection(&self) -> Result<PooledCacheConnection, IndexerError> {
        self.pool
            .get()
            .map_err(|error| IndexerError::Pool(error.to_string()))
    }

    pub fn pool(&self) -> &CachePool {
        &self.pool
    }

    pub fn shares_pool_with(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.pool, &other.pool)
    }

    #[cfg(test)]
    pub fn journal_mode(&self) -> Result<String, IndexerError> {
        self.connection()?
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .map_err(IndexerError::from)
    }
}

fn apply_connection_pragmas(connection: &Connection) -> Result<(), rusqlite::Error> {
    connection.pragma_update(None, "journal_mode", "WAL")?;
    connection.pragma_update(None, "synchronous", "NORMAL")?;
    connection.pragma_update(None, "busy_timeout", 5_000)?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

#[cfg(test)]
mod db_pragma_tests {
    use super::*;
    use std::sync::Arc;
    use std::thread;

    #[test]
    fn opens_with_wal_journal_mode() {
        let temp = tempfile::tempdir().expect("tempdir");
        let cache_path = temp.path().join("index.sqlite");
        let cache = IndexCache::open(&cache_path).expect("open");
        let mode: String = cache.journal_mode().expect("journal_mode");
        assert_eq!(mode.to_ascii_lowercase(), "wal");
    }

    #[test]
    fn pool_serves_concurrent_connections() {
        let temp = tempfile::tempdir().expect("tempdir");
        let cache = Arc::new(IndexCache::open(temp.path().join("index.sqlite")).expect("open"));
        let handles: Vec<_> = (0..8)
            .map(|_| {
                let cache = Arc::clone(&cache);
                thread::spawn(move || cache.connection().map(|_| ()))
            })
            .collect();
        for handle in handles {
            handle.join().expect("join").expect("connection");
        }
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
    let conn = cache.connection()?;
    let mut statement = conn.prepare("SELECT path FROM notes WHERE vault_id = ?1")?;
    let rows = statement.query_map([vault_id], |row| row.get::<_, String>(0))?;
    let path_set: std::collections::BTreeSet<_> = note_paths.iter().cloned().collect();
    let count = rows
        .filter_map(Result::ok)
        .filter(|path| !path_set.contains(path))
        .count();
    Ok(u32::try_from(count).unwrap_or(u32::MAX))
}

pub fn default_cache_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".scriptor/cache/index.sqlite")
}
