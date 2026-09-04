use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

static TAG_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:^|\s)#([A-Za-z0-9_/-]+)").expect("valid tag regex"));
static WIKILINK_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]").expect("valid wikilink regex")
});
static MARKDOWN_LINK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[([^\]]*)\]\(([^)]+)\)").expect("valid markdown link regex"));

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
    /// Body text after stripping YAML frontmatter. Use this for FTS indexing
    /// to avoid exposing frontmatter content (e.g. tag values) in snippets.
    #[serde(default)]
    pub body: String,
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
    let organized =
        extract_frontmatter_bool(&_frontmatter, &["_organized", "organized"]).unwrap_or(false);
    let archived =
        extract_frontmatter_bool(&_frontmatter, &["_archived", "archived"]).unwrap_or(false);
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
        body,
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
            String::new(),
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
            String::new(),
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
    let mut allows_indented_content = false;
    let mut parent_indent = 0usize;

    for line in frontmatter.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let indent = line.len().saturating_sub(line.trim_start().len());

        if let Some((_, value)) = trimmed.split_once(':') {
            let value = value.trim();
            allows_indented_content = value.is_empty() || value == "|" || value == ">";
            parent_indent = indent;
            continue;
        }

        if allows_indented_content && indent > parent_indent {
            // YAML block lists/scalars are continuation lines of the preceding
            // key and do not need their own `:` delimiter.
            continue;
        }

        return false;
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
    extract_frontmatter_scalar(frontmatter, keys)
        .map(|value| matches!(value.to_lowercase().as_str(), "true" | "yes" | "1"))
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
            return if joined.is_empty() {
                None
            } else {
                Some(joined)
            };
        }
        if !inline.is_empty() {
            return Some(inline.to_string());
        }
    }
    None
}

fn extract_aliases(frontmatter: &str) -> Vec<String> {
    let mut aliases = Vec::new();
    let lines: Vec<&str> = frontmatter.lines().collect();
    let mut index = 0usize;

    while index < lines.len() {
        let line = lines[index];
        let trimmed = line.trim();
        let Some(rest) = trimmed
            .strip_prefix("aliases:")
            .or_else(|| trimmed.strip_prefix("alias:"))
        else {
            index += 1;
            continue;
        };

        let value = rest.trim();
        if value.starts_with('[') && value.ends_with(']') {
            for part in value
                .trim_start_matches('[')
                .trim_end_matches(']')
                .split(',')
            {
                let alias = part.trim().trim_matches('"').trim_matches('\'');
                if !alias.is_empty() {
                    aliases.push(alias.to_string());
                }
            }
        } else if !value.is_empty() {
            aliases.push(value.trim_matches('"').trim_matches('\'').to_string());
        } else {
            // YAML block-list form:
            // aliases:
            //   - Friendly Name
            //   - Alternate
            let parent_indent = line.len().saturating_sub(line.trim_start().len());
            let mut next = index + 1;
            while next < lines.len() {
                let candidate = lines[next];
                let candidate_trimmed = candidate.trim();
                if candidate_trimmed.is_empty() {
                    next += 1;
                    continue;
                }
                let indent = candidate.len().saturating_sub(candidate.trim_start().len());
                if indent <= parent_indent {
                    break;
                }
                let Some(item) = candidate_trimmed.strip_prefix('-') else {
                    break;
                };
                let alias = item.trim().trim_matches('"').trim_matches('\'');
                if !alias.is_empty() {
                    aliases.push(alias.to_string());
                }
                next += 1;
            }
            index = next.saturating_sub(1);
        }
        index += 1;
    }

    // First occurrence wins, in the order the author wrote them: frontmatter aliases are
    // surfaced to the user as declared, so sorting them here would reorder the note's list.
    let mut seen = std::collections::HashSet::new();
    aliases.retain(|alias| seen.insert(alias.clone()));
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
    TAG_RE
        .captures_iter(body)
        .filter_map(|capture| capture.get(1).map(|value| value.as_str().to_string()))
        .collect()
}

