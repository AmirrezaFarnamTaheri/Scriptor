use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::IndexCache;
use crate::error::IndexerError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecentFileHit {
    pub path: String,
    pub opened_at: String,
}

pub fn record_recent_access(cache: &IndexCache, path: &str) -> Result<(), IndexerError> {
    let opened_at = chrono::Utc::now().to_rfc3339();
    cache.connection().execute(
        "INSERT OR REPLACE INTO recent_access(path, opened_at) VALUES (?1, ?2)",
        params![path, opened_at],
    )?;
    cache.connection().execute(
        "DELETE FROM recent_access WHERE path NOT IN (
            SELECT path FROM recent_access ORDER BY opened_at DESC LIMIT 50
        )",
        [],
    )?;
    Ok(())
}

pub fn list_recent_files(cache: &IndexCache, limit: u32) -> Result<Vec<RecentFileHit>, IndexerError> {
    let mut statement = cache.connection().prepare(
        "SELECT path, opened_at FROM recent_access ORDER BY opened_at DESC LIMIT ?1",
    )?;
    let rows = statement.query_map(params![limit.max(1)], |row| {
        Ok(RecentFileHit {
            path: row.get(0)?,
            opened_at: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}
