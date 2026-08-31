//! Benchmark and fixture-generation helpers for the CLI bench-* commands.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use scriptor_indexer::{open_cache_for_session, rebuild_index, search_notes};
use scriptor_vault::{ScannedEntryKind, open_vault, scan_vault, scan_vault_for_index};
use serde::Serialize;

/// Scan budget scales with vault size: 150ms per 1k notes with a 500ms
/// floor. The previous single 1500ms constant was sized for ~10k notes and
/// mislabeled healthy 25k scans (measured ~2.4s on Windows NTFS, ~0.1ms
/// per entry) as regressions.
fn scan_budget_ms(note_count: u32) -> u128 {
    (500 + 150 * u128::from(note_count / 1000)).max(500)
}
const SEARCH_BUDGET_MS: u128 = 100;

#[derive(Debug, Serialize)]
pub(crate) struct BenchScanReport {
    scenario: &'static str,
    vault_path: String,
    iterations: u32,
    note_count: u32,
    mean_ms: f64,
    samples_ms: Vec<u64>,
    min_ms: u64,
    p50_ms: u64,
    p95_ms: u64,
    max_ms: u64,
    budget_ms: u128,
    pub(crate) within_budget: bool,
}

#[derive(Debug, Serialize)]
pub(crate) struct BenchSearchReport {
    scenario: &'static str,
    vault_path: String,
    query: String,
    iterations: u32,
    note_count: u32,
    hit_count: u32,
    mean_ms: f64,
    samples_ms: Vec<u64>,
    min_ms: u64,
    p50_ms: u64,
    p95_ms: u64,
    max_ms: u64,
    budget_ms: u128,
    pub(crate) within_budget: bool,
}

pub(crate) fn bench_scan(
    path: &PathBuf,
    iterations: u32,
) -> Result<BenchScanReport, Box<dyn std::error::Error>> {
    if iterations == 0 {
        return Err("benchmark iterations must be greater than zero".into());
    }
    let session = open_vault(path)?;
    let mut samples = Vec::with_capacity(iterations as usize);
    let mut note_count = 0u32;

    for _ in 0..iterations {
        let started = Instant::now();
        let entries = scan_vault(&session.root)?;
        samples.push(started.elapsed().as_millis() as u64);
        note_count = entries
            .iter()
            .filter(|entry| entry.kind == ScannedEntryKind::Note)
            .count() as u32;
    }

    let summary = summarize_samples(&samples);

    Ok(BenchScanReport {
        scenario: "vault-scan",
        vault_path: path.display().to_string(),
        iterations,
        note_count,
        mean_ms: summary.mean_ms,
        samples_ms: samples,
        min_ms: summary.min_ms,
        p50_ms: summary.p50_ms,
        p95_ms: summary.p95_ms,
        max_ms: summary.max_ms,
        budget_ms: scan_budget_ms(note_count),
        within_budget: summary.mean_ms <= scan_budget_ms(note_count) as f64,
    })
}

pub(crate) fn bench_search(
    path: &PathBuf,
    query: &str,
    iterations: u32,
) -> Result<BenchSearchReport, Box<dyn std::error::Error>> {
    if iterations == 0 {
        return Err("benchmark iterations must be greater than zero".into());
    }
    let session = open_vault(path)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let note_count = scan_vault(&session.root)?
        .into_iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Note)
        .count() as u32;

    let mut samples = Vec::with_capacity(iterations as usize);
    let mut hit_count = 0u32;

    for _ in 0..iterations {
        let started = Instant::now();
        let hits = search_notes(&cache, &session.descriptor.id, query, 25)?;
        samples.push(started.elapsed().as_millis() as u64);
        hit_count = hits.len() as u32;
    }

    let summary = summarize_samples(&samples);

    Ok(BenchSearchReport {
        scenario: "warm-search",
        vault_path: path.display().to_string(),
        query: query.to_string(),
        iterations,
        note_count,
        hit_count,
        mean_ms: summary.mean_ms,
        samples_ms: samples,
        min_ms: summary.min_ms,
        p50_ms: summary.p50_ms,
        p95_ms: summary.p95_ms,
        max_ms: summary.max_ms,
        budget_ms: SEARCH_BUDGET_MS,
        within_budget: summary.mean_ms <= SEARCH_BUDGET_MS as f64,
    })
}

/// Tantivy comparison report: same shape as the FTS5 search report plus the
/// one-time index build cost, so warm-search latency can be compared
/// apples-to-apples against `bench-search` on the same vault.
#[cfg(feature = "tantivy")]
#[derive(Debug, Serialize)]
pub(crate) struct BenchTantivyReport {
    scenario: &'static str,
    vault_path: String,
    query: String,
    iterations: u32,
    note_count: u32,
    hit_count: u32,
    index_build_ms: u64,
    mean_ms: f64,
    samples_ms: Vec<u64>,
    min_ms: u64,
    p50_ms: u64,
    p95_ms: u64,
    max_ms: u64,
    budget_ms: u128,
    pub(crate) within_budget: bool,
}

