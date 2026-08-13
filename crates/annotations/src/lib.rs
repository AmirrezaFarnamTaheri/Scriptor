//! Annotation anchoring for Scriptor (W3-7).
//!
//! # Two-stage anchoring
//!
//! An `Annotation` stores a primary anchor (byte offsets) and a quote excerpt.
//! When the note body changes and the primary range is stale, the anchoring
//! pipeline tries two stages in order:
//!
//! 1. **Exact**: the bytes at `[start..end]` still equal the stored quote →
//!    annotation is `Live` at the original position.
//! 2. **Fuzzy-quote**: scan the updated body for the best substring match of the
//!    stored quote (using normalised edit-distance); if the best match is above
//!    the confidence threshold the annotation is `Relocated` to the new range.
//! 3. **Orphaned**: no confident match → the annotation is `Orphaned` and the
//!    caller must notify the UI without silently moving or discarding it.
//!
//! The `Selector` enum models three annotation kinds: a plain text range
//! (`TextRange`), a PDF page + quote (`PdfQuote`), and an EPUB CFI + quote
//! (`EpubCfi`). Only `TextRange` goes through two-stage re-anchoring; the PDF
//! and EPUB variants carry their own opaque locator and are always reported as
//! `Live` if the locator parses correctly.

pub mod anchor;
pub mod error;
pub mod selector;

pub use anchor::{AnchorOutcome, reanchor};
pub use error::AnnotationError;
pub use selector::{ByteRange, EpubCfiSelector, PdfQuoteSelector, Selector, TextRangeSelector};
