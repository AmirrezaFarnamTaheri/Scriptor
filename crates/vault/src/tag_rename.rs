use std::collections::BTreeSet;
use std::sync::LazyLock;

use regex::Regex;

use crate::error::VaultError;
use crate::link_rewrite::{
    LinkRewriteApplyOutput, LinkRewritePreview, join_frontmatter, split_frontmatter,
};
use crate::note::read_note;
use crate::path::VaultRoot;
use crate::scan::list_notes;
use crate::write::save_note;

static VALID_TAG_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_/-]+$").expect("valid tag label regex"));
static HASHTAG_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"#([A-Za-z0-9_/-]+)").expect("valid hashtag regex"));

fn normalize_tag_label(label: &str) -> Result<String, VaultError> {
    let clean = label.trim().trim_start_matches('#');
    if clean.is_empty() {
        return Err(VaultError::InvalidConfig {
            message: "tag label cannot be empty".into(),
        });
    }

    if !VALID_TAG_RE.is_match(clean) {
        return Err(VaultError::InvalidConfig {
            message: format!("invalid tag label: {clean}"),
        });
    }

    Ok(clean.to_string())
}

fn tag_should_rewrite(tag: &str, old_root: &str) -> bool {
    tag == old_root || tag.starts_with(&format!("{old_root}/"))
}

fn remap_tag(tag: &str, old_root: &str, new_root: &str) -> String {
    if tag == old_root {
        return new_root.to_string();
    }
    if let Some(suffix) = tag.strip_prefix(&format!("{old_root}/")) {
        return format!("{new_root}/{suffix}");
    }
    tag.to_string()
}

fn rewrite_hashtag_line(line: &str, old_root: &str, new_root: &str, edits: &mut u32) -> String {
    HASHTAG_RE
        .replace_all(line, |capture: &regex::Captures| {
            let tag = capture.get(1).map(|value| value.as_str()).unwrap_or("");
            if !tag_should_rewrite(tag, old_root) {
                return capture.get(0).unwrap().as_str().to_string();
            }
            *edits += 1;
            format!("#{}", remap_tag(tag, old_root, new_root))
        })
        .into_owned()
}

/// Splits a frontmatter line into `(key, value)` when it looks like a YAML
/// mapping entry. Anything else (comments, list items, continuations) is `None`.
fn split_yaml_key(trimmed: &str) -> Option<(&str, &str)> {
    if trimmed.starts_with('#') {
        return None;
    }
    let (key, value) = trimmed.split_once(':')?;
    let key = key.trim();
    if key.is_empty()
        || !key
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.' | ' '))
    {
        return None;
    }
    Some((key, value))
}

/// Rewrites one scalar tag entry, preserving any surrounding YAML quoting.
fn rewrite_tag_scalar(item: &str, old_root: &str, new_root: &str, edits: &mut u32) -> String {
    let trimmed = item.trim();
    let (quote, inner) = if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"')
    {
        ("\"", &trimmed[1..trimmed.len() - 1])
    } else if trimmed.len() >= 2 && trimmed.starts_with('\'') && trimmed.ends_with('\'') {
        ("'", &trimmed[1..trimmed.len() - 1])
    } else {
        ("", trimmed)
    };

    let value = inner.trim();
    if value.is_empty() || !tag_should_rewrite(value, old_root) {
        return trimmed.to_string();
    }
    *edits += 1;
    format!("{quote}{}{quote}", remap_tag(value, old_root, new_root))
}

