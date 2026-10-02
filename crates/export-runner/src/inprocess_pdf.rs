//! Offline Markdown-to-PDF typesetting. Authored content is never evaluated as
//! Typst code. The compiler world contains only generated source, bundled fonts,
//! and caller-supplied immutable PNG/JPEG snapshots; it cannot read disk or fetch
//! packages. Native adapters own vault authorization and artifact publication.

mod markdown;

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use typst::diag::{FileError, FileResult};
use typst::foundations::{Bytes, Datetime, Duration};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_layout::PagedDocument;

pub const MAX_MARKDOWN_BYTES: usize = 256 * 1024;
pub const MAX_ASSET_BYTES: usize = 8 * 1024 * 1024;
pub const MAX_TOTAL_ASSET_BYTES: usize = 32 * 1024 * 1024;
pub const MAX_PDF_BYTES: usize = 32 * 1024 * 1024;
/// Redistribution notices for the unmodified fonts and data embedded by Typst.
/// Native About/license surfaces should expose this text with the PDF feature.
pub const BUNDLED_ASSET_NOTICES: &str = include_str!("../notices/typst-assets-NOTICE.txt");
const MAX_PAGES: usize = 256;
const MAX_ASSETS: usize = 32;
const MAX_IMAGE_PIXELS: u64 = 16_000_000;
const MAX_DIAGNOSTIC_BYTES: usize = 4096;

/// A reviewed image snapshot. `path` matches the Markdown image destination,
/// uses forward slashes, and is a relative logical identifier, not a disk path.
#[derive(Debug, Clone)]
pub struct PdfAsset {
    pub path: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug)]
pub struct PdfDocument {
    pub bytes: Vec<u8>,
    pub page_count: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum PdfError {
    #[error("offline PDF input exceeds {0}")]
    Limit(&'static str),
    #[error("offline PDF resource is invalid or unavailable: {0}")]
    Resource(String),
    #[error("offline PDF typesetting failed: {0}")]
    Typesetting(String),
    #[error("offline PDF refuses sealed content: {0}")]
    Sealed(String),
}

struct Fonts {
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
}

static FONTS: LazyLock<Fonts> = LazyLock::new(|| {
    let fonts: Vec<Font> = typst_assets::fonts()
        .flat_map(|data| Font::iter(Bytes::new(data)))
        .collect();
    let book = FontBook::from_fonts(fonts.iter());
    Fonts {
        book: LazyHash::new(book),
        fonts,
    }
});

// Generated, bounded programs are compiled serially so multiple exports cannot
// multiply compiler memory pressure. There is no cancellable external child.
static COMPILER: Mutex<()> = Mutex::new(());

struct CacheEviction;
impl Drop for CacheEviction {
    fn drop(&mut self) {
        // Do not retain private document/resource values in the global memoizer
        // after either successful compilation or a diagnostic failure.
        typst::comemo::evict(0);
    }
}

struct PdfWorld {
    library: LazyHash<Library>,
    source: Source,
    assets: HashMap<FileId, Bytes>,
}

impl World for PdfWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }
    fn book(&self) -> &LazyHash<FontBook> {
        &FONTS.book
    }
    fn main(&self) -> FileId {
        self.source.id()
    }
    fn source(&self, id: FileId) -> FileResult<Source> {
        if id == self.source.id() {
            Ok(self.source.clone())
        } else {
            Err(FileError::AccessDenied)
        }
    }
    fn file(&self, id: FileId) -> FileResult<Bytes> {
        if id == self.source.id() {
            return Ok(Bytes::from_string(self.source.text().to_owned()));
        }
        self.assets.get(&id).cloned().ok_or(FileError::AccessDenied)
    }
    fn font(&self, index: usize) -> Option<Font> {
        FONTS.fonts.get(index).cloned()
    }
    fn today(&self, _offset: Option<Duration>) -> Option<Datetime> {
        None
    }
}

