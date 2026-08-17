//! Two-stage annotation re-anchoring (W3-7).
//!
//! ## Algorithm
//!
//! Given an annotation's stored `TextRangeSelector` and a (potentially
//! updated) note body, `reanchor` determines the annotation's current status:
//!
//! ### Stage 1 — Exact match
//! If `body[range.start..range.end]` is valid UTF-8 and equals the stored
//! `quote`, the annotation is `Live` at the original position. This is O(1)
//! in the common case where the note is unchanged above and below the
//! annotation.
//!
//! ### Stage 2 — Fuzzy-quote search
//! If stage 1 fails (the body changed), we scan the body for the best
//! substring match of the stored `quote` using normalised edit-distance
//! (Levenshtein on Unicode scalar values). A match is accepted when its
//! normalised distance is ≤ `FUZZY_THRESHOLD` (0.25 — up to 25 % of the
//! quote's character length may differ). The search is limited to a window of
//! up to `MAX_SCAN_BYTES` bytes around the original range to bound latency on
//! very large notes.
//!
//! ### Stage 3 — Orphaned
//! When no confident match is found, the annotation is `Orphaned`. Callers
//! **must not** silently discard or relocate orphaned annotations; they should
//! surface them to the user.

use crate::error::AnnotationError;
use crate::selector::{ByteRange, Selector, TextRangeSelector};

// ── Tunables ────────────────────────────────────────────────────────────────

/// Maximum edit-distance ratio for the fuzzy-quote stage.
///
/// A match is accepted when `edit_distance(quote, candidate) / quote.chars().count()`
/// is ≤ this value. Set to 0.25 (25 %).
const FUZZY_THRESHOLD: f64 = 0.25;

/// Half-window (in bytes) around the original range scanned during fuzzy
/// search. Limits the fuzzy stage to O(WINDOW × quote_len) operations.
const HALF_WINDOW: usize = 4_096;

/// Maximum quote length (bytes) fed into the fuzzy stage. Longer stored
/// quotes are trimmed to this prefix to keep memory bounded.
const MAX_QUOTE_BYTES: usize = 512;

// ── Public types ─────────────────────────────────────────────────────────────

/// The outcome of `reanchor` for a single annotation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AnchorOutcome {
    /// The annotation is still at its original byte position.
    Live { range: ByteRange },
    /// The note body changed but the quote was found at a new position.
    Relocated {
        old_range: ByteRange,
        new_range: ByteRange,
    },
    /// No confident match found; the annotation is logically detached.
    Orphaned { old_range: ByteRange },
    /// The selector variant does not use byte-range anchoring; its locator is
    /// opaque (PDF / EPUB). Reported as `Live` for any non-null locator.
    OpaqueLocator,
}

// ── Entry point ──────────────────────────────────────────────────────────────

/// Re-anchor an annotation against the current note `body`.
///
/// # Errors
/// Returns `AnnotationError::RangeOutOfBounds` or `AnnotationError::NotCharBoundary`
/// only when the stored `TextRangeSelector.range` was already invalid against the
/// *original* body (i.e. the caller stored bad data). For normal drift (edits above
/// or below) the function gracefully proceeds to stage 2.
pub fn reanchor(selector: &Selector, body: &str) -> Result<AnchorOutcome, AnnotationError> {
    match selector {
        Selector::TextRange(sel) => reanchor_text_range(sel, body),
        Selector::PdfQuote(_) | Selector::EpubCfi(_) => Ok(AnchorOutcome::OpaqueLocator),
    }
}

// ── Stage implementation ─────────────────────────────────────────────────────

fn reanchor_text_range(
    sel: &TextRangeSelector,
    body: &str,
) -> Result<AnchorOutcome, AnnotationError> {
    let ByteRange { start, end } = sel.range;

    // ── Stage 1: exact match ─────────────────────────────────────────────────
    if let Some(exact) = try_exact(body, start, end, &sel.quote) {
        return Ok(exact);
    }

    // ── Stage 2: fuzzy-quote search ──────────────────────────────────────────
    let quote_trimmed = trim_to_bytes(&sel.quote, MAX_QUOTE_BYTES);
    if !quote_trimmed.is_empty()
        && let Some(new_range) = fuzzy_search(body, start, quote_trimmed)
    {
        return Ok(AnchorOutcome::Relocated {
            old_range: sel.range,
            new_range,
        });
    }

    // ── Stage 3: orphaned ────────────────────────────────────────────────────
    Ok(AnchorOutcome::Orphaned {
        old_range: sel.range,
    })
}

