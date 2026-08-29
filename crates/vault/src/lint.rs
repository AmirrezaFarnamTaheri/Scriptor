use std::collections::{BTreeMap, BTreeSet};
use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::link_rewrite::split_frontmatter;
use crate::note::read_note;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::scan::list_notes;
use crate::wikilink::{WikilinkIndex, WikilinkResolutionKind};
use crate::write::save_note;

static DEFINITION_LINE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\[([^\]]+)\]:\s*(.+)$").expect("valid definition regex"));
static WIKILINK_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]").expect("valid wikilink regex")
});

pub const RULE_MISSING_HEADING: &str = "missing-heading";
pub const RULE_STALE_DEFINITIONS: &str = "stale-definitions";

const ALL_RULES: [&str; 2] = [RULE_MISSING_HEADING, RULE_STALE_DEFINITIONS];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LintIssue {
    pub code: String,
    pub message: String,
    pub line: u32,
    pub column: u32,
    pub fixable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LintFileResult {
    pub path: String,
    pub issues: Vec<LintIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LintReport {
    pub files: Vec<LintFileResult>,
    pub total_issues: u32,
    pub fixable_issues: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LintApplyOutput {
    pub report: LintReport,
    pub files_fixed: u32,
    pub edits_applied: u32,
    pub fixed_paths: Vec<String>,
}

#[derive(Debug, Clone)]
struct TextEdit {
    line: usize,
    column: usize,
    end_line: usize,
    end_column: usize,
    new_text: String,
}

/// Normalizes and validates a list of lint rule names.
pub fn normalize_rule_filter(rules: &[String]) -> Result<Vec<String>, VaultError> {
    if rules.is_empty() {
        return Ok(ALL_RULES.iter().map(|rule| (*rule).to_string()).collect());
    }

    let mut active = Vec::new();
    for rule in rules {
        let normalized = rule.trim();
        if ALL_RULES.contains(&normalized) {
            if !active.iter().any(|existing| existing == normalized) {
                active.push(normalized.to_string());
            }
        } else {
            return Err(VaultError::InvalidConfig {
                message: format!(
                    "unknown lint rule \"{normalized}\"; valid rules: {}",
                    ALL_RULES.join(", ")
                ),
            });
        }
    }
    Ok(active)
}

/// Lints all notes in the vault, returning a report of issues found.
pub fn lint_vault(
    vault_id: &str,
    root: &VaultRoot,
    rules: &[String],
) -> Result<LintReport, VaultError> {
    let note_paths: Vec<String> = list_notes(root)?
        .into_iter()
        .map(|path| path.to_string())
        .collect();
    let mut files = Vec::new();

    for path in &note_paths {
        let relative = RelativeVaultPath::parse(path)?;
        let document = read_note(vault_id, root, &relative)?;
        let issues = lint_note_markdown(path, &document.markdown, &note_paths, rules);
        if !issues.is_empty() {
            files.push(LintFileResult {
                path: path.clone(),
                issues,
            });
        }
    }

    Ok(summarize_report(files))
}

pub fn lint_vault_fix(
    vault_id: &str,
    root: &VaultRoot,
    rules: &[String],
) -> Result<LintApplyOutput, VaultError> {
    let before = lint_vault(vault_id, root, rules)?;
    let note_paths: Vec<String> = list_notes(root)?
        .into_iter()
        .map(|path| path.to_string())
        .collect();

    let mut files_fixed = 0u32;
    let mut edits_applied = 0u32;
    let mut fixed_paths = Vec::new();

    for path in &note_paths {
        let relative = RelativeVaultPath::parse(path)?;
        let document = read_note(vault_id, root, &relative)?;
        let (updated, count) = apply_fixes(path, &document.markdown, &note_paths, rules)?;
        if count > 0 && updated != document.markdown {
            save_note(vault_id, root, &relative, &updated, None)?;
            files_fixed += 1;
            edits_applied += count;
            fixed_paths.push(path.clone());
        }
    }

    let after = lint_vault(vault_id, root, rules)?;
    let remaining_fixable = after.fixable_issues;
    Ok(LintApplyOutput {
        report: after,
        files_fixed,
        edits_applied: edits_applied.max(before.fixable_issues.saturating_sub(remaining_fixable)),
        fixed_paths,
    })
}

pub fn format_lint_text(report: &LintReport) -> String {
    if report.total_issues == 0 {
        return "No lint issues found.".to_string();
    }

    let mut lines = Vec::new();
    for file in &report.files {
        lines.push(file.path.clone());
        for issue in &file.issues {
            let fixable = if issue.fixable { " (fixable)" } else { "" };
            lines.push(format!(
                "  {}:{}  warning  {}{}  {}",
                issue.line, issue.column, issue.message, fixable, issue.code
            ));
        }
    }

    lines.push(String::new());
    lines.push(format!(
        "{} problem{} ({} fixable)",
        report.total_issues,
        if report.total_issues == 1 { "" } else { "s" },
        report.fixable_issues
    ));
    lines.join("\n")
}

fn summarize_report(files: Vec<LintFileResult>) -> LintReport {
    let total_issues = files.iter().map(|file| file.issues.len() as u32).sum();
    let fixable_issues = files
        .iter()
        .flat_map(|file| file.issues.iter())
        .filter(|issue| issue.fixable)
        .count() as u32;
    LintReport {
        files,
        total_issues,
        fixable_issues,
    }
}

fn lint_note_markdown(
    path: &str,
    markdown: &str,
    note_paths: &[String],
    rules: &[String],
) -> Vec<LintIssue> {
    let markdown = &crate::text::to_lf(markdown);
    let mut issues = Vec::new();
    for rule in rules {
        match rule.as_str() {
            RULE_MISSING_HEADING => issues.extend(check_missing_heading(path, markdown)),
            RULE_STALE_DEFINITIONS => issues.extend(check_stale_definitions(markdown, note_paths)),
            _ => {}
        }
    }
    issues
}

fn apply_fixes(
    path: &str,
    markdown: &str,
    note_paths: &[String],
    rules: &[String],
) -> Result<(String, u32), VaultError> {
    // Work on an LF-normalized copy and restore the document's own line-ending
    // style at the end, so fixing one line in a CRLF note does not rewrite every
    // line ending in the file.
    let style = crate::text::LineStyle::detect(markdown);
    let mut updated = crate::text::to_lf(markdown);
    let mut count = 0u32;

    for rule in rules {
        match rule.as_str() {
            RULE_MISSING_HEADING => {
                if let Some(edit) = missing_heading_edit(path, &updated) {
                    updated = apply_text_edits(&updated, &[edit]);
                    count += 1;
                }
            }
            RULE_STALE_DEFINITIONS => {
                if let Some(fixed) = rebuild_with_definitions(&updated, note_paths) {
                    updated = fixed;
                    count += 1;
                }
            }
            _ => {}
        }
    }

    Ok((style.restore(&updated), count))
}

fn check_missing_heading(path: &str, markdown: &str) -> Vec<LintIssue> {
    if missing_heading_edit(path, markdown).is_none() {
        return Vec::new();
    }

    let (frontmatter, _body) = split_frontmatter(markdown);
    let line = if frontmatter.is_some() {
        frontmatter
            .as_ref()
            .map(|fm| fm.lines().count())
            .unwrap_or(0)
            + 3
    } else {
        1
    };

    vec![LintIssue {
        code: RULE_MISSING_HEADING.into(),
        message: "Note is missing an h1 heading".into(),
        line: line as u32,
        column: 1,
        fixable: true,
    }]
}

fn missing_heading_edit(path: &str, markdown: &str) -> Option<TextEdit> {
    let (frontmatter, body) = split_frontmatter(markdown);
    if has_h1(&body) {
        return None;
    }

    let title = title_from_path(path);
    let insert_line = if let Some(fm) = &frontmatter {
        fm.lines().count() + 3
    } else {
        1
    };

    let body_lines: Vec<&str> = body.lines().collect();
    let blank_after_frontmatter = body_lines.first().is_some_and(|line| line.is_empty());
    let padding_start = if frontmatter.is_some() { "\n" } else { "" };
    let padding_end = if blank_after_frontmatter {
        "\n"
    } else {
        "\n\n"
    };
    let new_text = format!("{padding_start}# {title}{padding_end}");

    Some(TextEdit {
        line: insert_line.saturating_sub(1),
        column: 0,
        end_line: insert_line.saturating_sub(1),
        end_column: 0,
        new_text,
    })
}

fn check_stale_definitions(markdown: &str, note_paths: &[String]) -> Vec<LintIssue> {
    if rebuild_with_definitions(markdown, note_paths).is_none() {
        return Vec::new();
    }

    vec![LintIssue {
        code: RULE_STALE_DEFINITIONS.into(),
        message: "Wikilink reference definitions are missing or outdated".into(),
        line: markdown.lines().count().max(1) as u32,
        column: 1,
        fixable: true,
    }]
}

fn rebuild_with_definitions(markdown: &str, note_paths: &[String]) -> Option<String> {
    let split = split_body_and_definitions(markdown);
    let expected = expected_link_definitions(&split.body, note_paths);

    let desired: Vec<String> = expected
        .iter()
        .map(|(label, url)| format!("[{label}]: {url}"))
        .collect();

    // Hand-written definitions pass through verbatim and keep their original
    // order; only machine-managed ones (labels that a body wikilink points at)
    // are regenerated.
    let mut definitions = split.preserved;
    definitions.extend(desired);

    let mut output = split.body;
    if definitions.is_empty() {
        // No definition block at all: keep the body byte-for-byte, including any
        // trailing blank lines, and restore the document's final newline.
        if markdown.ends_with('\n') && !output.ends_with('\n') {
            output.push('\n');
        }
    } else {
        if !output.is_empty() {
            // A body that already ends in a newline carries the user's own
            // trailing blank lines; only add the single separator line.
            if output.ends_with('\n') {
                output.push('\n');
            } else {
                output.push_str("\n\n");
            }
        }
        output.push_str(&definitions.join("\n"));
        output.push('\n');
    }

    if output == markdown {
        return None;
    }

    Some(output)
}

#[derive(Debug, Clone, Default)]
struct DefinitionSplit {
    /// Everything above the trailing definition block, joined losslessly.
    body: String,
    /// Trailing definition lines that are not machine-managed, verbatim.
    preserved: Vec<String>,
}

fn split_body_and_definitions(markdown: &str) -> DefinitionSplit {
    let lines: Vec<&str> = crate::text::split_lines(markdown).collect();
    let mut definition_start = lines.len();

    for (index, line) in lines.iter().enumerate().rev() {
        if DEFINITION_LINE_RE.is_match(line) {
            definition_start = index;
        } else if !line.trim().is_empty() {
            break;
        }
    }

    let body = lines[..definition_start].join("\n");
    // A definition is machine-managed only when its label is the target of a
    // wikilink in the body. Anything else is the user's own reference
    // definition and must survive `lint --fix` untouched.
    let managed_labels = wikilink_labels(&body);

    let mut preserved = Vec::new();
    for line in &lines[definition_start..] {
        if line.trim().is_empty() {
            continue;
        }
        let is_managed = DEFINITION_LINE_RE
            .captures(line)
            .and_then(|capture| capture.get(1))
            .is_some_and(|label| managed_labels.contains(label.as_str().trim()));
        if !is_managed {
            preserved.push((*line).to_string());
        }
    }

    DefinitionSplit { body, preserved }
}

fn wikilink_labels(body: &str) -> BTreeSet<String> {
    WIKILINK_RE
        .captures_iter(body)
        .filter_map(|capture| capture.get(1))
        .map(|value| value.as_str().trim().to_string())
        .filter(|label| !label.is_empty())
        .collect()
}

fn expected_link_definitions(body: &str, note_paths: &[String]) -> BTreeMap<String, String> {
    let mut expected = BTreeMap::new();

    for capture in WIKILINK_RE.captures_iter(body) {
        let label = capture
            .get(1)
            .map(|value| value.as_str().trim())
            .unwrap_or("")
            .to_string();
        if label.is_empty() {
            continue;
        }
        let url = resolve_wikilink_url(&label, note_paths);
        expected.insert(label, url);
    }

    expected
}

fn resolve_wikilink_url(target: &str, note_paths: &[String]) -> String {
    let trimmed = target.trim();
    let resolution = WikilinkIndex::from_note_paths(note_paths).resolve(trimmed);
    if resolution.kind == WikilinkResolutionKind::Resolved {
        return resolution
            .path
            .unwrap_or_else(|| trimmed.to_string())
            .trim_end_matches(".md")
            .to_string();
    }

    // Keep ambiguous and unresolved identifiers verbatim. Picking an arbitrary
    // candidate while lint-fixing would manufacture a semantically incorrect
    // Markdown definition.
    trimmed.trim_end_matches(".md").to_string()
}

fn has_h1(body: &str) -> bool {
    body.lines().any(|line| {
        let trimmed = line.trim();
        trimmed.starts_with("# ") && !trimmed.starts_with("## ")
    })
}

fn title_from_path(path: &str) -> String {
    path.trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .to_string()
}

fn apply_text_edits(markdown: &str, edits: &[TextEdit]) -> String {
    if edits.is_empty() {
        return markdown.to_string();
    }

    let mut sorted = edits.to_vec();
    sorted.sort_by(|left, right| {
        right
            .line
            .cmp(&left.line)
            .then(right.column.cmp(&left.column))
    });

    let mut lines: Vec<String> = crate::text::split_lines(markdown)
        .map(str::to_string)
        .collect();
    let had_trailing_newline = markdown.ends_with('\n');

    for edit in sorted {
        if edit.line >= lines.len() {
            lines.push(String::new());
        }
        if edit.line == edit.end_line && edit.column == edit.end_column {
            let line = lines.get_mut(edit.line).expect("line exists");
            let safe_column = edit.column.min(line.len());
            line.insert_str(safe_column, &edit.new_text);
            continue;
        }

        let prefix = lines[..edit.line].join("\n");
        let suffix = if edit.end_line < lines.len() {
            lines[edit.end_line..].join("\n")
        } else {
            String::new()
        };
        let mut merged = prefix;
        if !merged.is_empty() && !edit.new_text.is_empty() {
            merged.push('\n');
        }
        merged.push_str(&edit.new_text);
        if !suffix.is_empty() {
            if !merged.is_empty() {
                merged.push('\n');
            }
            merged.push_str(&suffix);
        }
        lines = crate::text::split_lines(&merged)
            .map(str::to_string)
            .collect();
    }

    let mut output = lines.join("\n");
    if had_trailing_newline && !output.ends_with('\n') {
        output.push('\n');
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::open::open_vault;
    use tempfile::tempdir;

    #[test]
    fn missing_heading_fix_inserts_title() {
        let input = "No heading here.\n";
        let (updated, count) =
            apply_fixes("note.md", input, &[], &[RULE_MISSING_HEADING.to_string()]).expect("apply");
        assert_eq!(count, 1);
        assert!(updated.starts_with("# note\n\nNo heading here."));
    }

    #[test]
    fn missing_heading_fix_inserts_after_frontmatter() {
        let input = "---\nnoTitle: true\n---\n";
        let (updated, count) =
            apply_fixes("note.md", input, &[], &[RULE_MISSING_HEADING.to_string()]).expect("apply");
        assert_eq!(count, 1);
        assert!(updated.contains("---\nnoTitle: true\n---\n\n# note\n"));
    }

    #[test]
    fn stale_definitions_adds_reference_lines() {
        let note_paths = vec!["other.md".to_string()];
        let input = "# Note\n\n[[other]]\n";
        let (updated, count) = apply_fixes(
            "note.md",
            input,
            &note_paths,
            &[RULE_STALE_DEFINITIONS.to_string()],
        )
        .expect("apply");
        assert_eq!(count, 1);
        assert!(updated.contains("[other]: other"));
    }

    #[test]
    fn stale_definitions_preserves_hand_written_definitions() {
        let note_paths = vec!["other.md".to_string()];
        let input = "# Note\n\nSee [[other]].\n\n[spec]: ./design/spec.pdf\n";
        let (updated, _) = apply_fixes(
            "note.md",
            input,
            &note_paths,
            &[RULE_STALE_DEFINITIONS.to_string()],
        )
        .expect("apply");
        assert!(
            updated.contains("[spec]: ./design/spec.pdf"),
            "hand-written definition was deleted: {updated:?}"
        );
        assert!(updated.contains("[other]: other"));
    }

    #[test]
    fn stale_definitions_leaves_a_note_with_only_hand_written_definitions_alone() {
        let input = "# Note\n\nNo wikilinks.\n\n[spec]: ./design/spec.pdf\n[rfc]: https://example.com/rfc\n";
        assert!(rebuild_with_definitions(input, &[]).is_none());
        let (updated, count) =
            apply_fixes("note.md", input, &[], &[RULE_STALE_DEFINITIONS.to_string()])
                .expect("apply");
        assert_eq!(count, 0);
        assert_eq!(updated, input);
    }

    #[test]
    fn stale_definitions_does_not_flag_a_clean_note() {
        let note_paths = vec!["other.md".to_string()];
        let input = "# Note\n\nSee [[other]].\n\n[spec]: ./design/spec.pdf\n[other]: other\n";
        assert!(rebuild_with_definitions(input, &note_paths).is_none());
    }

    #[test]
    fn stale_definitions_preserves_trailing_blank_lines() {
        let note_paths = vec!["other.md".to_string()];
        let input = "# Note\n\nSee [[other]].\n\n\n[other]: stale\n";
        let (updated, _) = apply_fixes(
            "note.md",
            input,
            &note_paths,
            &[RULE_STALE_DEFINITIONS.to_string()],
        )
        .expect("apply");
        assert_eq!(updated, "# Note\n\nSee [[other]].\n\n\n[other]: other\n");
    }

    #[test]
    fn fixes_preserve_crlf_line_endings() {
        let input = "Body only\r\n";
        let (updated, count) =
            apply_fixes("note.md", input, &[], &[RULE_MISSING_HEADING.to_string()]).expect("apply");
        assert_eq!(count, 1);
        assert_eq!(updated, "# note\r\n\r\nBody only\r\n");
        assert!(
            !updated.contains("\r\r"),
            "mangled line endings: {updated:?}"
        );
    }

    #[test]
    fn crlf_note_without_issues_round_trips() {
        let note_paths = vec!["other.md".to_string()];
        let input = "# Note\r\n\r\nSee [[other]].\r\n\r\n[other]: other\r\n";
        let (updated, _) = apply_fixes(
            "note.md",
            input,
            &note_paths,
            &[RULE_STALE_DEFINITIONS.to_string()],
        )
        .expect("apply");
        assert_eq!(updated, input);
    }

    #[test]
    fn lint_vault_fix_keeps_hand_written_definitions_on_disk() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("other.md"), "# Other\n").expect("write");
        std::fs::write(
            dir.path().join("note.md"),
            "# Note\n\nSee [[other]].\n\n[spec]: ./design/spec.pdf\n",
        )
        .expect("write");

        let session = open_vault(dir.path()).expect("open");
        lint_vault_fix(
            &session.descriptor.id,
            &session.root,
            &[RULE_STALE_DEFINITIONS.to_string()],
        )
        .expect("fix");

        let updated = std::fs::read_to_string(dir.path().join("note.md")).expect("read");
        assert!(
            updated.contains("[spec]: ./design/spec.pdf"),
            "lint --fix deleted a hand-written definition: {updated:?}"
        );
    }

    #[test]
    fn lint_vault_reports_missing_heading() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("note.md"), "Body only\n").expect("write");
        let session = open_vault(dir.path()).expect("open");
        let report = lint_vault(
            &session.descriptor.id,
            &session.root,
            &[RULE_MISSING_HEADING.to_string()],
        )
        .expect("lint");
        assert_eq!(report.total_issues, 1);
        assert_eq!(report.files[0].issues[0].code, RULE_MISSING_HEADING);
    }

    #[test]
    fn lint_vault_fix_clears_issues() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("note.md"), "Body only\n").expect("write");
        let session = open_vault(dir.path()).expect("open");
        let output = lint_vault_fix(
            &session.descriptor.id,
            &session.root,
            &[RULE_MISSING_HEADING.to_string()],
        )
        .expect("fix");
        assert_eq!(output.files_fixed, 1);
        assert_eq!(output.report.total_issues, 0);
    }
}
