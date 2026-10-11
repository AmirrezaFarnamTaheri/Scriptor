//! Existing UTF-8 source files have their own CAS boundary, without prose indexing.
use crate::{AppState, state::active_session};
use scriptor_vault::{RelativeVaultPath, VaultSession, content_hash_bytes};
use serde::Serialize;
use std::{
    fs,
    io::{Read, Write},
    path::PathBuf,
};
const LIMIT: usize = 2 * 1024 * 1024;
// Each recovery snapshot retains at most two copies of a bounded source file.
// Cap retained snapshots, separately from the user's Markdown history.
const SOURCE_RECOVERY_MAX_SNAPSHOTS: usize = 64;

#[derive(Debug, Serialize)]
pub struct SourceDocument {
    vault_id: String,
    path: String,
    content: String,
    content_hash: String,
    language: String,
}
fn language(path: &str) -> Result<&'static str, String> {
    match path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "tex" | "ltx" => Ok("latex"),
        "py" => Ok("python"),
        "rs" => Ok("rust"),
        "js" | "jsx" => Ok("javascript"),
        "ts" | "tsx" => Ok("typescript"),
        "json" => Ok("json"),
        "yaml" | "yml" => Ok("yaml"),
        "toml" => Ok("toml"),
        "css" => Ok("css"),
        "html" | "htm" => Ok("html"),
        "xml" => Ok("xml"),
        "sh" => Ok("shell"),
        "sql" => Ok("sql"),
        "bib" => Ok("bibtex"),
        "c" | "h" => Ok("c"),
        "cpp" => Ok("cpp"),
        "java" => Ok("java"),
        "txt" | "csv" | "ini" | "cfg" => Ok("text"),
        _ => Err("Unsupported source file format".into()),
    }
}
fn resolve(session: &VaultSession, path: &str) -> Result<PathBuf, String> {
    resolve_path(session, path, false)
}
fn resolve_path(
    session: &VaultSession,
    path: &str,
    allow_missing: bool,
) -> Result<PathBuf, String> {
    language(path)?;
    if path.len() > 1024
        || path.contains(['\\', ':', '%'])
        || path.chars().any(char::is_control)
        || path
            .split('/')
            .any(|p| p.starts_with('.') || p.ends_with(['.', ' ']))
    {
        return Err("Invalid source path".into());
    }
    let relative = RelativeVaultPath::parse(path).map_err(|e| e.to_string())?;
    let mut prefix = session.root.root().to_path_buf();
    for part in relative.as_str().split('/') {
        prefix.push(part);
        match fs::symlink_metadata(&prefix) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err("Source files cannot use symbolic links".into());
            }
            Ok(_) => {}
            Err(error) if allow_missing && error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    session
        .root
        .resolve_relative(&relative)
        .map_err(|e| e.to_string())
}
fn read(session: &VaultSession, path: &str) -> Result<SourceDocument, String> {
    let absolute = resolve(session, path)?;
    let file = fs::File::open(absolute).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("Source must be a regular file".into());
    }
    let mut bytes = Vec::new();
    file.take(LIMIT as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > LIMIT || bytes.contains(&0) {
        return Err("Source exceeds the 2 MiB text limit or contains binary data".into());
    }
    let content_hash = content_hash_bytes(&bytes);
    let content = String::from_utf8(bytes).map_err(|_| "Source must contain UTF-8 text")?;
    Ok(SourceDocument {
        vault_id: session.descriptor.id.clone(),
        path: path.into(),
        content,
        content_hash,
        language: language(path)?.into(),
    })
}
fn save(
    session: &VaultSession,
    path: &str,
    content: &str,
    expected: &str,
) -> Result<SourceDocument, String> {
    if content.len() > LIMIT
        || content.contains('\0')
        || expected.len() != 64
        || !expected
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    {
        return Err("Invalid source content or expected hash".into());
    }
    let _lock =
        scriptor_vault::fs::lock_vault_mutation(session.root.root()).map_err(|e| e.to_string())?;
    if session
        .root
        .root()
        .join(".scriptor/rename-txn.json")
        .exists()
    {
        return Err("Vault rename transaction is pending".into());
    }
    let before = read(session, path)?;
    if before.content_hash != expected {
        return Err("Source changed on disk. Reload before saving; your draft is retained".into());
    }
    if before.content == content {
        return Ok(before);
    }
    let absolute = resolve(session, path)?;
    persist_recovery(session, &before)?;
    scriptor_vault::fs::atomic_write(&absolute, content.as_bytes()).map_err(|e| e.to_string())?;
    read(session, path)
}
fn prune_source_recovery(root: &std::path::Path) -> Result<(), String> {
    let mut snapshots = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if uuid::Uuid::parse_str(name).is_err() {
            continue;
        }
        let meta = fs::symlink_metadata(entry.path()).map_err(|error| error.to_string())?;
        if !meta.is_dir() || meta.file_type().is_symlink() {
            continue;
        }
        let created = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
        snapshots.push((created, name.to_owned(), entry.path()));
    }
    snapshots.sort_by(|left, right| (&left.0, &left.1).cmp(&(&right.0, &right.1)));
    let excess = snapshots
        .len()
        .saturating_sub(SOURCE_RECOVERY_MAX_SNAPSHOTS - 1);
    for (_, _, path) in snapshots.into_iter().take(excess) {
        fs::remove_dir_all(&path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn persist_recovery(session: &VaultSession, before: &SourceDocument) -> Result<(), String> {
    let recovery = session.root.root().join(".scriptor/source-recovery");
    let mut prefix = session.root.root().to_path_buf();
    for part in [".scriptor", "source-recovery"] {
        prefix.push(part);
        match fs::symlink_metadata(&prefix) {
            Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => {}
            Ok(_) => return Err("Invalid source recovery directory".into()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                scriptor_vault::fs::create_private_directory(&prefix).map_err(|e| e.to_string())?;
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    // Retain at most 63 previous snapshots before adding the next one. The
    // vault mutation lock protects this sweep from concurrent source writes.
    // Only canonical UUID directory names are eligible for deletion.
    prune_source_recovery(&recovery)?;
    let dir = recovery.join(uuid::Uuid::new_v4().to_string());
    scriptor_vault::fs::create_private_directory(&dir).map_err(|e| e.to_string())?;
    for (name, bytes) in [
        ("before", before.content.as_bytes().to_vec()),
        (
            "receipt.json",
            serde_json::to_vec(&before).map_err(|e| e.to_string())?,
        ),
    ] {
        let mut file =
            scriptor_vault::fs::create_private_file(&dir.join(name)).map_err(|e| e.to_string())?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|e| e.to_string())?;
    }
    #[cfg(unix)]
    for parent in [&dir, &recovery] {
        fs::File::open(parent)
            .and_then(|file| file.sync_all())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn create(session: &VaultSession, path: &str, content: &str) -> Result<SourceDocument, String> {
    if content.len() > LIMIT || content.contains('\0') {
        return Err("Source exceeds the 2 MiB text limit or contains binary data".into());
    }
    let _lock =
        scriptor_vault::fs::lock_vault_mutation(session.root.root()).map_err(|e| e.to_string())?;
    if session
        .root
        .root()
        .join(".scriptor/rename-txn.json")
        .exists()
    {
        return Err("Vault rename transaction is pending".into());
    }
    let absolute = resolve_path(session, path, true)?;
    match fs::symlink_metadata(&absolute) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Ok(_) => return Err("Source destination already exists".into()),
        Err(e) => return Err(e.to_string()),
    }
    // Record the create intent durably before creating the destination; an absent
    // preimage is explicit and never represented as a Markdown history entry.
    persist_recovery(
        session,
        &SourceDocument {
            vault_id: session.descriptor.id.clone(),
            path: path.into(),
            content: String::new(),
            content_hash: "<missing>".into(),
            language: language(path)?.into(),
        },
    )?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Revalidate every newly materialized parent before opening the file.
    resolve_path(session, path, true)?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&absolute)
        .map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    #[cfg(unix)]
    if let Some(parent) = absolute.parent() {
        fs::File::open(parent)
            .and_then(|file| file.sync_all())
            .map_err(|e| e.to_string())?;
    }
    read(session, path)
}
#[tauri::command]
pub fn source_file_read(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    path: String,
) -> Result<SourceDocument, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    read(&session, &path)
}
#[tauri::command]
pub fn source_file_save(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    path: String,
    content: String,
    expected_content_hash: String,
) -> Result<SourceDocument, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    save(&session, &path, &content, &expected_content_hash)
}
#[tauri::command]
pub fn source_file_create(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    path: String,
    content: String,
) -> Result<SourceDocument, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    create(&session, &path, &content)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    #[test]
    fn private_source_recovery_keeps_preimages_and_receipts_private() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let session = scriptor_vault::open_vault(dir.path()).unwrap();
        let source = dir.path().join("private.py");
        fs::write(&source, "private preimage\n").unwrap();
        fs::set_permissions(&source, fs::Permissions::from_mode(0o600)).unwrap();
        let before = read(&session, "private.py").unwrap();

        save(&session, "private.py", "updated\n", &before.content_hash).unwrap();

        let recovery = fs::read_dir(dir.path().join(".scriptor/source-recovery"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        assert_eq!(
            fs::metadata(&recovery).unwrap().permissions().mode() & 0o777,
            0o700
        );
        for name in ["before", "receipt.json"] {
            assert_eq!(
                fs::metadata(recovery.join(name))
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o777,
                0o600
            );
        }
        assert_eq!(
            fs::read_to_string(recovery.join("before")).unwrap(),
            before.content
        );
        let receipt: serde_json::Value =
            serde_json::from_slice(&fs::read(recovery.join("receipt.json")).unwrap()).unwrap();
        assert_eq!(receipt["content"], before.content);
    }
    #[test]
    fn source_recovery_has_bounded_retention_without_touching_other_folders() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("unrelated")).unwrap();
        for _ in 0..(SOURCE_RECOVERY_MAX_SNAPSHOTS + 7) {
            fs::create_dir(root.join(uuid::Uuid::new_v4().to_string())).unwrap();
        }
        prune_source_recovery(root).unwrap();
        assert!(root.join("unrelated").exists());
        let retained = fs::read_dir(root)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| uuid::Uuid::parse_str(&entry.file_name().to_string_lossy()).is_ok())
            .count();
        assert_eq!(retained, SOURCE_RECOVERY_MAX_SNAPSHOTS - 1);
    }
    #[test]
    fn source_creation_is_strictly_missing_and_supports_tex_and_python() {
        let dir = tempfile::tempdir().unwrap();
        let session = scriptor_vault::open_vault(dir.path()).unwrap();
        let created = create(
            &session,
            "research/main.tex",
            "\\documentclass{article}\r\n",
        )
        .unwrap();
        assert_eq!(created.language, "latex");
        assert!(create(&session, "research/main.tex", "replacement").is_err());
        assert_eq!(
            read(&session, "research/main.tex").unwrap().content,
            created.content
        );
        assert_eq!(
            create(&session, "main.py", "print(1)\n").unwrap().language,
            "python"
        );
    }
    #[test]
    fn source_save_preserves_bytes_and_recovers_prior_version_without_prose_history() {
        let dir = tempfile::tempdir().unwrap();
        let session = scriptor_vault::open_vault(dir.path()).unwrap();
        fs::write(dir.path().join("main.py"), b"print(1)\r\n").unwrap();
        let original = read(&session, "main.py").unwrap();
        let saved = save(&session, "main.py", "print(2)\r\n", &original.content_hash).unwrap();
        assert_eq!(saved.language, "python");
        assert_eq!(
            fs::read(dir.path().join("main.py")).unwrap(),
            b"print(2)\r\n"
        );
        assert!(save(&session, "main.py", "stale", &original.content_hash).is_err());
        let recovery = fs::read_dir(dir.path().join(".scriptor/source-recovery"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        assert_eq!(fs::read(recovery.join("before")).unwrap(), b"print(1)\r\n");
        assert!(!dir.path().join(".scriptor/note-history").exists());
        fs::write(dir.path().join(".scriptor/rename-txn.json"), "{}").unwrap();
        assert!(save(&session, "main.py", "blocked", &saved.content_hash).is_err());
    }
    #[test]
    fn source_reads_reject_binary_oversize_internal_and_unsupported_files() {
        let dir = tempfile::tempdir().unwrap();
        let session = scriptor_vault::open_vault(dir.path()).unwrap();
        fs::write(dir.path().join("bad.py"), [255]).unwrap();
        assert!(read(&session, "bad.py").is_err());
        fs::write(dir.path().join("large.txt"), vec![b'x'; LIMIT + 1]).unwrap();
        assert!(read(&session, "large.txt").is_err());
        for path in [
            "../outside.py",
            ".scriptor/config.json",
            "Note.md",
            "image.png",
        ] {
            assert!(read(&session, path).is_err());
        }
    }
}
