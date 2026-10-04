use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[cfg(windows)]
use std::os::windows::fs::FileTypeExt;

use scriptor_system_bridge::scriptor_data_dir;

use super::discovery::{
    MAX_RESOURCE_BYTES, MAX_RESOURCE_ENTRIES, MAX_RESOURCE_FILES, hash_resource_directory,
    ignored_resource_metadata,
};
use super::{OperationKind, PlannedOperation, ResourceOperationReceipt};

const MAX_RESOURCE_COPY_DEPTH: usize = 4;

pub fn apply_operation(
    plan_id: &str,
    operation: &PlannedOperation,
) -> Result<ResourceOperationReceipt, String> {
    match operation.kind {
        OperationKind::Noop => {
            revalidate_operation(operation)?;
            Ok(receipt(operation, "unchanged", None))
        }
        OperationKind::Install | OperationKind::Update => apply_copy(plan_id, operation),
        OperationKind::QuarantineDuplicate => quarantine_duplicate(plan_id, operation),
    }
}

pub fn revalidate_operation(operation: &PlannedOperation) -> Result<(), String> {
    let source = Path::new(&operation.source_path);
    let source_hash = hash_resource_directory(source)?;
    if source_hash != operation.expected_source_hash {
        return Err(format!(
            "source changed after plan approval: {}",
            operation.source_path
        ));
    }

    let destination = Path::new(&operation.destination_path);
    match (&operation.expected_destination_hash, destination.exists()) {
        (Some(expected), true) => {
            let actual = hash_resource_directory(destination)?;
            if &actual != expected {
                return Err(format!(
                    "destination changed after plan approval: {}",
                    operation.destination_path
                ));
            }
        }
        (Some(_), false) => {
            return Err(format!(
                "destination disappeared after plan approval: {}",
                operation.destination_path
            ));
        }
        (None, true) => {
            return Err(format!(
                "destination appeared after plan approval: {}",
                operation.destination_path
            ));
        }
        (None, false) => {}
    }
    Ok(())
}

