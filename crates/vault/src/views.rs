use std::fmt;

use chrono::{DateTime, Duration, Utc};
use regex::Regex;
use serde::de::{self, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::note::NoteMetadata;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ViewFilter {
    All(Vec<ViewFilterNode>),
    Any(Vec<ViewFilterNode>),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ViewFilterNode {
    Condition(ViewFilterCondition),
    Group(ViewFilter),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ViewFilterCondition {
    pub op: ViewFilterOp,
    #[serde(default)]
    pub value: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ViewFilterOp {
    #[serde(rename = "path matches")]
    PathMatches,
    #[serde(rename = "title contains")]
    TitleContains,
    #[serde(rename = "tag has")]
    TagHas,
    #[serde(rename = "modified within days")]
    ModifiedWithinDays,
    #[serde(rename = "type equals")]
    TypeEquals,
    #[serde(rename = "organized is")]
    OrganizedIs,
    #[serde(rename = "in inbox")]
    InInbox,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ViewNoteMetadata<'a> {
    pub path: &'a str,
    pub title: &'a str,
    pub tags: &'a [String],
    pub modified_at: &'a str,
    pub note_type: Option<&'a str>,
    pub organized: bool,
    pub archived: bool,
}

impl<'a> From<&'a NoteMetadata> for ViewNoteMetadata<'a> {
    fn from(note: &'a NoteMetadata) -> Self {
        Self {
            path: &note.path,
            title: &note.title,
            tags: &note.tags,
            modified_at: &note.modified_at,
            note_type: note.note_type.as_deref(),
            organized: note.organized,
            archived: note.archived,
        }
    }
}

impl Serialize for ViewFilter {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(1))?;
        match self {
            ViewFilter::All(nodes) => map.serialize_entry("all", nodes)?,
            ViewFilter::Any(nodes) => map.serialize_entry("any", nodes)?,
        }
        map.end()
    }
}

impl<'de> Deserialize<'de> for ViewFilter {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct FilterVisitor;

        impl<'de> Visitor<'de> for FilterVisitor {
            type Value = ViewFilter;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a map with key 'all' or 'any'")
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<ViewFilter, M::Error> {
                let key: String = map
                    .next_key()?
                    .ok_or_else(|| de::Error::custom("expected 'all' or 'any' key"))?;
                match key.as_str() {
                    "all" => Ok(ViewFilter::All(map.next_value()?)),
                    "any" => Ok(ViewFilter::Any(map.next_value()?)),
                    other => Err(de::Error::unknown_field(other, &["all", "any"])),
                }
            }
        }

        deserializer.deserialize_map(FilterVisitor)
    }
}

impl Serialize for ViewFilterNode {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            ViewFilterNode::Condition(condition) => condition.serialize(serializer),
            ViewFilterNode::Group(group) => group.serialize(serializer),
        }
    }
}

impl<'de> Deserialize<'de> for ViewFilterNode {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = serde_json::Value::deserialize(deserializer)?;
        if let serde_json::Value::Object(map) = &value
            && (map.contains_key("all") || map.contains_key("any"))
        {
            let group: ViewFilter = serde_json::from_value(value).map_err(de::Error::custom)?;
            return Ok(ViewFilterNode::Group(group));
        }
        let condition: ViewFilterCondition =
            serde_json::from_value(value).map_err(de::Error::custom)?;
        Ok(ViewFilterNode::Condition(condition))
    }
}

pub fn evaluate_view_filter(filter: &ViewFilter, note: &ViewNoteMetadata<'_>) -> bool {
    match filter {
        ViewFilter::All(nodes) => nodes
            .iter()
            .all(|node| evaluate_view_filter_node(node, note)),
        ViewFilter::Any(nodes) => nodes
            .iter()
            .any(|node| evaluate_view_filter_node(node, note)),
    }
}

fn evaluate_view_filter_node(node: &ViewFilterNode, note: &ViewNoteMetadata<'_>) -> bool {
    match node {
        ViewFilterNode::Condition(condition) => evaluate_view_filter_condition(condition, note),
        ViewFilterNode::Group(group) => evaluate_view_filter(group, note),
    }
}

