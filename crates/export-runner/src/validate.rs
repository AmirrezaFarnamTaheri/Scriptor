use std::fs;
use std::path::Path;

use crate::args::ExportFormat;
use crate::error::ExportError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArtifactValidation {
    pub size_bytes: u64,
    pub format: String,
}

pub fn validate_export_artifact(
    path: &Path,
    format: ExportFormat,
) -> Result<ArtifactValidation, ExportError> {
    let metadata = fs::metadata(path).map_err(|source| ExportError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    let size_bytes = metadata.len();
    if size_bytes == 0 {
        return Err(ExportError::InvalidArtifact(format!(
            "artifact is empty: {}",
            path.display()
        )));
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if extension != format.extension() {
        return Err(ExportError::InvalidArtifact(format!(
            "expected .{} artifact, found .{extension}",
            format.extension()
        )));
    }

    let prefix = read_prefix(path, PREFIX_BYTES)?;
    let prefix = strip_leading_noise(&prefix);
    match format {
        ExportFormat::Html if !prefix.starts_with(b"<") => {
            return Err(ExportError::InvalidArtifact(
                "HTML artifact does not start with markup".into(),
            ));
        }
        ExportFormat::Pdf if !prefix.starts_with(b"%PDF") => {
            return Err(ExportError::InvalidArtifact(
                "PDF artifact missing %PDF header".into(),
            ));
        }
        _ => {}
    }

    Ok(ArtifactValidation {
        size_bytes,
        format: format.extension().to_string(),
    })
}

/// Enough for a UTF-8 BOM plus leading whitespace plus the longest magic we
/// check (`%PDF`).
const PREFIX_BYTES: usize = 32;

const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];

/// Read up to `len` bytes from the front of `path`.
///
/// `Read::read` may return a short read for reasons unrelated to EOF, which
/// used to make a perfectly valid PDF fail the `%PDF` check. `read_exact`
/// loops until the buffer is full, and a genuinely shorter file surfaces as
/// `UnexpectedEof`, which is not an error here -- we just keep what was read.
fn read_prefix(path: &Path, len: usize) -> Result<Vec<u8>, ExportError> {
    use std::io::{ErrorKind, Read};

    let mut file = fs::File::open(path).map_err(|source| ExportError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    let mut buffer = vec![0u8; len];
    match file.read_exact(&mut buffer) {
        Ok(()) => Ok(buffer),
        Err(error) if error.kind() == ErrorKind::UnexpectedEof => {
            // The file is simply shorter than `len`; keep whatever it holds.
            let mut short = Vec::new();
            fs::File::open(path)
                .map_err(|source| ExportError::Io {
                    path: path.to_path_buf(),
                    source,
                })?
                .take(len as u64)
                .read_to_end(&mut short)
                .map_err(|source| ExportError::Io {
                    path: path.to_path_buf(),
                    source,
                })?;
            Ok(short)
        }
        Err(source) => Err(ExportError::Io {
            path: path.to_path_buf(),
            source,
        }),
    }
}

/// Drop a leading UTF-8 BOM and any leading ASCII whitespace so a byte-order
/// mark or stray newline emitted by a template does not fail a valid artifact.
fn strip_leading_noise(prefix: &[u8]) -> &[u8] {
    let without_bom = prefix.strip_prefix(UTF8_BOM).unwrap_or(prefix);
    let offset = without_bom
        .iter()
        .position(|byte| !byte.is_ascii_whitespace())
        .unwrap_or(without_bom.len());
    &without_bom[offset..]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn accepts_minimal_html_artifact() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("note.html");
        fs::File::create(&path)
            .expect("create")
            .write_all(b"<html><body>ok</body></html>")
            .expect("write");
        let validation = validate_export_artifact(&path, ExportFormat::Html).expect("valid");
        assert!(validation.size_bytes > 0);
    }

    #[test]
    fn accepts_html_with_utf8_bom_and_leading_newline() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("note.html");
        let mut file = fs::File::create(&path).expect("create");
        file.write_all(&[0xEF, 0xBB, 0xBF]).expect("bom");
        file.write_all(b"\n\r\n  <!DOCTYPE html><html></html>")
            .expect("write");
        validate_export_artifact(&path, ExportFormat::Html).expect("BOM + newline is valid HTML");
    }

    #[test]
    fn accepts_pdf_shorter_than_the_prefix_window() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("note.pdf");
        // Far shorter than PREFIX_BYTES: read_exact must tolerate the EOF.
        fs::File::create(&path)
            .expect("create")
            .write_all(b"%PDF-1.7\n")
            .expect("write");
        let validation = validate_export_artifact(&path, ExportFormat::Pdf).expect("valid pdf");
        assert_eq!(validation.size_bytes, 9);
    }

    #[test]
    fn accepts_full_length_pdf_header() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("note.pdf");
        let mut body = b"%PDF-1.7\n".to_vec();
        body.extend(std::iter::repeat_n(b'x', 4096));
        fs::File::create(&path)
            .expect("create")
            .write_all(&body)
            .expect("write");
        validate_export_artifact(&path, ExportFormat::Pdf).expect("valid pdf");
    }

    #[test]
    fn still_rejects_a_pdf_without_the_magic() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("note.pdf");
        fs::File::create(&path)
            .expect("create")
            .write_all(b"not a pdf at all")
            .expect("write");
        let error = validate_export_artifact(&path, ExportFormat::Pdf).expect_err("bad magic");
        assert!(matches!(error, ExportError::InvalidArtifact(_)));
    }

    #[test]
    fn strip_leading_noise_handles_bom_whitespace_and_all_blank() {
        assert_eq!(strip_leading_noise(b"<html>"), b"<html>");
        assert_eq!(
            strip_leading_noise(&[0xEF, 0xBB, 0xBF, b'\n', b'<', b'a', b'>']),
            b"<a>"
        );
        assert_eq!(strip_leading_noise(b"   \n\t"), b"");
    }

    #[test]
    fn rejects_empty_artifact() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("note.html");
        fs::File::create(&path).expect("create");
        let error = validate_export_artifact(&path, ExportFormat::Html).expect_err("empty");
        assert!(matches!(error, ExportError::InvalidArtifact(_)));
    }
}