pub(crate) fn valid_resource_path(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 1024
        && !path.starts_with('/')
        && !path.contains(['\\', ':', '%', '?', '#'])
        && !path.chars().any(char::is_control)
        && path
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

/// Enumerate local image destinations before an adapter takes vault-confined
/// snapshots. Remote images fail instead of being fetched implicitly.
pub fn markdown_image_paths(markdown: &str) -> Result<Vec<String>, PdfError> {
    if markdown.len() > MAX_MARKDOWN_BYTES {
        return Err(PdfError::Limit("256 KiB Markdown"));
    }
    let mut result = Vec::new();
    for event in pulldown_cmark::Parser::new_ext(
        markdown,
        pulldown_cmark::Options::ENABLE_TABLES
            | pulldown_cmark::Options::ENABLE_YAML_STYLE_METADATA_BLOCKS,
    ) {
        if let pulldown_cmark::Event::Start(pulldown_cmark::Tag::Image { dest_url, .. }) = event {
            let path = dest_url.as_ref();
            if !valid_resource_path(path) {
                return Err(PdfError::Resource(
                    "image must be a reviewed local PNG/JPEG snapshot".into(),
                ));
            }
            if !result.iter().any(|existing| existing == path) {
                if result.len() >= MAX_ASSETS {
                    return Err(PdfError::Limit("32 images"));
                }
                result.push(path.to_owned());
            }
        }
    }
    Ok(result)
}

fn image_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") && bytes.len() >= 24 && &bytes[12..16] == b"IHDR" {
        return Some((
            u32::from_be_bytes(bytes[16..20].try_into().ok()?),
            u32::from_be_bytes(bytes[20..24].try_into().ok()?),
        ));
    }
    if !bytes.starts_with(&[0xff, 0xd8]) {
        return None;
    }
    let mut offset = 2;
    while offset + 4 <= bytes.len() {
        if bytes[offset] != 0xff {
            return None;
        }
        let marker = bytes[offset + 1];
        if marker == 0xff {
            offset += 1;
            continue;
        }
        if marker == 0xd9 || marker == 0xda {
            return None;
        }
        if marker == 0x01 || (0xd0..=0xd7).contains(&marker) {
            offset += 2;
            continue;
        }
        let length = usize::from(u16::from_be_bytes(
            bytes[offset + 2..offset + 4].try_into().ok()?,
        ));
        if length < 2 || offset.checked_add(length + 2)? > bytes.len() {
            return None;
        }
        if matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf) {
            if length < 8 {
                return None;
            }
            let height = u16::from_be_bytes(bytes[offset + 5..offset + 7].try_into().ok()?);
            let width = u16::from_be_bytes(bytes[offset + 7..offset + 9].try_into().ok()?);
            return Some((u32::from(width), u32::from(height)));
        }
        offset += length + 2;
    }
    None
}

fn bounded_message(message: &str) -> String {
    let mut end = message.len().min(MAX_DIAGNOSTIC_BYTES);
    while !message.is_char_boundary(end) {
        end -= 1;
    }
    message[..end].to_owned()
}

