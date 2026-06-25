use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::ExportError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PandocDiscovery {
    pub path: String,
    pub version: String,
}

/// Resolve Pandoc for export jobs.
///
/// Resolution order:
/// 1. `SCRIPTOR_PANDOC_PATH` when set to an executable that responds to `--version`
/// 2. `SCRIPTOR_BUNDLED_PANDOC_DIR/pandoc(.exe)` when bundled installer populated resources
/// 3. `pandoc` on `PATH` (Windows: `where pandoc`, Unix: `which pandoc`)
pub fn discover_pandoc() -> Result<PandocDiscovery, ExportError> {
    if let Ok(override_path) = std::env::var("SCRIPTOR_PANDOC_PATH") {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            return probe_pandoc(Path::new(trimmed));
        }
    }

    for bundled in bundled_pandoc_paths() {
        if bundled.exists() {
            if let Ok(discovery) = probe_pandoc(&bundled) {
                return Ok(discovery);
            }
        }
    }

    probe_pandoc(Path::new("pandoc"))
}

fn bundled_pandoc_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(dir) = std::env::var("SCRIPTOR_BUNDLED_PANDOC_DIR") {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let base = PathBuf::from(trimmed);
            paths.push(base.join(if cfg!(windows) { "pandoc.exe" } else { "pandoc" }));
        }
    }
    paths
}

fn probe_pandoc(path: &Path) -> Result<PandocDiscovery, ExportError> {
    let output = Command::new(path)
        .arg("--version")
        .output()
        .map_err(|_| ExportError::PandocMissing)?;

    if !output.status.success() {
        return Err(ExportError::PandocMissing);
    }

    let version = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .unwrap_or("pandoc")
        .to_string();

    let resolved_path = if path == Path::new("pandoc") {
        which_pandoc().unwrap_or_else(|| PathBuf::from("pandoc"))
    } else {
        path.to_path_buf()
    };

    Ok(PandocDiscovery {
        path: resolved_path.display().to_string(),
        version,
    })
}

fn which_pandoc() -> Option<PathBuf> {
    if cfg!(windows) {
        Command::new("where")
            .arg("pandoc")
            .output()
            .ok()
            .and_then(|output| {
                String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .map(|line| PathBuf::from(line.trim()))
            })
    } else {
        Command::new("which")
            .arg("pandoc")
            .output()
            .ok()
            .and_then(|output| {
                let line = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if line.is_empty() {
                    None
                } else {
                    Some(PathBuf::from(line))
                }
            })
    }
}
