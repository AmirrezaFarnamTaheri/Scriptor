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
        if let serde_json::Value::Object(map) = &value {
            if map.contains_key("all") || map.contains_key("any") {
                let group: ViewFilter = serde_json::from_value(value).map_err(de::Error::custom)?;
                return Ok(ViewFilterNode::Group(group));
            }
        }
        let condition: ViewFilterCondition =
            serde_json::from_value(value).map_err(de::Error::custom)?;
        Ok(ViewFilterNode::Condition(condition))
    }
}

pub fn evaluate_view_filter(filter: &ViewFilter, note: &ViewNoteMetadata<'_>) -> bool {
    match filter {
        ViewFilter::All(nodes) => nodes.iter().all(|node| evaluate_view_filter_node(node, note)),
        ViewFilter::Any(nodes) => nodes.iter().any(|node| evaluate_view_filter_node(node, note)),
    }
}

fn evaluate_view_filter_node(node: &ViewFilterNode, note: &ViewNoteMetadata<'_>) -> bool {
    match node {
        ViewFilterNode::Condition(condition) => evaluate_view_filter_condition(condition, note),
        ViewFilterNode::Group(group) => evaluate_view_filter(group, note),
    }
}

fn evaluate_view_filter_condition(condition: &ViewFilterCondition, note: &ViewNoteMetadata<'_>) -> bool {
    match condition.op {
        ViewFilterOp::PathMatches => {
            let Some(raw) = json_scalar(&condition.value) else {
                return false;
            };
            path_matches(&note.path, &raw)
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
                .any(|tag| tag.eq_ignore_ascii_case(&raw.trim_start_matches('#')))
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
            note.note_type.map(|value| value.eq_ignore_ascii_case(&raw)).unwrap_or(false)
        }
        ViewFilterOp::OrganizedIs => {
            let Some(raw) = json_scalar(&condition.value) else {
                return false;
            };
            let expected = matches!(raw.to_lowercase().as_str(), "true" | "yes" | "1");
            note.organized == expected
        }
        ViewFilterOp::InInbox => {
            !note.archived
                && note.note_type != Some("Type")
                && !note.organized
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

fn path_matches(path: &str, pattern: &str) -> bool {
    if let Ok(re) = Regex::new(pattern) {
        return re.is_match(path);
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

fn modified_within_days(modified_at: &str, days: u64) -> bool {
    let Ok(parsed) = DateTime::parse_from_rfc3339(modified_at) else {
        return false;
    };
    let modified = parsed.with_timezone(&Utc);
    let cutoff = Utc::now() - Duration::days(days as i64);
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
        let note = sample_note("daily/2026-06-20.md", "Daily plan", &tags, "2026-06-20T12:00:00Z");
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
}