fn extract_headings(body: &str) -> Vec<String> {
    let mut headings = Vec::new();
    let mut fence: Option<(char, usize)> = None;

    for line in body.lines() {
        let trimmed = line.trim_start();
        if let Some((marker, length)) = fence {
            let run = trimmed.chars().take_while(|ch| *ch == marker).count();
            if run >= length {
                fence = None;
            }
            continue;
        }

        if let Some(marker) = trimmed.chars().next().filter(|ch| matches!(ch, '`' | '~')) {
            let run = trimmed.chars().take_while(|ch| *ch == marker).count();
            if run >= 3 {
                fence = Some((marker, run));
                continue;
            }
        }

        let level = trimmed.chars().take_while(|ch| *ch == '#').count();
        if !(1..=6).contains(&level) {
            continue;
        }
        let rest = &trimmed[level..];
        let Some(rest) = rest.strip_prefix([' ', '\t']) else {
            continue;
        };
        let heading = rest.trim().trim_end_matches('#').trim();
        if !heading.is_empty() {
            headings.push(heading.to_string());
        }
    }

    headings
}

fn extract_links(body: &str) -> Vec<ParsedLink> {
    let mut links = Vec::new();

    for (index, line) in body.lines().enumerate() {
        let line_number = (index + 1) as u32;

        for capture in WIKILINK_RE.captures_iter(line) {
            let target = capture
                .get(1)
                .map(|value| value.as_str().trim())
                .unwrap_or("");
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

        for capture in MARKDOWN_LINK_RE.captures_iter(line) {
            let label = capture
                .get(1)
                .map(|value| value.as_str())
                .unwrap_or("")
                .to_string();
            let target = capture
                .get(2)
                .map(|value| value.as_str())
                .unwrap_or("")
                .to_string();
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
        let markdown =
            include_str!("../../../packages/test-fixtures/vaults/minimal/Research Plan.md");
        let parsed = parse_note_markdown("Research Plan.md", markdown);

        assert_eq!(parsed.title, "Research Plan");
        assert_eq!(parsed.links.len(), 2);
        assert!(
            parsed
                .links
                .iter()
                .all(|link| link.kind == ParsedLinkKind::Wikilink)
        );
    }

    #[test]
    fn extracts_aliases_from_frontmatter() {
        let markdown = "---\naliases: [Friendly Name, Alt]\n---\n\n# Body\n";
        let parsed = parse_note_markdown("Alias Target.md", markdown);
        assert_eq!(parsed.aliases, vec!["Friendly Name", "Alt"]);
    }

    #[test]
    fn yaml_block_sequences_are_valid_frontmatter() {
        let markdown =
            "---\naliases:\n  - One\n  - Two\ntemplate: |\n  hello\n  world\n---\n\n# Body\n";
        let parsed = parse_note_markdown("Block.md", markdown);
        assert!(
            parsed.frontmatter_valid,
            "block YAML continuations must be accepted"
        );
    }

    #[test]
    fn extracts_aliases_from_yaml_block_list() {
        let markdown = "---\naliases:\n  - Friendly Name\n  - 'Alt Name'\n---\n\n# Body\n";
        let parsed = parse_note_markdown("Alias Target.md", markdown);
        assert_eq!(parsed.aliases, vec!["Alt Name", "Friendly Name"]);
    }

    #[test]
    fn extracts_all_atx_heading_levels_but_not_fenced_examples() {
        let markdown = "# One\n## Two\n###### Six\n```md\n### Not a heading\n```\n#### Four ###\n";
        let parsed = parse_note_markdown("Headings.md", markdown);
        assert_eq!(parsed.headings, vec!["One", "Two", "Six", "Four"]);
    }

    #[test]
    fn unterminated_frontmatter_does_not_expose_raw_markdown_as_body() {
        let markdown = "---\nsecret: do-not-index\n# Still frontmatter\n";
        let parsed = parse_note_markdown("Private.md", markdown);

        assert!(!parsed.frontmatter_valid);
        assert_eq!(
            parsed.frontmatter_error.as_deref(),
            Some("unterminated frontmatter")
        );
        assert!(parsed.body.is_empty());
        assert!(parsed.tags.is_empty());
        assert!(parsed.headings.is_empty());
    }
}
