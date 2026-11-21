//! Per-user, per-vault capability authority state.
//!
//! The state lives in the user's application data directory (keyed by a hash of
//! the vault's canonical path), never inside the vault: a cloned or shared vault
//! must not be able to arrive with optional capabilities already enabled.
//! Native and daemon callers resolve the same file, so they enforce the same
//! decision. A legacy `.scriptor/plugins.json` is honoured only for its
//! `disabledPlugins` (restrictions are safe to inherit; enablement is not).

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

    /// Optional integrations are fail-closed: absence from both sets must not
    /// inherit the default-on behavior used by built-in product capabilities.
    pub fn is_explicitly_enabled(&self, capability_id: &str) -> bool {
        self.enabled_plugins.contains(capability_id)
            && !self.disabled_plugins.contains(capability_id)
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

/// Base directory for per-user plugin state. `SCRIPTOR_USER_DATA_DIR` overrides
/// the platform default (portable installs, hermetic tests).
fn user_state_base() -> Result<PathBuf, VaultError> {
    let missing = |what: &str| VaultError::InvalidConfig {
        message: format!("could not resolve the user data directory ({what})"),
    };
    if let Some(dir) = std::env::var_os("SCRIPTOR_USER_DATA_DIR").filter(|v| !v.is_empty()) {
        return Ok(PathBuf::from(dir));
    }
    let base = if cfg!(windows) {
        std::env::var_os("APPDATA")
            .or_else(|| std::env::var_os("USERPROFILE"))
            .map(PathBuf::from)
            .ok_or_else(|| missing("APPDATA"))?
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME")
            .map(|home| PathBuf::from(home).join("Library/Application Support"))
            .ok_or_else(|| missing("HOME"))?
    } else {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share"))
            })
            .ok_or_else(|| missing("HOME"))?
    };
    Ok(base.join("scriptor"))
}

fn state_file_in(base: &Path, vault_root: &Path) -> PathBuf {
    use sha2::{Digest, Sha256};
    let canonical = vault_root
        .canonicalize()
        .unwrap_or_else(|_| vault_root.to_path_buf());
    let digest = Sha256::digest(canonical.to_string_lossy().as_bytes());
    base.join("plugin-state")
        .join(format!("{}.json", hex::encode(&digest[..16])))
}

pub fn plugin_state_path(vault_root: &Path) -> PathBuf {
    match user_state_base() {
        Ok(base) => state_file_in(&base, vault_root),
        // Unresolvable user dir: fall back to a path that can never exist so
        // loads yield the fail-closed default and saves surface an error.
        Err(_) => PathBuf::new(),
    }
}

fn legacy_state_path(vault_root: &Path) -> PathBuf {
    vault_root.join(".scriptor").join(PLUGIN_STATE_FILE)
}

fn read_state(path: &Path) -> Result<PluginState, VaultError> {
    let raw = fs::read_to_string(path).map_err(|source| VaultError::io(path, source))?;
    let state: PluginState =
        serde_json::from_str(&raw).map_err(|error| VaultError::InvalidConfig {
            message: format!("invalid plugin state at {}: {error}", path.display()),
        })?;
    state.validate()?;
    Ok(state)
}

fn load_in(base: &Path, vault_root: &Path) -> Result<PluginState, VaultError> {
    let path = state_file_in(base, vault_root);
    if path.exists() {
        return read_state(&path);
    }
    // First run after upgrade: inherit only the restrictions a vault declared.
    let mut state = PluginState::default();
    if let Ok(legacy) = read_state(&legacy_state_path(vault_root)) {
        state.disabled_plugins = legacy.disabled_plugins;
    }
    Ok(state)
}

fn save_in(base: &Path, vault_root: &Path, state: &PluginState) -> Result<(), VaultError> {
    state.validate()?;
    let path = state_file_in(base, vault_root);
    let dir = path.parent().ok_or_else(|| VaultError::InvalidConfig {
        message: format!("plugin state path has no parent: {}", path.display()),
    })?;
    fs::create_dir_all(dir).map_err(|source| VaultError::io(dir, source))?;
    let payload = serde_json::to_vec_pretty(state)?;
    atomic_write(&path, &payload)
}

pub fn load_plugin_state(vault_root: &Path) -> Result<PluginState, VaultError> {
    load_in(&user_state_base()?, vault_root)
}

pub fn save_plugin_state(vault_root: &Path, state: &PluginState) -> Result<(), VaultError> {
    save_in(&user_state_base()?, vault_root, state)
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
        let base = tempfile::tempdir().unwrap();
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        let state = PluginState {
            disabled_plugins: ["scriptor.graph".into()].into_iter().collect(),
            ..Default::default()
        };
        save_in(base.path(), first.path(), &state).unwrap();
        assert!(
            !load_in(base.path(), first.path())
                .unwrap()
                .is_enabled("scriptor.graph")
        );
        assert!(
            load_in(base.path(), second.path())
                .unwrap()
                .is_enabled("scriptor.graph")
        );
        // Nothing is written into the vault itself.
        assert!(!first.path().join(".scriptor").exists());
    }

    #[test]
    fn per_user_settings_round_trip_and_stay_out_of_the_vault() {
        let base = tempfile::tempdir().unwrap();
        let vault = tempfile::tempdir().unwrap();
        let mut state = PluginState::default();
        state
            .settings
            .insert("scriptor.mcp".into(), serde_json::json!({"mode": "draft"}));
        save_in(base.path(), vault.path(), &state).unwrap();
        let loaded = load_in(base.path(), vault.path()).unwrap();
        assert_eq!(loaded.settings["scriptor.mcp"]["mode"], "draft");
        assert!(!vault.path().join(".scriptor").exists());
    }

    #[test]
    fn a_cloned_vault_cannot_arrive_with_plugins_enabled() {
        let base = tempfile::tempdir().unwrap();
        let vault = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(vault.path().join(".scriptor")).unwrap();
        std::fs::write(
            legacy_state_path(vault.path()),
            br#"{"schemaVersion":1,"enabledPlugins":["scriptor.gmail-manager"],"disabledPlugins":["scriptor.graph"]}"#,
        )
        .unwrap();
        let state = load_in(base.path(), vault.path()).unwrap();
        assert!(!state.is_explicitly_enabled("scriptor.gmail-manager"));
        // Restrictions are safe to inherit.
        assert!(!state.is_enabled("scriptor.graph"));
    }

    #[test]
    fn optional_capabilities_require_an_explicit_enable_record() {
        let mut state = PluginState::default();
        assert!(!state.is_explicitly_enabled("scriptor.gmail-manager"));

        state
            .enabled_plugins
            .insert("scriptor.gmail-manager".into());
        assert!(state.is_explicitly_enabled("scriptor.gmail-manager"));

        state
            .disabled_plugins
            .insert("scriptor.gmail-manager".into());
        assert!(!state.is_explicitly_enabled("scriptor.gmail-manager"));
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
        let base = tempfile::tempdir().unwrap();
        let vault = tempfile::tempdir().unwrap();
        let path = state_file_in(base.path(), vault.path());
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, b"{\"schemaVersion\":1,\"enabledPlugins\":[").unwrap();
        let error = load_in(base.path(), vault.path()).unwrap_err().to_string();
        assert!(error.contains("invalid plugin state"));
        assert_eq!(
            std::fs::read_to_string(path).unwrap(),
            "{\"schemaVersion\":1,\"enabledPlugins\":["
        );
    }
}
