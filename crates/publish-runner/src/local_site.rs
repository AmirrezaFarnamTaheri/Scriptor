//! Local Astro/Starlight site orchestration.
//!
//! This module owns the durable managed-state file and the site scaffold so
//! desktop and CLI publication use the same application service.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use scriptor_vault::{
    MAX_INDEXED_NOTE_BYTES, RelativeVaultPath, VaultRoot, atomic_write, content_hash_bytes,
};

use crate::compile::publish_apply_with_state_persistence;
use crate::{
    BucketState, LocalDirSink, PublishApplyInput, PublishApplyOutput, PublishError, PublishPlan,
    PublishPlanOptions, plan_publish,
};

pub const PUBLISH_STATE_FILE: &str = ".scriptor-publish-state.json";
const MAX_STATE_BYTES: u64 = 4 * 1024 * 1024;

const ASTRO_CONFIG: &str = "import { defineConfig } from 'astro/config';\
import starlight from '@astrojs/starlight';\
\
export default defineConfig({\
  integrations: [starlight({ title: 'Scriptor Publish' })],\
});\
";

// Versions are intentionally exact so a generated local site is reproducible.
// Refresh them deliberately when Scriptor's publication compatibility is tested.
const PACKAGE_JSON: &str = r#"{
  "name": "scriptor-publish",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.33.0",
  "scripts": {
    "dev": "astro dev",
    "build": "pnpm install --frozen-lockfile && astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/starlight": "0.41.7",
    "astro": "7.2.1"
  }
}
"#;

const PNPM_LOCK_PARTS: &[&str] = &[
    include_str!("starlight-lock/part-001.txt"),
    include_str!("starlight-lock/part-002.txt"),
    include_str!("starlight-lock/part-003.txt"),
    include_str!("starlight-lock/part-004.txt"),
    include_str!("starlight-lock/part-005.txt"),
    include_str!("starlight-lock/part-006.txt"),
    include_str!("starlight-lock/part-007.txt"),
    include_str!("starlight-lock/part-008.txt"),
    include_str!("starlight-lock/part-009.txt"),
    include_str!("starlight-lock/part-010.txt"),
    include_str!("starlight-lock/part-011.txt"),
    include_str!("starlight-lock/part-012.txt"),
    include_str!("starlight-lock/part-013.txt"),
    include_str!("starlight-lock/part-014.txt"),
];

pub fn resolve_output_path(vault_root: &Path, requested: &Path) -> PathBuf {
    if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        vault_root
            .parent()
            .unwrap_or(vault_root)
            .join(requested)
    }
}

fn canonical_target(path: &Path) -> Result<PathBuf, PublishError> {
    if path.exists() {
        return path.canonicalize().map_err(|source| PublishError::Io {
            path: path.display().to_string(),
            source,
        });
    }
    let mut missing = Vec::new();
    let mut ancestor = path;
    while !ancestor.exists() {
        let name = ancestor.file_name().ok_or_else(|| PublishError::InvalidSelection {
            path: path.display().to_string(),
            reason: "publish output has no existing ancestor".into(),
        })?;
        missing.push(name.to_os_string());
        ancestor = ancestor.parent().ok_or_else(|| PublishError::InvalidSelection {
            path: path.display().to_string(),
            reason: "publish output has no existing ancestor".into(),
        })?;
    }
    let mut canonical = ancestor.canonicalize().map_err(|source| PublishError::Io {
        path: ancestor.display().to_string(),
        source,
    })?;
    for component in missing.into_iter().rev() {
        canonical.push(component);
    }
    Ok(canonical)
}

fn validate_disjoint(
    vault_root: &Path,
    output_root: &Path,
) -> Result<(VaultRoot, PathBuf), PublishError> {
    let vault = VaultRoot::open(vault_root)?;
    let output = canonical_target(output_root)?;
    if output.starts_with(vault.root()) || vault.root().starts_with(&output) {
        return Err(PublishError::UnsafeOutputRoot {
            vault: vault.root().display().to_string(),
            output: output.display().to_string(),
        });
    }
    Ok((vault, output))
}

fn read_state(output: &VaultRoot) -> Result<BucketState, PublishError> {
    let relative = RelativeVaultPath::parse(PUBLISH_STATE_FILE)?;
    let path = output.resolve_relative(&relative)?;
    if !path.exists() {
        return Ok(BucketState::default());
    }
    let metadata = std::fs::symlink_metadata(&path).map_err(|source| PublishError::Io {
        path: PUBLISH_STATE_FILE.into(),
        source,
    })?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
        return Err(PublishError::InvalidSelection {
            path: PUBLISH_STATE_FILE.into(),
            reason: "managed publish state must be a regular file".into(),
        });
    }
    if metadata.len() > MAX_STATE_BYTES {
        return Err(PublishError::InvalidSelection {
            path: PUBLISH_STATE_FILE.into(),
            reason: format!("managed publish state exceeds {MAX_STATE_BYTES} bytes"),
        });
    }
    let bytes = std::fs::read(&path).map_err(|source| PublishError::Io {
        path: PUBLISH_STATE_FILE.into(),
        source,
    })?;
    Ok(serde_json::from_slice(&bytes)?)
}