fn apply_copy(
    plan_id: &str,
    operation: &PlannedOperation,
) -> Result<ResourceOperationReceipt, String> {
    revalidate_operation(operation)?;
    let source = Path::new(&operation.source_path);
    let destination = Path::new(&operation.destination_path);
    let parent = destination
        .parent()
        .ok_or_else(|| format!("destination has no parent: {}", destination.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;

    let staging = staging_path(plan_id, operation)?;
    if let Some(staging_parent) = staging.parent() {
        fs::create_dir_all(staging_parent).map_err(|error| {
            format!(
                "failed to create staging directory {}: {error}",
                staging_parent.display()
            )
        })?;
    }
    remove_if_exists(&staging)?;
    if let Err(error) = copy_resource(source, &staging) {
        let cleanup = remove_if_exists(&staging)
            .err()
            .map(|cleanup_error| format!("; staging cleanup also failed: {cleanup_error}"))
            .unwrap_or_default();
        return Err(format!("{error}{cleanup}"));
    }
    let staged_hash = hash_resource_directory(&staging)?;
    if staged_hash != operation.expected_source_hash {
        remove_if_exists(&staging)?;
        return Err("staged resource did not match the approved source hash".into());
    }

    // Copying can take time. Recheck the reviewed destination immediately
    // before quarantine/promotion so edits made during staging are retained.
    if let Err(error) = revalidate_operation(operation) {
        let cleanup = remove_if_exists(&staging)
            .err()
            .map(|cleanup_error| format!("; staging cleanup also failed: {cleanup_error}"))
            .unwrap_or_default();
        return Err(format!("{error}{cleanup}"));
    }

    let quarantine = if destination.exists() {
        let path = quarantine_path(plan_id, operation)?;
        if let Some(quarantine_parent) = path.parent() {
            fs::create_dir_all(quarantine_parent).map_err(|error| {
                format!(
                    "failed to create quarantine directory {}: {error}",
                    quarantine_parent.display()
                )
            })?;
        }
        remove_if_exists(&path)?;
        move_with_verified_copy(
            destination,
            &path,
            operation.expected_destination_hash.as_deref(),
        )?;
        Some(path)
    } else {
        None
    };

    if let Err(error) =
        move_with_verified_copy(&staging, destination, Some(&operation.expected_source_hash))
    {
        let recovery = quarantine
            .as_ref()
            .map(|path| {
                restore_quarantine(
                    path,
                    destination,
                    operation.expected_destination_hash.as_deref(),
                )
            })
            .unwrap_or_default();
        let cleanup = remove_if_exists(&staging)
            .err()
            .map(|cleanup_error| format!("; staging cleanup also failed: {cleanup_error}"))
            .unwrap_or_default();
        return Err(format!(
            "failed to promote staged resource to {}: {error}{recovery}{cleanup}",
            destination.display()
        ));
    }

    let final_hash = hash_resource_directory(destination)?;
    if final_hash != operation.expected_source_hash {
        let cleanup = remove_if_exists(destination)
            .err()
            .map(|error| format!("; failed to remove invalid destination: {error}"))
            .unwrap_or_default();
        let recovery = quarantine
            .as_ref()
            .map(|path| {
                restore_quarantine(
                    path,
                    destination,
                    operation.expected_destination_hash.as_deref(),
                )
            })
            .unwrap_or_default();
        return Err(format!(
            "installed resource failed post-write hash verification{cleanup}{recovery}"
        ));
    }

    Ok(receipt(
        operation,
        match operation.kind {
            OperationKind::Install => "installed",
            OperationKind::Update => "updated",
            OperationKind::Noop => "unchanged",
            OperationKind::QuarantineDuplicate => "quarantined_duplicate",
        },
        quarantine.map(|path| path.display().to_string()),
    ))
}

fn quarantine_duplicate(
    plan_id: &str,
    operation: &PlannedOperation,
) -> Result<ResourceOperationReceipt, String> {
    revalidate_operation(operation)?;
    let source = Path::new(&operation.source_path);
    let quarantine = quarantine_path(plan_id, operation)?;
    if let Some(parent) = quarantine.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    remove_if_exists(&quarantine)?;
    move_with_verified_copy(source, &quarantine, Some(&operation.expected_source_hash))?;
    if source.exists() {
        return Err(format!(
            "duplicate remained after quarantine: {}",
            source.display()
        ));
    }
    Ok(receipt(
        operation,
        "quarantined_duplicate",
        Some(quarantine.display().to_string()),
    ))
}

fn move_with_verified_copy(
    source: &Path,
    destination: &Path,
    expected_hash: Option<&str>,
) -> Result<(), String> {
    require_missing_destination(destination)?;
    if let Some(expected) = expected_hash
        && hash_resource_directory(source)? != expected
    {
        return Err(format!("source changed before move: {}", source.display()));
    }
    if fs::rename(source, destination).is_ok() {
        if let Some(expected) = expected_hash {
            let moved_hash = hash_resource_directory(destination)?;
            if moved_hash != expected {
                let rollback = fs::rename(destination, source)
                    .err()
                    .map(|rollback_error| {
                        format!(
                            "; rollback rename also failed (content remains at {}): {rollback_error}",
                            destination.display()
                        )
                    })
                    .unwrap_or_default();
                return Err(format!(
                    "moved content failed verification: {}{rollback}",
                    destination.display()
                ));
            }
        }
        return Ok(());
    }
    // A failed rename is not permission to merge into or delete a destination
    // created by another actor. The copy path owns only paths it creates.
    require_missing_destination(destination)?;
    copy_resource(source, destination)?;
    if let Some(expected) = expected_hash {
        let copied_hash = hash_resource_directory(destination)?;
        if copied_hash != expected {
            let cleanup = remove_if_exists(destination)
                .err()
                .map(|cleanup_error| {
                    format!(
                        "; failed to clean invalid destination {}: {cleanup_error}",
                        destination.display()
                    )
                })
                .unwrap_or_default();
            return Err(format!(
                "copied quarantine content failed verification: {}{cleanup}",
                destination.display()
            ));
        }
    }
    if let Some(expected) = expected_hash
        && hash_resource_directory(source)? != expected
    {
        remove_if_exists(destination)?;
        return Err(format!(
            "source changed during copy; original content retained: {}",
            source.display()
        ));
    }
    remove_if_exists(source)
}

fn require_missing_destination(destination: &Path) -> Result<(), String> {
    match fs::symlink_metadata(destination) {
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Ok(_) => Err(format!(
            "refusing to replace an existing resource destination: {}",
            destination.display()
        )),
        Err(error) => Err(format!(
            "failed to inspect resource destination {}: {error}",
            destination.display()
        )),
    }
}

fn copy_resource(source: &Path, destination: &Path) -> Result<(), String> {
    copy_resource_at_depth(source, destination, 0, &mut CopyBudget::default())
}

#[derive(Default)]
struct CopyBudget {
    files: usize,
    bytes: u64,
    entries: usize,
}

fn copy_resource_at_depth(
    source: &Path,
    destination: &Path,
    depth: usize,
    budget: &mut CopyBudget,
) -> Result<(), String> {
    if depth > MAX_RESOURCE_COPY_DEPTH {
        return Err(format!(
            "resource exceeds the maximum nesting depth: {}",
            source.display()
        ));
    }
    let metadata = fs::symlink_metadata(source)
        .map_err(|error| format!("failed to inspect {}: {error}", source.display()))?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "refusing to copy a symlinked resource root: {}",
            source.display()
        ));
    }
    if metadata.is_file() {
        return copy_file_exclusively(source, destination, budget);
    }
    if !metadata.is_dir() {
        return Err(format!("unsupported resource type: {}", source.display()));
    }

    scriptor_vault::fs::create_private_directory(destination).map_err(|error| {
        format!(
            "failed to create staging directory {}: {error}",
            destination.display()
        )
    })?;
    let result = (|| {
        for entry in fs::read_dir(source)
            .map_err(|error| format!("failed to read {}: {error}", source.display()))?
        {
            let entry =
                entry.map_err(|error| format!("failed to read directory entry: {error}"))?;
            if ignored_resource_metadata(&entry.file_name()) {
                continue;
            }
            budget.entries += 1;
            if budget.entries > MAX_RESOURCE_ENTRIES {
                return Err(format!(
                    "resource exceeds {MAX_RESOURCE_ENTRIES} entries: {}",
                    source.display()
                ));
            }
            let child_source = entry.path();
            let child_destination = destination.join(entry.file_name());
            let child_metadata = fs::symlink_metadata(&child_source).map_err(|error| {
                format!("failed to inspect {}: {error}", child_source.display())
            })?;
            if child_metadata.file_type().is_symlink() {
                return Err(format!(
                    "nested symlinks are not copied automatically: {}",
                    child_source.display()
                ));
            }
            if child_metadata.is_dir() {
                copy_resource_at_depth(&child_source, &child_destination, depth + 1, budget)?;
            } else if child_metadata.is_file() {
                copy_file_exclusively(&child_source, &child_destination, budget)?;
            } else {
                return Err(format!(
                    "unsupported resource type: {}",
                    child_source.display()
                ));
            }
        }
        fs::set_permissions(destination, metadata.permissions()).map_err(|error| {
            format!(
                "failed to preserve directory permissions for {}: {error}",
                destination.display()
            )
        })?;
        Ok(())
    })();
    if let Err(error) = result {
        // The exclusive create above proves this directory belongs to this
        // copy operation. Never perform this cleanup on an AlreadyExists path.
        let cleanup = remove_if_exists(destination)
            .err()
            .map(|cleanup_error| format!("; partial copy cleanup failed: {cleanup_error}"))
            .unwrap_or_default();
        return Err(format!("{error}{cleanup}"));
    }
    Ok(())
}

