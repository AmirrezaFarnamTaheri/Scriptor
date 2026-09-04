/*!
 * tasks.rs — W4-2/W4-3 task parser + indexer CRUD.
 *
 * ## Architecture
 *
 * Parsing is split into two passes to keep each function focused:
 *
 * 1. `parse_tasks_from_markdown` — pure function: `&str` → `Vec<ParsedTask>`.
 *    No I/O.  Handles both emoji-style and Dataview-style field annotations.
 *
 * 2. `sync_note_tasks` — writes the parsed rows to SQLite (upsert + delete stale).
 *
 * ## Supported syntax
 *
 * ### Status checkbox → `status`
 *
 * | Checkbox | Status       |
 * |----------|--------------|
 * | `[ ]`    | open         |
 * | `[x]`    | done         |
 * | `[-]`    | cancelled    |
 * | `[>]`    | forwarded    |
 * | `[/]`    | in-progress  |
 * | `[<char>]` | custom `<char>` |
 *
 * ### Emoji-style fields (F-6)
 *
 * | Marker | Field       |
 * |--------|-------------|
 * | 📅     | due         |
 * | ⏰     | due (alt)   |
 * | ⏳     | scheduled   |
 * | 🛫     | start       |
 * | 🔁     | rrule       |
 *
 * ### Dataview-style fields
 *
 * `[due:: 2026-01-01]`, `[scheduled:: 2026-01-01]`, `[start:: 2026-01-01]`,
 * `[rrule:: FREQ=WEEKLY;BYDAY=MO]`.
 *
 * ### Priority (Obsidian Tasks style)
 *
 * `🔺` highest (−3), `⏫` high (−2), `🔼` medium (−1), `🔽` low (1), `⏬` lowest (2).
 *
 * ## Single definition rule (I-5)
 *
 * The Rust parser is the authoritative task parser for indexing.  The TS layer
 * (`packages/core/src/task/`) also parses tasks, but only for **display** and
 * **inline editing** in the React layer — it does not re-derive indices.
 */

use std::collections::BTreeSet;

use rusqlite::{Connection, TransactionBehavior, params, params_from_iter};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::IndexCache;
use crate::error::IndexerError;

// ── Public types ──────────────────────────────────────────────────────────────

/// A task row as represented in the `tasks` table.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskRow {
    pub id: String,
    pub vault_id: String,
    /// Canonical `notes.id` of the source note (`"<vault_id>:<path>"`), or
    /// `None` for a task that is not attached to a note.  This is the value
    /// `tasks.source_note_id` carries the foreign key on, never a bare path.
    pub source_note_id: Option<String>,
    /// Vault-relative path of the source note.  This is what the UI and the
    /// DQL projector navigate with; `source_note_id` must not be used for it.
    pub source_note_path: Option<String>,
    /// 0-based line number in the note.
    pub line: i64,
    pub title: String,
    pub status: String,
    /// Lower integer = more urgent.  Default 0.
    pub priority: i64,
    /// ISO-8601 date string, or None.
    pub due_at: Option<String>,
    /// ISO-8601 date string, or None.
    pub scheduled_at: Option<String>,
    /// ISO-8601 date string, or None.
    pub start_at: Option<String>,
    /// RRULE string, or None (natural language never stored).
    pub rrule: Option<String>,
    /// `"emoji"` or `"dataview"`.
    pub field_style: String,
    pub tags: Vec<String>,
    /// ISO-8601 completion timestamp while status is `done`.
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Intermediate result from parsing — no `id`, `created_at`, `updated_at` yet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedTask {
    /// 0-based line number.
    pub line: usize,
    pub status: String,
    pub title: String,
    pub priority: i64,
    pub due_at: Option<String>,
    pub scheduled_at: Option<String>,
    pub start_at: Option<String>,
    pub rrule: Option<String>,
    pub field_style: FieldStyle,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FieldStyle {
    Emoji,
    Dataview,
}

impl FieldStyle {
    fn as_str(self) -> &'static str {
        match self {
            FieldStyle::Emoji => "emoji",
            FieldStyle::Dataview => "dataview",
        }
    }
}

// ── Parser ────────────────────────────────────────────────────────────────────

/// Parse all tasks from `markdown` text.  Pure — no I/O.
///
/// A task line begins with optional leading whitespace, then exactly one of the
/// GFM list markers (`-`, `*`, `+`), then a space, then `[<status>]`.
pub fn parse_tasks_from_markdown(markdown: &str) -> Vec<ParsedTask> {
    markdown
        .lines()
        .enumerate()
        .filter_map(|(line_idx, line)| parse_task_line(line_idx, line))
        .collect()
}

fn parse_task_line(line_idx: usize, line: &str) -> Option<ParsedTask> {
    // Skip leading whitespace.
    let trimmed = line.trim_start();
    // Must start with a GFM list marker.
    let rest = trimmed
        .strip_prefix("- ")
        .or_else(|| trimmed.strip_prefix("* "))
        .or_else(|| trimmed.strip_prefix("+ "))?;

    // Checkbox: `[<char>] `.
    if !rest.starts_with('[') {
        return None;
    }
    let close = rest.find(']')?;
    if close < 2 {
        return None;
    }
    // Do NOT trim here — a space is the canonical "open" checkbox character.
    let status_char = &rest[1..close];
    let after_checkbox = rest[close + 1..].trim_start_matches(' ');

    let status = match status_char {
        " " => "open",
        "x" | "X" => "done",
        "-" => "cancelled",
        ">" => "forwarded",
        "/" => "in-progress",
        other => other.trim(),
    }
    .to_string();

    // Parse fields from the task text.
    let (title, fields) = extract_fields(after_checkbox);

    let tags = extract_tags(&title);

    Some(ParsedTask {
        line: line_idx,
        status,
        title: title.trim().to_string(),
        priority: fields.priority,
        due_at: fields.due_at,
        scheduled_at: fields.scheduled_at,
        start_at: fields.start_at,
        rrule: fields.rrule,
        field_style: fields.style,
        tags,
    })
}

