use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[cfg(windows)]
use std::os::windows::fs::FileTypeExt;

use scriptor_system_bridge::scriptor_data_dir;

use super::{OperationKind, PlannedOperation, ResourceOperationReceipt};
use super::discovery::hash_resource_directory;

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
        let _ = remove_if_exists(&staging);
        return Err(error);
    }
    let staged_hash = hash_resource_directory(&staging)?;
    if staged_hash != operation.expected_source_hash {
        remove_if_exists(&staging)?;
        return Err("staged resource did not match the approved source hash".into());
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

    if let Err(error) = move_with_verified_copy(
        &staging,
        destination,
        Some(&operation.expected_source_hash),
    ) {
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
        let _ = remove_if_exists(&staging);
        return Err(format!(
            "failed to promote staged resource to {}: {error}{recovery}",
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
    move_with_verified_copy(
        source,
        &quarantine,
        Some(&operation.expected_source_hash),
    )?;
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
    if fs::rename(source, destination).is_ok() {
        if let Some(expected) = expected_hash {
            let moved_hash = hash_resource_directory(destination)?;
            if moved_hash != expected {
                let _ = fs::rename(destination, source);
                return Err(format!(
                    "moved content failed verification: {}",
                    destination.display()
                ));
            }
        }
        return Ok(());
    }
    if let Err(error) = copy_resource(source, destination) {
        let _ = remove_if_exists(destination);
        return Err(error);
    }
    if let Some(expected) = expected_hash {
        let copied_hash = hash_resource_directory(destination)?;
        if copied_hash != expected {
            let _ = remove_if_exists(destination);
            return Err(format!(
                "copied quarantine content failed verification: {}",
                destination.display()
            ));
        }
    }
    remove_if_exists(source)
}

fn copy_resource(source: &Path, destination: &Path) -> Result<(), String> {
    copy_resource_at_depth(source, destination, 0)
}

fn copy_resource_at_depth(
    source: &Path,
    destination: &Path,
    depth: usize,
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
        fs::copy(source, destination).map_err(|error| {
            format!(
                "failed to copy {} to {}: {error}",
                source.display(),
                destination.display()
            )
        })?;
        return Ok(());
    }
    if !metadata.is_dir() {
        return Err(format!("unsupported resource type: {}", source.display()));
    }

    fs::create_dir_all(destination).map_err(|error| {
        format!(
            "failed to create staging directory {}: {error}",
            destination.display()
        )
    })?;
    for entry in fs::read_dir(source)
        .map_err(|error| format!("failed to read {}: {error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("failed to read directory entry: {error}"))?;
        let child_source = entry.path();
        let child_destination = destination.join(entry.file_name());
        let child_metadata = fs::symlink_metadata(&child_source)
            .map_err(|error| format!("failed to inspect {}: {error}", child_source.display()))?;
        if child_metadata.file_type().is_symlink() {
            return Err(format!(
                "nested symlinks are not copied automatically: {}",
                child_source.display()
            ));
        }
        if child_metadata.is_dir() {
            copy_resource_at_depth(&child_source, &child_destination, depth + 1)?;
        } else if child_metadata.is_file() {
            fs::copy(&child_source, &child_destination).map_err(|error| {
                format!(
                    "failed to copy {} to {}: {error}",
                    child_source.display(),
                    child_destination.display()
                )
            })?;
        }
    }
    fs::set_permissions(destination, metadata.permissions()).map_err(|error| {
        format!(
            "failed to preserve directory permissions for {}: {error}",
            destination.display()
        )
    })?;
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
        Ok(()) => format!(
            "; previous content restored from {}",
            quarantine.display()
        ),
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
    fn resource_hash_ignores_dot_prefixed_metadata() {
        let dir = tempfile::tempdir().expect("tempdir");
        fs::write(dir.path().join("SKILL.md"), "---\nname: example\n---\n# Example\n")
            .expect("write manifest");
        let before = hash_resource_directory(dir.path()).expect("hash before metadata");
        fs::write(dir.path().join(".DS_Store"), b"finder metadata").expect("write metadata");
        let after = hash_resource_directory(dir.path()).expect("hash after metadata");
        assert_eq!(before, after, "dot-prefixed metadata must not affect resource hashes");
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
            fs::metadata(&destination).expect("destination metadata").permissions().mode() & 0o777,
            0o555,
        );
        assert_eq!(
            fs::read_to_string(destination.join("SKILL.md")).expect("read copied child"),
            "# Example\n",
        );
    }
}
