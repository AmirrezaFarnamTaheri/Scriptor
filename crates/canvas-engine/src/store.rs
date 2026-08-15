use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::CanvasError;
use crate::scene::{CanvasDocument, document_to_json, parse_document_json};

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

    let path = dir.join(board_file_name(&document.id)?);
    let json = document_to_json(document)
        .map_err(|error| CanvasError::InvalidDocument(error.to_string()))?;
    scriptor_vault::atomic_write(&path, json.as_bytes()).map_err(|error| CanvasError::IoWrite {
        path: path.clone(),
        source: std::io::Error::other(error.to_string()),
    })?;
    Ok(path)
}

pub fn load_document(vault_root: &Path, canvas_id: &str) -> Result<CanvasDocument, CanvasError> {
    let dir = canvas_boards_dir(vault_root);
    let path = dir.join(board_file_name(canvas_id)?);
    // Boards saved by an older build used the lossy `sanitize_id` name. Resolve
    // it when the canonical name is absent so nothing already on disk is
    // orphaned by the encoding change.
    let path = if path.exists() {
        path
    } else {
        let legacy = dir.join(format!("{}.canvas.json", legacy_sanitize_id(canvas_id)));
        if legacy.exists() { legacy } else { path }
    };
    let raw = fs::read_to_string(&path).map_err(|source| CanvasError::IoRead { path, source })?;
    parse_document_json(&raw).map_err(|error| CanvasError::InvalidDocument(error.to_string()))
}

pub fn list_documents(vault_root: &Path) -> Result<Vec<CanvasDocumentSummary>, CanvasError> {
    Ok(list_documents_reporting_skipped(vault_root)?.0)
}

/// Like [`list_documents`], but also returns a human-readable reason for every
/// board file that had to be skipped.
///
/// One corrupt board must not make the entire vault's board list unusable, so
/// unreadable and unparsable files are reported rather than propagated.
pub fn list_documents_reporting_skipped(
    vault_root: &Path,
) -> Result<(Vec<CanvasDocumentSummary>, Vec<String>), CanvasError> {
    let dir = canvas_boards_dir(vault_root);
    if !dir.exists() {
        return Ok((Vec::new(), Vec::new()));
    }

    let mut summaries = Vec::new();
    let mut skipped = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|source| CanvasError::IoRead {
        path: dir.clone(),
        source,
    })? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                skipped.push(format!("unreadable directory entry: {error}"));
                continue;
            }
        };
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let raw = match fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(error) => {
                skipped.push(format!("{}: {error}", path.display()));
                continue;
            }
        };
        let document = match parse_document_json(&raw) {
            Ok(document) => document,
            Err(error) => {
                skipped.push(format!("{}: {error}", path.display()));
                continue;
            }
        };
        summaries.push(CanvasDocumentSummary {
            id: document.id.clone(),
            title: document.title.clone(),
            updated_at: document.updated_at.clone(),
            block_count: document.blocks.len(),
            path: path.display().to_string(),
        });
    }

    summaries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok((summaries, skipped))
}

/// Longest accepted canvas id, so the encoded file name stays well inside the
/// 255-byte limit every mainstream filesystem imposes.
const MAX_CANVAS_ID_LEN: usize = 128;

/// Build the on-disk file name for `canvas_id`.
///
/// The mapping must be *injective*: the old `sanitize_id` rewrote every
/// character outside `[A-Za-z0-9_-]` to `-`, so `my board` and `my-board`
/// landed on the same file and the second save silently destroyed the first
/// board. An empty or all-punctuation id degenerated to `.canvas.json`.
///
/// Percent-encoding every other byte is reversible and therefore collision
/// free, while ids that were already safe (UUIDs, slugs -- i.e. everything
/// written by real callers) keep exactly the file name they have today, so no
/// existing board is orphaned.
fn board_file_name(canvas_id: &str) -> Result<String, CanvasError> {
    Ok(format!("{}.canvas.json", encode_id(canvas_id)?))
}