// ── Field extraction ──────────────────────────────────────────────────────────

struct ExtractedFields {
    priority: i64,
    due_at: Option<String>,
    scheduled_at: Option<String>,
    start_at: Option<String>,
    rrule: Option<String>,
    style: FieldStyle,
}

fn extract_fields(text: &str) -> (String, ExtractedFields) {
    // Check which style is present.  Dataview takes precedence if both appear.
    if text.contains("[due::")
        || text.contains("[scheduled::")
        || text.contains("[start::")
        || text.contains("[rrule::")
        || text.contains("[priority::")
    {
        extract_dataview_fields(text)
    } else {
        extract_emoji_fields(text)
    }
}

// ── Dataview-style `[field:: value]` ─────────────────────────────────────────

fn extract_dataview_fields(text: &str) -> (String, ExtractedFields) {
    let mut due_at = None;
    let mut scheduled_at = None;
    let mut start_at = None;
    let mut rrule = None;
    let mut priority: i64 = 0;

    // Remove all `[field:: value]` patterns from the title.
    let mut clean = text.to_string();

    for (key, target) in [
        ("due", &mut due_at),
        ("scheduled", &mut scheduled_at),
        ("start", &mut start_at),
        ("rrule", &mut rrule),
    ] {
        clean = remove_dataview_field(&clean, key, target);
    }

    // Priority via `[priority:: N]`.
    let mut pri_str: Option<String> = None;
    clean = remove_dataview_field(&clean, "priority", &mut pri_str);
    if let Some(p) = pri_str
        && let Ok(n) = p.trim().parse::<i64>()
    {
        priority = n;
    }

    (
        clean.trim().to_string(),
        ExtractedFields {
            priority,
            due_at,
            scheduled_at,
            start_at,
            rrule,
            style: FieldStyle::Dataview,
        },
    )
}

/// Scan `text` for `[<key>:: <value>]`, remove it, and write the trimmed value
/// into `dest`.  Returns the cleaned text.
fn remove_dataview_field(text: &str, key: &str, dest: &mut Option<String>) -> String {
    let marker = format!("[{key}::");
    let Some(start) = text.find(&marker) else {
        return text.to_string();
    };
    let after = &text[start + marker.len()..];
    let Some(end) = after.find(']') else {
        return text.to_string();
    };
    let value = after[..end].trim().to_string();
    if !value.is_empty() {
        *dest = Some(value);
    }
    // Remove `[key:: value]` from text.
    let before = &text[..start];
    let rest = &text[start + marker.len() + end + 1..];
    format!("{before}{rest}")
}

// ── Emoji-style ───────────────────────────────────────────────────────────────

fn extract_emoji_fields(text: &str) -> (String, ExtractedFields) {
    let mut due_at = None;
    let mut scheduled_at = None;
    let mut start_at = None;
    let mut rrule = None;

    // Priority emoji (must match before date emoji).
    let (clean0, priority) = extract_priority_emoji(text);

    // Date emojis — sequential so the borrow checker sees independent &mut borrows.
    // 📅 and ⏰ are both due-date markers; whichever appears first wins.
    let clean1 = extract_emoji_date(&clean0, "📅", &mut due_at);
    let clean2 = extract_emoji_date(&clean1, "⏰", &mut due_at);
    let clean3 = extract_emoji_date(&clean2, "⏳", &mut scheduled_at);
    let clean4 = extract_emoji_date(&clean3, "🛫", &mut start_at);
    let clean5 = extract_emoji_rrule(&clean4, "🔁", &mut rrule);

    (
        clean5.trim().to_string(),
        ExtractedFields {
            priority,
            due_at,
            scheduled_at,
            start_at,
            rrule,
            style: FieldStyle::Emoji,
        },
    )
}

fn extract_priority_emoji(text: &str) -> (String, i64) {
    let table: &[(&str, i64)] = &[("🔺", -3), ("⏫", -2), ("🔼", -1), ("🔽", 1), ("⏬", 2)];
    for (emoji, pri) in table {
        if text.contains(emoji) {
            return (text.replacen(emoji, "", 1), *pri);
        }
    }
    (text.to_string(), 0)
}

fn extract_emoji_date(text: &str, emoji: &str, dest: &mut Option<String>) -> String {
    let Some(pos) = text.find(emoji) else {
        return text.to_string();
    };
    let after = text[pos + emoji.len()..].trim_start();
    // Grab up to 10 characters: ISO date format is exactly 10.
    let token: String = after.chars().take(10).collect();
    if looks_like_date(&token) {
        *dest = Some(token.clone());
        // Remove emoji + date from text.
        let before = &text[..pos];
        let rest = &text[pos + emoji.len()..].trim_start()[token.len()..];
        return format!("{before}{rest}");
    }
    text.to_string()
}

fn extract_emoji_rrule(text: &str, emoji: &str, dest: &mut Option<String>) -> String {
    let Some(pos) = text.find(emoji) else {
        return text.to_string();
    };
    let after = text[pos + emoji.len()..].trim_start();
    // Take until whitespace or end of line.
    let token: String = after.chars().take_while(|c| !c.is_whitespace()).collect();
    if !token.is_empty() {
        *dest = Some(token.clone());
        let before = &text[..pos];
        let rest = &text[pos + emoji.len()..].trim_start()[token.len()..];
        return format!("{before}{rest}");
    }
    text.to_string()
}

