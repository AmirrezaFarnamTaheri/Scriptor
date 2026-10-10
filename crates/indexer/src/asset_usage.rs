//! Bounded asset inventory and usage derived from the existing link index.
use crate::{IndexCache, IndexerError};
use scriptor_vault::{ScannedEntryKind, VaultSession, scan_vault};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, serde::Serialize)]
pub struct AssetUsage {
    pub path: String,
    pub bytes: u64,
    pub used_by: Vec<String>,
}
#[derive(Debug, serde::Serialize)]
pub struct AssetUsageReport {
    pub assets: Vec<AssetUsage>,
    pub truncated: bool,
    pub source: &'static str,
}

pub fn list_asset_usage(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<AssetUsageReport, IndexerError> {
    let entries = scan_vault(&session.root)?;
    let mut assets = BTreeMap::new();
    let mut truncated = false;
    for entry in entries
        .into_iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Asset)
    {
        if assets.len() >= 10_000 {
            truncated = true;
            break;
        }
        assets.insert(entry.path.clone(), (entry.size_bytes, BTreeSet::new()));
    }
    let connection = cache.connection()?;
    let mut statement = connection.prepare("SELECT substr(n.path,1,2048), substr(l.to_path,1,2048), length(n.path), length(l.to_path) FROM links l JOIN notes n ON n.id=l.from_note_id WHERE l.vault_id=?1 AND n.vault_id=?1 AND l.kind='asset' ORDER BY n.path,l.to_path LIMIT 100001")?;
    let mut rows = statement.query([&session.descriptor.id])?;
    let mut count = 0usize;
    let mut bytes = 0usize;
    while let Some(row) = rows.next()? {
        let path: String = row.get(0)?;
        let target: String = row.get(1)?;
        count += 1;
        bytes += path.len() + target.len();
        if count > 100_000 || bytes > 8 * 1024 * 1024 {
            truncated = true;
            break;
        }
        if row.get::<_, i64>(2)? > 2048 || row.get::<_, i64>(3)? > 2048 {
            truncated = true;
            continue;
        }
        let normalized = crate::health::normalize_asset_reference(&path, &target);
        if let Some((_, references)) = assets.get_mut(&normalized) {
            references.insert(path);
        }
    }
    Ok(AssetUsageReport {
        assets: assets
            .into_iter()
            .map(|(path, (bytes, used_by))| AssetUsage {
                path,
                bytes,
                used_by: used_by.into_iter().collect(),
            })
            .collect(),
        truncated,
        source: "derived-link-index",
    })
}
