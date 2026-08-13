//! `Selector` enum — models the three annotation target kinds.
//!
//! All variants are serialisable so they round-trip through the `anchor_json`
//! column in the SQLite `annotations` table without schema changes.

use serde::{Deserialize, Serialize};

/// A half-open byte range `[start, end)` into a UTF-8 note body.
///
/// Invariant: `start <= end` and both values are valid byte positions (not
/// interior to a multi-byte codepoint). Callers are responsible for enforcing
/// this; `ByteRange::new` returns `None` if the invariant is violated.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ByteRange {
    pub start: usize,
    pub end: usize,
}

impl ByteRange {
    /// Construct a `ByteRange`, returning `None` when `start > end`.
    pub fn new(start: usize, end: usize) -> Option<Self> {
        if start <= end {
            Some(Self { start, end })
        } else {
            None
        }
    }

    /// Length in bytes.
    pub fn len(&self) -> usize {
        self.end - self.start
    }

    pub fn is_empty(&self) -> bool {
        self.start == self.end
    }
}

/// Annotation selector for plain-text (Markdown) note bodies.
///
/// `range` is the authoritative byte position in the *original* body at the
/// time the annotation was created. `quote` is a short excerpt (typically the
/// selected text) used as the fuzzy fallback during re-anchoring.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TextRangeSelector {
    pub range: ByteRange,
    /// Verbatim excerpt of the annotated text. Should be ≤ 512 bytes;
    /// the fuzzy-quote stage trims longer quotes to the first 512 bytes.
    pub quote: String,
}

/// Annotation selector for a highlighted region inside a PDF file.
///
/// `page` is 1-indexed. `quote` is the extracted text of the selection as
/// reported by pdf.js. `locator` is the raw pdf.js highlight serialisation
/// (opaque to this crate — stored and returned as-is).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PdfQuoteSelector {
    pub page: u32,
    pub quote: String,
    /// Raw pdf.js / pdf-lib highlight descriptor (JSON string).
    pub locator: String,
}

/// Annotation selector for a highlighted region inside an EPUB file.
///
/// `cfi` is an EPUB CFI string (e.g. `epubcfi(/6/4[chapter01]!/4/1:0)`).
/// `quote` is the extracted text of the selection.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EpubCfiSelector {
    pub cfi: String,
    pub quote: String,
}

/// The three target kinds an annotation can reference.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Selector {
    /// Plain-text / Markdown note body (supports two-stage re-anchoring).
    TextRange(TextRangeSelector),
    /// PDF highlight (locator is opaque; reported as `Live` if the CFI parses).
    PdfQuote(PdfQuoteSelector),
    /// EPUB CFI highlight.
    EpubCfi(EpubCfiSelector),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn byte_range_rejects_inverted() {
        assert!(ByteRange::new(10, 5).is_none());
    }

    #[test]
    fn byte_range_allows_empty() {
        let r = ByteRange::new(3, 3).unwrap();
        assert!(r.is_empty());
    }

    #[test]
    fn selector_text_range_round_trips_json() {
        let sel = Selector::TextRange(TextRangeSelector {
            range: ByteRange::new(0, 10).unwrap(),
            quote: "hello world".into(),
        });
        let json = serde_json::to_string(&sel).unwrap();
        let back: Selector = serde_json::from_str(&json).unwrap();
        assert_eq!(sel, back);
    }

    #[test]
    fn selector_pdf_round_trips_json() {
        let sel = Selector::PdfQuote(PdfQuoteSelector {
            page: 3,
            quote: "relevant passage".into(),
            locator: r#"{"highlight":"xyz"}"#.into(),
        });
        let json = serde_json::to_string(&sel).unwrap();
        let back: Selector = serde_json::from_str(&json).unwrap();
        assert_eq!(sel, back);
    }

    #[test]
    fn selector_epub_cfi_round_trips_json() {
        let sel = Selector::EpubCfi(EpubCfiSelector {
            cfi: "epubcfi(/6/4[ch01]!/4/1:0)".into(),
            quote: "chapter text".into(),
        });
        let json = serde_json::to_string(&sel).unwrap();
        let back: Selector = serde_json::from_str(&json).unwrap();
        assert_eq!(sel, back);
    }
}
