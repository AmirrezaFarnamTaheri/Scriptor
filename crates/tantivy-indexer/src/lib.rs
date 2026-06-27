use std::path::Path;

use tantivy::collector::TopDocs;
use tantivy::doc;
use tantivy::query::QueryParser;
use tantivy::schema::{Schema, Value, STORED, TEXT};
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
}

impl TantivyIndex {
    pub fn create_or_open(path: &Path) -> Result<Self, TantivyError> {
        std::fs::create_dir_all(path)?;

        let mut schema_builder = Schema::builder();
        let path_field = schema_builder.add_text_field("path", TEXT | STORED);
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

        Ok(Self {
            index,
            reader,
            schema,
            path_field,
            title_field,
            body_field,
        })
    }

    pub fn index_note(&self, path: &str, title: &str, body: &str) -> Result<(), TantivyError> {
        let mut writer: IndexWriter = self.index.writer(50_000_000)?;

        let term = tantivy::Term::from_field_text(self.path_field, path);
        writer.delete_term(term);

        writer.add_document(doc!(
            self.path_field => path,
            self.title_field => title,
            self.body_field => body,
        ))?;

        writer.commit()?;
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
}
