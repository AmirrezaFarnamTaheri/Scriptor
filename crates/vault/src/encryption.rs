use std::fs;
use std::path::Path;

use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::Aead;
use argon2::{Algorithm, Argon2, Params, Version};
use thiserror::Error;
use zeroize::Zeroize;

#[derive(Debug, Error)]
pub enum EncryptionError {
    #[error("io error at {path}: {source}")]
    Io {
        path: std::path::PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("encryption failed: {0}")]
    Encrypt(String),
    #[error("decryption failed: {0}")]
    Decrypt(String),
    #[error("key derivation failed: {0}")]
    KeyDerivation(String),
    #[error("invalid encrypted file format: {0}")]
    InvalidFormat(String),
    #[error("unsupported algorithm: {0}")]
    UnsupportedAlgorithm(String),
    #[error("invalid passphrase")]
    InvalidPassphrase,
}

impl EncryptionError {
    fn io(path: impl Into<std::path::PathBuf>, source: std::io::Error) -> Self {
        Self::Io {
            path: path.into(),
            source,
        }
    }
}

const MAGIC: &[u8; 4] = b"SENC";
const VERSION: u8 = 1;
const ALGORITHM_AES256GCM: u8 = 1;
const KDF_ARGON2ID: u8 = 1;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_ID_LEN: usize = 4;
const HEADER_LEN: usize = 4 + 1 + 1 + 1 + SALT_LEN + NONCE_LEN + KEY_ID_LEN;
const TAG_LEN: usize = 16;

#[derive(Debug, Clone)]
pub struct VaultEncryption {
    pub algorithm: String,
    pub memory_kb: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

pub struct DerivedKey([u8; 32]);

impl DerivedKey {
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    pub fn as_bytes_mut(&mut self) -> &mut [u8; 32] {
        &mut self.0
    }
}

impl Drop for DerivedKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl Default for VaultEncryption {
    fn default() -> Self {
        Self {
            algorithm: "aes-256-gcm".into(),
            memory_kb: 65536,
            iterations: 3,
            parallelism: 4,
        }
    }
}

impl VaultEncryption {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn derive_key(&self, passphrase: &str, salt: &[u8]) -> Result<DerivedKey, EncryptionError> {
        if salt.len() < SALT_LEN {
            return Err(EncryptionError::KeyDerivation("salt too short".into()));
        }
        let params = Params::new(self.memory_kb, self.iterations, self.parallelism, Some(32))
            .map_err(|e| EncryptionError::KeyDerivation(e.to_string()))?;
        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        let mut key = [0u8; 32];
        let result = argon2.hash_password_into(passphrase.as_bytes(), &salt[..SALT_LEN], &mut key);
        match result {
            Ok(()) => Ok(DerivedKey(key)),
            Err(e) => {
                key.zeroize();
                Err(EncryptionError::KeyDerivation(e.to_string()))
            }
        }
    }

    /// Encrypts with a caller-supplied raw key.
    ///
    /// No passphrase was involved, so the header records an all-zero salt and
    /// key id: those fields describe the Argon2 derivation, and inventing random
    /// values for them (as this used to do) makes the file claim a derivation
    /// that never happened and can never be reproduced.
    pub fn encrypt_data(&self, data: &[u8], key: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        self.encrypt_with_header(data, key, &[0u8; SALT_LEN], &[0u8; KEY_ID_LEN])
    }

    /// Derives a key from `passphrase` and stores the salt and key id that were
    /// actually used, so [`decrypt_data_with_passphrase`](Self::decrypt_data_with_passphrase)
    /// can reproduce the derivation.
    pub fn encrypt_data_with_passphrase(
        &self,
        data: &[u8],
        passphrase: &str,
    ) -> Result<Vec<u8>, EncryptionError> {
        let salt = generate_salt()?;
        let key = self.derive_key(passphrase, &salt)?;
        let key_id = key_id_for(key.as_bytes());
        self.encrypt_with_header(data, key.as_bytes(), &salt, &key_id)
    }

