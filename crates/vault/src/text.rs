//! Shared text helpers for line-ending preservation.
//!
//! Rewriting a note with `str::lines()` + `join("\n")` is lossy twice over: it
//! strips the `\r` from CRLF documents and it drops the document's final
//! newline. For a Windows user that turns a one-word tag rename into a
//! whole-file diff. Every rewrite path in this crate therefore normalizes to LF,
//! does its work, and restores the document's original style at the end.

/// The dominant line ending of a document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LineEnding {
    Lf,
    Crlf,
}

/// The line-ending style captured from a source document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct LineStyle {
    ending: LineEnding,
}

impl LineStyle {
    /// Detects the dominant line ending of `text`.
    ///
    /// A document counts as CRLF when more than half of its newlines are
    /// preceded by a carriage return, so a stray `\r\n` in an otherwise LF file
    /// does not flip the whole document.
    pub(crate) fn detect(text: &str) -> Self {
        let newlines = text.matches('\n').count();
        let carriage_returns = text.matches("\r\n").count();
        let ending = if carriage_returns > 0 && carriage_returns * 2 > newlines {
            LineEnding::Crlf
        } else {
            LineEnding::Lf
        };
        Self { ending }
    }

    pub(crate) fn is_crlf(self) -> bool {
        self.ending == LineEnding::Crlf
    }

    /// Re-applies this style to LF-normalized `text`.
    pub(crate) fn restore(self, text: &str) -> String {
        if self.is_crlf() {
            to_lf(text).replace('\n', "\r\n")
        } else {
            text.to_string()
        }
    }
}

/// Converts CRLF line endings to LF, leaving lone carriage returns alone.
pub(crate) fn to_lf(text: &str) -> String {
    if text.contains("\r\n") {
        text.replace("\r\n", "\n")
    } else {
        text.to_string()
    }
}

/// Splits `text` into lines without losing the trailing newline or trailing
/// blank lines. Unlike [`str::lines`], `split_lines(t).join("\n") == t` always.
pub(crate) fn split_lines(text: &str) -> std::str::Split<'_, char> {
    text.split('\n')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_crlf_and_lf_documents() {
        assert!(LineStyle::detect("a\r\nb\r\n").is_crlf());
        assert!(!LineStyle::detect("a\nb\n").is_crlf());
        assert!(!LineStyle::detect("plain").is_crlf());
        // A single stray CRLF does not flip an otherwise-LF document.
        assert!(!LineStyle::detect("a\nb\nc\r\nd\n").is_crlf());
    }

    #[test]
    fn round_trips_through_normalization() {
        for input in ["a\r\nb\r\n", "a\nb\n", "a\nb", "a\r\nb", "", "\r\n\r\n"] {
            let style = LineStyle::detect(input);
            assert_eq!(style.restore(&to_lf(input)), input, "round trip for {input:?}");
        }
    }

    #[test]
    fn split_lines_is_lossless() {
        for input in ["a\n\n\n", "a\nb", "", "\n", "a"] {
            let joined = split_lines(input).collect::<Vec<_>>().join("\n");
            assert_eq!(joined, input, "lossless split for {input:?}");
        }
    }
}
