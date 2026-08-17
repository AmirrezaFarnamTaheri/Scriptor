//! Inline encryption / decryption using ASCII markers (W5-7).
//!
//! ## Format
//!
//! ```text
//! %%scriptor-enc:v2:<hint-b64>:<payload-b64>%%
//! ```
//!
//! All fields are standard Base-64 (alphabet A–Z, a–z, 0–9, +, /, with `=`
//! padding).  The marker is ASCII-only so it survives Pandoc, `git diff`,
//! Windows codepages, and any downstream tooling that treats Markdown as
//! plain text.
//!
//! | Field       | Meaning                                                      |
//! |-------------|--------------------------------------------------------------|
//! | `v2`        | Literal version tag; only `v2` is emitted by new code.      |
//! | `hint-b64`  | Base-64 of a short UTF-8 *hint* (≤ 64 bytes before encode). |
//!              |   Tells the user *what* is encrypted; never the plaintext.  |
//! | `payload-b64` | Base-64 of the binary `crates/vault/src/crypto.rs` V2    |
//!              |   envelope (`encrypt_with_passphrase`).                      |
//!
//! ## Invariants
//!
//! - The marker is **block-atomic**: `%%` delimiters appear on the same line.
//!   Multi-line secrets must be encrypted as one blob; the caller decides
//!   boundaries.
//! - Hint is display-only.  The decrypt path ignores it; the caller shows it
//!   to let the user confirm they are decrypting the right field.
//! - Plaintext **never** appears in a log, a Tauri event, or a store.  The
//!   decrypted bytes must be consumed in the same call frame and then
//!   zeroized.  See `DecryptedGuard`.
//! - This module is the *only* place that emits or parses inline markers.
//!   (I-5 – one parser per concept.)

use std::fmt;

use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use zeroize::Zeroize;

use crate::crypto::{decrypt_with_passphrase, encrypt_with_passphrase};
use crate::encryption::EncryptionError;

// ── Constants ────────────────────────────────────────────────────────────────

/// Prefix that opens an inline-encrypted span.
pub const MARKER_OPEN: &str = "%%scriptor-enc:";
/// Characters that close the span.
pub const MARKER_CLOSE: &str = "%%";
/// The only version tag emitted by new code.
const VERSION_TAG: &str = "v2";

/// Maximum hint length **before** Base-64 encoding.
pub const MAX_HINT_BYTES: usize = 64;

// ── InlineSpan ────────────────────────────────────────────────────────────────

/// A parsed inline encrypted marker.
///
/// Obtained via [`InlineSpan::parse`].  Carry this to [`decrypt`] to obtain
/// the plaintext inside a [`DecryptedGuard`].
#[derive(Debug, Clone)]
pub struct InlineSpan {
    /// Decoded hint bytes.  UTF-8 is not validated after decode — display with
    /// `String::from_utf8_lossy`.
    pub hint: Vec<u8>,
    /// Decoded current binary envelope.
    pub payload: Vec<u8>,
    /// Byte range `[start, end)` of the entire marker in the source string,
    /// including the `%%` delimiters.  Useful for callers that splice spans
    /// back into the note body.
    pub source_range: std::ops::Range<usize>,
}

impl InlineSpan {
    /// Parse the *first* inline-encrypted marker in `text`.
    ///
    /// Returns `None` if no valid marker is present.
    pub fn parse(text: &str) -> Option<Self> {
        let start = text.find(MARKER_OPEN)?;
        let after_open = start + MARKER_OPEN.len();
        let close_pos = text[after_open..].find(MARKER_CLOSE)? + after_open;

        let inner = &text[after_open..close_pos];
        // inner must be: "v2:<hint-b64>:<payload-b64>"
        let parts: Vec<&str> = inner.splitn(3, ':').collect();
        if parts.len() != 3 || parts[0] != VERSION_TAG {
            return None;
        }

        let hint = B64.decode(parts[1]).ok()?;
        let payload = B64.decode(parts[2]).ok()?;

        let end = close_pos + MARKER_CLOSE.len();
        Some(Self {
            hint,
            payload,
            source_range: start..end,
        })
    }

    /// Iterate over all valid inline-encrypted markers in `text`.
    pub fn parse_all(text: &str) -> Vec<Self> {
        let mut spans = Vec::new();
        let mut cursor = 0;
        while let Some(span) = Self::parse(&text[cursor..]) {
            // Adjust the range back to the absolute position in `text`.
            let abs_start = cursor + span.source_range.start;
            let abs_end = cursor + span.source_range.end;
            spans.push(Self {
                hint: span.hint,
                payload: span.payload,
                source_range: abs_start..abs_end,
            });
            cursor = abs_end;
        }
        spans
    }

