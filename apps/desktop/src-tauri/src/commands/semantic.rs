//! Semantic (embedding) search commands. The daemon owns the engine;
//! these wrappers authorize the AI-network call, attach the OpenAI key
//! from the OS keychain (Ollama needs none), and surface the graceful
//! "unavailable" payload so the UI can fall back to keyword search. The
//! embeddings crate itself stays daemon-side by contract.

use scriptor_ipc::{RpcMethod, RpcPayload};
use scriptor_system_bridge::{keychain_delete, keychain_get, keychain_set};

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::commands::daemon::{daemon_rpc, with_verified_vault};
use crate::state::AppState;

/// Keychain account holding the user-supplied OpenAI key for semantic
/// embeddings. Ollama users never need this.
const SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT: &str = "semantic.openai.key";

fn semantic_payload(payload: RpcPayload) -> Result<String, String> {
    match payload {
        RpcPayload::Json { json } => Ok(json),
        _ => Err("unexpected daemon semantic response".into()),
    }
}

/// Reads current hashes and stored vectors locally, without a network request.
#[tauri::command]
pub fn semantic_inspect(
    state: tauri::State<AppState>,
    limit: Option<u32>,
    expected_vault_id: Option<String>,
) -> Result<String, String> {
    let limit = limit.unwrap_or(128);
    if !(1..=256).contains(&limit) {
        return Err("projection limit must be between 1 and 256".into());
    }
    let session = crate::state::active_session(&state)?;
    if expected_vault_id
        .as_deref()
        .is_some_and(|id| id != session.descriptor.id)
    {
        return Err("vault changed; reload the inspector".into());
    }
    with_verified_vault(&state, "semantic inspection", || {
        daemon_rpc(RpcMethod::EmbeddingsInspect { limit })
    })
    .and_then(semantic_payload)
}

#[tauri::command]
pub fn semantic_set_api_key(
    state: tauri::State<AppState>,
    secret: String,
    authorization_token: String,
) -> Result<(), String> {
    if secret.trim().is_empty() || secret.len() > 8192 || secret.chars().any(char::is_control) {
        return Err("invalid semantic API key".into());
    }
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::KeychainWrite,
        Some(SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT),
        None,
    )?;
    keychain_set(SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT, &secret).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn semantic_delete_api_key(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::KeychainDelete,
        Some(SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT),
        None,
    )?;
    keychain_delete(SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT).map_err(|e| e.to_string())
}

/// Semantic search: returns `{"available":false}` when the vault has no
/// `semantic` section, letting callers fall back to keyword search.
#[tauri::command]
pub fn semantic_search(
    state: tauri::State<AppState>,
    query: String,
    limit: Option<u32>,
    expected_vault_id: Option<String>,
    authorization_token: String,
) -> Result<String, String> {
    if query.trim().is_empty() || query.chars().count() > 4000 {
        return Err("semantic query must contain 1 to 4000 characters".into());
    }
    if limit.is_some_and(|value| !(1..=100).contains(&value)) {
        return Err("semantic search limit must be between 1 and 100".into());
    }
    let session = crate::state::active_session(&state)?;
    if expected_vault_id
        .as_deref()
        .is_some_and(|id| id != session.descriptor.id)
    {
        return Err("vault changed; repeat the semantic query".into());
    }
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::AiNetworkRequest,
        Some(&query),
        None,
    )?;
    let api_key =
        keychain_get(SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT).map_err(|error| error.to_string())?;
    with_verified_vault(&state, "semantic search", || {
        daemon_rpc(RpcMethod::EmbeddingsSearch {
            query,
            limit: limit.unwrap_or(25),
            api_key,
        })
    })
    .and_then(semantic_payload)
}

/// Re-embed changed notes. Same opt-in contract as search.
#[tauri::command]
pub fn semantic_sync(
    state: tauri::State<AppState>,
    expected_vault_id: Option<String>,
    authorization_token: String,
) -> Result<String, String> {
    let session = crate::state::active_session(&state)?;
    if expected_vault_id
        .as_deref()
        .is_some_and(|id| id != session.descriptor.id)
    {
        return Err("vault changed; repeat the reindex request".into());
    }
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::AiNetworkRequest,
        Some("Re-embed changed notes for semantic search"),
        None,
    )?;
    let api_key =
        keychain_get(SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT).map_err(|error| error.to_string())?;
    with_verified_vault(&state, "semantic reindex", || {
        daemon_rpc(RpcMethod::EmbeddingsSync { api_key })
    })
    .and_then(semantic_payload)
}
