pub const SCHEMA_VERSION: i32 = 3;

pub const CREATE_META: &str = "
CREATE TABLE IF NOT EXISTS cache_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
";

pub const CREATE_NOTES: &str = "
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  note_type TEXT,
  organized INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);
";

pub const CREATE_LINKS: &str = "
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  from_note_id TEXT NOT NULL,
  to_note_id TEXT,
  to_path TEXT,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  line INTEGER
);
";

pub const CREATE_FTS: &str = "
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
  note_id UNINDEXED,
  title,
  body,
  tokenize = 'unicode61'
);
";

pub const CREATE_CITATIONS: &str = "
CREATE TABLE IF NOT EXISTS citation_refs (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  key TEXT NOT NULL,
  line INTEGER NOT NULL,
  valid INTEGER NOT NULL
);
";

pub const MIGRATE_V2_TO_V3: &str = "
ALTER TABLE notes ADD COLUMN note_type TEXT;
ALTER TABLE notes ADD COLUMN organized INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
";

pub const CREATE_RECENT_ACCESS: &str = "
CREATE TABLE IF NOT EXISTS recent_access (
  path TEXT PRIMARY KEY,
  opened_at TEXT NOT NULL
);
";

pub fn apply_schema(connection: &rusqlite::Connection) -> rusqlite::Result<()> {
    connection.execute_batch(CREATE_META)?;
    connection.execute_batch(CREATE_NOTES)?;
    connection.execute_batch(CREATE_LINKS)?;
    connection.execute_batch(CREATE_FTS)?;
    connection.execute_batch(CREATE_CITATIONS)?;
    connection.execute_batch(CREATE_RECENT_ACCESS)?;
    connection.execute(
        "INSERT OR REPLACE INTO cache_meta(key, value) VALUES ('schema_version', ?1)",
        [SCHEMA_VERSION.to_string()],
    )?;
    Ok(())
}
