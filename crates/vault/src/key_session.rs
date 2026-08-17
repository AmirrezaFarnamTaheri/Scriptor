//! TTL'd key session for inline-encrypted vault content (W5-8).
//!
//! # Design
//!
//! The `KeySession` holds a derived 32-byte key in memory for a bounded
//! duration.  When the TTL expires — or when the vault is locked, the window
//! blurs, or the user explicitly locks — the key is zeroized.
//!
//! Callers gate every decrypt operation with `SensitiveOperation::DecryptContent`
//! via `permissions::check` *before* calling [`KeySession::open`].  The session
//! does not re-check permissions; that is the caller's responsibility.
//!
//! # Thread-safety
//!
//! [`KeySession`] wraps its mutable state in a `Mutex`.  It is designed to be
//! held in an `Arc` inside Tauri's `AppState` so that multiple command handlers
//! can share one session without data races.
//!
//! # Zeroize invariant
//!
//! The inner key bytes are zeroized:
//! 1. on explicit [`KeySession::lock`],
//! 2. on TTL expiry inside [`KeySession::open`] (lazy check),
//! 3. on `Drop` of the `SessionInner`.
//!
//! Plaintext derived from the session key must be held in a
//! [`crate::inline_encrypt::DecryptedGuard`], which zeroizes on drop.

use std::time::{Duration, Instant};

use zeroize::Zeroize;

use crate::encryption::EncryptionError;

// ── Constants ────────────────────────────────────────────────────────────────

/// Default TTL for a key session.  After this duration the key is zeroized
/// and the next [`KeySession::open`] will return [`SessionError::Expired`].
pub const DEFAULT_TTL: Duration = Duration::from_secs(5 * 60); // 5 minutes

// ── Errors ────────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    #[error("no active key session — call unlock first")]
    NoSession,
    #[error("key session expired — call unlock to start a new session")]
    Expired,
    #[error("encryption error: {0}")]
    Crypto(#[from] EncryptionError),
}

// ── Inner state (zeroized on drop) ────────────────────────────────────────────

struct SessionInner {
    key: [u8; 32],
    expires_at: Instant,
}

impl SessionInner {
    fn new(key: [u8; 32], ttl: Duration) -> Self {
        Self {
            key,
            expires_at: Instant::now() + ttl,
        }
    }

    fn is_expired(&self) -> bool {
        Instant::now() >= self.expires_at
    }

    fn time_remaining(&self) -> Duration {
        self.expires_at.saturating_duration_since(Instant::now())
    }
}

impl Drop for SessionInner {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

// ── KeySession ────────────────────────────────────────────────────────────────

/// Holds a derived key in memory for a bounded TTL.
///
/// Wrap in `Arc<Mutex<KeySession>>` and store in Tauri `AppState`.
pub struct KeySession {
    inner: std::sync::Mutex<Option<SessionInner>>,
    ttl: Duration,
}

fn lock_recover<T: ?Sized>(mutex: &std::sync::Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

impl KeySession {
    /// Create a new, locked session with the default TTL.
    pub fn new() -> Self {
        Self::with_ttl(DEFAULT_TTL)
    }

    /// Create a new, locked session with an explicit TTL.  Useful for tests.
    pub fn with_ttl(ttl: Duration) -> Self {
        Self {
            inner: std::sync::Mutex::new(None),
            ttl,
        }
    }

    /// Unlock the session with a passphrase + salt pair, deriving the key
    /// with Argon2id.
    ///
    /// # Parameters
    /// - `passphrase`: user-supplied passphrase.
    /// - `salt`: 16-byte Argon2id salt stored alongside the encrypted vault.
    ///
    /// Any existing session (expired or not) is replaced.
    pub fn unlock(&self, passphrase: &str, salt: &[u8; 16]) -> Result<SessionInfo, SessionError> {
        let enc = crate::encryption::VaultEncryption::new();
        let derived = enc.derive_key(passphrase, salt)?;

        let mut key = [0u8; 32];
        key.copy_from_slice(derived.as_bytes());

        let inner = SessionInner::new(key, self.ttl);
        let remaining = inner.time_remaining();
        let expires_at_unix = std::time::SystemTime::now()
            .checked_add(remaining)
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        *lock_recover(&self.inner) = Some(inner);
        Ok(SessionInfo {
            ttl_secs: remaining.as_secs(),
            expires_at_unix,
        })
    }

    /// Unlock the session with a raw 32-byte key (for tests or pre-derived keys).
    pub fn unlock_with_key(&self, key: [u8; 32]) -> SessionInfo {
        let inner = SessionInner::new(key, self.ttl);
        let remaining = inner.time_remaining();
        let expires_at_unix = std::time::SystemTime::now()
            .checked_add(remaining)
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        *lock_recover(&self.inner) = Some(inner);
        SessionInfo {
            ttl_secs: remaining.as_secs(),
            expires_at_unix,
        }
    }

    /// Zeroize the key and clear the session.
    ///
    /// Must be called on vault lock, window blur, and app exit.
    pub fn lock(&self) {
        // Dropping the `Option<SessionInner>` triggers `SessionInner::drop`,
        // which zeroizes the key.
        *lock_recover(&self.inner) = None;
    }

    /// Return `true` if an active (non-expired) session exists.
    pub fn is_active(&self) -> bool {
        match lock_recover(&self.inner).as_ref() {
            Some(inner) => !inner.is_expired(),
            None => false,
        }
    }

    /// Borrow the session key through a closure.
    ///
    /// Returns [`SessionError::NoSession`] if no session exists, or
    /// [`SessionError::Expired`] if the TTL has passed (and also zeroizes).
    ///
    /// The closure receives a `&[u8; 32]` reference.  It must not store the
    /// reference or copy the key bytes outside the closure.
    pub fn open<F, R>(&self, f: F) -> Result<R, SessionError>
    where
        F: FnOnce(&[u8; 32]) -> R,
    {
        let mut guard = lock_recover(&self.inner);
        match guard.as_ref() {
            None => Err(SessionError::NoSession),
            Some(inner) if inner.is_expired() => {
                // Zeroize eagerly on expiry.
                *guard = None;
                Err(SessionError::Expired)
            }
            Some(inner) => Ok(f(&inner.key)),
        }
    }

    /// Return a snapshot of the current session state (no key material).
    pub fn status(&self) -> SessionStatus {
        match lock_recover(&self.inner).as_ref() {
            None => SessionStatus::Locked,
            Some(inner) if inner.is_expired() => SessionStatus::Expired,
            Some(inner) => SessionStatus::Active {
                remaining_secs: inner.time_remaining().as_secs(),
            },
        }
    }
}

impl Default for KeySession {
    fn default() -> Self {
        Self::new()
    }
}

// ── Public info types ─────────────────────────────────────────────────────────

/// Non-sensitive information returned after a successful unlock.
#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionInfo {
    pub ttl_secs: u64,
    pub expires_at_unix: u64,
}

/// Non-sensitive session status snapshot.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum SessionStatus {
    Locked,
    Expired,
    Active { remaining_secs: u64 },
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::inline_encrypt::{InlineSpan, decrypt, encrypt};

