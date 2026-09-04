use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::hash::content_hash;
use crate::link_rewrite::{RenameLinkTarget, rewrite_note_rename_links_with_resolver};
use crate::note::read_note;
use crate::note_history::move_note_history;
use crate::patch_log::{collect_rename_backups, write_rename_patch_log};
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::rename_transaction::StagedRenameTransaction;
use crate::scan::list_notes;
use crate::wikilink::{WikilinkIndex, WikilinkResolutionKind};
use crate::write::save_note;

static WIKILINK_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]").expect("valid wikilink regex")
});

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

/// Performs a dry-run of a note rename, returning what would change.
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
        let resolver = wikilink_index_for_vault(vault_id, root, &note_paths)?;

        for note_path in list_notes(root)? {
            let document = read_note(vault_id, root, &note_path)?;
            let (_, edits) =
                rewrite_note_rename_links_with_resolver(&document.markdown, &from, &to, &resolver);
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

/// Applies a note rename, updating all links in the vault.
pub fn rename_apply(
    vault_id: &str,
    root: &VaultRoot,
    from_path: &RelativeVaultPath,
    to_path: &RelativeVaultPath,
    update_links: bool,
) -> Result<RenameNoteApplyOutput, VaultError> {
    rename_apply_guarded(vault_id, root, from_path, to_path, update_links, None)
}

pub fn rename_apply_guarded(
    vault_id: &str,
    root: &VaultRoot,
    from_path: &RelativeVaultPath,
    to_path: &RelativeVaultPath,
    update_links: bool,
    expected_source_hash: Option<&str>,
) -> Result<RenameNoteApplyOutput, VaultError> {
    let (output, staged) = rename_apply_staged_guarded(
        vault_id,
        root,
        from_path,
        to_path,
        update_links,
        expected_source_hash,
    )?;
    staged.commit()?;
    Ok(output)
}

/// Applies a note rename in staged mode, returning the staged transaction for commit/abort.
pub fn rename_apply_staged(
    vault_id: &str,
    root: &VaultRoot,
    from_path: &RelativeVaultPath,
    to_path: &RelativeVaultPath,
    update_links: bool,
) -> Result<(RenameNoteApplyOutput, StagedRenameTransaction), VaultError> {
    rename_apply_staged_guarded(vault_id, root, from_path, to_path, update_links, None)
}

pub fn rename_apply_staged_guarded(
    vault_id: &str,
    root: &VaultRoot,
    from_path: &RelativeVaultPath,
    to_path: &RelativeVaultPath,
    update_links: bool,
    expected_source_hash: Option<&str>,
) -> Result<(RenameNoteApplyOutput, StagedRenameTransaction), VaultError> {
    if let Some(expected) = expected_source_hash {
        let current = read_note(vault_id, root, from_path)?;
        if current.metadata.content_hash != expected {
            return Err(VaultError::HashMismatch {
                path: from_path.to_string(),
                expected: expected.to_string(),
                found: current.metadata.content_hash,
            });
        }
    }
    let preview = rename_dry_run(vault_id, root, from_path, to_path, update_links)?;
    let backups = collect_rename_backups(root, &preview.affected_files)?;
    let _patch = write_rename_patch_log(root, from_path.as_str(), to_path.as_str(), backups)?;

    let note_paths = note_paths_for_rewrite(root)?;
    let from = rename_target(vault_id, root, from_path, &note_paths)?;
    let to = rename_target_for_path(vault_id, root, to_path, &note_paths)?;
    let resolver = wikilink_index_for_vault(vault_id, root, &note_paths)?;

    let mut pending_writes: BTreeMap<String, (String, String)> = BTreeMap::new();

    if update_links {
        for note_path in list_notes(root)? {
            let document = read_note(vault_id, root, &note_path)?;
            let (updated, edits) =
                rewrite_note_rename_links_with_resolver(&document.markdown, &from, &to, &resolver);
            if edits > 0 && updated != document.markdown {
                pending_writes.insert(
                    note_path.to_string(),
                    (updated, document.metadata.content_hash),
                );
            }
        }
    }

    let intended_hashes: BTreeMap<String, String> = pending_writes
        .iter()
        .map(|(path, (markdown, _))| (path.clone(), content_hash(markdown)))
        .collect();
    let mut staged = StagedRenameTransaction::begin_with_intended(
        root,
        from_path,
        to_path,
        &preview.affected_files,
        &intended_hashes,
    )?;

    // Record the phase *before* the writes begin. Recording it afterwards left a
    // crash mid-loop looking like `Staged`, and the `Staged` recovery path only
    // restored the source note — every already-rewritten note kept links to a
    // filename that was never created. Announcing the phase up front means a
    // crash at any point in the loop rolls the whole batch back.
    if update_links && !pending_writes.is_empty() {
        staged.record_phase(crate::rename_transaction::RenamePhase::LinkWritesDone)?;
    }

    for (path, (markdown, original_hash)) in &pending_writes {
        if path != from_path.as_str() {
            let relative = RelativeVaultPath::parse(path)?;
            if let Err(error) = save_note(vault_id, root, &relative, markdown, Some(original_hash))
            {
                let _ = staged.abort();
                return Err(error);
            }
        }
    }

    let from_absolute = root.resolve_relative(from_path)?;
    let to_absolute = root.resolve_relative(to_path)?;
    if let Some(parent) = to_absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }

    if let Some((updated_source, original_hash)) = pending_writes.get(from_path.as_str()) {
        // The source must still be the bytes observed during planning before it
        // can be removed. The destination is create-only, so the write carries the
        // missing-content sentinel: a note that appeared at the destination after
        // the dry-run collision check fails the transaction instead of being
        // overwritten by the rename.
        save_note(
            vault_id,
            root,
            to_path,
            updated_source,
            Some(crate::write::EXPECTED_MISSING_CONTENT_HASH),
        )?;
        let current = read_note(vault_id, root, from_path)?;
        if current.metadata.content_hash != *original_hash {
            let _ = staged.abort();
            return Err(VaultError::HashMismatch {
                path: from_path.to_string(),
                expected: original_hash.clone(),
                found: current.metadata.content_hash,
            });
        }
        fs::remove_file(&from_absolute).map_err(|source| VaultError::io(&from_absolute, source))?;
    } else {
        fs::rename(&from_absolute, &to_absolute)
            .map_err(|source| VaultError::io(&from_absolute, source))?;
    }

    staged.record_phase(crate::rename_transaction::RenamePhase::FileMoveDone)?;
    if let Err(error) = move_note_history(root, from_path.as_str(), to_path.as_str()) {
        let _ = staged.abort();
        return Err(error);
    }

    let output = RenameNoteApplyOutput {
        from_path: from_path.to_string(),
        to_path: to_path.to_string(),
        affected_files: preview.affected_files,
        link_edits: preview.link_edits,
    };

    Ok((output, staged))
}