/// Typeset structured Markdown entirely in process. HTML and authored Typst are
/// literal text; unsupported or remote images fail explicitly. No OS font scan,
/// environment lookup, subprocess, network, clock, package or filesystem access
/// occurs in the compiler world. Call on a native blocking worker, not the UI.
pub fn compile_markdown_pdf(
    markdown: &str,
    title: Option<&str>,
    assets: &[PdfAsset],
) -> Result<PdfDocument, PdfError> {
    if markdown.len() > MAX_MARKDOWN_BYTES {
        return Err(PdfError::Limit("256 KiB Markdown"));
    }
    if title.is_some_and(|value| value.len() > 1024 || value.chars().any(char::is_control)) {
        return Err(PdfError::Limit(
            "1024-byte title without control characters",
        ));
    }
    crate::sealed::check_or_redact(
        markdown,
        crate::sealed::RedactSecretsMode::Refuse,
        "offline PDF",
    )
    .map_err(|error| PdfError::Sealed(bounded_message(&error.to_string())))?;
    if assets.len() > MAX_ASSETS {
        return Err(PdfError::Limit("32 images"));
    }
    let mut files = HashMap::new();
    let mut destinations = HashMap::new();
    let mut total = 0usize;
    for (index, asset) in assets.iter().enumerate() {
        if !valid_resource_path(&asset.path) {
            return Err(PdfError::Resource("unsafe relative image path".into()));
        }
        if asset.bytes.len() > MAX_ASSET_BYTES {
            return Err(PdfError::Limit("8 MiB image"));
        }
        total = total
            .checked_add(asset.bytes.len())
            .ok_or(PdfError::Limit("32 MiB images"))?;
        if total > MAX_TOTAL_ASSET_BYTES {
            return Err(PdfError::Limit("32 MiB images"));
        }
        let (width, height) = image_dimensions(&asset.bytes).ok_or_else(|| {
            PdfError::Resource("only valid PNG/JPEG snapshots are allowed".into())
        })?;
        if width == 0 || height == 0 || u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
            return Err(PdfError::Limit("16 megapixel image"));
        }
        let extension = if asset.bytes.starts_with(b"\x89PNG") {
            "png"
        } else {
            "jpg"
        };
        let virtual_path = format!("/assets/{index}.{extension}");
        if destinations
            .insert(asset.path.clone(), virtual_path.clone())
            .is_some()
        {
            return Err(PdfError::Resource("duplicate image destination".into()));
        }
        let path = VirtualPath::new(&virtual_path)
            .map_err(|_| PdfError::Typesetting("invalid generated image identifier".into()))?;
        let id = FileId::new(RootedPath::new(VirtualRoot::Project, path));
        files.insert(id, Bytes::new(asset.bytes.clone()));
    }
    let generated = markdown::translate(markdown, title, &destinations)?;
    let path = VirtualPath::new("/main.typ")
        .map_err(|_| PdfError::Typesetting("invalid generated source identifier".into()))?;
    let id = FileId::new(RootedPath::new(VirtualRoot::Project, path));
    let world = PdfWorld {
        library: LazyHash::new(Library::default()),
        source: Source::new(id, generated),
        assets: files,
    };
    let _permit = COMPILER
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let _cache_eviction = CacheEviction;
    let compiled = typst::compile::<PagedDocument>(&world);
    let document = compiled.output.map_err(|errors| {
        PdfError::Typesetting(bounded_message(
            &errors
                .iter()
                .take(4)
                .map(|error| error.message.as_str())
                .collect::<Vec<_>>()
                .join("; "),
        ))
    })?;
    if document.pages().is_empty() || document.pages().len() > MAX_PAGES {
        return Err(PdfError::Limit("256 pages"));
    }
    let options = typst_pdf::PdfOptions {
        timestamp: None,
        ..Default::default()
    };
    let bytes = typst_pdf::pdf(&document, &options).map_err(|errors| {
        PdfError::Typesetting(bounded_message(
            &errors
                .iter()
                .take(4)
                .map(|error| error.message.as_str())
                .collect::<Vec<_>>()
                .join("; "),
        ))
    })?;
    if bytes.len() > MAX_PDF_BYTES {
        return Err(PdfError::Limit("32 MiB PDF"));
    }
    if !bytes.starts_with(b"%PDF-") || !bytes.trim_ascii_end().ends_with(b"%%EOF") {
        return Err(PdfError::Typesetting(
            "compiler returned an invalid PDF envelope".into(),
        ));
    }
    let warnings = compiled
        .warnings
        .iter()
        .take(4)
        .map(|warning| bounded_message(warning.message.as_str()))
        .collect();
    Ok(PdfDocument {
        bytes,
        page_count: document.pages().len(),
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resource_paths_are_logical_and_never_ambient_files() {
        for value in [
            "../secret.png",
            "/etc/passwd",
            "C:/secret.png",
            "a\\b.png",
            "a/%2e%2e/x.png",
            "https://example.com/a.png",
        ] {
            assert!(!valid_resource_path(value));
        }
        assert!(valid_resource_path("assets/image 1.png"));
    }
    #[test]
    fn oversized_png_dimensions_are_rejected_before_decode() {
        let mut bytes = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
        bytes.extend_from_slice(&100_000u32.to_be_bytes());
        bytes.extend_from_slice(&100_000u32.to_be_bytes());
        let error = compile_markdown_pdf(
            "![large](large.png)",
            None,
            &[PdfAsset {
                path: "large.png".into(),
                bytes,
            }],
        )
        .unwrap_err();
        assert!(matches!(error, PdfError::Limit(_)));
    }
    #[test]
    fn metadata_images_are_not_requested_for_snapshotting() {
        assert!(
            markdown_image_paths(
                "---\ncover: ![private](https://example.com/private.png)\n---\n\nPublic body"
            )
            .unwrap()
            .is_empty()
        );
    }
}
