use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, run_process};
use scriptor_vault::{RelativeVaultPath, VaultRoot, atomic_write};
use serde::Serialize;

const PLANTUML_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_PROCESS_OUTPUT: usize = 256 * 1024;
const UNSANDBOXED_TOOLS_OPT_IN: &str = "SCRIPTOR_ALLOW_UNSANDBOXED_EXTERNAL_TOOLS";

#[derive(Debug, Clone, Serialize)]
pub struct PlantUmlRenderOutput {
    pub svg: String,
    pub engine: String,
}

fn environment_opt_in(name: &str) -> bool {
    std::env::var(name).ok().is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes"
        )
    })
}

fn run_candidate(
    program: &str,
    args: Vec<String>,
    input: &Path,
) -> Result<(String, String), String> {
    let receipt = run_process(
        ProcessSpec::new(program)
            .args(args)
            .current_dir(input.parent().unwrap_or_else(|| Path::new(".")))
            .timeout(PLANTUML_TIMEOUT)
            .max_output_bytes(MAX_PROCESS_OUTPUT)
            .network_policy(NetworkPolicy::Deny)
            .allow_unsandboxed_network_denial(environment_opt_in(UNSANDBOXED_TOOLS_OPT_IN))
            .expected_sha256(std::env::var("SCRIPTOR_PLANTUML_SHA256").ok()),
    )
    .map_err(|error| error.to_string())?;
    if receipt.exit_code != 0 {
        return Err(format!(
            "PlantUML failed with exit code {}: {}",
            receipt.exit_code,
            receipt.stderr.trim()
        ));
    }
    let svg = fs::read_to_string(input.with_extension("svg")).map_err(|error| error.to_string())?;
    Ok((svg, receipt.resolved_program))
}

fn run_plantuml(input: &Path) -> Result<(String, String), String> {
    if let Ok(path) = std::env::var("PLANTUML_BIN")
        && !path.trim().is_empty()
    {
        return run_candidate(
            &path,
            vec!["-tsvg".into(), input.display().to_string()],
            input,
        );
    }

    if let Ok(jar) = std::env::var("PLANTUML_JAR")
        && !jar.trim().is_empty()
    {
        return run_candidate(
            "java",
            vec![
                "-jar".into(),
                jar,
                "-tsvg".into(),
                input.display().to_string(),
            ],
            input,
        );
    }

    run_candidate(
        "plantuml",
        vec!["-tsvg".into(), input.display().to_string()],
        input,
    )
}

pub fn render_plantuml_svg(source: &str) -> Result<PlantUmlRenderOutput, String> {
    if source.len() > 1024 * 1024 {
        return Err("PlantUML source exceeds the 1 MiB rendering limit".into());
    }
    let temp_dir = std::env::temp_dir().join(format!("scriptor-plantuml-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let input = temp_dir.join("diagram.puml");
    fs::write(&input, source).map_err(|error| error.to_string())?;
    let result = run_plantuml(&input);
    let _ = fs::remove_dir_all(&temp_dir);
    let (svg, engine) = result?;
    Ok(PlantUmlRenderOutput { svg, engine })
}

pub fn save_vault_asset(
    root: &VaultRoot,
    relative_path: &str,
    bytes: &[u8],
) -> Result<String, String> {
    let relative = RelativeVaultPath::parse(relative_path).map_err(|error| error.to_string())?;
    let absolute: PathBuf = root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    atomic_write(&absolute, bytes).map_err(|error| error.to_string())?;
    Ok(relative.to_string())
}
