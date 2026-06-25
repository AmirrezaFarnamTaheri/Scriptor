use std::fs;
use std::path::Path;

use crate::args::ExportFormat;
use crate::error::ExportError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArtifactValidation {
    pub size_bytes: u64,
    pub format: String,
}

pub fn validate_export_artifact(path: &Path, format: ExportFormat) -> Result<ArtifactValidation, ExportError> {
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

    let prefix = read_prefix(path, 8)?;
    match format {
        ExportFormat::Html if !prefix.starts_with(b"<") && !prefix.starts_with(b"<!DOCTYP") => {
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

fn read_prefix(path: &Path, len: usize) -> Result<Vec<u8>, ExportError> {
    let mut buffer = vec![0u8; len];
    let mut file = fs::File::open(path).map_err(|source| ExportError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    use std::io::Read;
    let read = file.read(&mut buffer).map_err(|source| ExportError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    buffer.truncate(read);
    Ok(buffer)
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
    fn rejects_empty_artifact() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("note.html");
        fs::File::create(&path).expect("create");
        let error = validate_export_artifact(&path, ExportFormat::Html).expect_err("empty");
        assert!(matches!(error, ExportError::InvalidArtifact(_)));
    }
}
