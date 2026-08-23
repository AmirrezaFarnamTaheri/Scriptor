use std::path::{Path, PathBuf};

use scriptor_publish_runner::{
    PublishApplyInput, PublishApplyOutput, PublishCandidate, PublishPlan, apply_starlight_site,
    plan_starlight_site, resolve_output_path,
};
use serde::Serialize;

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session};

#[derive(Debug, Serialize)]
pub struct StarlightPublishPlanOutput {
    pub output: String,
    pub docs_dir: String,
    pub plan: PublishPlan,
}

#[derive(Debug, Serialize)]
pub struct StarlightPublishApplyOutput {
    pub output: String,
    pub docs_dir: String,
    pub written: Vec<String>,
    pub deleted: Vec<String>,
}

fn resolved_output(vault_root: &Path, requested: &str) -> PathBuf {
    resolve_output_path(vault_root, Path::new(requested))
}

/// Read-only publication planning. This does not create the output directory.
#[tauri::command]
pub fn vault_publish_plan_starlight(
    state: tauri::State<AppState>,
    output_path: String,
) -> Result<StarlightPublishPlanOutput, String> {
    let session = active_session(&state)?;
    let output = resolved_output(session.root.root(), &output_path);
    let plan =
        plan_starlight_site(session.root.root(), &output).map_err(|error| error.to_string())?;
    Ok(StarlightPublishPlanOutput {
        output: output.display().to_string(),
        docs_dir: output.join("src/content/docs").display().to_string(),
        plan,
    })
}

/// Apply only reviewed plan entries after a native one-time authorization.
/// The shared runner recomputes the current plan and rejects stale, private,
/// unmanaged, traversal, and symlink-escape selections.
#[tauri::command]
pub fn vault_publish_apply_starlight(
    state: tauri::State<AppState>,
    output_path: String,
    to_write: Vec<PublishCandidate>,
    to_delete: Vec<String>,
    authorization_token: String,
) -> Result<StarlightPublishApplyOutput, String> {
    let session = active_session(&state)?;
    let output = resolved_output(session.root.root(), &output_path);
    let authorization_scope = format!(
        "{} • {} write(s) • {} deletion(s)",
        output.display(),
        to_write.len(),
        to_delete.len()
    );
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::PublishSite,
        Some(&authorization_scope),
    )?;
    let PublishApplyOutput {
        written, deleted, ..
    } = apply_starlight_site(
        session.root.root(),
        &output,
        &PublishApplyInput {
            to_write,
            to_delete,
        },
    )
    .map_err(|error| error.to_string())?;

    Ok(StarlightPublishApplyOutput {
        output: output.display().to_string(),
        docs_dir: output.join("src/content/docs").display().to_string(),
        written,
        deleted,
    })
}
