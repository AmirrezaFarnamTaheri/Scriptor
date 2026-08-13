/*!
 * kanban.rs — W4-7 Kanban board parser for the obsidian-kanban file format.
 *
 * ## Format
 *
 * An obsidian-kanban file is a Markdown file with a special frontmatter tag
 * (`kanban-plugin: basic`) and columns defined as level-2 headings, with
 * tasks as list items underneath.  Completed items appear in a column whose
 * heading matches `## Archive` or ends with ` Done` or ` Complete`.
 *
 * ### Example
 *
 * ```markdown
 * ---
 * kanban-plugin: basic
 * ---
 *
 * ## Backlog
 *
 * - [ ] Idea A
 * - [ ] Idea B
 *
 * ## In Progress
 *
 * - [/] Feature X
 *
 * ## Done
 *
 * - [x] Released v1
 * ```
 *
 * ## Single definition rule (I-5)
 *
 * This is the one kanban parser for Scriptor.  The React layer renders the
 * parsed `KanbanBoard` it receives; it does not re-parse.
 */

use serde::{Deserialize, Serialize};

use crate::error::IndexerError;

// ── Public types ──────────────────────────────────────────────────────────────

/// A column in a kanban board.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KanbanColumn {
    pub name: String,
    /// Raw card texts (markdown list item body, checkbox stripped).
    pub cards: Vec<KanbanCard>,
}

/// A single card on the kanban board.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KanbanCard {
    /// Card text with checkboxes, dates, and tags preserved.
    pub text: String,
    /// Status character from the checkbox: ` `, `x`, `-`, `>`, `/`, or custom.
    pub status: String,
    /// 0-based line number in the source file.
    pub line: usize,
    /// Whether this card is in an archive/done column.
    pub archived: bool,
}

/// Parsed kanban board for a single file.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KanbanBoard {
    /// Vault-relative path of the source file.
    pub source_path: String,
    pub columns: Vec<KanbanColumn>,
}

// ── Parser ────────────────────────────────────────────────────────────────────

/// Parse a kanban board from the raw markdown content of a vault file.
///
/// Returns `None` if the file is not a kanban board (no `kanban-plugin`
/// frontmatter key).
pub fn parse_kanban(source_path: &str, markdown: &str) -> Option<KanbanBoard> {
    if !is_kanban_file(markdown) {
        return None;
    }

    let mut columns: Vec<KanbanColumn> = Vec::new();
    let mut current_column: Option<(String, bool)> = None; // (name, is_archive)
    let mut current_cards: Vec<KanbanCard> = Vec::new();

    for (line_idx, line) in markdown.lines().enumerate() {
        // Skip YAML frontmatter (between --- markers, first block only).
        // We do this lazily: frontmatter lines don't start with `## ` or `- [`.

        if let Some(col_name) = line.strip_prefix("## ") {
            // Flush previous column.
            if let Some((name, is_archive)) = current_column.take() {
                push_column(
                    &mut columns,
                    name,
                    is_archive,
                    current_cards.drain(..).collect(),
                );
            }
            let trimmed = col_name.trim().to_string();
            let is_archive = is_archive_column(&trimmed);
            current_column = Some((trimmed, is_archive));
            continue;
        }

        if let Some((_, is_archive)) = &current_column {
            if let Some(card) = parse_card_line(line, line_idx, *is_archive) {
                current_cards.push(card);
            }
        }
    }

    // Flush last column.
    if let Some((name, is_archive)) = current_column {
        push_column(&mut columns, name, is_archive, current_cards);
    }

    if columns.is_empty() {
        return None;
    }

    Some(KanbanBoard {
        source_path: source_path.to_string(),
        columns,
    })
}

// ── Validation helper ─────────────────────────────────────────────────────────

/// Validate that a string value would be a valid column name (non-empty, ≤120 chars).
pub fn validate_board(board: &KanbanBoard) -> Result<(), IndexerError> {
    for col in &board.columns {
        if col.name.is_empty() || col.name.len() > 120 {
            return Err(IndexerError::InvalidQuery(format!(
                "kanban column name invalid: {:?}",
                col.name
            )));
        }
    }
    Ok(())
}

