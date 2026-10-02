//! Local diagnostics and bounded PCA over real stored embeddings; never calls a provider.
use crate::{EmbeddingError, content_hash, vault_ops::embeddings_store_path};
use rusqlite::{Connection, OpenFlags};
use scriptor_vault::{ScannedEntryKind, SemanticConfig, VaultSession, scan_vault_for_index};
use serde::Serialize;
use std::collections::HashMap;

const MAX_POINTS: usize = 256;
const MAX_DIMENSION: usize = 4096;

#[derive(Debug, Serialize)]
pub struct ProjectionPoint {
    pub note_path: String,
    pub coordinates: [f64; 3],
    pub stale: bool,
}

#[derive(Debug, Serialize)]
pub struct SemanticInspection {
    pub available: bool,
    pub provider: String,
    pub model: Option<String>,
    pub dimension: usize,
    pub total_notes: usize,
    pub indexed: usize,
    pub current: usize,
    pub stale: usize,
    pub missing: usize,
    pub orphaned: usize,
    pub invalid: usize,
    pub sampled: usize,
    pub truncated: bool,
    pub projection: &'static str,
    pub explained_variance: [f64; 3],
    pub points: Vec<ProjectionPoint>,
}

pub fn configuration_identity(config: &SemanticConfig) -> String {
    format!(
        "{}|{}|{}|{}",
        config.provider,
        config.base_url.as_deref().unwrap_or(""),
        config.model.as_deref().unwrap_or(""),
        config.dimension.unwrap_or(0)
    )
}

pub fn configured_dimension(config: &SemanticConfig) -> usize {
    config.dimension.unwrap_or_else(|| {
        if config.model.as_deref() == Some("text-embedding-3-large") {
            3072
        } else {
            1536
        }
    })
}

/// Matrix-free covariance power iteration with orthogonal deflation. Memory O(n*d),
/// work bounded by 256 points, 4096 dimensions, three axes and 24 iterations.
fn pca(vectors: &[Vec<f64>]) -> (Vec<[f64; 3]>, [f64; 3]) {
    if vectors.is_empty() {
        return (Vec::new(), [0.0; 3]);
    }
    let dimension = vectors[0].len();
    let mut mean = vec![0.0; dimension];
    for row in vectors {
        for (m, x) in mean.iter_mut().zip(row) {
            *m += x / vectors.len() as f64;
        }
    }
    let centered: Vec<Vec<f64>> = vectors
        .iter()
        .map(|row| row.iter().zip(&mean).map(|(x, m)| x - m).collect())
        .collect();
    let total: f64 = centered.iter().flatten().map(|x| x * x).sum();
    if total <= f64::EPSILON {
        return (vec![[0.0; 3]; vectors.len()], [0.0; 3]);
    }
    let mut axes: Vec<Vec<f64>> = Vec::new();
    let mut variance = [0.0; 3];
    for (axis, axis_variance) in variance.iter_mut().enumerate().take(3.min(dimension)) {
        let mut v: Vec<f64> = (0..dimension)
            .map(|i| ((i + 1) as f64 * (axis + 1) as f64).sin())
            .collect();
        for _ in 0..24 {
            let mut next = vec![0.0; dimension];
            for row in &centered {
                let dot: f64 = row.iter().zip(&v).map(|(x, y)| x * y).sum();
                for (target, x) in next.iter_mut().zip(row) {
                    *target += dot * x;
                }
            }
            for previous in &axes {
                let dot: f64 = next.iter().zip(previous).map(|(x, y)| x * y).sum();
                for (x, y) in next.iter_mut().zip(previous) {
                    *x -= dot * y;
                }
            }
            let norm: f64 = next.iter().map(|x| x * x).sum::<f64>().sqrt();
            if norm <= total * 1e-12 {
                v.fill(0.0);
                break;
            }
            for x in &mut next {
                *x /= norm;
            }
            v = next;
        }
        // Stable orientation avoids mirrored views on successive inspections.
        if v.iter()
            .max_by(|a, b| a.abs().total_cmp(&b.abs()))
            .is_some_and(|x| *x < 0.0)
        {
            for x in &mut v {
                *x = -*x;
            }
        }
        *axis_variance = centered
            .iter()
            .map(|row| row.iter().zip(&v).map(|(x, y)| x * y).sum::<f64>().powi(2))
            .sum::<f64>()
            / total;
        axes.push(v);
    }
    let points = centered
        .iter()
        .map(|row| {
            let mut xyz = [0.0; 3];
            for (i, axis) in axes.iter().enumerate() {
                xyz[i] = row.iter().zip(axis).map(|(x, y)| x * y).sum();
            }
            xyz
        })
        .collect();
    (points, variance)
}

