use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, run_process};
use scriptor_vault::{RelativeVaultPath, VaultRoot, atomic_write};
use serde::Serialize;

const PLANTUML_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_PROCESS_OUTPUT: usize = 256 * 1024;
const MAX_SVG_BYTES: u64 = 4 * 1024 * 1024;
const MAX_ASSET_BYTES: u64 = 64 * 1024 * 1024;
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

fn candidate_spec(program: &str, args: Vec<String>, input: &Path) -> ProcessSpec {
    ProcessSpec::new(program)
        .args(args)
        .current_dir(input.parent().unwrap_or_else(|| Path::new(".")))
        .timeout(PLANTUML_TIMEOUT)
        .max_output_bytes(MAX_PROCESS_OUTPUT)
        .network_policy(NetworkPolicy::Deny)
        .env("PLANTUML_SECURITY_PROFILE", "SANDBOX")
        .allow_unsandboxed_network_denial(environment_opt_in(UNSANDBOXED_TOOLS_OPT_IN))
        .expected_sha256(std::env::var("SCRIPTOR_PLANTUML_SHA256").ok())
}
fn run_candidate(
    program: &str,
    args: Vec<String>,
    input: &Path,
) -> Result<(String, String), String> {
    let receipt =
        run_process(candidate_spec(program, args, input)).map_err(|error| error.to_string())?;
    if receipt.exit_code != 0 || receipt.timed_out {
        return Err(format!(
            "PlantUML failed with exit code {}: {}",
            receipt.exit_code,
            receipt.stderr.trim()
        ));
    }
    let svg = String::from_utf8(bounded_regular_file(
        &input.with_extension("svg"),
        MAX_SVG_BYTES,
    )?)
    .map_err(|_| "PlantUML output must be UTF-8")?;
    Ok((svg, receipt.resolved_program))
}

fn bounded_regular_file(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err("Asset input must be a regular file".into());
    }
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    if bytes.len() as u64 > limit {
        return Err("Asset exceeds its size bound".into());
    }
    Ok(bytes)
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
    fs::create_dir(&temp_dir).map_err(|error| error.to_string())?;
    struct RenderDirectory(PathBuf);
    impl Drop for RenderDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    let _directory = RenderDirectory(temp_dir.clone());
    let input = temp_dir.join("diagram.puml");
    fs::write(&input, source).map_err(|error| error.to_string())?;
    let result = run_plantuml(&input);
    let (svg, engine) = result?;
    Ok(PlantUmlRenderOutput { svg, engine })
}

fn backup_asset_for_recovery(
    root: &VaultRoot,
    relative_path: &str,
    existing: &[u8],
) -> Result<(), String> {
    let hash = scriptor_vault::hash::path_hash(relative_path);
    let recovery_dir = root
        .resolve_relative(
            &RelativeVaultPath::parse(".scriptor/recovery/assets")
                .map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&recovery_dir).map_err(|error| error.to_string())?;
    let backup = recovery_dir.join(format!("{}-{}.bak", &hash[..16], uuid::Uuid::new_v4()));
    atomic_write(&backup, existing).map_err(|error| error.to_string())
}

pub fn save_vault_asset(
    root: &VaultRoot,
    relative_path: &str,
    bytes: &[u8],
    require_missing: bool,
) -> Result<String, String> {
    if bytes.len() as u64 > MAX_ASSET_BYTES {
        return Err("Asset exceeds 64 MiB".into());
    }
    let relative = RelativeVaultPath::parse(relative_path).map_err(|error| error.to_string())?;
    // Serialize asset replacement with note/delete/rename mutations so a
    // bibliography import cannot race another writer after observing the old
    // bytes. Existing content is always recoverable before replacement.
    let _mutation_lock =
        scriptor_vault::fs::lock_vault_mutation(root.root()).map_err(|error| error.to_string())?;
    let absolute: PathBuf = root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    if root.root().join(".scriptor/rename-txn.json").is_file() {
        return Err(
            "vault rename transaction is still pending; retry after it commits or rolls back"
                .into(),
        );
    }

    match fs::symlink_metadata(&absolute) {
        Ok(_) if require_missing => {
            return Err("Asset destination already exists; choose a new path".into());
        }
        Ok(_) => {
            let existing = bounded_regular_file(&absolute, MAX_ASSET_BYTES)?;
            if existing == bytes {
                return Ok(relative.to_string());
            }
            backup_asset_for_recovery(root, relative.as_str(), &existing)?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(format!(
                "Cannot inspect existing asset before replacement: {error}"
            ));
        }
    }

    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    atomic_write(&absolute, bytes).map_err(|error| error.to_string())?;
    Ok(relative.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plantuml_spec_denies_network_and_local_includes() {
        let spec = candidate_spec("plantuml", vec!["-tsvg".into()], Path::new("diagram.puml"));
        assert_eq!(spec.network_policy, NetworkPolicy::Deny);
        assert!(
            spec.environment
                .contains(&("PLANTUML_SECURITY_PROFILE".into(), "SANDBOX".into()))
        );
        assert_eq!(spec.timeout, PLANTUML_TIMEOUT);
        assert_eq!(spec.max_output_bytes, MAX_PROCESS_OUTPUT);
    }

    #[test]
    fn bounds_existing_files_and_keeps_each_recovery_version() {
        let dir = tempfile::tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        save_vault_asset(&root, "refs.bib", b"one", false).unwrap();
        save_vault_asset(&root, "refs.bib", b"two", false).unwrap();
        save_vault_asset(&root, "refs.bib", b"three", false).unwrap();
        let mut recovered: Vec<_> = fs::read_dir(dir.path().join(".scriptor/recovery/assets"))
            .unwrap()
            .map(|item| fs::read(item.unwrap().path()).unwrap())
            .collect();
        recovered.sort();
        assert_eq!(recovered, vec![b"one".to_vec(), b"two".to_vec()]);
        assert!(bounded_regular_file(&dir.path().join("refs.bib"), 3).is_err());
        assert!(save_vault_asset(&root, "refs.bib", b"replacement", true).is_err());
        assert_eq!(fs::read(dir.path().join("refs.bib")).unwrap(), b"three");
    }
}
