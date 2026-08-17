use crate::state::{AppState, active_session};

#[tauri::command]
pub fn plugin_state_get(
    state: tauri::State<AppState>,
) -> Result<scriptor_vault::PluginState, String> {
    let session = active_session(&state)?;
    scriptor_vault::load_plugin_state(session.root.root()).map_err(|error| error.to_string())
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
    Ok(plugin_state)
}
