use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use uuid::Uuid;

const GRANT_TTL: Duration = Duration::from_secs(60);
const MAX_GRANTS: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SensitiveOperation {
    AiNetworkRequest,
    CodeExecution,
    ApplyBulkFix,
    ApplyGitConflict,
    CreateBackup,
    DaemonControl,
    DeleteBackup,
    DeleteNote,
    GitPull,
    GitPush,
    KeychainDelete,
    ImportVault,
    KeychainWrite,
    PdfTranslation,
    PlantUmlExecution,
    PublishSite,
    RestoreBackup,
    RestoreHistory,
}

impl SensitiveOperation {
    fn title(self) -> &'static str {
        match self {
            Self::AiNetworkRequest => "Send note content to an AI provider",
            Self::ApplyBulkFix => "Apply automated fixes across the current vault",
            Self::ApplyGitConflict => "Replace a conflicted file with merged content",
            Self::CodeExecution => "Run code from the current vault",
            Self::CreateBackup => "Create a recovery backup",
            Self::DaemonControl => "Start the Scriptor background daemon",
            Self::DeleteBackup => "Delete a content snapshot",
            Self::DeleteNote => "Delete a note from the current vault",
            Self::GitPull => "Pull remote Git changes",
            Self::GitPush => "Push local Git commits",
            Self::ImportVault => "Import content into the current vault",
            Self::KeychainDelete => "Delete the saved AI provider credential",
            Self::KeychainWrite => "Store an AI provider credential",
            Self::PdfTranslation => "Run the configured PDF translation tool",
            Self::PlantUmlExecution => "Run a local PlantUML renderer",
            Self::PublishSite => "Publish this vault as a site",
            Self::RestoreBackup => "Replace vault contents from a snapshot",
            Self::RestoreHistory => "Replace a note with a historical revision",
        }
    }

    fn impact(self) -> &'static str {
        match self {
            Self::AiNetworkRequest => {
                "The selected note content and instruction will be sent to the configured endpoint."
            }
            Self::ApplyBulkFix => {
                "Automated lint repairs can modify multiple notes in the current vault."
            }
            Self::ApplyGitConflict => {
                "The selected conflicted file will be replaced with the merged content."
            }
            Self::CreateBackup => "Vault content will be copied to the selected backup location.",
            Self::CodeExecution => {
                "Code can read or modify files available to your user account. Continue only for a trusted vault."
            }
            Self::DaemonControl => {
                "A background process will be started for this application session."
            }
            Self::DeleteBackup => "This removes a local recovery snapshot and cannot be undone.",
            Self::DeleteNote => "The selected note will be deleted from disk and cannot be undone outside recovery/history tools.",
            Self::GitPull => "Remote changes can modify files in the current vault.",
            Self::GitPush => "Local commits will be sent to the configured remote repository.",
            Self::ImportVault => {
                "Files from the selected source will be copied and transformed inside the current vault."
            }
            Self::KeychainDelete => "The credential will be removed from the operating-system keychain.",
            Self::KeychainWrite => "The credential will be stored in the operating-system keychain.",
            Self::PdfTranslation => {
                "An external executable will read the selected PDF and write translated output."
            }
            Self::PlantUmlExecution => "A local external renderer will process the diagram source.",
            Self::PublishSite => {
                "External build and publish tools can read vault content and contact remote services."
            }
            Self::RestoreBackup => {
                "Current vault content will be replaced. A rollback copy is created before promotion."
            }
            Self::RestoreHistory => {
                "The current note content will be replaced after an optimistic-concurrency check."
            }
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizationGrant {
    pub token: String,
    pub operation: SensitiveOperation,
    pub scope: Option<String>,
    pub expires_at_ms: u64,
}

#[derive(Debug, Clone)]
struct StoredGrant {
    operation: SensitiveOperation,
    scope: Option<String>,
    expires_at_ms: u64,
}

#[derive(Default)]
pub struct AuthorizationBroker {
    grants: Mutex<HashMap<String, StoredGrant>>,
}

impl AuthorizationBroker {
    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .try_into()
            .unwrap_or(u64::MAX)
    }

    fn lock_grants(&self) -> std::sync::MutexGuard<'_, HashMap<String, StoredGrant>> {
        match self.grants.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                tracing::error!("recovering poisoned authorization grant store");
                self.grants.clear_poison();
                poisoned.into_inner()
            }
        }
    }

    pub fn issue(&self, operation: SensitiveOperation, scope: Option<String>) -> AuthorizationGrant {
        let now = Self::now_ms();
        let expires_at_ms = now.saturating_add(GRANT_TTL.as_millis() as u64);
        let token = Uuid::new_v4().to_string();
        let mut grants = self.lock_grants();
        grants.retain(|_, grant| grant.expires_at_ms >= now);
        if grants.len() >= MAX_GRANTS {
            grants.clear();
        }
        grants.insert(
            token.clone(),
            StoredGrant {
                operation,
                scope: scope.clone(),
                expires_at_ms,
            },
        );
        AuthorizationGrant {
            token,
            operation,
            scope,
            expires_at_ms,
        }
    }

    pub fn consume(
        &self,
        token: &str,
        operation: SensitiveOperation,
        scope: Option<&str>,
    ) -> Result<(), String> {
        if token.len() != 36 || !token.is_ascii() {
            return Err("invalid authorization token".into());
        }
        let now = Self::now_ms();
        let mut grants = self.lock_grants();
        grants.retain(|_, grant| grant.expires_at_ms >= now);
        let Some(grant) = grants.remove(token) else {
            return Err("authorization is missing, expired, or already used".into());
        };
        if grant.operation != operation {
            return Err("authorization token does not permit this operation".into());
        }
        if grant.scope.as_deref() != scope {
            return Err("authorization token is scoped to a different resource".into());
        }
        Ok(())
    }
}

