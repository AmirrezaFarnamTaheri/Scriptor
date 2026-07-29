use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::state::{AppState, active_session};

const MAX_OUTPUT_BYTES: usize = 256 * 1024;
const TIMEOUT_SECS: u64 = 30;
const CODE_EXECUTION_OPT_IN: &str = "SCRIPTOR_ALLOW_CODE_EXECUTION";

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

fn truncate_output(value: String) -> String {
    if value.len() <= MAX_OUTPUT_BYTES {
        return value;
    }
    let mut end = 0usize;
    for (idx, _) in value.char_indices() {
        if idx > MAX_OUTPUT_BYTES {
            break;
        }
        end = idx;
    }
    if end == 0 {
        return String::from("[truncated]");
    }
    format!("{}…\n[truncated]", &value[..end])
}

fn execution_enabled_from_value(value: Option<&str>) -> bool {
    value
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            )
        })
        .unwrap_or(false)
}

fn execution_enabled() -> bool {
    let value = std::env::var(CODE_EXECUTION_OPT_IN).ok();
    execution_enabled_from_value(value.as_deref())
}

#[tauri::command]
pub fn code_chunk_run(
    state: tauri::State<AppState>,
    language: String,
    code: String,
) -> Result<CodeChunkRunOutput, String> {
    if !execution_enabled() {
        return Err(format!(
            "code execution is disabled by default; set {CODE_EXECUTION_OPT_IN}=1 only for a trusted workspace"
        ));
    }

    let session = active_session(&state)?;
    let lang = language.trim().to_lowercase();
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

    let mut command = Command::new(binary);
    for arg in prefix_args {
        command.arg(arg);
    }
    command.arg(&script_path);

    let started = Instant::now();
    let mut child = command
        .current_dir(&work_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to spawn {binary}: {error}"))?;

    // Drain both pipes while the child is running. Waiting before reading can
    // deadlock when either OS pipe buffer fills.
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture stderr".to_string())?;
    let stdout_reader = thread::spawn(move || {
        let mut reader = stdout;
        let mut bytes = Vec::new();
        let _ = reader.read_to_end(&mut bytes);
        bytes
    });
    let stderr_reader = thread::spawn(move || {
        let mut reader = stderr;
        let mut bytes = Vec::new();
        let _ = reader.read_to_end(&mut bytes);
        bytes
    });

    let timeout = Duration::from_secs(TIMEOUT_SECS);
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            break status;
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_reader.join();
            let _ = stderr_reader.join();
            let _ = std::fs::remove_file(&script_path);
            return Err(format!("code chunk exceeded {TIMEOUT_SECS}s timeout"));
        }
        thread::sleep(Duration::from_millis(50));
    };

    let stdout = stdout_reader
        .join()
        .map_err(|_| format!("failed to collect stdout from {binary}"))?;
    let stderr = stderr_reader
        .join()
        .map_err(|_| format!("failed to collect stderr from {binary}"))?;
    let _ = std::fs::remove_file(&script_path);

    Ok(CodeChunkRunOutput {
        exit_code: status.code().unwrap_or(-1),
        stdout: truncate_output(String::from_utf8_lossy(&stdout).into_owned()),
        stderr: truncate_output(String::from_utf8_lossy(&stderr).into_owned()),
        duration_ms: started.elapsed().as_millis() as u64,
        language: lang,
    })
}

#[cfg(test)]
mod tests {
    use super::{execution_enabled_from_value, truncate_output};

    #[test]
    fn truncate_output_keeps_utf8_boundaries() {
        let source = format!("{}{}", "🙂".repeat(70_000), "tail");
        let truncated = truncate_output(source);
        assert!(truncated.contains("[truncated]"));
        assert!(truncated.is_char_boundary(truncated.len()));
    }

    #[test]
    fn code_execution_requires_explicit_opt_in() {
        assert!(!execution_enabled_from_value(None));
        for value in ["", "0", "false", "no", "random"] {
            assert!(!execution_enabled_from_value(Some(value)), "{value:?}");
        }
        for value in ["1", " true ", "TRUE", "yes", "YeS"] {
            assert!(execution_enabled_from_value(Some(value)), "{value:?}");
        }
    }
}

#[tauri::command]
pub fn vault_publish_starlight(
    state: tauri::State<AppState>,
    output_path: String,
) -> Result<serde_json::Value, String> {
    use scriptor_vault::{ScannedEntryKind, load_vault_config, scan_vault_with_roots};
    use std::fs;

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
