use std::fs;
use std::process::Command;
use std::time::Instant;

use crate::error::ExportError;

/// Render a Mermaid diagram source to SVG using `mmdc` (mermaid-cli).
/// Returns the SVG string, or falls back to a placeholder if `mmdc` is not on PATH.
pub fn render_mermaid_svg(source: &str) -> Result<String, ExportError> {
    let start = Instant::now();

    let mmdc = which_binary("mmdc");
    let Some(mmdc_path) = mmdc else {
        log::warn!("mmdc (mermaid-cli) not found on PATH; using placeholder SVG");
        return Ok(placeholder_svg("Mermaid diagram", source));
    };

    let temp_dir = std::env::temp_dir().join(format!("scriptor-mermaid-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|source_err| ExportError::Io {
        path: temp_dir.clone(),
        source: source_err,
    })?;

    let input_path = temp_dir.join("diagram.mmd");
    fs::write(&input_path, source).map_err(|source_err| ExportError::Io {
        path: input_path.clone(),
        source: source_err,
    })?;

    let output_path = temp_dir.join("diagram.svg");

    let result = Command::new(&mmdc_path)
        .args([
            "-i",
            &input_path.display().to_string(),
            "-o",
            &output_path.display().to_string(),
            "--quiet",
        ])
        .output();

    let _ = fs::remove_dir_all(&temp_dir);

    match result {
        Ok(output) if output.status.success() && output_path.exists() => {
            let svg = fs::read_to_string(&output_path).map_err(|source_err| ExportError::Io {
                path: output_path.clone(),
                source: source_err,
            })?;
            log::info!(
                "Mermaid rendered in {}ms via mmdc",
                start.elapsed().as_millis()
            );
            Ok(svg)
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            log::warn!("mmdc failed: {stderr}; using placeholder SVG");
            Ok(placeholder_svg("Mermaid diagram", source))
        }
        Err(err) => {
            log::warn!("Failed to run mmdc: {err}; using placeholder SVG");
            Ok(placeholder_svg("Mermaid diagram", source))
        }
    }
}

/// Render a PlantUML diagram source to SVG using the `plantuml` CLI.
/// Resolution order mirrors the daemon: `PLANTUML_BIN` env, `PLANTUML_JAR` + java, bare `plantuml`.
/// Returns the SVG string, or a placeholder if no engine is available.
pub fn render_plantuml_svg(source: &str) -> Result<String, ExportError> {
    let start = Instant::now();

    let temp_dir = std::env::temp_dir().join(format!("scriptor-plantuml-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|source_err| ExportError::Io {
        path: temp_dir.clone(),
        source: source_err,
    })?;

    let input_path = temp_dir.join("diagram.puml");
    fs::write(&input_path, source).map_err(|source_err| ExportError::Io {
        path: input_path.clone(),
        source: source_err,
    })?;

    let svg_path = temp_dir.join("diagram.svg");

    let result = run_plantuml_engine(&input_path, &svg_path);
    let _ = fs::remove_dir_all(&temp_dir);

    match result {
        Ok(svg) => {
            log::info!(
                "PlantUML rendered in {}ms",
                start.elapsed().as_millis()
            );
            Ok(svg)
        }
        Err(err) => {
            log::warn!("PlantUML rendering failed: {err}; using placeholder SVG");
            Ok(placeholder_svg("PlantUML diagram", source))
        }
    }
}

fn run_plantuml_engine(input_path: &std::path::Path, svg_path: &std::path::Path) -> Result<String, String> {
    if let Ok(path) = std::env::var("PLANTUML_BIN") {
        if !path.is_empty() {
            let binary = std::path::PathBuf::from(&path);
            validate_binary_path(&binary, "PLANTUML_BIN")?;
            let output = Command::new(&binary)
                .args(["-tsvg", &input_path.display().to_string()])
                .output()
                .map_err(|error| error.to_string())?;
            if output.status.success() {
                return fs::read_to_string(svg_path).map_err(|e| e.to_string());
            }
        }
    }

    if let Ok(jar) = std::env::var("PLANTUML_JAR") {
        validate_binary_path(std::path::Path::new(&jar), "PLANTUML_JAR")?;
        let output = Command::new("java")
            .args(["-jar", &jar, "-tsvg", &input_path.display().to_string()])
            .output()
            .map_err(|error| error.to_string())?;
        if output.status.success() {
            return fs::read_to_string(svg_path).map_err(|e| e.to_string());
        }
    }

    let output = Command::new("plantuml")
        .args(["-tsvg", &input_path.display().to_string()])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "PlantUML failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    fs::read_to_string(svg_path).map_err(|e| e.to_string())
}

fn validate_binary_path(binary: &std::path::Path, env_var: &str) -> Result<(), String> {
    if !binary.exists() {
        return Err(format!("{env_var} path does not exist: {}", binary.display()));
    }
    if binary.is_dir() {
        return Err(format!("{env_var} path is a directory, not a file: {}", binary.display()));
    }
    let canonical = binary
        .canonicalize()
        .map_err(|e| format!("{env_var} path cannot be canonicalized: {e}"))?;
    if canonical.is_dir() {
        return Err(format!("{env_var} resolved to a directory: {}", canonical.display()));
    }
    Ok(())
}

fn which_binary(name: &str) -> Option<std::path::PathBuf> {
    if cfg!(windows) {
        Command::new("where")
            .arg(name)
            .output()
            .ok()
            .and_then(|output| {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .map(|line| std::path::PathBuf::from(line.trim()))
            })
    } else {
        Command::new("which")
            .arg(name)
            .output()
            .ok()
            .and_then(|output| {
                let line = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if line.is_empty() {
                    None
                } else {
                    Some(std::path::PathBuf::from(line))
                }
            })
    }
}

fn placeholder_svg(title: &str, source: &str) -> String {
    let escaped = xml_escape(source);
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="24" y="36" font-family="Segoe UI, sans-serif" font-size="18" fill="#0f172a">{title}</text>
  <foreignObject x="24" y="56" width="912" height="460">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font:12px/1.5 ui-monospace, monospace; white-space:pre-wrap; color:#334155;">{escaped}</div>
  </foreignObject>
</svg>"##
    )
}

fn xml_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder_svg_contains_source_text() {
        let svg = placeholder_svg("Mermaid diagram", "flowchart TD\n  A --> B");
        assert!(svg.contains("Mermaid diagram"));
        assert!(svg.contains("flowchart TD"));
        assert!(svg.contains("<svg"));
    }

    #[test]
    fn render_mermaid_svg_returns_svg_even_without_mmdc() {
        let svg = render_mermaid_svg("graph TD\n  A-->B").unwrap();
        assert!(svg.contains("<svg"));
    }

    #[test]
    fn render_plantuml_svg_returns_svg_even_without_engine() {
        let svg = render_plantuml_svg("@startuml\nA -> B\n@enduml").unwrap();
        assert!(svg.contains("<svg"));
    }
}
