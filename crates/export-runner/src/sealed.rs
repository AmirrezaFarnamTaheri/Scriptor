//! Sealed-content interlock for the export pipeline (W1-10, I-3).
//!
//! This module enforces invariant I-3: **sealed content never leaves the
//! vault** through any automated pathway (export, publish, index, embed).
//!
//! # Sentinel format
//!
//! Sealed spans are marked with the ASCII sentinel:
//! ```text
//! %%scriptor-sealed:<base64-hint>:<base64-ciphertext>%%
//! ```
//! The exact ciphertext and hint are opaque to this guard; we only check for
//! the prefix to keep this module dependency-free and fast.
//!
//! # Redaction
//!
//! When `RedactSecretsMode::Redact` is passed (e.g. via `--redact-secrets`),
//! sealed spans are replaced with the placeholder text before the content is
//! handed to the downstream consumer (pandoc, publish sink, etc.).

/// Prefix that unambiguously identifies a sealed span in a note body.
pub const SEALED_PREFIX: &str = "%%scriptor-sealed:";
/// Closing sentinel.
pub const SEALED_SUFFIX: &str = "%%";
/// Placeholder substituted for each sealed span under `Redact` mode.
pub const REDACTED_PLACEHOLDER: &str = "[redacted]";

/// Controls how sealed content is handled by the export / publish pipeline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RedactSecretsMode {
    /// Abort with an error if any sealed span is found. Default.
    #[default]
    Refuse,
    /// Replace sealed spans with `[redacted]` before downstream processing.
    Redact,
}

/// Check `source` for sealed spans and apply the chosen policy.
///
/// - `Refuse` → returns `Err` on the first sealed span found.
/// - `Redact` → replaces every `%%scriptor-sealed:…%%` span with `[redacted]`
///   and returns the sanitised string.
///
/// Returns `Ok(source)` unchanged when no sealed spans are present.
pub fn check_or_redact(
    source: &str,
    mode: RedactSecretsMode,
    path_hint: &str,
) -> Result<String, SealedContentError> {
    if !source.contains(SEALED_PREFIX) {
        // Fast path: no sealed spans present.
        return Ok(source.to_owned());
    }

    match mode {
        RedactSecretsMode::Refuse => Err(SealedContentError {
            path: path_hint.to_owned(),
        }),
        RedactSecretsMode::Redact => Ok(redact_sealed_spans(source)),
    }
}

/// Returns `true` if `bytes` contains any sealed span prefix.
///
/// Used by the indexer and embeddings guard (W1-10) for a lightweight scan
/// over raw bytes before decoding to UTF-8.
pub fn contains_sealed_span(bytes: &[u8]) -> bool {
    bytes
        .windows(SEALED_PREFIX.len())
        .any(|w| w == SEALED_PREFIX.as_bytes())
}

/// Error returned when sealed content is found and the mode is `Refuse`.
#[derive(Debug, thiserror::Error)]
#[error("sealed content detected in `{path}`: re-run with --redact-secrets to export anyway")]
pub struct SealedContentError {
    pub path: String,
}

// ── Span redactor ─────────────────────────────────────────────────────────────

fn redact_sealed_spans(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut rest = source;

    while let Some(start) = rest.find(SEALED_PREFIX) {
        out.push_str(&rest[..start]);
        // Advance past the prefix and search for the closing `%%`.
        let after_prefix = &rest[start + SEALED_PREFIX.len()..];
        match after_prefix.find(SEALED_SUFFIX) {
            Some(end) => {
                out.push_str(REDACTED_PLACEHOLDER);
                rest = &after_prefix[end + SEALED_SUFFIX.len()..];
            }
            None => {
                // Unclosed sentinel: redact everything to end-of-string.
                out.push_str(REDACTED_PLACEHOLDER);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_source_passes_through_unchanged() {
        let src = "No secrets here.";
        let result = check_or_redact(src, RedactSecretsMode::Refuse, "note.md").unwrap();
        assert_eq!(result, src);
    }

    #[test]
    fn refuse_mode_errors_on_sealed_span() {
        let src = "before %%scriptor-sealed:abc:def%% after";
        let err =
            check_or_redact(src, RedactSecretsMode::Refuse, "private.md").expect_err("must fail");
        assert!(err.path == "private.md");
    }

    #[test]
    fn redact_mode_replaces_sealed_span() {
        let src = "Hello %%scriptor-sealed:hint:ciphertext%% world";
        let out = check_or_redact(src, RedactSecretsMode::Redact, "note.md").unwrap();
        assert_eq!(out, "Hello [redacted] world");
    }

    #[test]
    fn redact_replaces_multiple_spans() {
        let src = "A %%scriptor-sealed:x:y%% B %%scriptor-sealed:p:q%% C";
        let out = check_or_redact(src, RedactSecretsMode::Redact, "note.md").unwrap();
        assert_eq!(out, "A [redacted] B [redacted] C");
    }

    #[test]
    fn redact_handles_unclosed_sentinel() {
        let src = "A %%scriptor-sealed:x";
        let out = check_or_redact(src, RedactSecretsMode::Redact, "note.md").unwrap();
        assert_eq!(out, "A [redacted]");
    }

    #[test]
    fn contains_sealed_span_detects_bytes() {
        let with = b"body %%scriptor-sealed:x:y%%";
        let without = b"no secrets here";
        assert!(contains_sealed_span(with));
        assert!(!contains_sealed_span(without));
    }
}
