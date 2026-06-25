use std::collections::BTreeSet;

use regex::Regex;

use crate::error::VaultError;
use crate::link_rewrite::{join_frontmatter, split_frontmatter, LinkRewriteApplyOutput, LinkRewritePreview};
use crate::note::read_note;
use crate::path::VaultRoot;
use crate::scan::list_notes;
use crate::write::save_note;

fn normalize_tag_label(label: &str) -> Result<String, VaultError> {
    let clean = label.trim().trim_start_matches('#');
    if clean.is_empty() {
        return Err(VaultError::InvalidConfig {
            message: "tag label cannot be empty".into(),
        });
    }

    let valid = Regex::new(r"^[A-Za-z0-9_/-]+$").expect("valid tag label regex");
    if !valid.is_match(clean) {
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
    let hashtag = Regex::new(r"#([A-Za-z0-9_/-]+)").expect("valid hashtag regex");
    hashtag
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

fn rewrite_frontmatter_tags(
    frontmatter: &str,
    old_root: &str,
    new_root: &str,
    edits: &mut u32,
) -> String {
    frontmatter
        .lines()
        .map(|line| {
            let trimmed = line.trim_start();
            if trimmed.starts_with("tags:") {
                let Some((prefix, values)) = line.split_once(':') else {
                    return line.to_string();
                };
                let remapped = values
                    .split(',')
                    .map(str::trim)
                    .map(|tag| {
                        if tag.is_empty() || !tag_should_rewrite(tag, old_root) {
                            return tag.to_string();
                        }
                        *edits += 1;
                        remap_tag(tag, old_root, new_root)
                    })
                    .collect::<Vec<_>>()
                    .join(", ");
                return format!("{prefix}: {remapped}");
            }

            if trimmed.starts_with("- ") {
                let indent = line.len() - trimmed.len();
                let value = trimmed[2..].trim();
                if tag_should_rewrite(value, old_root) {
                    *edits += 1;
                    return format!("{}- {}", " ".repeat(indent), remap_tag(value, old_root, new_root));
                }
            }

            line.to_string()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn rewrite_tags_in_markdown(old_tag: &str, new_tag: &str, markdown: &str) -> (String, u32) {
    let mut edits = 0u32;
    let (frontmatter, body) = split_frontmatter(markdown);
    let rewritten_body = body
        .lines()
        .map(|line| rewrite_hashtag_line(line, old_tag, new_tag, &mut edits))
        .collect::<Vec<_>>()
        .join("\n");
    let rewritten_frontmatter = frontmatter
        .as_deref()
        .map(|value| rewrite_frontmatter_tags(value, old_tag, new_tag, &mut edits));
    (
        join_frontmatter(rewritten_frontmatter.as_deref(), &rewritten_body),
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

    fn naive_rewrite_tags_in_markdown(old_tag: &str, new_tag: &str, markdown: &str) -> (String, u32) {
        let mut edits = 0u32;
        let (frontmatter, body) = split_frontmatter(markdown);
        let rewritten_body = body
            .lines()
            .map(|line| {
                let mut output = String::new();
                let mut index = 0usize;
                while index < line.len() {
                    let rest = &line[index..];
                    if let Some(stripped) = rest.strip_prefix('#') {
                        let tag_end = stripped
                            .char_indices()
                            .find(|(_, ch)| !ch.is_ascii_alphanumeric() && *ch != '_' && *ch != '/' && *ch != '-')
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
            join_frontmatter(rewritten_frontmatter.as_deref(), &rewritten_body),
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
                assert_eq!(optimized, naive, "mismatch for {old_tag} -> {new_tag} in {input:?}");
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