fn copy_file_exclusively(
    source: &Path,
    destination: &Path,
    budget: &mut CopyBudget,
) -> Result<(), String> {
    if budget.files >= MAX_RESOURCE_FILES {
        return Err(format!(
            "resource exceeds {MAX_RESOURCE_FILES} files: {}",
            source.display()
        ));
    }
    let input = fs::File::open(source)
        .map_err(|error| format!("failed to open {}: {error}", source.display()))?;
    let metadata = input
        .metadata()
        .map_err(|error| format!("failed to inspect {}: {error}", source.display()))?;
    if !metadata.is_file() {
        return Err(format!("unsupported resource type: {}", source.display()));
    }
    let remaining = MAX_RESOURCE_BYTES.saturating_sub(budget.bytes);
    if metadata.len() > remaining {
        return Err(format!(
            "resource exceeds its size limit: {}",
            source.display()
        ));
    }
    budget.files += 1;
    let mut input = input.take(remaining + 1);
    let mut output = scriptor_vault::fs::create_private_file(destination)
        .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
    let result = std::io::copy(&mut input, &mut output).and_then(|bytes| {
        if bytes > remaining {
            return Err(std::io::Error::other("resource exceeds its size limit"));
        }
        budget.bytes += bytes;
        output.set_permissions(metadata.permissions())
    });
    drop(output);
    if let Err(error) = result {
        let cleanup = remove_if_exists(destination)
            .err()
            .map(|cleanup_error| format!("; partial file cleanup failed: {cleanup_error}"))
            .unwrap_or_default();
        return Err(format!(
            "failed to copy {} to {}: {error}{cleanup}",
            source.display(),
            destination.display()
        ));
    }
    Ok(())
}

