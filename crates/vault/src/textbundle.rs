use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use zip::ZipWriter;
use zip::write::SimpleFileOptions;

use crate::error::VaultError;
use crate::note::read_note;
use crate::open::open_vault;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::fs::atomic_write;
use crate::write::save_note;


const MAX_TEXTBUNDLE_ENTRIES: usize = 4_096;
const MAX_TEXTBUNDLE_MARKDOWN_BYTES: u64 = 16 * 1024 * 1024;
const MAX_TEXTBUNDLE_ASSET_BYTES: u64 = 64 * 1024 * 1024;
const MAX_TEXTBUNDLE_TOTAL_BYTES: u64 = 256 * 1024 * 1024;

static IMAGE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"!\[[^\]]*\]\(([^)]+)\)").expect("image regex"));

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TextBundleExportOutput {
    pub bundle_path: String,
    pub note_path: String,
    pub asset_count: u32,
}

pub fn export_text_bundle(
    vault_id: &str,
    root: &VaultRoot,
    note_path: &RelativeVaultPath,
    output_path: &Path,
) -> Result<TextBundleExportOutput, VaultError> {
    let document = read_note(vault_id, root, note_path)?;
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }

    let file =
        fs::File::create(output_path).map_err(|source| VaultError::io(output_path, source))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("text.md", options)
        .map_err(|error| VaultError::InvalidConfig {
            message: error.to_string(),
        })?;
    zip.write_all(document.markdown.as_bytes())
        .map_err(|error| VaultError::InvalidConfig {
            message: error.to_string(),
        })?;

    let mut asset_count = 0u32;
    for asset in extract_local_assets(&document.markdown) {
        let asset_path = root.resolve_relative(&RelativeVaultPath::parse(&asset)?)?;
        if asset_path.is_file() {
            let mut buffer = Vec::new();
            fs::File::open(&asset_path)
                .and_then(|mut file| file.read_to_end(&mut buffer))
                .map_err(|source| VaultError::io(&asset_path, source))?;
            zip.start_file(format!("assets/{asset}"), options)
                .map_err(|error| VaultError::InvalidConfig {
                    message: error.to_string(),
                })?;
            zip.write_all(&buffer)
                .map_err(|error| VaultError::InvalidConfig {
                    message: error.to_string(),
                })?;
            asset_count += 1;
        }
    }

    zip.finish().map_err(|error| VaultError::InvalidConfig {
        message: error.to_string(),
    })?;

    Ok(TextBundleExportOutput {
        bundle_path: output_path.display().to_string(),
        note_path: note_path.to_string(),
        asset_count,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TextBundleImportOutput {
    pub note_path: String,
    pub assets_imported: u32,
}

pub fn import_text_bundle(
    vault_id: &str,
    root: &VaultRoot,
    bundle_path: &Path,
    target_note: &RelativeVaultPath,
) -> Result<TextBundleImportOutput, VaultError> {
    let target_abs = root.resolve_relative(target_note)?;
    if target_abs.exists() {
        return Err(VaultError::NoteExists(target_note.to_string()));
    }

    let file = fs::File::open(bundle_path).map_err(|source| VaultError::io(bundle_path, source))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|error| VaultError::InvalidConfig {
        message: error.to_string(),
    })?;
    if archive.len() > MAX_TEXTBUNDLE_ENTRIES {
        return Err(VaultError::InvalidConfig { message: format!("TextBundle has too many entries: {} > {MAX_TEXTBUNDLE_ENTRIES}", archive.len()) });
    }

    let mut total_bytes = 0u64;
    let mut asset_plan = Vec::new();
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
        let name = entry.name().to_string();
        let size = entry.size();
        total_bytes = total_bytes.checked_add(size).ok_or_else(|| VaultError::InvalidConfig { message: "TextBundle expanded size overflow".into() })?;
        if total_bytes > MAX_TEXTBUNDLE_TOTAL_BYTES {
            return Err(VaultError::InvalidConfig { message: format!("TextBundle expands beyond {MAX_TEXTBUNDLE_TOTAL_BYTES} bytes") });
        }
        if name == "text.md" {
            if size > MAX_TEXTBUNDLE_MARKDOWN_BYTES {
                return Err(VaultError::InvalidConfig { message: "TextBundle text.md is too large".into() });
            }
            continue;
        }
        if !name.starts_with("assets/") || name.ends_with('/') { continue; }
        if size > MAX_TEXTBUNDLE_ASSET_BYTES {
            return Err(VaultError::InvalidConfig { message: format!("TextBundle asset is too large: {name}") });
        }
        let relative = name.trim_start_matches("assets/");
        let rel = RelativeVaultPath::parse(relative)?;
        let dest = root.resolve_relative(&rel)?;
        if dest.exists() {
            return Err(VaultError::NoteExists(rel.to_string()));
        }
        asset_plan.push((index, rel, size));
    }

    let mut markdown = String::new();
    {
        let mut entry = archive.by_name("text.md").map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
        let mut limited = (&mut entry).take(MAX_TEXTBUNDLE_MARKDOWN_BYTES + 1);
        limited.read_to_string(&mut markdown).map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
        if markdown.len() as u64 > MAX_TEXTBUNDLE_MARKDOWN_BYTES {
            return Err(VaultError::InvalidConfig { message: "TextBundle text.md exceeded the read budget".into() });
        }
    }

    let staging = root.root().join(".scriptor").join("import-staging").join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(&staging).map_err(|source| VaultError::io(&staging, source))?;
    let result = (|| -> Result<TextBundleImportOutput, VaultError> {
        let mut staged = Vec::new();
        for (index, rel, declared_size) in &asset_plan {
            let mut entry = archive.by_index(*index).map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
            let stage_path = staging.join(rel.as_str().replace('/', std::path::MAIN_SEPARATOR_STR));
            if let Some(parent) = stage_path.parent() { fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?; }
            let mut bytes = Vec::with_capacity((*declared_size).min(MAX_TEXTBUNDLE_ASSET_BYTES) as usize);
            (&mut entry).take(MAX_TEXTBUNDLE_ASSET_BYTES + 1).read_to_end(&mut bytes).map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
            if bytes.len() as u64 > MAX_TEXTBUNDLE_ASSET_BYTES { return Err(VaultError::InvalidConfig { message: format!("TextBundle asset exceeded read budget: {}", rel.as_str()) }); }
            atomic_write(&stage_path, &bytes)?;
            staged.push((rel.clone(), stage_path));
        }

        let mut promoted = Vec::new();
        for (rel, stage_path) in &staged {
            let dest = root.resolve_relative(rel)?;
            if let Some(parent) = dest.parent() { fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?; }
            if let Err(source) = fs::rename(stage_path, &dest) {
                for prior in promoted.iter().rev() { let _ = fs::remove_file(prior); }
                return Err(VaultError::io(&dest, source));
            }
            promoted.push(dest);
        }

        if let Err(error) = save_note(vault_id, root, target_note, &markdown, None) {
            for path in promoted.iter().rev() { let _ = fs::remove_file(path); }
            return Err(error);
        }
        Ok(TextBundleImportOutput { note_path: target_note.to_string(), assets_imported: promoted.len() as u32 })
    })();
    let _ = fs::remove_dir_all(&staging);
    result
}

fn extract_local_assets(markdown: &str) -> Vec<String> {
    IMAGE_RE
        .captures_iter(markdown)
        .filter_map(|caps| caps.get(1).map(|value| value.as_str().trim().to_string()))
        .filter(|path| !path.starts_with("http://") && !path.starts_with("https://"))
        .collect()
}

pub fn export_text_bundle_for_vault(
    vault_root: &Path,
    note_rel: &str,
    output: &Path,
) -> Result<TextBundleExportOutput, VaultError> {
    let session = open_vault(vault_root)?;
    let note_path = RelativeVaultPath::parse(note_rel)?;
    export_text_bundle(&session.descriptor.id, &session.root, &note_path, output)
}
