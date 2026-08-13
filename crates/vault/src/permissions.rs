//! Permission ladder and `SensitiveOperation` enum (F-4).
//!
//! Every feature that touches security-sensitive paths — capture, AI writes,
//! decryption, WASM execution, and `scriptor://` navigation — must declare a
//! `SensitiveOperation` variant here and pass it through the permission gate
//! before acting.
//!
//! **Rules (binding):**
//! - `scriptor://` may only use read-only command variants (I-10, D8).
//! - AI writes are gated by `SensitiveOperation::McpWrite`; agents never bypass
//!   the draft/diff path (I-2).
//! - `crates/embeddings` must refuse sealed spans (I-3); this is enforced by the
//!   `sealed_content_is_never_embedded` test in `crates/vault`.
//! - WASM execution requires `F-4` to ship before any `crates/wasm-runtime` consumer
//!   is scheduled (D11).
//!
//! Verify: `pnpm check:authorization` must enumerate every new variant.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Every security-sensitive operation in Scriptor must be represented here.
///
/// Adding a new variant is an **explicit task** — never a side effect of
/// adding a feature. The `authorization-inventory.mjs` script asserts that
/// every variant is referenced at least once in the codebase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[non_exhaustive]
pub enum SensitiveOperation {
    // ── Vault writes ────────────────────────────────────────────────────────
    /// Writing or modifying a note through the single write path (`vault/fs.rs`).
    NoteWrite,

    /// Deleting a note or vault file.
    NoteDelete,

    /// Renaming a note (involves atomic rename transaction).
    NoteRename,

    // ── Encryption ──────────────────────────────────────────────────────────
    /// Decrypting inline-encrypted content.
    DecryptContent,

    /// Encrypting a span of content.
    EncryptContent,

    // ── Network / external ──────────────────────────────────────────────────
    /// Fetching a remote URL for web-clip capture (`crates/capture`).
    WebClip,

    /// Pushing to or pulling from a remote git repository.
    GitRemote,

    /// Delivering notes to an external publish sink (local-dir, git, GitHub).
    Publish,

    // ── AI / MCP ────────────────────────────────────────────────────────────
    /// Sending context to an AI provider (user-supplied key or local model).
    AiInference,

    /// Writing a note via the MCP draft→diff path (I-2).
    McpWrite,

    /// Exposing a note excerpt through an MCP search tool.
    McpSearch,

    // ── Embeddings ──────────────────────────────────────────────────────────
    /// Computing or retrieving embeddings for a block.
    /// Sealed spans must be refused at this gate (I-3).
    EmbeddingsCompute,

    // ── WASM ────────────────────────────────────────────────────────────────
    /// Executing a WASM module via `crates/wasm-runtime`.
    WasmExec,

    // ── Navigation ──────────────────────────────────────────────────────────
    /// Handling a `scriptor://` URI — read-only commands only (I-10, D8).
    /// Allowed sub-commands: `open-note`, `jump-to-heading`,
    /// `run-command` (restricted to the read-only allow-list).
    ScriptorUri,
}

impl fmt::Display for SensitiveOperation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Serialise to kebab-case via serde_json so the display matches what
        // `authorization-inventory.mjs` searches for.
        let s = serde_json::to_string(self).unwrap_or_else(|_| format!("{self:?}"));
        write!(f, "{}", s.trim_matches('"'))
    }
}

/// The outcome of a permission check.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PermissionOutcome {
    /// The operation is allowed.
    Allowed,
    /// The operation is denied with an explanatory message.
    Denied(String),
}

impl PermissionOutcome {
    pub fn is_allowed(&self) -> bool {
        matches!(self, Self::Allowed)
    }

