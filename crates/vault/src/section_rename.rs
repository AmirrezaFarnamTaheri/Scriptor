use std::collections::BTreeSet;
use std::sync::LazyLock;

use regex::Regex;

use crate::error::VaultError;
use crate::link_rewrite::{join_frontmatter, note_target_matches, split_frontmatter, LinkRewriteApplyOutput, LinkRewritePreview};
use crate::note::read_note;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::scan::list_notes;
use crate::write::save_note;

static HEADING_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(#+)\s+(.*)$").expect("valid heading regex"));
static WIKILINK_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[\[([^\]|#]*)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]").expect("valid wikilink regex")
});
static SELF_WIKILINK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[\[#([^\]|]+)(?:\|([^\]]+))?\]\]").expect("valid self wikilink regex"));
static MARKDOWN_LINK_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[(?P<label>[^\]]*)\]\((?P<url>[^)#]+)(?:#(?P<section>[^)]+))?\)").expect("valid md link regex")
});

fn normalize_section_label(label: &str) -> Result<String, VaultError> {
    let clean = label.trim();
    if clean.is_empty() {
        return Err(VaultError::InvalidConfig {
            message: "section label cannot be empty".into(),
        });
    }
    Ok(clean.to_string())
}

/// Upper bound on a block id. Block ids arrive over IPC, and an unbounded one
/// can exceed the regex compiler's size limit, which used to reach a `.expect`
/// and take down the daemon worker.
const MAX_BLOCK_ID_LEN: usize = 256;

fn normalize_block_id(label: &str) -> Result<String, VaultError> {
    let clean = label.trim().trim_start_matches('^');
    if clean.is_empty() {
        return Err(VaultError::InvalidConfig {
            message: "block id cannot be empty".into(),
        });
    }
    if clean.chars().count() > MAX_BLOCK_ID_LEN {
        return Err(VaultError::InvalidConfig {
            message: format!("block id is too long (maximum {MAX_BLOCK_ID_LEN} characters)"),
        });
    }
    Ok(clean.to_string())
}

/// Compiles the anchor pattern for `old_block` once per rename.
///
/// The trailing boundary is what stops renaming `^a` from rewriting `^ab` into
/// `^xb`. The `regex` crate has no look-around, so the boundary is captured as
/// `tail` and written straight back out. A compile failure is propagated rather
/// than reaching a panic.
fn block_anchor_regex(old_block: &str) -> Result<Regex, VaultError> {
    Regex::new(&format!(
        r"\^{}(?P<tail>[^\w\-]|$)",
        regex::escape(old_block)
    ))
    .map_err(|source| VaultError::InvalidConfig {
        message: format!("invalid block id \"{old_block}\": {source}"),
    })
}

fn rewrite_heading_lines(
    markdown: &str,
    old_heading: &str,
    new_heading: &str,
    edits: &mut u32,
) -> String {
    crate::text::split_lines(markdown)
        .map(|line| {
            let Some(capture) = HEADING_RE.captures(line) else {
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
    anchor: &Regex,
    markdown: &str,
    new_block: &str,
    edits: &mut u32,
) -> String {
    anchor
        .replace_all(markdown, |capture: &regex::Captures| {
            *edits += 1;
            let tail = capture.name("tail").map(|value| value.as_str()).unwrap_or("");
            format!("^{new_block}{tail}")
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

    let step_one = WIKILINK_RE
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

    let step_two = SELF_WIKILINK_RE
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

    let updated = MARKDOWN_LINK_RE
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
    // Normalize to LF for the frontmatter split and heading scan, then put the
    // document's own line endings back so a heading rename touches one line
    // rather than every line of a CRLF note.
    let style = crate::text::LineStyle::detect(markdown);
    let normalized = crate::text::to_lf(markdown);
    let (frontmatter, body) = split_frontmatter(&normalized);
    let mut edits = 0u32;
    let updated_body = rewrite_heading_lines(&body, old_heading, new_heading, &mut edits);
    (
        style.restore(&join_frontmatter(frontmatter.as_deref(), &updated_body)),
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
    // Compiled once, not once per note.
    let anchor = block_anchor_regex(&old_id)?;
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
            let next = rewrite_block_anchor_lines(&anchor, &updated, &new_id, &mut anchor_count);
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
    let anchor = block_anchor_regex(&old_id)?;

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
            let next = rewrite_block_anchor_lines(&anchor, &updated, &new_id, &mut anchor_count);
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
    fn block_rename_respects_anchor_boundaries() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(
            dir.path().join("Target.md"),
            "# Target\n\nOne. ^a\n\nTwo. ^ab\n\nThree. ^a-b\n",
        )
        .expect("write target");

        let session = open_vault(dir.path()).expect("open vault");
        let target = RelativeVaultPath::parse("Target.md").expect("path");
        block_rename_apply(&session.descriptor.id, &session.root, &target, "a", "x", true)
            .expect("rename block");

        let updated = std::fs::read_to_string(dir.path().join("Target.md")).expect("read");
        assert!(updated.contains("One. ^x"), "got: {updated}");
        assert!(updated.contains("Two. ^ab"), "^ab was clobbered: {updated}");
        assert!(updated.contains("Three. ^a-b"), "^a-b was clobbered: {updated}");
    }

    #[test]
    fn rejects_oversized_block_id_instead_of_panicking() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("Target.md"), "# Target\n\nBody. ^id\n").expect("write");
        let session = open_vault(dir.path()).expect("open vault");
        let target = RelativeVaultPath::parse("Target.md").expect("path");

        let oversized = "a".repeat(100_000);
        let result = block_rename_dry_run(
            &session.descriptor.id,
            &session.root,
            &target,
            &oversized,
            "new-id",
            true,
        );
        assert!(matches!(result, Err(VaultError::InvalidConfig { .. })));

        let result = block_rename_apply(
            &session.descriptor.id,
            &session.root,
            &target,
            "old-id",
            &oversized,
            true,
        );
        assert!(matches!(result, Err(VaultError::InvalidConfig { .. })));
    }

    #[test]
    fn heading_rename_preserves_crlf_and_trailing_newline() {
        let (updated, edits) =
            apply_source_note_heading_update("# Note\r\n\r\n## Old\r\n\r\nBody\r\n", "Old", "New", true);
        assert_eq!(edits, 1);
        assert_eq!(updated, "# Note\r\n\r\n## New\r\n\r\nBody\r\n");

        let (updated, edits) =
            apply_source_note_heading_update("# Note\n\n## Old\n\nBody\n", "Old", "New", true);
        assert_eq!(edits, 1);
        assert_eq!(updated, "# Note\n\n## New\n\nBody\n");
    }

    #[test]
    fn heading_rename_round_trips_untouched_documents() {
        for input in [
            "# Note\r\n\r\n## Keep\r\n",
            "---\ntitle: X\n---\n\n## Keep\n\n\n",
            "no trailing newline",
        ] {
            let (updated, edits) = apply_source_note_heading_update(input, "Old", "New", true);
            assert_eq!(edits, 0);
            assert_eq!(updated, input, "round trip for {input:?}");
        }
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