fn evaluate_view_filter_condition(
    condition: &ViewFilterCondition,
    note: &ViewNoteMetadata<'_>,
) -> bool {
    match condition.op {
        ViewFilterOp::PathMatches => {
            let Some(raw) = json_scalar(&condition.value) else {
                return false;
            };
            path_matches(note.path, &raw)
        }
        ViewFilterOp::TitleContains => {
            let Some(raw) = json_scalar(&condition.value) else {
                return false;
            };
            note.title.to_lowercase().contains(&raw.to_lowercase())
        }
        ViewFilterOp::TagHas => {
            let Some(raw) = json_scalar(&condition.value) else {
                return false;
            };
            note.tags
                .iter()
                .any(|tag| tag.eq_ignore_ascii_case(raw.trim_start_matches('#')))
        }
        ViewFilterOp::ModifiedWithinDays => {
            let Some(days) = json_u64(&condition.value) else {
                return false;
            };
            modified_within_days(note.modified_at, days)
        }
        ViewFilterOp::TypeEquals => {
            let Some(raw) = json_scalar(&condition.value) else {
                return false;
            };
            note.note_type
                .map(|value| value.eq_ignore_ascii_case(&raw))
                .unwrap_or(false)
        }
        ViewFilterOp::OrganizedIs => {
            let Some(raw) = json_scalar(&condition.value) else {
                return false;
            };
            let expected = matches!(raw.to_lowercase().as_str(), "true" | "yes" | "1");
            note.organized == expected
        }
        ViewFilterOp::InInbox => {
            !note.archived && note.note_type != Some("Type") && !note.organized
        }
    }
}

fn json_scalar(value: &Option<serde_json::Value>) -> Option<String> {
    match value {
        Some(serde_json::Value::String(text)) => Some(text.clone()),
        Some(serde_json::Value::Number(number)) => Some(number.to_string()),
        Some(other) if !other.is_null() => Some(other.to_string()),
        _ => None,
    }
}

fn json_u64(value: &Option<serde_json::Value>) -> Option<u64> {
    match value {
        Some(serde_json::Value::Number(number)) => number.as_u64(),
        Some(serde_json::Value::String(text)) => text.parse().ok(),
        _ => None,
    }
}

/// Upper bound on a compiled view regex, in bytes.
///
/// View filters come from vault JSON, which a shared or cloned vault controls.
/// The bound keeps a pathological pattern from consuming unbounded memory
/// during compilation.
const VIEW_REGEX_SIZE_LIMIT: usize = 1 << 20;

/// How many compiled view patterns to retain per thread.
const VIEW_REGEX_CACHE_CAP: usize = 64;

thread_local! {
    /// `path_matches` is evaluated once per note per condition, so compiling on
    /// every call meant recompiling the same pattern for every note in the
    /// vault. Patterns come from a small set of saved views, so a modest
    /// per-thread cache removes the repeated compilation entirely.
    ///
    /// `None` records a pattern that is not valid regex, so the glob/substring
    /// fallback does not re-attempt (and re-fail) compilation each time.
    static VIEW_REGEX_CACHE: std::cell::RefCell<std::collections::HashMap<String, Option<Regex>>> =
        std::cell::RefCell::new(std::collections::HashMap::new());
}

fn with_view_regex<R>(pattern: &str, use_regex: impl FnOnce(Option<&Regex>) -> R) -> R {
    VIEW_REGEX_CACHE.with(|cache| {
        let mut cache = cache.borrow_mut();
        if !cache.contains_key(pattern) {
            // Bound the cache rather than letting a vault with many distinct
            // patterns grow it without limit.
            if cache.len() >= VIEW_REGEX_CACHE_CAP {
                cache.clear();
            }
            let compiled = regex::RegexBuilder::new(pattern)
                .size_limit(VIEW_REGEX_SIZE_LIMIT)
                .build()
                .ok();
            cache.insert(pattern.to_string(), compiled);
        }
        use_regex(cache.get(pattern).and_then(|entry| entry.as_ref()))
    })
}

/// Match a note path against a saved-view `path matches` pattern.
///
/// The pattern is a regex: existing views rely on that (`^projects/`,
/// `daily/.*`). Patterns that do not compile fall back to glob semantics when
/// they contain wildcards, and to a substring test otherwise.
fn path_matches(path: &str, pattern: &str) -> bool {
    if let Some(matched) = with_view_regex(pattern, |re| re.map(|re| re.is_match(path))) {
        return matched;
    }
    if pattern.contains('*') || pattern.contains('?') {
        return glob_match(pattern, path);
    }
    path.contains(pattern)
}

fn glob_match(pattern: &str, path: &str) -> bool {
    let regex_pattern = format!(
        "^{}$",
        regex::escape(pattern)
            .replace("\\*", ".*")
            .replace("\\?", ".")
    );
    Regex::new(&regex_pattern)
        .map(|re| re.is_match(path))
        .unwrap_or(false)
}

/// Largest `modified within days` window honoured, ~100 years.
///
/// `days` is deserialized from vault-authored view JSON, so it is untrusted.
/// `Duration::days` panics once the value exceeds chrono's internal
/// millisecond range, and anything past `i64::MAX` wraps negative and inverts
/// the filter. Clamping keeps a large window meaning "effectively unbounded"
/// rather than crashing or silently matching the wrong notes.
const MAX_MODIFIED_WITHIN_DAYS: u64 = 36_500;

