use std::path::Path;
use std::sync::Mutex;

use tantivy::collector::TopDocs;
use tantivy::doc;
use tantivy::query::QueryParser;
use tantivy::schema::{Schema, Value, STORED, STRING, TEXT};
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy};

pub mod error;

pub use error::TantivyError;

pub struct SearchHit {
    pub path: String,
    pub title: String,
    pub body_snippet: String,
    pub score: f32,
}

pub struct TantivyIndex {
    index: Index,
    reader: IndexReader,
    #[allow(dead_code)]
    schema: Schema,
    path_field: tantivy::schema::Field,
    title_field: tantivy::schema::Field,
    body_field: tantivy::schema::Field,
    writer: Mutex<IndexWriter>,
}

impl TantivyIndex {
    pub fn create_or_open(path: &Path) -> Result<Self, TantivyError> {
        std::fs::create_dir_all(path)?;

        let mut schema_builder = Schema::builder();
        let path_field = schema_builder.add_text_field("path", STRING | STORED);
        let title_field = schema_builder.add_text_field("title", TEXT | STORED);
        let body_field = schema_builder.add_text_field("body", TEXT | STORED);
        let schema = schema_builder.build();

        let index = if path.join("meta.json").exists() {
            Index::open_in_dir(path)?
        } else {
            Index::create_in_dir(path, schema.clone())?
        };

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        let writer: IndexWriter = index.writer(50_000_000)?;

        Ok(Self {
            index,
            reader,
            schema,
            path_field,
            title_field,
            body_field,
            writer: Mutex::new(writer),
        })
    }

    pub fn index_note(&self, path: &str, title: &str, body: &str) -> Result<(), TantivyError> {
        let mut writer = self.writer.lock().map_err(|e| {
            TantivyError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
        })?;

        let term = tantivy::Term::from_field_text(self.path_field, path);
        writer.delete_term(term);

        writer.add_document(doc!(
            self.path_field => path,
            self.title_field => title,
            self.body_field => body,
        ))?;

        writer.commit()?;
        self.reader.reload()?;
        Ok(())
    }

    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SearchHit>, TantivyError> {
        let searcher = self.reader.searcher();
        let query_parser = QueryParser::for_index(
            &self.index,
            vec![self.title_field, self.body_field],
        );
        let query = query_parser.parse_query(query)?;
        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;

        let mut results = Vec::new();
        for (score, doc_address) in top_docs {
            let doc = searcher.doc::<tantivy::TantivyDocument>(doc_address)?;
            let path = doc
                .get_first(self.path_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let title = doc
                .get_first(self.title_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let body_snippet = doc
                .get_first(self.body_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .chars()
                .take(200)
                .collect();

            results.push(SearchHit {
                path,
                title,
                body_snippet,
                score,
            });
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn index_and_search_note() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();

        index
            .index_note("notes/hello.md", "Hello World", "This is a test note about rust")
            .unwrap();
        index
            .index_note("notes/other.md", "Other Note", "Nothing interesting here")
            .unwrap();

        let hits = index.search("rust", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "notes/hello.md");
        assert_eq!(hits[0].title, "Hello World");
    }

    #[test]
    fn reindex_replaces_document() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();

        index.index_note("a.md", "Title V1", "body v1").unwrap();
        index.index_note("a.md", "Title V2", "body v2").unwrap();

        let hits = index.search("v2", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Title V2");
    }

    #[test]
    fn search_respects_limit() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();

        for i in 0..10 {
            index
                .index_note(&format!("n{i}.md"), &format!("Note {i}"), "common body text")
                .unwrap();
        }

        let hits = index.search("common", 3).unwrap();
        assert!(hits.len() <= 3);
    }

    #[test]
    fn special_characters_in_query() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();
        index
            .index_note("note.md", "C++ Guide", "Learn C++ programming")
            .unwrap();
        let hits = index.search("C++", 10).unwrap();
        assert!(!hits.is_empty(), "should find notes with C++ in title/body");
    }

    #[test]
    fn empty_body_indexable() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();
        index
            .index_note("empty.md", "Empty Note", "")
            .unwrap();
        let hits = index.search("Empty", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "empty.md");
    }

    #[test]
    fn reindex_idempotent() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();
        index
            .index_note("a.md", "Title", "body content")
            .unwrap();
        index
            .index_note("a.md", "Title", "body content")
            .unwrap();
        let hits = index.search("body", 10).unwrap();
        assert_eq!(hits.len(), 1, "reindexing same path should not duplicate");
    }

    #[test]
    fn empty_search_returns_empty() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();
        index
            .index_note("a.md", "Title", "body")
            .unwrap();
        let hits = index.search("nonexistent_term_xyz", 10).unwrap();
        assert!(hits.is_empty());
    }

    #[test]
    fn search_returns_title_and_snippet() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();
        index
            .index_note("test.md", "My Title", "The body contains searchable keywords")
            .unwrap();
        let hits = index.search("searchable", 1).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "My Title");
        assert!(hits[0].body_snippet.contains("searchable"));
    }

    #[test]
    fn concurrent_writes_do_not_panic() {
        use std::sync::Arc;
        use std::thread;

        let dir = tempdir().unwrap();
        let index = Arc::new(TantivyIndex::create_or_open(dir.path()).unwrap());
        let mut handles = Vec::new();
        for i in 0..6 {
            let idx = Arc::clone(&index);
            handles.push(thread::spawn(move || {
                idx.index_note(
                    &format!("concurrent/{i}.md"),
                    &format!("Title {i}"),
                    &format!("body content for note {i}"),
                )
                .unwrap();
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        let hits = index.search("body", 10).unwrap();
        assert!(hits.len() >= 1);
    }

    #[test]
    fn unicode_query_works() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();
        index
            .index_note("uni.md", "Ünïcödé Title", "special characters content")
            .unwrap();
        let hits = index.search("Ünïcödé", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "uni.md");
    }

    #[test]
    fn special_chars_in_path_roundtrip() {
        let dir = tempdir().unwrap();
        let index = TantivyIndex::create_or_open(dir.path()).unwrap();
        index
            .index_note("notes/C++ & Rust.md", "C++ & Rust", "systems programming")
            .unwrap();
        let hits = index.search("Rust", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "notes/C++ & Rust.md");
    }
}