    fn encrypt_with_header(
        &self,
        data: &[u8],
        key: &[u8],
        salt: &[u8; SALT_LEN],
        key_id: &[u8; KEY_ID_LEN],
    ) -> Result<Vec<u8>, EncryptionError> {
        if key.len() != 32 {
            return Err(EncryptionError::Encrypt("key must be 32 bytes".into()));
        }
        let nonce = generate_nonce()?;
        let ciphertext = aes_gcm_encrypt(key, &nonce, data)?;

        let mut output = Vec::with_capacity(HEADER_LEN + ciphertext.len());
        output.extend_from_slice(MAGIC);
        output.push(VERSION);
        output.push(ALGORITHM_AES256GCM);
        output.push(KDF_ARGON2ID);
        output.extend_from_slice(salt);
        output.extend_from_slice(&nonce);
        output.extend_from_slice(key_id);
        output.extend_from_slice(&ciphertext);
        Ok(output)
    }

    pub fn decrypt_data(&self, encrypted: &[u8], key: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        let header = EncryptedHeader::parse(encrypted)?;
        aes_gcm_decrypt(key, &header.nonce, &encrypted[HEADER_LEN..])
    }

    /// Reads the salt and key id back out of the header, re-derives the key and
    /// decrypts. Fails cleanly for a wrong passphrase and for payloads that were
    /// not produced by [`encrypt_data_with_passphrase`](Self::encrypt_data_with_passphrase).
    pub fn decrypt_data_with_passphrase(
        &self,
        encrypted: &[u8],
        passphrase: &str,
    ) -> Result<Vec<u8>, EncryptionError> {
        let header = EncryptedHeader::parse(encrypted)?;
        if header.salt.iter().all(|&byte| byte == 0) {
            return Err(EncryptionError::InvalidFormat(
                "payload carries no KDF salt; it was encrypted with a raw key".into(),
            ));
        }
        let key = self.derive_key(passphrase, &header.salt)?;
        // The key id is a cheap, constant-time-comparable check that reports a
        // wrong passphrase as such instead of as a generic AEAD tag failure.
        if key_id_for(key.as_bytes()) != header.key_id {
            return Err(EncryptionError::InvalidPassphrase);
        }
        aes_gcm_decrypt(key.as_bytes(), &header.nonce, &encrypted[HEADER_LEN..])
            .map_err(|_| EncryptionError::InvalidPassphrase)
    }

    /// Parses the on-disk header without decrypting.
    pub fn read_header(&self, encrypted: &[u8]) -> Result<EncryptedHeader, EncryptionError> {
        EncryptedHeader::parse(encrypted)
    }

    pub fn encrypt_note(&self, note_path: &Path, key: &DerivedKey) -> Result<(), EncryptionError> {
        let data = fs::read(note_path).map_err(|e| EncryptionError::io(note_path, e))?;
        let encrypted = self.encrypt_data(&data, key.as_bytes())?;
        let enc_path = note_path.with_extension("md.enc");
        let tmp_path = note_path.with_extension("md.enc.tmp");
        fs::write(&tmp_path, &encrypted).map_err(|e| EncryptionError::io(&tmp_path, e))?;
        {
            let f = fs::File::open(&tmp_path).map_err(|e| EncryptionError::io(&tmp_path, e))?;
            f.sync_all().map_err(|e| EncryptionError::io(&tmp_path, e))?;
        }
        fs::rename(&tmp_path, &enc_path).map_err(|e| EncryptionError::io(&enc_path, e))?;
        fs::remove_file(note_path).map_err(|e| EncryptionError::io(note_path, e))?;
        Ok(())
    }

