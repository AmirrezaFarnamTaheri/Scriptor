use scriptor_system_bridge::{detect_system_info, keychain_delete, keychain_get, keychain_set, SystemInfo};
use scriptor_vault::{redact_json_value, redact_sensitive_text};

use crate::AppState;
use crate::state::{active_session, set_headless_engine as set_headless_engine_flag};

use super::media::{render_plantuml_svg, PlantUmlRenderOutput};

#[tauri::command]
pub fn set_headless_engine(state: tauri::State<AppState>, enabled: bool) -> Result<(), String> {
    set_headless_engine_flag(&state, enabled);
    Ok(())
}

#[tauri::command]
pub fn health_check() -> &'static str {
    "ok"
}

#[tauri::command]
pub fn copy_text_to_clipboard(text: String) -> Result<(), String> {
    arboard::Clipboard::new()
        .map_err(|error| error.to_string())?
        .set_text(text)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn plantuml_render(source: String) -> Result<PlantUmlRenderOutput, String> {
    render_plantuml_svg(&source)
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    detect_system_info()
}

#[tauri::command]
pub fn keychain_set_secret(account: String, secret: String) -> Result<(), String> {
    keychain_set(&account, &secret).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn keychain_get_secret(account: String) -> Result<Option<String>, String> {
    keychain_get(&account).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn keychain_delete_secret(account: String) -> Result<(), String> {
    keychain_delete(&account).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn diagnostics_append_event(
    state: tauri::State<AppState>,
    event_type: String,
    message: String,
    detail_json: Option<String>,
) -> Result<(), String> {
    let session = active_session(&state)?;
    let diagnostics_dir = session
        .root
        .root()
        .join(".scriptor")
        .join("diagnostics");
    std::fs::create_dir_all(&diagnostics_dir).map_err(|error| error.to_string())?;

    let timestamp_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    let redacted_message = redact_sensitive_text(&message);
    let redacted_detail = detail_json.as_ref().and_then(|raw| {
        serde_json::from_str::<serde_json::Value>(raw)
            .ok()
            .map(|value| {
                serde_json::to_string(&redact_json_value(&value))
                    .unwrap_or_else(|_| "\"[REDACTED]\"".into())
            })
    });

    let line = serde_json::json!({
        "ts": timestamp_secs,
        "type": event_type,
        "message": redacted_message,
        "detail": redacted_detail,
    });

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(diagnostics_dir.join("client.jsonl"))
        .map_err(|error| error.to_string())?;
    writeln!(file, "{line}").map_err(|error| error.to_string())?;
    Ok(())
}
