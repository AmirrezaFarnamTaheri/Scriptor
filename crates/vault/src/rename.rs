use std::collections::{BTreeMap, BTreeSet};
use std::fs;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::link_rewrite::{rewrite_note_rename_links, RenameLinkTarget};
use crate::note::read_note;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::patch_log::{collect_rename_backups, write_rename_patch_log};
use crate::rename_transaction::StagedRenameTransaction;
use crate::scan::{list_notes, scan_vault, ScannedEntryKind};
use crate::write::save_note;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenameNoteDryRunOutput {
    pub affected_files: Vec<String>,
    pub link_edits: u32,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenameNoteApplyOutput {
    pub from_path: String,
    pub to_path: String,
    pub affected_files: Vec<String>,
    pub link_edits: u32,
}

pub fn rename_dry_run(
    vault_id: &str,
    root: &VaultRoot,
    from_path: &RelativeVaultPath,
    to_path: &RelativeVaultPath,
    update_links: bool,
) -> Result<RenameNoteDryRunOutput, VaultError> {
    if from_path.as_str() == to_path.as_str() {
        return Err(VaultError::RenameNoop);
    }

    if !root.resolve_relative(from_path)?.is_file() {
        return Err(VaultError::NoteNotFound(from_path.to_string()));
    }

    if root.resolve_relative(to_path)?.exists() {
        return Err(VaultError::NoteExists(to_path.to_string()));
    }

    let mut affected = BTreeSet::from([from_path.to_string()]);
    let mut link_edits = 0u32;
    let mut warnings = Vec::new();

    if update_links {
        let note_paths = note_paths_for_rewrite(root)?;
        let from = rename_target(vault_id, root, from_path, &note_paths)?;
        let to = rename_target_for_path(vault_id, root, to_path, &note_paths)?;

        for note_path in list_notes(root)? {
            let document = read_note(vault_id, root, &note_path)?;
            let (_, edits) =
                rewrite_note_rename_links(&document.markdown, &from, &to);
            if edits > 0 {
                affected.insert(note_path.to_string());
                link_edits += edits;
            }
        }
    } else {
        warnings.push("Link updates disabled; backlinks may break.".into());
    }

    Ok(RenameNoteDryRunOutput {
        affected_files: affected.into_iter().collect(),
        link_edits,
        warnings,
    })
}

pub fn rename_apply(
    vault_id: &str,
    root: &VaultRoot,
    from_path: &RelativeVaultPath,
    to_path: &RelativeVaultPath,
    update_links: bool,
) -> Result<RenameNoteApplyOutput, VaultError> {
    let preview = rename_dry_run(vault_id, root, from_path, to_path, update_links)?;
    let backups = collect_rename_backups(root, &preview.affected_files)?;
    let _patch = write_rename_patch_log(root, from_path.as_str(), to_path.as_str(), backups)?;

    let note_paths = note_paths_for_rewrite(root)?;
    let from = rename_target(vault_id, root, from_path, &note_paths)?;
    let to = rename_target_for_path(vault_id, root, to_path, &note_paths)?;

    let staged = StagedRenameTransaction::begin(
        root,
        from_path,
        to_path,
        &preview.affected_files,
    )?;

    let mut pending_writes: BTreeMap<String, String> = BTreeMap::new();

    if update_links {
        for note_path in list_notes(root)? {
            let document = read_note(vault_id, root, &note_path)?;
            let (updated, edits) =
                rewrite_note_rename_links(&document.markdown, &from, &to);
            if edits > 0 && updated != document.markdown {
                pending_writes.insert(note_path.to_string(), updated);
            }
        }
    }

    for (path, markdown) in &pending_writes {
        if path != from_path.as_str() {
            let relative = RelativeVaultPath::parse(path)?;
            save_note(vault_id, root, &relative, markdown, None)?;
        }
    }

    let from_absolute = root.resolve_relative(from_path)?;
    let to_absolute = root.resolve_relative(to_path)?;
    if let Some(parent) = to_absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }

    if let Some(updated_source) = pending_writes.get(from_path.as_str()) {
        save_note(vault_id, root, to_path, updated_source, None)?;
        fs::remove_file(&from_absolute).map_err(|source| VaultError::io(&from_absolute, source))?;
    } else {
        fs::rename(&from_absolute, &to_absolute).map_err(|source| VaultError::io(&from_absolute, source))?;
    }

    staged.commit()?;

    Ok(RenameNoteApplyOutput {
        from_path: from_path.to_string(),
        to_path: to_path.to_string(),
        affected_files: preview.affected_files,
        link_edits: preview.link_edits,
    })
}

fn note_paths_for_rewrite(root: &VaultRoot) -> Result<Vec<String>, VaultError> {
    Ok(list_notes(root)?
        .into_iter()
        .map(|path| path.to_string())
        .collect())
}

fn rename_target(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
    note_paths: &[String],
) -> Result<RenameLinkTarget, VaultError> {
    let title = read_note(vault_id, root, path)?.metadata.title;
    Ok(RenameLinkTarget::from_note_path(path, &title, note_paths))
}