pub fn require_sensitive_operation(
    state: &crate::AppState,
    token: &str,
    operation: SensitiveOperation,
    scope: Option<&str>,
) -> Result<(), String> {
    state.authorization.consume(token, operation, scope)
}

#[tauri::command]
pub async fn authorize_sensitive_operation(
    app: AppHandle,
    state: tauri::State<'_, crate::AppState>,
    operation: SensitiveOperation,
    scope: Option<String>,
) -> Result<AuthorizationGrant, String> {
    let title = operation.title().to_string();
    let impact = operation.impact().to_string();
    let display_scope = scope
        .as_deref()
        .map(sanitize_scope)
        .filter(|value| !value.is_empty());
    let message = match display_scope {
        Some(scope) => format!("{impact}\n\nScope: {scope}\n\nApprove this one operation?"),
        None => format!("{impact}\n\nApprove this one operation?"),
    };

    let approved = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .message(message)
            .title(title)
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Approve once".into(),
                "Cancel".into(),
            ))
            .blocking_show()
    })
    .await
    .map_err(|error| format!("failed to display native authorization dialog: {error}"))?;

    if !approved {
        return Err("operation cancelled by user".into());
    }

    Ok(state.authorization.issue(operation, scope))
}

fn sanitize_scope(value: &str) -> String {
    value
        .chars()
        .filter(|ch| !ch.is_control())
        .take(180)
        .collect::<String>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grants_are_one_time_operation_and_scope_bound() {
        let broker = AuthorizationBroker::default();
        let grant = broker.issue(SensitiveOperation::GitPush, Some("vault-a".into()));

        assert!(broker
            .consume(
                &grant.token,
                SensitiveOperation::GitPush,
                Some("vault-a")
            )
            .is_ok());
        assert!(broker
            .consume(
                &grant.token,
                SensitiveOperation::GitPush,
                Some("vault-a")
            )
            .is_err());
    }

    #[test]
    fn grants_reject_wrong_operation_or_scope() {
        let broker = AuthorizationBroker::default();
        let operation = broker.issue(SensitiveOperation::GitPush, Some("vault-a".into()));
        assert!(broker
            .consume(
                &operation.token,
                SensitiveOperation::GitPull,
                Some("vault-a")
            )
            .is_err());

        let scope = broker.issue(SensitiveOperation::GitPush, Some("vault-a".into()));
        assert!(broker
            .consume(
                &scope.token,
                SensitiveOperation::GitPush,
                Some("vault-b")
            )
            .is_err());
    }
}
