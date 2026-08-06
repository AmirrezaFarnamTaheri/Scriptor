use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Deserialize;
use sha2::{Digest, Sha256};
use scriptor_system_bridge::{ProcessSpec, hash_file, run_process};

use super::catalog::{TargetDefinition, target_catalog};
use super::{
    DuplicateGroup, DuplicateKind, ResourceEvidence, ResourceInstallation, ResourceInstance,
    ResourceInventory, ResourceTarget, TargetStatus,
};

const VERSION_OUTPUT_LIMIT: usize = 16 * 1024;
const MAX_VERSION_LINE_CHARS: usize = 180;
const MAX_RESOURCE_FILES: usize = 2_048;
const MAX_RESOURCE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_EXTENSION_ENTRIES: usize = 8_192;
const MAX_PARALLEL_TARGET_PROBES: usize = 8;
const MAX_RESOURCE_SCAN_DEPTH: usize = 4;

pub fn collect_inventory() -> Result<ResourceInventory, String> {
    let home = home_dir()?;
    let definitions = target_catalog();
    let mut probed = Vec::with_capacity(definitions.len());

    for chunk in definitions.chunks(MAX_PARALLEL_TARGET_PROBES) {
        let workers: Vec<_> = chunk
            .iter()
            .cloned()
            .enumerate()
            .map(|(offset, definition)| {
                let home = home.clone();
                std::thread::spawn(move || {
                    let result = probe_target(&definition, &home);
                    (offset, result)
                })
            })
            .collect();
        let mut chunk_results = Vec::with_capacity(workers.len());
        for worker in workers {
            let result = worker
                .join()
                .map_err(|_| "a resource discovery worker terminated unexpectedly".to_string())?;
            chunk_results.push(result);
        }
        chunk_results.sort_by_key(|(offset, _)| *offset);
        probed.extend(chunk_results.into_iter().map(|(_, result)| result));
    }

    let mut targets = Vec::with_capacity(probed.len());
    let mut resources = Vec::new();
    for (target, mut found) in probed {
        targets.push(target);
        resources.append(&mut found);
    }

    resources.sort_by(|left, right| {
        left.logical_id
            .cmp(&right.logical_id)
            .then(left.target_id.cmp(&right.target_id))
            .then(left.path.cmp(&right.path))
    });
    resources.dedup_by(|left, right| left.id == right.id);
    let duplicates = duplicate_groups(&resources);
    let fingerprint = inventory_fingerprint(&targets, &resources);

    Ok(ResourceInventory {
        generated_at_ms: now_ms(),
        fingerprint,
        targets,
        resources,
        duplicates,
    })
}

pub fn target_by_id(id: &str) -> Option<TargetDefinition> {
    target_catalog().into_iter().find(|target| target.id == id)
}

pub fn resolve_root(definition: &TargetDefinition, home: &Path) -> Option<PathBuf> {
    definition
        .resource_roots
        .first()
        .map(|root| home.join(root.relative_path))
}

pub fn current_home_dir() -> Result<PathBuf, String> {
    home_dir()
}