fn looks_like_date(s: &str) -> bool {
    is_valid_task_date(s)
}

pub(crate) fn is_valid_task_date(s: &str) -> bool {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
}

// ── Tag extraction ────────────────────────────────────────────────────────────

/// Extract `#tag` tokens from task text (excluding `#` not followed by word chars).
fn extract_tags(text: &str) -> Vec<String> {
    let mut tags = BTreeSet::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '#' && (i == 0 || !chars[i - 1].is_alphanumeric()) {
            let start = i + 1;
            let mut j = start;
            while j < chars.len()
                && (chars[j].is_alphanumeric() || chars[j] == '_' || chars[j] == '/')
            {
                j += 1;
            }
            if j > start {
                tags.insert(chars[start..j].iter().collect::<String>());
            }
        }
        i += 1;
    }
    tags.into_iter().collect()
}

// ── SQLite CRUD ───────────────────────────────────────────────────────────────

/// Upsert all tasks parsed from a note, delete any rows from that note that no
/// longer appear in the parse result.  Idempotent.
///
/// `note_id` is the canonical `notes.id` of the source note — i.e.
/// `"<vault_id>:<vault-relative path>"` as produced by `scriptor_vault::note_id`
/// — **not** the bare vault-relative path.  `tasks.source_note_id` carries a
/// foreign key on `notes(id)` and the connection runs with `foreign_keys=ON`,
/// so a bare path is rejected with `FOREIGN KEY constraint failed` and the whole
/// index transaction rolls back.  `tasks.source_note_path` is mirrored from the
/// notes row so readers never have to decode a note id.
///
/// `now` must be an ISO-8601 datetime string.
pub fn sync_note_tasks(
    conn: &Connection,
    vault_id: &str,
    note_id: &str,
    tasks: &[ParsedTask],
    now: &str,
) -> Result<(), IndexerError> {
    // All existing task ids for this note (used for cleanup at the end).
    let mut existing_ids: BTreeSet<String> = {
        let mut stmt =
            conn.prepare("SELECT id FROM tasks WHERE vault_id = ?1 AND source_note_id = ?2")?;
        stmt.query_map(params![vault_id, note_id], |row| row.get(0))?
            .collect::<Result<BTreeSet<_>, _>>()?
    };

    // Mirrored from the parent row: the path is the navigation key the UI and
    // the DQL projector use, and it stays correct when a note is renamed
    // because every re-index re-reads it here.
    let source_note_path: Option<String> = conn
        .query_row(
            "SELECT path FROM notes WHERE id = ?1",
            params![note_id],
            |row| row.get(0),
        )
        .ok();

    let mut seen_ids: BTreeSet<String> = BTreeSet::new();

    for task in tasks {
        // Stable ID: vault + note + line (so re-indexing is idempotent).
        let id = stable_task_id(vault_id, note_id, task.line);
        seen_ids.insert(id.clone());
        existing_ids.remove(&id);

        // Upsert.
        conn.execute(
            "INSERT INTO tasks
               (id, vault_id, source_note_id, line, title, status, priority,
                due_at, scheduled_at, start_at, rrule, field_style, completed_at,
                created_at, updated_at, source_note_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                     CASE WHEN ?6 = 'done' THEN ?13 ELSE NULL END, ?13, ?13, ?14)
             ON CONFLICT(id) DO UPDATE SET
               title        = excluded.title,
               status       = excluded.status,
               priority     = excluded.priority,
               due_at       = excluded.due_at,
               scheduled_at = excluded.scheduled_at,
               start_at     = excluded.start_at,
               rrule        = excluded.rrule,
               field_style  = excluded.field_style,
               completed_at = CASE
                   WHEN excluded.status = 'done' THEN COALESCE(tasks.completed_at, excluded.completed_at)
                   ELSE NULL
               END,
               updated_at   = excluded.updated_at,
               source_note_path = excluded.source_note_path",
            params![
                id,
                vault_id,
                note_id,
                task.line as i64,
                task.title,
                task.status,
                task.priority,
                task.due_at,
                task.scheduled_at,
                task.start_at,
                task.rrule,
                task.field_style.as_str(),
                now,
                source_note_path,
            ],
        )?;

        // Sync task_tags.
        conn.execute("DELETE FROM task_tags WHERE task_id = ?1", params![id])?;
        for tag in &task.tags {
            conn.execute(
                "INSERT OR IGNORE INTO task_tags(task_id, tag) VALUES (?1, ?2)",
                params![id, tag],
            )?;
        }
    }

    // Delete tasks from this note that no longer appear in the parse result.
    for stale_id in &existing_ids {
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![stale_id])?;
    }

    Ok(())
}

/// Build a deterministic task ID.  Uses a UUID v5 namespace derived from
/// vault + note + line to avoid ID collisions across vaults.
fn stable_task_id(vault_id: &str, note_id: &str, line: usize) -> String {
    // v5 namespace: Scriptor tasks (arbitrary fixed UUID).
    let ns = uuid::Uuid::parse_str("6ba7b810-9dad-11d1-80b4-00c04fd430c8").unwrap();
    let key = format!("{vault_id}:{note_id}:{line}");
    Uuid::new_v5(&ns, key.as_bytes()).to_string()
}

// ── Task query helpers ────────────────────────────────────────────────────────