fn note_paths_for_rewrite(root: &VaultRoot) -> Result<Vec<String>, VaultError> {
    Ok(list_notes(root)?
        .into_iter()
        .map(|path| path.to_string())
        .collect())
}

fn wikilink_index_for_vault(
    vault_id: &str,
    root: &VaultRoot,
    note_paths: &[String],
) -> Result<WikilinkIndex, VaultError> {
    let mut resolver = WikilinkIndex::from_note_paths(note_paths);
    for path in note_paths {
        let relative = RelativeVaultPath::parse(path)?;
        let title = read_note(vault_id, root, &relative)?.metadata.title;
        resolver.register_aliases(path, &[title]);
    }
    Ok(resolver)
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

fn title_for_path(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
) -> Result<String, VaultError> {
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
    let note_paths: Vec<String> = notes.iter().map(ToString::to_string).collect();
    let mut resolver = WikilinkIndex::from_note_paths(&note_paths);
    for note_path in &notes {
        let document = read_note("health", root, note_path)?;
        resolver.register_aliases(note_path.as_str(), &[document.metadata.title]);
    }

    let mut unresolved = Vec::new();
    for note_path in notes {
        let markdown = read_note("health", root, &note_path)?.markdown;
        for capture in WIKILINK_RE.captures_iter(&markdown) {
            let target = capture
                .get(1)
                .map(|value| value.as_str().trim())
                .unwrap_or("");
            if target.is_empty() {
                continue;
            }
            if resolver.resolve(target).kind != WikilinkResolutionKind::Resolved {
                unresolved.push((note_path.to_string(), target.to_string()));
            }
        }
    }

    Ok(unresolved)
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