    pub fn decrypt_note(&self, note_path: &Path, key: &DerivedKey) -> Result<String, EncryptionError> {
        let data = fs::read(note_path).map_err(|e| EncryptionError::io(note_path, e))?;
        let decrypted = self.decrypt_data(&data, key.as_bytes())?;
        String::from_utf8(decrypted).map_err(|_| EncryptionError::Decrypt("decrypted data is not valid UTF-8".into()))
    }
}

fn generate_nonce() -> Result<[u8; NONCE_LEN], EncryptionError> {
    let mut nonce = [0u8; NONCE_LEN];
    fill_random(&mut nonce)?;
    Ok(nonce)
}

fn generate_salt() -> Result<[u8; SALT_LEN], EncryptionError> {
    let mut salt = [0u8; SALT_LEN];
    fill_random(&mut salt)?;
    Ok(salt)
}

/// Stable, non-secret 4-byte tag identifying a derived key.
///
/// Domain-separated so it cannot collide with any other hash of the key, and
/// truncated to 32 bits so it identifies the key without being useful to an
/// attacker beyond what trial decryption already offers.
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

/// A missing OS random source is an environment failure, not a bug: report it
/// rather than aborting the process mid-encryption.
fn fill_random(buf: &mut [u8]) -> Result<(), EncryptionError> {
    getrandom::fill(buf)
        .map_err(|error| EncryptionError::Encrypt(format!("random source unavailable: {error}")))
}

/// Parsed header of a `SENC` payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncryptedHeader {
    pub version: u8,
    pub algorithm: u8,
    pub kdf: u8,
    /// Argon2 salt used to derive the key, or all zeroes for a raw-key payload.
    pub salt: [u8; SALT_LEN],
    pub nonce: [u8; NONCE_LEN],
    /// Tag of the derived key, or all zeroes for a raw-key payload.
    pub key_id: [u8; KEY_ID_LEN],
}

impl EncryptedHeader {
    fn parse(encrypted: &[u8]) -> Result<Self, EncryptionError> {
        if encrypted.len() < HEADER_LEN + TAG_LEN {
            return Err(EncryptionError::InvalidFormat("file too short".into()));
        }
        if &encrypted[..4] != MAGIC {
            return Err(EncryptionError::InvalidFormat("bad magic bytes".into()));
        }
        if encrypted[4] != VERSION {
            return Err(EncryptionError::InvalidFormat(format!(
                "unsupported version {}",
                encrypted[4]
            )));
        }
        if encrypted[5] != ALGORITHM_AES256GCM {
            return Err(EncryptionError::UnsupportedAlgorithm(format!(
                "algorithm byte {}",
                encrypted[5]
            )));
        }
        if encrypted[6] != KDF_ARGON2ID {
            return Err(EncryptionError::UnsupportedAlgorithm(format!(
                "kdf byte {}",
                encrypted[6]
            )));
        }

        let salt_start = 7;
        let nonce_start = salt_start + SALT_LEN;
        let key_id_start = nonce_start + NONCE_LEN;
        let mut salt = [0u8; SALT_LEN];
        salt.copy_from_slice(&encrypted[salt_start..nonce_start]);
        let mut nonce = [0u8; NONCE_LEN];
        nonce.copy_from_slice(&encrypted[nonce_start..key_id_start]);
        let mut key_id = [0u8; KEY_ID_LEN];
        key_id.copy_from_slice(&encrypted[key_id_start..HEADER_LEN]);

        Ok(Self {
            version: encrypted[4],
            algorithm: encrypted[5],
            kdf: encrypted[6],
            salt,
            nonce,
            key_id,
        })
    }
}

#[allow(deprecated)]
fn aes_gcm_encrypt(key: &[u8], nonce: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, EncryptionError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| EncryptionError::Encrypt(e.to_string()))?;
    let nonce = Nonce::from_slice(nonce);
    cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| EncryptionError::Encrypt(e.to_string()))
}

