#[cfg(not(any(target_os = "ios", target_os = "android")))]
use scriptor_export_runner::inprocess_pdf::{
    MAX_ASSET_BYTES, MAX_TOTAL_ASSET_BYTES, PdfAsset, compile_markdown_pdf, markdown_image_paths,
};
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use scriptor_vault::RelativeVaultPath;
#[cfg(not(any(target_os = "ios", target_os = "android")))]
use std::{fs, io::Read, path::Path};

use crate::{MobileRuntime, RuntimeError};

/// Immutable, source-bound bytes. The platform adapter may publish these only
/// after an explicit system save picker grants its output path or content URI.
#[derive(Debug)]
pub struct MobilePdfSnapshot {
    pub bytes: Vec<u8>,
    pub filename: String,
    pub page_count: usize,
    pub warnings: Vec<String>,
}

impl MobileRuntime {
    /// iOS and Android cannot launch this desktop worker or enforce its
    /// process-level memory cap. Refuse the operation until a native isolated
    /// service/extension is implemented and tested on real devices.
    #[cfg(any(target_os = "ios", target_os = "android"))]
    pub fn export_pdf(
        &self,
        scope: u64,
        path: &str,
        expected_hash: &str,
    ) -> Result<MobilePdfSnapshot, RuntimeError> {
        let _ = (self, scope, path, expected_hash);
        Err(RuntimeError::Limit("isolated mobile PDF compiler is not available; export requires a native memory-limited worker"))
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    pub fn export_pdf(
        &self,
        scope: u64,
        path: &str,
        expected_hash: &str,
    ) -> Result<MobilePdfSnapshot, RuntimeError> {
        if expected_hash.is_empty() {
            return Err(RuntimeError::InvalidInput);
        }
        let relative = Self::path(path)?;
        let (note, assets) = {
            let session = self.session.lock().map_err(|_| RuntimeError::Unavailable)?;
            self.check(scope)?;
            let note = Self::read_scoped(&session, &relative)?;
            if note.metadata.content_hash != expected_hash {
                return Err(RuntimeError::StaleContent);
            }
            let mut total = 0usize;
            let mut assets = Vec::new();
            for destination in markdown_image_paths(&note.markdown)? {
                let parent = Path::new(relative.as_str())
                    .parent()
                    .unwrap_or_else(|| Path::new(""));
                let logical = parent
                    .join(&destination)
                    .to_string_lossy()
                    .replace('\\', "/");
                if logical.split('/').any(|part| {
                    matches!(
                        part,
                        ".scriptor" | ".git" | ".trash" | ".obsidian" | "node_modules"
                    )
                }) {
                    return Err(RuntimeError::InvalidInput);
                }
                let resource = RelativeVaultPath::parse(&logical)?;
                let absolute = session.root.resolve_relative(&resource)?;
                let file = fs::File::open(&absolute)?;
                let metadata = file.metadata()?;
                if !metadata.is_file() || metadata.len() > MAX_ASSET_BYTES as u64 {
                    return Err(RuntimeError::Limit("8 MiB regular raster image"));
                }
                let mut bytes = Vec::new();
                file.take(MAX_ASSET_BYTES as u64 + 1)
                    .read_to_end(&mut bytes)?;
                if bytes.len() > MAX_ASSET_BYTES {
                    return Err(RuntimeError::Limit("8 MiB image"));
                }
                total = total
                    .checked_add(bytes.len())
                    .ok_or(RuntimeError::Limit("32 MiB images"))?;
                if total > MAX_TOTAL_ASSET_BYTES {
                    return Err(RuntimeError::Limit("32 MiB images"));
                }
                if session.root.resolve_relative(&resource)? != absolute {
                    return Err(RuntimeError::InvalidInput);
                }
                assets.push(PdfAsset {
                    path: destination,
                    bytes,
                });
            }
            (note, assets)
        };
        // Do not hold the vault mutex while typesetting; lifecycle cancellation
        // and other requests remain responsive.
        let document = compile_markdown_pdf(&note.markdown, Some(&note.metadata.title), &assets)?;
        {
            let session = self.session.lock().map_err(|_| RuntimeError::Unavailable)?;
            self.check(scope)?;
            if Self::read_scoped(&session, &relative)?
                .metadata
                .content_hash
                != expected_hash
            {
                return Err(RuntimeError::StaleContent);
            }
        }
        Ok(MobilePdfSnapshot {
            bytes: document.bytes,
            filename: format!("{}.pdf", scriptor_export_runner::export_artifact_stem(path)),
            page_count: document.page_count,
            warnings: document.warnings,
        })
    }
}
