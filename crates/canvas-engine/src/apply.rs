use std::fs;
use std::io::Read;
use std::path::Path;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::CanvasError;
use crate::scene::{CanvasDocument, document_to_json, parse_document_json};
use crate::templates::{TemplateApplyPreview, apply_template_dry_run};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateApplyOutput {
    pub document: CanvasDocument,
    pub template_id: String,
    pub patch_id: String,
    pub checkpoint_path: String,
    pub blocks_added: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateUndoCheckpoint {
    pub patch_id: String,
    pub template_id: String,
    pub canvas_id: String,
    pub created_at: String,
    pub previous_document_json: String,
    pub patch_log: Vec<String>,
}

pub fn apply_template(
    vault_root: &Path,
    document: &CanvasDocument,
    template_id: &str,
) -> Result<TemplateApplyOutput, CanvasError> {
    let preview = apply_template_dry_run(document, template_id)?;
    let patch_id = Uuid::new_v4().to_string();
    let checkpoint_path = write_undo_checkpoint(vault_root, document, &preview, &patch_id)?;

    let mut next = document.clone();
    next.blocks.extend(preview.blocks_added.clone());
    next.updated_at = chrono::Utc::now().to_rfc3339();

    Ok(TemplateApplyOutput {
        blocks_added: preview.blocks_added.len(),
        document: next,
        template_id: preview.template_id,
        patch_id,
        checkpoint_path,
    })
}

pub fn restore_template_checkpoint(
    vault_root: &Path,
    patch_id: &str,
) -> Result<CanvasDocument, CanvasError> {
    let file = checkpoint_path(vault_root, patch_id)?;
    let raw = fs::read_to_string(&file).map_err(|source| CanvasError::IoRead {
        path: file.clone(),
        source,
    })?;
    let checkpoint: TemplateUndoCheckpoint = serde_json::from_str(&raw)
        .map_err(|error| CanvasError::InvalidDocument(error.to_string()))?;
    parse_document_json(&checkpoint.previous_document_json)
        .map_err(|error| CanvasError::InvalidDocument(error.to_string()))
}

/// Bounded read-only inspection of Canvas template undo checkpoints for the
/// Recovery Center. No payload bytes or host filesystem paths are returned.
/// `complete` means the directory scan was bounded and completed; it does not
/// mean that any restore was authorized or that a disk snapshot is immutable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasRecoveryInventory {
    pub vault_id: String,
    pub checkpoint_count: usize,
    pub invalid_count: usize,
    pub complete: bool,
}

const MAX_CHECKPOINT_ENTRIES: usize = 10_000;
const MAX_CHECKPOINT_BYTES: u64 = 32 * 1024 * 1024;