fn modified_within_days(modified_at: &str, days: u64) -> bool {
    let Ok(parsed) = DateTime::parse_from_rfc3339(modified_at) else {
        return false;
    };
    let modified = parsed.with_timezone(&Utc);
    let clamped = days.min(MAX_MODIFIED_WITHIN_DAYS) as i64;
    let Some(window) = Duration::try_days(clamped) else {
        return false;
    };
    let Some(cutoff) = Utc::now().checked_sub_signed(window) else {
        return false;
    };
    modified >= cutoff
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_note<'a>(
        path: &'a str,
        title: &'a str,
        tags: &'a [String],
        modified_at: &'a str,
    ) -> ViewNoteMetadata<'a> {
        ViewNoteMetadata {
            path,
            title,
            tags,
            modified_at,
            note_type: None,
            organized: false,
            archived: false,
        }
    }

    #[test]
    fn evaluates_all_group() {
        let filter: ViewFilter = serde_json::from_value(serde_json::json!({
            "all": [
                { "op": "title contains", "value": "plan" },
                { "op": "path matches", "value": "daily/.*" }
            ]
        }))
        .unwrap();
        let tags = Vec::new();
        let note = sample_note(
            "daily/2026-06-20.md",
            "Daily plan",
            &tags,
            "2026-06-20T12:00:00Z",
        );
        assert!(evaluate_view_filter(&filter, &note));
    }

    #[test]
    fn evaluates_any_group() {
        let filter: ViewFilter = serde_json::from_value(serde_json::json!({
            "any": [
                { "op": "tag has", "value": "project" },
                { "op": "title contains", "value": "archive" }
            ]
        }))
        .unwrap();
        let tags = vec!["project".into()];
        let note = sample_note("inbox/x.md", "Inbox", &tags, "2026-06-20T12:00:00Z");
        assert!(evaluate_view_filter(&filter, &note));
    }

    #[test]
    fn evaluates_modified_within_days() {
        let filter: ViewFilter = serde_json::from_value(serde_json::json!({
            "all": [{ "op": "modified within days", "value": 7 }]
        }))
        .unwrap();
        let tags = Vec::new();
        let recent = Utc::now().to_rfc3339();
        let note = sample_note("recent.md", "Recent", &tags, &recent);
        assert!(evaluate_view_filter(&filter, &note));
    }

    #[test]
    fn rejects_non_matching_path() {
        let filter: ViewFilter = serde_json::from_value(serde_json::json!({
            "all": [{ "op": "path matches", "value": "^projects/" }]
        }))
        .unwrap();
        let tags = Vec::new();
        let note = sample_note("inbox/x.md", "Inbox", &tags, "2026-06-20T12:00:00Z");
        assert!(!evaluate_view_filter(&filter, &note));
    }

    #[test]
    fn modified_within_days_clamps_absurd_windows_instead_of_panicking() {
        // `days` comes from vault-authored view JSON. Before clamping, chrono's
        // Duration::days panicked past its millisecond range, and values above
        // i64::MAX wrapped negative and inverted the filter.
        for days in [
            u64::MAX,
            i64::MAX as u64,
            1_000_000_000_000_000,
            100_000_000,
        ] {
            assert!(
                modified_within_days("2026-06-20T12:00:00Z", days),
                "an absurd window should behave as unbounded, not panic (days={days})"
            );
        }
    }

    #[test]
    fn modified_within_days_still_excludes_older_notes() {
        assert!(!modified_within_days("2000-01-01T00:00:00Z", 7));
        assert!(modified_within_days(&Utc::now().to_rfc3339(), 7));
    }

    #[test]
    fn path_matches_keeps_regex_semantics_for_saved_views() {
        // Existing saved views rely on regex; these must keep working.
        assert!(path_matches("projects/alpha.md", "^projects/"));
        assert!(!path_matches("archive/projects/alpha.md", "^projects/"));
        assert!(path_matches("daily/2026-06-20.md", "daily/.*"));
    }

    #[test]
    fn path_matches_falls_back_for_patterns_that_are_not_regex() {
        // An unclosed character class is not valid regex. With a wildcard
        // present the glob fallback runs, and it anchors the whole path.
        assert!(path_matches("docs/readme[", "docs/*["));
        assert!(!path_matches("other/readme[", "docs/*["));

        // Without a wildcard the substring fallback runs instead.
        assert!(path_matches("notes/plan[x.md", "plan["));
        assert!(!path_matches("notes/plan.md", "plan["));
    }

    #[test]
    fn path_matches_is_stable_across_repeated_calls() {
        // Exercises the compiled-pattern cache: the same pattern must give the
        // same answer every time, and distinct patterns must not collide.
        for _ in 0..200 {
            assert!(path_matches("projects/alpha.md", "^projects/"));
            assert!(!path_matches("projects/alpha.md", "^archive/"));
        }
    }

    #[test]
    fn path_matches_rejects_a_pathological_pattern_without_hanging() {
        // Compilation is size-bounded, so a huge nested pattern fails to build
        // and falls through rather than exhausting memory.
        let pattern = format!("{}a{}", "(".repeat(2000), ")".repeat(2000));
        let _ = path_matches("notes/a.md", &pattern);
    }
}
