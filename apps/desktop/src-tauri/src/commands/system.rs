use scriptor_system_bridge::{
    SystemInfo, detect_system_info, keychain_delete, keychain_get, keychain_set,
};
use scriptor_vault::{redact_json_value, redact_sensitive_text};
use serde::{Deserialize, Serialize};

use crate::AppState;
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{active_session, set_headless_engine as set_headless_engine_flag};

use super::media::{PlantUmlRenderOutput, render_plantuml_svg};

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
pub fn plantuml_render(
    state: tauri::State<AppState>,
    source: String,
    authorization_token: String,
) -> Result<PlantUmlRenderOutput, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::PlantUmlExecution,
        Some("local-renderer"),
    )?;
    render_plantuml_svg(&source)
}

#[tauri::command]
pub fn system_info() -> SystemInfo {
    detect_system_info()
}

const AI_PROVIDER_KEYCHAIN_ACCOUNT: &str = "ai.openai-compatible.api_key";
const AI_PROVIDER_SCOPE: &str = "ai-provider";
const AI_REQUEST_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Deserialize)]
struct AiProviderMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AiProviderChoice {
    message: Option<AiProviderMessage>,
}

#[derive(Debug, Deserialize)]
struct AiProviderResponse {
    choices: Option<Vec<AiProviderChoice>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDraftProposal {
    markdown: String,
}

fn validate_ai_endpoint(endpoint: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(endpoint)
        .map_err(|_| "AI provider endpoint is not a valid URL".to_string())?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "AI provider endpoint must include a host".to_string())?;
    let is_loopback = matches!(host, "localhost" | "127.0.0.1" | "::1");
    if parsed.scheme() != "https" && !(parsed.scheme() == "http" && is_loopback) {
        return Err(
            "AI provider endpoint must use https://; plain http is allowed only for loopback hosts"
                .into(),
        );
    }
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("AI provider endpoint must use http or https".into());
    }
    Ok(parsed)
}

#[tauri::command]
pub fn ai_provider_has_api_key() -> Result<bool, String> {
    keychain_get(AI_PROVIDER_KEYCHAIN_ACCOUNT)
        .map(|value| value.is_some_and(|secret| !secret.is_empty()))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn ai_provider_set_api_key(
    state: tauri::State<AppState>,
    secret: String,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::KeychainWrite,
        Some(AI_PROVIDER_SCOPE),
    )?;
    let secret = secret.trim();
    if secret.is_empty() || secret.len() > 16_384 {
        return Err("AI provider credential must contain between 1 and 16384 characters".into());
    }
    keychain_set(AI_PROVIDER_KEYCHAIN_ACCOUNT, secret).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn ai_provider_delete_api_key(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::KeychainDelete,
        Some(AI_PROVIDER_SCOPE),
    )?;
    keychain_delete(AI_PROVIDER_KEYCHAIN_ACCOUNT).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn ai_provider_propose_draft(
    state: tauri::State<'_, AppState>,
    endpoint: String,
    prompt: String,
    current_markdown: String,
    authorization_token: String,
) -> Result<AiDraftProposal, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::AiNetworkRequest,
        Some(&endpoint),
    )?;
    let endpoint = validate_ai_endpoint(&endpoint)?;
    if prompt.trim().is_empty() || prompt.len() > 64 * 1024 {
        return Err("AI instruction must contain between 1 and 65536 characters".into());
    }
    if current_markdown.len() > 4 * 1024 * 1024 {
        return Err("The current note is too large for an AI draft request".into());
    }

    let api_key = keychain_get(AI_PROVIDER_KEYCHAIN_ACCOUNT)
        .map_err(|error| error.to_string())?
        .filter(|secret| !secret.is_empty())
        .ok_or_else(|| "Add an API key in Settings before using AI draft proposals".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(AI_REQUEST_TIMEOUT_SECS))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| format!("failed to initialize AI provider client: {error}"))?;
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": "You rewrite Markdown notes. Return only the updated Markdown body with no commentary."
                },
                {
                    "role": "user",
                    "content": format!("Current note:\n\n{current_markdown}\n\nInstruction:\n{prompt}")
                }
            ],
            "temperature": 0.2
        }))
        .send()
        .await
        .map_err(|error| format!("AI provider request failed: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("AI provider request failed ({status})"));
    }
    let payload = response
        .json::<AiProviderResponse>()
        .await
        .map_err(|error| format!("AI provider returned an invalid response: {error}"))?;
    let markdown = payload
        .choices
        .and_then(|choices| choices.into_iter().next())
        .and_then(|choice| choice.message)
        .and_then(|message| message.content)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "AI provider returned an empty draft".to_string())?;

    Ok(AiDraftProposal { markdown })
}

#[tauri::command]
pub fn diagnostics_append_event(
    state: tauri::State<AppState>,
    event_type: String,
    message: String,
    detail_json: Option<String>,
) -> Result<(), String> {
    let session = active_session(&state)?;
    let diagnostics_dir = session.root.root().join(".scriptor").join("diagnostics");
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
