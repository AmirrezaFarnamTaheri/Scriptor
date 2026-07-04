# Vault Encryption at Rest

## Status

- **Phase**: D — Strategic Expansion
- **Priority**: High (security-sensitive)

## Current State

Vault files are stored as **plaintext markdown** on disk:

```
vault/
├── notes/
│   ├── daily/2026-06-27.md      ← plaintext
│   ├── projects/alpha.md        ← plaintext
│   └── inbox/thought.md         ← plaintext
├── .scriptor/
│   ├── config.json              ← plaintext
│   └── index.db                 ← plaintext SQLite
└── assets/
    └── image.png                ← plaintext
```

**Problems**:
- Full disk access = full vault access
- No protection if device is stolen/lost
- Cloud sync (iCloud, Dropbox) exposes content to provider
- No compliance with data-at-rest requirements (HIPAA, SOC2)

## Approach

### Per-Vault AES-256-GCM Encryption

Each vault gets an independent encryption key. Files are encrypted individually, allowing atomic read/write without decrypting the entire vault.

```
vault/
├── .scriptor/
│   ├── vault.enc.json           ← encrypted vault config
│   ├── index.db                 ← encrypted SQLite (SQLCipher)
│   └── key.meta                 ← key derivation params (no secrets)
├── notes/
│   ├── daily/2026-06-27.md.enc  ← encrypted note
│   ├── projects/alpha.md.enc    ← encrypted note
│   └── inbox/thought.md.enc     ← encrypted note
└── assets/
    └── image.png.enc            ← encrypted asset
```

### File Format

Each `.enc` file:

```
┌────────────────────────────────────────────────┐
│ Header (plaintext, 48 bytes)                    │
│  ┌───────────────────────────────────────────┐ │
│  │ Magic bytes: "SENC" (4 bytes)             │ │
│  │ Version: u8 (1 byte)                      │ │
│  │ Algorithm: u8 (1 = AES-256-GCM)          │ │
│  │ KDF: u8 (1 = Argon2id)                   │ │
│  │ Salt: [u8; 16] (16 bytes)                 │ │
│  │ Nonce: [u8; 12] (12 bytes)                │ │
│  │ Key ID: [u8; 4] (4 bytes, for key rotation)│ │
│  └───────────────────────────────────────────┘ │
│                                                │
│ Ciphertext (variable length)                    │
│  ┌───────────────────────────────────────────┐ │
│  │ AES-256-GCM encrypted data                │ │
│  │ (includes GCM auth tag, 16 bytes)         │ │
│  └───────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

## Key Derivation

### Argon2id Parameters

```rust
use argon2::{Argon2, Version, Params};

pub fn derive_key(passphrase: &[u8], salt: &[u8; 16]) -> Result<[u8; 32], KdfError> {
    let params = Params::new(
        65536,      // memory: 64 MB
        3,          // iterations
        4,          // parallelism
        Some(32),   // output length
    )?;

    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        Version::V0x13,
        params,
    );

    let mut key = [0u8; 32];
    argon2.hash_password_into(passphrase, salt, &mut key)?;
    Ok(key)
}
```

### Key Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ Key Derivation Flow                                      │
│                                                          │
│  User passphrase                                         │
│       │                                                  │
│       ↓                                                  │
│  ┌──────────────┐                                       │
│  │ Argon2id      │ ← salt (stored in key.meta)          │
│  │ 64 MB / 3 / 4 │ ← time cost: ~500ms on M1           │
│  └──────┬───────┘                                       │
│         │                                                │
│         ↓                                                │
│  ┌──────────────┐                                       │
│  │ Master Key    │ ← 256-bit, never stored              │
│  │ (in memory)   │                                       │
│  └──────┬───────┘                                       │
│         │                                                │
│         ↓                                                │
│  ┌──────────────┐                                       │
│  │ HKDF-SHA256   │ ← derive per-file keys               │
│  │               │   info = file path                    │
│  └──────┬───────┘                                       │
│         │                                                │
│         ↓                                                │
│  ┌──────────────┐                                       │
│  │ File Key      │ ← unique per file                    │
│  │ (256-bit)     │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

### Key Meta File

```json
// .scriptor/key.meta (plaintext, no secrets)
{
  "version": 1,
  "algorithm": "aes-256-gcm",
  "kdf": "argon2id",
  "kdf_params": {
    "memory_kb": 65536,
    "iterations": 3,
    "parallelism": 4
  },
  "salt": "base64-encoded-16-bytes",
  "key_id": "base64-encoded-4-bytes",
  "created_at": "2026-06-27T00:00:00Z",
  "recovery_hint": "optional user-provided hint"
}
```

## Integration with Existing Paths

### Read Path

```rust
// crates/vault/src/read.rs
pub fn read_note_encrypted(
    vault_root: &Path,
    path: &RelativeVaultPath,
    master_key: &[u8; 32],
) -> Result<String, ReadError> {
    let enc_path = vault_root.join(path.as_str().replace(".md", ".md.enc"));

    // 1. Read header (48 bytes)
    let header = read_header(&enc_path)?;

    // 2. Derive file key via HKDF
    let file_key = hkdf_derive(master_key, path.as_str().as_bytes());

    // 3. Decrypt with AES-256-GCM
    let plaintext = aes_gcm_decrypt(&file_key, &header.nonce, &read_ciphertext(&enc_path)?)?;

    // 4. Return UTF-8 string
    String::from_utf8(plaintext).map_err(|_| ReadError::InvalidUtf8)
}
```

### Write Path

```rust
// crates/vault/src/save.rs
pub fn save_note_encrypted(
    vault_root: &Path,
    path: &RelativeVaultPath,
    content: &str,
    master_key: &[u8; 32],
) -> Result<(), SaveError> {
    let enc_path = vault_root.join(path.as_str().replace(".md", ".md.enc"));

    // 1. Generate random nonce
    let nonce = generate_nonce();

    // 2. Derive file key via HKDF
    let file_key = hkdf_derive(master_key, path.as_str().as_bytes());

    // 3. Encrypt with AES-256-GCM
    let ciphertext = aes_gcm_encrypt(&file_key, &nonce, content.as_bytes())?;

    // 4. Atomic write (existing pattern)
    let header = EncHeader::new(nonce);
    atomic_write_encrypted(&enc_path, &header, &ciphertext)?;

    Ok(())
}
```

### SQLite Index (SQLCipher)

```rust
// crates/indexer/src/cache.rs
use rusqlite::Connection;

