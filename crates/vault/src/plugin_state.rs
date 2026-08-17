//! Vault-scoped capability authority state.
//!
//! This file deliberately lives under `.scriptor/` instead of browser storage so
//! native and daemon callers enforce the same decision for an active vault.

use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{VaultError, atomic_write};

pub const PLUGIN_STATE_SCHEMA_VERSION: u32 = 1;
pub const PLUGIN_STATE_FILE: &str = "plugins.json";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginState {
    pub schema_version: u32,
    #[serde(default)]
    pub enabled_plugins: BTreeSet<String>,
    #[serde(default)]
    pub disabled_plugins: BTreeSet<String>,
    #[serde(default)]
    pub settings: BTreeMap<String, Value>,
}

impl Default for PluginState {
    fn default() -> Self {
        Self {
            schema_version: PLUGIN_STATE_SCHEMA_VERSION,
            enabled_plugins: BTreeSet::new(),
            disabled_plugins: BTreeSet::new(),
            settings: BTreeMap::new(),
        }
    }
}

impl PluginState {
    pub fn is_enabled(&self, capability_id: &str) -> bool {
        !self.disabled_plugins.contains(capability_id)
    }

    pub fn validate(&self) -> Result<(), VaultError> {
        if self.schema_version != PLUGIN_STATE_SCHEMA_VERSION {
            return Err(VaultError::InvalidConfig {
                message: format!(
                    "unsupported plugin state schemaVersion {}",
                    self.schema_version
                ),
            });
        }
        for id in self
            .enabled_plugins
            .iter()
            .chain(self.disabled_plugins.iter())
            .chain(self.settings.keys())
        {
            validate_capability_id(id)?;
        }
        if let Some(id) = self
            .enabled_plugins
            .intersection(&self.disabled_plugins)
            .next()
        {
            return Err(VaultError::InvalidConfig {
                message: format!("plugin capability '{id}' is both enabled and disabled"),
            });
        }
        for (id, setting) in &self.settings {
            if contains_secret_key(setting) {
                return Err(VaultError::InvalidConfig {
                    message: format!(
                        "plugin settings for '{id}' contain a prohibited secret-shaped key"
                    ),
                });
            }
        }
        Ok(())
    }
}

pub fn plugin_state_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".scriptor").join(PLUGIN_STATE_FILE)
}

pub fn load_plugin_state(vault_root: &Path) -> Result<PluginState, VaultError> {
    let path = plugin_state_path(vault_root);
    if !path.exists() {
        return Ok(PluginState::default());
    }
    let raw = fs::read_to_string(&path).map_err(|source| VaultError::io(&path, source))?;
    let state: PluginState =
        serde_json::from_str(&raw).map_err(|error| VaultError::InvalidConfig {
            message: format!("invalid plugin state at {}: {error}", path.display()),
        })?;
    state.validate()?;
    Ok(state)
}

pub fn save_plugin_state(vault_root: &Path, state: &PluginState) -> Result<(), VaultError> {
    state.validate()?;
    let path = plugin_state_path(vault_root);
    let dir = path.parent().expect("plugin state has parent");
    fs::create_dir_all(dir).map_err(|source| VaultError::io(dir, source))?;
    let payload = serde_json::to_vec_pretty(state)?;
    atomic_write(&path, &payload)
}

fn validate_capability_id(id: &str) -> Result<(), VaultError> {
    let valid = id.strip_prefix("scriptor.").is_some_and(|rest| {
        !rest.is_empty()
            && rest
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    });
    if valid {
        Ok(())
    } else {
        Err(VaultError::InvalidConfig {
            message: format!("invalid plugin capability id: {id}"),
        })
    }
}

fn contains_secret_key(value: &Value) -> bool {
    match value {
        Value::Object(map) => map.iter().any(|(key, child)| {
            let normalized = key.to_ascii_lowercase();
            normalized.contains("secret")
                || normalized.contains("token")
                || normalized.contains("password")
                || normalized.contains("api_key")
                || contains_secret_key(child)
        }),
        Value::Array(values) => values.iter().any(contains_secret_key),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_is_atomic_and_vault_scoped() {
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        let state = PluginState {
            disabled_plugins: ["scriptor.graph".into()].into_iter().collect(),
            ..Default::default()
        };
        save_plugin_state(first.path(), &state).unwrap();
        assert!(
            !load_plugin_state(first.path())
                .unwrap()
                .is_enabled("scriptor.graph")
        );
        assert!(
            load_plugin_state(second.path())
                .unwrap()
                .is_enabled("scriptor.graph")
        );
    }

    #[test]
    fn rejects_secret_shaped_settings_and_invalid_ids() {
        let mut state = PluginState::default();
        state.settings.insert(
            "scriptor.graph".into(),
            serde_json::json!({"apiToken":"no"}),
        );
        assert!(state.validate().is_err());
        state.settings.clear();
        state.disabled_plugins.insert("graph".into());
        assert!(state.validate().is_err());
    }

    #[test]
    fn malformed_state_is_rejected_without_resetting_the_file() {
        let vault = tempfile::tempdir().unwrap();
        let path = plugin_state_path(vault.path());
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"{\"schemaVersion\":1,\"enabledPlugins\":[").unwrap();
        let error = load_plugin_state(vault.path()).unwrap_err().to_string();
        assert!(error.contains("invalid plugin state"));
        assert_eq!(
            std::fs::read_to_string(path).unwrap(),
            "{\"schemaVersion\":1,\"enabledPlugins\":["
        );
    }
}
