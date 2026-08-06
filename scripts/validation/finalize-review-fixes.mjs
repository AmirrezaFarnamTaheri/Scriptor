import fs from 'node:fs'

function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText)
  if (first < 0) throw new Error(`${label}: expected source text not found`)
  if (source.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`${label}: expected source text was not unique`)
  }
  return source.slice(0, first) + newText + source.slice(first + oldText.length)
}

function patchPanel(source) {
  source = replaceOnce(
    source,
    '        return preserved.size > 0 ? preserved : valid\n',
    '        return preserved\n',
    'safe target defaults',
  )
  source = replaceOnce(
    source,
    `                      <label title={canReceive ? 'Include in the next reviewed plan' : 'This target is inventory-only or not confirmed'}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={!canReceive}
                          onChange={() => toggleTarget(target.id)}
                        />
                        Sync
                      </label>`,
    `                      <label>
                        <input
                          type="checkbox"
                          aria-label={\`Sync \${target.label}\`}
                          checked={selected}
                          disabled={!canReceive}
                          onChange={() => toggleTarget(target.id)}
                        />
                        <span aria-hidden="true">Sync</span>
                      </label>`,
    'target checkbox accessible name',
  )
  return source
}

function patchCommands(source) {
  source = replaceOnce(
    source,
    `#[tauri::command]
pub fn resource_inventory() -> Result<ResourceInventory, String> {
    collect_inventory()
}`,
    `#[tauri::command]
pub async fn resource_inventory() -> Result<ResourceInventory, String> {
    tauri::async_runtime::spawn_blocking(collect_inventory)
        .await
        .map_err(|error| format!("resource inventory worker failed: {error}"))?
}`,
    'async inventory command',
  )
  source = replaceOnce(
    source,
    `#[tauri::command]
pub fn resource_create_plan(request: ResourcePlanRequest) -> Result<ResourceSyncPlan, String> {`,
    `#[tauri::command]
pub async fn resource_create_plan(
    request: ResourcePlanRequest,
) -> Result<ResourceSyncPlan, String> {
    tauri::async_runtime::spawn_blocking(move || create_resource_plan(request))
        .await
        .map_err(|error| format!("resource plan worker failed: {error}"))?
}

fn create_resource_plan(request: ResourcePlanRequest) -> Result<ResourceSyncPlan, String> {`,
    'async create plan command',
  )
  source = replaceOnce(
    source,
    `#[tauri::command]
pub fn resource_create_dedup_plan(
    canonical_instance_id: String,
) -> Result<ResourceSyncPlan, String> {`,
    `#[tauri::command]
pub async fn resource_create_dedup_plan(
    canonical_instance_id: String,
) -> Result<ResourceSyncPlan, String> {
    tauri::async_runtime::spawn_blocking(move || create_dedup_plan(canonical_instance_id))
        .await
        .map_err(|error| format!("resource deduplication worker failed: {error}"))?
}

fn create_dedup_plan(canonical_instance_id: String) -> Result<ResourceSyncPlan, String> {`,
    'async dedup plan command',
  )
  source = replaceOnce(
    source,
    `#[tauri::command]
pub fn resource_apply_plan(
    state: tauri::State<AppState>,
    plan_id: String,
    authorization_token: String,
    max_parallel: Option<usize>,
) -> Result<ResourceApplyResult, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ResourceSync,
        Some(&plan_id),
    )?;
    let _apply_guard = lock_apply();`,
    `#[tauri::command]
pub async fn resource_apply_plan(
    state: tauri::State<'_, AppState>,
    plan_id: String,
    authorization_token: String,
    max_parallel: Option<usize>,
) -> Result<ResourceApplyResult, String> {
    validate_apply_request(&plan_id, &authorization_token)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ResourceSync,
        Some(&plan_id),
    )?;
    tauri::async_runtime::spawn_blocking(move || apply_resource_plan(plan_id, max_parallel))
        .await
        .map_err(|error| format!("resource apply worker failed: {error}"))?
}

fn apply_resource_plan(
    plan_id: String,
    max_parallel: Option<usize>,
) -> Result<ResourceApplyResult, String> {
    let _apply_guard = lock_apply();`,
    'async apply command',
  )
  source = replaceOnce(
    source,
    'fn validate_plan_request(request: &ResourcePlanRequest) -> Result<(), String> {',
    `fn validate_apply_request(plan_id: &str, authorization_token: &str) -> Result<(), String> {
    if plan_id.trim().is_empty() || plan_id.len() > 128 {
        return Err("planId must be non-empty and bounded".into());
    }
    if authorization_token.trim().is_empty() || authorization_token.len() > 4_096 {
        return Err("authorizationToken must be non-empty and bounded".into());
    }
    Ok(())
}

fn validate_plan_request(request: &ResourcePlanRequest) -> Result<(), String> {`,
    'apply request validation',
  )
  source = replaceOnce(
    source,
    `    #[test]
    fn parallelism_is_bounded() {
        assert_eq!(usize::MAX.clamp(1, MAX_PARALLEL_OPERATIONS), MAX_PARALLEL_OPERATIONS);
    }`,
    `    #[test]
    fn apply_request_requires_bounded_non_empty_values() {
        assert!(validate_apply_request("", "token").is_err());
        assert!(validate_apply_request("plan", "").is_err());
        assert!(validate_apply_request(&"p".repeat(129), "token").is_err());
        assert!(validate_apply_request("plan", &"t".repeat(4_097)).is_err());
        assert!(validate_apply_request("plan", "token").is_ok());
    }

    #[test]
    fn parallelism_is_bounded() {
        assert_eq!(usize::MAX.clamp(1, MAX_PARALLEL_OPERATIONS), MAX_PARALLEL_OPERATIONS);
    }`,
    'apply validation test',
  )
  return source
}

