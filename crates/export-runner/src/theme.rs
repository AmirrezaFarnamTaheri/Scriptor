use std::fs;
use std::path::{Path, PathBuf};

use crate::error::ExportError;

const DEFAULT_EXPORT_THEME: &str = include_str!("../assets/export-theme.css");
const DEFAULT_CSL_STYLE: &str = include_str!("../assets/apa-lite.csl");

pub fn materialize_export_theme(output_dir: &Path) -> Result<PathBuf, ExportError> {
    let theme_path = output_dir.join("export-theme.css");
    if !theme_path.exists() {
        fs::write(&theme_path, DEFAULT_EXPORT_THEME).map_err(|source| ExportError::Io {
            path: theme_path.clone(),
            source,
        })?;
    }
    Ok(theme_path)
}

pub fn materialize_default_csl(output_dir: &Path) -> Result<PathBuf, ExportError> {
    let csl_path = output_dir.join("apa-lite.csl");
    if !csl_path.exists() {
        fs::write(&csl_path, DEFAULT_CSL_STYLE).map_err(|source| ExportError::Io {
            path: csl_path.clone(),
            source,
        })?;
    }
    Ok(csl_path)
}

fn resolve_vault_relative(vault_root: &Path, output_dir: &Path, path: &Path) -> PathBuf {
    if path.is_absolute() {
        return path.to_path_buf();
    }
    let vault_candidate = vault_root.join(path);
    if vault_candidate.exists() {
        return vault_candidate;
    }
    output_dir.join(path)
}

pub fn resolve_extra_args(
    vault_root: &Path,
    output_dir: &Path,
    extra_args: &[String],
) -> Result<Vec<String>, ExportError> {
    let mut resolved = Vec::with_capacity(extra_args.len());
    for arg in extra_args {
        if let Some(css_path) = arg.strip_prefix("--css=") {
            let path = Path::new(css_path);
            let absolute = if path.is_absolute() {
                path.to_path_buf()
            } else {
                let candidate = output_dir.join(path);
                if candidate.exists() {
                    candidate
                } else if path
                    .file_name()
                    .is_some_and(|name| name == "export-theme.css")
                {
                    materialize_export_theme(output_dir)?
                } else {
                    candidate
                }
            };
            resolved.push(format!("--css={}", absolute.display()));
        } else if let Some(bib_path) = arg.strip_prefix("--bibliography=") {
            let path = Path::new(bib_path);
            let absolute = resolve_vault_relative(vault_root, output_dir, path);
            resolved.push(format!("--bibliography={}", absolute.display()));
        } else if let Some(csl_path) = arg.strip_prefix("--csl=") {
            let path = Path::new(csl_path);
            let absolute = if path.is_absolute() {
                path.to_path_buf()
            } else {
                let candidate = resolve_vault_relative(vault_root, output_dir, path);
                if candidate.exists() {
                    candidate
                } else if path
                    .file_name()
                    .is_some_and(|name| name == "apa-lite.csl")
                {
                    materialize_default_csl(output_dir)?
                } else {
                    candidate
                }
            };
            resolved.push(format!("--csl={}", absolute.display()));
        } else {
            resolved.push(arg.clone());
        }
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn materializes_theme_and_resolves_css_arg() {
        let dir = std::env::temp_dir().join(format!("scriptor-theme-{}", uuid::Uuid::new_v4()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");

        let resolved = resolve_extra_args(
            &dir,
            &dir,
            &[
                "--embed-resources".into(),
                "--css=export-theme.css".into(),
            ],
        )
        .expect("resolve args");

        let css = resolved
            .iter()
            .find(|arg| arg.starts_with("--css="))
            .expect("css arg");
        let theme_path = PathBuf::from(css.trim_start_matches("--css="));
        assert!(theme_path.is_absolute());
        assert!(theme_path.exists());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolves_bibliography_and_materializes_default_csl() {
        let vault = std::env::temp_dir().join(format!("scriptor-vault-{}", uuid::Uuid::new_v4()));
        let output = vault.join("exports");
        let _ = fs::remove_dir_all(&vault);
        fs::create_dir_all(&output).expect("output dir");
        fs::write(vault.join("references.bib"), "@article{a,title={T}}").expect("bib");

        let resolved = resolve_extra_args(
            &vault,
            &output,
            &[
                "--citeproc".into(),
                "--bibliography=references.bib".into(),
                "--csl=apa-lite.csl".into(),
            ],
        )
        .expect("resolve args");

        let bib = resolved
            .iter()
            .find(|arg| arg.starts_with("--bibliography="))
            .expect("bib arg");
        assert!(bib.contains("references.bib"));
        assert!(PathBuf::from(bib.trim_start_matches("--bibliography=")).exists());

        let csl = resolved
            .iter()
            .find(|arg| arg.starts_with("--csl="))
            .expect("csl arg");
        let csl_path = PathBuf::from(csl.trim_start_matches("--csl="));
        assert!(csl_path.is_absolute());
        assert!(csl_path.exists());

        let _ = fs::remove_dir_all(&vault);
    }
}
