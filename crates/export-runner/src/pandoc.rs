use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::Duration;

use scriptor_system_bridge::{ProcessSpec, run_process};

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
    let Some(expected) = expected_hash else {
        log::debug!("{label} trusted hash is not configured; skipping binary hashing");
        return Ok(None);
    };

    let computed = sha256_file(binary_path)?;
    log::info!(
        "{label} SHA-256: {computed} (path: {})",
        binary_path.display()
    );

    {
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
/// 3. `pandoc` resolved through the system process broker's PATH lookup
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

    probe_pandoc_program("pandoc", trusted_hash)
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
    if !path.exists() {
        return Err(ExportError::PandocMissing);
    }
    probe_pandoc_program(path.as_os_str().to_owned(), trusted_hash)
}

fn probe_pandoc_program(
    program: impl Into<OsString>,
    trusted_hash: Option<&str>,
) -> Result<PandocDiscovery, ExportError> {
    let spec = ProcessSpec::new(program)
        .arg("--version")
        .timeout(Duration::from_secs(5))
        .max_output_bytes(8 * 1024)
        .expected_sha256(trusted_hash.map(str::to_owned));
    let output = run_process(spec).map_err(|error| ExportError::Process(error.to_string()))?;
    if output.exit_code != 0 {
        return Err(ExportError::PandocMissing);
    }

    let version = output.stdout.lines().next().unwrap_or("pandoc").to_string();
    Ok(PandocDiscovery {
        path: output.resolved_program,
        version,
        sha256: output.program_sha256,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trusted_hash_validation_rejects_malformed_hash_before_execution() {
        let current = std::env::current_exe().expect("current executable");
        let error = probe_pandoc_with_hash(&current, Some("not-a-sha256")).unwrap_err();
        assert!(error.to_string().contains("hash mismatch") || error.to_string().contains("SHA"));
    }
}
