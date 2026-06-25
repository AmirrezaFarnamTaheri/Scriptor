use sha2::{Digest, Sha256};

pub fn content_hash(content: &str) -> String {
    let digest = Sha256::digest(content.as_bytes());
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