/// Relocate a card line to another kanban column and patch its checkbox status.
///
/// The move preserves the full markdown list item, inserting it immediately
/// before the destination column's next `##` heading (or EOF).
pub fn move_card_in_markdown(
    markdown: &str,
    line: usize,
    destination_column: &str,
    new_status: char,
) -> Result<String, IndexerError> {
    let board = parse_kanban("kanban.md", markdown).ok_or_else(|| {
        IndexerError::InvalidQuery("source markdown is not an obsidian-kanban file".to_string())
    })?;
    let ranges = column_ranges(markdown);
    let Some(source_column) = board
        .columns
        .iter()
        .find(|column| column.cards.iter().any(|card| card.line == line))
    else {
        return Err(IndexerError::InvalidQuery(format!(
            "kanban card at line {line} was not found"
        )));
    };
    if source_column.name == destination_column {
        return Err(IndexerError::InvalidQuery(format!(
            "kanban card at line {line} is already in column {destination_column:?}"
        )));
    }

    let destination_range = ranges
        .iter()
        .find(|range| range.name == destination_column)
        .ok_or_else(|| {
            IndexerError::InvalidQuery(format!(
                "kanban destination column {:?} was not found",
                destination_column
            ))
        })?;

    let mut lines: Vec<String> = markdown.lines().map(str::to_owned).collect();
    let original_line = lines
        .get(line)
        .ok_or_else(|| IndexerError::InvalidQuery(format!("kanban line {line} is out of range")))?;
    let patched_line = patch_checkbox_char(original_line, new_status).ok_or_else(|| {
        IndexerError::InvalidQuery(format!(
            "kanban card at line {line} no longer contains a checkbox"
        ))
    })?;
    let card_block_end = find_card_block_end(&lines, line);
    let block_len = card_block_end - line;
    let mut card_block: Vec<String> = lines.drain(line..card_block_end).collect();
    card_block[0] = patched_line;

    let mut insertion_index = destination_range.end_line;
    if line < insertion_index {
        insertion_index = insertion_index.saturating_sub(block_len);
    }
    lines.splice(
        insertion_index.min(lines.len())..insertion_index.min(lines.len()),
        card_block,
    );

    let mut rewritten = lines.join("\n");
    if markdown.ends_with('\n') {
        rewritten.push('\n');
    }
    let _ = source_column;
    Ok(rewritten)
}

// ── Private helpers ───────────────────────────────────────────────────────────

fn is_kanban_file(markdown: &str) -> bool {
    // Must contain `kanban-plugin:` inside the first 2 048 bytes.
    let head = &markdown[..markdown.len().min(2048)];
    head.contains("kanban-plugin:")
}

fn is_archive_column(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower == "archive"
        || lower == "done"
        || lower == "complete"
        || lower.ends_with(" done")
        || lower.ends_with(" complete")
        || lower.ends_with(" archive")
}

fn parse_card_line(line: &str, line_idx: usize, archived: bool) -> Option<KanbanCard> {
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
    let status = rest[1..close].trim().to_string();
    let text = rest[close + 1..].trim_start_matches(' ').to_string();

    Some(KanbanCard {
        text,
        status,
        line: line_idx,
        archived,
    })
}

fn push_column(
    columns: &mut Vec<KanbanColumn>,
    name: String,
    is_archive: bool,
    cards: Vec<KanbanCard>,
) {
    columns.push(KanbanColumn { name, cards });
    let _ = is_archive; // `archived` flag is set per-card above; column-level flag unused here.
}

struct ColumnRange {
    name: String,
    end_line: usize,
}

