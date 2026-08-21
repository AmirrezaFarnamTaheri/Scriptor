//! Current V1 envelope encryption.
//!
//! # Envelope format
//!
//! ```text
//! [MAGIC 4B] [VERSION 1B] [ALGORITHM 1B] [KDF 1B] [SALT 16B] [NONCE ?B] [KEY_ID 4B] [CIPHERTEXT+TAG]
//! ```
//!
//! | Version byte | Algorithm | Nonce | Notes |
//! |---|---|---|---|
//! | `2` | XChaCha20-Poly1305 | 24 B | Current V1 product envelope |
//!
//! # Rules (binding)
//! - Every write and read uses XChaCha20-Poly1305 envelope version `2`.
//! - Other envelope versions are rejected before decryption.
//! - The ASCII inline marker (`%%scriptor-enc:v2:<hint-b64>:<payload-b64>%%`)
//!   lives in `inline_encrypt.rs` and uses this module's sole envelope path.

use chacha20poly1305::aead::Aead;
use chacha20poly1305::{KeyInit, XChaCha20Poly1305, XNonce};
use zeroize::Zeroize;

use crate::encryption::EncryptionError;

// ── Constants ──────────────────────────────────────────────────────────────────

const MAGIC: &[u8; 4] = b"SENC";

/// Version byte stored in the envelope header.
const VERSION_V2: u8 = 2;

const ALGORITHM_XCHACHA20POLY1305: u8 = 2;

const KDF_ARGON2ID: u8 = 1;
const SALT_LEN: usize = 16;
const KEY_ID_LEN: usize = 4;
const TAG_LEN: usize = 16;

const V2_NONCE_LEN: usize = 24; // XChaCha20 uses a 192-bit nonce

const V2_HEADER_LEN: usize = 4 + 1 + 1 + 1 + SALT_LEN + V2_NONCE_LEN + KEY_ID_LEN;

// ── Parsed header ─────────────────────────────────────────────────────────────

/// Parsed envelope header without the ciphertext.
#[derive(Debug, Clone)]
pub struct EnvelopeHeader {
    /// The current XChaCha20-Poly1305 algorithm byte.
    pub algorithm: u8,
    pub salt: [u8; SALT_LEN],
    /// XChaCha20-Poly1305 nonce (24 bytes).
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

        if data[4] != VERSION_V2 {
            return Err(EncryptionError::InvalidFormat(format!(
                "unsupported envelope version {}",
                data[4]
            )));
        }
        if data[5] != ALGORITHM_XCHACHA20POLY1305 {
            return Err(EncryptionError::UnsupportedAlgorithm(format!(
                "algorithm byte {}",
                data[5]
            )));
        }

        if data[6] != KDF_ARGON2ID {
            return Err(EncryptionError::UnsupportedAlgorithm(format!(
                "unsupported KDF byte {}",
                data[6]
            )));
        }

        if data.len() < V2_HEADER_LEN + TAG_LEN {
            return Err(EncryptionError::InvalidFormat(
                "payload too short for header + tag".into(),
            ));
        }

        let salt_start = 7;
        let nonce_start = salt_start + SALT_LEN;
        let key_id_start = nonce_start + V2_NONCE_LEN;

        let mut salt = [0u8; SALT_LEN];
        salt.copy_from_slice(&data[salt_start..nonce_start]);

        let nonce = data[nonce_start..key_id_start].to_vec();

        let mut key_id = [0u8; KEY_ID_LEN];
        key_id.copy_from_slice(&data[key_id_start..V2_HEADER_LEN]);

        Ok(EnvelopeHeader {
            algorithm: ALGORITHM_XCHACHA20POLY1305,
            salt,
            nonce,
            key_id,
            header_len: V2_HEADER_LEN,
        })
    }
}

