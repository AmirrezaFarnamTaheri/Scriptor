use crate::state::{AppState, active_session};

#[tauri::command]
pub fn plugin_state_get(
    state: tauri::State<AppState>,
) -> Result<scriptor_vault::PluginState, String> {
    let session = active_session(&state)?;
    scriptor_vault::load_plugin_state(session.root.root()).map_err(|error| error.to_string())
}

/// Store one per-user setting for a capability (never inside the vault).
/// Secret-shaped keys are rejected by `PluginState::validate`.
#[tauri::command]
pub fn plugin_state_set_setting(
    state: tauri::State<AppState>,
    capability_id: String,
    key: String,
    value: serde_json::Value,
) -> Result<scriptor_vault::PluginState, String> {
    let session = active_session(&state)?;
    let mut plugin_state = scriptor_vault::load_plugin_state(session.root.root())
        .map_err(|error| error.to_string())?;
    if key.is_empty() || key.len() > 64 {
        return Err("plugin setting key must be 1-64 characters".into());
    }
    let entry = plugin_state
        .settings
        .entry(capability_id)
        .or_insert_with(|| serde_json::json!({}));
    let Some(object) = entry.as_object_mut() else {
        return Err("plugin settings must be an object".into());
    };
    object.insert(key, value);
    plugin_state.validate().map_err(|error| error.to_string())?;
    scriptor_vault::save_plugin_state(session.root.root(), &plugin_state)
        .map_err(|error| error.to_string())?;
    Ok(plugin_state)
}

#[tauri::command]
pub fn plugin_state_set_enabled(
    state: tauri::State<AppState>,
    capability_id: String,
    enabled: bool,
) -> Result<scriptor_vault::PluginState, String> {
    let session = active_session(&state)?;
    let mut plugin_state = scriptor_vault::load_plugin_state(session.root.root())
        .map_err(|error| error.to_string())?;
    if enabled {
        plugin_state.disabled_plugins.remove(&capability_id);
        plugin_state.enabled_plugins.insert(capability_id);
    } else {
        plugin_state.enabled_plugins.remove(&capability_id);
        plugin_state.disabled_plugins.insert(capability_id);
    }
    plugin_state.validate().map_err(|error| error.to_string())?;
    scriptor_vault::save_plugin_state(session.root.root(), &plugin_state)
        .map_err(|error| error.to_string())?;
    if crate::state::use_headless_engine(&state) {
        crate::commands::daemon::bridge_reload_config(&state)?;
    }
    Ok(plugin_state)
}
