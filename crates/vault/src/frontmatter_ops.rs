use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::link_rewrite::{join_frontmatter, split_frontmatter};
use crate::{RelativeVaultPath, VaultRoot, read_note, save_note};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FrontmatterFieldOutput {
    pub path: String,
    pub field: String,
    pub value: Option<String>,
    pub markdown: String,
}

/// Applies a single-line YAML cell while preserving the loaded revision and body.
pub fn write_frontmatter_field(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
    field: &str,
    value: &str,
    expected_content_hash: Option<&str>,
) -> Result<FrontmatterFieldOutput, VaultError> {
    let document = read_note(vault_id, root, path)?;
    let markdown = set_frontmatter_field(&document.markdown, field, value)?;
    save_note(
        vault_id,
        root,
        path,
        &markdown,
        Some(expected_content_hash.unwrap_or(&document.metadata.content_hash)),
    )?;
    Ok(FrontmatterFieldOutput {
        path: path.to_string(),
        field: field.into(),
        value: Some(value.into()),
        markdown,
    })
}

pub fn get_frontmatter_field(markdown: &str, field: &str) -> Option<String> {
    let (Some(fm), _) = split_frontmatter(markdown) else {
        return None;
    };
    parse_field(&fm, field)
}

pub fn set_frontmatter_field(
    markdown: &str,
    field: &str,
    value: &str,
) -> Result<String, VaultError> {
    if field.is_empty()
        || field.len() > 128
        || !field
            .chars()
            .all(|ch| ch.is_alphanumeric() || matches!(ch, '_' | '-'))
        || value.len() > 65_536
        || value.chars().any(|ch| ch.is_control())
    {
        return Err(VaultError::InvalidConfig {
            message: "Frontmatter cells require a bounded key and single-line value".into(),
        });
    }
    let (frontmatter, body) = split_frontmatter(markdown);
    if frontmatter.is_none() && (markdown.starts_with("---\n") || markdown.starts_with("---\r\n")) {
        return Err(VaultError::InvalidConfig {
            message: "Close the frontmatter delimiter before editing cells".into(),
        });
    }
    let mut lines: Vec<String> = frontmatter
        .as_deref()
        .map(|fm| fm.lines().map(str::to_string).collect())
        .unwrap_or_default();

    let key_pattern = format!(r"^{}:", regex::escape(field));
    let key_re = Regex::new(&key_pattern).expect("valid field regex");
    // Preserve unfamiliar YAML key syntax in the source editor. A line-based
    // cell editor cannot safely distinguish escaped keys, aliases or explicit
    // mappings from the target field without a full YAML parser.
    if lines.iter().any(|line| {
        line.trim_start()
            .starts_with(['\'', '"', '?', '&', '*', '{', '['])
            || line
                .split_once(':')
                .is_some_and(|(key, _)| key.trim() == field && !key_re.is_match(line))
    }) {
        return Err(VaultError::InvalidConfig {
            message: "Edit quoted, noncanonical or complex YAML keys in the note source".into(),
        });
    }
    let matches: Vec<usize> = lines
        .iter()
        .enumerate()
        .filter_map(|(index, line)| key_re.is_match(line).then_some(index))
        .collect();
    if matches.len() > 1
        || matches.first().is_some_and(|index| {
            let value = lines[*index]
                .split_once(':')
                .map_or("", |(_, value)| value.trim());
            value.starts_with(['|', '>'])
                || lines.get(*index + 1).is_some_and(|line| {
                    !line.trim().is_empty() && (line.starts_with(' ') || line.starts_with('\t'))
                })
        })
    {
        return Err(VaultError::InvalidConfig {
            message: "Edit duplicate or structured frontmatter fields in the note source".into(),
        });
    }
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
    let joined = if lines.is_empty() {
        None
    } else {
        Some(lines.join("\n"))
    };
    Ok(join_frontmatter(joined.as_deref(), &body))
}

fn parse_field(frontmatter: &str, field: &str) -> Option<String> {
    let key_pattern = format!(r"^{}:\s*(.*)$", regex::escape(field));
    let key_re = Regex::new(&key_pattern).expect("valid field regex");
    for line in frontmatter.lines() {
        if let Some(caps) = key_re.captures(line) {
            return caps
                .get(1)
                .map(|value| value.as_str().trim().trim_matches('"').to_string());
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
        assert_eq!(
            get_frontmatter_field(&updated, "status"),
            Some("draft".into())
        );
    }

    #[test]
    fn rejects_editing_structured_or_ambiguous_cells() {
        for source in [
            "---\nstatus: |\n  draft\n---\nBody\n",
            "---\nstatus:\n  nested: draft\n---\nBody\n",
            "---\nstatus: draft\nstatus: approved\n---\nBody\n",
            "---\nstatus: draft\nBody without closing delimiter\n",
            "---\n\"status\": draft\n---\nBody\n",
            "---\n'status': draft\n---\nBody\n",
            "---\nstatus : draft\n---\nBody\n",
        ] {
            assert!(set_frontmatter_field(source, "status", "ready").is_err());
        }
    }
}