pub fn open_encrypted_cache(db_path: &Path, key: &[u8; 32]) -> Result<Connection, IndexError> {
    let conn = Connection::open(db_path)?;

    // SQLCipher configuration
    conn.execute_batch(&format!(
        "PRAGMA key = 'x\"{}\"';",
        hex::encode(key)
    ))?;
    conn.execute_batch("PRAGMA cipher_compatibility = 4;")?;
    conn.execute_batch("PRAGMA kdf_iter = 256000;")?;

    // Verify decryption works
    conn.execute_batch("SELECT count(*) FROM sqlite_master;")?;

    Ok(conn)
}
```

## Memory Security

```rust
// Use zeroize crate to clear key material
use zeroize::Zeroize;

pub struct VaultKey {
    key: [u8; 32],
}

impl Drop for VaultKey {
    fn drop(&mut self) {
        self.key.zeroize();
    }
}

// Pin key in memory to prevent swapping
#[cfg(unix)]
pub fn pin_memory(data: &mut [u8]) -> Result<(), std::io::Error> {
    unsafe { libc::mlock(data.as_ptr() as *const libc::c_void, data.len()) };
    Ok(())
}
```

## Performance Impact

| Operation | Plaintext | Encrypted | Overhead |
|-----------|-----------|-----------|----------|
| Read 1 KB note | ~0.1 ms | ~0.3 ms | +0.2 ms |
| Write 1 KB note | ~0.5 ms | ~0.8 ms | +0.3 ms |
| Vault scan (1000 notes) | ~200 ms | ~400 ms | +100 ms |
| FTS5 query | ~5 ms | ~8 ms | +3 ms |
| First unlock (Argon2id) | N/A | ~500 ms | one-time |

## Existing Code Integration

### command_gateway changes

```rust
// New commands
"vault_encrypt",           // enable encryption for vault
"vault_unlock",            // unlock encrypted vault (provide passphrase)
"vault_lock",              // lock vault (clear key from memory)
"vault_change_passphrase", // change passphrase
"vault_encrypt_status",    // is vault encrypted? is it locked?

// Modified commands (transparent encryption)
// read_note, save_note, etc. check encryption state internally
```

### DaemonState changes

```rust
pub struct DaemonState {
    // ... existing fields ...
    pub vault_key: Arc<Mutex<Option<VaultKey>>>,  // None = locked or unencrypted
}
```

### Vault config integration

```json
// .scriptor/config.json
{
  "encryption": {
    "enabled": true,
    "algorithm": "aes-256-gcm",
    "auto_lock_minutes": 30,
    "require_passphrase_on_launch": true
  }
}
```

## Legal Review Notes

### AGPL Considerations

Scriptor is AGPL-3.0. Adding encryption:

- **No license conflict**: AES/Argon2 implementations are MIT/Apache-2.0 licensed
- **Crypto libraries**: `aes-gcm` (MIT/Apache-2.0), `argon2` (MIT/Apache-2.0), `ring` (ISC/OpenSSL)
- **No crypto export restrictions for open-source**: US EAR exemption for open-source crypto (§740.13(e))

### Export Compliance

- **US**: Open-source encryption is generally exempt from EAR
- **EU**: No restrictions on open-source crypto
- **China**: May require review for commercial distribution
- **Russia**: Notification requirement for crypto-using software

### Recommended Actions

1. Add encryption notice to LICENSE file
2. Include crypto library attributions in NOTICE file
3. Document encryption capabilities in export compliance section
4. Consult legal counsel for commercial distribution in restricted jurisdictions

## Migration Path

1. **Phase 1**: Implement encryption primitives (AES-GCM, Argon2id, HKDF)
2. **Phase 2**: Add `.enc` file format, transparent read/write with feature flag
3. **Phase 3**: SQLCipher integration for index database
4. **Phase 4**: UI for passphrase management, auto-lock
5. **Phase 5**: Key rotation, recovery key support

## Open Questions

- [ ] How to handle vault sharing between devices (key sync)?
- [ ] Recovery key: BIP39 mnemonic or custom scheme?
- [ ] Should encrypted and unencrypted notes coexist in one vault?
- [ ] How to handle git diffs for encrypted files?
- [ ] Biometric unlock (Touch ID / Windows Hello) as passphrase alternative?
- [ ] Should the daemon hold the key in memory, or re-derive per operation?
