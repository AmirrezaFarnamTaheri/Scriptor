use sha2::{Digest, Sha256};

pub fn content_hash(content: &str) -> String {
    content_hash_bytes(content.as_bytes())
}

/// Returns the SHA-256 hash of the exact source bytes.
///
/// Use this for file-level change detection. Text callers should use
/// [`content_hash`] so their intent remains explicit.
pub fn content_hash_bytes(content: &[u8]) -> String {
    let digest = Sha256::digest(content);
    hex::encode(digest)
}

pub fn path_hash(relative_path: &str) -> String {
    let digest = Sha256::digest(relative_path.as_bytes());
    hex::encode(digest)
}

pub fn word_count(content: &str) -> u32 {
    content.split_whitespace().count() as u32
}

/// Approximate reading time at 200 words per minute (minimum 1 minute when non-empty).
pub fn reading_time_minutes(content: &str) -> u32 {
    let words = word_count(content);
    if words == 0 {
        return 0;
    }
    (words / 200).max(1)
}

#[cfg(test)]
mod tests {
    use super::{content_hash, content_hash_bytes};

    #[test]
    fn byte_hash_distinguishes_lossy_utf8_collisions() {
        let first = [b'#', b' ', 0xff];
        let second = [b'#', b' ', 0xfe];

        assert_ne!(content_hash_bytes(&first), content_hash_bytes(&second));
        assert_eq!(content_hash("# note"), content_hash_bytes(b"# note"));
    }
}
