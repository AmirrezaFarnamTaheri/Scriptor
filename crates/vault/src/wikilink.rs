use unicode_normalization::UnicodeNormalization;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WikilinkResolutionKind {
    Resolved,
    Ambiguous,
    Unresolved,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WikilinkResolution {
    pub kind: WikilinkResolutionKind,
    pub path: Option<String>,
    pub candidates: Vec<String>,
}

const DIRECTORY_INDEX_NAMES: [&str; 2] = ["index", "readme"];

/// Canonical comparison key for user-authored note identifiers.
///
/// Filesystems may surface canonically equivalent Unicode spellings (NFC/NFD),
/// especially across macOS and Windows/Linux sync. Normalize before
/// case-folding so wikilink identity does not depend on the host's spelling.
pub fn normalize_lookup_key(value: &str) -> String {
    let lowered: String = value.trim().nfc().flat_map(char::to_lowercase).collect();
    lowered.nfc().collect()
}

#[derive(Debug, Default)]
pub struct WikilinkIndex {
    by_basename: std::collections::BTreeMap<String, Vec<String>>,
    by_relative_stem: std::collections::BTreeMap<String, Vec<String>>,
    by_alias: std::collections::BTreeMap<String, Vec<String>>,
    directory_index: std::collections::BTreeMap<String, String>,
}

impl WikilinkIndex {
    pub fn from_note_paths(paths: &[String]) -> Self {
        let mut index = Self::default();
        for path in paths {
            index.register_note(path);
        }
        index
    }

    fn register_note(&mut self, path: &str) {
        let stem = path.trim_end_matches(".md");
        let basename = normalize_lookup_key(stem.rsplit('/').next().unwrap_or(stem));
        self.by_basename
            .entry(basename)
            .or_default()
            .push(path.to_string());

        let relative = normalize_lookup_key(stem);
        self.by_relative_stem
            .entry(relative)
            .or_default()
            .push(path.to_string());

        if let Some((dir_path, priority)) = directory_index_entry(path) {
            let current = self.directory_index.get(&dir_path).and_then(|existing| {
                directory_index_entry(existing).map(|(_, existing_priority)| existing_priority)
            });
            if current.is_none_or(|existing_priority| priority < existing_priority) {
                self.directory_index.insert(dir_path, path.to_string());
            }
        }
    }

    pub fn register_aliases(&mut self, path: &str, aliases: &[String]) {
        for alias in aliases {
            let key = normalize_lookup_key(alias);
            if key.is_empty() {
                continue;
            }
            self.by_alias.entry(key).or_default().push(path.to_string());
        }
    }

    pub fn resolves_to(&self, target: &str, expected_path: &str) -> bool {
        let resolution = self.resolve(target);
        resolution.kind == WikilinkResolutionKind::Resolved
            && resolution.path.as_deref() == Some(expected_path)
    }

    pub fn resolve(&self, target: &str) -> WikilinkResolution {
        let normalized = target.trim().trim_end_matches(".md");
        if normalized.is_empty() {
            return WikilinkResolution {
                kind: WikilinkResolutionKind::Unresolved,
                path: None,
                candidates: Vec::new(),
            };
        }

        // An explicit relative path is the strongest identifier. Aliases are
        // intentionally lower precedence so an alias cannot shadow a concrete
        // vault path.
        if let Some(resolution) = self.resolve_relative(normalized) {
            return resolution;
        }
        if let Some(resolution) = self.resolve_alias(normalized) {
            return resolution;
        }
        if let Some(resolution) = self.resolve_basename(normalized) {
            return resolution;
        }
        self.resolve_directory_identifier(normalized)
    }

    fn resolve_alias(&self, normalized: &str) -> Option<WikilinkResolution> {
        self.by_alias
            .get(&normalize_lookup_key(normalized))
            .cloned()
            .map(finalize)
    }

    fn resolve_relative(&self, normalized: &str) -> Option<WikilinkResolution> {
        self.by_relative_stem
            .get(&normalize_lookup_key(normalized))
            .cloned()
            .map(finalize)
    }

    fn resolve_basename(&self, normalized: &str) -> Option<WikilinkResolution> {
        let basename = normalize_lookup_key(
            normalized.rsplit('/').next().unwrap_or(normalized),
        );
        self.by_basename.get(&basename).cloned().map(finalize)
    }

    fn resolve_directory_identifier(&self, normalized: &str) -> WikilinkResolution {
        let needle = normalize_lookup_key(normalized);
        let mut candidates = Vec::new();
        for (dir_path, path) in &self.directory_index {
            if dir_path == &needle || dir_path.ends_with(&format!("/{needle}")) {
                candidates.push(path.clone());
            }
        }
        finalize(candidates)
    }
}

fn directory_index_entry(path: &str) -> Option<(String, usize)> {
    let stem = path.trim_end_matches(".md");
    let basename = stem.rsplit('/').next().unwrap_or(stem);
    let priority = DIRECTORY_INDEX_NAMES
        .iter()
        .position(|name| basename.eq_ignore_ascii_case(name))?;
    let dir_path = stem
        .rsplit_once('/')
        .map(|(parent, _)| normalize_lookup_key(parent))
        .unwrap_or_default();
    Some((dir_path, priority))
}

fn finalize(mut paths: Vec<String>) -> WikilinkResolution {
    paths.sort();
    paths.dedup();

    match paths.len() {
        0 => WikilinkResolution {
            kind: WikilinkResolutionKind::Unresolved,
            path: None,
            candidates: Vec::new(),
        },
        1 => WikilinkResolution {
            kind: WikilinkResolutionKind::Resolved,
            path: paths.first().cloned(),
            candidates: paths,
        },
        _ => WikilinkResolution {
            kind: WikilinkResolutionKind::Ambiguous,
            path: None,
            candidates: paths,
        },
    }
}

pub fn resolve_wikilink_target(note_paths: &[String], target: &str) -> WikilinkResolution {
    WikilinkIndex::from_note_paths(note_paths).resolve(target)
}

pub fn resolve_wikilink_target_with_aliases(
    note_paths: &[String],
    aliases_by_path: &std::collections::BTreeMap<String, Vec<String>>,
    target: &str,
) -> WikilinkResolution {
    let mut index = WikilinkIndex::from_note_paths(note_paths);
    for (path, aliases) in aliases_by_path {
        index.register_aliases(path, aliases);
    }
    index.resolve(target)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_unique_basename() {
        let paths = vec!["Research Plan.md".into(), "daily/2026-06-20.md".into()];
        let resolution = resolve_wikilink_target(&paths, "Research Plan");
        assert_eq!(resolution.kind, WikilinkResolutionKind::Resolved);
        assert_eq!(resolution.path.as_deref(), Some("Research Plan.md"));
    }

    #[test]
    fn resolves_relative_path() {
        let paths = vec!["daily/2026-06-20.md".into()];
        let resolution = resolve_wikilink_target(&paths, "daily/2026-06-20");
        assert_eq!(resolution.kind, WikilinkResolutionKind::Resolved);
    }

    #[test]
    fn flags_ambiguous_basenames() {
        let paths = vec!["a/Note.md".into(), "b/Note.md".into()];
        let resolution = resolve_wikilink_target(&paths, "Note");
        assert_eq!(resolution.kind, WikilinkResolutionKind::Ambiguous);
        assert_eq!(resolution.candidates.len(), 2);
    }

    #[test]
    fn explicit_relative_path_beats_conflicting_alias() {
        let paths = vec!["notes/Target.md".into(), "other.md".into()];
        let mut index = WikilinkIndex::from_note_paths(&paths);
        index.register_aliases("other.md", &["notes/Target".into()]);
        let resolution = index.resolve("notes/Target");
        assert_eq!(resolution.kind, WikilinkResolutionKind::Resolved);
        assert_eq!(resolution.path.as_deref(), Some("notes/Target.md"));
    }

    #[test]
    fn resolves_canonically_equivalent_unicode_identifiers() {
        let paths = vec!["Café.md".into()];
        let decomposed = "Cafe\u{301}";
        let resolution = resolve_wikilink_target(&paths, decomposed);
        assert_eq!(resolution.kind, WikilinkResolutionKind::Resolved);
        assert_eq!(resolution.path.as_deref(), Some("Café.md"));
    }

    #[test]
    fn resolves_frontmatter_alias() {
        let paths = vec!["Alias Target.md".into()];
        let mut aliases = std::collections::BTreeMap::new();
        aliases.insert("Alias Target.md".into(), vec!["Friendly Name".into()]);
        let resolution = resolve_wikilink_target_with_aliases(&paths, &aliases, "Friendly Name");
        assert_eq!(resolution.kind, WikilinkResolutionKind::Resolved);
        assert_eq!(resolution.path.as_deref(), Some("Alias Target.md"));
    }

    #[test]
    fn resolves_directory_index_by_folder_name() {
        let paths = vec![
            "projects/index.md".into(),
            "projects/README.md".into(),
            "other.md".into(),
        ];
        let resolution = resolve_wikilink_target(&paths, "projects");
        assert_eq!(resolution.kind, WikilinkResolutionKind::Resolved);
        assert_eq!(resolution.path.as_deref(), Some("projects/index.md"));
    }

    #[test]
    fn prefers_index_over_readme_for_directory_links() {
        let paths = vec!["folder/README.md".into()];
        let index_only = resolve_wikilink_target(&paths, "folder");
        assert_eq!(index_only.path.as_deref(), Some("folder/README.md"));

        let paths = vec!["folder/index.md".into(), "folder/README.md".into()];
        let resolution = resolve_wikilink_target(&paths, "folder");
        assert_eq!(resolution.path.as_deref(), Some("folder/index.md"));
    }

    #[test]
    fn resolves_nested_directory_identifier() {
        let paths = vec!["zoo/projects/index.md".into()];
        let resolution = resolve_wikilink_target(&paths, "projects");
        assert_eq!(resolution.kind, WikilinkResolutionKind::Resolved);
        assert_eq!(resolution.path.as_deref(), Some("zoo/projects/index.md"));
    }
}