fn probe_target(
    definition: &TargetDefinition,
    home: &Path,
) -> (ResourceTarget, Vec<ResourceInstance>) {
    let mut evidence = Vec::new();
    let mut installations = BTreeMap::<String, ResourceInstallation>::new();
    let mut failed_candidates = Vec::new();

    for candidate in definition.executable_candidates {
        let spec = ProcessSpec::new(*candidate)
            .args(definition.version_args.iter().copied())
            .timeout(Duration::from_secs(2))
            .max_output_bytes(VERSION_OUTPUT_LIMIT);
        match run_process(spec) {
            Ok(receipt) if receipt.exit_code == 0 => {
                let path = receipt.resolved_program.clone();
                let version = first_version_line(&receipt.stdout, &receipt.stderr);
                evidence.push(ResourceEvidence::Executable {
                    candidate: (*candidate).to_string(),
                    path: path.clone(),
                    sha256: receipt.program_sha256.clone(),
                    version: version.clone(),
                    exit_code: receipt.exit_code,
                });
                installations.entry(path.clone()).or_insert_with(|| {
                    installation(
                        definition.id,
                        "executable",
                        path,
                        version,
                        receipt.program_sha256,
                    )
                });
            }
            Ok(receipt) => failed_candidates.push(format!(
                "{candidate}: version probe exited with code {}",
                receipt.exit_code
            )),
            Err(error) => failed_candidates.push(format!("{candidate}: {error}")),
        }
    }

    for (identity, path) in platform_application_candidates(definition.id, home) {
        let Ok(canonical) = fs::canonicalize(&path) else {
            continue;
        };
        if !canonical.is_file() {
            continue;
        }
        let Ok(sha256) = hash_file(&canonical) else {
            continue;
        };
        let display = canonical.display().to_string();
        if installations.contains_key(&display) {
            continue;
        }
        evidence.push(ResourceEvidence::Application {
            identity: identity.clone(),
            path: display.clone(),
            sha256: sha256.clone(),
        });
        installations.insert(
            display.clone(),
            installation(
                definition.id,
                "application",
                display,
                None,
                Some(sha256),
            ),
        );
    }

    for extension in discover_extensions(definition.extension_ids, home) {
        evidence.push(ResourceEvidence::Extension {
            host: extension.host.clone(),
            extension_id: extension.extension_id.clone(),
            path: extension.path.clone(),
            version: extension.version.clone(),
            sha256: extension.sha256.clone(),
        });
        installations.entry(extension.path.clone()).or_insert_with(|| {
            installation(
                definition.id,
                "extension",
                extension.path,
                extension.version,
                extension.sha256,
            )
        });
    }

    let mut resources = Vec::new();
    let mut existing_roots = 0usize;
    for root in definition.resource_roots {
        let path = home.join(root.relative_path);
        let exists = path.is_dir();
        let mut root_resources = if exists {
            scan_resource_root(definition.id, root.scope, &path)
        } else {
            Vec::new()
        };
        if exists {
            existing_roots += 1;
        }
        evidence.push(ResourceEvidence::ConfigRoot {
            path: path.display().to_string(),
            exists,
            resource_count: root_resources.len(),
        });
        resources.append(&mut root_resources);
    }

    if !failed_candidates.is_empty() && !definition.executable_candidates.is_empty() {
        evidence.push(ResourceEvidence::ProbeSummary {
            message: format!(
                "{} executable candidate(s) were not confirmed",
                failed_candidates.len()
            ),
        });
    }

    let installations: Vec<_> = installations.into_values().collect();
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
    };

    (
        ResourceTarget {
            id: definition.id.to_string(),
            label: definition.label.to_string(),
            kind: definition.kind,
            support_level: definition.support_level,
            status,
            evidence,
            installations,
            resource_roots: definition
                .resource_roots
                .iter()
                .map(|root| home.join(root.relative_path).display().to_string())
                .collect(),
        },
        resources,
    )
}

fn installation(
    target_id: &str,
    identity_kind: &str,
    path: String,
    version: Option<String>,
    sha256: Option<String>,
) -> ResourceInstallation {
    let id = hash_bytes(
        format!(
            "{target_id}\0{identity_kind}\0{path}\0{}\0{}",
            version.as_deref().unwrap_or_default(),
            sha256.as_deref().unwrap_or_default()
        )
        .as_bytes(),
    );
    ResourceInstallation {
        id,
        identity_kind: identity_kind.to_string(),
        path,
        version,
        sha256,
    }
}

fn scan_resource_root(target_id: &str, scope: &str, root: &Path) -> Vec<ResourceInstance> {
    let mut resources = Vec::new();
    let mut visited = 0usize;
    scan_resource_directory(
        target_id,
        scope,
        root,
        root,
        0,
        &mut visited,
        &mut resources,
    );
    resources
}