/// Query tasks for TQL operators.  Returns lightweight rows sorted by `due_at`
/// then `source_note_id`.
pub fn query_tasks(
    cache: &IndexCache,
    vault_id: &str,
    filter: &TaskFilter,
    limit: u32,
) -> Result<Vec<TaskRow>, IndexerError> {
    use rusqlite::types::Value;

    let conn = cache.connection()?;
    let mut sql = String::from(
        "SELECT t.id, t.vault_id, t.source_note_id, t.line, t.title, t.status,
                t.priority, t.due_at, t.scheduled_at, t.start_at, t.rrule,
                t.field_style, t.completed_at, t.created_at, t.updated_at,
                t.source_note_path
         FROM tasks t",
    );
    let mut values: Vec<Value> = vec![Value::Text(vault_id.to_string())];
    let mut predicates = vec!["t.vault_id = ?".to_string()];

    if let Some(tag) = filter.tag.as_deref() {
        sql.push_str(" INNER JOIN task_tags tt ON tt.task_id = t.id");
        predicates.push("tt.tag = ?".into());
        values.push(Value::Text(tag.to_string()));
    }
    if let Some(status) = filter.status.as_deref() {
        predicates.push("t.status = ?".into());
        values.push(Value::Text(status.to_string()));
    }
    if let Some(due_after) = filter.due_after.as_deref() {
        predicates.push("t.due_at >= ?".into());
        values.push(Value::Text(due_after.to_string()));
    }
    if let Some(due_before) = filter.due_before.as_deref() {
        predicates.push("t.due_at <= ?".into());
        values.push(Value::Text(due_before.to_string()));
    }

    sql.push_str(" WHERE ");
    sql.push_str(&predicates.join(" AND "));
    sql.push_str(" ORDER BY t.due_at ASC NULLS LAST, t.source_note_id, t.line LIMIT ?");
    values.push(Value::Integer(i64::from(limit)));

    let mut stmt = conn.prepare_cached(&sql)?;
    let rows = stmt.query_map(params_from_iter(values.iter()), |row| {
        Ok(TaskRowRaw {
            id: row.get(0)?,
            vault_id: row.get(1)?,
            source_note_id: row.get(2)?,
            line: row.get(3)?,
            title: row.get(4)?,
            status: row.get(5)?,
            priority: row.get(6)?,
            due_at: row.get(7)?,
            scheduled_at: row.get(8)?,
            start_at: row.get(9)?,
            rrule: row.get(10)?,
            field_style: row.get(11)?,
            completed_at: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
            source_note_path: row.get(15)?,
        })
    })?;

    let raws: Vec<TaskRowRaw> = rows.collect::<Result<Vec<_>, _>>()?;
    let tags_by_task = fetch_tags_for_tasks(&conn, &raws)?;
    raws.into_iter()
        .map(|raw| {
            let tags = tags_by_task.get(&raw.id).cloned().unwrap_or_default();
            Ok(TaskRow::from_raw(raw, tags))
        })
        .collect()
}

/// Filter parameters for `query_tasks`.
#[derive(Debug, Default, Clone)]
pub struct TaskFilter {
    pub status: Option<String>,
    pub tag: Option<String>,
    pub due_before: Option<String>,
    pub due_after: Option<String>,
}

/// Intermediate struct for `query_map` before tags are attached.
struct TaskRowRaw {
    id: String,
    vault_id: String,
    source_note_id: Option<String>,
    source_note_path: Option<String>,
    line: i64,
    title: String,
    status: String,
    priority: i64,
    due_at: Option<String>,
    scheduled_at: Option<String>,
    start_at: Option<String>,
    rrule: Option<String>,
    field_style: String,
    completed_at: Option<String>,
    created_at: String,
    updated_at: String,
}

pub fn task_by_id(cache: &IndexCache, task_id: &str) -> Result<Option<TaskRow>, IndexerError> {
    let conn = cache.connection()?;
    let mut stmt = conn.prepare(
        "SELECT t.id, t.vault_id, t.source_note_id, t.line, t.title, t.status,
                t.priority, t.due_at, t.scheduled_at, t.start_at, t.rrule,
                t.field_style, t.completed_at, t.created_at, t.updated_at,
                t.source_note_path
         FROM tasks t
         WHERE t.id = ?1
         LIMIT 1",
    )?;
    let mut rows = stmt.query(params![task_id])?;
    let Some(row) = rows.next()? else {
        return Ok(None);
    };

    let raw = TaskRowRaw {
        id: row.get(0)?,
        vault_id: row.get(1)?,
        source_note_id: row.get(2)?,
        line: row.get(3)?,
        title: row.get(4)?,
        status: row.get(5)?,
        priority: row.get(6)?,
        due_at: row.get(7)?,
        scheduled_at: row.get(8)?,
        start_at: row.get(9)?,
        rrule: row.get(10)?,
        field_style: row.get(11)?,
        completed_at: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
        source_note_path: row.get(15)?,
    };

    Ok(Some(build_task_row(&conn, raw)?))
}

/// Rewrite a single task line in canonical Markdown.
///
/// The caller is responsible for validating stale/unknown state at the note
/// boundary before writing the returned markdown back to disk.
pub fn rewrite_task_markdown(
    markdown: &str,
    task: &TaskRow,
    new_status: Option<&str>,
    due_at_patch: Option<Option<&str>>,
) -> Result<String, IndexerError> {
    let line_index = usize::try_from(task.line)
        .map_err(|_| IndexerError::InvalidQuery(format!("task {} has invalid line", task.id)))?;
    let mut lines: Vec<String> = markdown.lines().map(str::to_owned).collect();
    let Some(line) = lines.get(line_index) else {
        return Err(IndexerError::InvalidQuery(format!(
            "task {} is stale: line {} no longer exists",
            task.id, task.line
        )));
    };

    validate_task_line(line, line_index, task)?;
    lines[line_index] = rewrite_task_line(line, task, new_status, due_at_patch)?;

    let mut rewritten = lines.join("\n");
    if markdown.ends_with('\n') {
        rewritten.push('\n');
    }
    Ok(rewritten)
}