pub fn inspect_vault_embeddings(
    session: &VaultSession,
    limit: usize,
) -> Result<SemanticInspection, EmbeddingError> {
    let config = scriptor_vault::load_vault_config(session.root.root())
        .map_err(|e| EmbeddingError::Provider(e.to_string()))?
        .semantic;
    let dimension = config.as_ref().map(configured_dimension).unwrap_or(0);
    let mut report = SemanticInspection {
        available: config
            .as_ref()
            .is_some_and(|c| c.provider != "none" && !c.provider.is_empty()),
        provider: config
            .as_ref()
            .map(|c| c.provider.clone())
            .unwrap_or_else(|| "none".into()),
        model: config.as_ref().and_then(|c| c.model.clone()),
        dimension,
        total_notes: 0,
        indexed: 0,
        current: 0,
        stale: 0,
        missing: 0,
        orphaned: 0,
        invalid: 0,
        sampled: 0,
        truncated: false,
        projection: "PCA (24 power iterations per axis)",
        explained_variance: [0.0; 3],
        points: Vec::new(),
    };
    let entries =
        scan_vault_for_index(&session.root).map_err(|e| EmbeddingError::Provider(e.to_string()))?;
    let notes: HashMap<String, Option<String>> = entries
        .into_iter()
        .filter(|e| e.kind == ScannedEntryKind::Note)
        .map(|e| (e.path, e.content.map(|body| content_hash(&body))))
        .collect();
    report.total_notes = notes.len();
    report.missing = notes.len();
    let path = embeddings_store_path(session.root.root());
    if !path.exists() {
        return Ok(report);
    }
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let context = conn
        .query_row(
            "SELECT identity FROM embedding_context LIMIT 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok();
    let identity_matches = config
        .as_ref()
        .is_some_and(|c| context.as_deref() == Some(configuration_identity(c).as_str()));
    let records: usize = conn.query_row("SELECT count(*) FROM embeddings", [], |row| row.get(0))?;
    if records > scriptor_vault::MAX_SCAN_ENTRIES {
        return Err(EmbeddingError::Provider(
            "embedding index exceeds the 250000-record inspection limit".into(),
        ));
    }
    // SQL bounds the bytes materialized for each row even for a corrupt cache.
    let mut stmt = conn.prepare("SELECT id, content_hash, dimension, substr(vector,1,16384), length(vector) FROM embeddings ORDER BY id")?;
    let mut rows = stmt.query([])?;
    let mut vectors = Vec::new();
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let hash: Option<String> = row.get(1)?;
        let stored_dimension: usize = row.get(2)?;
        let Some(source_hash) = notes.get(&id) else {
            report.orphaned += 1;
            continue;
        };
        report.indexed += 1;
        report.missing -= 1;
        let mut stale = !identity_matches
            || stored_dimension != dimension
            || source_hash.is_none()
            || hash != *source_hash;
        let raw = row.get_ref(3)?;
        let bytes = raw.as_blob().ok();
        let byte_length: usize = row.get(4)?;
        let invalid = stored_dimension == 0
            || stored_dimension > MAX_DIMENSION
            || stored_dimension.checked_mul(4) != Some(byte_length)
            || bytes.is_none_or(|bytes| stored_dimension.checked_mul(4) != Some(bytes.len()))
            || bytes.is_some_and(|bytes| {
                bytes.chunks_exact(4).any(|b| {
                    !f32::from_le_bytes(b.try_into().expect("four-byte chunk")).is_finite()
                })
            });
        if invalid {
            report.invalid += 1;
            stale = true;
        }
        if stale {
            report.stale += 1;
        } else {
            report.current += 1;
        }
        // Check byte length before decoding. Diagnostics remain valid for dimensions
        // too large to project, and only a deterministic bounded prefix is retained.
        if invalid {
            continue;
        }
        if stored_dimension > MAX_DIMENSION {
            report.truncated = true;
            continue;
        }
        let bytes = bytes.expect("valid blob");
        if stored_dimension != dimension {
            continue;
        }
        if vectors.len() >= limit.clamp(1, MAX_POINTS) {
            report.truncated = true;
            continue;
        }
        let vector: Vec<f64> = bytes
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes(b.try_into().expect("four-byte chunk")) as f64)
            .collect();
        vectors.push(vector);
        report.points.push(ProjectionPoint {
            note_path: id,
            coordinates: [0.0; 3],
            stale,
        });
    }
    let (coordinates, variance) = pca(&vectors);
    for (point, xyz) in report.points.iter_mut().zip(coordinates) {
        point.coordinates = xyz;
    }
    report.explained_variance = variance;
    report.sampled = report.points.len();
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pca_measures_real_variance_and_centers_points() {
        let vectors = vec![
            vec![-4.0, 1.0],
            vec![-2.0, -1.0],
            vec![2.0, -1.0],
            vec![4.0, 1.0],
        ];
        let (points, explained) = pca(&vectors);
        assert!((explained[0] - 10.0 / 11.0).abs() < 1e-5);
        assert!((explained[1] - 1.0 / 11.0).abs() < 1e-5);
        assert!((points[0][0] + 4.0).abs() < 1e-4);
        assert!(points.iter().map(|p| p[0]).sum::<f64>().abs() < 1e-6);
    }
    #[test]
    fn identical_vectors_have_zero_variance_without_nan() {
        let (points, variance) = pca(&[vec![1.0, 2.0], vec![1.0, 2.0]]);
        assert_eq!(points, vec![[0.0; 3]; 2]);
        assert_eq!(variance, [0.0; 3]);
    }
    #[test]
    fn changed_model_rebuilds_unchanged_notes_and_rejects_nonfinite_vectors() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("a.md"), "alpha").unwrap();
        let session = scriptor_vault::open_vault(temp.path()).unwrap();
        let mut config = SemanticConfig {
            provider: "ollama".into(),
            model: Some("first".into()),
            base_url: None,
            dimension: Some(2),
        };
        let provider = crate::provider::ConstProvider::new(2, 1.0);
        let first =
            crate::vault_ops::sync_configured_vault_embeddings(&session, &provider, &config)
                .unwrap();
        assert_eq!(first.embedded, 1);
        assert_eq!(
            crate::vault_ops::sync_configured_vault_embeddings(&session, &provider, &config)
                .unwrap()
                .unchanged,
            1
        );
        config.model = Some("second".into());
        assert!(
            crate::vault_ops::search_configured_vault_embeddings(
                &session, &provider, &config, "alpha", 10
            )
            .is_err()
        );
        assert_eq!(
            crate::vault_ops::sync_configured_vault_embeddings(&session, &provider, &config)
                .unwrap()
                .embedded,
            1
        );
        let store = crate::EmbeddingStore::open_in_memory(2).unwrap();
        assert!(
            store
                .upsert_embedding("bad", None, &[f32::NAN, 1.0])
                .is_err()
        );
        assert_eq!(store.count().unwrap(), 0);
    }
    #[test]
    fn inspection_reports_current_stale_missing_and_sample_bounds() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("a.md"), "alpha").unwrap();
        std::fs::write(temp.path().join("b.md"), "beta").unwrap();
        std::fs::write(temp.path().join("c.md"), "gamma").unwrap();
        let session = scriptor_vault::open_vault(temp.path()).unwrap();
        let config = SemanticConfig {
            provider: "ollama".into(),
            model: Some("test".into()),
            base_url: None,
            dimension: Some(2),
        };
        let mut vault_config = scriptor_vault::load_vault_config(temp.path()).unwrap();
        vault_config.semantic = Some(config.clone());
        scriptor_vault::save_vault_config(temp.path(), &vault_config).unwrap();
        let store = crate::EmbeddingStore::open(&embeddings_store_path(temp.path()), 2).unwrap();
        store
            .prepare_context(&configuration_identity(&config))
            .unwrap();
        store
            .upsert_embedding("a.md", Some(&content_hash("alpha")), &[1.0, 0.0])
            .unwrap();
        store
            .upsert_embedding("b.md", Some("old"), &[0.0, 1.0])
            .unwrap();
        let report = inspect_vault_embeddings(&session, 1).unwrap();
        assert_eq!((report.current, report.stale, report.missing), (1, 1, 1));
        assert_eq!(report.sampled, 1);
        assert!(report.truncated);
        vault_config.semantic.as_mut().unwrap().model = Some("changed".into());
        scriptor_vault::save_vault_config(temp.path(), &vault_config).unwrap();
        assert_eq!(inspect_vault_embeddings(&session, 2).unwrap().stale, 2);
    }
}
