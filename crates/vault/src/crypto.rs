//! Versioned envelope encryption with `decrypt_any` dispatch (W1-9).
//!
//! # Envelope format
//!
//! ```text
//! [MAGIC 4B] [VERSION 1B] [ALGORITHM 1B] [KDF 1B] [SALT 16B] [NONCE ?B] [KEY_ID 4B] [CIPHERTEXT+TAG]
//! ```
//!
//! | Version byte | Algorithm | Nonce | Notes |
//! |---|---|---|---|
//! | `1` (`V1`) | AES-256-GCM | 12 B | Legacy; must remain readable forever |
//! | `2` (`V2`) | XChaCha20-Poly1305 | 24 B | New default for all writes |
//!
//! # Rules (binding)
//! - V1 payloads are **always** readable; the V1 code path is never removed.
//! - New writes use V2 (`XChaCha20-Poly1305`) by default.
//! - [`decrypt_any`] reads the version byte and dispatches without the caller
//!   needing to know which algorithm was used.
//! - The ASCII inline marker (`%%scriptor-enc:v2:<hint-b64>:<payload-b64>%%`)
//!   lives in `inline_encrypt.rs` (W5-7) and uses this module's `V2` path.

use chacha20poly1305::aead::Aead;
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

use crate::encryption::EncryptionError;

// ── Constants ──────────────────────────────────────────────────────────────────

const MAGIC: &[u8; 4] = b"SENC";

/// Version byte stored in the envelope header.
const VERSION_V1: u8 = 1;
const VERSION_V2: u8 = 2;

const ALGORITHM_AES256GCM: u8 = 1;
const ALGORITHM_XCHACHA20POLY1305: u8 = 2;

const KDF_ARGON2ID: u8 = 1;
const SALT_LEN: usize = 16;
const KEY_ID_LEN: usize = 4;
const TAG_LEN: usize = 16;

const V1_NONCE_LEN: usize = 12;
const V2_NONCE_LEN: usize = 24; // XChaCha20 uses a 192-bit nonce

// Header length varies by version because the nonce length differs.
const V1_HEADER_LEN: usize = 4 + 1 + 1 + 1 + SALT_LEN + V1_NONCE_LEN + KEY_ID_LEN;
const V2_HEADER_LEN: usize = 4 + 1 + 1 + 1 + SALT_LEN + V2_NONCE_LEN + KEY_ID_LEN;

// ── EnvelopeVersion ───────────────────────────────────────────────────────────

/// Which algorithm version an encrypted envelope uses.
///
/// Returned by [`EnvelopeHeader::version`] so callers can make version-aware
/// decisions without parsing the full header.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EnvelopeVersion {
    /// AES-256-GCM, 12-byte nonce. Legacy; read-only from new code.
    V1,
    /// XChaCha20-Poly1305, 24-byte nonce. Current default for new writes.
    V2,
}

// ── Parsed header ─────────────────────────────────────────────────────────────

/// Parsed envelope header without the ciphertext.
#[derive(Debug, Clone)]
pub struct EnvelopeHeader {
    pub version: EnvelopeVersion,
    /// Raw algorithm byte (1 = AES-GCM, 2 = XChaCha20-Poly1305).
    pub algorithm: u8,
    pub salt: [u8; SALT_LEN],
    /// Variable-length nonce (12 B for V1, 24 B for V2).
    pub nonce: Vec<u8>,
    pub key_id: [u8; KEY_ID_LEN],
    /// Byte offset at which the ciphertext (+tag) begins.
    pub header_len: usize,
}

