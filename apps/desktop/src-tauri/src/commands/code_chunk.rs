use std::path::PathBuf;
use std::time::Duration;

use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, run_process};
use serde::Serialize;

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session};

const MAX_OUTPUT_BYTES: usize = 256 * 1024;
const TIMEOUT_SECS: u64 = 30;
const CODE_EXECUTION_OPT_IN: &str = "SCRIPTOR_ALLOW_CODE_EXECUTION";
const UNSANDBOXED_CODE_EXECUTION_OPT_IN: &str = "SCRIPTOR_ALLOW_UNSANDBOXED_CODE_EXECUTION";

#[derive(Debug, Serialize)]
pub struct CodeChunkRunOutput {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub language: String,
}

fn allowed_runner(language: &str) -> Option<(&'static str, Vec<&'static str>)> {
    match language {
        "powershell" | "ps1" => {
            Some(("powershell", vec!["-NoProfile", "-NonInteractive", "-File"]))
        }
        "pwsh" => Some(("pwsh", vec!["-NoProfile", "-NonInteractive", "-File"])),
        "python" | "py" => Some(("python", vec![])),
        "node" | "javascript" | "js" => Some(("node", vec![])),
        "sh" | "bash" => Some(("sh", vec![])),
        "cmd" | "batch" => Some(("cmd", vec!["/C"])),
        _ => None,
    }
}

fn extension_for(language: &str) -> &'static str {
    match language {
        "powershell" | "ps1" | "pwsh" => "ps1",
        "python" | "py" => "py",
        "node" | "javascript" | "js" => "js",
        "sh" | "bash" => "sh",
        "cmd" | "batch" => "cmd",
        _ => "txt",
    }
}

fn enabled_from_value(value: Option<&str>) -> bool {
    value
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            )
        })
        .unwrap_or(false)
}

fn environment_opt_in(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .as_deref()
        .is_some_and(|value| enabled_from_value(Some(value)))
}

fn mark_truncated(value: String, truncated: bool) -> String {
    if truncated {
        format!("{value}\n[truncated]")
    } else {
        value
    }
}

#[tauri::command]
pub fn code_chunk_run(
    state: tauri::State<AppState>,
    language: String,
    code: String,
    authorization_token: String,
) -> Result<CodeChunkRunOutput, String> {
    let lang = language.trim().to_lowercase();
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::CodeExecution,
        Some(&lang),
    )?;
    if !environment_opt_in(CODE_EXECUTION_OPT_IN) {
        return Err(format!(
            "code execution is disabled by default; set {CODE_EXECUTION_OPT_IN}=1 only for a trusted workspace"
        ));
    }
    if code.len() > 4 * 1024 * 1024 {
        return Err("code chunk exceeds the 4 MiB execution limit".into());
    }

    let session = active_session(&state)?;
    let (binary, prefix_args) = allowed_runner(&lang).ok_or_else(|| {
        format!("unsupported code-chunk language: {language}. Allowed: powershell, pwsh, python, node, sh, cmd")
    })?;
    let work_dir = session
        .root
        .root()
        .join(".scriptor")
        .join("tmp")
        .join("code-chunks");
    std::fs::create_dir_all(&work_dir).map_err(|error| error.to_string())?;

    let script_path: PathBuf = work_dir.join(format!(
        "chunk-{}.{}",
        uuid::Uuid::new_v4(),
        extension_for(&lang)
    ));
    std::fs::write(&script_path, code.as_bytes()).map_err(|error| error.to_string())?;

    let mut args = prefix_args
        .into_iter()
        .map(String::from)
        .collect::<Vec<_>>();
    args.push(script_path.display().to_string());
    let result = run_process(
        ProcessSpec::new(binary)
            .args(args)
            .current_dir(&work_dir)
            .timeout(Duration::from_secs(TIMEOUT_SECS))
            .max_output_bytes(MAX_OUTPUT_BYTES)
            .network_policy(NetworkPolicy::Deny)
            .allow_unsandboxed_network_denial(environment_opt_in(
                UNSANDBOXED_CODE_EXECUTION_OPT_IN,
            )),
    );
    let _ = std::fs::remove_file(&script_path);
    let receipt = result.map_err(|error| error.to_string())?;

    Ok(CodeChunkRunOutput {
        exit_code: receipt.exit_code,
        stdout: mark_truncated(receipt.stdout, receipt.stdout_truncated),
        stderr: mark_truncated(receipt.stderr, receipt.stderr_truncated),
        duration_ms: receipt.duration_ms,
        language: lang,
    })
}

#[cfg(test)]
mod tests {
    use super::{enabled_from_value, mark_truncated};

    #[test]
    fn output_receipts_mark_truncation() {
        assert_eq!(mark_truncated("hello".into(), false), "hello");
        assert!(mark_truncated("hello".into(), true).ends_with("[truncated]"));
    }

    #[test]
    fn code_execution_requires_explicit_opt_in() {
        assert!(!enabled_from_value(None));
        for value in ["", "0", "false", "no", "random"] {
            assert!(!enabled_from_value(Some(value)), "{value:?}");
        }
        for value in ["1", " true ", "TRUE", "yes", "YeS"] {
            assert!(enabled_from_value(Some(value)), "{value:?}");
        }
    }
}

#[tauri::command]
pub fn vault_publish_starlight(
    state: tauri::State<AppState>,
    output_path: String,
    authorization_token: String,
) -> Result<serde_json::Value, String> {
    use scriptor_vault::{ScannedEntryKind, load_vault_config, scan_vault_with_roots};
    use std::fs;

    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::PublishSite,
        Some(&output_path),
    )?;
    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).unwrap_or_default();
    let entries =
        scan_vault_with_roots(&session.root, &config.extra_roots).map_err(|e| e.to_string())?;
    let output = std::path::PathBuf::from(&output_path);
    let docs_dir = output.join("src").join("content").join("docs");
    fs::create_dir_all(&docs_dir).map_err(|e| e.to_string())?;

    let mut copied = 0usize;
    for entry in entries {
        if entry.kind != ScannedEntryKind::Note {
            continue;
        }
        let source = session
            .root
            .root()
            .join(entry.path.replace('/', std::path::MAIN_SEPARATOR_STR));
        let target = docs_dir.join(entry.path.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(&source, &target).map_err(|e| e.to_string())?;
        copied += 1;
    }

    fs::write(
        output.join("astro.config.mjs"),
        "import { defineConfig } from 'astro/config';\nimport starlight from '@astrojs/starlight';\nexport default defineConfig({ integrations: [starlight({ title: 'Scriptor Publish' })] });\n",
    )
    .map_err(|e| e.to_string())?;
    fs::write(
        output.join("package.json"),
        r#"{"name":"scriptor-publish","private":true,"scripts":{"dev":"astro dev","build":"astro build"}}"#,
    )
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "output": output_path,
        "notes_copied": copied,
        "docs_dir": docs_dir.display().to_string(),
    }))
}
