//! Reviewed single-file repairs with immutable recovery records and source CAS.
use crate::{
    authorization::{SensitiveOperation, require_sensitive_operation},
    state::{AppState, active_session},
};
use scriptor_vault::{RelativeVaultPath, VaultSession, content_hash, content_hash_bytes};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

const NOTE_LIMIT: usize = 2 * 1024 * 1024;
const ASSET_LIMIT: usize = 64 * 1024 * 1024;
const SCAN_LIMIT: usize = 64 * 1024 * 1024;
const RECOVERY: &str = ".scriptor/health-recovery";

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum RepairRequest {
    CreateNote { path: String },
    NormalizeTags { path: String },
    PruneAsset { path: String },
}
impl RepairRequest {
    fn path(&self) -> &str {
        match self {
            Self::CreateNote { path }
            | Self::NormalizeTags { path }
            | Self::PruneAsset { path } => path,
        }
    }
}
#[derive(Debug, Serialize)]
pub struct RepairChange {
    path: String,
    expected_hash: String,
    before: String,
    after: String,
    bytes: usize,
}
#[derive(Debug, Serialize)]
pub struct ScanProof {
    complete: bool,
    notes: usize,
    fingerprint: String,
}
#[derive(Debug, Serialize)]
pub struct RepairPlan {
    vault_id: String,
    request: RepairRequest,
    fingerprint: String,
    changes: Vec<RepairChange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scan: Option<ScanProof>,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct RepairReceipt {
    id: String,
    vault_id: String,
    path: String,
    hash: String,
    bytes: usize,
    after_hash: String,
    kind: String,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct RecoveryRecord {
    receipt: RepairReceipt,
    request: RepairRequest,
    before_hash: String,
    after_hash: String,
    before_exists: bool,
}

fn repair_path(session: &VaultSession, value: &str) -> Result<PathBuf, String> {
    if value.is_empty()
        || value.len() > 4096
        || value.chars().any(|ch| {
            ch.is_control()
                || matches!(
                    ch,
                    ':' | '\\' | '#' | '|' | '?' | '*' | '<' | '>' | '"' | '%'
                )
        })
        || value
            .split('/')
            .any(|part| part.is_empty() || part.starts_with('.') || part.ends_with(['.', ' ']))
    {
        return Err("Invalid repair path".into());
    }
    let relative = RelativeVaultPath::parse(value).map_err(|e| e.to_string())?;
    let path = session
        .root
        .resolve_relative(&relative)
        .map_err(|e| e.to_string())?;
    no_symlinks(session.root.root(), &session.root.root().join(value))?;
    Ok(path)
}
fn no_symlinks(root: &Path, path: &Path) -> Result<(), String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "Recovery path escapes vault")?;
    let mut current = root.to_path_buf();
    for part in relative.components() {
        if !matches!(part, std::path::Component::Normal(_)) {
            return Err("Invalid confined path".into());
        }
        current.push(part);
        match fs::symlink_metadata(&current) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err("Repair cannot traverse symbolic links".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
    }
    Ok(())
}
fn read_bounded(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > limit {
        return Err("Repair scan exceeds its content limit; no files were changed".into());
    }
    Ok(bytes)
}
fn normalize_tags(markdown: &str) -> String {
    // The existing rewriter excludes fenced/inline code and URL fragments, and
    // changes only tag fields in frontmatter. Candidate extraction is not authority.
    let candidates: BTreeSet<_> = markdown
        .split(|ch: char| !ch.is_ascii_alphanumeric() && !matches!(ch, '_' | '/' | '-' | '#'))
        .map(|word| word.trim_start_matches('#'))
        .filter(|word| !word.is_empty() && word.bytes().any(|b| b.is_ascii_uppercase()))
        .collect();
    let mut after = markdown.to_string();
    for tag in candidates {
        after = scriptor_vault::tag_rename::rewrite_tags_in_markdown(
            tag,
            &tag.to_ascii_lowercase(),
            &after,
        )
        .0;
    }
    after
}
fn decoded_text(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(hi), Some(lo)) = (hi, lo) {
                out.push((hi * 16 + lo) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out)
        .replace('\\', "")
        .to_lowercase()
}
fn collect_reference_sources(
    root: &Path,
    dir: &Path,
    sources: &mut Vec<(String, String)>,
    total: &mut usize,
    entries: &mut usize,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        *entries += 1;
        if *entries > 250_000 {
            return Err("Asset reference scan is incomplete: too many entries".into());
        }
        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|_| "Scan escaped vault")?
            .to_string_lossy()
            .replace('\\', "/");
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if matches!(name.as_ref(), ".git" | ".trash" | "node_modules")
            || relative == ".scriptor/health-recovery"
        {
            continue;
        }
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        if ty.is_symlink() {
            return Err("Asset reference scan is incomplete: symbolic link found".into());
        }
        if ty.is_dir() {
            collect_reference_sources(root, &path, sources, total, entries)?;
            continue;
        }
        if !ty.is_file() {
            return Err("Asset reference scan is incomplete: unsupported entry".into());
        }
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(
            ext.as_str(),
            "md" | "markdown"
                | "canvas"
                | "json"
                | "yaml"
                | "yml"
                | "html"
                | "htm"
                | "css"
                | "bib"
                | "txt"
                | "toml"
                | "svg"
                | "tex"
                | "ltx"
                | "py"
                | "rs"
                | "js"
                | "jsx"
                | "ts"
                | "tsx"
                | "xml"
                | "csv"
                | "sh"
                | "sql"
                | "ini"
                | "cfg"
                | "c"
                | "h"
                | "cpp"
                | "java"
        ) {
            continue;
        }
        let bytes = read_bounded(&path, NOTE_LIMIT)?;
        *total += bytes.len();
        if *total > SCAN_LIMIT {
            return Err("Asset reference scan is incomplete: content budget exhausted".into());
        }
        let text = String::from_utf8(bytes)
            .map_err(|_| "Asset reference scan is incomplete: invalid text")?;
        sources.push((relative, text));
    }
    Ok(())
}
fn asset_scan(session: &VaultSession, path: &str) -> Result<ScanProof, String> {
    let mut sources = Vec::new();
    let mut total = 0;
    let mut entries = 0;
    collect_reference_sources(
        session.root.root(),
        session.root.root(),
        &mut sources,
        &mut total,
        &mut entries,
    )?;
    sources.sort_by(|a, b| a.0.cmp(&b.0));
    let basename = path
        .rsplit('/')
        .next()
        .ok_or("Invalid asset path")?
        .to_lowercase();
    let mut signature = String::new();
    let mut notes = 0;
    for (source, text) in sources {
        if source == path {
            continue;
        }
        if source.ends_with(".md") || source.ends_with(".markdown") {
            notes += 1;
        }
        let decoded = decoded_text(&text);
        let tex_source = source.to_ascii_lowercase().ends_with(".tex")
            || source.to_ascii_lowercase().ends_with(".ltx");
        // TeX resolves includegraphics filenames without an extension. Treat any
        // matching stem in its source as a possible reference rather than
        // claiming that an exact-filename-only scan proved the image unused.
        let implicit_tex_reference = tex_source
            && basename
                .rsplit_once('.')
                .is_some_and(|(stem, _)| !stem.is_empty() && decoded.contains(stem));
        if decoded.contains(&basename) || implicit_tex_reference {
            return Err(format!(
                "Asset may be referenced by {source}; review that source before pruning"
            ));
        }
        signature.push_str(&source);
        signature.push('\0');
        signature.push_str(&content_hash(&text));
        signature.push('\n');
    }
    Ok(ScanProof {
        complete: true,
        notes,
        fingerprint: content_hash(&signature),
    })
}
fn plan(session: &VaultSession, request: RepairRequest) -> Result<RepairPlan, String> {
    let path = repair_path(session, request.path())?;
    let mut scan = None;
    let (expected_hash, before, after, bytes) = match &request {
        RepairRequest::CreateNote { path: relative } => {
            if !relative.ends_with(".md") || path.exists() {
                return Err("A new Markdown note requires a missing destination".into());
            }
            let title = path
                .file_stem()
                .and_then(|s| s.to_str())
                .ok_or("Invalid note name")?;
            let after = format!("# {title}\n");
            (
                "<missing>".into(),
                String::new(),
                after.clone(),
                after.len(),
            )
        }
        RepairRequest::NormalizeTags { path: relative } => {
            if !relative.ends_with(".md") {
                return Err("Tag normalization requires a Markdown note".into());
            }
            let before = String::from_utf8(read_bounded(&path, NOTE_LIMIT)?)
                .map_err(|_| "Note is not valid UTF-8")?;
            let after = normalize_tags(&before);
            if after == before {
                return Err("This note has no tag case changes to review".into());
            }
            if after.len() > NOTE_LIMIT {
                return Err("Normalized note exceeds repair limit".into());
            }
            (content_hash(&before), before, after.clone(), after.len())
        }
        RepairRequest::PruneAsset { path: relative } => {
            if relative.ends_with(".md") || !path.is_file() {
                return Err("Pruning requires an existing non-Markdown asset".into());
            }
            scan = Some(asset_scan(session, relative)?);
            let bytes = read_bounded(&path, ASSET_LIMIT)?;
            (
                content_hash_bytes(&bytes),
                String::new(),
                String::new(),
                bytes.len(),
            )
        }
    };
    let mut output = RepairPlan {
        vault_id: session.descriptor.id.clone(),
        request: request.clone(),
        fingerprint: String::new(),
        changes: vec![RepairChange {
            path: request.path().into(),
            expected_hash,
            before,
            after,
            bytes,
        }],
        scan,
    };
    output.fingerprint =
        content_hash_bytes(&serde_json::to_vec(&output).map_err(|e| e.to_string())?);
    Ok(output)
}
fn write_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    sync_directory(path.parent().ok_or("Invalid durable file parent")?)
}
#[cfg(unix)]
fn sync_directory(path: &Path) -> Result<(), String> {
    fs::File::open(path)
        .and_then(|file| file.sync_all())
        .map_err(|e| e.to_string())
}
#[cfg(not(unix))]
fn sync_directory(_path: &Path) -> Result<(), String> {
    Ok(())
}
fn recovery_dir(session: &VaultSession, id: &str) -> Result<PathBuf, String> {
    let uuid = uuid::Uuid::parse_str(id).map_err(|_| "Invalid recovery identity")?;
    if uuid.get_version_num() != 4 || uuid.to_string() != id {
        return Err("Invalid recovery identity".into());
    }
    let path = session.root.root().join(RECOVERY).join(id);
    no_symlinks(session.root.root(), &path)?;
    Ok(path)
}
fn apply(
    session: &VaultSession,
    request: RepairRequest,
    expected: &str,
) -> Result<RepairReceipt, String> {
    let _lock =
        scriptor_vault::fs::lock_vault_mutation(session.root.root()).map_err(|e| e.to_string())?;
    require_committed_rename(session)?;
    let reviewed = plan(session, request.clone())?;
    if reviewed.fingerprint != expected {
        return Err("Repair sources changed. Generate and review a new plan".into());
    }
    let change = &reviewed.changes[0];
    let path = repair_path(session, request.path())?;
    let before = if matches!(request, RepairRequest::CreateNote { .. }) {
        Vec::new()
    } else {
        read_bounded(&path, ASSET_LIMIT)?
    };
    if !matches!(request, RepairRequest::CreateNote { .. })
        && content_hash_bytes(&before) != change.expected_hash
    {
        return Err("Repair source changed".into());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let dir = recovery_dir(session, &id)?;
    fs::create_dir_all(dir.parent().ok_or("Invalid recovery parent")?)
        .map_err(|e| e.to_string())?;
    fs::create_dir(&dir).map_err(|e| e.to_string())?;
    let receipt = RepairReceipt {
        id,
        vault_id: session.descriptor.id.clone(),
        path: request.path().into(),
        hash: content_hash_bytes(&before),
        bytes: before.len(),
        after_hash: if matches!(request, RepairRequest::PruneAsset { .. }) {
            "<missing>".into()
        } else {
            content_hash(&change.after)
        },
        kind: match &request {
            RepairRequest::CreateNote { .. } => "create_note",
            RepairRequest::NormalizeTags { .. } => "normalize_tags",
            RepairRequest::PruneAsset { .. } => "prune_asset",
        }
        .into(),
    };
    let record = RecoveryRecord {
        receipt: receipt.clone(),
        request: request.clone(),
        before_hash: receipt.hash.clone(),
        after_hash: if matches!(request, RepairRequest::PruneAsset { .. }) {
            "<missing>".into()
        } else {
            content_hash(&change.after)
        },
        before_exists: !matches!(request, RepairRequest::CreateNote { .. }),
    };
    write_new(&dir.join("before"), &before)?;
    write_new(
        &dir.join("receipt.json"),
        &serde_json::to_vec(&record).map_err(|e| e.to_string())?,
    )?;
    sync_directory(dir.parent().ok_or("Invalid recovery parent")?)?;
    // Recovery is durable before mutation. No later repair overwrites this UUID.
    match request {
        RepairRequest::CreateNote { .. } => {
            fs::create_dir_all(path.parent().ok_or("Invalid note parent")?)
                .map_err(|e| e.to_string())?;
            write_new(&path, change.after.as_bytes())?;
        }
        RepairRequest::NormalizeTags { .. } => {
            scriptor_vault::atomic_write(&path, change.after.as_bytes())
                .map_err(|e| e.to_string())?
        }
        RepairRequest::PruneAsset { .. } => fs::remove_file(&path).map_err(|e| e.to_string())?,
    }
    Ok(receipt)
}
fn restore(
    session: &VaultSession,
    id: &str,
    expected: Option<&RepairReceipt>,
) -> Result<(), String> {
    let _lock =
        scriptor_vault::fs::lock_vault_mutation(session.root.root()).map_err(|e| e.to_string())?;
    require_committed_rename(session)?;
    let dir = recovery_dir(session, id)?;
    no_symlinks(session.root.root(), &dir.join("receipt.json"))?;
    no_symlinks(session.root.root(), &dir.join("before"))?;
    let record: RecoveryRecord =
        serde_json::from_slice(&read_bounded(&dir.join("receipt.json"), 16384)?)
            .map_err(|_| "Invalid recovery record")?;
    if expected.is_some_and(|receipt| receipt != &record.receipt)
        || record.after_hash != record.receipt.after_hash
        || record.before_exists == matches!(record.request, RepairRequest::CreateNote { .. })
        || (matches!(record.request, RepairRequest::PruneAsset { .. })
            != (record.after_hash == "<missing>"))
        || (matches!(record.request, RepairRequest::CreateNote { .. }) && record.receipt.bytes != 0)
        || record.receipt.id != id
        || record.receipt.vault_id != session.descriptor.id
        || record.request.path() != record.receipt.path
        || record.receipt.kind
            != match record.request {
                RepairRequest::CreateNote { .. } => "create_note",
                RepairRequest::NormalizeTags { .. } => "normalize_tags",
                RepairRequest::PruneAsset { .. } => "prune_asset",
            }
    {
        return Err("Recovery record belongs to another request or vault".into());
    }
    let bytes = read_bounded(&dir.join("before"), ASSET_LIMIT)?;
    if bytes.len() != record.receipt.bytes
        || content_hash_bytes(&bytes) != record.before_hash
        || record.before_hash != record.receipt.hash
    {
        return Err("Recovery content verification failed".into());
    }
    let path = repair_path(session, &record.receipt.path)?;
    if record.after_hash == "<missing>" {
        if path.exists() {
            return Err(
                "Restore destination already exists; existing content was preserved".into(),
            );
        }
    } else if content_hash_bytes(&read_bounded(&path, NOTE_LIMIT)?) != record.after_hash {
        return Err("Repaired file changed; existing content was preserved".into());
    }
    if record.before_exists {
        if record.after_hash == "<missing>" {
            fs::create_dir_all(path.parent().ok_or("Invalid restore parent")?)
                .map_err(|e| e.to_string())?;
            write_new(&path, &bytes)?;
        } else {
            scriptor_vault::atomic_write(&path, &bytes).map_err(|e| e.to_string())?;
        }
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn require_committed_rename(session: &VaultSession) -> Result<(), String> {
    if session
        .root
        .root()
        .join(".scriptor/rename-txn.json")
        .exists()
    {
        return Err(
            "Vault rename transaction is pending; finish recovery before repairing files".into(),
        );
    }
    Ok(())
}

#[tauri::command]
pub fn health_repair_plan(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    request: RepairRequest,
) -> Result<RepairPlan, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    plan(&session, request)
}
#[tauri::command]
pub fn health_repair_apply(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    request: RepairRequest,
    expected_fingerprint: String,
    authorization_token: String,
) -> Result<RepairReceipt, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    if expected_fingerprint.len() != 64
        || !expected_fingerprint
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    {
        return Err("Invalid reviewed fingerprint".into());
    }
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ApplyBulkFix,
        Some(&expected_fingerprint),
        Some(&expected_vault_id),
    )?;
    apply(&session, request, &expected_fingerprint)
}
#[tauri::command]
pub fn health_repair_restore(
    state: tauri::State<AppState>,
    expected_vault_id: String,
    receipt_id: String,
    expected_receipt: RepairReceipt,
    authorization_token: String,
) -> Result<(), String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    recovery_dir(&session, &receipt_id)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::RestoreHistory,
        Some(&receipt_id),
        Some(&expected_vault_id),
    )?;
    restore(&session, &receipt_id, Some(&expected_receipt))
}
#[tauri::command]
pub fn health_repair_receipts(
    state: tauri::State<AppState>,
    expected_vault_id: String,
) -> Result<Vec<RepairReceipt>, String> {
    let session = active_session(&state)?;
    super::vault::validate_expected_vault(&session.descriptor.id, Some(&expected_vault_id))?;
    let root = session.root.root().join(RECOVERY);
    no_symlinks(session.root.root(), &root)?;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut rows = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| e.to_string())?.take(201) {
        let entry = entry.map_err(|e| e.to_string())?;
        if rows.len() >= 200 {
            return Err("Recovery history exceeds display limit".into());
        }
        let id = entry.file_name().to_string_lossy().into_owned();
        let dir = recovery_dir(&session, &id)?;
        let record: RecoveryRecord =
            serde_json::from_slice(&read_bounded(&dir.join("receipt.json"), 16384)?)
                .map_err(|_| "Invalid recovery record")?;
        if record.receipt.vault_id != expected_vault_id || record.receipt.id != id {
            return Err("Invalid recovery ownership".into());
        }
        rows.push(record.receipt);
    }
    rows.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn session() -> (tempfile::TempDir, VaultSession) {
        let dir = tempfile::tempdir().unwrap();
        let s = scriptor_vault::open_vault(dir.path()).unwrap();
        (dir, s)
    }
    #[test]
    fn note_creation_is_reviewed_create_only_and_restore_preserves_edits() {
        let (dir, s) = session();
        let r = RepairRequest::CreateNote {
            path: "New.md".into(),
        };
        let p = plan(&s, r.clone()).unwrap();
        let receipt = apply(&s, r.clone(), &p.fingerprint).unwrap();
        assert!(apply(&s, r, &p.fingerprint).is_err());
        fs::write(dir.path().join("New.md"), "User edits").unwrap();
        assert!(restore(&s, &receipt.id, Some(&receipt)).is_err());
        assert_eq!(
            fs::read_to_string(dir.path().join("New.md")).unwrap(),
            "User edits"
        );
    }
    #[test]
    fn tag_repair_preserves_code_and_can_restore() {
        let (dir, s) = session();
        let original = "---\ntags: [Research]\n---\n#Research `#Research`\n```\n#Research\n```\n";
        fs::write(dir.path().join("Note.md"), original).unwrap();
        let r = RepairRequest::NormalizeTags {
            path: "Note.md".into(),
        };
        let p = plan(&s, r.clone()).unwrap();
        assert!(p.changes[0].after.contains("tags: [research]"));
        assert!(p.changes[0].after.contains("`#Research`"));
        let receipt = apply(&s, r, &p.fingerprint).unwrap();
        restore(&s, &receipt.id, Some(&receipt)).unwrap();
        assert_eq!(
            fs::read_to_string(dir.path().join("Note.md")).unwrap(),
            original
        );
    }
    #[test]
    fn prune_rechecks_new_references_and_restores_without_overwriting() {
        let (dir, s) = session();
        fs::write(dir.path().join("asset.png"), b"image").unwrap();
        let r = RepairRequest::PruneAsset {
            path: "asset.png".into(),
        };
        let p = plan(&s, r.clone()).unwrap();
        fs::write(dir.path().join("Note.md"), "![image](asset.png)").unwrap();
        assert!(apply(&s, r.clone(), &p.fingerprint).is_err());
        fs::write(dir.path().join("Note.md"), "No reference").unwrap();
        let p = plan(&s, r.clone()).unwrap();
        let receipt = apply(&s, r, &p.fingerprint).unwrap();
        assert!(!dir.path().join("asset.png").exists());
        fs::write(dir.path().join("asset.png"), b"new").unwrap();
        assert!(restore(&s, &receipt.id, Some(&receipt)).is_err());
        fs::remove_file(dir.path().join("asset.png")).unwrap();
        restore(&s, &receipt.id, Some(&receipt)).unwrap();
        assert_eq!(fs::read(dir.path().join("asset.png")).unwrap(), b"image");
    }
    #[test]
    fn incomplete_note_scan_cannot_offer_pruning() {
        let (dir, s) = session();
        fs::write(dir.path().join("asset.png"), b"image").unwrap();
        fs::write(dir.path().join("bad.md"), [255]).unwrap();
        assert!(
            plan(
                &s,
                RepairRequest::PruneAsset {
                    path: "asset.png".into()
                }
            )
            .is_err()
        );
    }

    #[test]
    fn pending_rename_blocks_repair_and_restore_without_changing_files() {
        let (dir, s) = session();
        let request = RepairRequest::CreateNote {
            path: "New.md".into(),
        };
        let reviewed = plan(&s, request.clone()).unwrap();
        let marker = dir.path().join(".scriptor/rename-txn.json");
        fs::create_dir_all(marker.parent().unwrap()).unwrap();
        fs::write(&marker, "{}").unwrap();
        assert!(apply(&s, request.clone(), &reviewed.fingerprint).is_err());
        assert!(!dir.path().join("New.md").exists());
        fs::remove_file(&marker).unwrap();
        let receipt = apply(&s, request, &reviewed.fingerprint).unwrap();
        fs::write(&marker, "{}").unwrap();
        assert!(restore(&s, &receipt.id, Some(&receipt)).is_err());
        assert!(dir.path().join("New.md").is_file());
    }
    #[test]
    fn source_documents_and_obsidian_styles_prevent_pruning_referenced_assets() {
        let (dir, s) = session();
        fs::write(dir.path().join("image.png"), b"image").unwrap();
        let request = RepairRequest::PruneAsset {
            path: "image.png".into(),
        };
        fs::write(dir.path().join("main.tex"), "\\includegraphics{image}").unwrap();
        assert!(plan(&s, request.clone()).is_err());
        fs::remove_file(dir.path().join("main.tex")).unwrap();
        fs::create_dir_all(dir.path().join(".obsidian/snippets")).unwrap();
        fs::write(
            dir.path().join(".obsidian/snippets/style.css"),
            "body { background: url(image.png) }",
        )
        .unwrap();
        assert!(plan(&s, request).is_err());
    }
}
