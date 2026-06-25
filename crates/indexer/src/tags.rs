use std::collections::BTreeMap;

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::IndexCache;
use crate::error::IndexerError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TagSummary {
    pub tag: String,
    pub note_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaggedNote {
    pub path: String,
    pub title: String,
}

pub fn list_vault_tags(cache: &IndexCache, vault_id: &str) -> Result<Vec<TagSummary>, IndexerError> {
    let mut statement = cache
        .connection()
        .prepare("SELECT tags_json FROM notes WHERE vault_id = ?1")?;

    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    let rows = statement.query_map(params![vault_id], |row| row.get::<_, String>(0))?;

    for tags_json in rows {
        let tags_json = tags_json?;
        let tags: Vec<String> = serde_json::from_str(&tags_json)?;
        for tag in tags {
            *counts.entry(tag).or_insert(0) += 1;
        }
    }

    Ok(counts
        .into_iter()
        .map(|(tag, note_count)| TagSummary { tag, note_count })
        .collect())
}

pub fn notes_for_tag(
    cache: &IndexCache,
    vault_id: &str,
    tag: &str,
) -> Result<Vec<TaggedNote>, IndexerError> {
    let mut statement = cache.connection().prepare(
        "SELECT path, title, tags_json FROM notes WHERE vault_id = ?1 ORDER BY title COLLATE NOCASE",
    )?;

    let mut notes = Vec::new();
    let rows = statement.query_map(params![vault_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    for row in rows {
        let (path, title, tags_json) = row?;
        let tags: Vec<String> = serde_json::from_str(&tags_json)?;
        if tags.iter().any(|entry| entry == tag) {
            notes.push(TaggedNote { path, title });
        }
    }

    Ok(notes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::IndexCache;
    use crate::notes::upsert_note;
    use scriptor_vault::{metadata_from_markdown, RelativeVaultPath};
    use tempfile::tempdir;

    #[test]
    fn lists_tags_and_notes_for_tag() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let vault_id = "vault-tags";

        for (path, markdown) in [
            ("Alpha.md", "# Alpha\n\n#research #draft\n"),
            ("Beta.md", "# Beta\n\n#research\n"),
        ] {
            let relative = RelativeVaultPath::parse(path)?;
            let metadata = metadata_from_markdown(vault_id, &relative, markdown, "2026-01-01T00:00:00Z".into());
            upsert_note(&cache, &metadata, markdown)?;
        }

        let tags = list_vault_tags(&cache, vault_id)?;
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].tag, "draft");
        assert_eq!(tags[0].note_count, 1);
        assert_eq!(tags[1].tag, "research");
        assert_eq!(tags[1].note_count, 2);

        let research_notes = notes_for_tag(&cache, vault_id, "research")?;
        assert_eq!(research_notes.len(), 2);
        Ok(())
    }
}