function patchDiscovery(source) {
  source = replaceOnce(
    source,
    `    let installations: Vec<_> = installations.into_values().collect();
    let status = if !installations.is_empty() {
        TargetStatus::Confirmed
    } else if !resources.is_empty() {
        TargetStatus::Configured
    } else if existing_roots > 0 {
        TargetStatus::Partial
    } else {
        TargetStatus::Available
    };`,
    `    let installations: Vec<_> = installations.into_values().collect();
    let has_identity_hash = installations.iter().any(|installation| {
        installation
            .sha256
            .as_deref()
            .is_some_and(|hash| !hash.trim().is_empty())
    });
    let status = if has_identity_hash {
        TargetStatus::Confirmed
    } else if !resources.is_empty() {
        TargetStatus::Configured
    } else if !installations.is_empty() || existing_roots > 0 {
        TargetStatus::Partial
    } else {
        TargetStatus::Available
    };`,
    'identity hash confirmation',
  )
  source = replaceOnce(
    source,
    `    for entry in entries.flatten() {
        if *visited >= MAX_RESOURCE_FILES {
            break;
        }
        *visited += 1;
        let path = entry.path();`,
    `    for entry in entries.flatten() {
        if *visited >= MAX_RESOURCE_FILES {
            break;
        }
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        *visited += 1;
        let path = entry.path();`,
    'hidden resource exclusion',
  )
  source = replaceOnce(
    source,
    '    collect_resource_files(path, path, &mut files, &mut total_bytes)?;',
    '    collect_resource_files(path, path, 0, &mut files, &mut total_bytes)?;',
    'bounded hash traversal root',
  )
  source = replaceOnce(
    source,
    `fn collect_resource_files(
    root: &Path,
    directory: &Path,
    files: &mut Vec<(String, Vec<u8>)>,
    total_bytes: &mut u64,
) -> Result<(), String> {
    for entry in fs::read_dir(directory)`,
    `fn collect_resource_files(
    root: &Path,
    directory: &Path,
    depth: usize,
    files: &mut Vec<(String, Vec<u8>)>,
    total_bytes: &mut u64,
) -> Result<(), String> {
    if depth > MAX_RESOURCE_SCAN_DEPTH {
        return Err(format!(
            "resource exceeds the maximum nesting depth: {}",
            root.display()
        ));
    }
    for entry in fs::read_dir(directory)`,
    'bounded hash traversal signature',
  )
  source = replaceOnce(
    source,
    '            collect_resource_files(root, &path, files, total_bytes)?;',
    '            collect_resource_files(root, &path, depth + 1, files, total_bytes)?;',
    'bounded hash traversal recursion',
  )
  return source
}