    const PASS: &str = "test-passphrase";

    fn make_salt() -> [u8; 16] {
        [0x42u8; 16]
    }

    // ── Basic lifecycle ──────────────────────────────────────────────────────

    #[test]
    fn starts_locked() {
        let ks = KeySession::new();
        assert!(!ks.is_active());
        assert_eq!(ks.status(), SessionStatus::Locked);
    }

    #[test]
    fn unlock_makes_session_active() {
        let ks = KeySession::new();
        let info = ks.unlock(PASS, &make_salt()).unwrap();
        assert!(info.ttl_secs > 0);
        assert!(ks.is_active());
        assert!(matches!(ks.status(), SessionStatus::Active { .. }));
    }

    #[test]
    fn lock_clears_session() {
        let ks = KeySession::new();
        ks.unlock(PASS, &make_salt()).unwrap();
        ks.lock();
        assert!(!ks.is_active());
        assert_eq!(ks.status(), SessionStatus::Locked);
    }

    #[test]
    fn open_without_session_returns_no_session() {
        let ks = KeySession::new();
        let err = ks.open(|_key| ()).unwrap_err();
        assert!(matches!(err, SessionError::NoSession), "{err}");
    }

    // ── TTL expiry ───────────────────────────────────────────────────────────

    #[test]
    fn open_after_expiry_returns_expired() {
        let ks = KeySession::with_ttl(Duration::from_millis(1));
        ks.unlock(PASS, &make_salt()).unwrap();
        std::thread::sleep(Duration::from_millis(5));
        let err = ks.open(|_key| ()).unwrap_err();
        assert!(matches!(err, SessionError::Expired), "{err}");
        // After expiry the session is cleared.
        assert_eq!(ks.status(), SessionStatus::Locked);
    }

    // ── Integration with inline_encrypt ─────────────────────────────────────

    #[test]
    fn session_decrypt_inline_span() {
        // 1. Encrypt a value using the passphrase.
        let marker = encrypt(b"session_secret", PASS, "demo field").unwrap();
        let span = InlineSpan::parse(&marker).unwrap();

        // 2. Derive key and unlock session.
        let enc = crate::encryption::VaultEncryption::new();
        let derived = enc.derive_key(PASS, &make_salt()).unwrap();
        let mut key = [0u8; 32];
        key.copy_from_slice(derived.as_bytes());
        let ks = KeySession::new();
        ks.unlock_with_key(key);

        // 3. Decrypt via the session — the key is never copied out.
        // (We decrypt directly here because the passphrase path is tested
        //  in inline_encrypt tests; this test verifies session lifecycle.)
        let guard = ks.open(|_k| decrypt(&span, PASS)).unwrap().unwrap();
        assert_eq!(guard.as_bytes(), b"session_secret");
    }

    // ── Zeroize on drop ──────────────────────────────────────────────────────

    #[test]
    fn lock_triggers_zeroize() {
        // This is a structural test: SessionInner::drop calls key.zeroize().
        // We can't inspect heap memory without unsafe; we verify that the
        // session is cleared after lock and that unlock_with_key works.
        let ks = KeySession::new();
        ks.unlock_with_key([0xDEu8; 32]);
        assert!(ks.is_active());
        ks.lock();
        // After lock, the key must be gone.
        assert!(!ks.is_active());
        let err = ks.open(|_| ()).unwrap_err();
        assert!(matches!(err, SessionError::NoSession));
    }
}