#[allow(clippy::too_many_arguments)]
fn scan_resource_directory(
    target_id: &str,
    scope: &str,
    root: &Path,
    directory: &Path,
    depth: usize,
    visited: &mut usize,
    resources: &mut Vec<ResourceInstance>,
) {
    if depth > MAX_RESOURCE_SCAN_DEPTH || *visited >= MAX_RESOURCE_FILES {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        if *visited >= MAX_RESOURCE_FILES {
            break;
        }
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        *visited += 1;
        let path = entry.path();
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            continue;
        };
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            if let Some(manifest) = find_skill_manifest(&path) {
                if let Some(instance) = read_resource(target_id, scope, root, &manifest, "skill") {
                    resources.push(instance);
                }
            } else {
                scan_resource_directory(
                    target_id,
                    scope,
                    root,
                    &path,
                    depth + 1,
                    visited,
                    resources,
                );
            }
            continue;
        }
        if depth == 0 && metadata.is_file() && is_instruction_file(&path) {
            if let Some(instance) = read_resource(target_id, scope, root, &path, "instruction") {
                resources.push(instance);
            }
        }
    }
}

fn find_skill_manifest(directory: &Path) -> Option<PathBuf> {
    ["SKILL.md", "skill.md"]
        .into_iter()
        .map(|name| directory.join(name))
        .find(|path| path.is_file())
}

fn is_instruction_file(path: &Path) -> bool {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    matches!(extension.to_ascii_lowercase().as_str(), "md" | "mdc")
}

fn read_resource(
    target_id: &str,
    scope: &str,
    root: &Path,
    manifest: &Path,
    kind: &str,
) -> Option<ResourceInstance> {
    let bytes = fs::read(manifest).ok()?;
    let content = String::from_utf8_lossy(&bytes);
    let resource_path = if kind == "instruction" {
        manifest
    } else {
        manifest.parent().unwrap_or(manifest)
    };
    let mut issues = Vec::new();
    let content_hash = match hash_resource_directory(resource_path) {
        Ok(hash) => hash,
        Err(error) => {
            issues.push(format!("resource content could not be verified: {error}"));
            hash_file_material(
                manifest
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("resource"),
                &bytes,
            )
        }
    };
    let declared_skill_name = frontmatter_value(&content, "name");
    let name = declared_skill_name
        .clone()
        .or_else(|| frontmatter_value(&content, "title"))
        .unwrap_or_else(|| fallback_name(manifest));
    let normalized_name = normalize_identifier(&name);
    if normalized_name.is_empty() {
        return None;
    }
    let logical_id = format!("{kind}:{normalized_name}");
    let canonical = fs::canonicalize(resource_path).unwrap_or_else(|_| resource_path.to_path_buf());
    let canonical_manifest =
        fs::canonicalize(manifest).unwrap_or_else(|_| manifest.to_path_buf());
    let managed = is_agentstack_managed(resource_path, root, &content);
    if kind == "skill" {
        if declared_skill_name.is_none() {
            issues.push("SKILL.md is missing a name field".to_string());
        }
        if frontmatter_value(&content, "description").is_none() {
            issues.push("SKILL.md is missing a description field".to_string());
        }
        if manifest.file_name().and_then(|value| value.to_str()) != Some("SKILL.md") {
            issues.push("skill manifest should use the canonical SKILL.md filename".to_string());
        }
        if !is_valid_skill_name(&name) {
            issues.push("skill name is not a valid lowercase hyphenated identifier".to_string());
        }
        let directory_name = resource_path
            .file_name()
            .and_then(|value| value.to_str());
        if directory_name != Some(normalized_name.as_str()) {
            issues.push("skill name does not match its parent directory".to_string());
        }
    } else if normalize_content(&content).is_empty() {
        issues.push("instruction file is empty".to_string());
    }
    let id = hash_bytes(
        format!(
            "{target_id}\0{scope}\0{}\0{content_hash}",
            canonical.display()
        )
        .as_bytes(),
    );

    Some(ResourceInstance {
        id,
        logical_id,
        name,
        kind: kind.to_string(),
        target_id: target_id.to_string(),
        scope: scope.to_string(),
        path: canonical.display().to_string(),
        manifest_path: canonical_manifest.display().to_string(),
        content_hash,
        managed,
        symlinked: false,
        valid: issues.is_empty(),
        issues,
    })
}

