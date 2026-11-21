use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::atomic_write;

pub const DEFAULT_SNIPPETS_PATH: &str = ".scriptor/snippets.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VaultSnippet {
    pub name: String,
    pub content: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct VaultSnippetCatalog {
    #[serde(default)]
    snippets: Vec<VaultSnippet>,
}

pub fn save_vault_snippets(vault_root: &Path, snippets: &[VaultSnippet]) -> Result<(), VaultError> {
    let path = vault_root.join(DEFAULT_SNIPPETS_PATH);
    crate::fs::create_state_parent(&path)?;
    let catalog = VaultSnippetCatalog {
        snippets: snippets.to_vec(),
    };
    let raw =
        serde_json::to_string_pretty(&catalog).map_err(|error| VaultError::InvalidConfig {
            message: format!("failed to encode snippets catalog: {error}"),
        })?;
    atomic_write(&path, raw.as_bytes())?;
    Ok(())
}

pub fn load_vault_snippets(vault_root: &Path) -> Result<Vec<VaultSnippet>, VaultError> {
    let path = vault_root.join(DEFAULT_SNIPPETS_PATH);
    let Some(raw) = crate::fs::read_state_file(&path, crate::fs::MAX_STATE_FILE_BYTES)? else {
        return Ok(Vec::new());
    };
    let catalog: VaultSnippetCatalog =
        serde_json::from_str(&raw).map_err(|error| VaultError::InvalidConfig {
            message: format!("invalid snippets catalog at {DEFAULT_SNIPPETS_PATH}: {error}"),
        })?;

    let mut snippets = Vec::new();
    for entry in catalog.snippets {
        let name = entry.name.trim();
        if name.is_empty() {
            continue;
        }
        if entry.content.is_empty() {
            continue;
        }
        snippets.push(VaultSnippet {
            name: name.to_string(),
            content: entry.content,
            description: entry.description.filter(|value| !value.trim().is_empty()),
        });
    }

    Ok(snippets)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use tempfile::tempdir;

    #[test]
    fn missing_catalog_returns_empty() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        assert!(load_vault_snippets(dir.path())?.is_empty());
        Ok(())
    }

    #[test]
    fn parses_catalog_entries() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let meta = dir.path().join(".scriptor");
        fs::create_dir_all(&meta)?;
        fs::write(
            meta.join("snippets.json"),
            r#"{
  "snippets": [
    { "name": "callout", "description": "AI callout", "content": "> [!ai] ${1:prompt}\n" }
  ]
}"#,
        )?;

        let snippets = load_vault_snippets(dir.path())?;
        assert_eq!(snippets.len(), 1);
        assert_eq!(snippets[0].name, "callout");
        assert_eq!(snippets[0].description.as_deref(), Some("AI callout"));
        Ok(())
    }
}