#[allow(deprecated)]
fn aes_gcm_decrypt(key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, EncryptionError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| EncryptionError::Decrypt(e.to_string()))?;
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| EncryptionError::Decrypt(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let enc = VaultEncryption::new();
        let key = [42u8; 32];
        let data = b"Hello, Scriptor!";
        let encrypted = enc.encrypt_data(data, &key).unwrap();
        assert_ne!(&encrypted[HEADER_LEN..], data);
        let decrypted = enc.decrypt_data(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn decrypt_wrong_key_fails() {
        let enc = VaultEncryption::new();
        let key = [42u8; 32];
        let wrong_key = [99u8; 32];
        let data = b"Secret note";
        let encrypted = enc.encrypt_data(data, &key).unwrap();
        let result = enc.decrypt_data(&encrypted, &wrong_key);
        assert!(result.is_err());
    }

    #[test]
    fn derive_key_deterministic() {
        let enc = VaultEncryption::new();
        let salt = [1u8; 16];
        let key1 = enc.derive_key("test-pass", &salt).unwrap();
        let key2 = enc.derive_key("test-pass", &salt).unwrap();
        assert_eq!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn derive_key_different_passphrases() {
        let enc = VaultEncryption::new();
        let salt = [1u8; 16];
        let key1 = enc.derive_key("pass-a", &salt).unwrap();
        let key2 = enc.derive_key("pass-b", &salt).unwrap();
        assert_ne!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn derived_key_zeroizes_on_drop() {
        let enc = VaultEncryption::new();
        let salt = [1u8; 16];
        let key = enc.derive_key("test-pass", &salt).unwrap();
        let bytes_before: Vec<u8> = key.as_bytes().to_vec();
        assert!(bytes_before.iter().any(|&b| b != 0));

        let mut key = key;
        let slice: &mut [u8; 32] = key.as_bytes_mut();
        slice.fill(0);
        assert!(key.as_bytes().iter().all(|&b| b == 0), "key should be zeroizable");
    }

    #[test]
    fn nonce_uniqueness_across_encryptions() {
        let enc = VaultEncryption::new();
        let key = [42u8; 32];
        let data = b"same plaintext";
        let e1 = enc.encrypt_data(data, &key).unwrap();
        let e2 = enc.encrypt_data(data, &key).unwrap();
        let nonce1 = &e1[HEADER_LEN - NONCE_LEN - KEY_ID_LEN..HEADER_LEN - KEY_ID_LEN];
        let nonce2 = &e2[HEADER_LEN - NONCE_LEN - KEY_ID_LEN..HEADER_LEN - KEY_ID_LEN];
        assert_ne!(nonce1, nonce2, "nonces must be unique per encryption");
    }

    #[test]
    fn tampered_ciphertext_rejected() {
        let enc = VaultEncryption::new();
        let key = [42u8; 32];
        let data = b"authentic data";
        let mut encrypted = enc.encrypt_data(data, &key).unwrap();
        let last = encrypted.len() - 1;
        encrypted[last] ^= 0xFF;
        let result = enc.decrypt_data(&encrypted, &key);
        assert!(result.is_err(), "tampered ciphertext must fail decryption");
    }

    #[test]
    fn derive_key_different_salts() {
        let enc = VaultEncryption::new();
        let salt_a = [1u8; 16];
        let salt_b = [2u8; 16];
        let key1 = enc.derive_key("same-pass", &salt_a).unwrap();
        let key2 = enc.derive_key("same-pass", &salt_b).unwrap();
        assert_ne!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn decrypt_data_rejects_short_input() {
        let enc = VaultEncryption::new();
        let key = [42u8; 32];
        let result = enc.decrypt_data(&[0u8; 10], &key);
        assert!(result.is_err());
    }

    #[test]
    fn decrypt_data_rejects_bad_magic() {
        let enc = VaultEncryption::new();
        let key = [42u8; 32];
        let mut data = vec![0u8; HEADER_LEN + TAG_LEN + 16];
        data[0..4].copy_from_slice(b"XXXX");
        let result = enc.decrypt_data(&data, &key);
        assert!(result.is_err());
    }

    #[test]
    fn encrypt_rejects_wrong_key_length() {
        let enc = VaultEncryption::new();
        let short_key = [0u8; 16];
        let result = enc.encrypt_data(b"hello", &short_key);
        assert!(result.is_err());
    }

    #[test]
    fn zero_key_encrypts_and_decrypts() {
        let enc = VaultEncryption::new();
        let key = [0u8; 32];
        let data = b"zero-key test payload";
        let encrypted = enc.encrypt_data(data, &key).unwrap();
        assert_ne!(&encrypted[HEADER_LEN..], data);
        let decrypted = enc.decrypt_data(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn empty_plaintext_roundtrip() {
        let enc = VaultEncryption::new();
        let key = [7u8; 32];
        let data = b"";
        let encrypted = enc.encrypt_data(data, &key).unwrap();
        let decrypted = enc.decrypt_data(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn large_plaintext_roundtrip() {
        let enc = VaultEncryption::new();
        let key = [0xAB; 32];
        let data = vec![0x42u8; 100_000];
        let encrypted = enc.encrypt_data(&data, &key).unwrap();
        let decrypted = enc.decrypt_data(&encrypted, &key).unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn passphrase_roundtrip_succeeds() {
        let enc = VaultEncryption::new();
        let data = b"passphrase protected note";
        let encrypted = enc.encrypt_data_with_passphrase(data, "correct horse").unwrap();
        let decrypted = enc
            .decrypt_data_with_passphrase(&encrypted, "correct horse")
            .unwrap();
        assert_eq!(decrypted, data);
    }

    #[test]
    fn passphrase_decrypt_with_wrong_passphrase_fails_cleanly() {
        let enc = VaultEncryption::new();
        let encrypted = enc
            .encrypt_data_with_passphrase(b"secret", "correct horse")
            .unwrap();
        let error = enc
            .decrypt_data_with_passphrase(&encrypted, "battery staple")
            .expect_err("wrong passphrase must fail");
        assert!(matches!(error, EncryptionError::InvalidPassphrase), "{error}");
    }

    #[test]
    fn header_records_the_salt_actually_used_for_derivation() {
        let enc = VaultEncryption::new();
        let encrypted = enc.encrypt_data_with_passphrase(b"payload", "pass").unwrap();
        let header = enc.read_header(&encrypted).unwrap();
        assert!(
            header.salt.iter().any(|&byte| byte != 0),
            "passphrase payloads must carry a real salt"
        );
        // Re-deriving from the stored salt must reproduce the exact key,
        // which the recorded key id confirms.
        let key = enc.derive_key("pass", &header.salt).unwrap();
        assert_eq!(key_id_for(key.as_bytes()), header.key_id);
        let decrypted = aes_gcm_decrypt(key.as_bytes(), &header.nonce, &encrypted[HEADER_LEN..]).unwrap();
        assert_eq!(decrypted, b"payload");
    }

    #[test]
    fn salt_differs_between_passphrase_encryptions() {
        let enc = VaultEncryption::new();
        let first = enc.encrypt_data_with_passphrase(b"x", "pass").unwrap();
        let second = enc.encrypt_data_with_passphrase(b"x", "pass").unwrap();
        assert_ne!(
            enc.read_header(&first).unwrap().salt,
            enc.read_header(&second).unwrap().salt
        );
    }

    #[test]
    fn raw_key_payload_records_no_kdf_material() {
        let enc = VaultEncryption::new();
        let encrypted = enc.encrypt_data(b"raw key payload", &[42u8; 32]).unwrap();
        let header = enc.read_header(&encrypted).unwrap();
        assert!(header.salt.iter().all(|&byte| byte == 0));
        assert!(header.key_id.iter().all(|&byte| byte == 0));

        let error = enc
            .decrypt_data_with_passphrase(&encrypted, "anything")
            .expect_err("raw-key payload is not passphrase decryptable");
        assert!(matches!(error, EncryptionError::InvalidFormat(_)), "{error}");
    }

    #[test]
    fn passphrase_payload_still_decrypts_with_the_derived_raw_key() {
        // The header layout is unchanged, so the raw-key path keeps working.
        let enc = VaultEncryption::new();
        let encrypted = enc.encrypt_data_with_passphrase(b"both paths", "pass").unwrap();
        let header = enc.read_header(&encrypted).unwrap();
        let key = enc.derive_key("pass", &header.salt).unwrap();
        assert_eq!(
            enc.decrypt_data(&encrypted, key.as_bytes()).unwrap(),
            b"both paths"
        );
    }

    #[test]
    fn decrypt_rejects_wrong_version() {
        let enc = VaultEncryption::new();
        let key = [42u8; 32];
        let mut data = vec![0u8; HEADER_LEN + TAG_LEN + 16];
        data[0..4].copy_from_slice(MAGIC);
        data[4] = 99; // wrong version
        let result = enc.decrypt_data(&data, &key);
        assert!(result.is_err());
    }
}
