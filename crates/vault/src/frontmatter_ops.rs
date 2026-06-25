use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::link_rewrite::{join_frontmatter, split_frontmatter};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FrontmatterFieldOutput {
    pub path: String,
    pub field: String,
    pub value: Option<String>,
    pub markdown: String,
}

pub fn get_frontmatter_field(markdown: &str, field: &str) -> Option<String> {
    let (Some(fm), _) = split_frontmatter(markdown) else {
        return None;
    };
    parse_field(&fm, field)
}

pub fn set_frontmatter_field(markdown: &str, field: &str, value: &str) -> Result<String, VaultError> {
    let (frontmatter, body) = split_frontmatter(markdown);
    let mut lines: Vec<String> = frontmatter
        .as_deref()
        .map(|fm| fm.lines().map(str::to_string).collect())
        .unwrap_or_default();

    let key_pattern = format!(r"^{}:", regex::escape(field));
    let key_re = Regex::new(&key_pattern).expect("valid field regex");
    let mut replaced = false;
    for line in lines.iter_mut() {
        if key_re.is_match(line) {
            *line = format!("{field}: {value}");
            replaced = true;
            break;
        }
    }
    if !replaced {
        lines.push(format!("{field}: {value}"));
    }

    let joined = Some(lines.join("\n"));
    Ok(join_frontmatter(joined.as_deref(), &body))
}

pub fn delete_frontmatter_field(markdown: &str, field: &str) -> Result<String, VaultError> {
    let (frontmatter, body) = split_frontmatter(markdown);
    let Some(fm) = frontmatter else {
        return Ok(markdown.to_string());
    };
    let key_pattern = format!(r"^{}:", regex::escape(field));
    let key_re = Regex::new(&key_pattern).expect("valid field regex");
    let lines: Vec<String> = fm
        .lines()
        .filter(|line| !key_re.is_match(line))
        .map(str::to_string)
        .collect();
    let joined = if lines.is_empty() { None } else { Some(lines.join("\n")) };
    Ok(join_frontmatter(joined.as_deref(), &body))
}

fn parse_field(frontmatter: &str, field: &str) -> Option<String> {
    let key_pattern = format!(r"^{}:\s*(.*)$", regex::escape(field));
    let key_re = Regex::new(&key_pattern).expect("valid field regex");
    for line in frontmatter.lines() {
        if let Some(caps) = key_re.captures(line) {
            return caps.get(1).map(|value| value.as_str().trim().trim_matches('"').to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sets_and_reads_frontmatter_field() {
        let source = "# Title\n";
        let updated = set_frontmatter_field(source, "status", "draft").unwrap();
        assert_eq!(get_frontmatter_field(&updated, "status"), Some("draft".into()));
    }
}