/// Identify managed output whose bytes no longer match the hash recorded by
/// the last successful publish. Ownership remains in `BucketState`; the drift
/// set is only a planning signal so reviewed apply can safely repair the file.
fn output_drift(
    output: &VaultRoot,
    state: &BucketState,
) -> Result<HashSet<String>, PublishError> {
    let mut drifted = HashSet::new();
    for (rel, expected_hash) in &state.entries {
        let source_rel = RelativeVaultPath::parse(rel)?;
        let docs_rel = RelativeVaultPath::parse(&format!(
            "src/content/docs/{}",
            source_rel.as_str()
        ))?;
        let path = output.resolve_relative(&docs_rel)?;
        if !path.exists() {
            drifted.insert(rel.clone());
            continue;
        }
        let metadata = std::fs::symlink_metadata(&path).map_err(|source| PublishError::Io {
            path: docs_rel.to_string(),
            source,
        })?;
        if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
            drifted.insert(rel.clone());
            continue;
        }
        if metadata.len() > MAX_INDEXED_NOTE_BYTES {
            drifted.insert(rel.clone());
            continue;
        }
        let bytes = std::fs::read(&path).map_err(|source| PublishError::Io {
            path: docs_rel.to_string(),
            source,
        })?;
        if content_hash_bytes(&bytes) != *expected_hash {
            drifted.insert(rel.clone());
        }
    }
    Ok(drifted)
}

fn load_state_read_only(
    vault_root: &Path,
    output_root: &Path,
) -> Result<(BucketState, HashSet<String>), PublishError> {
    let (_, canonical_output) = validate_disjoint(vault_root, output_root)?;
    if !canonical_output.exists() {
        return Ok((BucketState::default(), HashSet::new()));
    }
    let output = VaultRoot::open(&canonical_output)?;
    let state = read_state(&output)?;
    let drifted = output_drift(&output, &state)?;
    Ok((state, drifted))
}

pub struct StarlightSite {
    output_root: VaultRoot,
    docs_sink: LocalDirSink,
}

impl StarlightSite {
    /// Open a local site output, rejecting any source/output containment. A
    /// publish tree inside the vault would be re-scanned on the next plan; a
    /// vault inside the output could be deleted or overwritten by site work.
    pub fn open(vault_root: &Path, output_root: &Path) -> Result<Self, PublishError> {
        let (_, canonical_output) = validate_disjoint(vault_root, output_root)?;
        std::fs::create_dir_all(&canonical_output).map_err(|source| PublishError::Io {
            path: canonical_output.display().to_string(),
            source,
        })?;
        let output = VaultRoot::open(&canonical_output)?;

        let docs_rel = RelativeVaultPath::parse("src/content/docs")?;
        let docs_root = output.resolve_relative(&docs_rel)?;
        std::fs::create_dir_all(&docs_root).map_err(|source| PublishError::Io {
            path: docs_root.display().to_string(),
            source,
        })?;
        let docs_sink = LocalDirSink::new(docs_root)?;

        Ok(Self {
            output_root: output,
            docs_sink,
        })
    }

    pub fn output_root(&self) -> &Path {
        self.output_root.root()
    }

    pub fn docs_root(&self) -> &Path {
        self.docs_sink.root()
    }

    pub fn load_state(&self) -> Result<BucketState, PublishError> {
        read_state(&self.output_root)
    }

    pub fn save_state(&self, state: &BucketState) -> Result<(), PublishError> {
        let relative = RelativeVaultPath::parse(PUBLISH_STATE_FILE)?;
        let path = self.output_root.resolve_relative(&relative)?;
        let mut bytes = serde_json::to_vec_pretty(state)?;
        bytes.push(b'\n');
        atomic_write(&path, &bytes)?;
        Ok(())
    }

    /// Create the minimum runnable Starlight scaffold without overwriting any
    /// existing user customization.
    pub fn ensure_scaffold(&self) -> Result<(), PublishError> {
        self.write_if_missing("astro.config.mjs", ASTRO_CONFIG.as_bytes())?;
        self.write_if_missing("package.json", PACKAGE_JSON.as_bytes())?;
        let pnpm_lock = PNPM_LOCK_PARTS.concat();
        self.write_if_missing("pnpm-lock.yaml", pnpm_lock.as_bytes())?;
        Ok(())
    }