/// Attempt an exact match at the stored range.  Returns `None` when the range
/// is out of bounds *due to a body change* (not a data error).
fn try_exact(body: &str, start: usize, end: usize, quote: &str) -> Option<AnchorOutcome> {
    // Range must be within the body and on char boundaries.
    if end > body.len() {
        return None;
    }
    if !body.is_char_boundary(start) || !body.is_char_boundary(end) {
        return None;
    }
    let slice = &body[start..end];
    if slice == quote {
        Some(AnchorOutcome::Live {
            range: ByteRange { start, end },
        })
    } else {
        None
    }
}

/// Fuzzy-quote stage: scan a window of the body for the best substring match
/// of `quote`.  Returns the new `ByteRange` if a match above threshold is found.
///
/// The search aligns on character (not byte) boundaries by iterating over
/// `char_indices` of the window, keeping a sliding window of `quote_len` chars.
fn fuzzy_search(body: &str, original_start: usize, quote: &str) -> Option<ByteRange> {
    let quote_chars: Vec<char> = quote.chars().collect();
    let quote_len = quote_chars.len();
    if quote_len == 0 {
        return None;
    }

    // Compute the search window in bytes (clamped to body bounds).
    let window_start = original_start.saturating_sub(HALF_WINDOW);
    let window_end = (original_start
        .saturating_add(quote.len())
        .saturating_add(HALF_WINDOW))
    .min(body.len());

    // Snap window_start to the nearest char boundary.
    let window_start = snap_to_char_boundary(body, window_start);
    let window_body = &body[window_start..window_end];

    // Collect (byte_offset_in_window, char) pairs for the window.
    let char_offsets: Vec<(usize, char)> = window_body.char_indices().collect();
    let n = char_offsets.len();

    if n < quote_len {
        return None;
    }

    let mut best_distance = usize::MAX;
    let mut best_start_byte: Option<usize> = None;
    let mut best_end_byte: Option<usize> = None;

    // Slide a window of `quote_len` chars over the window body.
    for i in 0..=(n - quote_len) {
        // Extract candidate chars.
        let candidate: Vec<char> = char_offsets[i..i + quote_len]
            .iter()
            .map(|(_, c)| *c)
            .collect();

        let dist = levenshtein_chars(&quote_chars, &candidate);
        if dist < best_distance {
            best_distance = dist;
            let start_byte = window_start + char_offsets[i].0;
            // End byte: start of next char after the window, or end of window.
            let end_byte = if i + quote_len < n {
                window_start + char_offsets[i + quote_len].0
            } else {
                window_start + window_body.len()
            };
            best_start_byte = Some(start_byte);
            best_end_byte = Some(end_byte);
        }
    }

    let threshold_distance = (quote_len as f64 * FUZZY_THRESHOLD).ceil() as usize;
    if best_distance <= threshold_distance {
        let start = best_start_byte?;
        let end = best_end_byte?;
        ByteRange::new(start, end)
    } else {
        None
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Trim `s` to at most `max_bytes` bytes without splitting a multi-byte char.
fn trim_to_bytes(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut boundary = max_bytes;
    while boundary > 0 && !s.is_char_boundary(boundary) {
        boundary -= 1;
    }
    &s[..boundary]
}

/// Snap `offset` backwards to the nearest valid UTF-8 char boundary in `s`.
fn snap_to_char_boundary(s: &str, mut offset: usize) -> usize {
    while offset > 0 && !s.is_char_boundary(offset) {
        offset -= 1;
    }
    offset
}

/// Classic Levenshtein edit-distance on `char` slices (O(m×n) time, O(min(m,n)) space).
fn levenshtein_chars(a: &[char], b: &[char]) -> usize {
    // We always use `b` as the "column" dimension to keep memory O(min).
    let (a, b) = if a.len() < b.len() { (b, a) } else { (a, b) };
    let m = a.len();
    let n = b.len();

    let mut prev: Vec<usize> = (0..=n).collect();
    let mut curr = vec![0usize; n + 1];

    for i in 1..=m {
        curr[0] = i;
        for j in 1..=n {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1).min(curr[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[n]
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::selector::{ByteRange, Selector, TextRangeSelector};

    fn text_sel(start: usize, end: usize, quote: &str) -> Selector {
        Selector::TextRange(TextRangeSelector {
            range: ByteRange { start, end },
            quote: quote.into(),
        })
    }

    // ── Stage 1: exact ────────────────────────────────────────────────────────

    #[test]
    fn exact_match_reports_live() {
        let body = "Hello, world! This is a test.";
        let sel = text_sel(7, 12, "world");
        let outcome = reanchor(&sel, body).unwrap();
        assert_eq!(
            outcome,
            AnchorOutcome::Live {
                range: ByteRange::new(7, 12).unwrap()
            }
        );
    }

    #[test]
    fn exact_match_at_start() {
        let body = "Hello, world!";
        let sel = text_sel(0, 5, "Hello");
        let outcome = reanchor(&sel, body).unwrap();
        assert_eq!(
            outcome,
            AnchorOutcome::Live {
                range: ByteRange::new(0, 5).unwrap()
            }
        );
    }

    #[test]
    fn exact_match_at_end() {
        let body = "Hello, world";
        let sel = text_sel(7, 12, "world");
        let outcome = reanchor(&sel, body).unwrap();
        assert_eq!(
            outcome,
            AnchorOutcome::Live {
                range: ByteRange::new(7, 12).unwrap()
            }
        );
    }

    // ── Stage 2: relocated ────────────────────────────────────────────────────

    #[test]
    fn annotation_survives_prepend_above() {
        // A paragraph was inserted before the annotation.
        let updated = "New paragraph.\n\nTarget text here.";
        // In `original`, "Target text" was at [0..11].
        // In `updated`, it is at [17..28].
        let sel = text_sel(0, 11, "Target text");
        let outcome = reanchor(&sel, updated).unwrap();
        match outcome {
            AnchorOutcome::Relocated { new_range, .. } => {
                assert_eq!(&updated[new_range.start..new_range.end], "Target text");
            }
            other => panic!("expected Relocated, got {other:?}"),
        }
    }

    #[test]
    fn annotation_survives_append_below() {
        let updated = "Target text.\n\nAppended paragraph.";
        // "Target text" still at [0..11] in both.
        let sel = text_sel(0, 11, "Target text");
        let outcome = reanchor(&sel, updated).unwrap();
        // Should still be Live because the bytes haven't moved.
        assert_eq!(
            outcome,
            AnchorOutcome::Live {
                range: ByteRange::new(0, 11).unwrap()
            }
        );
    }

    #[test]
    fn annotation_survives_minor_typo_fix() {
        // Annotated "helo world" → author fixed to "hello world".
        let updated_body = "Please read: hello world carefully.";
        // original quote at [13..23]: "helo world"
        let sel = text_sel(13, 23, "helo world");
        let outcome = reanchor(&sel, updated_body).unwrap();
        match outcome {
            AnchorOutcome::Relocated { new_range, .. } => {
                // The stored quote is "helo world" (10 chars), so the fuzzy
                // stage finds the best 10-char window in the updated body.
                // The relocated slice should start at the same position as
                // "hello world" in the updated body.
                let text = &updated_body[new_range.start..new_range.end];
                assert!(
                    updated_body.contains(text),
                    "relocated slice '{text}' not found in updated body"
                );
                assert_eq!(
                    new_range.start,
                    updated_body.find("hello").unwrap(),
                    "relocated range should start at 'hello'"
                );
            }
            other => panic!("expected Relocated, got {other:?}"),
        }
    }

    // ── Stage 3: orphaned ────────────────────────────────────────────────────

    #[test]
    fn annotation_becomes_orphaned_when_text_deleted() {
        let body_after_deletion = "The passage has been removed entirely.";
        // The annotated text no longer exists in any recognisable form.
        let sel = text_sel(0, 20, "unique and long text that is gone");
        let outcome = reanchor(&sel, body_after_deletion).unwrap();
        assert!(
            matches!(outcome, AnchorOutcome::Orphaned { .. }),
            "expected Orphaned, got {outcome:?}"
        );
    }

    #[test]
    fn annotation_orphaned_when_body_empty() {
        let sel = text_sel(0, 5, "hello");
        let outcome = reanchor(&sel, "").unwrap();
        assert!(matches!(outcome, AnchorOutcome::Orphaned { .. }));
    }

    // ── Opaque locators ───────────────────────────────────────────────────────

    #[test]
    fn pdf_selector_reports_opaque() {
        use crate::selector::PdfQuoteSelector;
        let sel = Selector::PdfQuote(PdfQuoteSelector {
            page: 1,
            quote: "text".into(),
            locator: "{}".into(),
        });
        assert_eq!(
            reanchor(&sel, "any body").unwrap(),
            AnchorOutcome::OpaqueLocator
        );
    }

    #[test]
    fn epub_selector_reports_opaque() {
        use crate::selector::EpubCfiSelector;
        let sel = Selector::EpubCfi(EpubCfiSelector {
            cfi: "epubcfi(/6/4)".into(),
            quote: "text".into(),
        });
        assert_eq!(
            reanchor(&sel, "any body").unwrap(),
            AnchorOutcome::OpaqueLocator
        );
    }

    // ── Levenshtein edge cases ────────────────────────────────────────────────

    #[test]
    fn levenshtein_identical() {
        let a: Vec<char> = "abc".chars().collect();
        let b = a.clone();
        assert_eq!(levenshtein_chars(&a, &b), 0);
    }

    #[test]
    fn levenshtein_single_insertion() {
        let a: Vec<char> = "abcde".chars().collect();
        let b: Vec<char> = "abXcde".chars().collect();
        assert_eq!(levenshtein_chars(&a, &b), 1);
    }

    #[test]
    fn levenshtein_empty_strings() {
        assert_eq!(levenshtein_chars(&[], &[]), 0);
    }

    #[test]
    fn levenshtein_one_empty() {
        let a: Vec<char> = "abc".chars().collect();
        assert_eq!(levenshtein_chars(&a, &[]), 3);
    }

    // ── Unicode multi-byte ────────────────────────────────────────────────────

    #[test]
    fn exact_match_multibyte_chars() {
        // "résumé" — multi-byte chars; byte len > char len.
        let body = "Polish your résumé before applying.";
        let start = body.find("résumé").unwrap();
        let end = start + "résumé".len();
        let sel = text_sel(start, end, "résumé");
        let outcome = reanchor(&sel, body).unwrap();
        assert_eq!(
            outcome,
            AnchorOutcome::Live {
                range: ByteRange::new(start, end).unwrap()
            }
        );
    }

    #[test]
    fn fuzzy_search_relocates_multibyte_quote() {
        // Original body had "résumé" at position 0.
        // Updated body prepends a line.
        let updated = "A header line.\nPolish your résumé here.";
        let start_in_updated = updated.find("résumé").unwrap();
        let end_in_updated = start_in_updated + "résumé".len();
        // Annotation was originally at [0..12] in the short body "résumé done".
        let sel = text_sel(0, "résumé".len(), "résumé");
        let outcome = reanchor(&sel, updated).unwrap();
        match outcome {
            AnchorOutcome::Live { range }
            | AnchorOutcome::Relocated {
                new_range: range, ..
            } => {
                assert_eq!(
                    &updated[range.start..range.end],
                    "résumé",
                    "relocated range should point to 'résumé'"
                );
                assert_eq!(range.start, start_in_updated);
                assert_eq!(range.end, end_in_updated);
            }
            other => panic!("expected Live or Relocated, got {other:?}"),
        }
    }
}
