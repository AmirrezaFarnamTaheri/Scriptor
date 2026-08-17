mod catalog;
mod discovery;
mod fs_ops;

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::AppState;
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
pub use catalog::{SupportLevel, TargetKind};
use discovery::{
    collect_inventory, current_home_dir, hash_resource_directory, resolve_root, target_by_id,
};

static PLAN_STORE: OnceLock<Mutex<HashMap<String, StoredPlan>>> = OnceLock::new();
const MAX_TARGETS_PER_PLAN: usize = 32;
const MAX_PARALLEL_OPERATIONS: usize = 8;
const MAX_STORED_PLANS: usize = 64;
const PLAN_TTL_MS: u64 = 10 * 60 * 1_000;
static APPLY_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum TargetStatus {
    Confirmed,
    Configured,
    Partial,
    Available,
    Conflicted,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ResourceEvidence {
    Executable {
        candidate: String,
        path: String,
        sha256: Option<String>,
        version: Option<String>,
        exit_code: i32,
    },
    Application {
        identity: String,
        path: String,
        sha256: String,
    },
    Extension {
        host: String,
        extension_id: String,
        path: String,
        version: Option<String>,
        sha256: Option<String>,
    },
    ConfigRoot {
        path: String,
        exists: bool,
        resource_count: usize,
    },
    ProbeSummary {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceInstallation {
    pub id: String,
    pub identity_kind: String,
    pub path: String,
    pub version: Option<String>,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceTarget {
    pub id: String,
    pub label: String,
    pub kind: TargetKind,
    pub support_level: SupportLevel,
    pub status: TargetStatus,
    pub evidence: Vec<ResourceEvidence>,
    pub installations: Vec<ResourceInstallation>,
    pub resource_roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceInstance {
    pub id: String,
    pub logical_id: String,
    pub name: String,
    pub kind: String,
    pub target_id: String,
    pub scope: String,
    pub path: String,
    pub manifest_path: String,
    pub content_hash: String,
    pub managed: bool,
    pub symlinked: bool,
    pub valid: bool,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DuplicateKind {
    ExactMirror,
    Redundant,
    Diverged,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub logical_id: String,
    pub kind: DuplicateKind,
    pub instance_ids: Vec<String>,
    pub target_ids: Vec<String>,
    pub automatic_removal_allowed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceInventory {
    pub generated_at_ms: u64,
    pub fingerprint: String,
    pub targets: Vec<ResourceTarget>,
    pub resources: Vec<ResourceInstance>,
    pub duplicates: Vec<DuplicateGroup>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResourcePlanRequest {
    pub source_instance_id: String,
    pub target_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationKind {
    Install,
    Update,
    Noop,
    QuarantineDuplicate,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedOperation {
    pub id: String,
    pub kind: OperationKind,
    pub target_id: String,
    pub source_path: String,
    pub destination_path: String,
    pub expected_source_hash: String,
    pub expected_destination_hash: Option<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSyncPlan {
    pub id: String,
    pub created_at_ms: u64,
    pub expires_at_ms: u64,
    pub inventory_fingerprint: String,
    pub source_instance_id: String,
    pub operations: Vec<PlannedOperation>,
    pub warnings: Vec<String>,
    pub plan_fingerprint: String,
}

#[derive(Debug, Clone)]
struct StoredPlan {
    plan: ResourceSyncPlan,
    expires_at_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceOperationReceipt {
    pub operation_id: String,
    pub target_id: String,
    pub outcome: String,
    pub destination_path: String,
    pub content_hash: String,
    pub quarantine_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceApplyFailure {
    pub operation_id: String,
    pub target_id: String,
    pub category: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceApplyResult {
    pub plan_id: String,
    pub status: String,
    pub receipts: Vec<ResourceOperationReceipt>,
    pub failures: Vec<ResourceApplyFailure>,
}

#[tauri::command]
pub async fn resource_inventory() -> Result<ResourceInventory, String> {
    tauri::async_runtime::spawn_blocking(collect_inventory)
        .await
        .map_err(|error| format!("resource inventory worker failed: {error}"))?
}

#[tauri::command]
pub async fn resource_create_plan(
    request: ResourcePlanRequest,
) -> Result<ResourceSyncPlan, String> {
    tauri::async_runtime::spawn_blocking(move || create_resource_plan(request))
        .await
        .map_err(|error| format!("resource plan worker failed: {error}"))?
}

fn create_resource_plan(request: ResourcePlanRequest) -> Result<ResourceSyncPlan, String> {
    validate_plan_request(&request)?;
    let inventory = collect_inventory()?;
    let source = inventory
        .resources
        .iter()
        .find(|resource| resource.id == request.source_instance_id)
        .ok_or_else(|| "the selected source resource is no longer present".to_string())?;
    if source.kind != "skill" || !source.valid {
        return Err("only valid skill directories can be synchronized automatically".into());
    }
    let source_path = Path::new(&source.path);
    let source_hash = hash_resource_directory(source_path)?;
    if source_hash != source.content_hash {
        return Err("the selected source changed during inventory; rescan before planning".into());
    }

    let home = current_home_dir()?;
    let target_map: HashMap<&str, &ResourceTarget> = inventory
        .targets
        .iter()
        .map(|target| (target.id.as_str(), target))
        .collect();
    let resource_name = safe_resource_name(source_path, &source.name)?;
    let mut operations = Vec::new();
    let mut warnings = Vec::new();
    let mut destination_owners = HashMap::<String, String>::new();

    for target_id in unique_target_ids(&request.target_ids) {
        let target = target_map
            .get(target_id.as_str())
            .ok_or_else(|| format!("unknown target: {target_id}"))?;
        let definition = target_by_id(&target_id)
            .ok_or_else(|| format!("target definition is unavailable: {target_id}"))?;
        if definition.support_level == SupportLevel::InventoryOnly {
            warnings.push(format!(
                "{} is inventory-only; no write operation was planned",
                target.label
            ));
            continue;
        }
        if target.id != "universal" && target.status != TargetStatus::Confirmed {
            warnings.push(format!(
                "{} is not identity-confirmed; no write operation was planned",
                target.label
            ));
            continue;
        }
        let Some(root) = resolve_root(&definition, &home) else {
            warnings.push(format!("{} has no writable resource root", target.label));
            continue;
        };
        let destination = root.join(&resource_name);
        let destination_key = normalized_destination_key(&destination);
        if let Some(owner) = destination_owners.get(&destination_key) {
            warnings.push(format!(
                "{} shares its physical resource destination with {}; one verified operation covers both targets",
                target.label, owner
            ));
            continue;
        }
        destination_owners.insert(destination_key, target.label.clone());
        let expected_destination_hash = if destination.exists() {
            Some(hash_resource_directory(&destination)?)
        } else {
            None
        };
        let kind = match expected_destination_hash.as_deref() {
            Some(hash) if hash == source_hash => OperationKind::Noop,
            Some(_) => OperationKind::Update,
            None => OperationKind::Install,
        };
        operations.push(PlannedOperation {
            id: Uuid::new_v4().to_string(),
            kind,
            target_id: target_id.clone(),
            source_path: source.path.clone(),
            destination_path: destination.display().to_string(),
            expected_source_hash: source_hash.clone(),
            expected_destination_hash,
            summary: operation_summary(kind, &source.name, &target.label),
        });
    }

    if operations.is_empty() {
        return Err("no safe target operations could be planned".into());
    }
    let plan_id = Uuid::new_v4().to_string();
    let created_at_ms = now_ms();
    let expires_at_ms = created_at_ms.saturating_add(PLAN_TTL_MS);
    let plan_fingerprint = fingerprint_plan(
        &plan_id,
        created_at_ms,
        expires_at_ms,
        &inventory.fingerprint,
        &source.id,
        &operations,
    );
    let plan = ResourceSyncPlan {
        id: plan_id.clone(),
        created_at_ms,
        expires_at_ms,
        inventory_fingerprint: inventory.fingerprint,
        source_instance_id: source.id.clone(),
        operations,
        warnings,
        plan_fingerprint,
    };
    store_plan(plan.clone());
    Ok(plan)
}

#[tauri::command]
pub async fn resource_create_dedup_plan(
    canonical_instance_id: String,
) -> Result<ResourceSyncPlan, String> {
    tauri::async_runtime::spawn_blocking(move || create_dedup_plan(canonical_instance_id))
        .await
        .map_err(|error| format!("resource deduplication worker failed: {error}"))?
}

fn create_dedup_plan(canonical_instance_id: String) -> Result<ResourceSyncPlan, String> {
    if canonical_instance_id.trim().is_empty() {
        return Err("canonicalInstanceId is required".into());
    }
    let inventory = collect_inventory()?;
    let canonical = inventory
        .resources
        .iter()
        .find(|resource| resource.id == canonical_instance_id)
        .ok_or_else(|| "the selected canonical resource is no longer present".to_string())?;
    let duplicates: Vec<_> = inventory
        .resources
        .iter()
        .filter(|resource| {
            resource.id != canonical.id
                && resource.logical_id == canonical.logical_id
                && resource.content_hash == canonical.content_hash
                && resource.target_id == canonical.target_id
                && resource.scope == canonical.scope
        })
        .collect();
    if duplicates.is_empty() {
        return Err("no redundant exact duplicates exist in the selected target and scope".into());
    }

    let operations: Vec<_> = duplicates
        .into_iter()
        .map(|duplicate| PlannedOperation {
            id: Uuid::new_v4().to_string(),
            kind: OperationKind::QuarantineDuplicate,
            target_id: duplicate.target_id.clone(),
            source_path: duplicate.path.clone(),
            destination_path: duplicate.path.clone(),
            expected_source_hash: duplicate.content_hash.clone(),
            expected_destination_hash: Some(duplicate.content_hash.clone()),
            summary: format!(
                "Quarantine redundant {} from {} scope",
                duplicate.name, duplicate.scope
            ),
        })
        .collect();
    let plan_id = Uuid::new_v4().to_string();
    let created_at_ms = now_ms();
    let expires_at_ms = created_at_ms.saturating_add(PLAN_TTL_MS);
    let plan = ResourceSyncPlan {
        id: plan_id.clone(),
        created_at_ms,
        expires_at_ms,
        inventory_fingerprint: inventory.fingerprint.clone(),
        source_instance_id: canonical.id.clone(),
        plan_fingerprint: fingerprint_plan(
            &plan_id,
            created_at_ms,
            expires_at_ms,
            &inventory.fingerprint,
            &canonical.id,
            &operations,
        ),
        operations,
        warnings: vec![
            "Duplicates are quarantined for recovery; they are not permanently deleted.".into(),
        ],
    };
    store_plan(plan.clone());
    Ok(plan)
}

#[tauri::command]
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
    let _apply_guard = lock_apply();
    let stored = take_plan(&plan_id)?;
    let plan = stored.plan;
    let current_inventory = collect_inventory()?;
    if current_inventory.fingerprint != plan.inventory_fingerprint {
        return Err(
            "resource inventory changed after plan approval; rescan and review a new plan".into(),
        );
    }
    validate_non_overlapping_operations(&plan.operations)?;
    for operation in &plan.operations {
        fs_ops::revalidate_operation(operation)?;
    }

    let concurrency = max_parallel.unwrap_or(3).clamp(1, MAX_PARALLEL_OPERATIONS);
    let mut receipts = Vec::new();
    let mut failures = Vec::new();
    for chunk in plan.operations.chunks(concurrency) {
        let workers: Vec<_> = chunk
            .iter()
            .cloned()
            .map(|operation| {
                let plan_id = plan.id.clone();
                std::thread::spawn(move || {
                    let result = fs_ops::apply_operation(&plan_id, &operation);
                    (operation, result)
                })
            })
            .collect();
        for worker in workers {
            match worker.join() {
                Ok((_operation, Ok(receipt))) => receipts.push(receipt),
                Ok((operation, Err(message))) => failures.push(ResourceApplyFailure {
                    operation_id: operation.id,
                    target_id: operation.target_id,
                    category: "filesystem_policy".into(),
                    message,
                }),
                Err(_) => failures.push(ResourceApplyFailure {
                    operation_id: "unknown".into(),
                    target_id: "unknown".into(),
                    category: "worker_failure".into(),
                    message: "a resource synchronization worker terminated unexpectedly".into(),
                }),
            }
        }
    }
    receipts.sort_by(|left, right| left.target_id.cmp(&right.target_id));
    failures.sort_by(|left, right| left.target_id.cmp(&right.target_id));
    let status = if failures.is_empty() {
        "completed"
    } else if receipts.is_empty() {
        "failed"
    } else {
        "partial"
    };
    Ok(ResourceApplyResult {
        plan_id: plan.id,
        status: status.into(),
        receipts,
        failures,
    })
}

fn validate_apply_request(plan_id: &str, authorization_token: &str) -> Result<(), String> {
    if plan_id.trim().is_empty() || plan_id.len() > 128 {
        return Err("planId must be non-empty and bounded".into());
    }
    if authorization_token.trim().is_empty() || authorization_token.len() > 4_096 {
        return Err("authorizationToken must be non-empty and bounded".into());
    }
    Ok(())
}

fn validate_plan_request(request: &ResourcePlanRequest) -> Result<(), String> {
    if request.source_instance_id.trim().is_empty() {
        return Err("sourceInstanceId is required".into());
    }
    if request.target_ids.is_empty() {
        return Err("select at least one target".into());
    }
    if request.target_ids.len() > MAX_TARGETS_PER_PLAN {
        return Err(format!(
            "a plan may target at most {MAX_TARGETS_PER_PLAN} installations"
        ));
    }
    if request
        .target_ids
        .iter()
        .any(|target| target.trim().is_empty() || target.len() > 80)
    {
        return Err("target IDs must be non-empty and bounded".into());
    }
    Ok(())
}

fn unique_target_ids(target_ids: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    target_ids
        .iter()
        .filter_map(|target| {
            let normalized = target.trim().to_string();
            seen.insert(normalized.clone()).then_some(normalized)
        })
        .collect()
}

fn safe_resource_name(source: &Path, fallback: &str) -> Result<String, String> {
    let candidate = if source.is_dir() {
        source.file_name().and_then(|value| value.to_str())
    } else {
        source.file_stem().and_then(|value| value.to_str())
    }
    .unwrap_or(fallback);
    let valid = !candidate.is_empty()
        && candidate.len() <= 64
        && candidate.split('-').all(|segment| {
            !segment.is_empty()
                && segment
                    .chars()
                    .all(|character| character.is_ascii_lowercase() || character.is_ascii_digit())
        });
    if !valid {
        return Err("resource name is not a safe lowercase hyphenated identifier".into());
    }
    Ok(candidate.to_string())
}

fn operation_summary(kind: OperationKind, resource: &str, target: &str) -> String {
    let verb = match kind {
        OperationKind::Install => "Install",
        OperationKind::Update => "Update",
        OperationKind::Noop => "Verify",
        OperationKind::QuarantineDuplicate => "Quarantine duplicate",
    };
    format!("{verb} {resource} for {target}")
}

fn fingerprint_plan(
    plan_id: &str,
    created_at_ms: u64,
    expires_at_ms: u64,
    inventory_fingerprint: &str,
    source_id: &str,
    operations: &[PlannedOperation],
) -> String {
    let mut material = format!(
        "{plan_id}\n{created_at_ms}\n{expires_at_ms}\n{inventory_fingerprint}\n{source_id}\n"
    );
    for operation in operations {
        material.push_str(&operation.id);
        material.push('\0');
        material.push_str(&format!("{:?}", operation.kind));
        material.push('\0');
        material.push_str(&operation.target_id);
        material.push('\0');
        material.push_str(&operation.source_path);
        material.push('\0');
        material.push_str(&operation.destination_path);
        material.push('\0');
        material.push_str(&operation.expected_source_hash);
        material.push('\0');
        material.push_str(
            operation
                .expected_destination_hash
                .as_deref()
                .unwrap_or("<absent>"),
        );
        material.push('\n');
    }
    hex::encode(Sha256::digest(material.as_bytes()))
}

fn normalized_destination_key(path: &Path) -> String {
    let resolved = path
        .parent()
        .and_then(|parent| std::fs::canonicalize(parent).ok())
        .and_then(|parent| path.file_name().map(|name| parent.join(name)))
        .unwrap_or_else(|| path.to_path_buf());
    let key = resolved.to_string_lossy().replace('\\', "/");
    if cfg!(windows) {
        key.to_ascii_lowercase()
    } else {
        key
    }
}

fn validate_non_overlapping_operations(operations: &[PlannedOperation]) -> Result<(), String> {
    let mut destinations = HashSet::new();
    for operation in operations {
        if operation.kind == OperationKind::QuarantineDuplicate {
            continue;
        }
        let key = normalized_destination_key(Path::new(&operation.destination_path));
        if !destinations.insert(key) {
            return Err("the approved plan contains overlapping physical destinations".into());
        }
    }
    Ok(())
}

fn store_plan(plan: ResourceSyncPlan) {
    let now = now_ms();
    let mut store = lock_plan_store();
    store.retain(|_, stored| stored.expires_at_ms > now);
    if store.len() >= MAX_STORED_PLANS
        && let Some(oldest_id) = store
            .iter()
            .min_by_key(|(_, stored)| stored.expires_at_ms)
            .map(|(id, _)| id.clone())
    {
        store.remove(&oldest_id);
    }
    store.insert(
        plan.id.clone(),
        StoredPlan {
            expires_at_ms: plan.expires_at_ms,
            plan,
        },
    );
}

fn take_plan(plan_id: &str) -> Result<StoredPlan, String> {
    let now = now_ms();
    let mut store = lock_plan_store();
    store.retain(|_, stored| stored.expires_at_ms > now);
    store
        .remove(plan_id)
        .ok_or_else(|| "the plan is missing, expired, or already consumed".to_string())
}

fn lock_apply() -> std::sync::MutexGuard<'static, ()> {
    let lock = APPLY_LOCK.get_or_init(|| Mutex::new(()));
    match lock.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            tracing::error!("recovering poisoned resource apply lock");
            lock.clear_poison();
            poisoned.into_inner()
        }
    }
}

fn lock_plan_store() -> std::sync::MutexGuard<'static, HashMap<String, StoredPlan>> {
    let store = PLAN_STORE.get_or_init(|| Mutex::new(HashMap::new()));
    match store.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            tracing::error!("recovering poisoned resource sync plan store");
            store.clear_poison();
            poisoned.into_inner()
        }
    }
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
    fn plan_target_ids_are_deduplicated_in_order() {
        let targets = vec!["codex".into(), "claude-code".into(), "codex".into()];
        assert_eq!(unique_target_ids(&targets), vec!["codex", "claude-code"]);
    }

    #[test]
    fn unsafe_resource_names_are_rejected() {
        assert!(safe_resource_name(Path::new("/"), "../").is_err());
        assert!(safe_resource_name(Path::new("/tmp/Code Review"), "code-review").is_err());
        assert_eq!(
            safe_resource_name(Path::new("/tmp/code-review"), "code-review").unwrap(),
            "code-review"
        );
    }

    #[test]
    fn overlapping_plan_destinations_are_rejected() {
        let operation = PlannedOperation {
            id: "one".into(),
            kind: OperationKind::Install,
            target_id: "vscode".into(),
            source_path: "/source/code-review".into(),
            destination_path: "/target/code-review".into(),
            expected_source_hash: "abc".into(),
            expected_destination_hash: None,
            summary: "install".into(),
        };
        assert!(validate_non_overlapping_operations(std::slice::from_ref(&operation)).is_ok());
        assert!(validate_non_overlapping_operations(&[operation.clone(), operation]).is_err());
    }

    #[test]
    fn plan_fingerprint_binds_destination_preconditions() {
        let operation = PlannedOperation {
            id: "one".into(),
            kind: OperationKind::Update,
            target_id: "codex".into(),
            source_path: "/source/code-review".into(),
            destination_path: "/target/code-review".into(),
            expected_source_hash: "source".into(),
            expected_destination_hash: Some("before".into()),
            summary: "update".into(),
        };
        let original = fingerprint_plan(
            "plan",
            1,
            2,
            "inventory",
            "source-id",
            std::slice::from_ref(&operation),
        );
        let mut changed = operation;
        changed.expected_destination_hash = Some("changed".into());
        let changed = fingerprint_plan("plan", 1, 2, "inventory", "source-id", &[changed]);
        assert_ne!(original, changed);
    }

    #[test]
    fn apply_request_requires_bounded_non_empty_values() {
        assert!(validate_apply_request("", "token").is_err());
        assert!(validate_apply_request("plan", "").is_err());
        assert!(validate_apply_request(&"p".repeat(129), "token").is_err());
        assert!(validate_apply_request("plan", &"t".repeat(4_097)).is_err());
        assert!(validate_apply_request("plan", "token").is_ok());
    }

    #[test]
    fn parallelism_is_bounded() {
        assert_eq!(
            usize::MAX.clamp(1, MAX_PARALLEL_OPERATIONS),
            MAX_PARALLEL_OPERATIONS
        );
    }
}
