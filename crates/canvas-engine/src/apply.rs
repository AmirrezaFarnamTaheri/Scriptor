use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::CanvasError;
use crate::scene::{document_to_json, parse_document_json, CanvasDocument};
use crate::templates::{apply_template_dry_run, TemplateApplyPreview};

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
    let checkpoint: TemplateUndoCheckpoint =
        serde_json::from_str(&raw).map_err(|error| CanvasError::InvalidDocument(error.to_string()))?;
    parse_document_json(&checkpoint.previous_document_json)
        .map_err(|error| CanvasError::InvalidDocument(error.to_string()))
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
        let temp = std::env::temp_dir().join(format!("scriptor-canvas-apply-rt-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp).expect("temp");

        let document = empty_document("vault-1", "Board");
        let applied = apply_template(&temp, &document, "weekly-plan").expect("apply");
        assert!(applied.blocks_added > 0);

        let restored = restore_template_checkpoint(&temp, &applied.patch_id).expect("restore");
        assert_eq!(restored.blocks.len(), document.blocks.len());

        let _ = fs::remove_dir_all(&temp);
    }
}
