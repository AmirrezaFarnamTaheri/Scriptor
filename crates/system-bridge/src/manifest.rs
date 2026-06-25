use std::fs;
use std::io::Read;
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::BridgeError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReleaseManifestEntry {
    pub path: String,
    pub sha256: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReleaseManifest {
    pub version: String,
    pub artifacts: Vec<ReleaseManifestEntry>,
}

pub fn hash_file(path: impl AsRef<Path>) -> Result<String, BridgeError> {
    let bytes = fs::read(path.as_ref()).map_err(|source| BridgeError::Io {
        path: path.as_ref().to_path_buf(),
        source,
    })?;
    Ok(hash_bytes(&bytes))
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex::encode(digest)
}

pub fn verify_manifest(manifest: &ReleaseManifest, base_dir: impl AsRef<Path>) -> Result<(), BridgeError> {
    let base = base_dir.as_ref();
    for entry in &manifest.artifacts {
        let path = base.join(&entry.path);
        if !path.is_file() {
            return Err(BridgeError::Unsupported(format!("missing artifact: {}", entry.path)));
        }
        let metadata = fs::metadata(&path).map_err(|source| BridgeError::Io {
            path: path.clone(),
            source,
        })?;
        if metadata.len() != entry.size_bytes {
            return Err(BridgeError::Unsupported(format!(
                "size mismatch for {}: expected {} got {}",
                entry.path,
                entry.size_bytes,
                metadata.len()
            )));
        }
        let actual = hash_file(&path)?;
        if actual != entry.sha256.to_ascii_lowercase() {
            return Err(BridgeError::Unsupported(format!(
                "sha256 mismatch for {}: expected {} got {}",
                entry.path, entry.sha256, actual
            )));
        }
    }
    Ok(())
}

pub fn read_manifest(path: impl AsRef<Path>) -> Result<ReleaseManifest, BridgeError> {
    let mut file = fs::File::open(path.as_ref()).map_err(|source| BridgeError::Io {
        path: path.as_ref().to_path_buf(),
        source,
    })?;
    let mut json = String::new();
    file.read_to_string(&mut json).map_err(|source| BridgeError::Io {
        path: path.as_ref().to_path_buf(),
        source,
    })?;
    serde_json::from_str(&json).map_err(|error| BridgeError::Unsupported(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn verify_manifest_roundtrip() {
        let dir = tempdir().expect("tempdir");
        let artifact = dir.path().join("app.exe");
        fs::write(&artifact, b"scriptor-test-payload").expect("write");
        let hash = hash_file(&artifact).expect("hash");
        let manifest = ReleaseManifest {
            version: "0.1.0".into(),
            artifacts: vec![ReleaseManifestEntry {
                path: "app.exe".into(),
                sha256: hash,
                size_bytes: 21,
            }],
        };
        verify_manifest(&manifest, dir.path()).expect("verify");
    }
}