/// Convenience wrapper: parse tasks from `markdown` and upsert them for
/// `note_id`.  Equivalent to calling `parse_tasks_from_markdown` followed by
/// `sync_note_tasks`, but using the `IndexCache` API instead of a raw
/// `Connection` reference.
pub fn sync_note_tasks_from_markdown(
    cache: &IndexCache,
    vault_id: &str,
    note_id: &str,
    markdown: &str,
) -> Result<(), IndexerError> {
    let mut conn = cache.connection()?;
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    sync_note_tasks_from_markdown_on(&tx, vault_id, note_id, markdown)?;
    tx.commit()?;
    Ok(())
}

/// Connection-scoped variant for batched rebuilds; joins the caller's
/// transaction when one is open on `conn`.
pub fn sync_note_tasks_from_markdown_on(
    conn: &rusqlite::Connection,
    vault_id: &str,
    note_id: &str,
    markdown: &str,
) -> Result<(), IndexerError> {
    let tasks = parse_tasks_from_markdown(markdown);
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sync_note_tasks(conn, vault_id, note_id, &tasks, &now)
}

impl TaskRow {
    fn from_raw(raw: TaskRowRaw, tags: Vec<String>) -> Self {
        Self {
            id: raw.id,
            vault_id: raw.vault_id,
            source_note_id: raw.source_note_id,
            source_note_path: raw.source_note_path,
            line: raw.line,
            title: raw.title,
            status: raw.status,
            priority: raw.priority,
            due_at: raw.due_at,
            scheduled_at: raw.scheduled_at,
            start_at: raw.start_at,
            rrule: raw.rrule,
            field_style: raw.field_style,
            tags,
            completed_at: raw.completed_at,
            created_at: raw.created_at,
            updated_at: raw.updated_at,
        }
    }
}

/// Fetches tags for many tasks in bounded IN queries (500 placeholders per
/// statement, well under SQLite's variable limit) and groups them by task id.
fn fetch_tags_for_tasks(
    conn: &Connection,
    raws: &[TaskRowRaw],
) -> Result<std::collections::HashMap<String, Vec<String>>, IndexerError> {
    let mut tags_by_task: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for chunk in raws.chunks(500) {
        let placeholders = vec!["?"; chunk.len()].join(", ");
        let sql = format!(
            "SELECT task_id, tag FROM task_tags WHERE task_id IN ({placeholders}) ORDER BY tag"
        );
        let mut stmt = conn.prepare(&sql)?;
        let ids: Vec<String> = chunk.iter().map(|raw| raw.id.clone()).collect();
        let rows = stmt.query_map(params_from_iter(ids.iter()), |row| {
            let task_id: String = row.get(0)?;
            let tag: String = row.get(1)?;
            Ok((task_id, tag))
        })?;
        for pair in rows {
            let (task_id, tag) = pair?;
            tags_by_task.entry(task_id).or_default().push(tag);
        }
    }
    Ok(tags_by_task)
}

