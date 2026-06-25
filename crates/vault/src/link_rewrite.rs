use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::path::RelativeVaultPath;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LinkRewritePreview {
    pub affected_files: Vec<String>,
    pub edits: u32,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LinkRewriteApplyOutput {
    pub affected_files: Vec<String>,
    pub edits: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenameLinkTarget {
    pub path: String,
    pub title: String,
    pub basename: String,
    pub relative_stem: String,
    pub directory_identifier: Option<String>,
}

impl RenameLinkTarget {
    pub fn from_note_path(path: &RelativeVaultPath, title: &str, all_note_paths: &[String]) -> Self {
        let path_str = path.as_str();
        let stem = path_str.trim_end_matches(".md");
        let basename = stem.rsplit('/').next().unwrap_or(stem).to_string();
        Self {
            path: path_str.to_string(),
            title: title.to_string(),
            basename,
            relative_stem: stem.to_string(),
            directory_identifier: directory_identifier_for_path(path_str, all_note_paths),
        }
    }

    pub fn replacement_identifier(&self, link_target: &str, to: &RenameLinkTarget) -> String {
        if let (Some(from_dir), Some(to_dir)) = (&self.directory_identifier, &to.directory_identifier) {
            if link_target.eq_ignore_ascii_case(from_dir) {
                return to_dir.clone();
            }
        }
        if link_target.eq_ignore_ascii_case(&self.title)
            || link_target.eq_ignore_ascii_case(&self.basename)
            || link_target == self.path
            || link_target.eq_ignore_ascii_case(&self.relative_stem)
        {
            return preferred_note_identifier(to);
        }
        preferred_note_identifier(to)
    }
}

pub fn preferred_note_identifier(target: &RenameLinkTarget) -> String {
    target
        .directory_identifier
        .clone()
        .unwrap_or_else(|| target.title.clone())
}

pub fn is_directory_index_path(path: &str) -> bool {
    let stem = path.trim_end_matches(".md");
    let basename = stem.rsplit('/').next().unwrap_or(stem);
    basename.eq_ignore_ascii_case("index") || basename.eq_ignore_ascii_case("readme")
}

pub fn directory_identifier_for_path(path: &str, all_note_paths: &[String]) -> Option<String> {
    if !is_directory_index_path(path) {
        return None;
    }

    let dir_path = path
        .trim_end_matches(".md")
        .rsplit_once('/')
        .map(|(parent, _)| parent.to_string())
        .unwrap_or_default();
    let normalized_dir = dir_path.to_lowercase();

    let mut directory_paths = Vec::new();
    for candidate in all_note_paths {
        if !is_directory_index_path(candidate) {
            continue;
        }
        let candidate_dir = candidate
            .trim_end_matches(".md")
            .rsplit_once('/')
            .map(|(parent, _)| parent.to_lowercase())
            .unwrap_or_default();
        if candidate_dir == normalized_dir {
            return shortest_identifier(&dir_path, &directory_index_dirs(all_note_paths));
        }
        directory_paths.push(candidate_dir);
    }

    let _ = directory_paths;
    shortest_identifier(&dir_path, &directory_index_dirs(all_note_paths))
}

fn directory_index_dirs(all_note_paths: &[String]) -> Vec<String> {
    all_note_paths
        .iter()
        .filter(|path| is_directory_index_path(path))
        .filter_map(|path| {
            path.trim_end_matches(".md")
                .rsplit_once('/')
                .map(|(parent, _)| parent.to_string())
        })
        .collect()
}

pub fn shortest_identifier(for_path: &str, amongst: &[String]) -> Option<String> {
    if for_path.is_empty() {
        return None;
    }
    let needle_tokens: Vec<_> = for_path.split('/').rev().collect();
    let mut haystack: Vec<Vec<&str>> = amongst
        .iter()
        .filter(|value| value.as_str() != for_path)
        .map(|value| value.split('/').rev().collect())
        .collect();

    let mut token_index = 0usize;
    let mut result = needle_tokens.clone();
    while token_index < needle_tokens.len() {
        haystack.retain(|candidate| {
            candidate.len() > token_index && candidate[token_index] == needle_tokens[token_index]
        });
        if haystack.is_empty() {
            result = needle_tokens[..=token_index].to_vec();
            break;
        }
        token_index += 1;
    }

    Some(
        result
            .into_iter()
            .rev()
            .filter(|token| !token.trim().is_empty())
            .collect::<Vec<_>>()
            .join("/"),
    )
}

pub fn note_target_matches(
    target: &str,
    note_path: &RelativeVaultPath,
    note_title: &str,
    directory_identifier: Option<&str>,
) -> bool {
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return false;
    }

    let path = note_path.as_str();
    let stem = path.trim_end_matches(".md");
    let basename = stem.rsplit('/').next().unwrap_or(stem);

    trimmed.eq_ignore_ascii_case(note_title)
        || trimmed == path
        || trimmed.eq_ignore_ascii_case(basename)
        || trimmed.eq_ignore_ascii_case(stem)
        || directory_identifier.is_some_and(|id| trimmed.eq_ignore_ascii_case(id))
}

pub fn rewrite_note_rename_links(
    markdown: &str,
    from: &RenameLinkTarget,
    to: &RenameLinkTarget,
) -> (String, u32) {
    let mut edits = 0u32;
    let wikilink =
        Regex::new(r"\[\[([^\]|#]*)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]").expect("valid wikilink regex");
    let markdown_link = Regex::new(
        r"\[(?P<label>[^\]]*)\]\((?P<url>[^)#]+)(?:#(?P<section>[^)]+))?\)",
    )
    .expect("valid markdown link regex");
    let reference_def = Regex::new(r"(?m)^\[(?P<label>[^\]]+)\]:\s*(?P<url>[^\s#]+)(?:#[^\s]+)?\s*$")
        .expect("valid reference definition regex");

    let step_one = wikilink
        .replace_all(markdown, |capture: &regex::Captures| {
            let target = capture.get(1).map(|value| value.as_str().trim()).unwrap_or("");
            let section = capture.get(2).map(|value| value.as_str());
            let alias = capture.get(3).map(|value| value.as_str());

            if !note_target_matches(
                target,
                &RelativeVaultPath::parse(&from.path).unwrap_or_else(|_| RelativeVaultPath::parse("x.md").unwrap()),
                &from.title,
                from.directory_identifier.as_deref(),
            ) {
                return capture.get(0).unwrap().as_str().to_string();
            }

            edits += 1;
            let new_target = from.replacement_identifier(target, to);
            match (section, alias) {
                (Some(section_value), Some(alias_value)) => {
                    format!("[[{new_target}#{section_value}|{alias_value}]]")
                }
                (Some(section_value), None) => format!("[[{new_target}#{section_value}]]"),
                (None, Some(alias_value)) => format!("[[{new_target}|{alias_value}]]"),
                (None, None) => format!("[[{new_target}]]"),
            }
        })
        .into_owned();

    let step_two = markdown_link
        .replace_all(&step_one, |capture: &regex::Captures| {
            let label = capture.name("label").map(|value| value.as_str()).unwrap_or("");
            let url = capture.name("url").map(|value| value.as_str().trim()).unwrap_or("");
            let section = capture.name("section").map(|value| value.as_str());

            if !note_target_matches(
                url,
                &RelativeVaultPath::parse(&from.path).unwrap_or_else(|_| RelativeVaultPath::parse("x.md").unwrap()),
                &from.title,
                from.directory_identifier.as_deref(),
            ) && url != from.path
            {
                return capture.get(0).unwrap().as_str().to_string();
            }

            edits += 1;
            let new_url = from.replacement_identifier(url, to);
            match section {
                Some(section_value) => format!("[{label}]({new_url}#{section_value})"),
                None => format!("[{label}]({new_url})"),
            }
        })
        .into_owned();

    let updated = reference_def
        .replace_all(&step_two, |capture: &regex::Captures| {
            let label = capture.name("label").map(|value| value.as_str()).unwrap_or("");
            let url = capture.name("url").map(|value| value.as_str().trim()).unwrap_or("");

            if !note_target_matches(
                url,
                &RelativeVaultPath::parse(&from.path).unwrap_or_else(|_| RelativeVaultPath::parse("x.md").unwrap()),
                &from.title,
                from.directory_identifier.as_deref(),
            ) && url != from.path
            {
                return capture.get(0).unwrap().as_str().to_string();
            }

            edits += 1;
            let new_url = from.replacement_identifier(url, to);
            format!("[{label}]: {new_url}")
        })
        .into_owned();

    (updated, edits)
}

pub(crate) fn split_frontmatter(markdown: &str) -> (Option<String>, String) {
    if !markdown.starts_with("---\n") && !markdown.starts_with("---\r\n") {
        return (None, markdown.to_string());
    }

    let lines: Vec<&str> = markdown.lines().collect();
    if lines.len() < 2 {
        return (None, markdown.to_string());
    }

    for (index, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            let frontmatter = lines[1..index].join("\n");
            let body = lines[(index + 1)..].join("\n");
            return (Some(frontmatter), body);
        }
    }

    (None, markdown.to_string())
}