pub fn list_template_checkpoints(
    vault_root: &Path,
    expected_vault_id: &str,
) -> Result<CanvasRecoveryInventory, CanvasError> {
    if expected_vault_id.trim().is_empty() {
        return Err(CanvasError::InvalidDocument(
            "missing checkpoint owner vault".into(),
        ));
    }
    let mut inventory = CanvasRecoveryInventory {
        vault_id: expected_vault_id.to_owned(),
        checkpoint_count: 0,
        invalid_count: 0,
        complete: true,
    };
    let directory = patches_dir(vault_root);
    // An absent source is a real empty directory. An unreadable or symlinked
    // source is NOT evidence of zero recovery checkpoints.
    // Inspect every existing ancestor before treating an absent final folder
    // as a verified empty source. A symlinked parent may hide checkpoints
    // outside the vault even when its `patches` child is missing.
    for relative in [".scriptor", ".scriptor/canvas", ".scriptor/canvas/patches"] {
        let ancestor = vault_root.join(relative);
        let metadata = match fs::symlink_metadata(&ancestor) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(inventory),
            Err(source) => {
                return Err(CanvasError::IoRead {
                    path: ancestor,
                    source,
                });
            }
        };
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(CanvasError::InvalidDocument(
                "unsafe Canvas recovery checkpoint directory".into(),
            ));
        }
    }
    let canonical_root = fs::canonicalize(vault_root).map_err(|source| CanvasError::IoRead {
        path: vault_root.to_path_buf(),
        source,
    })?;
    let canonical_directory =
        fs::canonicalize(&directory).map_err(|source| CanvasError::IoRead {
            path: directory.clone(),
            source,
        })?;
    if !canonical_directory.starts_with(canonical_root) {
        return Err(CanvasError::InvalidDocument(
            "Canvas recovery checkpoints leave the vault".into(),
        ));
    }

    let entries = fs::read_dir(&directory).map_err(|source| CanvasError::IoRead {
        path: directory.clone(),
        source,
    })?;
    let mut considered = 0usize;
    for item in entries {
        considered += 1;
        if considered > MAX_CHECKPOINT_ENTRIES {
            return Err(CanvasError::InvalidDocument(
                "Canvas checkpoint inventory exceeds safe bound".into(),
            ));
        }
        let item = item.map_err(|source| CanvasError::IoRead {
            path: directory.clone(),
            source,
        })?;
        let file_name = item.file_name();
        let Some(name) = file_name.to_str() else {
            inventory.invalid_count += 1;
            continue;
        };
        if !name.starts_with("template-") {
            continue;
        }
        let Some(patch_id) = name
            .strip_prefix("template-")
            .and_then(|name| name.strip_suffix(".json"))
        else {
            inventory.invalid_count += 1;
            continue;
        };
        if validate_patch_id(patch_id).is_err() {
            inventory.invalid_count += 1;
            continue;
        }
        let path = item.path();
        // Never follow a checkpoint symlink, even one pointing inside the vault.
        let Ok(file_metadata) = fs::symlink_metadata(&path) else {
            inventory.invalid_count += 1;
            continue;
        };
        if !file_metadata.is_file()
            || file_metadata.file_type().is_symlink()
            || file_metadata.len() > MAX_CHECKPOINT_BYTES
        {
            inventory.invalid_count += 1;
            continue;
        }
        // Metadata size is not an allocation cap if the file grows between
        // stat and read. Limit the actual bytes consumed as well.
        let valid = fs::File::open(&path)
            .ok()
            .and_then(|file| {
                let mut bytes = Vec::new();
                file.take(MAX_CHECKPOINT_BYTES + 1)
                    .read_to_end(&mut bytes)
                    .ok()?;
                if bytes.len() as u64 > MAX_CHECKPOINT_BYTES {
                    return None;
                }
                serde_json::from_slice::<TemplateUndoCheckpoint>(&bytes).ok()
            })
            .and_then(|record| {
                let document = parse_document_json(&record.previous_document_json).ok()?;
                Some(
                    record.patch_id == patch_id
                        && record.canvas_id == document.id
                        && document.vault_id == expected_vault_id
                        && !record.template_id.trim().is_empty(),
                )
            })
            .unwrap_or(false);
        if valid {
            inventory.checkpoint_count += 1;
        } else {
            inventory.invalid_count += 1;
        }
    }
    Ok(inventory)
}

fn write_undo_checkpoint(
    vault_root: &Path,
    document: &CanvasDocument,
    preview: &TemplateApplyPreview,
    patch_id: &str,
) -> Result<String, CanvasError> {
    let dir = patches_dir(vault_root);
    fs::create_dir_all(&dir).map_err(|source| CanvasError::IoWrite {
        path: dir.clone(),
        source,
    })?;

    let checkpoint = TemplateUndoCheckpoint {
        patch_id: patch_id.to_string(),
        template_id: preview.template_id.clone(),
        canvas_id: document.id.clone(),
        created_at: chrono::Utc::now().to_rfc3339(),
        previous_document_json: document_to_json(document)
            .map_err(|error| CanvasError::InvalidDocument(error.to_string()))?,
        patch_log: preview.patch_log.clone(),
    };

    let file = checkpoint_path(vault_root, patch_id)?;
    let payload = serde_json::to_string_pretty(&checkpoint)
        .map_err(|error| CanvasError::InvalidDocument(error.to_string()))?;
    fs::write(&file, &payload).map_err(|source| CanvasError::IoWrite {
        path: file.clone(),
        source,
    })?;

    Ok(file
        .strip_prefix(vault_root)
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| file.display().to_string()))
}

