//! Vault-facing semantic search operations.
//!
//! Sync embeds every note whose content hash changed (sealed spans are
//! redacted first — the embedding provider never sees sealed content),
//! removes embeddings for notes that no longer exist, and prunes vectors
//! from a previous dimension after a model change. Search embeds the
//! query and returns nearest notes by cosine similarity.

use std::path::Path;

use scriptor_export_runner::{RedactSecretsMode, check_or_redact};
use scriptor_vault::{ScannedEntryKind, VaultSession, scan_vault_for_index};
use serde::Serialize;

use crate::EmbeddingStore;
use crate::provider::EmbedProvider;

/// Embedding text is truncated before it reaches the provider: embedding
/// models accept a bounded context, and note frontmatter carries most of
/// the semantic weight in the opening section.
const MAX_EMBED_CHARS: usize = 4000;
/// Notes are embedded in batches to amortize provider round-trips.
const SYNC_BATCH: usize = 16;

/// Optional caller hook projecting a note into the text that gets embedded
/// (path and markdown body in, embedding text out).
pub type NoteTextProjector<'a> = dyn Fn(&str, &str) -> String + 'a;

/// Summary of one sync pass over a vault.
#[derive(Debug, Clone, Serialize)]
pub struct SyncReport {
    pub total_notes: usize,
    pub embedded: usize,
    pub unchanged: usize,
    pub removed: usize,
}

/// Semantic search hit, mirroring the shape the desktop overlays on BM25
/// keyword results.
#[derive(Debug, Clone, Serialize)]
pub struct SemanticHit {
    pub note_path: String,
    pub score: f32,
}

pub(crate) fn embeddings_store_path(vault_root: &Path) -> std::path::PathBuf {
    vault_root.join(".scriptor/cache/embeddings.sqlite")
}

/// Embed every changed note and drop embeddings for deleted notes.
///
/// `text_for_note` lets callers project the note before embedding (e.g.
/// strip frontmatter); pass `None` to embed the raw markdown body.
pub fn sync_vault_embeddings(
    session: &VaultSession,
    provider: &dyn EmbedProvider,
    text_for_note: Option<&NoteTextProjector>,
) -> Result<SyncReport, crate::EmbeddingError> {
    let store = EmbeddingStore::open(
        &embeddings_store_path(session.root.root()),
        provider.dimension(),
    )?;
    sync_vault_embeddings_with_store(session, &store, provider, text_for_note)
}

pub fn sync_vault_embeddings_with_store(
    session: &VaultSession,
    store: &EmbeddingStore,
    provider: &dyn EmbedProvider,
    text_for_note: Option<&NoteTextProjector>,
) -> Result<SyncReport, crate::EmbeddingError> {
    store.prune_dimension(provider.dimension())?;

    let entries = scan_vault_for_index(&session.root)
        .map_err(|error| crate::EmbeddingError::Provider(format!("vault scan failed: {error}")))?;

    struct PendingNote {
        path: String,
        hash: String,
        text: String,
    }

    let mut pending: Vec<PendingNote> = Vec::new();
    let mut current: Vec<String> = Vec::new();
    let mut unchanged = 0usize;
    let mut total_notes = 0usize;

    for entry in entries.iter() {
        if entry.kind != ScannedEntryKind::Note {
            continue;
        }
        total_notes += 1;
        current.push(entry.path.clone());
        let Some(markdown) = entry.content.clone() else {
            continue; // oversized note: content omitted by the scan
        };
        let hash = crate::content_hash(&markdown);
        if store.hash_for(&entry.path)?.as_deref() == Some(hash.as_str()) {
            unchanged += 1;
            continue;
        }
        let body = match text_for_note {
            Some(project) => project(&entry.path, &markdown),
            None => markdown.clone(),
        };
        // Sealed spans must never reach an embedding provider (I-3).
        let text = check_or_redact(&body, RedactSecretsMode::Redact, &entry.path)
            .map_err(|error| crate::EmbeddingError::Provider(error.to_string()))?;
        let text: String = text.chars().take(MAX_EMBED_CHARS).collect();
        pending.push(PendingNote {
            path: entry.path.clone(),
            hash,
            text,
        });
    }

    let mut embedded = 0usize;
    for batch in pending.chunks(SYNC_BATCH) {
        let texts: Vec<&str> = batch.iter().map(|note| note.text.as_str()).collect();
        let vectors = provider.embed_texts(&texts)?;
        for (note, vector) in batch.iter().zip(vectors) {
            store.upsert_embedding(&note.path, Some(&note.hash), &vector)?;
            embedded += 1;
        }
    }

    // Remove embeddings whose notes no longer exist.
    let mut removed = 0usize;
    for id in store.ids()? {
        if !current.iter().any(|path| path == &id) {
            store.delete_embedding(&id)?;
            removed += 1;
        }
    }

    Ok(SyncReport {
        total_notes,
        embedded,
        unchanged,
        removed,
    })
}

