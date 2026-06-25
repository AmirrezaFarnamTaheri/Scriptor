use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::state::{active_session, AppState};

const MAX_OUTPUT_BYTES: usize = 256 * 1024;
const TIMEOUT_SECS: u64 = 30;

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
        "powershell" | "ps1" => Some(("powershell", vec!["-NoProfile", "-NonInteractive", "-File"])),
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

#[tauri::command]
pub fn code_chunk_run(
    state: tauri::State<AppState>,
    language: String,
    code: String,
) -> Result<CodeChunkRunOutput, String> {
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
    if lang == "cmd" || lang == "batch" {
        command.arg(&script_path);
    } else if lang == "python" || lang == "py" || lang == "node" || lang == "javascript" || lang == "js" {
        command.arg(&script_path);
    } else {
        command.arg(&script_path);
    }

    let started = Instant::now();
    let mut child = command
        .current_dir(work_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to spawn {binary}: {error}"))?;

    let timeout = Duration::from_secs(TIMEOUT_SECS);
    loop {
        if let Some(_status) = child.try_wait().map_err(|error| error.to_string())? {
            break;
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            let _ = std::fs::remove_file(&script_path);
            return Err(format!("code chunk exceeded {TIMEOUT_SECS}s timeout"));
        }
        thread::sleep(Duration::from_millis(50));
    }

    let child = child
        .wait_with_output()
        .map_err(|error| format!("failed to collect output from {binary}: {error}"))?;

    let _ = std::fs::remove_file(&script_path);

    Ok(CodeChunkRunOutput {
        exit_code: child.status.code().unwrap_or(-1),
        stdout: truncate_output(String::from_utf8_lossy(&child.stdout).into_owned()),
        stderr: truncate_output(String::from_utf8_lossy(&child.stderr).into_owned()),
        duration_ms: started.elapsed().as_millis() as u64,
        language: lang,
    })
}

#[cfg(test)]
mod tests {
    use super::truncate_output;

    #[test]
    fn truncate_output_keeps_utf8_boundaries() {
        let source = format!("{}{}", "🙂".repeat(70_000), "tail");
        let truncated = truncate_output(source);
        assert!(truncated.contains("[truncated]"));
        assert!(truncated.is_char_boundary(truncated.len()));
    }
}

#[tauri::command]
pub fn vault_publish_starlight(
    state: tauri::State<AppState>,
    output_path: String,
) -> Result<serde_json::Value, String> {
    use scriptor_vault::{load_vault_config, scan_vault_with_roots, ScannedEntryKind};
    use std::fs;

    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).unwrap_or_default();
    let entries = scan_vault_with_roots(&session.root, &config.extra_roots).map_err(|e| e.to_string())?;
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
