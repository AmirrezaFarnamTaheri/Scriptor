use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::CanvasError;
use crate::scene::{document_to_json, parse_document_json, CanvasDocument};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasDocumentSummary {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    pub block_count: usize,
    pub path: String,
}

pub fn canvas_boards_dir(vault_root: &Path) -> PathBuf {
    vault_root.join(".scriptor/canvas/boards")
}

pub fn save_document(vault_root: &Path, document: &CanvasDocument) -> Result<PathBuf, CanvasError> {
    let dir = canvas_boards_dir(vault_root);
    fs::create_dir_all(&dir).map_err(|source| CanvasError::IoWrite {
        path: dir.clone(),
        source,
    })?;

    let file_name = format!("{}.canvas.json", sanitize_id(&document.id));
    let path = dir.join(file_name);
    let json = document_to_json(document).map_err(|error| CanvasError::InvalidDocument(error.to_string()))?;
    fs::write(&path, json).map_err(|source| CanvasError::IoWrite {
        path: path.clone(),
        source,
    })?;
    Ok(path)
}

pub fn load_document(vault_root: &Path, canvas_id: &str) -> Result<CanvasDocument, CanvasError> {
    let path = canvas_boards_dir(vault_root).join(format!("{}.canvas.json", sanitize_id(canvas_id)));
    let raw = fs::read_to_string(&path).map_err(|source| CanvasError::IoRead { path, source })?;
    parse_document_json(&raw).map_err(|error| CanvasError::InvalidDocument(error.to_string()))
}

pub fn list_documents(vault_root: &Path) -> Result<Vec<CanvasDocumentSummary>, CanvasError> {
    let dir = canvas_boards_dir(vault_root);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut summaries = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|source| CanvasError::IoRead {
        path: dir.clone(),
        source,
    })? {
        let entry = entry.map_err(|source| CanvasError::IoRead {
            path: dir.clone(),
            source,
        })?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let raw = fs::read_to_string(&path).map_err(|source| CanvasError::IoRead {
            path: path.clone(),
            source,
        })?;
        let document = parse_document_json(&raw)
            .map_err(|error| CanvasError::InvalidDocument(error.to_string()))?;
        summaries.push(CanvasDocumentSummary {
            id: document.id.clone(),
            title: document.title.clone(),
            updated_at: document.updated_at.clone(),
            block_count: document.blocks.len(),
            path: path.display().to_string(),
        });
    }

    summaries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(summaries)
}

fn sanitize_id(id: &str) -> String {
    id.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::templates::empty_document;

    #[test]
    fn round_trip_save_and_load() {
        let temp = std::env::temp_dir().join(format!("scriptor-canvas-store-{}", uuid::Uuid::new_v4()));
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).expect("temp");

        let document = empty_document("vault-1", "Board");
        save_document(&temp, &document).expect("save");
        let loaded = load_document(&temp, &document.id).expect("load");
        assert_eq!(loaded.title, "Board");

        let _ = fs::remove_dir_all(&temp);
    }
}