function patchFsOps(source) {
  source = replaceOnce(
    source,
    `use std::fs;
use std::path::{Path, PathBuf};`,
    `use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[cfg(windows)]
use std::os::windows::fs::FileTypeExt;`,
    'filesystem imports',
  )
  source = replaceOnce(
    source,
    'use super::discovery::hash_resource_directory;',
    'use super::discovery::hash_resource_directory;\n\nconst MAX_RESOURCE_COPY_DEPTH: usize = 4;',
    'copy depth constant',
  )
  source = replaceOnce(
    source,
    `    let staging = parent.join(format!(
        ".scriptor-staging-{}",
        operation.id.replace('-', "")
    ));
    remove_if_exists(&staging)?;`,
    `    let staging = staging_path(plan_id, operation)?;
    if let Some(staging_parent) = staging.parent() {
        fs::create_dir_all(staging_parent).map_err(|error| {
            format!(
                "failed to create staging directory {}: {error}",
                staging_parent.display()
            )
        })?;
    }
    remove_if_exists(&staging)?;`,
    'external staging path',
  )
  source = replaceOnce(
    source,
    `    if let Err(error) = fs::rename(&staging, destination) {
        let _ = remove_if_exists(&staging);
        if let Some(quarantine) = &quarantine {
            let _ = move_with_verified_copy(
                quarantine,
                destination,
                operation.expected_destination_hash.as_deref(),
            );
        }
        return Err(format!(
            "failed to promote staged resource to {}: {error}",
            destination.display()
        ));
    }`,
    `    if let Err(error) = move_with_verified_copy(
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
    }`,
    'cross-filesystem promotion',
  )
  source = replaceOnce(
    source,
    `    if final_hash != operation.expected_source_hash {
        let _ = remove_if_exists(destination);
        if let Some(quarantine) = &quarantine {
            let _ = move_with_verified_copy(
                quarantine,
                destination,
                operation.expected_destination_hash.as_deref(),
            );
        }
        return Err("installed resource failed post-write hash verification".into());
    }`,
    `    if final_hash != operation.expected_source_hash {
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
    }`,
    'rollback failure reporting',
  )
  source = replaceOnce(
    source,
    `fn copy_resource(source: &Path, destination: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source)`,
    `fn copy_resource(source: &Path, destination: &Path) -> Result<(), String> {
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
    let metadata = fs::symlink_metadata(source)`,
    'bounded copy traversal',
  )
  source = replaceOnce(
    source,
    `    fs::create_dir_all(destination).map_err(|error| {
        format!(
            "failed to create staging directory {}: {error}",
            destination.display()
        )
    })?;`,
    `    fs::create_dir_all(destination).map_err(|error| {
        format!(
            "failed to create staging directory {}: {error}",
            destination.display()
        )
    })?;
    fs::set_permissions(destination, metadata.permissions()).map_err(|error| {
        format!(
            "failed to preserve directory permissions for {}: {error}",
            destination.display()
        )
    })?;`,
    'directory permission preservation',
  )
  source = replaceOnce(
    source,
    '            copy_resource(&child_source, &child_destination)?;',
    '            copy_resource_at_depth(&child_source, &child_destination, depth + 1)?;',
    'bounded copy recursion',
  )
  source = replaceOnce(
    source,
    'fn quarantine_path(plan_id: &str, operation: &PlannedOperation) -> Result<PathBuf, String> {',
    `fn staging_path(plan_id: &str, operation: &PlannedOperation) -> Result<PathBuf, String> {
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

fn quarantine_path(plan_id: &str, operation: &PlannedOperation) -> Result<PathBuf, String> {`,
    'staging and recovery helpers',
  )
  const removeStart = source.indexOf('fn remove_if_exists(path: &Path) -> Result<(), String> {')
  const receiptStart = source.indexOf('\nfn receipt(\n', removeStart)
  if (removeStart < 0 || receiptStart < 0) throw new Error('remove_if_exists block not found')
  const replacement = `fn remove_if_exists(path: &Path) -> Result<(), String> {
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
`
  source = source.slice(0, removeStart) + replacement + source.slice(receiptStart)
  return source
}

const patches = new Map([
  ['src/components/ResourceSyncPanel.tsx', patchPanel],
  ['apps/desktop/src-tauri/src/commands/resources/mod.rs', patchCommands],
  ['apps/desktop/src-tauri/src/commands/resources/discovery.rs', patchDiscovery],
  ['apps/desktop/src-tauri/src/commands/resources/fs_ops.rs', patchFsOps],
])

for (const [file, patch] of patches) {
  const original = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
  const updated = patch(original)
  if (updated === original) throw new Error(`${file}: patch was a no-op`)
  fs.writeFileSync(file, updated)
}
