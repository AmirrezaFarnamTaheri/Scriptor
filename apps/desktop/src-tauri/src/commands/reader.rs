use std::io::Read;

use scriptor_vault::{RelativeVaultPath, VaultRoot, atomic_write, lock_vault_update};
use serde::{Deserialize, Serialize};

use super::vault::validate_expected_vault;
use crate::AppState;
use crate::state::active_session;

const MAX_DOCUMENT_BYTES: u64 = 128 * 1024 * 1024;
const MAX_MEDIA_PREVIEW_BYTES: u64 = 32 * 1024 * 1024;
const MAX_ANNOTATION_STORE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_ANNOTATION_DOCUMENTS: usize = 4_096;
const MAX_ANNOTATIONS_PER_DOCUMENT: usize = 5_000;
const MAX_ANNOTATION_ID_BYTES: usize = 256;
const MAX_ANNOTATION_ANCHOR_BYTES: usize = 8 * 1024;
const MAX_ANNOTATION_QUOTE_BYTES: usize = 32 * 1024;
const MAX_ANNOTATION_BODY_BYTES: usize = 64 * 1024;
const MAX_ANNOTATION_COLOR_BYTES: usize = 128;
const MAX_ANNOTATION_TIMESTAMP_BYTES: usize = 128;

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
    expected_vault_id: Option<String>,
) -> Result<tauri::ipc::Response, String> {
    let session = active_session(&state)?;
    validate_expected_vault(&session.descriptor.id, expected_vault_id.as_deref())?;
    let (relative, maximum_bytes) = readable_media_path(&rel_path)?;
    let path = session
        .root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    let file = std::fs::File::open(&path)
        .map_err(|error| format!("cannot read reader document: {error}"))?;
    let metadata = file
        .metadata()
        .map_err(|error| format!("cannot inspect reader document: {error}"))?;
    if !metadata.is_file() {
        return Err("Reader document must be a regular file".into());
    }
    if metadata.len() > maximum_bytes {
        return Err(format!(
            "Source previews must be {} MiB or smaller",
            maximum_bytes / (1024 * 1024)
        ));
    }

    // Keep the size cap tied to the same open handle used for the read. The
    // path can be replaced or the file can grow after metadata is inspected;
    // `take(MAX + 1)` guarantees the bridge never allocates an unbounded
    // replacement even in that race.
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    let mut bounded = file.take(maximum_bytes + 1);
    bounded
        .read_to_end(&mut bytes)
        .map_err(|error| format!("cannot read reader document: {error}"))?;
    if bytes.len() as u64 > maximum_bytes {
        return Err(format!(
            "Source previews must be {} MiB or smaller",
            maximum_bytes / (1024 * 1024)
        ));
    }
    Ok(tauri::ipc::Response::new(bytes))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderViewerLocation {
    pub url: String,
    pub origin: String,
}

#[tauri::command]
pub fn reader_viewer_location(document_type: String) -> Result<ReaderViewerLocation, String> {
    let filename = match document_type.as_str() {
        "pdf" => "pdf-viewer.html",
        "epub" => "epub-viewer.html",
        _ => return Err("Reader supports only PDF and EPUB viewers".into()),
    };

    #[cfg(any(target_os = "windows", target_os = "android"))]
    let (origin, url) = (
        "http://reader.localhost".to_string(),
        format!("http://reader.localhost/{filename}"),
    );
    #[cfg(not(any(target_os = "windows", target_os = "android")))]
    let (origin, url) = (
        "reader://localhost".to_string(),
        format!("reader://localhost/{filename}"),
    );

    Ok(ReaderViewerLocation { url, origin })
}

#[tauri::command]
pub fn reader_load_annotations(
    state: tauri::State<AppState>,
    rel_path: String,
    expected_vault_id: Option<String>,
) -> Result<Vec<ReaderAnnotationRecord>, String> {
    let session = active_session(&state)?;
    validate_expected_vault(&session.descriptor.id, expected_vault_id.as_deref())?;
    let document = document_path(&rel_path)?.to_string();
    let store = load_store(session.root.root())?;
    Ok(store.documents.get(&document).cloned().unwrap_or_default())
}

#[tauri::command]
pub fn reader_save_annotations(
    state: tauri::State<AppState>,
    rel_path: String,
    annotations: Vec<ReaderAnnotationRecord>,
    expected_vault_id: Option<String>,
) -> Result<(), String> {
    let session = active_session(&state)?;
    validate_expected_vault(&session.descriptor.id, expected_vault_id.as_deref())?;
    let document = document_path(&rel_path)?.to_string();
    save_annotations_for_document(session.root.root(), &document, annotations)
}

fn save_annotations_for_document(
    root: &std::path::Path,
    document: &str,
    annotations: Vec<ReaderAnnotationRecord>,
) -> Result<(), String> {
    validate_annotations(&annotations)?;
    let store_path = annotation_store_path(root)?;
    let _store_lock = lock_vault_update(&store_path).map_err(|error| error.to_string())?;
    let mut store = load_store_for_write(root)?;
    if !store.documents.contains_key(document) && store.documents.len() >= MAX_ANNOTATION_DOCUMENTS
    {
        return Err(format!(
            "Reader annotation store supports at most {MAX_ANNOTATION_DOCUMENTS} documents"
        ));
    }
    store.version = 1;
    store.documents.insert(document.to_string(), annotations);
    save_store(root, &store)
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

fn readable_media_path(raw: &str) -> Result<(RelativeVaultPath, u64), String> {
    let suffix = raw
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    if matches!(suffix.as_str(), "pdf" | "epub") {
        return document_path(raw).map(|path| (path, MAX_DOCUMENT_BYTES));
    }
    if !matches!(
        suffix.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "mp3" | "wav" | "ogg" | "flac"
    ) {
        return Err("This media format is not supported for preview".into());
    }
    RelativeVaultPath::parse(raw)
        .map(|path| (path, MAX_MEDIA_PREVIEW_BYTES))
        .map_err(|error| error.to_string())
}

fn load_store(root: &std::path::Path) -> Result<AnnotationStore, String> {
    let path = annotation_store_path(root)?;
    if !path.try_exists().map_err(|error| error.to_string())? {
        return Ok(AnnotationStore::default());
    }
    let bytes = read_bounded_file(&path, MAX_ANNOTATION_STORE_BYTES)?;
    let store: AnnotationStore = serde_json::from_slice(&bytes)
        .map_err(|_| "Reader annotations are corrupt; they were not changed".to_string())?;
    validate_store(&store)?;
    Ok(store)
}

fn save_store(root: &std::path::Path, store: &AnnotationStore) -> Result<(), String> {
    validate_store(store)?;
    let path = annotation_store_path(root)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let payload = serde_json::to_vec_pretty(store).map_err(|error| error.to_string())?;
    if payload.len() as u64 > MAX_ANNOTATION_STORE_BYTES {
        return Err(format!(
            "Reader annotation store exceeds the {} MiB limit",
            MAX_ANNOTATION_STORE_BYTES / (1024 * 1024)
        ));
    }
    atomic_write(&path, &payload).map_err(|error| error.to_string())
}

fn annotation_store_path(root: &std::path::Path) -> Result<std::path::PathBuf, String> {
    let vault = VaultRoot::open(root).map_err(|error| error.to_string())?;
    let parent = RelativeVaultPath::parse(".scriptor/reader").map_err(|error| error.to_string())?;
    let parent = vault
        .resolve_relative(&parent)
        .map_err(|error| error.to_string())?;
    let path = parent.join("annotations.json");
    match std::fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            Err("Reader annotation store must be a regular file".into())
        }
        Ok(_) => Ok(path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(path),
        Err(error) => Err(format!("Cannot inspect reader annotation store: {error}")),
    }
}

/// A corrupt store is never discarded. On the next attempted write it is
/// moved aside verbatim, then a fresh store is created so the Reader does not
/// remain permanently unable to save annotations. The recovery copy is kept
/// next to the active store for manual inspection/restoration.
fn load_store_for_write(root: &std::path::Path) -> Result<AnnotationStore, String> {
    match load_store(root) {
        Ok(store) => Ok(store),
        Err(error) => {
            if !error.starts_with("Reader annotations are corrupt;") {
                return Err(error);
            }
            let path = annotation_store_path(root)?;
            if !path.try_exists().map_err(|error| error.to_string())? {
                return Err(error);
            }
            let parent = path
                .parent()
                .ok_or("reader annotation path has no parent")?;
            let recovery =
                parent.join(format!("annotations.corrupt-{}.json", uuid::Uuid::new_v4()));
            std::fs::rename(&path, &recovery).map_err(|rename_error| {
                format!(
                    "{error}; also failed to preserve the corrupt annotation store at {}: {rename_error}",
                    recovery.display()
                )
            })?;
            tracing::warn!(
                annotation_recovery = %recovery.display(),
                "quarantined corrupt Reader annotation store before continuing"
            );
            Ok(AnnotationStore::default())
        }
    }
}

fn read_bounded_file(path: &std::path::Path, max_bytes: u64) -> Result<Vec<u8>, String> {
    let file = std::fs::File::open(path).map_err(|error| error.to_string())?;
    let metadata = file.metadata().map_err(|error| error.to_string())?;
    if metadata.len() > max_bytes {
        return Err(format!("{} exceeds its size limit", path.display()));
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.take(max_bytes + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() as u64 > max_bytes {
        return Err(format!("{} exceeds its size limit", path.display()));
    }
    Ok(bytes)
}

fn validate_store(store: &AnnotationStore) -> Result<(), String> {
    if store.documents.len() > MAX_ANNOTATION_DOCUMENTS {
        return Err(format!(
            "Reader annotation store supports at most {MAX_ANNOTATION_DOCUMENTS} documents"
        ));
    }
    for annotations in store.documents.values() {
        validate_annotations(annotations)?;
    }
    Ok(())
}

fn validate_annotations(annotations: &[ReaderAnnotationRecord]) -> Result<(), String> {
    if annotations.len() > MAX_ANNOTATIONS_PER_DOCUMENT {
        return Err(format!(
            "Reader supports at most {MAX_ANNOTATIONS_PER_DOCUMENT} annotations per document"
        ));
    }
    for annotation in annotations {
        validate_field("annotation id", &annotation.id, 1, MAX_ANNOTATION_ID_BYTES)?;
        validate_field(
            "annotation anchor",
            &annotation.anchor,
            1,
            MAX_ANNOTATION_ANCHOR_BYTES,
        )?;
        validate_field(
            "annotation quote",
            &annotation.quote,
            0,
            MAX_ANNOTATION_QUOTE_BYTES,
        )?;
        validate_field(
            "annotation body",
            &annotation.body,
            0,
            MAX_ANNOTATION_BODY_BYTES,
        )?;
        validate_field(
            "annotation color",
            &annotation.color,
            0,
            MAX_ANNOTATION_COLOR_BYTES,
        )?;
        validate_field(
            "annotation timestamp",
            &annotation.created_at,
            1,
            MAX_ANNOTATION_TIMESTAMP_BYTES,
        )?;
    }
    Ok(())
}

fn validate_field(name: &str, value: &str, min: usize, max: usize) -> Result<(), String> {
    let len = value.len();
    if len < min || len > max {
        return Err(format!(
            "{name} must be between {min} and {max} UTF-8 bytes"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn annotation(id: &str) -> ReaderAnnotationRecord {
        ReaderAnnotationRecord {
            id: id.into(),
            anchor: "1".into(),
            quote: "quote".into(),
            body: "".into(),
            color: "yellow".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
        }
    }

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
        store
            .documents
            .insert("book.pdf".into(), vec![annotation("a1")]);
        save_store(temp.path(), &store).unwrap();
        assert_eq!(
            load_store(temp.path()).unwrap().documents["book.pdf"][0].id,
            "a1"
        );
    }

    #[test]
    fn concurrent_document_annotation_writes_do_not_lose_each_other() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().to_path_buf();
        let a_root = root.clone();
        let b_root = root.clone();
        let a = std::thread::spawn(move || {
            save_annotations_for_document(&a_root, "a.pdf", vec![annotation("a")]).unwrap();
        });
        let b = std::thread::spawn(move || {
            save_annotations_for_document(&b_root, "b.pdf", vec![annotation("b")]).unwrap();
        });
        a.join().unwrap();
        b.join().unwrap();

        let store = load_store(&root).unwrap();
        assert_eq!(store.documents["a.pdf"][0].id, "a");
        assert_eq!(store.documents["b.pdf"][0].id, "b");
    }

    #[test]
    fn corrupt_store_is_quarantined_before_new_annotations_are_saved() {
        let temp = tempfile::tempdir().unwrap();
        let path = annotation_store_path(temp.path()).unwrap();
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"{not-json").unwrap();

        save_annotations_for_document(temp.path(), "book.pdf", vec![annotation("fresh")]).unwrap();

        let store = load_store(temp.path()).unwrap();
        assert_eq!(store.documents["book.pdf"][0].id, "fresh");
        let recovery_count = std::fs::read_dir(path.parent().unwrap())
            .unwrap()
            .flatten()
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("annotations.corrupt-")
            })
            .count();
        assert_eq!(
            recovery_count, 1,
            "corrupt bytes must be preserved for recovery"
        );
    }

    #[test]
    fn annotation_fields_and_counts_are_bounded() {
        let mut oversized = annotation("a1");
        oversized.body = "x".repeat(MAX_ANNOTATION_BODY_BYTES + 1);
        assert!(validate_annotations(&[oversized]).is_err());

        let many = (0..=MAX_ANNOTATIONS_PER_DOCUMENT)
            .map(|index| annotation(&format!("a-{index}")))
            .collect::<Vec<_>>();
        assert!(validate_annotations(&many).is_err());
    }

    #[test]
    fn raster_and_audio_previews_are_bounded_without_expanding_annotation_types() {
        for path in [
            "assets/picture.PNG",
            "assets/photo.jpeg",
            "assets/clip.wav",
            "assets/clip.mp3",
            "assets/clip.ogg",
            "assets/clip.flac",
        ] {
            assert_eq!(
                readable_media_path(path).unwrap().1,
                MAX_MEDIA_PREVIEW_BYTES
            );
            assert!(document_path(path).is_err());
        }
        assert_eq!(
            readable_media_path("papers/book.pdf").unwrap().1,
            MAX_DOCUMENT_BYTES
        );
        for path in [
            "../private.png",
            "assets/active.svg",
            "assets/active.html",
            "assets/active.js",
            "https://example.test/a.png",
        ] {
            assert!(readable_media_path(path).is_err());
        }
    }

    #[test]
    fn non_file_annotation_store_is_rejected_without_quarantine() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join(".scriptor/reader/annotations.json");
        std::fs::create_dir_all(&path).unwrap();
        assert!(
            save_annotations_for_document(temp.path(), "book.pdf", vec![annotation("a")]).is_err()
        );
        assert!(path.is_dir());
        assert_eq!(
            std::fs::read_dir(path.parent().unwrap()).unwrap().count(),
            1
        );
    }
}