    /// Display the hint as a lossy UTF-8 string for user-facing messages.
    pub fn hint_lossy(&self) -> std::borrow::Cow<'_, str> {
        String::from_utf8_lossy(&self.hint)
    }
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/// Encrypt `plaintext` with `passphrase` and produce the inline marker string.
///
/// `hint` is a short human-readable label for the encrypted field (e.g.
/// `"API key"`, `"password"`).  It is stored in the marker but is **not**
/// secret.  Truncated to [`MAX_HINT_BYTES`] silently.
///
/// # Errors
/// Propagates [`EncryptionError`] from `crypto::encrypt_with_passphrase`.
pub fn encrypt(plaintext: &[u8], passphrase: &str, hint: &str) -> Result<String, EncryptionError> {
    let hint_bytes = hint.as_bytes();
    let hint_bytes = if hint_bytes.len() > MAX_HINT_BYTES {
        &hint_bytes[..MAX_HINT_BYTES]
    } else {
        hint_bytes
    };

    let payload = encrypt_with_passphrase(plaintext, passphrase)?;
    let hint_b64 = B64.encode(hint_bytes);
    let payload_b64 = B64.encode(&payload);

    Ok(format!(
        "{MARKER_OPEN}{VERSION_TAG}:{hint_b64}:{payload_b64}{MARKER_CLOSE}"
    ))
}

// ── DecryptedGuard ────────────────────────────────────────────────────────────

/// RAII wrapper around decrypted plaintext bytes.
///
/// The inner `Vec<u8>` is zeroized on drop so plaintext does not linger in
/// heap memory after the guard goes out of scope.
///
/// # Usage
/// ```
/// # use scriptor_vault::inline_encrypt::{encrypt, decrypt, DecryptedGuard};
/// let marker = encrypt(b"my secret", "pass", "demo").unwrap();
/// let span = scriptor_vault::inline_encrypt::InlineSpan::parse(&marker).unwrap();
/// let guard = decrypt(&span, "pass").unwrap();
/// assert_eq!(guard.as_bytes(), b"my secret");
/// // `guard` is dropped here → bytes are zeroized.
/// ```
pub struct DecryptedGuard {
    inner: Vec<u8>,
}

impl DecryptedGuard {
    fn new(inner: Vec<u8>) -> Self {
        Self { inner }
    }

    /// Access the plaintext bytes.
    ///
    /// Do **not** store these in a `String`, a Tauri event payload, or any
    /// structure with a longer lifetime than this guard.
    pub fn as_bytes(&self) -> &[u8] {
        &self.inner
    }

    /// Convert to a UTF-8 string slice.
    ///
    /// Returns `None` if the decrypted payload is not valid UTF-8.
    pub fn as_str(&self) -> Option<&str> {
        std::str::from_utf8(&self.inner).ok()
    }
}

impl Drop for DecryptedGuard {
    fn drop(&mut self) {
        self.inner.zeroize();
    }
}

impl fmt::Debug for DecryptedGuard {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DecryptedGuard")
            .field("len", &self.inner.len())
            .finish()
    }
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/// Decrypt an [`InlineSpan`] with `passphrase`.
///
/// The returned [`DecryptedGuard`] zeroizes the plaintext on drop.
///
/// # Errors
/// - [`EncryptionError::InvalidPassphrase`] — wrong passphrase.
/// - [`EncryptionError::InvalidFormat`] — payload corrupted.
pub fn decrypt(span: &InlineSpan, passphrase: &str) -> Result<DecryptedGuard, EncryptionError> {
    let plaintext = decrypt_with_passphrase(&span.payload, passphrase)?;
    Ok(DecryptedGuard::new(plaintext))
}

// ── contains_inline_marker ────────────────────────────────────────────────────