fn is_agentstack_managed(path: &Path, root: &Path, content: &str) -> bool {
    let normalized = content.to_ascii_lowercase();
    if normalized.contains("agentstack://") || normalized.contains("managed-by: agentstack") {
        return true;
    }
    let markers = [
        ".agentstack-managed.json",
        "agentstack.lock",
        "agentstack.json",
        ".agentstack.json",
    ];
    let mut cursor = Some(path);
    while let Some(current) = cursor {
        if markers.iter().any(|marker| current.join(marker).is_file()) {
            return true;
        }
        if current == root {
            break;
        }
        cursor = current.parent();
    }
    false
}

fn duplicate_groups(resources: &[ResourceInstance]) -> Vec<DuplicateGroup> {
    let mut by_logical = BTreeMap::<String, Vec<&ResourceInstance>>::new();
    for resource in resources {
        by_logical
            .entry(resource.logical_id.clone())
            .or_default()
            .push(resource);
    }

    let mut groups = Vec::new();
    for (logical_id, instances) in by_logical {
        if instances.len() < 2 {
            continue;
        }
        let mut by_hash = BTreeMap::<&str, Vec<&ResourceInstance>>::new();
        for instance in &instances {
            by_hash
                .entry(instance.content_hash.as_str())
                .or_default()
                .push(*instance);
        }
        if by_hash.len() > 1 {
            groups.push(duplicate_group(
                &logical_id,
                DuplicateKind::Diverged,
                &instances,
            ));
        }
        for hash_instances in by_hash.into_values() {
            if hash_instances.len() < 2 {
                continue;
            }
            let mut by_location = BTreeMap::<(&str, &str), Vec<&ResourceInstance>>::new();
            for instance in &hash_instances {
                by_location
                    .entry((instance.target_id.as_str(), instance.scope.as_str()))
                    .or_default()
                    .push(*instance);
            }
            let has_cross_location_mirror = by_location.len() > 1;
            if has_cross_location_mirror {
                groups.push(duplicate_group(
                    &logical_id,
                    DuplicateKind::ExactMirror,
                    &hash_instances,
                ));
            }
            for location_instances in by_location.into_values() {
                if location_instances.len() > 1 {
                    groups.push(duplicate_group(
                        &logical_id,
                        DuplicateKind::Redundant,
                        &location_instances,
                    ));
                }
            }
        }
    }
    groups.sort_by(|left, right| {
        left.logical_id
            .cmp(&right.logical_id)
            .then(left.kind.cmp(&right.kind))
            .then(left.instance_ids.cmp(&right.instance_ids))
    });
    groups
}

fn duplicate_group(
    logical_id: &str,
    kind: DuplicateKind,
    instances: &[&ResourceInstance],
) -> DuplicateGroup {
    let target_ids: BTreeSet<_> = instances
        .iter()
        .map(|instance| instance.target_id.clone())
        .collect();
    DuplicateGroup {
        logical_id: logical_id.to_string(),
        kind,
        instance_ids: instances
            .iter()
            .map(|instance| instance.id.clone())
            .collect(),
        target_ids: target_ids.into_iter().collect(),
        automatic_removal_allowed: false,
    }
}