fn rewrite_tag_value_list(values: &str, old_root: &str, new_root: &str, edits: &mut u32) -> String {
    values
        .split(',')
        .filter(|item| !item.trim().is_empty())
        .map(|item| rewrite_tag_scalar(item, old_root, new_root, edits))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Rewrites tags inside YAML frontmatter, scoped to the `tags` key.
///
/// Two things matter here. First, a `- item` line only belongs to `tags` when
/// the most recent mapping key was `tags`; treating every list item as a tag
/// corrupted unrelated keys such as `aliases`. Second, the inline flow form
/// `tags: [a, b]` is the most common Obsidian syntax and has to be handled
/// explicitly — splitting it on commas alone yields `"[a"` / `"b]"`, which
/// matches nothing.
///
/// This is a line-scoped parse rather than a full YAML parse: the crate has no
/// YAML dependency, and a rewrite that preserves the user's exact formatting is
/// worth more here than round-tripping through a document model.
fn rewrite_frontmatter_tags(
    frontmatter: &str,
    old_root: &str,
    new_root: &str,
    edits: &mut u32,
) -> String {
    let mut current_key: Option<String> = None;

    crate::text::split_lines(frontmatter)
        .map(|line| {
            let trimmed = line.trim_start();
            let indent = &line[..line.len() - trimmed.len()];

            if let Some(item) = trimmed.strip_prefix("- ") {
                if current_key.as_deref() == Some("tags") {
                    let value = rewrite_tag_scalar(item, old_root, new_root, edits);
                    return format!("{indent}- {value}");
                }
                return line.to_string();
            }

            let Some((key, value)) = split_yaml_key(trimmed) else {
                return line.to_string();
            };
            current_key = Some(key.to_string());

            if key != "tags" {
                return line.to_string();
            }

            let value = value.trim();
            if value.is_empty() {
                // A block list follows on the next lines.
                return line.to_string();
            }

            if let Some(inner) = value
                .strip_prefix('[')
                .and_then(|rest| rest.strip_suffix(']'))
            {
                let remapped = rewrite_tag_value_list(inner, old_root, new_root, edits);
                return format!("{indent}{key}: [{remapped}]");
            }

            let remapped = rewrite_tag_value_list(value, old_root, new_root, edits);
            format!("{indent}{key}: {remapped}")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn rewrite_tags_in_markdown(old_tag: &str, new_tag: &str, markdown: &str) -> (String, u32) {
    // Normalize to LF, rewrite, then put the document's own line endings back;
    // otherwise a one-tag rename rewrites every line ending in a CRLF note.
    let style = crate::text::LineStyle::detect(markdown);
    let normalized = crate::text::to_lf(markdown);

    let mut edits = 0u32;
    let (frontmatter, body) = split_frontmatter(&normalized);
    let rewritten_body = crate::text::split_lines(&body)
        .map(|line| rewrite_hashtag_line(line, old_tag, new_tag, &mut edits))
        .collect::<Vec<_>>()
        .join("\n");
    let rewritten_frontmatter = frontmatter
        .as_deref()
        .map(|value| rewrite_frontmatter_tags(value, old_tag, new_tag, &mut edits));
    (
        style.restore(&join_frontmatter(
            rewritten_frontmatter.as_deref(),
            &rewritten_body,
        )),
        edits,
    )
}

pub fn tag_rename_dry_run(
    vault_id: &str,
    root: &VaultRoot,
    old_tag: &str,
    new_tag: &str,
) -> Result<LinkRewritePreview, VaultError> {
    let old_label = normalize_tag_label(old_tag)?;
    let new_label = normalize_tag_label(new_tag)?;

    if old_label == new_label {
        return Err(VaultError::RenameNoop);
    }

    let mut affected = BTreeSet::new();
    let mut edits = 0u32;
    let mut warnings = Vec::new();

    for note_path in list_notes(root)? {
        let document = read_note(vault_id, root, &note_path)?;
        let (_, count) = rewrite_tags_in_markdown(&old_label, &new_label, &document.markdown);
        if count > 0 {
            affected.insert(note_path.to_string());
            edits += count;
        }
    }

    if affected.is_empty() {
        warnings.push(format!("Tag \"{old_label}\" was not found in the vault."));
    }

    Ok(LinkRewritePreview {
        affected_files: affected.into_iter().collect(),
        edits,
        warnings,
    })
}

pub fn tag_rename_apply(
    vault_id: &str,
    root: &VaultRoot,
    old_tag: &str,
    new_tag: &str,
) -> Result<LinkRewriteApplyOutput, VaultError> {
    let old_label = normalize_tag_label(old_tag)?;
    let new_label = normalize_tag_label(new_tag)?;
    let preview = tag_rename_dry_run(vault_id, root, &old_label, &new_label)?;

    for note_path in list_notes(root)? {
        let document = read_note(vault_id, root, &note_path)?;
        let (updated, count) = rewrite_tags_in_markdown(&old_label, &new_label, &document.markdown);
        if count > 0 {
            save_note(vault_id, root, &note_path, &updated, None)?;
        }
    }

    Ok(LinkRewriteApplyOutput {
        affected_files: preview.affected_files,
        edits: preview.edits,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::open::open_vault;
    use crate::path::RelativeVaultPath;
    use tempfile::tempdir;

    #[test]
    fn rewrites_hashtags_and_hierarchical_children() {
        let input = "# Title\n\nBody #project and #project/frontend.\n";
        let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
        assert!(updated.contains("#archive and #archive/frontend"));
        assert_eq!(edits, 2);
    }

    #[test]
    fn rewrites_frontmatter_tag_list() {
        let input = "---\ntags:\n  - project/foo\n  - other\n---\n\n# Body\n";
        let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
        assert!(updated.contains("  - archive/foo"));
        assert!(updated.contains("  - other"));
        assert_eq!(edits, 1);
    }

    #[test]
    fn does_not_rewrite_list_items_under_other_keys() {
        let input =
            "---\naliases:\n  - project\n  - project/alpha\ntitle: Something\n---\n\n# Body\n";
        let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
        assert_eq!(edits, 0, "aliases must not be treated as tags");
        assert_eq!(updated, input);
    }

    #[test]
    fn rewrites_only_the_tags_key_when_both_are_present() {
        let input =
            "---\naliases:\n  - project\ntags:\n  - project\n  - project/alpha\n---\n\n# Body\n";
        let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
        assert_eq!(edits, 2);
        assert!(updated.contains("aliases:\n  - project\n"));
        assert!(updated.contains("tags:\n  - archive\n  - archive/alpha\n"));
    }

    #[test]
    fn rewrites_inline_flow_tag_list() {
        let input = "---\ntags: [project, other, project/alpha]\n---\n\n# Body\n";
        let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
        assert_eq!(edits, 2);
        assert!(
            updated.contains("tags: [archive, other, archive/alpha]"),
            "unexpected output: {updated}"
        );
    }

    #[test]
    fn rewrites_quoted_inline_flow_tag_list() {
        let input = "---\ntags: [\"project\", 'project/alpha', other]\n---\n";
        let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
        assert_eq!(edits, 2);
        assert!(
            updated.contains("tags: [\"archive\", 'archive/alpha', other]"),
            "unexpected output: {updated}"
        );
    }

    #[test]
    fn inline_flow_tags_are_reported_by_dry_run_and_apply() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(
            dir.path().join("note.md"),
            "---\ntags: [project, keep]\n---\n\n# Note\n",
        )
        .expect("write note");

        let session = open_vault(dir.path()).expect("open vault");
        let preview =
            tag_rename_dry_run(&session.descriptor.id, &session.root, "project", "archive")
                .expect("dry run");
        assert_eq!(preview.edits, 1);
        assert_eq!(preview.affected_files, vec!["note.md".to_string()]);

        tag_rename_apply(&session.descriptor.id, &session.root, "project", "archive")
            .expect("apply");
        let updated = std::fs::read_to_string(dir.path().join("note.md")).expect("read");
        assert!(updated.contains("tags: [archive, keep]"), "got: {updated}");
    }

    #[test]
    fn preserves_crlf_line_endings_and_trailing_newline() {
        let input = "# Title\r\n\r\nBody #project here.\r\n";
        let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
        assert_eq!(edits, 1);
        assert_eq!(updated, "# Title\r\n\r\nBody #archive here.\r\n");
    }

    #[test]
    fn preserves_crlf_in_frontmatter_tags() {
        let input = "---\r\ntags:\r\n  - project\r\n---\r\n\r\n# Body\r\n";
        let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
        assert_eq!(edits, 1);
        assert_eq!(
            updated,
            "---\r\ntags:\r\n  - archive\r\n---\r\n\r\n# Body\r\n"
        );
    }

    #[test]
    fn preserves_absence_of_trailing_newline() {
        let input = "# Title\n\nBody #project";
        let (updated, _) = rewrite_tags_in_markdown("project", "archive", input);
        assert_eq!(updated, "# Title\n\nBody #archive");
    }

    #[test]
    fn untouched_note_round_trips_byte_for_byte() {
        for input in [
            "# Title\r\n\r\nNo tags.\r\n",
            "---\r\ntags:\r\n  - keep\r\n---\r\n\r\nBody\r\n",
            "plain\n\n\n",
        ] {
            let (updated, edits) = rewrite_tags_in_markdown("project", "archive", input);
            assert_eq!(edits, 0);
            assert_eq!(updated, input, "round trip for {input:?}");
        }
    }

    fn naive_rewrite_tags_in_markdown(
        old_tag: &str,
        new_tag: &str,
        markdown: &str,
    ) -> (String, u32) {
        let style = crate::text::LineStyle::detect(markdown);
        let normalized = crate::text::to_lf(markdown);
        let mut edits = 0u32;
        let (frontmatter, body) = split_frontmatter(&normalized);
        let rewritten_body = crate::text::split_lines(&body)
            .map(|line| {
                let mut output = String::new();
                let mut index = 0usize;
                while index < line.len() {
                    let rest = &line[index..];
                    if let Some(stripped) = rest.strip_prefix('#') {
                        let tag_end = stripped
                            .char_indices()
                            .find(|(_, ch)| {
                                !ch.is_ascii_alphanumeric()
                                    && *ch != '_'
                                    && *ch != '/'
                                    && *ch != '-'
                            })
                            .map(|(offset, _)| offset)
                            .unwrap_or(stripped.len());
                        let tag = &stripped[..tag_end];
                        if tag_should_rewrite(tag, old_tag) {
                            edits += 1;
                            output.push('#');
                            output.push_str(&remap_tag(tag, old_tag, new_tag));
                            index += 1 + tag_end;
                            continue;
                        }
                    }
                    if let Some(ch) = rest.chars().next() {
                        output.push(ch);
                        index += ch.len_utf8();
                    } else {
                        break;
                    }
                }
                output
            })
            .collect::<Vec<_>>()
            .join("\n");
        let rewritten_frontmatter = frontmatter
            .as_deref()
            .map(|value| rewrite_frontmatter_tags(value, old_tag, new_tag, &mut edits));
        (
            style.restore(&join_frontmatter(
                rewritten_frontmatter.as_deref(),
                &rewritten_body,
            )),
            edits,
        )
    }

    #[test]
    fn rewrite_tags_differential_oracle() {
        let corpus = [
            "# Title\n\nBody #project and #project/frontend.\n",
            "---\ntags:\n  - project/foo\n  - other\n---\n\n# Body\n",
            "No tags here.\n",
            "#alpha #alpha/beta #alphabet\n",
            "---\ntags: project, other/project\n---\n",
        ];
        let pairs = [("project", "archive"), ("alpha", "beta"), ("other", "next")];
        for input in corpus {
            for (old_tag, new_tag) in pairs {
                let optimized = rewrite_tags_in_markdown(old_tag, new_tag, input);
                let naive = naive_rewrite_tags_in_markdown(old_tag, new_tag, input);
                assert_eq!(
                    optimized, naive,
                    "mismatch for {old_tag} -> {new_tag} in {input:?}"
                );
            }
        }
    }

    #[test]
    fn tag_rename_apply_updates_notes() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(
            dir.path().join("note.md"),
            "# Note\n\nTagged #alpha/beta and #alpha.\n",
        )
        .expect("write note");

        let session = open_vault(dir.path()).expect("open vault");
        let summary = tag_rename_apply(&session.descriptor.id, &session.root, "alpha", "omega")
            .expect("rename tag");
        assert_eq!(summary.edits, 2);

        let updated = read_note(
            &session.descriptor.id,
            &session.root,
            &RelativeVaultPath::parse("note.md").expect("path"),
        )
        .expect("read note");
        assert!(updated.markdown.contains("#omega/beta"));
        assert!(updated.markdown.contains("#omega"));
    }
}
