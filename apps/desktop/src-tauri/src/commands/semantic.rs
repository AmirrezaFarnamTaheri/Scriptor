//! Semantic (embedding) search commands. The daemon owns the engine;
//! these wrappers authorize the AI-network call, attach the OpenAI key
//! from the OS keychain (Ollama needs none), and surface the graceful
//! "unavailable" payload so the UI can fall back to keyword search. The
//! embeddings crate itself stays daemon-side by contract.

use scriptor_ipc::{RpcMethod, RpcPayload};
use scriptor_system_bridge::keychain_get;

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::commands::daemon::daemon_rpc;
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

/// Semantic search: returns `{"available":false}` when the vault has no
/// `semantic` section, letting callers fall back to keyword search.
#[tauri::command]
pub fn semantic_search(
    state: tauri::State<AppState>,
    query: String,
    limit: Option<u32>,
    authorization_token: String,
) -> Result<String, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::AiNetworkRequest,
        None,
    )?;
    let api_key =
        keychain_get(SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT).map_err(|error| error.to_string())?;
    daemon_rpc(RpcMethod::EmbeddingsSearch {
        query,
        limit: limit.unwrap_or(25),
        api_key,
    })
    .and_then(semantic_payload)
}

/// Re-embed changed notes. Same opt-in contract as search.
#[tauri::command]
pub fn semantic_sync(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<String, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::AiNetworkRequest,
        None,
    )?;
    let api_key =
        keychain_get(SEMANTIC_OPENAI_KEYCHAIN_ACCOUNT).map_err(|error| error.to_string())?;
    daemon_rpc(RpcMethod::EmbeddingsSync { api_key }).and_then(semantic_payload)
}
