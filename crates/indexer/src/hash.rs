use sha2::{Digest, Sha256};

pub fn content_hash(content: &str) -> String {
    let digest = Sha256::digest(content.as_bytes());
    hex::encode(digest)
}

pub fn content_changed(previous: Option<&str>, current: &str) -> bool {
    match previous {
        Some(previous_hash) => previous_hash != content_hash(current),
        None => true,
    }
}
