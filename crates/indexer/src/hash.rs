//! Content hashing utilities — delegates to the canonical implementation in
//! `scriptor-vault` so there is exactly one SHA-256 function for note content
//! across the whole workspace.

pub use scriptor_vault::{content_hash, reading_time_minutes, word_count};

/// Returns `true` when `current` content differs from `previous_hash`.
///
/// `None` previous hash is treated as "always changed" so a first-time index
/// always writes the note.
pub fn content_changed(previous: Option<&str>, current: &str) -> bool {
    match previous {
        Some(previous_hash) => previous_hash != content_hash(current),
        None => true,
    }
}
