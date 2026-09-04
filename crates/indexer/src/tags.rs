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

pub fn list_vault_tags(
    cache: &IndexCache,
    vault_id: &str,
) -> Result<Vec<TagSummary>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement = conn.prepare_cached(
        "SELECT tag, COUNT(*)
         FROM (
             SELECT json_each.value AS tag
             FROM (
                 SELECT tags_json FROM notes
                 WHERE vault_id = ?1 AND json_valid(tags_json)
             ) AS valid_notes, json_each(valid_notes.tags_json)
         )
         GROUP BY tag
         ORDER BY tag",
    )?;
    let rows = statement.query_map(params![vault_id], |row| {
        let count: i64 = row.get(1)?;
        Ok(TagSummary {
            tag: row.get(0)?,
            note_count: usize::try_from(count).unwrap_or(usize::MAX),
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn notes_for_tag(
    cache: &IndexCache,
    vault_id: &str,
    tag: &str,
) -> Result<Vec<TaggedNote>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement = conn.prepare_cached(
        "SELECT n.path, n.title
         FROM notes n
         WHERE n.vault_id = ?1
           AND json_valid(n.tags_json)
           AND EXISTS (
               SELECT 1 FROM json_each(n.tags_json) AS jt WHERE jt.value = ?2
           )
         ORDER BY n.title COLLATE NOCASE, n.path",
    )?;
    let rows = statement.query_map(params![vault_id, tag], |row| {
        Ok(TaggedNote {
            path: row.get(0)?,
            title: row.get(1)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::IndexCache;
    use crate::notes::upsert_note;
    use scriptor_vault::{RelativeVaultPath, metadata_from_markdown};
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
            let metadata = metadata_from_markdown(
                vault_id,
                &relative,
                markdown,
                "2026-01-01T00:00:00Z".into(),
            );
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