    pub fn into_result(self) -> Result<(), PermissionError> {
        match self {
            Self::Allowed => Ok(()),
            Self::Denied(reason) => Err(PermissionError::Denied {
                operation: reason.clone(),
                reason,
            }),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PermissionError {
    #[error("operation '{operation}' denied: {reason}")]
    Denied { operation: String, reason: String },
}

/// Check whether `operation` is permitted under the current `PermissionContext`.
///
/// In the initial implementation the context is minimal — future waves add
/// per-vault policy, user role, and session-state checks. The gate is here
/// from Wave 0 so every consumer has the same call site.
pub fn check_permission(
    operation: SensitiveOperation,
    context: &PermissionContext,
) -> PermissionOutcome {
    // scriptor:// URIs may never write (I-10, D8).
    if operation == SensitiveOperation::ScriptorUri && context.requested_mutating_uri_command {
        return PermissionOutcome::Denied(
            "scriptor:// URIs are read-only; write commands are not permitted".into(),
        );
    }

    // WASM execution requires the permission ladder to be stamped (F-4).
    // This check exists so W8-3 cannot accidentally bypass it.
    if operation == SensitiveOperation::WasmExec && !context.wasm_permitted {
        return PermissionOutcome::Denied(
            "WASM execution is not enabled; enable it in vault settings".into(),
        );
    }

    PermissionOutcome::Allowed
}

/// Context passed to `check_permission`.
///
/// Populated at the call site with the information available at that point;
/// fields grow additively as waves add policy.
#[derive(Debug, Default, Clone)]
pub struct PermissionContext {
    /// Set to `true` when a `scriptor://run-command` URI targets a command
    /// that would mutate the vault. The check rejects it (I-10).
    pub requested_mutating_uri_command: bool,

    /// Set to `true` when the user has explicitly enabled WASM in vault settings.
    pub wasm_permitted: bool,

    /// Set to `true` when the caller holds a valid `KeySession` (Wave 5).
    pub has_key_session: bool,
}

/// The `scriptor://` allow-list of non-mutating command names (I-10, D8).
///
/// Any command NOT in this list must be rejected by the URI handler
/// (`crates/system-bridge/src/uri.rs`). The `check:authorization` script
/// asserts this list is present and non-empty.
pub const SCRIPTOR_URI_READONLY_COMMANDS: &[&str] = &[
    "open-note",
    "jump-to-heading",
    "run-command:show-search",
    "run-command:show-command-palette",
    "run-command:focus-editor",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_sensitive_operations_display_as_kebab_case() {
        let variants = [
            SensitiveOperation::NoteWrite,
            SensitiveOperation::NoteDelete,
            SensitiveOperation::NoteRename,
            SensitiveOperation::DecryptContent,
            SensitiveOperation::EncryptContent,
            SensitiveOperation::WebClip,
            SensitiveOperation::GitRemote,
            SensitiveOperation::Publish,
            SensitiveOperation::AiInference,
            SensitiveOperation::McpWrite,
            SensitiveOperation::McpSearch,
            SensitiveOperation::EmbeddingsCompute,
            SensitiveOperation::WasmExec,
            SensitiveOperation::ScriptorUri,
        ];
        for v in variants {
            let s = v.to_string();
            assert!(
                s.chars().all(|c| c.is_ascii_lowercase() || c == '-'),
                "variant {v:?} displays as {s:?} which is not kebab-case"
            );
        }
    }

    #[test]
    fn scriptor_uri_mutating_command_is_denied() {
        let ctx = PermissionContext {
            requested_mutating_uri_command: true,
            ..Default::default()
        };
        let outcome = check_permission(SensitiveOperation::ScriptorUri, &ctx);
        assert!(!outcome.is_allowed(), "mutating scriptor:// must be denied");
    }

    #[test]
    fn scriptor_uri_readonly_command_is_allowed() {
        let ctx = PermissionContext {
            requested_mutating_uri_command: false,
            ..Default::default()
        };
        let outcome = check_permission(SensitiveOperation::ScriptorUri, &ctx);
        assert!(
            outcome.is_allowed(),
            "read-only scriptor:// must be allowed"
        );
    }

    #[test]
    fn wasm_exec_denied_when_not_permitted() {
        let ctx = PermissionContext {
            wasm_permitted: false,
            ..Default::default()
        };
        let outcome = check_permission(SensitiveOperation::WasmExec, &ctx);
        assert!(
            !outcome.is_allowed(),
            "WasmExec must be denied when not permitted"
        );
    }

    #[test]
    fn wasm_exec_allowed_when_permitted() {
        let ctx = PermissionContext {
            wasm_permitted: true,
            ..Default::default()
        };
        let outcome = check_permission(SensitiveOperation::WasmExec, &ctx);
        assert!(
            outcome.is_allowed(),
            "WasmExec must be allowed when permitted"
        );
    }

    #[test]
    fn readonly_commands_list_is_nonempty() {
        assert!(
            !SCRIPTOR_URI_READONLY_COMMANDS.is_empty(),
            "allow-list must not be empty"
        );
    }
}
