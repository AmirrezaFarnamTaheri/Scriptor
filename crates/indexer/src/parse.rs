use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ParsedLinkKind {
    Markdown,
    Wikilink,
    Heading,
    Asset,
    External,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParsedLink {
    pub kind: ParsedLinkKind,
    pub label: String,
    pub target: String,
    pub line: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct ParsedNote {
    pub title: String,
    pub tags: Vec<String>,
    pub links: Vec<ParsedLink>,
    pub headings: Vec<String>,
    pub aliases: Vec<String>,
    pub frontmatter_valid: bool,
    pub frontmatter_error: Option<String>,
    pub citation_keys: Vec<ParsedCitation>,
    #[serde(default)]
    pub note_type: Option<String>,
    #[serde(default)]
    pub organized: bool,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub template_body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParsedCitation {
    pub key: String,
    pub line: u32,
}

pub fn parse_note_markdown(path: &str, markdown: &str) -> ParsedNote {
    let (_frontmatter, body, frontmatter_valid, frontmatter_error) = split_frontmatter(markdown);
    let aliases = extract_aliases(&_frontmatter);
    let title = extract_title(&body, path);
    let tags = extract_tags(&body);
    let links = extract_links(&body);
    let headings = extract_headings(&body);
    let citation_keys = crate::citations::extract_pandoc_citations(&body);
    let note_type = extract_frontmatter_scalar(&_frontmatter, &["type"]);
    let organized = extract_frontmatter_bool(&_frontmatter, &["_organized", "organized"]).unwrap_or(false);
    let archived = extract_frontmatter_bool(&_frontmatter, &["_archived", "archived"]).unwrap_or(false);
    let template_body = extract_frontmatter_block(&_frontmatter, "template");

    ParsedNote {
        title,
        tags,
        links,
        headings,
        aliases,
        frontmatter_valid,
        frontmatter_error,
        citation_keys,
        note_type,
        organized,
        archived,
        template_body,
    }
}

fn split_frontmatter(markdown: &str) -> (String, String, bool, Option<String>) {
    if !markdown.starts_with("---\n") && !markdown.starts_with("---\r\n") {
        return (String::new(), markdown.to_string(), true, None);
    }

    let lines: Vec<&str> = markdown.lines().collect();
    if lines.len() < 2 {
        return (
            String::new(),
            markdown.to_string(),
            false,
            Some("unterminated frontmatter".into()),
        );
    }

    let mut end_index = None;
    for (index, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            end_index = Some(index);
            break;
        }
    }

    let Some(end_index) = end_index else {
        return (
            String::new(),
            markdown.to_string(),
            false,
            Some("unterminated frontmatter".into()),
        );
    };

    let frontmatter = lines[1..end_index].join("\n");
    let body = lines[(end_index + 1)..].join("\n");
    let valid = validate_frontmatter(&frontmatter);
    (
        frontmatter,
        body,
        valid,
        if valid {
            None
        } else {
            Some("invalid frontmatter syntax".into())
        },
    )
}

fn validate_frontmatter(frontmatter: &str) -> bool {
    for line in frontmatter.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if !trimmed.contains(':') {
            return false;
        }
    }
    true
}

fn extract_frontmatter_scalar(frontmatter: &str, keys: &[&str]) -> Option<String> {
    for line in frontmatter.lines() {
        let trimmed = line.trim();
        for key in keys {
            let prefix = format!("{key}:");
            if let Some(rest) = trimmed.strip_prefix(&prefix) {
                let value = rest.trim().trim_matches('"').trim_matches('\'');
                if !value.is_empty() && !value.starts_with('|') && !value.starts_with('>') {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

fn extract_frontmatter_bool(frontmatter: &str, keys: &[&str]) -> Option<bool> {
    extract_frontmatter_scalar(frontmatter, keys).map(|value| {
        matches!(
            value.to_lowercase().as_str(),
            "true" | "yes" | "1"
        )
    })
}

fn extract_frontmatter_block(frontmatter: &str, key: &str) -> Option<String> {
    let marker = format!("{key}:");
    let mut lines = frontmatter.lines();
    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if !trimmed.starts_with(&marker) {
            continue;
        }
        let inline = trimmed.strip_prefix(&marker)?.trim();
        if inline == "|" || inline == ">" {
            let mut body = Vec::new();
            for next in lines.by_ref() {
                if !next.starts_with(' ') && !next.starts_with('\t') && !next.trim().is_empty() {
                    break;
                }
                body.push(next.trim_start());
            }
            let joined = body.join("\n").trim().to_string();
            return if joined.is_empty() { None } else { Some(joined) };
        }
        if !inline.is_empty() {
            return Some(inline.to_string());
        }
    }
    None
}

fn extract_aliases(frontmatter: &str) -> Vec<String> {
    let mut aliases = Vec::new();
    for line in frontmatter.lines() {
        let trimmed = line.trim();
        let Some(rest) = trimmed
            .strip_prefix("aliases:")
            .or_else(|| trimmed.strip_prefix("alias:"))
        else {
            continue;
        };
        let value = rest.trim();
        if value.starts_with('[') && value.ends_with(']') {
            for part in value.trim_start_matches('[').trim_end_matches(']').split(',') {
                let alias = part.trim().trim_matches('"').trim_matches('\'');
                if !alias.is_empty() {
                    aliases.push(alias.to_string());
                }
            }
        } else if !value.is_empty() {
            aliases.push(value.trim_matches('"').trim_matches('\'').to_string());
        }
    }
    aliases
}

fn extract_title(body: &str, path: &str) -> String {
    for line in body.lines() {
        if let Some(title) = line.strip_prefix("# ") {
            let trimmed = title.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    path.trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or(path)
        .to_string()
}

fn extract_tags(body: &str) -> Vec<String> {
    let tag_regex = Regex::new(r"(?:^|\s)#([A-Za-z0-9_/-]+)").expect("valid tag regex");
    tag_regex
        .captures_iter(body)
        .filter_map(|capture| capture.get(1).map(|value| value.as_str().to_string()))
        .collect()
}

fn extract_headings(body: &str) -> Vec<String> {
    body.lines()
        .filter_map(|line| line.strip_prefix("# ").map(|value| value.trim().to_string()))
        .filter(|value| !value.is_empty())
        .collect()
}

fn extract_links(body: &str) -> Vec<ParsedLink> {
    let mut links = Vec::new();
    let wikilink = Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]").expect("valid wikilink regex");
    let markdown_link = Regex::new(r"\[([^\]]*)\]\(([^)]+)\)").expect("valid markdown link regex");

    for (index, line) in body.lines().enumerate() {
        let line_number = (index + 1) as u32;

        for capture in wikilink.captures_iter(line) {
            let target = capture.get(1).map(|value| value.as_str().trim()).unwrap_or("");
            let label = capture
                .get(2)
                .map(|value| value.as_str().trim())
                .filter(|value| !value.is_empty())
                .unwrap_or(target)
                .to_string();

            links.push(ParsedLink {
                kind: ParsedLinkKind::Wikilink,
                label,
                target: target.to_string(),
                line: line_number,
            });
        }

        for capture in markdown_link.captures_iter(line) {
            let label = capture.get(1).map(|value| value.as_str()).unwrap_or("").to_string();
            let target = capture.get(2).map(|value| value.as_str()).unwrap_or("").to_string();
            let kind = if target.starts_with("http://") || target.starts_with("https://") {
                ParsedLinkKind::External
            } else if target.ends_with(".png")
                || target.ends_with(".jpg")
                || target.ends_with(".jpeg")
                || target.ends_with(".gif")
            {
                ParsedLinkKind::Asset
            } else {
                ParsedLinkKind::Markdown
            };

            links.push(ParsedLink {
                kind,
                label,
                target,
                line: line_number,
            });
        }
    }

    links
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_fixture_links_and_tags() {
        let markdown = include_str!("../../../packages/test-fixtures/vaults/minimal/Research Plan.md");
        let parsed = parse_note_markdown("Research Plan.md", markdown);

        assert_eq!(parsed.title, "Research Plan");
        assert_eq!(parsed.links.len(), 2);
        assert!(parsed.links.iter().all(|link| link.kind == ParsedLinkKind::Wikilink));
    }

    #[test]
    fn extracts_aliases_from_frontmatter() {
        let markdown = "---\naliases: [Friendly Name, Alt]\n---\n\n# Body\n";
        let parsed = parse_note_markdown("Alias Target.md", markdown);
        assert_eq!(parsed.aliases, vec!["Friendly Name", "Alt"]);
    }
}
