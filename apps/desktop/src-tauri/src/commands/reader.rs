use scriptor_vault::RelativeVaultPath;
use serde::{Deserialize, Serialize};

use crate::state::active_session;
use crate::AppState;

const ANNOTATIONS_PATH: &str = ".scriptor/reader/annotations.json";
const MAX_DOCUMENT_BYTES: u64 = 128 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderAnnotationRecord {
    id: String,
    anchor: String,
    quote: String,
    body: String,
    color: String,
    created_at: String,
}

#[derive(Debug, Default, Deserialize, Serialize)]
struct AnnotationStore {
    version: u8,
    documents: std::collections::BTreeMap<String, Vec<ReaderAnnotationRecord>>,
}

#[tauri::command]
pub fn reader_read_document(
    state: tauri::State<AppState>,
    rel_path: String,
) -> Result<Vec<u8>, String> {
    let session = active_session(&state)?;
    let relative = document_path(&rel_path)?;
    let path = session
        .root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    let metadata = std::fs::metadata(&path)
        .map_err(|error| format!("cannot read reader document: {error}"))?;
    if metadata.len() > MAX_DOCUMENT_BYTES {
        return Err("Reader documents must be 128 MiB or smaller".into());
    }
    std::fs::read(path).map_err(|error| format!("cannot read reader document: {error}"))
}

#[tauri::command]
pub fn reader_load_annotations(
    state: tauri::State<AppState>,
    rel_path: String,
) -> Result<Vec<ReaderAnnotationRecord>, String> {
    let session = active_session(&state)?;
    let document = document_path(&rel_path)?.to_string();
    let store = load_store(session.root.root())?;
    Ok(store.documents.get(&document).cloned().unwrap_or_default())
}

#[tauri::command]
pub fn reader_save_annotations(
    state: tauri::State<AppState>,
    rel_path: String,
    annotations: Vec<ReaderAnnotationRecord>,
) -> Result<(), String> {
    let session = active_session(&state)?;
    let document = document_path(&rel_path)?.to_string();
    let mut store = load_store(session.root.root())?;
    store.version = 1;
    store.documents.insert(document, annotations);
    save_store(session.root.root(), &store)
}

fn document_path(raw: &str) -> Result<RelativeVaultPath, String> {
    let path = RelativeVaultPath::parse(raw).map_err(|error| error.to_string())?;
    match raw
        .rsplit('.')
        .next()
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("pdf") | Some("epub") => Ok(path),
        _ => Err("Reader supports only PDF and EPUB files".into()),
    }
}

fn load_store(root: &std::path::Path) -> Result<AnnotationStore, String> {
    let path = root.join(ANNOTATIONS_PATH);
    if !path.exists() {
        return Ok(AnnotationStore::default());
    }
    serde_json::from_slice(&std::fs::read(path).map_err(|error| error.to_string())?)
        .map_err(|_| "Reader annotations are corrupt; they were not changed".into())
}

fn save_store(root: &std::path::Path, store: &AnnotationStore) -> Result<(), String> {
    let path = root.join(ANNOTATIONS_PATH);
    let parent = path
        .parent()
        .ok_or("reader annotation path has no parent")?;
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = parent.join("annotations.json.tmp");
    std::fs::write(
        &temporary,
        serde_json::to_vec_pretty(store).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    std::fs::rename(temporary, path).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsupported_and_escaping_document_paths() {
        assert!(document_path("../secret.pdf").is_err());
        assert!(document_path("notes/book.txt").is_err());
        assert!(document_path("notes/book.epub").is_ok());
    }

    #[test]
    fn annotations_survive_store_restart() {
        let temp = tempfile::tempdir().unwrap();
        let mut store = AnnotationStore {
            version: 1,
            ..Default::default()
        };
        store.documents.insert(
            "book.pdf".into(),
            vec![ReaderAnnotationRecord {
                id: "a1".into(),
                anchor: "1".into(),
                quote: "quote".into(),
                body: "".into(),
                color: "yellow".into(),
                created_at: "2026-01-01T00:00:00Z".into(),
            }],
        );
        save_store(temp.path(), &store).unwrap();
        assert_eq!(
            load_store(temp.path()).unwrap().documents["book.pdf"][0].id,
            "a1"
        );
    }
}
