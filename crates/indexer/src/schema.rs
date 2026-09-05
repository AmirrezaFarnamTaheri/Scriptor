//! Index schema definitions and version constants.
//!
//! # Schema migration train (§3 of the program plan)
//!
//! Rules — binding:
//! 1. **One open version at a time.** Two clusters may not both be mid-migration.
//! 2. Every step is a `fn migrate_N_to_M(tx)` in a transaction.
//! 3. v5 ships with a visible progress surface (reindex is minutes on large vaults).
//! 4. Each version adds one `migration_vN_to_vM` test plus one round-trip query test.
//!
//! | Version | Content                                           | Rebuild? |
//! |---------|---------------------------------------------------|----------|
//! | v5      | multi-column FTS + diacritics + weighted rank      | **Yes**  |
//! | v6      | `tasks` + `task_tags` tables                      | No       |
//! | v7      | `annotations` + `srs_cards` + `srs_reviews`       | No       |
//! | v8      | task extended fields + `blocks` embedding table    | No       |
//! | v9      | frontmatter aliases on note rows                   | No       |
//! | v10     | canonical task source note id + explicit path       | No       |
//! | v11     | normalize task FK integrity via transactional table rebuild | No       |

/// Current on-disk schema version. Bump this constant exactly once per train step.
pub const SCHEMA_VERSION: i32 = 11;

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
  archived INTEGER NOT NULL DEFAULT 0,
  -- v9: frontmatter aliases stored as a JSON array for fast wikilink resolution.
  aliases_json TEXT NOT NULL DEFAULT '[]'
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

/// v4 FTS — single-column body only, plain unicode61.
/// Kept here for documentation; the v5 migration drops and recreates this table.
pub const CREATE_FTS_V4: &str = "
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
  note_id UNINDEXED,
  title,
  body,
  tokenize = 'unicode61'
);
";

/// v5 FTS — four content columns with diacritic folding.
///
/// Column weights for rank.rs BM25 scoring:
///   title    → weight 10
///   headings → weight 5
///   tags     → weight 3
///   body     → weight 1
///
/// `remove_diacritics 2` folds "résumé" → "resume" in both query and document.
pub const CREATE_FTS_V5: &str = "
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
  note_id UNINDEXED,
  title,
  headings,
  tags,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
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

/// Columns added by the v2 -> v3 migration.
///
/// SQLite has no `ADD COLUMN IF NOT EXISTS`, so the migration applies each entry
/// individually and skips columns that already exist (see `migration::migrate_cache`).
/// Each tuple is `(column_name, ALTER TABLE statement)`.
pub const MIGRATE_V2_TO_V3: &[(&str, &str)] = &[
    ("note_type", "ALTER TABLE notes ADD COLUMN note_type TEXT"),
    (
        "organized",
        "ALTER TABLE notes ADD COLUMN organized INTEGER NOT NULL DEFAULT 0",
    ),
    (
        "archived",
        "ALTER TABLE notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
    ),
];