fn encode_id(canvas_id: &str) -> Result<String, CanvasError> {
    if canvas_id.is_empty() {
        return Err(CanvasError::InvalidDocument(
            "canvas id must not be empty".into(),
        ));
    }
    if canvas_id.len() > MAX_CANVAS_ID_LEN {
        return Err(CanvasError::InvalidDocument(format!(
            "canvas id must be at most {MAX_CANVAS_ID_LEN} bytes, got {}",
            canvas_id.len()
        )));
    }

    let mut encoded = String::with_capacity(canvas_id.len());
    for byte in canvas_id.as_bytes() {
        if byte.is_ascii_alphanumeric() || *byte == b'-' || *byte == b'_' {
            encoded.push(*byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    Ok(encoded)
}

/// The historical, lossy mapping. Kept only to resolve boards that were saved
/// before the encoding above landed.
fn legacy_sanitize_id(id: &str) -> String {
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
        let temp =
            std::env::temp_dir().join(format!("scriptor-canvas-store-{}", uuid::Uuid::new_v4()));
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).expect("temp");

        let document = empty_document("vault-1", "Board");
        save_document(&temp, &document).expect("save");
        let loaded = load_document(&temp, &document.id).expect("load");
        assert_eq!(loaded.title, "Board");

        let _ = fs::remove_dir_all(&temp);
    }

    fn document_with_id(id: &str, title: &str) -> CanvasDocument {
        let mut document = empty_document("vault-1", title);
        document.id = id.to_string();
        document
    }

    #[test]
    fn plain_ids_keep_their_historical_file_name() {
        // Backward compatibility: UUIDs and slugs must not be re-encoded.
        assert_eq!(
            board_file_name("2f7c9b3a-0e1d-4a55-9d2a-6b1c8e4f0a11").unwrap(),
            "2f7c9b3a-0e1d-4a55-9d2a-6b1c8e4f0a11.canvas.json"
        );
        assert_eq!(board_file_name("my-board").unwrap(), "my-board.canvas.json");
        assert_eq!(
            board_file_name("my-board").unwrap(),
            format!("{}.canvas.json", legacy_sanitize_id("my-board"))
        );
    }

    #[test]
    fn distinct_ids_never_share_a_file() {
        let colliding = [
            "my board", "my-board", "my_board", "my/board", "my.board", "my%board", "MY BOARD",
        ];
        let names: Vec<String> = colliding
            .iter()
            .map(|id| board_file_name(id).expect("encode"))
            .collect();
        let mut unique = names.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(
            unique.len(),
            names.len(),
            "encoding must be injective: {names:?}"
        );
    }

    #[test]
    fn empty_and_punctuation_ids_are_handled() {
        assert!(board_file_name("").is_err(), "empty id must be rejected");
        // All-punctuation used to collapse to ".canvas.json"; now it is distinct.
        assert_eq!(board_file_name("...").unwrap(), "%2E%2E%2E.canvas.json");
        assert_ne!(
            board_file_name("...").unwrap(),
            board_file_name("///").unwrap()
        );
    }

    #[test]
    fn overlong_id_is_rejected() {
        let id = "a".repeat(MAX_CANVAS_ID_LEN + 1);
        assert!(board_file_name(&id).is_err());
    }

    #[test]
    fn similar_ids_do_not_overwrite_each_other() {
        let temp =
            std::env::temp_dir().join(format!("scriptor-canvas-collide-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp).expect("temp");

        save_document(&temp, &document_with_id("my board", "Spaced")).expect("save spaced");
        save_document(&temp, &document_with_id("my-board", "Hyphenated")).expect("save hyphenated");

        assert_eq!(
            load_document(&temp, "my board").expect("load").title,
            "Spaced"
        );
        assert_eq!(
            load_document(&temp, "my-board").expect("load").title,
            "Hyphenated"
        );

        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn legacy_file_name_still_loads() {
        let temp =
            std::env::temp_dir().join(format!("scriptor-canvas-legacy-{}", uuid::Uuid::new_v4()));
        let dir = canvas_boards_dir(&temp);
        fs::create_dir_all(&dir).expect("temp");

        // Simulate a board written by the old lossy scheme.
        let document = document_with_id("my board", "Legacy");
        let json = document_to_json(&document).expect("json");
        fs::write(dir.join("my-board.canvas.json"), json).expect("write legacy");

        assert_eq!(
            load_document(&temp, "my board").expect("load").title,
            "Legacy"
        );

        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn corrupt_board_is_skipped_not_fatal() {
        let temp =
            std::env::temp_dir().join(format!("scriptor-canvas-corrupt-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temp).expect("temp");
        save_document(&temp, &document_with_id("good-board", "Good")).expect("save");
        fs::write(
            canvas_boards_dir(&temp).join("broken.canvas.json"),
            "{ not json",
        )
        .expect("write corrupt");

        let (summaries, skipped) = list_documents_reporting_skipped(&temp).expect("list");
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].id, "good-board");
        assert_eq!(skipped.len(), 1);
        assert!(skipped[0].contains("broken.canvas.json"));
        // The convenience wrapper stays infallible for the same input.
        assert_eq!(list_documents(&temp).expect("list").len(), 1);

        let _ = fs::remove_dir_all(&temp);
    }
}