#[cfg(feature = "tantivy")]
pub(crate) fn bench_tantivy(
    path: &PathBuf,
    query: &str,
    iterations: u32,
) -> Result<BenchTantivyReport, Box<dyn std::error::Error>> {
    if iterations == 0 {
        return Err("benchmark iterations must be greater than zero".into());
    }
    use scriptor_tantivy_indexer::TantivyIndex;

    let session = open_vault(path)?;
    let mut note_count = 0u32;
    let build_started = Instant::now();
    let index_dir =
        std::env::temp_dir().join(format!("scriptor-tantivy-bench-{}", std::process::id()));
    let _ = fs::remove_dir_all(&index_dir);
    let index = TantivyIndex::create_or_open(&index_dir)?;
    for entry in scan_vault_for_index(&session.root)? {
        if entry.kind != ScannedEntryKind::Note {
            continue;
        }
        note_count += 1;
        let title = entry
            .path
            .rsplit(['/', '\\'])
            .next()
            .unwrap_or(&entry.path)
            .trim_end_matches(".md")
            .to_string();
        let markdown = entry.content.unwrap_or_default();
        index.index_note(&entry.path, &title, &markdown)?;
    }
    let index_build_ms = build_started.elapsed().as_millis() as u64;

    let mut samples = Vec::with_capacity(iterations as usize);
    let mut hit_count = 0u32;
    for _ in 0..iterations {
        let started = Instant::now();
        let hits = index.search(query, 25)?;
        samples.push(started.elapsed().as_millis() as u64);
        hit_count = hits.len() as u32;
    }
    let _ = fs::remove_dir_all(&index_dir);

    let summary = summarize_samples(&samples);
    Ok(BenchTantivyReport {
        scenario: "tantivy-warm-search",
        vault_path: path.display().to_string(),
        query: query.to_string(),
        iterations,
        note_count,
        hit_count,
        index_build_ms,
        mean_ms: summary.mean_ms,
        samples_ms: samples,
        min_ms: summary.min_ms,
        p50_ms: summary.p50_ms,
        p95_ms: summary.p95_ms,
        max_ms: summary.max_ms,
        budget_ms: SEARCH_BUDGET_MS,
        within_budget: summary.mean_ms <= SEARCH_BUDGET_MS as f64,
    })
}

struct SampleSummary {
    mean_ms: f64,
    min_ms: u64,
    p50_ms: u64,
    p95_ms: u64,
    max_ms: u64,
}

fn summarize_samples(samples: &[u64]) -> SampleSummary {
    let mut sorted = samples.to_vec();
    sorted.sort_unstable();
    let sum: u64 = sorted.iter().sum();
    SampleSummary {
        mean_ms: sum as f64 / sorted.len() as f64,
        min_ms: sorted[0],
        p50_ms: percentile(&sorted, 0.50),
        p95_ms: percentile(&sorted, 0.95),
        max_ms: *sorted.last().unwrap_or(&0),
    }
}

fn percentile(sorted: &[u64], percentile: f64) -> u64 {
    let index = ((sorted.len() as f64 * percentile).ceil() as usize).saturating_sub(1);
    sorted[index.min(sorted.len() - 1)]
}

#[derive(Debug, Serialize)]
pub(crate) struct GenerateVaultSummary {
    output: String,
    note_count: u32,
    prefix: String,
}

pub(crate) fn generate_vault(
    output: &Path,
    count: u32,
    prefix: &str,
) -> Result<GenerateVaultSummary, Box<dyn std::error::Error>> {
    if output.exists() {
        return Err(format!("Output path already exists: {}", output.display()).into());
    }

    fs::create_dir_all(output.join(prefix))?;

    for index in 0..count {
        let stem = format!("note-{index:05}");
        let path = format!("{prefix}/{stem}.md");
        let previous = if index > 0 {
            format!("note-{:05}", index - 1)
        } else {
            String::new()
        };
        let next = if index + 1 < count {
            format!("note-{:05}", index + 1)
        } else {
            String::new()
        };

        let links = [
            if previous.is_empty() {
                None
            } else {
                Some(format!("- [[{previous}]]"))
            },
            if next.is_empty() {
                None
            } else {
                Some(format!("- [[{next}]]"))
            },
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join("\n");

        let body = format!(
            "# {stem}\n\nSynthetic note {index} for benchmark fixtures.\n\n## Links\n{links}\n"
        );
        fs::write(output.join(&path), body)?;
    }

    Ok(GenerateVaultSummary {
        output: output.display().to_string(),
        note_count: count,
        prefix: prefix.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::{percentile, summarize_samples};

    #[test]
    fn sample_summary_reports_tail_latency() {
        let summary = summarize_samples(&[30, 10, 20, 40]);
        assert_eq!(summary.mean_ms, 25.0);
        assert_eq!(summary.min_ms, 10);
        assert_eq!(summary.p50_ms, 20);
        assert_eq!(summary.p95_ms, 40);
        assert_eq!(summary.max_ms, 40);
    }

    #[test]
    fn percentile_uses_nearest_rank() {
        assert_eq!(percentile(&[1, 2, 3, 4, 5], 0.95), 5);
    }
}