fn build_task_row(conn: &Connection, raw: TaskRowRaw) -> Result<TaskRow, IndexerError> {
    let task_id = raw.id.clone();
    let mut tag_stmt = conn.prepare("SELECT tag FROM task_tags WHERE task_id = ?1 ORDER BY tag")?;
    let tags = tag_stmt
        .query_map(params![task_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(TaskRow {
        id: raw.id,
        vault_id: raw.vault_id,
        source_note_id: raw.source_note_id,
        source_note_path: raw.source_note_path,
        line: raw.line,
        title: raw.title,
        status: raw.status,
        priority: raw.priority,
        due_at: raw.due_at,
        scheduled_at: raw.scheduled_at,
        start_at: raw.start_at,
        rrule: raw.rrule,
        field_style: raw.field_style,
        tags,
        completed_at: raw.completed_at,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
    })
}

fn validate_task_line(line: &str, line_index: usize, task: &TaskRow) -> Result<(), IndexerError> {
    let parsed = parse_task_line(line_index, line).ok_or_else(|| {
        IndexerError::InvalidQuery(format!(
            "task {} is stale: line {} no longer contains a task checkbox",
            task.id, task.line
        ))
    })?;
    let expected_style = task.field_style.as_str();
    if parsed.title != task.title
        || parsed.status != task.status
        || parsed.due_at != task.due_at
        || parsed.field_style.as_str() != expected_style
    {
        return Err(IndexerError::InvalidQuery(format!(
            "task {} is stale: source markdown no longer matches the indexed task",
            task.id
        )));
    }
    Ok(())
}

fn rewrite_task_line(
    line: &str,
    task: &TaskRow,
    new_status: Option<&str>,
    due_at_patch: Option<Option<&str>>,
) -> Result<String, IndexerError> {
    let mut updated = line.to_string();
    if let Some(status) = new_status {
        let status_char = status_to_checkbox_char(status)?;
        updated = patch_checkbox_char(&updated, status_char).ok_or_else(|| {
            IndexerError::InvalidQuery(format!(
                "task {} is stale: checkbox could not be rewritten",
                task.id
            ))
        })?;
    }
    if let Some(due_at) = due_at_patch {
        updated = rewrite_due_annotation(&updated, task, due_at)?;
    }
    Ok(updated)
}

fn status_to_checkbox_char(status: &str) -> Result<char, IndexerError> {
    match status {
        "open" => Ok(' '),
        "done" => Ok('x'),
        "cancelled" => Ok('-'),
        "forwarded" => Ok('>'),
        "in-progress" => Ok('/'),
        custom => {
            let mut chars = custom.chars();
            let Some(first) = chars.next() else {
                return Err(IndexerError::InvalidQuery(
                    "task status cannot be empty".to_string(),
                ));
            };
            if chars.next().is_some() {
                return Err(IndexerError::InvalidQuery(format!(
                    "task status {:?} cannot be written to a single checkbox character",
                    custom
                )));
            }
            Ok(first)
        }
    }
}

fn patch_checkbox_char(line: &str, new_char: char) -> Option<String> {
    let trimmed = line.trim_start();
    let rest = trimmed
        .strip_prefix("- ")
        .or_else(|| trimmed.strip_prefix("* "))
        .or_else(|| trimmed.strip_prefix("+ "))?;
    if !rest.starts_with('[') {
        return None;
    }
    let close = rest.find(']')?;
    if close < 2 {
        return None;
    }
    let indent_len = line.len() - trimmed.len();
    let indent = &line[..indent_len];
    let marker = &trimmed[..2];
    let after_close = &rest[close + 1..];
    Some(format!("{indent}{marker}[{new_char}]{after_close}"))
}

fn rewrite_due_annotation(
    line: &str,
    task: &TaskRow,
    due_at: Option<&str>,
) -> Result<String, IndexerError> {
    let mut updated = line.to_string();
    let style = if let Some((start, end, kind)) = find_due_range(&updated) {
        let replacement = match due_at {
            Some(value) => due_token(value, kind),
            None => String::new(),
        };
        updated.replace_range(start..end, &replacement);
        if replacement.is_empty() {
            collapse_spacing_at_removed_field(&mut updated, start);
        }
        kind
    } else {
        preferred_due_style(&task.field_style)
    };

    if find_due_range(&updated).is_none()
        && let Some(value) = due_at
    {
        updated = format!("{} {}", updated.trim_end(), due_token(value, style));
    }

    Ok(compact_task_spacing(&updated))
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum DueStyleKind {
    Emoji,
    Dataview,
}

fn preferred_due_style(field_style: &str) -> DueStyleKind {
    if field_style == "dataview" {
        DueStyleKind::Dataview
    } else {
        DueStyleKind::Emoji
    }
}

fn due_token(value: &str, kind: DueStyleKind) -> String {
    match kind {
        DueStyleKind::Emoji => format!("📅 {value}"),
        DueStyleKind::Dataview => format!("[due:: {value}]"),
    }
}

fn find_due_range(line: &str) -> Option<(usize, usize, DueStyleKind)> {
    if let Some((start, end)) = find_dataview_due_range(line) {
        return Some((start, end, DueStyleKind::Dataview));
    }
    if let Some((start, end)) = find_emoji_due_range(line) {
        return Some((start, end, DueStyleKind::Emoji));
    }
    None
}

fn find_dataview_due_range(line: &str) -> Option<(usize, usize)> {
    let marker = "[due::";
    let start = line.find(marker)?;
    let end = line[start..].find(']')?;
    Some((start, start + end + 1))
}

fn find_emoji_due_range(line: &str) -> Option<(usize, usize)> {
    for emoji in ["📅", "⏰"] {
        let Some(start) = line.find(emoji) else {
            continue;
        };
        let after_emoji = &line[start + emoji.len()..];
        let trimmed = after_emoji.trim_start();
        let ws_len = after_emoji.len() - trimmed.len();
        let token: String = trimmed.chars().take(10).collect();
        if looks_like_date(&token) {
            return Some((start, start + emoji.len() + ws_len + token.len()));
        }
    }
    None
}

fn collapse_spacing_at_removed_field(line: &mut String, boundary: usize) {
    let mut boundary = boundary.min(line.len());
    while boundary > 0
        && boundary < line.len()
        && line.as_bytes()[boundary - 1] == b' '
        && line.as_bytes()[boundary] == b' '
    {
        line.remove(boundary);
    }
    if boundary >= line.len() {
        while line.ends_with(' ') {
            line.pop();
            boundary = boundary.saturating_sub(1);
        }
    }
}

fn compact_task_spacing(line: &str) -> String {
    line.trim_end().to_string()
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── parse_tasks_from_markdown ─────────────────────────────────────────────

    #[test]
    fn parse_open_task() {
        let md = "- [ ] Buy milk";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].status, "open");
        assert_eq!(tasks[0].title, "Buy milk");
        assert_eq!(tasks[0].line, 0);
    }

    #[test]
    fn parse_done_task() {
        let md = "- [x] Done item";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks[0].status, "done");
    }

    #[test]
    fn parse_all_statuses() {
        let cases = [
            ("- [ ] t", "open"),
            ("- [x] t", "done"),
            ("- [X] t", "done"),
            ("- [-] t", "cancelled"),
            ("- [>] t", "forwarded"),
            ("- [/] t", "in-progress"),
            ("- [p] t", "p"),
        ];
        for (md, expected) in cases {
            let tasks = parse_tasks_from_markdown(md);
            assert_eq!(tasks[0].status, expected, "failed for {md}");
        }
    }

    #[test]
    fn parse_emoji_due_date() {
        let md = "- [ ] Meeting 📅 2026-03-15";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks[0].due_at.as_deref(), Some("2026-03-15"));
        assert_eq!(tasks[0].field_style, FieldStyle::Emoji);
        assert!(!tasks[0].title.contains("📅"));
    }

    #[test]
    fn invalid_calendar_dates_are_not_indexed_as_due_dates() {
        let tasks = parse_tasks_from_markdown("- [ ] Impossible 📅 2026-02-31");
        assert_eq!(tasks[0].due_at, None);
        assert!(tasks[0].title.contains("2026-02-31"));
    }

    #[test]
    fn parse_emoji_scheduled() {
        let md = "- [ ] Deploy ⏳ 2026-04-01";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks[0].scheduled_at.as_deref(), Some("2026-04-01"));
    }

    #[test]
    fn parse_emoji_start() {
        let md = "- [ ] Sprint 🛫 2026-05-01";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks[0].start_at.as_deref(), Some("2026-05-01"));
    }

    #[test]
    fn parse_emoji_rrule() {
        let md = "- [ ] Weekly review 🔁 FREQ=WEEKLY;BYDAY=MO";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks[0].rrule.as_deref(), Some("FREQ=WEEKLY;BYDAY=MO"));
    }

    #[test]
    fn parse_emoji_priority() {
        let cases = [
            ("- [ ] T 🔺", -3i64),
            ("- [ ] T ⏫", -2),
            ("- [ ] T 🔼", -1),
            ("- [ ] T 🔽", 1),
            ("- [ ] T ⏬", 2),
            ("- [ ] T", 0),
        ];
        for (md, expected) in cases {
            let tasks = parse_tasks_from_markdown(md);
            assert_eq!(tasks[0].priority, expected, "failed for {md}");
        }
    }

    #[test]
    fn priority_and_rrule_alone_select_dataview_style() {
        let priority = parse_tasks_from_markdown("- [ ] Task [priority:: -2]");
        assert_eq!(priority[0].field_style, FieldStyle::Dataview);
        assert_eq!(priority[0].priority, -2);

        let recurrence = parse_tasks_from_markdown("- [ ] Task [rrule:: FREQ=WEEKLY]");
        assert_eq!(recurrence[0].field_style, FieldStyle::Dataview);
        assert_eq!(recurrence[0].rrule.as_deref(), Some("FREQ=WEEKLY"));
    }

    #[test]
    fn parse_dataview_due() {
        let md = "- [ ] Invoice [due:: 2026-01-15]";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks[0].due_at.as_deref(), Some("2026-01-15"));
        assert_eq!(tasks[0].field_style, FieldStyle::Dataview);
        assert!(!tasks[0].title.contains("[due::"));
    }

    #[test]
    fn parse_dataview_all_fields() {
        let md = "- [ ] Task [due:: 2026-02-01] [scheduled:: 2026-01-28] [start:: 2026-01-20] [rrule:: FREQ=DAILY]";
        let tasks = parse_tasks_from_markdown(md);
        let t = &tasks[0];
        assert_eq!(t.due_at.as_deref(), Some("2026-02-01"));
        assert_eq!(t.scheduled_at.as_deref(), Some("2026-01-28"));
        assert_eq!(t.start_at.as_deref(), Some("2026-01-20"));
        assert_eq!(t.rrule.as_deref(), Some("FREQ=DAILY"));
        assert_eq!(t.field_style, FieldStyle::Dataview);
        assert_eq!(t.title, "Task");
    }

    #[test]
    fn parse_ignores_non_task_list_items() {
        let md = "- Not a task\n- [x] Yes a task\n# Header\nParagraph";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].title, "Yes a task");
    }

    #[test]
    fn parse_line_number_is_correct() {
        let md = "Normal line\n- [ ] Task at line 1\nAnother line\n- [x] Task at line 3";
        let tasks = parse_tasks_from_markdown(md);
        assert_eq!(tasks[0].line, 1);
        assert_eq!(tasks[1].line, 3);
    }

    #[test]
    fn parse_tags_extracted() {
        let md = "- [ ] Do something #work #project/alpha";
        let tasks = parse_tasks_from_markdown(md);
        assert!(tasks[0].tags.contains(&"work".to_string()));
        assert!(tasks[0].tags.contains(&"project/alpha".to_string()));
    }

    #[test]
    fn parse_star_and_plus_markers() {
        let cases = ["* [ ] Star task", "+ [ ] Plus task"];
        for md in cases {
            let tasks = parse_tasks_from_markdown(md);
            assert_eq!(tasks.len(), 1, "failed for {md}");
        }
    }

    // ── looks_like_date ───────────────────────────────────────────────────────

    #[test]
    fn date_validator() {
        assert!(looks_like_date("2026-12-31"));
        assert!(!looks_like_date("26-12-31"));
        assert!(!looks_like_date("2026/12/31"));
        assert!(!looks_like_date("not-a-date"));
    }

    // ── stable_task_id ────────────────────────────────────────────────────────

    #[test]
    fn stable_task_id_is_deterministic() {
        let a = stable_task_id("v1", "notes/foo.md", 3);
        let b = stable_task_id("v1", "notes/foo.md", 3);
        assert_eq!(a, b);
    }

    #[test]
    fn stable_task_id_differs_by_line() {
        let a = stable_task_id("v1", "notes/foo.md", 3);
        let b = stable_task_id("v1", "notes/foo.md", 4);
        assert_ne!(a, b);
    }

    #[test]
    fn rewrite_task_markdown_clears_due_date() {
        let markdown = "- [ ] Ship release 📅 2026-08-20 #work\n";
        let task = TaskRow {
            id: stable_task_id("vault", "notes/tasks.md", 0),
            vault_id: "vault".into(),
            source_note_id: Some("notes/tasks.md".into()),
            source_note_path: Some("notes/tasks.md".into()),
            line: 0,
            title: "Ship release  #work".into(),
            status: "open".into(),
            priority: 0,
            due_at: Some("2026-08-20".into()),
            scheduled_at: None,
            start_at: None,
            rrule: None,
            field_style: "emoji".into(),
            tags: vec!["work".into()],
            completed_at: None,
            created_at: "2026-08-01T00:00:00Z".into(),
            updated_at: "2026-08-01T00:00:00Z".into(),
        };

        let rewritten = rewrite_task_markdown(markdown, &task, None, Some(None)).unwrap();
        assert_eq!(rewritten, "- [ ] Ship release #work\n");
    }

    #[test]
    fn clearing_due_date_preserves_unrelated_double_space_in_title() {
        let markdown = "- [ ] Keep  deliberate 📅 2026-08-20 spacing\n";
        let mut task = parse_tasks_from_markdown(markdown).remove(0);
        let row = TaskRow {
            id: stable_task_id("vault", "notes/tasks.md", 0),
            vault_id: "vault".into(),
            source_note_id: Some("notes/tasks.md".into()),
            source_note_path: Some("notes/tasks.md".into()),
            line: 0,
            title: task.title.clone(),
            status: task.status.clone(),
            priority: task.priority,
            due_at: task.due_at.take(),
            scheduled_at: None,
            start_at: None,
            rrule: None,
            field_style: "emoji".into(),
            tags: vec![],
            completed_at: None,
            created_at: "2026-08-01T00:00:00Z".into(),
            updated_at: "2026-08-01T00:00:00Z".into(),
        };
        let rewritten = rewrite_task_markdown(markdown, &row, None, Some(None)).unwrap();
        assert_eq!(rewritten, "- [ ] Keep  deliberate spacing\n");
    }

    #[test]
    fn rewrite_task_markdown_rejects_stale_source_line() {
        let markdown = "- [x] Ship release 📅 2026-08-20\n";
        let task = TaskRow {
            id: stable_task_id("vault", "notes/tasks.md", 0),
            vault_id: "vault".into(),
            source_note_id: Some("notes/tasks.md".into()),
            source_note_path: Some("notes/tasks.md".into()),
            line: 0,
            title: "Ship release".into(),
            status: "open".into(),
            priority: 0,
            due_at: Some("2026-08-20".into()),
            scheduled_at: None,
            start_at: None,
            rrule: None,
            field_style: "emoji".into(),
            tags: vec![],
            completed_at: None,
            created_at: "2026-08-01T00:00:00Z".into(),
            updated_at: "2026-08-01T00:00:00Z".into(),
        };

        let error = rewrite_task_markdown(markdown, &task, Some("done"), None).unwrap_err();
        assert!(error.to_string().contains("stale"));
    }

    #[test]
    fn query_tasks_filter_values_are_not_interpolated_as_sql() {
        // A status filter value containing SQL injection syntax must be treated
        // as a literal string by the parameterized query, not executed as SQL.
        // If the old string-interpolation path were still in use, the injected
        // UNION would cause the query to return extra rows or error differently.
        use crate::open_cache_for_session;
        use scriptor_vault::open_vault;
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let cache = open_cache_for_session(&session).unwrap();

        // No tasks exist; a SQL-injection attempt in the status filter should
        // simply return zero rows (literal match against empty table), not panic
        // or return unexpected data.
        let filter = TaskFilter {
            status: Some("' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14 --".into()),
            tag: Some("'; DROP TABLE tasks; --".into()),
            due_before: Some("9999-99-99' OR '1'='1".into()),
            due_after: Some("0000-00-00' OR '1'='1".into()),
        };
        let result = query_tasks(&cache, &session.descriptor.id, &filter, 100);
        // Must succeed (no SQL syntax error from the injected fragments) and
        // return zero rows (no tasks in the vault, literal strings don't match).
        assert!(
            result.is_ok(),
            "query_tasks should not error on adversarial filter strings: {:?}",
            result.err()
        );
        assert_eq!(result.unwrap().len(), 0);
    }

    /// Schema v10 turned `tasks.source_note_id` into a foreign key on
    /// `notes(id)`.  Indexing with the vault-relative path instead of the
    /// canonical note id rolls the whole write transaction back with
    /// `FOREIGN KEY constraint failed` — the failure that took down the
    /// incremental index in the release smoke and the TUI smoke.
    #[test]
    fn task_sync_keys_on_the_canonical_note_id_and_mirrors_the_path() -> Result<(), IndexerError> {
        use crate::notes::upsert_note_on;
        use crate::open_cache_for_session;
        use scriptor_vault::{RelativeVaultPath, metadata_from_markdown, note_id, open_vault};
        use tempfile::tempdir;

        let dir = tempdir().expect("temp dir");
        let session = open_vault(dir.path()).expect("open vault");
        let cache = open_cache_for_session(&session)?;
        let relative = RelativeVaultPath::parse("notes/tasks.md")?;
        let markdown = "- [ ] Ship release 📅 2026-08-20\n";
        let metadata = metadata_from_markdown(
            &session.descriptor.id,
            &relative,
            markdown,
            "2026-08-01T00:00:00Z".to_string(),
        );

        {
            let mut conn = cache.connection()?;
            let tx = conn.transaction()?;
            upsert_note_on(&tx, &metadata, markdown)?;
            sync_note_tasks_from_markdown_on(&tx, &session.descriptor.id, &metadata.id, markdown)?;
            tx.commit()?;
        }

        let rows = query_tasks(&cache, &session.descriptor.id, &TaskFilter::default(), 20)?;
        assert_eq!(rows.len(), 1);
        assert_eq!(
            rows[0].source_note_id.as_deref(),
            Some(note_id(&session.descriptor.id, &relative).as_str())
        );
        assert_eq!(
            rows[0].source_note_path.as_deref(),
            Some("notes/tasks.md"),
            "the path must stay readable for navigation without decoding the note id"
        );

        // The bare path is not a note id: the foreign key has to refuse it
        // rather than let an orphan row through.
        let by_path = sync_note_tasks_from_markdown(
            &cache,
            &session.descriptor.id,
            "notes/tasks.md",
            markdown,
        );
        assert!(
            by_path.is_err(),
            "a vault-relative path must not satisfy the notes(id) foreign key"
        );
        Ok(())
    }
}
