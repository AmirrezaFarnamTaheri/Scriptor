//! W3-2 — Rust fuzzy fallback on title / path.
//!
//! Triggers only when FTS returns zero rows (I-5: the only Rust fuzzy scorer).
//! Bounded latency: linear scan capped at `FUZZY_SCAN_LIMIT` notes.
//! Algorithm: Levenshtein distance, case-folded.  A hit is returned when the
//! best edit distance against any whitespace-split token in the note title or
//! the basename of the path is ≤ `max_distance(query)`.

use rusqlite::params;

use crate::db::IndexCache;
use crate::error::IndexerError;
use scriptor_vault::normalize_lookup_key;

/// Maximum notes scanned before early exit.  On a 50k-note vault with
/// ~100-byte average row, this is ~5 MB of SQLite page reads.
const FUZZY_SCAN_LIMIT: usize = 50_000;
const FUZZY_SCAN_FETCH: i64 = FUZZY_SCAN_LIMIT as i64 + 1;

#[derive(Debug, Clone)]
pub struct FuzzyHit {
    pub note_id: String,
    pub path: String,
    pub title: String,
    /// Best edit distance found across all tokens in title + path basename.
    pub best_distance: usize,
}

/// Adaptive max edit distance:
/// * query len ≤ 3 → 0 (prefix match only avoids noise)
/// * query len ≤ 5 → 1
/// * query len ≤ 8 → 2
/// * longer        → 3
fn max_distance(query: &str) -> usize {
    match query.chars().count() {
        0..=3 => 0,
        4..=5 => 1,
        6..=8 => 2,
        _ => 3,
    }
}

/// Levenshtein edit distance, capped at `limit+1` for early exit.
fn edit_distance(a: &str, b: &str, limit: usize) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let la = a.len();
    let lb = b.len();

    if la == 0 {
        return lb;
    }
    if lb == 0 {
        return la;
    }
    if la.abs_diff(lb) > limit {
        return limit + 1;
    }

    let mut prev: Vec<usize> = (0..=lb).collect();
    let mut curr = vec![0usize; lb + 1];

    for i in 1..=la {
        curr[0] = i;
        let mut row_min = i;
        for j in 1..=lb {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            curr[j] = (curr[j - 1] + 1).min(prev[j] + 1).min(prev[j - 1] + cost);
            row_min = row_min.min(curr[j]);
        }
        // Early exit: entire row exceeds limit.
        if row_min > limit {
            return limit + 1;
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[lb]
}

/// Best fuzzy distance between `query` and every whitespace-split token of
/// `candidate`.  Returns `usize::MAX` when `candidate` is empty.
fn best_token_distance(query: &str, candidate: &str) -> usize {
    candidate
        .split_whitespace()
        .map(|tok| edit_distance(query, tok, max_distance(query)))
        .min()
        .unwrap_or(usize::MAX)
}

/// Run a fuzzy title/path search.
///
/// Scans at most `FUZZY_SCAN_LIMIT` rows from the `notes` table.  Results are
/// sorted by `best_distance` ascending then `title` ascending.  Returns at most
/// `limit` hits.
pub fn fuzzy_search_notes(
    cache: &IndexCache,
    vault_id: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<FuzzyHit>, IndexerError> {
    let q = normalize_lookup_key(query);
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let threshold = max_distance(&q);

    let conn = cache.connection()?;
    let mut stmt = conn.prepare(
        "SELECT id, path, title
         FROM notes
         WHERE vault_id = ?1
         ORDER BY path, id
         LIMIT ?2",
    )?;

    let rows = stmt.query_map(params![vault_id, FUZZY_SCAN_FETCH], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    let candidates = rows.collect::<Result<Vec<_>, _>>()?;
    if candidates.len() > FUZZY_SCAN_LIMIT {
        return Err(IndexerError::InvalidQuery(format!(
            "fuzzy search requires scanning more than {FUZZY_SCAN_LIMIT} notes; narrow the query or use full-text search"
        )));
    }

    let mut hits: Vec<FuzzyHit> = Vec::new();

    for (note_id, path, title) in candidates {
        let title_lower = normalize_lookup_key(&title);
        let basename = std::path::Path::new(&path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&path);
        let basename = normalize_lookup_key(basename);

        let dist_title = best_token_distance(&q, &title_lower);
        let dist_path = best_token_distance(&q, &basename);
        let best = dist_title.min(dist_path);

        if best <= threshold {
            hits.push(FuzzyHit {
                note_id,
                path,
                title,
                best_distance: best,
            });
        }
    }

    // Sort by distance ascending, then title ascending for determinism.
    hits.sort_unstable_by(|a, b| {
        a.best_distance
            .cmp(&b.best_distance)
            .then_with(|| a.title.cmp(&b.title))
    });
    hits.truncate(limit);
    Ok(hits)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notes::upsert_note;
    use scriptor_vault::RelativeVaultPath;
    use tempfile::tempdir;

    fn make_cache() -> (tempfile::TempDir, IndexCache) {
        let dir = tempdir().unwrap();
        let cache = IndexCache::open(dir.path().join("cache.sqlite")).unwrap();
        (dir, cache)
    }

    fn insert_note(cache: &IndexCache, path: &str, title: &str) {
        let p = RelativeVaultPath::parse(path).unwrap();
        let md = format!("# {title}\n\nsome body\n");
        let meta =
            scriptor_vault::metadata_from_markdown("v1", &p, &md, "2026-01-01T00:00:00Z".into());
        upsert_note(cache, &meta, &md).unwrap();
    }

    #[test]
    fn exact_title_match_distance_zero() {
        let (_dir, cache) = make_cache();
        insert_note(&cache, "Rust Ownership.md", "Rust Ownership");
        let hits = fuzzy_search_notes(&cache, "v1", "rust", 10).unwrap();
        assert!(!hits.is_empty());
        assert_eq!(hits[0].best_distance, 0);
    }

    #[test]
    fn typo_within_threshold() {
        let (_dir, cache) = make_cache();
        insert_note(&cache, "Lifetimes.md", "Lifetimes");
        // "lifetimez" has edit distance 1 from "Lifetimes" (s→z).
        let hits = fuzzy_search_notes(&cache, "v1", "lifetimez", 10).unwrap();
        assert!(!hits.is_empty(), "expected typo-tolerant hit");
        assert!(hits[0].best_distance <= 1);
    }

    #[test]
    fn very_short_query_requires_exact() {
        let (_dir, cache) = make_cache();
        insert_note(&cache, "AI.md", "AI");
        insert_note(&cache, "Async.md", "Async");
        // "ai" len 2 → max_distance 0 → only exact-case-insensitive matches.
        let hits = fuzzy_search_notes(&cache, "v1", "ai", 10).unwrap();
        assert!(hits.iter().any(|h| h.title == "AI"));
    }

    #[test]
    fn results_sorted_by_distance_then_title() {
        let (_dir, cache) = make_cache();
        insert_note(&cache, "Aardvark.md", "Aardvark");
        insert_note(&cache, "Aard.md", "Aard");
        let hits = fuzzy_search_notes(&cache, "v1", "aard", 10).unwrap();
        // "Aard" is exact (dist 0), "Aardvark" has higher distance → Aard first.
        assert_eq!(hits[0].title, "Aard");
    }

    #[test]
    fn no_panic_on_empty_query() {
        let (_dir, cache) = make_cache();
        let hits = fuzzy_search_notes(&cache, "v1", "", 10).unwrap();
        assert!(hits.is_empty());
    }
}
