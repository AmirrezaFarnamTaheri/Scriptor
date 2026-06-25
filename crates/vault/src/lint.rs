use std::collections::BTreeMap;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::link_rewrite::split_frontmatter;
use crate::note::read_note;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::scan::list_notes;
use crate::write::save_note;

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
    let mut updated = markdown.to_string();
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

    Ok((updated, count))
}

fn check_missing_heading(path: &str, markdown: &str) -> Vec<LintIssue> {
    if missing_heading_edit(path, markdown).is_none() {
        return Vec::new();
    }

    let (frontmatter, _body) = split_frontmatter(markdown);
    let line = if frontmatter.is_some() {
        frontmatter.as_ref().map(|fm| fm.lines().count()).unwrap_or(0) + 3
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
    let padding_end = if blank_after_frontmatter { "\n" } else { "\n\n" };
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
    let expected = expected_link_definitions(markdown, note_paths);
    let (body, existing) = split_body_and_definitions(markdown);
    let mut target = BTreeMap::new();

    for (label, url) in expected {
        target.insert(label, url);
    }
    for (label, range) in &existing {
        if range.url.contains("://") {
            target.entry(label.clone()).or_insert_with(|| range.url.clone());
        }
    }

    let current: Vec<String> = existing
        .iter()
        .map(|(label, range)| format!("[{label}]: {}", range.url))
        .collect();
    let desired: Vec<String> = target
        .iter()
        .map(|(label, url)| format!("[{label}]: {url}"))
        .collect();

    if current == desired {
        return None;
    }

    let mut output = body.trim_end().to_string();
    if !desired.is_empty() {
        if !output.is_empty() {
            output.push_str("\n\n");
        }
        output.push_str(&desired.join("\n"));
        output.push('\n');
    } else if markdown.ends_with('\n') && !output.ends_with('\n') {
        output.push('\n');
    }

    if output == markdown {
        return None;
    }

    Some(output)
}

#[derive(Debug, Clone)]
struct DefinitionRange {
    url: String,
}

fn split_body_and_definitions(markdown: &str) -> (String, BTreeMap<String, DefinitionRange>) {
    let definition_line =
        Regex::new(r"^\[([^\]]+)\]:\s*(.+)$").expect("valid definition regex");
    let lines: Vec<&str> = markdown.lines().collect();
    let mut definition_start = lines.len();
    let mut existing = BTreeMap::new();

    for (index, line) in lines.iter().enumerate().rev() {
        if let Some(capture) = definition_line.captures(line) {
            let label = capture.get(1).map(|value| value.as_str()).unwrap_or("").to_string();
            let url = capture.get(2).map(|value| value.as_str()).unwrap_or("").trim().to_string();
            existing.insert(label, DefinitionRange { url });
            definition_start = index;
        } else if !line.trim().is_empty() {
            break;
        }
    }

    let body = lines[..definition_start].join("\n");
    (body, existing)
}

fn expected_link_definitions(markdown: &str, note_paths: &[String]) -> BTreeMap<String, String> {
    let wikilink = Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]").expect("valid wikilink regex");
    let (body, _) = split_body_and_definitions(markdown);
    let mut expected = BTreeMap::new();

    for capture in wikilink.captures_iter(&body) {
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
    if note_paths.iter().any(|path| path == trimmed) {
        return trimmed.trim_end_matches(".md").to_string();
    }

    for path in note_paths {
        let stem = path.trim_end_matches(".md");
        let basename = stem.rsplit('/').next().unwrap_or(stem);
        if basename.eq_ignore_ascii_case(trimmed) || stem.eq_ignore_ascii_case(trimmed) {
            return stem.to_string();
        }
    }

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

    let mut lines: Vec<String> = markdown.lines().map(str::to_string).collect();
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
        lines = merged.lines().map(str::to_string).collect();
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
