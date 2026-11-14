//! OS-keychain Ed25519 identity. The private signing seed is never exposed to
//! renderer code, vault files, logging, or collaboration wire envelopes.
use std::time::{SystemTime, UNIX_EPOCH};

use base64::{Engine as _, engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD}};
use ring::{
    rand::SystemRandom,
    signature::{Ed25519KeyPair, KeyPair},
};
use scriptor_system_bridge::{keychain_get, keychain_set};
use sha2::{Digest, Sha256};

use super::collaboration_live_journal::JournalScope;

const MAX_CHALLENGE_BYTES: usize = 512;
const SPKI_ED25519_PREFIX: [u8; 12] =
    [0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00];

fn account_for_scope(scope: &JournalScope) -> String {
    let bound = format!(
        "{}\0{}\0{}\0{}\0{}",
        scope.vault_id, scope.room_id, scope.document_id, scope.epoch, scope.peer_id
    );
    format!("collaboration.ed25519.{}", hex::encode(Sha256::digest(bound.as_bytes())))
}

fn load_or_generate(scope: &JournalScope) -> Result<Ed25519KeyPair, String> {
    scope.validate()?;
    let account = account_for_scope(scope);
    if let Some(stored) = keychain_get(&account).map_err(|error| error.to_string())? {
        let encoded = stored.strip_prefix("ed25519-pkcs8-v1:")
            .ok_or("Unsupported native signing-key format")?;
        let pkcs8 = STANDARD.decode(encoded.as_bytes())
            .map_err(|_| "Corrupt native signing-key encoding")?;
        return Ed25519KeyPair::from_pkcs8(&pkcs8)
            .map_err(|_| "Corrupt OS-owned collaboration signing key".into());
    }
    let pkcs8 = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new())
        .map_err(|_| "Failed to generate native collaboration signing key")?;
    let encoded = format!("ed25519-pkcs8-v1:{}", STANDARD.encode(pkcs8.as_ref()));
    keychain_set(&account, &encoded).map_err(|error| error.to_string())?;
    Ed25519KeyPair::from_pkcs8(pkcs8.as_ref())
        .map_err(|_| "Unable to load newly created collaboration signing key".into())
}

fn encode_public_key_pem(raw: &[u8]) -> Result<String, String> {
    if raw.len() != 32 {
        return Err("Invalid Ed25519 public key length".into());
    }
    let mut spki = SPKI_ED25519_PREFIX.to_vec();
    spki.extend_from_slice(raw);
    let encoded = STANDARD.encode(spki);
    let pem = encoded.as_bytes()
        .chunks(64)
        .map(|chunk| String::from_utf8_lossy(chunk).into_owned())
        .collect::<Vec<_>>()
        .join("\n");
    Ok(format!("-----BEGIN PUBLIC KEY-----\n{pem}\n-----END PUBLIC KEY-----\n"))
}

pub(crate) fn public_key_pem(scope: &JournalScope) -> Result<String, String> {
    let key = load_or_generate(scope)?;
    encode_public_key_pem(key.public_key().as_ref())
}

fn validate_relay_challenge(scope: &JournalScope, challenge: &str, now_ms: u64) -> Result<(), String> {
    if challenge.len() > MAX_CHALLENGE_BYTES || !challenge.is_ascii() {
        return Err("Malformed collaboration authentication challenge".into());
    }
    let fields: Vec<_> = challenge.split('\n').collect();
    if fields.len() != 8 || fields[0] != "scriptor.live.auth.v1"
        || fields[1] != scope.room_id || fields[2] != scope.document_id
        || fields[3] != scope.epoch.to_string() || fields[4] != scope.peer_id
        || fields[5].len() != 32 || !fields[5].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        || fields[6].len() != 43 || !fields[6].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Authentication challenge is not bound to the approved peer".into());
    }
    let expiry = fields[7].parse::<u64>()
        .map_err(|_| "Invalid collaboration challenge expiry")?;
    if expiry <= now_ms || expiry > now_ms.saturating_add(60_000) {
        return Err("Collaboration challenge expired or extends beyond 60 seconds".into());
    }
    Ok(())
}

/// Callable only by the native TLS relay transport after receiving a live
/// challenge; no renderer-facing sign-arbitrary-data command is registered.
pub(crate) fn sign_relay_challenge(scope: &JournalScope, challenge: &str) -> Result<String, String> {
    scope.validate()?;
    let now_ms = SystemTime::now().duration_since(UNIX_EPOCH)
        .map_err(|_| "Invalid system time for collaboration authentication")?
        .as_millis() as u64;
    validate_relay_challenge(scope, challenge, now_ms)?;
    let key = load_or_generate(scope)?;
    Ok(URL_SAFE_NO_PAD.encode(key.sign(challenge.as_bytes()).as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ring::signature::{UnparsedPublicKey, ED25519};

    fn scope() -> JournalScope {
        JournalScope {
            vault_id: "vault_one".into(), room_id: "room_one".into(),
            document_id: "doc_one".into(), epoch: 3, peer_id: "alice".into(),
            note_path: "notes/demo.md".into(),
        }
    }

    #[test]
    fn scope_account_never_includes_raw_vault_or_room_identity() {
        let scoped = scope();
        let account = account_for_scope(&scoped);
        assert!(account.starts_with("collaboration.ed25519."));
        assert!(!account.contains("vault_one"));
        assert_ne!(account, account_for_scope(&JournalScope {
            peer_id: "bob".into(), ..scoped.clone()
        }));
    }

    #[test]
    fn key_pem_contains_a_valid_ed25519_spki_public_key() {
        let pkcs8 = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new()).unwrap();
        let pair = Ed25519KeyPair::from_pkcs8(pkcs8.as_ref()).unwrap();
        let pem = encode_public_key_pem(pair.public_key().as_ref()).unwrap();
        let der = STANDARD.decode(pem.lines()
            .filter(|line| !line.starts_with("-----")).collect::<String>()).unwrap();
        assert!(der.starts_with(&SPKI_ED25519_PREFIX));
        assert_eq!(&der[SPKI_ED25519_PREFIX.len()..], pair.public_key().as_ref());
        let signature = pair.sign(b"sample challenge");
        UnparsedPublicKey::new(&ED25519, pair.public_key().as_ref())
            .verify(b"sample challenge", signature.as_ref()).unwrap();
    }

    #[test]
    fn proof_rejects_other_peer_expired_or_extended_challenges() {
        let scope = scope();
        let nonce = "A".repeat(43);
        let challenge_id = "B".repeat(32);
        let good = format!("scriptor.live.auth.v1\nroom_one\ndoc_one\n3\nalice\n{challenge_id}\n{nonce}\n101000");
        assert!(validate_relay_challenge(&scope, &good, 100_000).is_ok());
        assert!(validate_relay_challenge(&scope, &good.replace("alice", "bob"), 100_000).is_err());
        assert!(validate_relay_challenge(&scope, &good.replace("101000", "100000"), 100_000).is_err());
        assert!(validate_relay_challenge(&scope, &good.replace("101000", "500000"), 100_000).is_err());
    }
}