fn staging_path(plan_id: &str, operation: &PlannedOperation) -> Result<PathBuf, String> {
    let base = scriptor_data_dir("Scriptor")
        .map_err(|error| format!("failed to resolve Scriptor data directory: {error}"))?;
    let destination_name = Path::new(&operation.destination_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("resource");
    Ok(base
        .join("resource-staging")
        .join(plan_id)
        .join(&operation.target_id)
        .join(operation.id.replace('-', ""))
        .join(destination_name))
}

fn restore_quarantine(
    quarantine: &Path,
    destination: &Path,
    expected_hash: Option<&str>,
) -> String {
    match move_with_verified_copy(quarantine, destination, expected_hash) {
        Ok(()) => format!("; previous content restored from {}", quarantine.display()),
        Err(error) => format!(
            "; restore failed; previous content remains at {}: {error}",
            quarantine.display()
        ),
    }
}

fn quarantine_path(plan_id: &str, operation: &PlannedOperation) -> Result<PathBuf, String> {
    let base = scriptor_data_dir("Scriptor")
        .map_err(|error| format!("failed to resolve Scriptor data directory: {error}"))?;
    let destination_name = Path::new(&operation.destination_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("resource");
    Ok(base
        .join("resource-quarantine")
        .join(plan_id)
        .join(&operation.target_id)
        .join(operation.id.replace('-', ""))
        .join(destination_name))
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!("failed to inspect {}: {error}", path.display()));
        }
    };
    let file_type = metadata.file_type();
    #[cfg(windows)]
    if file_type.is_symlink_dir() {
        return fs::remove_dir(path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()));
    }
    if metadata.is_dir() && !file_type.is_symlink() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))
    } else {
        fs::remove_file(path)
            .map_err(|error| format!("failed to remove {}: {error}", path.display()))
    }
}