fn column_ranges(markdown: &str) -> Vec<ColumnRange> {
    let lines: Vec<&str> = markdown.lines().collect();
    let headings: Vec<(String, usize)> = lines
        .iter()
        .enumerate()
        .filter_map(|(index, line)| line.strip_prefix("## ").map(|name| (name.trim().to_string(), index)))
        .collect();

    headings
        .iter()
        .enumerate()
        .map(|(index, (name, _heading_line))| ColumnRange {
            name: name.clone(),
            end_line: headings
                .get(index + 1)
                .map(|(_, line)| *line)
                .unwrap_or(lines.len()),
        })
        .collect()
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

fn find_card_block_end(lines: &[String], start_line: usize) -> usize {
    let source_indent = leading_indent_width(&lines[start_line]);

    for (index, line) in lines.iter().enumerate().skip(start_line + 1) {
        if line.starts_with("## ") {
            return index;
        }

        if is_card_line(line) && leading_indent_width(line) <= source_indent {
            return index;
        }
    }

    lines.len()
}

fn leading_indent_width(line: &str) -> usize {
    line.len() - line.trim_start().len()
}

fn is_card_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    let Some(rest) = trimmed
        .strip_prefix("- ")
        .or_else(|| trimmed.strip_prefix("* "))
        .or_else(|| trimmed.strip_prefix("+ "))
    else {
        return false;
    };

    rest.starts_with('[') && rest.find(']').is_some_and(|close| close >= 2)
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"---
kanban-plugin: basic
---

## Backlog

- [ ] Item A
- [ ] Item B

## In Progress

- [/] Feature X #work

## Done

- [x] Released v1
"#;

    #[test]
    fn parse_sample_board() {
        let board = parse_kanban("boards/project.md", SAMPLE).unwrap();
        assert_eq!(board.columns.len(), 3);
        assert_eq!(board.columns[0].name, "Backlog");
        assert_eq!(board.columns[0].cards.len(), 2);
        assert_eq!(board.columns[1].name, "In Progress");
        assert_eq!(board.columns[2].name, "Done");
    }

    #[test]
    fn cards_in_done_column_are_archived() {
        let board = parse_kanban("boards/project.md", SAMPLE).unwrap();
        let done_col = &board.columns[2];
        assert!(done_col.cards.iter().all(|c| c.archived));
    }

    #[test]
    fn cards_in_backlog_not_archived() {
        let board = parse_kanban("boards/project.md", SAMPLE).unwrap();
        assert!(board.columns[0].cards.iter().all(|c| !c.archived));
    }

    #[test]
    fn non_kanban_file_returns_none() {
        let md = "# Just a regular note\n\n- [ ] Not a kanban";
        assert!(parse_kanban("notes/regular.md", md).is_none());
    }

    #[test]
    fn parse_statuses_on_cards() {
        let board = parse_kanban("boards/project.md", SAMPLE).unwrap();
        assert_eq!(board.columns[1].cards[0].status, "/");
        assert_eq!(board.columns[2].cards[0].status, "x");
    }

    #[test]
    fn card_line_numbers_are_set() {
        let board = parse_kanban("boards/project.md", SAMPLE).unwrap();
        // "Item A" is on line 6 (0-based).
        assert_eq!(board.columns[0].cards[0].line, 6);
    }

    #[test]
    fn archive_column_variants() {
        let cases = [
            "Archive",
            "Done",
            "Complete",
            "Shipped Done",
            "Team Complete",
        ];
        for name in cases {
            assert!(is_archive_column(name), "{name} should be archive");
        }
        assert!(!is_archive_column("Backlog"));
        assert!(!is_archive_column("In Progress"));
    }

    #[test]
    fn move_card_relocates_full_line_to_destination_column() {
        let rewritten = move_card_in_markdown(SAMPLE, 6, "Done", 'x').unwrap();
        let expected = r#"---
kanban-plugin: basic
---

## Backlog

- [ ] Item B

## In Progress

- [/] Feature X #work

## Done

- [x] Released v1
- [x] Item A
"#;
        assert_eq!(rewritten, expected);
    }

    #[test]
    fn move_card_rejects_unknown_destination_column() {
        let error = move_card_in_markdown(SAMPLE, 6, "Review", 'x').unwrap_err();
        assert!(error
            .to_string()
            .contains("destination column \"Review\" was not found"));
    }

    #[test]
    fn move_card_relocates_indented_card_block_to_destination_column() {
        let markdown = r#"---
kanban-plugin: basic
---

## Backlog

- [ ] Parent task
  due:: 2026-08-20
  - [ ] Subtask A
  - [ ] Subtask B

- [ ] Sibling task

## Done

- [x] Released v1
"#;

        let rewritten = move_card_in_markdown(markdown, 6, "Done", 'x').unwrap();
        let expected = r#"---
kanban-plugin: basic
---

## Backlog

- [ ] Sibling task

## Done

- [x] Released v1
- [x] Parent task
  due:: 2026-08-20
  - [ ] Subtask A
  - [ ] Subtask B

"#;

        assert_eq!(rewritten, expected);
    }
}
