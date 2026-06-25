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
    let file = patches_dir(vault_root).join(format!("template-{patch_id}.json"));
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

    let file = dir.join(format!("template-{patch_id}.json"));
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