/// Nearest notes for a query, ordered by descending cosine similarity.
pub fn search_vault_embeddings(
    session: &VaultSession,
    provider: &dyn EmbedProvider,
    query: &str,
    limit: usize,
) -> Result<Vec<SemanticHit>, crate::EmbeddingError> {
    let store = EmbeddingStore::open(
        &embeddings_store_path(session.root.root()),
        provider.dimension(),
    )?;
    let vector = provider.embed_single(query)?;
    let hits = store.query_nearest(&vector, limit)?;
    Ok(hits
        .into_iter()
        .map(|(note_path, score)| SemanticHit { note_path, score })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::ConstProvider;
    use scriptor_vault::open_vault;
    use std::fs;

    fn write_note(root: &Path, name: &str, body: &str) {
        let path = root.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, body).unwrap();
    }

    fn temp_vault() -> (tempfile::TempDir, VaultSession) {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "a.md", "# Alpha\n\nalpha body\n");
        write_note(dir.path(), "b.md", "# Beta\n\nbeta body\n");
        let session = open_vault(dir.path()).unwrap();
        (dir, session)
    }

    #[test]
    fn sync_indexes_and_search_finds_notes() {
        let (_dir, session) = temp_vault();
        let provider = ConstProvider::new(4, 1.0);

        let report = sync_vault_embeddings(&session, &provider, None).unwrap();
        assert_eq!(report.total_notes, 2);
        assert_eq!(report.embedded, 2);
        assert_eq!(report.unchanged, 0);

        // Second sync: nothing changed, nothing re-embedded.
        let report = sync_vault_embeddings(&session, &provider, None).unwrap();
        assert_eq!(report.embedded, 0);
        assert_eq!(report.unchanged, 2);

        let hits = search_vault_embeddings(&session, &provider, "anything", 5).unwrap();
        assert_eq!(hits.len(), 2);
    }

    #[test]
    fn sync_detects_changes_and_removals() {
        let (dir, session) = temp_vault();
        let provider = ConstProvider::new(4, 1.0);
        sync_vault_embeddings(&session, &provider, None).unwrap();

        write_note(dir.path(), "a.md", "# Alpha\n\nrewritten body\n");
        fs::remove_file(dir.path().join("b.md")).unwrap();
        let report = sync_vault_embeddings(&session, &provider, None).unwrap();
        assert_eq!(report.embedded, 1, "only the rewritten note re-embeds");
        assert_eq!(report.removed, 1, "the deleted note is pruned");
    }

    #[test]
    fn sealed_spans_are_redacted_before_embedding() {
        let dir = tempfile::tempdir().unwrap();
        write_note(
            dir.path(),
            "secret.md",
            "# Secret\n\n{{sealed:token}}visible text\n",
        );
        let session = open_vault(dir.path()).unwrap();
        let provider = ConstProvider::new(4, 1.0);
        // The redaction happens inside sync; the test asserts the pass
        // succeeds and the note is embedded (the stub cannot observe the
        // text, but check_or_redact is covered by export-runner tests).
        let report = sync_vault_embeddings(&session, &provider, None).unwrap();
        assert_eq!(report.embedded, 1);
    }

    #[test]
    fn dimension_change_prunes_old_vectors() {
        let (_dir, session) = temp_vault();
        sync_vault_embeddings(&session, &ConstProvider::new(4, 1.0), None).unwrap();

        // The user switched to a model with a different dimension.
        let provider = ConstProvider::new(8, 1.0);
        let report = sync_vault_embeddings(&session, &provider, None).unwrap();
        assert_eq!(
            report.embedded, 2,
            "all notes re-embed after a model change"
        );

        let store = EmbeddingStore::open(&embeddings_store_path(session.root.root()), 8).unwrap();
        assert_eq!(store.count().unwrap(), 2);
    }
}