fn patches_dir(vault_root: &Path) -> std::path::PathBuf {
    vault_root.join(".scriptor/canvas/patches")
}

/// Resolve the checkpoint file for `patch_id`, rejecting anything that is not a
/// plain identifier.
///
/// `patch_id` reaches this crate straight from an IPC payload. Interpolating it
/// into a file name unchecked let `x/../../../../etc/hosts` escape the patches
/// directory and have an arbitrary file read and JSON-parsed.
fn checkpoint_path(vault_root: &Path, patch_id: &str) -> Result<std::path::PathBuf, CanvasError> {
    validate_patch_id(patch_id)?;
    Ok(patches_dir(vault_root).join(format!("template-{patch_id}.json")))
}

/// Longest accepted patch id. Real ids are UUIDs (36 chars).
const MAX_PATCH_ID_LEN: usize = 64;

fn validate_patch_id(patch_id: &str) -> Result<(), CanvasError> {
    if patch_id.is_empty() || patch_id.len() > MAX_PATCH_ID_LEN {
        return Err(CanvasError::InvalidDocument(format!(
            "invalid patch id: must be 1..={MAX_PATCH_ID_LEN} characters"
        )));
    }
    if !patch_id
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err(CanvasError::InvalidDocument(
            "invalid patch id: only [A-Za-z0-9_-] are allowed".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::empty_document;

    #[test]
    fn mat003_checkpoint_inventory_distinguishes_empty_valid_and_corrupt_sources() {
        let temp = tempfile::tempdir().expect("root");
        let root = temp.path();
        let empty = list_template_checkpoints(root, "vault-1").expect("absent source is empty");
        assert_eq!(empty.checkpoint_count, 0);
        assert_eq!(empty.invalid_count, 0);
        assert!(empty.complete);
        assert_eq!(empty.vault_id, "vault-1");

        let document = empty_document("vault-1", "Board");
        let applied = apply_template(root, &document, "weekly-plan").expect("checkpoint");
        let valid =
            list_template_checkpoints(root, "vault-1").expect("read current-vault checkpoints");
        assert_eq!(valid.checkpoint_count, 1);
        assert_eq!(valid.invalid_count, 0);
        let folder = patches_dir(root);
        fs::write(folder.join("template-corrupt.json"), "{not-json").expect("bad fixture");
        let mixed = list_template_checkpoints(root, "vault-1").expect("mixed inventory");
        assert_eq!(mixed.checkpoint_count, 1);
        assert_eq!(
            mixed.invalid_count, 1,
            "corrupt checkpoints prevent verified empty claims"
        );

        let unrelated = list_template_checkpoints(root, "vault-2").expect("wrong owner");
        assert_eq!(unrelated.checkpoint_count, 0);
        assert_eq!(
            unrelated.invalid_count, 2,
            "foreign-vault checkpoints cannot be accepted"
        );
        assert!(
            applied
                .checkpoint_path
                .ends_with(&format!("template-{}.json", applied.patch_id))
        );
    }

    #[test]
    fn mat003_checkpoint_inventory_rejects_oversized_recovery_candidates() {
        let temp = tempfile::tempdir().expect("root");
        let folder = patches_dir(temp.path());
        fs::create_dir_all(&folder).expect("checkpoint folder");
        let file = fs::File::create(folder.join("template-large.json")).expect("large fixture");
        file.set_len(MAX_CHECKPOINT_BYTES + 1)
            .expect("sparse oversized fixture");
        let inventory = list_template_checkpoints(temp.path(), "vault-1").expect("scan");
        assert_eq!(inventory.checkpoint_count, 0);
        assert_eq!(inventory.invalid_count, 1);
    }

    #[cfg(unix)]
    #[test]
    fn mat003_checkpoint_inventory_refuses_symlink_escape_without_reading_external_files() {
        use std::os::unix::fs::symlink;
        let vault = tempfile::tempdir().expect("root");
        let outside = tempfile::tempdir().expect("outside");
        let folder = patches_dir(vault.path());
        fs::create_dir_all(folder.parent().expect("canvas directory")).expect("canvas directory");
        symlink(outside.path(), &folder).expect("symlinked directory");
        let error = list_template_checkpoints(vault.path(), "vault-1").expect_err("escape denied");
        assert!(matches!(error, CanvasError::InvalidDocument(_)));
    }

    #[cfg(unix)]
    #[test]
    fn mat003_checkpoint_inventory_rejects_symlinked_ancestors_with_missing_patch_folder() {
        use std::os::unix::fs::symlink;
        for ancestor in [".scriptor", ".scriptor/canvas"] {
            let vault = tempfile::tempdir().expect("vault");
            let outside = tempfile::tempdir().expect("outside");
            let path = vault.path().join(ancestor);
            fs::create_dir_all(path.parent().expect("ancestor parent")).expect("ancestor parent");
            symlink(outside.path(), &path).expect("symlink ancestor");
            let error = list_template_checkpoints(vault.path(), "vault-1")
                .expect_err("symlinked parent cannot certify empty checkpoints");
            assert!(
                matches!(error, CanvasError::InvalidDocument(_)),
                "{ancestor}"
            );
        }
    }

    #[test]
    fn traversal_patch_ids_are_rejected() {
        let root = Path::new("/vault");
        for hostile in [
            "x/../../../../etc/hosts",
            "../../secret",
            "..",
            "a/b",
            "a\\b",
            "a\0b",
            "",
            "a.json",
            "%2e%2e",
        ] {
            let error = checkpoint_path(root, hostile)
                .err()
                .unwrap_or_else(|| panic!("patch id {hostile:?} must be rejected"));
            assert!(matches!(error, CanvasError::InvalidDocument(_)));
        }
    }

    #[test]
    fn restore_rejects_traversal_without_touching_the_filesystem() {
        let temp = std::env::temp_dir().join(format!("scriptor-canvas-apply-{}", Uuid::new_v4()));
        let error = restore_template_checkpoint(&temp, "x/../../../../etc/hosts")
            .expect_err("traversal must be rejected");
        assert!(matches!(error, CanvasError::InvalidDocument(_)));
    }

    #[test]
    fn overlong_patch_id_is_rejected() {
        let id = "a".repeat(MAX_PATCH_ID_LEN + 1);
        assert!(checkpoint_path(Path::new("/vault"), &id).is_err());
    }

    #[test]
    fn uuid_patch_ids_are_accepted() {
        let id = Uuid::new_v4().to_string();
        let path = checkpoint_path(Path::new("/vault"), &id).expect("uuid is a valid patch id");
        assert!(path.ends_with(format!("template-{id}.json")));
    }

    #[test]
    fn apply_then_restore_round_trips() {
        let temp =
            std::env::temp_dir().join(format!("scriptor-canvas-apply-rt-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp).expect("temp");

        let document = empty_document("vault-1", "Board");
        let applied = apply_template(&temp, &document, "weekly-plan").expect("apply");
        assert!(applied.blocks_added > 0);

        let restored = restore_template_checkpoint(&temp, &applied.patch_id).expect("restore");
        assert_eq!(restored.blocks.len(), document.blocks.len());

        let _ = fs::remove_dir_all(&temp);
    }
}