    fn write_if_missing(&self, rel_path: &str, bytes: &[u8]) -> Result<(), PublishError> {
        let relative = RelativeVaultPath::parse(rel_path)?;
        let path = self.output_root.resolve_relative(&relative)?;
        if path.exists() {
            return Ok(());
        }
        atomic_write(&path, bytes)?;
        Ok(())
    }
}

pub fn plan_starlight_site(
    vault_root: &Path,
    output_root: &Path,
) -> Result<PublishPlan, PublishError> {
    let (state, drifted) = load_state_read_only(vault_root, output_root)?;
    let mut plan = plan_publish(vault_root, &state, &PublishPlanOptions::default())?;
    if !drifted.is_empty() {
        let mut unchanged = Vec::with_capacity(plan.unchanged.len());
        for candidate in plan.unchanged.drain(..) {
            if drifted.contains(&candidate.rel_path) {
                plan.changed.push(candidate);
            } else {
                unchanged.push(candidate);
            }
        }
        plan.unchanged = unchanged;
        plan.changed
            .sort_by(|left, right| left.rel_path.cmp(&right.rel_path));
    }
    Ok(plan)
}

pub fn apply_starlight_site(
    vault_root: &Path,
    output_root: &Path,
    input: &PublishApplyInput,
) -> Result<PublishApplyOutput, PublishError> {
    apply_starlight_site_with_state_writer(vault_root, output_root, input, |site, state| {
        site.save_state(state)
    })
}