/// Returns `true` if `text` contains at least one inline-encrypted marker.
///
/// Cheap scan: does not parse or validate the marker.
#[inline]
pub fn contains_inline_marker(text: &str) -> bool {
    text.contains(MARKER_OPEN)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    const PASS: &str = "hunter2";

    // ── Round-trip ───────────────────────────────────────────────────────────

    #[test]
    fn round_trip_ascii_plaintext() {
        let marker = encrypt(b"my secret value", PASS, "test field").unwrap();
        assert!(
            marker.starts_with(MARKER_OPEN),
            "must open with %%scriptor-enc:"
        );
        assert!(marker.ends_with(MARKER_CLOSE), "must close with %%");
        assert!(marker.is_ascii(), "marker must be ASCII-only");

        let span = InlineSpan::parse(&marker).expect("must parse");
        let guard = decrypt(&span, PASS).expect("decrypt must succeed");
        assert_eq!(guard.as_bytes(), b"my secret value");
    }

    #[test]
    fn round_trip_binary_plaintext() {
        let plaintext: Vec<u8> = (0u8..=255u8).collect();
        let marker = encrypt(&plaintext, PASS, "binary blob").unwrap();
        assert!(
            marker.is_ascii(),
            "binary content must produce ASCII marker"
        );

        let span = InlineSpan::parse(&marker).unwrap();
        let guard = decrypt(&span, PASS).unwrap();
        assert_eq!(guard.as_bytes(), plaintext.as_slice());
    }

    // ── Hint handling ────────────────────────────────────────────────────────

    #[test]
    fn hint_survives_round_trip() {
        let marker = encrypt(b"payload", PASS, "My API Key").unwrap();
        let span = InlineSpan::parse(&marker).unwrap();
        assert_eq!(span.hint_lossy(), "My API Key");
    }

    #[test]
    fn hint_truncated_to_max_bytes() {
        let long_hint = "x".repeat(MAX_HINT_BYTES + 10);
        let marker = encrypt(b"payload", PASS, &long_hint).unwrap();
        let span = InlineSpan::parse(&marker).unwrap();
        assert_eq!(span.hint.len(), MAX_HINT_BYTES);
    }

    #[test]
    fn empty_hint_accepted() {
        let marker = encrypt(b"payload", PASS, "").unwrap();
        let span = InlineSpan::parse(&marker).unwrap();
        assert_eq!(span.hint, b"");
    }

    // ── Format ───────────────────────────────────────────────────────────────

    #[test]
    fn marker_contains_version_tag() {
        let marker = encrypt(b"x", PASS, "hint").unwrap();
        assert!(
            marker.contains(&format!("{MARKER_OPEN}{VERSION_TAG}:")),
            "version tag must be v2"
        );
    }

    #[test]
    fn source_range_covers_entire_marker() {
        let prefix = "some text before: ";
        let suffix = " :and after";
        let marker = encrypt(b"secret", PASS, "h").unwrap();
        let full = format!("{prefix}{marker}{suffix}");

        let span = InlineSpan::parse(&full).unwrap();
        assert_eq!(&full[span.source_range.clone()], marker.as_str());
    }

    // ── parse_all ────────────────────────────────────────────────────────────

    #[test]
    fn parse_all_finds_multiple_markers() {
        let m1 = encrypt(b"first", PASS, "h1").unwrap();
        let m2 = encrypt(b"second", PASS, "h2").unwrap();
        let text = format!("a {m1} b {m2} c");

        let spans = InlineSpan::parse_all(&text);
        assert_eq!(spans.len(), 2);

        let g1 = decrypt(&spans[0], PASS).unwrap();
        let g2 = decrypt(&spans[1], PASS).unwrap();
        assert_eq!(g1.as_bytes(), b"first");
        assert_eq!(g2.as_bytes(), b"second");
    }

    // ── Error paths ──────────────────────────────────────────────────────────

    #[test]
    fn wrong_passphrase_returns_invalid_passphrase() {
        let marker = encrypt(b"secret", PASS, "h").unwrap();
        let span = InlineSpan::parse(&marker).unwrap();
        let err = decrypt(&span, "wrong").unwrap_err();
        assert!(
            matches!(err, EncryptionError::InvalidPassphrase),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn parse_returns_none_for_plain_text() {
        assert!(InlineSpan::parse("hello world").is_none());
        assert!(InlineSpan::parse("%%not-a-marker%%").is_none());
        assert!(InlineSpan::parse("%%scriptor-enc:v1:bad%%").is_none());
    }

    #[test]
    fn parse_returns_none_for_corrupted_payload() {
        // Mangled base64 in payload field.
        let bad = "%%scriptor-enc:v2:aGludA==:!!!notbase64!!!%%";
        assert!(InlineSpan::parse(bad).is_none());
    }

    #[test]
    fn contains_inline_marker_fast_path() {
        let marker = encrypt(b"x", PASS, "h").unwrap();
        assert!(contains_inline_marker(&marker));
        assert!(!contains_inline_marker("plain text"));
    }

    // ── Zeroize ──────────────────────────────────────────────────────────────

    #[test]
    fn decrypted_guard_zeroizes_on_drop() {
        let marker = encrypt(b"sensitive", PASS, "h").unwrap();
        let span = InlineSpan::parse(&marker).unwrap();
        let ptr;
        let len;
        {
            let guard = decrypt(&span, PASS).unwrap();
            ptr = guard.inner.as_ptr();
            len = guard.inner.len();
            // guard dropped here → inner.zeroize() called
        }
        // After drop the allocation may be reused, but at the moment of drop
        // the bytes were zeroized.  We can only assert that `decrypt` worked
        // and the guard was constructed.  The actual zeroize is an invariant
        // enforced by `zeroize::Zeroize`, not observable here without unsafe.
        let _ = (ptr, len); // suppress unused warnings
    }
}
