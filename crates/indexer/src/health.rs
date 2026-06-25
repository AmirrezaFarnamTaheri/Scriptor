use scriptor_vault::{note_id, read_note, scan_vault, ScannedEntryKind, VaultSession};

use crate::citation::{validate_citations, CitationValidationSummary};
use crate::db::{integrity_check_ok, orphaned_note_count, read_schema_version, IndexCache};
use crate::error::IndexerError;
use crate::links::count_links;
use crate::notes::{indexed_note_count, total_word_count};
use crate::parse::{parse_note_markdown, ParsedLinkKind};
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

pub fn build_health_report(cache: &IndexCache, session: &VaultSession) -> Result<VaultHealthReport, IndexerError> {
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

    let mut issues = Vec::new();
    let mut title_paths = std::collections::BTreeMap::<String, Vec<(String, String)>>::new();
    let mut invalid_frontmatter = 0u32;
    let mut broken_links = 0u32;
    let mut citation_summary = CitationValidationSummary::default();

    for path in &note_paths {
        let relative = scriptor_vault::RelativeVaultPath::parse(path)?;
        let note = read_note(&session.descriptor.id, &session.root, &relative)?;
        let parsed = parse_note_markdown(path, &note.markdown);
        title_paths
            .entry(parsed.title.to_lowercase())
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
            if !target_exists(&note_paths, &link.target) {
                broken_links += 1;
                issues.push(HealthIssue {
                    kind: "broken_link".into(),
                    path: path.clone(),
                    detail: format!("unresolved link target: {}", link.target),
                    line: Some(link.line),
                });
            }
        }

        let note_key = note_id(&session.descriptor.id, &relative);
        for citation in &parsed.citation_keys {
            let valid = crate::citation::bibliography_contains_public(cache, &citation.key)?;
            if !valid {
                issues.push(HealthIssue {
                    kind: "unresolved_citation".into(),
                    path: path.clone(),
                    detail: format!("missing bibliography entry: {}", citation.key),
                    line: Some(citation.line),
                });
            }
        }

        citation_summary.merge(validate_citations(cache, &note_key, &parsed.citation_keys)?);
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

    let asset_paths: Vec<String> = scanned
        .iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Asset)
        .map(|entry| entry.path.clone())
        .collect();
    let mut orphan_assets = 0u32;
    for asset in &asset_paths {
        if !asset_is_referenced(&note_paths, session, asset)? {
            orphan_assets += 1;
            issues.push(HealthIssue {
                kind: "orphan_asset".into(),
                path: asset.clone(),
                detail: "asset is not referenced by any note".into(),
                line: None,
            });
        }
    }

    let duplicate_titles = title_paths
        .values()
        .filter(|paths| paths.len() > 1)
        .count() as u32;
    let indexed = indexed_note_count(cache, &session.descriptor.id)?;
    let total_words = total_word_count(cache, &session.descriptor.id)?;
    append_foam_lint_diagnostics(session, &mut issues)?;
    append_cache_diagnostics(cache, session, &note_paths, indexed, &mut issues)?;
    append_slow_export_diagnostics(session, &mut issues)?;
    let cache_status = if indexed == note_paths.len() as u32 && !issues.iter().any(|issue| {
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

use crate::resolve::resolve_wikilink_target;

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

    if !integrity_check_ok(cache.connection())? {
        issues.push(HealthIssue {
            kind: "corrupt_cache".into(),
            path: cache_rel.clone(),
            detail: "SQLite integrity check failed; rebuild recommended".into(),
            line: None,
        });
    }

    if let Some(version) = read_schema_version(cache.connection())? {
        if version != SCHEMA_VERSION {
            issues.push(HealthIssue {
                kind: "stale_cache".into(),
                path: cache_rel.clone(),
                detail: format!(
                    "schema v{version} != expected v{SCHEMA_VERSION}; rebuild recommended"
                ),
                line: None,
            });
        }
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
    use scriptor_vault::{lint_vault, RULE_MISSING_HEADING, RULE_STALE_DEFINITIONS};

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

fn target_exists(note_paths: &[String], target: &str) -> bool {
    matches!(
        resolve_wikilink_target(note_paths, target).kind,
        crate::resolve::WikilinkResolutionKind::Resolved
    )
}

fn asset_is_referenced(
    note_paths: &[String],
    session: &VaultSession,
    asset_path: &str,
) -> Result<bool, IndexerError> {
    for path in note_paths {
        let note = read_note(
            &session.descriptor.id,
            &session.root,
            &scriptor_vault::RelativeVaultPath::parse(path)?,
        )?;
        if note.markdown.contains(asset_path) {
            return Ok(true);
        }
    }
    Ok(false)
}

pub fn health_report_json(cache: &IndexCache, session: &VaultSession) -> Result<String, IndexerError> {
    let report = build_health_report(cache, session)?;
    Ok(serde_json::to_string_pretty(&report)?)
}

pub fn health_diagnostics_json(cache: &IndexCache, session: &VaultSession) -> Result<String, IndexerError> {
    let diagnostics = build_health_diagnostics(cache, session)?;
    Ok(serde_json::to_string_pretty(&diagnostics)?)
}

pub fn cache_link_count(cache: &IndexCache, session: &VaultSession) -> Result<u32, IndexerError> {
    count_links(cache, &session.descriptor.id)
}
