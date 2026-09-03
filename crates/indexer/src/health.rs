use scriptor_vault::{
    MAX_INDEXED_NOTE_BYTES, ScannedEntryKind, VaultSession, read_note, scan_vault,
};

use std::collections::BTreeSet;

use crate::citation::{CitationValidationSummary, known_bibliography_keys_for_cache};
use crate::db::{IndexCache, integrity_check_ok, orphaned_note_count, read_schema_version};
use crate::error::IndexerError;
use crate::links::count_links;
use crate::notes::{indexed_note_count, total_word_count};
use crate::parse::{ParsedLinkKind, parse_note_markdown};
use crate::schema::SCHEMA_VERSION;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CacheStatus {
    Fresh,
    Stale,
    Rebuilding,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct VaultHealthReport {
    pub vault_id: String,
    pub broken_links: u32,
    pub orphan_assets: u32,
    pub duplicate_titles: u32,
    pub invalid_frontmatter: u32,
    pub unresolved_citations: u32,
    pub indexed_notes: u32,
    pub total_words: u32,
    pub slow_exports: u32,
    pub cache_status: CacheStatus,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct HealthIssue {
    pub kind: String,
    pub path: String,
    pub detail: String,
    pub line: Option<u32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct VaultHealthDiagnostics {
    pub summary: VaultHealthReport,
    pub issues: Vec<HealthIssue>,
}

pub fn build_health_report(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<VaultHealthReport, IndexerError> {
    Ok(build_health_diagnostics(cache, session)?.summary)
}

pub fn build_health_diagnostics(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<VaultHealthDiagnostics, IndexerError> {
    let scanned = scan_vault(&session.root)?;
    let note_paths: Vec<String> = scanned
        .iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Note)
        .map(|entry| entry.path.clone())
        .collect();
    let indexable_note_paths: Vec<String> = scanned
        .iter()
        .filter(|entry| {
            entry.kind == ScannedEntryKind::Note && entry.size_bytes <= MAX_INDEXED_NOTE_BYTES
        })
        .map(|entry| entry.path.clone())
        .collect();
    let oversized_note_paths: Vec<String> = scanned
        .iter()
        .filter(|entry| {
            entry.kind == ScannedEntryKind::Note && entry.size_bytes > MAX_INDEXED_NOTE_BYTES
        })
        .map(|entry| entry.path.clone())
        .collect();

    // Build resolution lookups once: existence resolution still includes an
    // oversized note even though its body is deliberately excluded from the
    // derived index.
    let wikilink_index = WikilinkIndex::from_note_paths(&note_paths);
    let asset_paths: Vec<String> = scanned
        .iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Asset)
        .map(|entry| entry.path.clone())
        .collect();
    let asset_path_set: std::collections::BTreeSet<String> = asset_paths.iter().cloned().collect();
    // Record references as notes are parsed; never retain every note body or
    // compare every asset against every note.
    let mut referenced_assets = std::collections::BTreeSet::<String>::new();
    let mut issues = Vec::new();
    for path in &oversized_note_paths {
        issues.push(HealthIssue {
            kind: "oversized_note".into(),
            path: path.clone(),
            detail: format!(
                "note exceeds the {} byte indexing/health parsing budget; content diagnostics are skipped",
                MAX_INDEXED_NOTE_BYTES
            ),
            line: None,
        });
    }
    let mut title_paths = std::collections::BTreeMap::<String, Vec<(String, String)>>::new();
    let mut invalid_frontmatter = 0u32;
    let mut broken_links = 0u32;
    let mut citation_occurrences = Vec::<(String, crate::parse::ParsedCitation)>::new();
    let mut citation_keys = BTreeSet::<String>::new();

    for path in &indexable_note_paths {
        let relative = scriptor_vault::RelativeVaultPath::parse(path)?;
        let note = read_note(&session.descriptor.id, &session.root, &relative)?;
        let parsed = parse_note_markdown(path, &note.markdown);
        for link in &parsed.links {
            if link.kind != ParsedLinkKind::Asset {
                continue;
            }
            let target = normalize_asset_reference(path, &link.target);
            if asset_path_set.contains(&target) {
                referenced_assets.insert(target);
            }
        }
        title_paths
            .entry(scriptor_vault::normalize_lookup_key(&parsed.title))
            .or_default()
            .push((path.clone(), parsed.title.clone()));

        if !parsed.frontmatter_valid {
            invalid_frontmatter += 1;
            issues.push(HealthIssue {
                kind: "invalid_frontmatter".into(),
                path: path.clone(),
                detail: parsed
                    .frontmatter_error
                    .clone()
                    .unwrap_or_else(|| "invalid YAML frontmatter".into()),
                line: None,
            });
        }

        for link in parsed.links {
            if link.kind == ParsedLinkKind::External {
                continue;
            }
            if !matches!(
                wikilink_index.resolve(&link.target).kind,
                crate::resolve::WikilinkResolutionKind::Resolved
            ) {
                broken_links += 1;
                issues.push(HealthIssue {
                    kind: "broken_link".into(),
                    path: path.clone(),
                    detail: format!("unresolved link target: {}", link.target),
                    line: Some(link.line),
                });
            }
        }

        for citation in parsed.citation_keys {
            citation_keys.insert(citation.key.clone());
            citation_occurrences.push((path.clone(), citation));
        }
    }

    let known_citation_keys = known_bibliography_keys_for_cache(cache, &citation_keys)?;
    let mut citation_summary = CitationValidationSummary::default();
    for (path, citation) in citation_occurrences {
        citation_summary.total = citation_summary.total.saturating_add(1);
        if known_citation_keys.contains(&citation.key) {
            citation_summary.resolved = citation_summary.resolved.saturating_add(1);
        } else {
            citation_summary.unresolved = citation_summary.unresolved.saturating_add(1);
            issues.push(HealthIssue {
                kind: "unresolved_citation".into(),
                path,
                detail: format!("missing bibliography entry: {}", citation.key),
                line: Some(citation.line),
            });
        }
    }

    for paths in title_paths.values() {
        if paths.len() <= 1 {
            continue;
        }
        let display_title = paths[0].1.clone();
        for (path, _) in paths {
            issues.push(HealthIssue {
                kind: "duplicate_title".into(),
                path: path.clone(),
                detail: format!("duplicate title: {display_title}"),
                line: None,
            });
        }
    }

    let mut orphan_assets = 0u32;
    // Do not label assets orphaned when an intentionally-unparsed oversized
    // note could reference them. A bounded health check must prefer an
    // explicit unknown over a false-positive deletion signal.
    if oversized_note_paths.is_empty() {
        for asset in &asset_paths {
            if !referenced_assets.contains(asset) {
                orphan_assets += 1;
                issues.push(HealthIssue {
                    kind: "orphan_asset".into(),
                    path: asset.clone(),
                    detail: "asset is not referenced by any note".into(),
                    line: None,
                });
            }
        }
    }

    let duplicate_titles = title_paths.values().filter(|paths| paths.len() > 1).count() as u32;
    let indexed = indexed_note_count(cache, &session.descriptor.id)?;
    let total_words = total_word_count(cache, &session.descriptor.id)?;
    append_foam_lint_diagnostics(session, &mut issues)?;
    append_cache_diagnostics(cache, session, &indexable_note_paths, indexed, &mut issues)?;
    append_slow_export_diagnostics(session, &mut issues)?;
    let cache_status = if indexed == indexable_note_paths.len() as u32
        && !issues.iter().any(|issue| {
            matches!(
                issue.kind.as_str(),
                "stale_cache" | "corrupt_cache" | "cache_missing"
            )
        }) {
        CacheStatus::Fresh
    } else {
        CacheStatus::Stale
    };

    let slow_exports = scriptor_export_runner::count_slow_exports(session.root.root()).unwrap_or(0);
    let summary = VaultHealthReport {
        vault_id: session.descriptor.id.clone(),
        broken_links,
        orphan_assets,
        duplicate_titles,
        invalid_frontmatter,
        unresolved_citations: citation_summary.unresolved,
        indexed_notes: indexed,
        total_words,
        slow_exports,
        cache_status,
    };

    Ok(VaultHealthDiagnostics { summary, issues })
}

fn normalize_asset_reference(note_path: &str, target: &str) -> String {
    let mut parts: Vec<&str> = note_path.split('/').collect();
    parts.pop();
    for component in target.trim_start_matches('/').split('/') {
        match component {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            value => parts.push(value),
        }
    }
    parts.join("/")
}

use crate::resolve::WikilinkIndex;

fn append_cache_diagnostics(
    cache: &IndexCache,
    session: &VaultSession,
    note_paths: &[String],
    indexed: u32,
    issues: &mut Vec<HealthIssue>,
) -> Result<(), IndexerError> {
    let cache_rel = ".scriptor/cache/index.sqlite".to_string();

    if !cache.path.exists() {
        issues.push(HealthIssue {
            kind: "cache_missing".into(),
            path: cache_rel.clone(),
            detail: "derived index cache not found; rebuild to populate".into(),
            line: None,
        });
        return Ok(());
    }

    let conn = cache.connection()?;
    if !integrity_check_ok(&conn)? {
        issues.push(HealthIssue {
            kind: "corrupt_cache".into(),
            path: cache_rel.clone(),
            detail: "SQLite integrity check failed; rebuild recommended".into(),
            line: None,
        });
    }

    if let Some(version) = read_schema_version(&conn)?
        && version != SCHEMA_VERSION
    {
        issues.push(HealthIssue {
            kind: "stale_cache".into(),
            path: cache_rel.clone(),
            detail: format!("schema v{version} != expected v{SCHEMA_VERSION}; rebuild recommended"),
            line: None,
        });
    }

    let fts_rebuild_required: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM cache_meta WHERE key = 'fts_rebuild_required' AND value = '1')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    if fts_rebuild_required {
        issues.push(HealthIssue {
            kind: "stale_cache".into(),
            path: cache_rel.clone(),
            detail: "full-text index was recreated by a schema migration and still requires a full rebuild".into(),
            line: None,
        });
    }

    let note_count = note_paths.len() as u32;
    if indexed < note_count {
        issues.push(HealthIssue {
            kind: "stale_cache".into(),
            path: cache_rel.clone(),
            detail: format!("indexed {indexed} of {note_count} notes; rebuild recommended"),
            line: None,
        });
    }

    drop(conn);
    let orphaned = orphaned_note_count(cache, &session.descriptor.id, note_paths)?;
    if orphaned > 0 {
        issues.push(HealthIssue {
            kind: "stale_cache".into(),
            path: cache_rel,
            detail: format!("{orphaned} stale index row(s) for deleted notes; rebuild recommended"),
            line: None,
        });
    }

    Ok(())
}

fn append_slow_export_diagnostics(
    session: &VaultSession,
    issues: &mut Vec<HealthIssue>,
) -> Result<(), IndexerError> {
    let slow_exports = scriptor_export_runner::count_slow_exports(session.root.root()).unwrap_or(0);
    if slow_exports == 0 {
        return Ok(());
    }
    issues.push(HealthIssue {
        kind: "slow_export".into(),
        path: ".scriptor/exports/logs".into(),
        detail: format!(
            "{slow_exports} recent export(s) exceeded {} ms; review export profiles or Pandoc setup",
            scriptor_export_runner::SLOW_EXPORT_THRESHOLD_MS
        ),
        line: None,
    });
    Ok(())
}

fn append_foam_lint_diagnostics(
    session: &VaultSession,
    issues: &mut Vec<HealthIssue>,
) -> Result<(), IndexerError> {
    use scriptor_vault::{RULE_MISSING_HEADING, RULE_STALE_DEFINITIONS, lint_vault};

    let rules = vec![
        RULE_MISSING_HEADING.to_string(),
        RULE_STALE_DEFINITIONS.to_string(),
    ];
    let report = lint_vault(&session.descriptor.id, &session.root, &rules)?;
    for file in report.files {
        for issue in file.issues {
            issues.push(HealthIssue {
                kind: issue.code.replace('-', "_"),
                path: file.path.clone(),
                detail: issue.message,
                line: Some(issue.line),
            });
        }
    }
    Ok(())
}

pub fn health_report_json(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<String, IndexerError> {
    let report = build_health_report(cache, session)?;
    Ok(serde_json::to_string_pretty(&report)?)
}

pub fn health_diagnostics_json(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<String, IndexerError> {
    let diagnostics = build_health_diagnostics(cache, session)?;
    Ok(serde_json::to_string_pretty(&diagnostics)?)
}

pub fn cache_link_count(cache: &IndexCache, session: &VaultSession) -> Result<u32, IndexerError> {
    count_links(cache, &session.descriptor.id)
}
