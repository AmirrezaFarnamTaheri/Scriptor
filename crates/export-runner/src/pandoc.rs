use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::ExportError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PandocDiscovery {
    pub path: String,
    pub version: String,
    pub sha256: Option<String>,
}

/// Compute the SHA-256 hash of a file at the given path, returning a hex string.
pub fn sha256_file(path: &Path) -> Result<String, ExportError> {
    use std::io::Read;

    let mut file = std::fs::File::open(path).map_err(|source| ExportError::Io {
        path: path.to_path_buf(),
        source,
    })?;

    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let bytes_read = file.read(&mut buffer).map_err(|source| ExportError::Io {
            path: path.to_path_buf(),
            source,
        })?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(hex::encode(hasher.finalize()))
}

/// Verify a binary's SHA-256 hash against a trusted hash from vault config.
/// Returns Ok(()) if the hash matches or no trusted hash is configured.
/// Returns Err if the hash does not match.
pub fn verify_binary_hash(
    binary_path: &Path,
    expected_hash: Option<&str>,
    label: &str,
) -> Result<Option<String>, ExportError> {
    let computed = sha256_file(binary_path)?;

    log::info!(
        "{label} SHA-256: {computed} (path: {})",
        binary_path.display()
    );

    if let Some(expected) = expected_hash {
        let normalized = expected.trim().to_ascii_lowercase();
        if normalized.len() != 64 || !normalized.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(ExportError::Process(format!(
                "{label} trusted hash must be a 64-character SHA-256 hex digest"
            )));
        }
        if computed != normalized {
            return Err(ExportError::Process(format!(
                "{label} hash mismatch: expected {normalized}, found {computed}"
            )));
        }
    }

    Ok(Some(computed))
}

/// Resolve Pandoc for export jobs.
///
/// Resolution order:
/// 1. `SCRIPTOR_PANDOC_PATH` when set to an executable that responds to `--version`
/// 2. `SCRIPTOR_BUNDLED_PANDOC_DIR/pandoc(.exe)` when bundled installer populated resources
/// 3. `pandoc` on `PATH` (Windows: `where pandoc`, Unix: `which pandoc`)
pub fn discover_pandoc() -> Result<PandocDiscovery, ExportError> {
    discover_pandoc_with_trusted_hash(None)
}

/// Like [`discover_pandoc`], but also verifies the binary against a trusted hash if provided.
pub fn discover_pandoc_with_trusted_hash(
    trusted_hash: Option<&str>,
) -> Result<PandocDiscovery, ExportError> {
    if let Ok(override_path) = std::env::var("SCRIPTOR_PANDOC_PATH") {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            return probe_pandoc_with_hash(Path::new(trimmed), trusted_hash);
        }
    }

    for bundled in bundled_pandoc_paths() {
        if bundled.exists() {
            match probe_pandoc_with_hash(&bundled, trusted_hash) {
                Ok(discovery) => return Ok(discovery),
                // A trusted hash was configured and this bundled binary failed
                // verification: fail closed rather than silently falling
                // through to an unverified PATH pandoc.
                Err(error) if trusted_hash.is_some() => return Err(error),
                Err(_) => continue,
            }
        }
    }

    let path = which_pandoc().ok_or(ExportError::PandocMissing)?;
    probe_pandoc_with_hash(&path, trusted_hash)
}

fn bundled_pandoc_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(dir) = std::env::var("SCRIPTOR_BUNDLED_PANDOC_DIR") {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let base = PathBuf::from(trimmed);
            paths.push(base.join(if cfg!(windows) {
                "pandoc.exe"
            } else {
                "pandoc"
            }));
        }
    }
    paths
}

fn probe_pandoc_with_hash(
    path: &Path,
    trusted_hash: Option<&str>,
) -> Result<PandocDiscovery, ExportError> {
    let resolved_path = if path == Path::new("pandoc") {
        which_pandoc().ok_or(ExportError::PandocMissing)?
    } else {
        path.to_path_buf()
    };

    if !resolved_path.exists() {
        return Err(ExportError::PandocMissing);
    }

    let sha256 = verify_binary_hash(&resolved_path, trusted_hash, "pandoc")?;

    // PROCESS_BROKER_EXCEPTION(pandoc-version-probe)
    let output = Command::new(&resolved_path)
        .arg("--version")
        .output()
        .map_err(|_| ExportError::PandocMissing)?;

    if !output.status.success() {
        return Err(ExportError::PandocMissing);
    }

    let version = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("pandoc")
        .to_string();

    Ok(PandocDiscovery {
        path: resolved_path.display().to_string(),
        version,
        sha256,
    })
}

fn which_pandoc() -> Option<PathBuf> {
    if cfg!(windows) {
        // PROCESS_BROKER_EXCEPTION(pandoc-discovery-windows)
        Command::new("where")
            .arg("pandoc")
            .output()
            .ok()
            .and_then(|output| {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .map(|line| PathBuf::from(line.trim()))
            })
    } else {
        // PROCESS_BROKER_EXCEPTION(pandoc-discovery-unix)
        Command::new("which")
            .arg("pandoc")
            .output()
            .ok()
            .and_then(|output| {
                let line = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if line.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(line))
                }
            })
    }
}