/// Decrypt the current XChaCha20-Poly1305 envelope using a raw 32-byte key.
pub fn decrypt(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, EncryptionError> {
    let header = EnvelopeHeader::parse(data)?;
    xchacha20_decrypt(key, &header.nonce, &data[header.header_len..])
}

/// Decrypt a V2 (XChaCha20-Poly1305) envelope produced by a passphrase.
///
/// Re-derives the key from the salt stored in the envelope header. Fails
/// cleanly for a wrong passphrase.
pub fn decrypt_with_passphrase(data: &[u8], passphrase: &str) -> Result<Vec<u8>, EncryptionError> {
    let header = EnvelopeHeader::parse(data)?;
    if header.salt.iter().all(|&b| b == 0) {
        return Err(EncryptionError::InvalidFormat(
            "payload carries no KDF salt; was encrypted with a raw key".into(),
        ));
    }

    let enc = crate::encryption::VaultEncryption::new();
    let key = enc.derive_key(passphrase, &header.salt)?;
    if key_id_for(key.as_bytes()) != header.key_id {
        return Err(EncryptionError::InvalidPassphrase);
    }
    xchacha20_decrypt(key.as_bytes(), &header.nonce, &data[header.header_len..])
        .map_err(|_| EncryptionError::InvalidPassphrase)
}

// ── V2 encrypt ────────────────────────────────────────────────────────────────

/// Encrypt `data` with a raw 32-byte key using XChaCha20-Poly1305 (V2).
///
/// All raw-key writes use this current envelope.
pub fn encrypt(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, EncryptionError> {
    encrypt_with_header(data, key, &[0u8; SALT_LEN], &[0u8; KEY_ID_LEN])
}

/// Encrypt `data` with a passphrase using XChaCha20-Poly1305 (V2).
pub fn encrypt_with_passphrase(data: &[u8], passphrase: &str) -> Result<Vec<u8>, EncryptionError> {
    let enc = crate::encryption::VaultEncryption::new();
    let salt = generate_salt()?;
    let key = enc.derive_key(passphrase, &salt)?;
    let kid = key_id_for(key.as_bytes());
    encrypt_with_header(data, key.as_bytes(), &salt, &kid)
}

fn encrypt_with_header(
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
    let xnonce = XNonce::try_from(nonce).map_err(|_| {
        EncryptionError::Encrypt(format!(
            "invalid XChaCha20 nonce length: expected {V2_NONCE_LEN} bytes"
        ))
    })?;
    cipher
        .encrypt(&xnonce, plaintext)
        .map_err(|e| EncryptionError::Encrypt(e.to_string()))
}

fn xchacha20_decrypt(
    key: &[u8; 32],
    nonce: &[u8],
    ciphertext: &[u8],
) -> Result<Vec<u8>, EncryptionError> {
    let cipher = XChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| EncryptionError::Decrypt(e.to_string()))?;
    let xnonce = XNonce::try_from(nonce).map_err(|_| {
        EncryptionError::Decrypt(format!(
            "invalid XChaCha20 nonce length: expected {V2_NONCE_LEN} bytes"
        ))
    })?;
    cipher
        .decrypt(&xnonce, ciphertext)
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

    #[test]
    fn encrypt_decrypt_roundtrip_raw_key() {
        let key = [0x42u8; 32];
        let data = b"XChaCha20-Poly1305 roundtrip";
        let encrypted = encrypt(data, &key).unwrap();
        assert_eq!(&encrypted[..4], b"SENC");
        assert_eq!(encrypted[4], VERSION_V2);
        let decrypted = decrypt(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn nonces_are_unique() {
        let key = [1u8; 32];
        let e1 = encrypt(b"x", &key).unwrap();
        let e2 = encrypt(b"x", &key).unwrap();
        // Nonce starts at byte 7 + SALT_LEN = 23, length 24.
        let n1 = &e1[23..47];
        let n2 = &e2[23..47];
        assert_ne!(n1, n2, "XChaCha20 nonces must be unique per encrypt call");
    }

    #[test]
    fn passphrase_roundtrip() {
        let data = b"encrypted with passphrase";
        let enc = encrypt_with_passphrase(data, "correct horse").unwrap();
        let dec = decrypt_with_passphrase(&enc, "correct horse").unwrap();
        assert_eq!(dec, data);
    }

    #[test]
    fn wrong_passphrase_fails_cleanly() {
        let enc = encrypt_with_passphrase(b"secret", "right").unwrap();
        let err = decrypt_with_passphrase(&enc, "wrong").expect_err("wrong passphrase must fail");
        assert!(matches!(err, EncryptionError::InvalidPassphrase), "{err}");
    }

    #[test]
    fn decrypt_rejects_obsolete_envelope() {
        let enc_v1 = crate::encryption::VaultEncryption::new();
        let key = [0xABu8; 32];
        let obsolete_blob = enc_v1.encrypt_data(b"obsolete payload", &key).unwrap();
        assert!(decrypt(&obsolete_blob, &key).is_err());
    }

    // ── EnvelopeHeader::parse ─────────────────────────────────────────────────

    #[test]
    fn parse_current_header_fields() {
        let key = [7u8; 32];
        let blob = encrypt(b"header test", &key).unwrap();
        let header = EnvelopeHeader::parse(&blob).unwrap();
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

    #[test]
    fn tampered_ciphertext_rejected() {
        let key = [0x33u8; 32];
        let mut blob = encrypt(b"authentic", &key).unwrap();
        let last = blob.len() - 1;
        blob[last] ^= 0xFF;
        assert!(decrypt(&blob, &key).is_err());
    }
}