pub(crate) fn join_frontmatter(frontmatter: Option<&str>, body: &str) -> String {
    match frontmatter {
        Some(fm) if !fm.is_empty() => format!("---\n{fm}\n---\n{body}"),
        Some(_) => format!("---\n---\n{body}"),
        None => body.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_alias_and_section_on_rename() {
        let paths = vec!["Field Notes.md".into()];
        let from = RenameLinkTarget::from_note_path(
            &RelativeVaultPath::parse("Field Notes.md").unwrap(),
            "Field Notes",
            &paths,
        );
        let to = RenameLinkTarget::from_note_path(
            &RelativeVaultPath::parse("Field Notes Renamed.md").unwrap(),
            "Field Notes Renamed",
            &paths,
        );
        let input = "See [[Field Notes#Methods|alias]] and [[Field Notes]].";
        let (updated, edits) = rewrite_note_rename_links(input, &from, &to);
        assert!(edits >= 2);
        assert!(updated.contains("[[Field Notes Renamed#Methods|alias]]"));
        assert!(updated.contains("[[Field Notes Renamed]]"));
    }

    #[test]
    fn preserves_directory_identifier_on_index_rename() {
        let paths = vec!["projects/index.md".into(), "other/index.md".into()];
        let from = RenameLinkTarget::from_note_path(
            &RelativeVaultPath::parse("projects/index.md").unwrap(),
            "Projects",
            &paths,
        );
        let to = RenameLinkTarget::from_note_path(
            &RelativeVaultPath::parse("archive/index.md").unwrap(),
            "Archive",
            &paths,
        );
        assert_eq!(from.directory_identifier.as_deref(), Some("projects"));

        let input = "Jump to [[projects|Home]] and [[projects#Intro]].";
        let (updated, edits) = rewrite_note_rename_links(input, &from, &to);
        assert!(edits >= 2);
        assert!(updated.contains("[[archive|Home]]"));
        assert!(updated.contains("[[archive#Intro]]"));
    }

    #[test]
    fn computes_shortest_directory_identifier() {
        let dirs = vec!["zoo/bar".into(), "zoo/baz".into()];
        assert_eq!(shortest_identifier("zoo/bar", &dirs).as_deref(), Some("bar"));
    }
}
