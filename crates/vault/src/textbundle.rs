use std::fs;
use std::io::{Read, Write};
use std::path::Path;

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::error::VaultError;
use crate::note::read_note;
use crate::open::open_vault;
use crate::path::{RelativeVaultPath, VaultRoot};
use crate::write::save_note;

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

    let file = fs::File::create(output_path).map_err(|source| VaultError::io(output_path, source))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("text.md", options)
        .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
    zip.write_all(document.markdown.as_bytes())
        .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;

    let mut asset_count = 0u32;
    for asset in extract_local_assets(&document.markdown) {
        let asset_path = root.resolve_relative(&RelativeVaultPath::parse(&asset)?)?;
        if asset_path.is_file() {
            let mut buffer = Vec::new();
            fs::File::open(&asset_path)
                .and_then(|mut file| file.read_to_end(&mut buffer))
                .map_err(|source| VaultError::io(&asset_path, source))?;
            zip.start_file(format!("assets/{asset}"), options)
                .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
            zip.write_all(&buffer)
                .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
            asset_count += 1;
        }
    }

    zip.finish()
        .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;

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
    let file = fs::File::open(bundle_path).map_err(|source| VaultError::io(bundle_path, source))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;

    let mut markdown = String::new();
    {
        let mut entry = archive
            .by_name("text.md")
            .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
        entry
            .read_to_string(&mut markdown)
            .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
    }

    let mut assets_imported = 0u32;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
        let name = entry.name().to_string();
        if !name.starts_with("assets/") || name.ends_with('/') {
            continue;
        }
        let relative = name.trim_start_matches("assets/");
        let dest = root.resolve_relative(&RelativeVaultPath::parse(relative)?)?;
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
        }
        let mut buffer = Vec::new();
        entry
            .read_to_end(&mut buffer)
            .map_err(|error| VaultError::InvalidConfig { message: error.to_string() })?;
        fs::write(&dest, buffer).map_err(|source| VaultError::io(&dest, source))?;
        assets_imported += 1;
    }

    save_note(vault_id, root, target_note, &markdown, None)?;
    Ok(TextBundleImportOutput {
        note_path: target_note.to_string(),
        assets_imported,
    })
}

fn extract_local_assets(markdown: &str) -> Vec<String> {
    let image_re = regex::Regex::new(r"!\[[^\]]*\]\(([^)]+)\)").expect("image regex");
    image_re
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