impl EnvelopeHeader {
    /// Parse the header of an encrypted blob, returning its metadata.
    pub fn parse(data: &[u8]) -> Result<Self, EncryptionError> {
        if data.len() < 7 {
            return Err(EncryptionError::InvalidFormat("payload too short".into()));
        }
        if &data[..4] != MAGIC {
            return Err(EncryptionError::InvalidFormat("bad magic bytes".into()));
        }

        let (version, algorithm, nonce_len, header_len) = match data[4] {
            VERSION_V1 => {
                if data[5] != ALGORITHM_AES256GCM {
                    return Err(EncryptionError::UnsupportedAlgorithm(format!(
                        "V1 algorithm byte {}",
                        data[5]
                    )));
                }
                (
                    EnvelopeVersion::V1,
                    ALGORITHM_AES256GCM,
                    V1_NONCE_LEN,
                    V1_HEADER_LEN,
                )
            }
            VERSION_V2 => {
                if data[5] != ALGORITHM_XCHACHA20POLY1305 {
                    return Err(EncryptionError::UnsupportedAlgorithm(format!(
                        "V2 algorithm byte {}",
                        data[5]
                    )));
                }
                (
                    EnvelopeVersion::V2,
                    ALGORITHM_XCHACHA20POLY1305,
                    V2_NONCE_LEN,
                    V2_HEADER_LEN,
                )
            }
            v => {
                return Err(EncryptionError::InvalidFormat(format!(
                    "unsupported envelope version {v}"
                )));
            }
        };

        if data[6] != KDF_ARGON2ID {
            return Err(EncryptionError::UnsupportedAlgorithm(format!(
                "unsupported KDF byte {}",
                data[6]
            )));
        }

        if data.len() < header_len + TAG_LEN {
            return Err(EncryptionError::InvalidFormat(
                "payload too short for header + tag".into(),
            ));
        }

        let salt_start = 7;
        let nonce_start = salt_start + SALT_LEN;
        let key_id_start = nonce_start + nonce_len;

        let mut salt = [0u8; SALT_LEN];
        salt.copy_from_slice(&data[salt_start..nonce_start]);

        let nonce = data[nonce_start..key_id_start].to_vec();

        let mut key_id = [0u8; KEY_ID_LEN];
        key_id.copy_from_slice(&data[key_id_start..header_len]);

        Ok(EnvelopeHeader {
            version,
            algorithm,
            salt,
            nonce,
            key_id,
            header_len,
        })
    }
}

// ── decrypt_any ───────────────────────────────────────────────────────────────