pub fn hash_resource_directory(path: &Path) -> Result<String, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("failed to inspect {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "resource roots may not be symlinks: {}",
            path.display()
        ));
    }
    if metadata.is_file() {
        let bytes = fs::read(path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        return Ok(hash_file_material(
            path.file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("resource"),
            &bytes,
        ));
    }
    if !metadata.is_dir() {
        return Err(format!("unsupported resource type: {}", path.display()));
    }

    let mut files = Vec::new();
    let mut total_bytes = 0u64;
    collect_resource_files(path, path, 0, &mut files, &mut total_bytes)?;
    files.sort_by(|left, right| left.0.cmp(&right.0));
    if files.is_empty()
        || !files.iter().any(|(relative, _)| {
            let normalized = relative.to_ascii_lowercase();
            normalized == "skill.md" || normalized.ends_with("/skill.md")
        })
    {
        return Err(format!("resource manifest not found: {}", path.display()));
    }

    let mut hasher = Sha256::new();
    for (relative, bytes) in files {
        hasher.update(relative.as_bytes());
        hasher.update([0]);
        hasher.update((bytes.len() as u64).to_le_bytes());
        hasher.update([0]);
        if let Ok(text) = std::str::from_utf8(&bytes) {
            hasher.update(normalize_content(text).as_bytes());
        } else {
            hasher.update(&bytes);
        }
        hasher.update([0xff]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn collect_resource_files(
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
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("failed to read {}: {error}", directory.display()))?
    {
        let entry = entry.map_err(|error| format!("failed to read directory entry: {error}"))?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("failed to inspect {}: {error}", path.display()))?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "nested symlinks are not trusted resource content: {}",
                path.display()
            ));
        }
        if metadata.is_dir() {
            collect_resource_files(root, &path, depth + 1, files, total_bytes)?;
            continue;
        }
        if !metadata.is_file() {
            continue;
        }
        if files.len() >= MAX_RESOURCE_FILES {
            return Err(format!(
                "resource exceeds {MAX_RESOURCE_FILES} files: {}",
                root.display()
            ));
        }
        if metadata.len() > MAX_RESOURCE_BYTES {
            return Err(format!(
                "resource file exceeds the size limit: {}",
                path.display()
            ));
        }
        *total_bytes = total_bytes.saturating_add(metadata.len());
        if *total_bytes > MAX_RESOURCE_BYTES {
            return Err(format!(
                "resource exceeds the total size limit: {}",
                root.display()
            ));
        }
        let relative = path
            .strip_prefix(root)
            .map_err(|_| format!("resource file escaped its root: {}", path.display()))?
            .to_string_lossy()
            .replace('\\', "/");
        let bytes = fs::read(&path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        files.push((relative, bytes));
    }
    Ok(())
}

fn hash_file_material(name: &str, bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(name.as_bytes());
    hasher.update([0]);
    if let Ok(text) = std::str::from_utf8(bytes) {
        hasher.update(normalize_content(text).as_bytes());
    } else {
        hasher.update(bytes);
    }
    hex::encode(hasher.finalize())
}

pub fn normalize_content(content: &str) -> String {
    content
        .replace("\r\n", "\n")
        .lines()
        .map(str::trim_end)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn frontmatter_value(content: &str, key: &str) -> Option<String> {
    let mut lines = content.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    for line in lines.take(80) {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        let Some((candidate, value)) = trimmed.split_once(':') else {
            continue;
        };
        if candidate.trim().eq_ignore_ascii_case(key) {
            let value = value.trim().trim_matches(['\'', '"']);
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn fallback_name(path: &Path) -> String {
    path.parent()
        .and_then(Path::file_name)
        .or_else(|| path.file_stem())
        .and_then(|value| value.to_str())
        .unwrap_or("unnamed-resource")
        .to_string()
}

fn normalize_identifier(value: &str) -> String {
    let mut normalized = String::new();
    let mut previous_dash = false;
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            normalized.push(character.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            normalized.push('-');
            previous_dash = true;
        }
    }
    normalized.trim_matches('-').to_string()
}

fn is_valid_skill_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .split('-')
            .all(|segment| !segment.is_empty() && segment.chars().all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit()))
}

fn first_version_line(stdout: &str, stderr: &str) -> Option<String> {
    stdout
        .lines()
        .chain(stderr.lines())
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.chars().take(MAX_VERSION_LINE_CHARS).collect())
}