fn receipt(
    operation: &PlannedOperation,
    outcome: &str,
    quarantine_path: Option<String>,
) -> ResourceOperationReceipt {
    ResourceOperationReceipt {
        operation_id: operation.id.clone(),
        target_id: operation.target_id.clone(),
        outcome: outcome.to_string(),
        destination_path: operation.destination_path.clone(),
        content_hash: operation.expected_source_hash.clone(),
        quarantine_path,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verified_move_preserves_a_destination_created_after_review() {
        let dir = tempfile::tempdir().expect("tempdir");
        let source = dir.path().join("source");
        let destination = dir.path().join("destination");
        fs::create_dir(&source).unwrap();
        fs::create_dir(&destination).unwrap();
        fs::write(source.join("SKILL.md"), "approved source").unwrap();
        fs::write(destination.join("SKILL.md"), "new user edits").unwrap();
        fs::write(destination.join("unrelated.txt"), "keep this too").unwrap();
        let expected = hash_resource_directory(&source).unwrap();

        assert!(move_with_verified_copy(&source, &destination, Some(&expected)).is_err());

        assert_eq!(
            fs::read_to_string(source.join("SKILL.md")).unwrap(),
            "approved source"
        );
        assert_eq!(
            fs::read_to_string(destination.join("SKILL.md")).unwrap(),
            "new user edits"
        );
        assert_eq!(
            fs::read_to_string(destination.join("unrelated.txt")).unwrap(),
            "keep this too"
        );
    }

    #[test]
    fn copy_never_merges_with_or_overwrites_an_existing_destination() {
        let dir = tempfile::tempdir().expect("tempdir");
        let source = dir.path().join("source");
        let destination = dir.path().join("destination");
        fs::create_dir(&source).unwrap();
        fs::create_dir(&destination).unwrap();
        fs::write(source.join("SKILL.md"), "source").unwrap();
        fs::write(destination.join("SKILL.md"), "destination").unwrap();

        assert!(copy_resource(&source, &destination).is_err());
        assert!(copy_resource(&source.join("SKILL.md"), &destination.join("SKILL.md")).is_err());
        assert_eq!(
            fs::read_to_string(destination.join("SKILL.md")).unwrap(),
            "destination"
        );
    }

    #[test]
    fn hidden_resource_content_is_hashed_copied_and_rechecked() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        let destination = dir.path().join("destination");
        fs::create_dir_all(source.join(".runtime")).unwrap();
        fs::write(source.join("SKILL.md"), "# Example\n").unwrap();
        fs::write(source.join(".runtime/run.py"), "print(1)\n").unwrap();
        fs::write(source.join(".DS_Store"), "metadata").unwrap();
        let before = hash_resource_directory(&source).unwrap();

        fs::write(source.join(".runtime/run.py"), "print(2)\n").unwrap();
        let after = hash_resource_directory(&source).unwrap();

        assert_ne!(
            before, after,
            "hidden code must participate in reviewed hashes"
        );
        copy_resource(&source, &destination).unwrap();
        assert_eq!(
            fs::read_to_string(destination.join(".runtime/run.py")).unwrap(),
            "print(2)\n"
        );
        assert!(!destination.join(".DS_Store").exists());
        assert_eq!(hash_resource_directory(&destination).unwrap(), after);
        assert!(
            move_with_verified_copy(&source, &dir.path().join("moved"), Some(&before)).is_err()
        );
        assert!(source.exists());
    }

    #[test]
    fn hidden_oversized_content_cannot_bypass_resource_limits() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        let destination = dir.path().join("destination");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("SKILL.md"), "# Example\n").unwrap();
        fs::File::create(source.join(".oversized.bin"))
            .unwrap()
            .set_len(MAX_RESOURCE_BYTES + 1)
            .unwrap();

        assert!(hash_resource_directory(&source).is_err());
        assert!(copy_resource(&source, &destination).is_err());
        assert!(
            !destination.exists(),
            "an owned partial copy must be cleaned"
        );
    }

    #[test]
    fn copy_enforces_file_byte_and_entry_budgets_without_retaining_partial_outputs() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("SKILL.md"), "ab").unwrap();
        for mut budget in [
            CopyBudget {
                files: MAX_RESOURCE_FILES,
                ..CopyBudget::default()
            },
            CopyBudget {
                bytes: MAX_RESOURCE_BYTES - 1,
                ..CopyBudget::default()
            },
            CopyBudget {
                entries: MAX_RESOURCE_ENTRIES,
                ..CopyBudget::default()
            },
        ] {
            let destination = dir.path().join(uuid::Uuid::new_v4().to_string());
            assert!(copy_resource_at_depth(&source, &destination, 0, &mut budget).is_err());
            assert!(!destination.exists());
        }
        assert_eq!(fs::read_to_string(source.join("SKILL.md")).unwrap(), "ab");
    }

    #[test]
    fn resource_hash_ignores_operating_system_metadata() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::write(
            dir.path().join("SKILL.md"),
            "---\nname: example\n---\n# Example\n",
        )
        .expect("write manifest");
        let before = hash_resource_directory(dir.path()).expect("hash before metadata");
        for name in [".DS_Store", "Thumbs.db", "desktop.ini"] {
            fs::write(dir.path().join(name), b"operating system metadata").expect("write metadata");
        }
        let after = hash_resource_directory(dir.path()).expect("hash after metadata");
        assert_eq!(
            before, after,
            "explicit operating system metadata must not affect resource hashes"
        );
    }

    #[cfg(unix)]
    #[test]
    fn copy_resource_applies_read_only_directory_permissions_after_children() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().expect("tempdir");
        let source = dir.path().join("source");
        let destination = dir.path().join("destination");
        fs::create_dir(&source).expect("create source");
        fs::write(source.join("SKILL.md"), "# Example\n").expect("write child");
        fs::set_permissions(&source, fs::Permissions::from_mode(0o555)).expect("set source mode");

        copy_resource(&source, &destination).expect("copy read-only directory");

        assert_eq!(
            fs::metadata(&destination)
                .expect("destination metadata")
                .permissions()
                .mode()
                & 0o777,
            0o555,
        );
        assert_eq!(
            fs::read_to_string(destination.join("SKILL.md")).expect("read copied child"),
            "# Example\n",
        );
    }
}