pub const CREATE_INDEXES: &str = "
CREATE INDEX IF NOT EXISTS idx_notes_vault_path ON notes(vault_id, path);
CREATE INDEX IF NOT EXISTS idx_notes_vault_title ON notes(vault_id, title);
CREATE INDEX IF NOT EXISTS idx_notes_vault_modified ON notes(vault_id, modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_links_vault_from ON links(vault_id, from_note_id);
CREATE INDEX IF NOT EXISTS idx_links_vault_to_note ON links(vault_id, to_note_id);
CREATE INDEX IF NOT EXISTS idx_links_vault_to_path ON links(vault_id, to_path);
CREATE INDEX IF NOT EXISTS idx_links_from_kind ON links(from_note_id, kind);
CREATE INDEX IF NOT EXISTS idx_citations_note ON citation_refs(note_id);
CREATE INDEX IF NOT EXISTS idx_recent_access_opened ON recent_access(opened_at DESC);
";

pub const CREATE_RECENT_ACCESS: &str = "
CREATE TABLE IF NOT EXISTS recent_access (
  path TEXT PRIMARY KEY,
  opened_at TEXT NOT NULL
);
";

// ── v6: task capture ─────────────────────────────────────────────────────────

/// v6 — task rows and their multi-value tag junction table.
///
/// `source_note_id` is the canonical `notes.id` (NULL for standalone tasks);
/// `source_note_path` is the vault-relative navigation path. `due_at` and `completed_at` are ISO-8601
/// strings or NULL. `priority` is a signed integer (lower = more urgent).
pub const CREATE_TASKS: &str = "
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  source_note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
  source_note_path TEXT,
  -- W4-2/W4-3: extended fields added in v8.
  line INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  scheduled_at TEXT,
  start_at TEXT,
  rrule TEXT,
  -- 'emoji' | 'dataview'
  field_style TEXT NOT NULL DEFAULT 'emoji',
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_vault_status ON tasks(vault_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_vault_due ON tasks(vault_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_source_note_id ON tasks(source_note_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source_note_path ON tasks(vault_id, source_note_path);
";

pub const CREATE_TASK_TAGS: &str = "
CREATE TABLE IF NOT EXISTS task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (task_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag);
";

// ── v7: annotations + spaced-repetition ─────────────────────────────────────

/// v7 — inline annotations (highlights, comments) attached to note ranges.
///
/// `anchor` is a JSON object `{"start":N,"end":N}` using byte offsets into the
/// note body. `kind` is one of `"highlight"`, `"comment"`, or `"question"`.
/// `color` is an optional hex string for highlight annotations.
pub const CREATE_ANNOTATIONS: &str = "
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  note_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'highlight',
  anchor_json TEXT NOT NULL,
  color TEXT,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_annotations_note ON annotations(note_id);
CREATE INDEX IF NOT EXISTS idx_annotations_vault ON annotations(vault_id);
";

/// v7 — spaced-repetition card deck generated from annotations.
///
/// Each card is derived from a `"question"` annotation; `due_at` is
/// recomputed by the SM-2 algorithm after each review.
#[cfg(feature = "srs")]
pub const CREATE_SRS_CARDS: &str = "
CREATE TABLE IF NOT EXISTS srs_cards (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  due_at TEXT NOT NULL,
  interval_days REAL NOT NULL DEFAULT 1.0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  repetition INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_srs_cards_due ON srs_cards(due_at);
";

/// v7 — review log for SRS cards (one row per user review session).
#[cfg(feature = "srs")]
pub const CREATE_SRS_REVIEWS: &str = "
CREATE TABLE IF NOT EXISTS srs_reviews (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES srs_cards(id) ON DELETE CASCADE,
  reviewed_at TEXT NOT NULL,
  quality INTEGER NOT NULL,  -- SM-2 quality 0-5
  interval_before REAL NOT NULL,
  interval_after REAL NOT NULL,
  ease_before REAL NOT NULL,
  ease_after REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_srs_reviews_card ON srs_reviews(card_id);
";

// ── v8: extended task fields + blocks ────────────────────────────────────────

/// v8 — ADD COLUMN migrations on the `tasks` table (new fields added in W4-2/W4-3).
/// Callers guard every ALTER with a table_columns check so the step is safely
/// idempotent even without IF NOT EXISTS (SQLite < 3.37 compat).
/// Each tuple is `(column_name, ALTER TABLE statement)`.
pub const MIGRATE_V7_TO_V8_TASKS: &[(&str, &str)] = &[
    (
        "line",
        "ALTER TABLE tasks ADD COLUMN line INTEGER NOT NULL DEFAULT 0",
    ),
    (
        "scheduled_at",
        "ALTER TABLE tasks ADD COLUMN scheduled_at TEXT",
    ),
    ("start_at", "ALTER TABLE tasks ADD COLUMN start_at TEXT"),
    ("rrule", "ALTER TABLE tasks ADD COLUMN rrule TEXT"),
    (
        "field_style",
        "ALTER TABLE tasks ADD COLUMN field_style TEXT NOT NULL DEFAULT 'emoji'",
    ),
];

/// v8 → v9: adds `aliases_json` to `notes` so wikilink resolution can use the
/// index instead of reading every note from disk (O(1) SQL vs O(n) disk reads).
pub const MIGRATE_V8_TO_V9_NOTES: &[(&str, &str)] = &[(
    "aliases_json",
    "ALTER TABLE notes ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]'",
)];

/// v8 — `blocks` table for per-paragraph / per-heading embeddings.
/// `embedding` is stored as a BLOB of IEEE-754 f32 values (little-endian).
pub const CREATE_BLOCKS: &str = "
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  block_type TEXT NOT NULL,  -- 'paragraph' | 'heading' | 'code' | 'list'
  content TEXT NOT NULL,
  embedding BLOB,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocks_note ON blocks(note_id);
CREATE INDEX IF NOT EXISTS idx_blocks_vault ON blocks(vault_id);
";

// ─────────────────────────────────────────────────────────────────────────────

/// Apply the full schema at the current `SCHEMA_VERSION` (used for fresh databases).
pub fn apply_schema(connection: &rusqlite::Connection) -> rusqlite::Result<()> {
    connection.execute_batch(CREATE_META)?;
    connection.execute_batch(CREATE_NOTES)?;
    connection.execute_batch(CREATE_LINKS)?;
    // Fresh installs get the v5 FTS table directly.
    connection.execute_batch(CREATE_FTS_V5)?;
    connection.execute_batch(CREATE_CITATIONS)?;
    connection.execute_batch(CREATE_RECENT_ACCESS)?;
    connection.execute_batch(CREATE_INDEXES)?;
    // v6 additions.
    connection.execute_batch(CREATE_TASKS)?;
    connection.execute_batch(CREATE_TASK_TAGS)?;
    // v7 additions.
    connection.execute_batch(CREATE_ANNOTATIONS)?;
    #[cfg(feature = "srs")]
    {
        connection.execute_batch(CREATE_SRS_CARDS)?;
        connection.execute_batch(CREATE_SRS_REVIEWS)?;
    }
    // v8 additions.
    connection.execute_batch(CREATE_BLOCKS)?;
    connection.execute(
        "INSERT OR REPLACE INTO cache_meta(key, value) VALUES ('schema_version', ?1)",
        [SCHEMA_VERSION.to_string()],
    )?;
    Ok(())
}
