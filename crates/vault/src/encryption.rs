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

    pub fn encrypt_data(&self, data: &[u8], key: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        if key.len() != 32 {
            return Err(EncryptionError::Encrypt("key must be 32 bytes".into()));
        }
        let nonce = generate_nonce();
        let ciphertext = aes_gcm_encrypt(key, &nonce, data)?;
        let key_id = generate_key_id();
        let salt = generate_salt();

        let mut output = Vec::with_capacity(HEADER_LEN + ciphertext.len());
        output.extend_from_slice(MAGIC);
        output.push(VERSION);
        output.push(ALGORITHM_AES256GCM);
        output.push(KDF_ARGON2ID);
        output.extend_from_slice(&salt);
        output.extend_from_slice(&nonce);
        output.extend_from_slice(&key_id);
        output.extend_from_slice(&ciphertext);
        Ok(output)
    }

    pub fn decrypt_data(&self, encrypted: &[u8], key: &[u8]) -> Result<Vec<u8>, EncryptionError> {
        if encrypted.len() < HEADER_LEN + TAG_LEN {
            return Err(EncryptionError::InvalidFormat("file too short".into()));
        }
        if &encrypted[..4] != MAGIC {
            return Err(EncryptionError::InvalidFormat("bad magic bytes".into()));
        }
        if encrypted[4] != VERSION {
            return Err(EncryptionError::InvalidFormat(format!("unsupported version {}", encrypted[4])));
        }
        if encrypted[5] != ALGORITHM_AES256GCM {
            return Err(EncryptionError::UnsupportedAlgorithm(format!("algorithm byte {}", encrypted[5])));
        }
        let nonce = &encrypted[HEADER_LEN - NONCE_LEN - KEY_ID_LEN..HEADER_LEN - KEY_ID_LEN];
        let ciphertext = &encrypted[HEADER_LEN..];
        aes_gcm_decrypt(key, nonce, ciphertext)
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

fn generate_nonce() -> [u8; NONCE_LEN] {
    let mut nonce = [0u8; NONCE_LEN];
    fill_random(&mut nonce);
    nonce
}

fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    fill_random(&mut salt);
    salt
}

fn generate_key_id() -> [u8; KEY_ID_LEN] {
    let mut id = [0u8; KEY_ID_LEN];
    fill_random(&mut id);
    id
}

fn fill_random(buf: &mut [u8]) {
    getrandom::getrandom(buf).expect("random source unavailable");
}

fn aes_gcm_encrypt(key: &[u8], nonce: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, EncryptionError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| EncryptionError::Encrypt(e.to_string()))?;
    let nonce = Nonce::from_slice(nonce);
    cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| EncryptionError::Encrypt(e.to_string()))
}

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
        let ptr = slice.as_mut_ptr();
        unsafe {
            let _ = std::ptr::read(ptr as *const [u8; 32]);
            std::ptr::write(slice, [0u8; 32]);
        }
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
