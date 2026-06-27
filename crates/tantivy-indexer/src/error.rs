use thiserror::Error;

#[derive(Debug, Error)]
pub enum TantivyError {
    #[error("tantivy error: {0}")]
    Tantivy(#[from] tantivy::error::TantivyError),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("query parse error: {0}")]
    QueryParse(#[from] tantivy::query::QueryParserError),
    #[error("doc not found: {0}")]
    DocNotFound(String),
}