fn apply_starlight_site_with_state_writer<F>(
    vault_root: &Path,
    output_root: &Path,
    input: &PublishApplyInput,
    mut save_state: F,
) -> Result<PublishApplyOutput, PublishError>
where
    F: FnMut(&StarlightSite, &BucketState) -> Result<(), PublishError>,
{
    let site = StarlightSite::open(vault_root, output_root)?;
    let state = site.load_state()?;
    site.ensure_scaffold()?;
    publish_apply_with_state_persistence(
        vault_root,
        input,
        &site.docs_sink,
        &state,
        &PublishPlanOptions::default(),
        |next_state| save_state(&site, next_state),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::PublishCandidate;
    use tempfile::TempDir;

    fn write_opted_in(path: &Path, body: &str) {
        std::fs::write(path, format!("---\npublish: true\n---\n{body}\n")).unwrap();
    }

    #[test]
    fn output_may_not_be_inside_vault() {
        let vault = TempDir::new().unwrap();
        let output = vault.path().join("site");
        let error = StarlightSite::open(vault.path(), &output).err().unwrap();
        assert!(matches!(error, PublishError::UnsafeOutputRoot { .. }));
    }

    #[test]
    fn scaffold_preserves_existing_customizations() {
        let vault = TempDir::new().unwrap();
        let output = TempDir::new().unwrap();
        std::fs::write(output.path().join("astro.config.mjs"), "// custom\
").unwrap();
        let site = StarlightSite::open(vault.path(), output.path()).unwrap();
        site.ensure_scaffold().unwrap();
        assert_eq!(
            std::fs::read_to_string(output.path().join("astro.config.mjs")).unwrap(),
            "// custom\
"
        );
        let package_json = std::fs::read_to_string(output.path().join("package.json")).unwrap();
        assert!(package_json.contains("pnpm install --frozen-lockfile && astro build"));
        assert_eq!(
            std::fs::read_to_string(output.path().join("pnpm-lock.yaml")).unwrap(),
            PNPM_LOCK_PARTS.concat()
        );
    }

    #[test]
    fn state_round_trips_atomically() {
        let vault = TempDir::new().unwrap();
        let output = TempDir::new().unwrap();
        let site = StarlightSite::open(vault.path(), output.path()).unwrap();
        let bytes = b"published body\
";
        std::fs::write(site.docs_root().join("note.md"), bytes).unwrap();
        let mut state = BucketState::default();
        state
            .entries
            .insert("note.md".into(), content_hash_bytes(bytes));
        site.save_state(&state).unwrap();
        assert_eq!(
            site.load_state().unwrap().entries.get("note.md"),
            state.entries.get("note.md")
        );
    }

    #[test]
    fn state_save_failure_before_later_write_keeps_publish_recoverable() {
        let vault = TempDir::new().unwrap();
        let output = TempDir::new().unwrap();
        write_opted_in(&vault.path().join("first.md"), "first");
        write_opted_in(&vault.path().join("second.md"), "second");
        let plan = plan_starlight_site(vault.path(), output.path()).unwrap();
        let first = plan
            .new_items
            .iter()
            .find(|candidate| candidate.rel_path == "first.md")
            .unwrap()
            .clone();
        let second = plan
            .new_items
            .iter()
            .find(|candidate| candidate.rel_path == "second.md")
            .unwrap()
            .clone();
        let mut save_calls = 0;

        let error = apply_starlight_site_with_state_writer(
            vault.path(),
            output.path(),
            &PublishApplyInput {
                to_write: vec![first, second],
                to_delete: vec![],
            },
            |site, state| {
                save_calls += 1;
                if save_calls == 2 {
                    return Err(PublishError::InvalidSelection {
                        path: PUBLISH_STATE_FILE.into(),
                        reason: "injected state save failure".into(),
                    });
                }
                site.save_state(state)
            },
        )
        .expect_err("second state save must fail");

        assert!(matches!(error, PublishError::PartialApply { .. }));
        assert!(output.path().join("src/content/docs/first.md").exists());
        assert!(!output.path().join("src/content/docs/second.md").exists());

        let site = StarlightSite::open(vault.path(), output.path()).unwrap();
        let durable = site.load_state().unwrap();
        assert!(durable.entries.contains_key("first.md"));
        assert!(!durable.entries.contains_key("second.md"));

        let retry = plan_starlight_site(vault.path(), output.path()).unwrap();
        assert!(retry.unchanged.iter().any(|candidate| candidate.rel_path == "first.md"));
        assert!(retry.new_items.iter().any(|candidate| candidate.rel_path == "second.md"));
    }

    #[test]
    fn managed_output_drift_becomes_actionable_again() {
        let vault = TempDir::new().unwrap();
        let output = TempDir::new().unwrap();
        write_opted_in(&vault.path().join("note.md"), "source");
        let site = StarlightSite::open(vault.path(), output.path()).unwrap();
        std::fs::write(site.docs_root().join("note.md"), b"manually changed").unwrap();
        let source_bytes = std::fs::read(vault.path().join("note.md")).unwrap();
        let mut state = BucketState::default();
        state
            .entries
            .insert("note.md".into(), content_hash_bytes(&source_bytes));
        site.save_state(&state).unwrap();

        let plan = plan_starlight_site(vault.path(), output.path()).unwrap();
        assert!(plan.new_items.is_empty());
        assert_eq!(plan.changed.len(), 1);
        assert_eq!(plan.changed[0].rel_path, "note.md");
        assert!(plan.unchanged.is_empty());
    }

    #[test]
    fn managed_output_drift_can_be_repaired_by_reviewed_apply() {
        let vault = TempDir::new().unwrap();
        let output = TempDir::new().unwrap();
        write_opted_in(&vault.path().join("note.md"), "source");
        let site = StarlightSite::open(vault.path(), output.path()).unwrap();
        let source_bytes = std::fs::read(vault.path().join("note.md")).unwrap();
        std::fs::write(site.docs_root().join("note.md"), b"manually changed").unwrap();
        let mut state = BucketState::default();
        state
            .entries
            .insert("note.md".into(), content_hash_bytes(&source_bytes));
        site.save_state(&state).unwrap();

        let plan = plan_starlight_site(vault.path(), output.path()).unwrap();
        let reviewed = plan.changed[0].clone();
        let result = apply_starlight_site(
            vault.path(),
            output.path(),
            &PublishApplyInput {
                to_write: vec![reviewed],
                to_delete: vec![],
            },
        )
        .unwrap();

        assert_eq!(result.written, vec!["note.md"]);
        assert_eq!(
            std::fs::read(output.path().join("src/content/docs/note.md")).unwrap(),
            source_bytes
        );
    }

    #[test]
    fn plan_then_apply_publishes_only_reviewed_opted_in_note() {
        let vault = TempDir::new().unwrap();
        let output = TempDir::new().unwrap();
        write_opted_in(&vault.path().join("public.md"), "public");
        std::fs::write(vault.path().join("private.md"), "# private\
").unwrap();
        let plan = plan_starlight_site(vault.path(), output.path()).unwrap();
        assert_eq!(plan.new_items.len(), 1);
        let reviewed: PublishCandidate = plan.new_items[0].clone();
        let result = apply_starlight_site(
            vault.path(),
            output.path(),
            &PublishApplyInput {
                to_write: vec![reviewed],
                to_delete: vec![],
            },
        )
        .unwrap();
        assert_eq!(result.written, vec!["public.md"]);
        assert!(output.path().join("src/content/docs/public.md").exists());
        assert!(!output.path().join("src/content/docs/private.md").exists());
    }
}