fn inventory_fingerprint(targets: &[ResourceTarget], resources: &[ResourceInstance]) -> String {
    let mut material = String::new();
    for target in targets {
        material.push_str(&target.id);
        material.push(':');
        material.push_str(&format!("{:?}", target.status));
        material.push(':');
        for installation in &target.installations {
            material.push_str(&installation.id);
            material.push(',');
        }
        material.push('\n');
    }
    for resource in resources {
        material.push_str(&resource.id);
        material.push(':');
        material.push_str(&resource.content_hash);
        material.push(':');
        material.push_str(if resource.valid { "valid" } else { "invalid" });
        material.push('\n');
    }
    hash_bytes(material.as_bytes())
}

fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex::encode(digest)
}

fn home_dir() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "could not resolve the user home directory".to_string())
}

#[derive(Debug)]
struct DiscoveredExtension {
    host: String,
    extension_id: String,
    path: String,
    version: Option<String>,
    sha256: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ExtensionPackage {
    name: Option<String>,
    publisher: Option<String>,
    version: Option<String>,
}

fn discover_extensions(extension_ids: &[&str], home: &Path) -> Vec<DiscoveredExtension> {
    if extension_ids.is_empty() {
        return Vec::new();
    }
    let expected: BTreeSet<_> = extension_ids
        .iter()
        .map(|value| value.to_ascii_lowercase())
        .collect();
    let mut found = BTreeMap::<String, DiscoveredExtension>::new();
    for (host, root) in extension_search_roots(home) {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };
        for entry in entries.flatten().take(MAX_EXTENSION_ENTRIES) {
            let path = entry.path();
            let Ok(path_metadata) = fs::symlink_metadata(&path) else {
                continue;
            };
            if path_metadata.file_type().is_symlink() || !path_metadata.is_dir() {
                continue;
            }
            let canonical = match fs::canonicalize(&path) {
                Ok(canonical) => canonical,
                Err(_) => continue,
            };
            let package_path = canonical.join("package.json");
            let Ok(metadata) = fs::metadata(&package_path) else {
                continue;
            };
            if metadata.len() > 2 * 1024 * 1024 {
                continue;
            }
            let Ok(body) = fs::read_to_string(&package_path) else {
                continue;
            };
            let Ok(package) = serde_json::from_str::<ExtensionPackage>(&body) else {
                continue;
            };
            let Some(name) = package.name.as_deref() else {
                continue;
            };
            let Some(publisher) = package.publisher.as_deref() else {
                continue;
            };
            let extension_id = format!("{publisher}.{name}").to_ascii_lowercase();
            if !expected.contains(&extension_id) {
                continue;
            }
            let display = canonical.display().to_string();
            let sha256 = hash_file(&package_path).ok();
            found.insert(
                format!("{host}\0{display}"),
                DiscoveredExtension {
                    host: host.to_string(),
                    extension_id,
                    path: display,
                    version: package.version,
                    sha256,
                },
            );
        }
    }
    found.into_values().collect()
}

fn extension_search_roots(home: &Path) -> Vec<(&'static str, PathBuf)> {
    vec![
        ("Visual Studio Code", home.join(".vscode/extensions")),
        ("Visual Studio Code Insiders", home.join(".vscode-insiders/extensions")),
        ("Cursor", home.join(".cursor/extensions")),
        ("Windsurf", home.join(".windsurf/extensions")),
        ("Trae", home.join(".trae/extensions")),
        ("Antigravity", home.join(".antigravity/extensions")),
    ]
}

