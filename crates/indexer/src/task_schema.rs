use rusqlite::Connection;

use crate::error::IndexerError;
use crate::schema::{CREATE_TASK_TAGS, CREATE_TASKS};

/// Normalize task-table integrity for caches that reached schema v10 through the
/// historical ALTER-only migration. Fresh v10 caches already carry this FK, so
/// the common path is a cheap PRAGMA check and no write transaction.
pub(crate) fn normalize_task_foreign_keys(connection: &Connection) -> Result<(), IndexerError> {
    if task_source_fk_is_current(connection)? {
        return Ok(());
    }

    let tasks_exist: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks')",
        [],
        |row| row.get(0),
    )?;
    if !tasks_exist {
        return Ok(());
    }

    let transaction = connection.unchecked_transaction()?;

    // A legacy cache can contain a source id that no longer has a parent note.
    // Preserve its navigation path, but do not let that historical orphan make
    // the normalized FK table impossible to create.
    transaction.execute(
        "UPDATE tasks
         SET source_note_id = NULL
         WHERE source_note_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM notes WHERE notes.id = tasks.source_note_id)",
        [],
    )?;

    transaction.execute_batch(
        "CREATE TEMP TABLE task_tags_integrity_backup AS
           SELECT task_id, tag FROM task_tags;
         DROP TABLE task_tags;
         DROP INDEX IF EXISTS idx_tasks_vault_status;
         DROP INDEX IF EXISTS idx_tasks_vault_due;
         DROP INDEX IF EXISTS idx_tasks_source_note;
         DROP INDEX IF EXISTS idx_tasks_source_note_id;
         DROP INDEX IF EXISTS idx_tasks_source_note_path;
         ALTER TABLE tasks RENAME TO tasks_integrity_legacy;",
    )?;
    transaction.execute_batch(CREATE_TASKS)?;
    transaction.execute_batch(
        "INSERT INTO tasks(
           id, vault_id, source_note_id, source_note_path, line, title, body,
           status, priority, due_at, scheduled_at, start_at, rrule,
           field_style, completed_at, created_at, updated_at
         )
         SELECT
           id, vault_id, source_note_id, source_note_path, line, title, body,
           status, priority, due_at, scheduled_at, start_at, rrule,
           field_style, completed_at, created_at, updated_at
         FROM tasks_integrity_legacy;
         DROP TABLE tasks_integrity_legacy;",
    )?;
    transaction.execute_batch(CREATE_TASK_TAGS)?;
    transaction.execute_batch(
        "INSERT OR IGNORE INTO task_tags(task_id, tag)
           SELECT backup.task_id, backup.tag
           FROM task_tags_integrity_backup backup
           INNER JOIN tasks ON tasks.id = backup.task_id;
         DROP TABLE task_tags_integrity_backup;",
    )?;
    transaction.commit()?;
    Ok(())
}

fn task_source_fk_is_current(connection: &Connection) -> Result<bool, IndexerError> {
    let mut statement = connection.prepare(
        "SELECT \"table\", \"from\", \"to\", on_delete
         FROM pragma_foreign_key_list('tasks')",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
        ))
    })?;
    for row in rows {
        let (table, from, to, on_delete) = row?;
        if table == "notes"
            && from == "source_note_id"
            && to == "id"
            && on_delete.eq_ignore_ascii_case("CASCADE")
        {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::apply_schema;

    #[test]
    fn legacy_v10_task_table_is_rebuilt_to_fresh_fk_contract() -> Result<(), IndexerError> {
        let connection = Connection::open_in_memory()?;
        apply_schema(&connection)?;
        connection.execute_batch(
            "DROP TABLE task_tags;
             DROP TABLE tasks;
             CREATE TABLE tasks (
               id TEXT PRIMARY KEY,
               vault_id TEXT NOT NULL,
               source_note_id TEXT,
               source_note_path TEXT,
               line INTEGER NOT NULL DEFAULT 0,
               title TEXT NOT NULL,
               body TEXT NOT NULL DEFAULT '',
               status TEXT NOT NULL DEFAULT 'open',
               priority INTEGER NOT NULL DEFAULT 0,
               due_at TEXT,
               scheduled_at TEXT,
               start_at TEXT,
               rrule TEXT,
               field_style TEXT NOT NULL DEFAULT 'emoji',
               completed_at TEXT,
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );
             CREATE TABLE task_tags(task_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY(task_id, tag));
             INSERT INTO notes(id, vault_id, path, title, content_hash, modified_at, word_count)
             VALUES ('v:a.md', 'v', 'a.md', 'A', 'h', 'now', 1);
             INSERT INTO tasks(id, vault_id, source_note_id, source_note_path, title, created_at, updated_at)
             VALUES ('good', 'v', 'v:a.md', 'a.md', 'Good', 'now', 'now');
             INSERT INTO tasks(id, vault_id, source_note_id, source_note_path, title, created_at, updated_at)
             VALUES ('orphan', 'v', 'v:missing.md', 'missing.md', 'Orphan', 'now', 'now');
             INSERT INTO task_tags VALUES ('good', 'work');",
        )?;

        normalize_task_foreign_keys(&connection)?;
        assert!(task_source_fk_is_current(&connection)?);
        let orphan_source: Option<String> = connection.query_row(
            "SELECT source_note_id FROM tasks WHERE id = 'orphan'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(orphan_source, None);
        let tag: String = connection.query_row(
            "SELECT tag FROM task_tags WHERE task_id = 'good'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(tag, "work");

        connection.execute("DELETE FROM notes WHERE id = 'v:a.md'", [])?;
        let good_count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM tasks WHERE id = 'good'",
            [],
            |row| row.get(0),
        )?;
        let tag_count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM task_tags WHERE task_id = 'good'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(good_count, 0);
        assert_eq!(tag_count, 0);
        Ok(())
    }

    #[test]
    fn fresh_schema_is_already_normalized() -> Result<(), IndexerError> {
        let connection = Connection::open_in_memory()?;
        apply_schema(&connection)?;
        assert!(task_source_fk_is_current(&connection)?);
        normalize_task_foreign_keys(&connection)?;
        assert!(task_source_fk_is_current(&connection)?);
        Ok(())
    }
}