/// Decrypt an envelope produced by either V1 or V2, using a raw 32-byte key.
///
/// Dispatches on the version byte in the envelope header. V1 payloads are
/// decrypted with AES-256-GCM; V2 payloads with XChaCha20-Poly1305.
///
/// # Invariant
/// V1 support is **permanent**. Do not remove the V1 branch.
pub fn decrypt_any(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, EncryptionError> {
    let header = EnvelopeHeader::parse(data)?;
    match header.version {
        EnvelopeVersion::V1 => {
            // Delegate to the existing V1 path in encryption.rs.
            let enc = crate::encryption::VaultEncryption::new();
            enc.decrypt_data(data, key)
        }
        EnvelopeVersion::V2 => xchacha20_decrypt(key, &header.nonce, &data[header.header_len..]),
    }
}

/// Decrypt a V2 (XChaCha20-Poly1305) envelope produced by a passphrase.
///
/// Re-derives the key from the salt stored in the envelope header. Fails
/// cleanly for a wrong passphrase.
pub fn decrypt_any_with_passphrase(
    data: &[u8],
    passphrase: &str,
) -> Result<Vec<u8>, EncryptionError> {
    let header = EnvelopeHeader::parse(data)?;
    if header.salt.iter().all(|&b| b == 0) {
        return Err(EncryptionError::InvalidFormat(
            "payload carries no KDF salt; was encrypted with a raw key".into(),
        ));
    }

    match header.version {
        EnvelopeVersion::V1 => {
            let enc = crate::encryption::VaultEncryption::new();
            enc.decrypt_data_with_passphrase(data, passphrase)
        }
        EnvelopeVersion::V2 => {
            let enc = crate::encryption::VaultEncryption::new();
            let key = enc.derive_key(passphrase, &header.salt)?;
            if key_id_for(key.as_bytes()) != header.key_id {
                return Err(EncryptionError::InvalidPassphrase);
            }
            xchacha20_decrypt(key.as_bytes(), &header.nonce, &data[header.header_len..])
                .map_err(|_| EncryptionError::InvalidPassphrase)
        }
    }
}

// ── V2 encrypt ────────────────────────────────────────────────────────────────

/// Encrypt `data` with a raw 32-byte key using XChaCha20-Poly1305 (V2).
///
/// New writes should use this function; V1 writes are only for backward
/// compatibility tests.
pub fn encrypt_v2(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, EncryptionError> {
    encrypt_v2_with_header(data, key, &[0u8; SALT_LEN], &[0u8; KEY_ID_LEN])
}

/// Encrypt `data` with a passphrase using XChaCha20-Poly1305 (V2).
pub fn encrypt_v2_with_passphrase(
    data: &[u8],
    passphrase: &str,
) -> Result<Vec<u8>, EncryptionError> {
    let enc = crate::encryption::VaultEncryption::new();
    let salt = generate_salt()?;
    let key = enc.derive_key(passphrase, &salt)?;
    let kid = key_id_for(key.as_bytes());
    encrypt_v2_with_header(data, key.as_bytes(), &salt, &kid)
}

fn encrypt_v2_with_header(
    data: &[u8],
    key: &[u8; 32],
    salt: &[u8; SALT_LEN],
    key_id: &[u8; KEY_ID_LEN],
) -> Result<Vec<u8>, EncryptionError> {
    let nonce = generate_v2_nonce()?;
    let ciphertext = xchacha20_encrypt(key, &nonce, data)?;

    let mut out = Vec::with_capacity(V2_HEADER_LEN + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.push(VERSION_V2);
    out.push(ALGORITHM_XCHACHA20POLY1305);
    out.push(KDF_ARGON2ID);
    out.extend_from_slice(salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(key_id);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

// ── Low-level crypto ──────────────────────────────────────────────────────────

fn xchacha20_encrypt(
    key: &[u8; 32],
    nonce: &[u8],
    plaintext: &[u8],
) -> Result<Vec<u8>, EncryptionError> {
    let cipher = XChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| EncryptionError::Encrypt(e.to_string()))?;
    let xnonce = XNonce::from_slice(nonce);
    cipher
        .encrypt(xnonce, plaintext)
        .map_err(|e| EncryptionError::Encrypt(e.to_string()))
}

fn xchacha20_decrypt(
    key: &[u8; 32],
    nonce: &[u8],
    ciphertext: &[u8],
) -> Result<Vec<u8>, EncryptionError> {
    let cipher = XChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| EncryptionError::Decrypt(e.to_string()))?;
    let xnonce = XNonce::from_slice(nonce);
    cipher
        .decrypt(xnonce, ciphertext)
        .map_err(|e| EncryptionError::Decrypt(e.to_string()))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn generate_salt() -> Result<[u8; SALT_LEN], EncryptionError> {
    let mut buf = [0u8; SALT_LEN];
    getrandom::fill(&mut buf)
        .map_err(|e| EncryptionError::Encrypt(format!("random source unavailable: {e}")))?;
    Ok(buf)
}

fn generate_v2_nonce() -> Result<[u8; V2_NONCE_LEN], EncryptionError> {
    let mut buf = [0u8; V2_NONCE_LEN];
    getrandom::fill(&mut buf)
        .map_err(|e| EncryptionError::Encrypt(format!("random source unavailable: {e}")))?;
    Ok(buf)
}

fn key_id_for(key: &[u8; 32]) -> [u8; KEY_ID_LEN] {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(b"scriptor-vault-key-id\0");
    hasher.update(key);
    let digest = hasher.finalize();
    let mut id = [0u8; KEY_ID_LEN];
    id.copy_from_slice(&digest[..KEY_ID_LEN]);
    id
}

// Allow unused import in non-test builds (zeroize is used by DerivedKey in encryption.rs).
#[allow(dead_code)]
fn _zeroize_check() {
    let mut _x = [0u8; 32];
    _x.zeroize();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── V2 encrypt/decrypt ────────────────────────────────────────────────────

    #[test]
    fn v2_encrypt_decrypt_roundtrip_raw_key() {
        let key = [0x42u8; 32];
        let data = b"XChaCha20-Poly1305 roundtrip";
        let encrypted = encrypt_v2(data, &key).unwrap();
        // Header must not be confused with V1.
        assert_eq!(&encrypted[..4], b"SENC");
        assert_eq!(encrypted[4], 2, "expected V2 version byte");
        let decrypted = decrypt_any(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn v2_nonces_are_unique() {
        let key = [1u8; 32];
        let e1 = encrypt_v2(b"x", &key).unwrap();
        let e2 = encrypt_v2(b"x", &key).unwrap();
        // Nonce starts at byte 7 + SALT_LEN = 23, length 24.
        let n1 = &e1[23..47];
        let n2 = &e2[23..47];
        assert_ne!(n1, n2, "XChaCha20 nonces must be unique per encrypt call");
    }

    #[test]
    fn v2_passphrase_roundtrip() {
        let data = b"encrypted with passphrase v2";
        let enc = encrypt_v2_with_passphrase(data, "correct horse").unwrap();
        let dec = decrypt_any_with_passphrase(&enc, "correct horse").unwrap();
        assert_eq!(dec, data);
    }

    #[test]
    fn v2_wrong_passphrase_fails_cleanly() {
        let enc = encrypt_v2_with_passphrase(b"secret", "right").unwrap();
        let err =
            decrypt_any_with_passphrase(&enc, "wrong").expect_err("wrong passphrase must fail");
        assert!(matches!(err, EncryptionError::InvalidPassphrase), "{err}");
    }

    // ── decrypt_any dispatches to V1 ──────────────────────────────────────────

    #[test]
    fn decrypt_any_reads_v1_payload() {
        // Produce a V1 ciphertext using the existing VaultEncryption API.
        let enc_v1 = crate::encryption::VaultEncryption::new();
        let key = [0xABu8; 32];
        let data = b"legacy V1 payload";
        let v1_blob = enc_v1.encrypt_data(data, &key).unwrap();
        assert_eq!(v1_blob[4], 1, "must be V1");

        // decrypt_any must read it without the caller specifying a version.
        let decrypted = decrypt_any(&v1_blob, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    // ── EnvelopeHeader::parse ─────────────────────────────────────────────────

    #[test]
    fn parse_v2_header_fields() {
        let key = [7u8; 32];
        let blob = encrypt_v2(b"header test", &key).unwrap();
        let header = EnvelopeHeader::parse(&blob).unwrap();
        assert_eq!(header.version, EnvelopeVersion::V2);
        assert_eq!(header.algorithm, ALGORITHM_XCHACHA20POLY1305);
        assert_eq!(header.nonce.len(), V2_NONCE_LEN);
        assert_eq!(header.header_len, V2_HEADER_LEN);
    }

    #[test]
    fn parse_rejects_bad_magic() {
        let mut blob = vec![0u8; V2_HEADER_LEN + TAG_LEN + 4];
        blob[0..4].copy_from_slice(b"XXXX");
        assert!(EnvelopeHeader::parse(&blob).is_err());
    }

    #[test]
    fn parse_rejects_unknown_version() {
        let mut blob = vec![0u8; V2_HEADER_LEN + TAG_LEN + 4];
        blob[0..4].copy_from_slice(b"SENC");
        blob[4] = 99;
        assert!(EnvelopeHeader::parse(&blob).is_err());
    }

    // ── V2 tamper detection ───────────────────────────────────────────────────

    #[test]
    fn v2_tampered_ciphertext_rejected() {
        let key = [0x33u8; 32];
        let mut blob = encrypt_v2(b"authentic", &key).unwrap();
        let last = blob.len() - 1;
        blob[last] ^= 0xFF;
        assert!(decrypt_any(&blob, &key).is_err());
    }
}
