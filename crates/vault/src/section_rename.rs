use std::collections::BTreeSet;

use regex::Regex;

use crate::error::VaultError;
use crate::link_rewrite::{join_frontmatter, note_target_matches, split_frontmatter, LinkRewriteApplyOutput, LinkRewritePreview};
use crate::note::read_note;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::scan::list_notes;
use crate::write::save_note;

fn normalize_section_label(label: &str) -> Result<String, VaultError> {
    let clean = label.trim();
    if clean.is_empty() {
        return Err(VaultError::InvalidConfig {
            message: "section label cannot be empty".into(),
        });
    }
    Ok(clean.to_string())
}

fn normalize_block_id(label: &str) -> Result<String, VaultError> {
    let clean = label.trim().trim_start_matches('^');
    if clean.is_empty() {
        return Err(VaultError::InvalidConfig {
            message: "block id cannot be empty".into(),
        });
    }
    Ok(clean.to_string())
}

fn rewrite_heading_lines(
    markdown: &str,
    old_heading: &str,
    new_heading: &str,
    edits: &mut u32,
) -> String {
    let heading = Regex::new(r"^(#+)\s+(.*)$").expect("valid heading regex");
    markdown
        .lines()
        .map(|line| {
            let Some(capture) = heading.captures(line) else {
                return line.to_string();
            };
            let level = capture.get(1).map(|value| value.as_str()).unwrap_or("#");
            let text = capture.get(2).map(|value| value.as_str().trim()).unwrap_or("");
            if text != old_heading {
                return line.to_string();
            }
            *edits += 1;
            format!("{level} {new_heading}")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn rewrite_block_anchor_lines(
    markdown: &str,
    old_block: &str,
    new_block: &str,
    edits: &mut u32,
) -> String {
    let anchor = Regex::new(&format!(r"\^({})", regex::escape(old_block))).expect("valid block regex");
    anchor
        .replace_all(markdown, |_: &regex::Captures| {
            *edits += 1;
            format!("^{new_block}")
        })
        .into_owned()
}

pub fn rewrite_section_links_in_markdown(
    markdown: &str,
    target_path: &RelativeVaultPath,
    target_title: &str,
    source_path: &RelativeVaultPath,
    old_section: &str,
    new_section: &str,
) -> (String, u32) {
    let mut edits = 0u32;
    let wikilink =
        Regex::new(r"\[\[([^\]|#]*)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]").expect("valid wikilink regex");
    let self_wikilink = Regex::new(r"\[\[#([^\]|]+)(?:\|([^\]]+))?\]\]").expect("valid self wikilink regex");
    let markdown_link =
        Regex::new(r"\[(?P<label>[^\]]*)\]\((?P<url>[^)#]+)(?:#(?P<section>[^)]+))?\)").expect("valid md link regex");

    let step_one = wikilink
        .replace_all(markdown, |capture: &regex::Captures| {
            let target = capture.get(1).map(|value| value.as_str().trim()).unwrap_or("");
            let section = capture.get(2).map(|value| value.as_str().trim()).unwrap_or("");
            let alias = capture.get(3).map(|value| value.as_str());

            if section.is_empty() || section != old_section {
                return capture.get(0).unwrap().as_str().to_string();
            }
            if !note_target_matches(target, target_path, target_title, None) {
                return capture.get(0).unwrap().as_str().to_string();
            }

            edits += 1;
            match alias {
                Some(label) => format!("[[{target}#{new_section}|{label}]]"),
                None => format!("[[{target}#{new_section}]]"),
            }
        })
        .into_owned();

    let step_two = self_wikilink
        .replace_all(&step_one, |capture: &regex::Captures| {
            let section = capture.get(1).map(|value| value.as_str().trim()).unwrap_or("");
            let alias = capture.get(2).map(|value| value.as_str());
            if source_path.as_str() != target_path.as_str() || section != old_section {
                return capture.get(0).unwrap().as_str().to_string();
            }
            edits += 1;
            match alias {
                Some(label) => format!("[[#{new_section}|{label}]]"),
                None => format!("[[#{new_section}]]"),
            }
        })
        .into_owned();

    let updated = markdown_link
        .replace_all(&step_two, |capture: &regex::Captures| {
            let label = capture.name("label").map(|value| value.as_str()).unwrap_or("");
            let url = capture.name("url").map(|value| value.as_str().trim()).unwrap_or("");
            let section = capture.name("section").map(|value| value.as_str().trim());
            let Some(section_value) = section else {
                return capture.get(0).unwrap().as_str().to_string();
            };
            if section_value != old_section {
                return capture.get(0).unwrap().as_str().to_string();
            }
            if !note_target_matches(url, target_path, target_title, None)
                && url != target_path.as_str()
                && !url.ends_with(target_path.as_str())
            {
                return capture.get(0).unwrap().as_str().to_string();
            }
            edits += 1;
            format!("[{label}]({url}#{new_section})")
        })
        .into_owned();

    (updated, edits)
}

pub fn rewrite_block_links_in_markdown(
    markdown: &str,
    target_path: &RelativeVaultPath,
    target_title: &str,
    source_path: &RelativeVaultPath,
    old_block: &str,
    new_block: &str,
) -> (String, u32) {
    let old_fragment = format!("^{old_block}");
    let new_fragment = format!("^{new_block}");
    rewrite_section_links_in_markdown(
        markdown,
        target_path,
        target_title,
        source_path,
        &old_fragment,
        &new_fragment,
    )
}

fn apply_source_note_heading_update(
    markdown: &str,
    old_heading: &str,
    new_heading: &str,
    update_heading: bool,
) -> (String, u32) {
    if !update_heading {
        return (markdown.to_string(), 0);
    }
    let (frontmatter, body) = split_frontmatter(markdown);
    let mut edits = 0u32;
    let updated_body = rewrite_heading_lines(&body, old_heading, new_heading, &mut edits);
    (
        join_frontmatter(frontmatter.as_deref(), &updated_body),
        edits,
    )
}

pub fn section_rename_dry_run(
    vault_id: &str,
    root: &VaultRoot,
    note_path: &RelativeVaultPath,
    old_section: &str,
    new_section: &str,
    update_heading: bool,
) -> Result<LinkRewritePreview, VaultError> {
    let old_label = normalize_section_label(old_section)?;
    let new_label = normalize_section_label(new_section)?;
    if old_label == new_label {
        return Err(VaultError::RenameNoop);
    }

    if !root.resolve_relative(note_path)?.is_file() {
        return Err(VaultError::NoteNotFound(note_path.to_string()));
    }

    let target_title = read_note(vault_id, root, note_path)?.metadata.title;
    let mut affected = BTreeSet::new();
    let mut edits = 0u32;
    let mut warnings = Vec::new();

    for path in list_notes(root)? {
        let document = read_note(vault_id, root, &path)?;
        let (updated, count) = rewrite_section_links_in_markdown(
            &document.markdown,
            note_path,
            &target_title,
            &path,
            &old_label,
            &new_label,
        );
        let (updated, heading_edits) = if path.as_str() == note_path.as_str() {
            apply_source_note_heading_update(&updated, &old_label, &new_label, update_heading)
        } else {
            (updated, 0)
        };
        let total = count + heading_edits;
        if total > 0 && updated != document.markdown {
            affected.insert(path.to_string());
            edits += total;
        }
    }

    if affected.is_empty() {
        warnings.push(format!(
            "No links or headings matched section \"{old_label}\" in {}",
            note_path.as_str()
        ));
    }

    Ok(LinkRewritePreview {
        affected_files: affected.into_iter().collect(),
        edits,
        warnings,
    })
}

pub fn section_rename_apply(
    vault_id: &str,
    root: &VaultRoot,
    note_path: &RelativeVaultPath,
    old_section: &str,
    new_section: &str,
    update_heading: bool,
) -> Result<LinkRewriteApplyOutput, VaultError> {
    let preview = section_rename_dry_run(
        vault_id,
        root,
        note_path,
        old_section,
        new_section,
        update_heading,
    )?;
    let old_label = normalize_section_label(old_section)?;
    let new_label = normalize_section_label(new_section)?;
    let target_title = read_note(vault_id, root, note_path)?.metadata.title;

    for path in list_notes(root)? {
        let document = read_note(vault_id, root, &path)?;
        let (updated, count) = rewrite_section_links_in_markdown(
            &document.markdown,
            note_path,
            &target_title,
            &path,
            &old_label,
            &new_label,
        );
        let (updated, heading_edits) = if path.as_str() == note_path.as_str() {
            apply_source_note_heading_update(&updated, &old_label, &new_label, update_heading)
        } else {
            (updated, 0)
        };
        if count + heading_edits > 0 && updated != document.markdown {
            save_note(vault_id, root, &path, &updated, None)?;
        }
    }

    Ok(LinkRewriteApplyOutput {
        affected_files: preview.affected_files,
        edits: preview.edits,
    })
}

pub fn block_rename_dry_run(
    vault_id: &str,
    root: &VaultRoot,
    note_path: &RelativeVaultPath,
    old_block: &str,
    new_block: &str,
    update_anchor: bool,
) -> Result<LinkRewritePreview, VaultError> {
    let old_id = normalize_block_id(old_block)?;
    let new_id = normalize_block_id(new_block)?;
    if old_id == new_id {
        return Err(VaultError::RenameNoop);
    }

    if !root.resolve_relative(note_path)?.is_file() {
        return Err(VaultError::NoteNotFound(note_path.to_string()));
    }

    let target_title = read_note(vault_id, root, note_path)?.metadata.title;
    let mut affected = BTreeSet::new();
    let mut edits = 0u32;
    let mut warnings = Vec::new();

    for path in list_notes(root)? {
        let document = read_note(vault_id, root, &path)?;
        let (updated, count) = rewrite_block_links_in_markdown(
            &document.markdown,
            note_path,
            &target_title,
            &path,
            &old_id,
            &new_id,
        );
        let (updated, anchor_edits) = if update_anchor && path.as_str() == note_path.as_str() {
            let mut anchor_count = 0u32;
            let next = rewrite_block_anchor_lines(&updated, &old_id, &new_id, &mut anchor_count);
            (next, anchor_count)
        } else {
            (updated, 0)
        };
        let total = count + anchor_edits;
        if total > 0 && updated != document.markdown {
            affected.insert(path.to_string());
            edits += total;
        }
    }

    if affected.is_empty() {
        warnings.push(format!(
            "No block links or anchors matched \"^{old_id}\" in {}",
            note_path.as_str()
        ));
    }

    Ok(LinkRewritePreview {
        affected_files: affected.into_iter().collect(),
        edits,
        warnings,
    })
}

pub fn block_rename_apply(
    vault_id: &str,
    root: &VaultRoot,
    note_path: &RelativeVaultPath,
    old_block: &str,
    new_block: &str,
    update_anchor: bool,
) -> Result<LinkRewriteApplyOutput, VaultError> {
    let preview = block_rename_dry_run(vault_id, root, note_path, old_block, new_block, update_anchor)?;
    let old_id = normalize_block_id(old_block)?;
    let new_id = normalize_block_id(new_block)?;
    let target_title = read_note(vault_id, root, note_path)?.metadata.title;

    for path in list_notes(root)? {
        let document = read_note(vault_id, root, &path)?;
        let (updated, count) = rewrite_block_links_in_markdown(
            &document.markdown,
            note_path,
            &target_title,
            &path,
            &old_id,
            &new_id,
        );
        let (updated, anchor_edits) = if update_anchor && path.as_str() == note_path.as_str() {
            let mut anchor_count = 0u32;
            let next = rewrite_block_anchor_lines(&updated, &old_id, &new_id, &mut anchor_count);
            (next, anchor_count)
        } else {
            (updated, 0)
        };
        if count + anchor_edits > 0 && updated != document.markdown {
            save_note(vault_id, root, &path, &updated, None)?;
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
    use tempfile::tempdir;

    #[test]
    fn rewrites_section_wikilinks_and_self_links() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(
            dir.path().join("Target.md"),
            "# Target\n\n## Old Section\n\nParagraph.\n",
        )
        .expect("write target");
        std::fs::write(
            dir.path().join("Source.md"),
            "# Source\n\nSee [[Target#Old Section]] and [[#Old Section]].\n",
        )
        .expect("write source");

        let session = open_vault(dir.path()).expect("open vault");
        let target = RelativeVaultPath::parse("Target.md").expect("path");
        let output = section_rename_apply(
            &session.descriptor.id,
            &session.root,
            &target,
            "Old Section",
            "New Section",
            true,
        )
        .expect("rename section");

        assert!(output.edits >= 2);
        let source = read_note(
            &session.descriptor.id,
            &session.root,
            &RelativeVaultPath::parse("Source.md").expect("path"),
        )
        .expect("read source");
        assert!(source.markdown.contains("[[Target#New Section]]"));
    }

    #[test]
    fn rewrites_block_links() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(
            dir.path().join("Target.md"),
            "# Target\n\nBlock paragraph. ^old-id\n",
        )
        .expect("write target");
        std::fs::write(
            dir.path().join("Source.md"),
            "# Source\n\nJump to [[Target#^old-id]].\n",
        )
        .expect("write source");

        let session = open_vault(dir.path()).expect("open vault");
        let target = RelativeVaultPath::parse("Target.md").expect("path");
        block_rename_apply(
            &session.descriptor.id,
            &session.root,
            &target,
            "old-id",
            "new-id",
            true,
        )
        .expect("rename block");

        let source = read_note(
            &session.descriptor.id,
            &session.root,
            &RelativeVaultPath::parse("Source.md").expect("path"),
        )
        .expect("read source");
        assert!(source.markdown.contains("[[Target#^new-id]]"));
    }
}