fn rename_target_for_path(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
    note_paths: &[String],
) -> Result<RenameLinkTarget, VaultError> {
    let title = title_for_path(vault_id, root, path)?;
    Ok(RenameLinkTarget::from_note_path(path, &title, note_paths))
}

fn title_for_path(vault_id: &str, root: &VaultRoot, path: &RelativeVaultPath) -> Result<String, VaultError> {
    if root.resolve_relative(path)?.exists() {
        return Ok(read_note(vault_id, root, path)?.metadata.title);
    }

    Ok(path
        .as_str()
        .trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or(path.as_str())
        .to_string())
}

pub fn unresolved_link_targets(root: &VaultRoot) -> Result<Vec<(String, String)>, VaultError> {
    let notes = list_notes(root)?;
    let titles: BTreeMap<String, String> = notes
        .iter()
        .map(|path| (path.as_str().trim_end_matches(".md").rsplit('/').next().unwrap_or("").to_string(), path.to_string()))
        .collect();

    let wikilink = Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]").expect("valid wikilink regex");
    let mut unresolved = Vec::new();

    for note_path in notes {
        let markdown = read_note("health", root, &note_path)?.markdown;
        for capture in wikilink.captures_iter(&markdown) {
            let target = capture.get(1).map(|value| value.as_str().trim()).unwrap_or("");
            if target.is_empty() {
                continue;
            }
            if !titles.contains_key(target) && !note_exists(root, target)? {
                unresolved.push((note_path.to_string(), target.to_string()));
            }
        }
    }

    Ok(unresolved)
}

fn note_exists(root: &VaultRoot, title_or_path: &str) -> Result<bool, VaultError> {
    if title_or_path.ends_with(".md") {
        return Ok(root.resolve_relative(&RelativeVaultPath::parse(title_or_path)?).is_ok());
    }

    for entry in scan_vault(root)? {
        if entry.kind == ScannedEntryKind::Note && entry.path.ends_with(".md") {
            let stem = entry.path.trim_end_matches(".md").rsplit('/').next().unwrap_or("");
            if stem.eq_ignore_ascii_case(title_or_path) {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::open::open_vault;
    use tempfile::tempdir;

    #[test]
    fn rename_updates_wikilinks() {
        let dir = tempdir().unwrap();
        fs::write(
            dir.path().join("Research Plan.md"),
            "# Research Plan\n\n- [[Field Notes]]\n",
        )
        .unwrap();
        fs::write(dir.path().join("Field Notes.md"), "# Field Notes\n").unwrap();

        let session = open_vault(dir.path()).unwrap();
        let from = RelativeVaultPath::parse("Field Notes.md").unwrap();
        let to = RelativeVaultPath::parse("Field Notes Renamed.md").unwrap();
        rename_apply(&session.descriptor.id, &session.root, &from, &to, true).unwrap();

        let updated = read_note(
            &session.descriptor.id,
            &session.root,
            &RelativeVaultPath::parse("Research Plan.md").unwrap(),
        )
        .unwrap();
        assert!(updated.markdown.contains("[[Field Notes Renamed]]"));
    }

    #[test]
    fn rename_preserves_alias_and_section_links() {
        let dir = tempdir().unwrap();
        fs::write(
            dir.path().join("Source.md"),
            "# Source\n\nSee [[Field Notes#Methods|Notes]].\n",
        )
        .unwrap();
        fs::write(dir.path().join("Field Notes.md"), "# Field Notes\n").unwrap();

        let session = open_vault(dir.path()).unwrap();
        let from = RelativeVaultPath::parse("Field Notes.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed Notes.md").unwrap();
        rename_apply(&session.descriptor.id, &session.root, &from, &to, true).unwrap();

        let updated = read_note(
            &session.descriptor.id,
            &session.root,
            &RelativeVaultPath::parse("Source.md").unwrap(),
        )
        .unwrap();
        assert!(updated.markdown.contains("[[Renamed Notes#Methods|Notes]]"));
    }

    #[test]
    fn rename_preserves_directory_style_identifiers() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("projects")).unwrap();
        std::fs::write(dir.path().join("projects/index.md"), "# Projects\n").unwrap();
        fs::write(
            dir.path().join("Source.md"),
            "# Source\n\nSee [[projects|Home]].\n",
        )
        .unwrap();

        let session = open_vault(dir.path()).unwrap();
        let from = RelativeVaultPath::parse("projects/index.md").unwrap();
        let to = RelativeVaultPath::parse("archive/index.md").unwrap();
        std::fs::create_dir_all(dir.path().join("archive")).unwrap();
        rename_apply(&session.descriptor.id, &session.root, &from, &to, true).unwrap();

        let updated = read_note(
            &session.descriptor.id,
            &session.root,
            &RelativeVaultPath::parse("Source.md").unwrap(),
        )
        .unwrap();
        assert!(updated.markdown.contains("[[archive|Home]]"));
    }
}
