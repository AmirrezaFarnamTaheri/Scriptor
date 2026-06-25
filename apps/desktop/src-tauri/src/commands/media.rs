use std::fs;
use std::path::PathBuf;
use std::process::Command;

use scriptor_vault::{RelativeVaultPath, VaultRoot};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct PlantUmlRenderOutput {
    pub svg: String,
    pub engine: String,
}

fn run_plantuml(input: &PathBuf) -> Result<(String, String), String> {
    if let Ok(path) = std::env::var("PLANTUML_BIN") {
        if !path.is_empty() {
            let output = Command::new(&path)
                .args(["-tsvg", &input.display().to_string()])
                .output()
                .map_err(|error| error.to_string())?;
            if output.status.success() {
                let svg = fs::read_to_string(input.with_extension("svg")).map_err(|e| e.to_string())?;
                return Ok((svg, path));
            }
        }
    }

    if let Ok(jar) = std::env::var("PLANTUML_JAR") {
        let output = Command::new("java")
            .args(["-jar", &jar, "-tsvg", &input.display().to_string()])
            .output()
            .map_err(|error| error.to_string())?;
        if output.status.success() {
            let svg = fs::read_to_string(input.with_extension("svg")).map_err(|e| e.to_string())?;
            return Ok((svg, "java-plantuml".into()));
        }
    }

    let output = Command::new("plantuml")
        .args(["-tsvg", &input.display().to_string()])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "PlantUML failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let svg = fs::read_to_string(input.with_extension("svg")).map_err(|e| e.to_string())?;
    Ok((svg, "plantuml".into()))
}

pub fn render_plantuml_svg(source: &str) -> Result<PlantUmlRenderOutput, String> {
    let temp_dir = std::env::temp_dir().join(format!("scriptor-plantuml-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let input = temp_dir.join("diagram.puml");
    fs::write(&input, source).map_err(|error| error.to_string())?;
    let (svg, engine) = run_plantuml(&input)?;
    let _ = fs::remove_dir_all(&temp_dir);
    Ok(PlantUmlRenderOutput { svg, engine })
}

pub fn save_vault_asset(root: &VaultRoot, relative_path: &str, bytes: &[u8]) -> Result<String, String> {
    let relative = RelativeVaultPath::parse(relative_path).map_err(|error| error.to_string())?;
    let absolute: PathBuf = root.resolve_relative(&relative).map_err(|error| error.to_string())?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&absolute, bytes).map_err(|error| error.to_string())?;
    Ok(relative.to_string())
}