fn platform_application_candidates(target_id: &str, home: &Path) -> Vec<(String, PathBuf)> {
    let mut candidates = Vec::new();
    #[cfg(target_os = "macos")]
    {
        let paths: &[(&str, &str, &str)] = &[
            ("vscode", "visual-studio-code-app", "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"),
            ("cursor", "cursor-app", "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"),
            ("windsurf", "windsurf-app", "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf"),
            ("zed", "zed-app", "/Applications/Zed.app/Contents/MacOS/zed"),
            ("kiro", "kiro-app", "/Applications/Kiro.app/Contents/Resources/app/bin/kiro"),
        ];
        for (id, identity, path) in paths {
            if *id == target_id {
                candidates.push(((*identity).to_string(), PathBuf::from(path)));
            }
        }
    }
    #[cfg(windows)]
    {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) {
            let paths: &[(&str, &str, &str)] = &[
                ("vscode", "Microsoft.VisualStudioCode", "Programs/Microsoft VS Code/Code.exe"),
                ("cursor", "Cursor", "Programs/cursor/Cursor.exe"),
                ("windsurf", "Windsurf", "Programs/Windsurf/Windsurf.exe"),
                ("kiro", "Kiro", "Programs/Kiro/Kiro.exe"),
            ];
            for (id, identity, relative) in paths {
                if *id == target_id {
                    candidates.push(((*identity).to_string(), local_app_data.join(relative)));
                }
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        let paths: &[(&str, &str, &str)] = &[
            ("vscode", "visual-studio-code", "/usr/share/code/bin/code"),
            ("cursor", "cursor", "/opt/Cursor/cursor"),
            ("windsurf", "windsurf", "/opt/windsurf/windsurf"),
            ("zed", "zed", "/usr/bin/zed"),
            ("kiro", "kiro", "/opt/kiro/kiro"),
        ];
        for (id, identity, path) in paths {
            if *id == target_id {
                candidates.push(((*identity).to_string(), PathBuf::from(path)));
            }
        }
    }
    let _ = home;
    candidates
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_line_endings_and_trailing_space() {
        assert_eq!(normalize_content("a  \r\nb\r\n"), "a\nb");
    }

    #[test]
    fn parses_frontmatter_name_without_promoting_body_fields() {
        let content = "---\nname: code-review\n---\nname: ignored";
        assert_eq!(
            frontmatter_value(content, "name").as_deref(),
            Some("code-review")
        );
    }

    #[test]
    fn config_only_targets_are_never_confirmed() {
        assert_ne!(TargetStatus::Configured, TargetStatus::Confirmed);
        assert_ne!(TargetStatus::Partial, TargetStatus::Confirmed);
    }

    #[test]
    fn skill_names_require_lowercase_hyphenated_segments() {
        assert!(is_valid_skill_name("code-review"));
        assert!(!is_valid_skill_name("Code Review"));
        assert!(!is_valid_skill_name("code--review"));
    }

    #[test]
    fn duplicate_analysis_preserves_mirrors_redundancy_and_divergence() {
        let resources = vec![
            test_resource("a", "codex", "user", "same"),
            test_resource("b", "codex", "user", "same"),
            test_resource("c", "claude-code", "user", "same"),
            test_resource("d", "gemini-cli", "user", "different"),
        ];
        let groups = duplicate_groups(&resources);
        assert!(groups.iter().any(|group| {
            group.kind == DuplicateKind::Redundant && group.instance_ids == vec!["a", "b"]
        }));
        assert!(groups.iter().any(|group| group.kind == DuplicateKind::ExactMirror));
        assert!(groups.iter().any(|group| group.kind == DuplicateKind::Diverged));
        assert!(groups.iter().all(|group| !group.automatic_removal_allowed));
    }

    fn test_resource(id: &str, target_id: &str, scope: &str, hash: &str) -> ResourceInstance {
        ResourceInstance {
            id: id.into(),
            logical_id: "skill:code-review".into(),
            name: "code-review".into(),
            kind: "skill".into(),
            target_id: target_id.into(),
            scope: scope.into(),
            path: format!("/{target_id}/{id}"),
            manifest_path: format!("/{target_id}/{id}/SKILL.md"),
            content_hash: hash.into(),
            managed: true,
            symlinked: false,
            valid: true,
            issues: Vec::new(),
        }
    }
}
