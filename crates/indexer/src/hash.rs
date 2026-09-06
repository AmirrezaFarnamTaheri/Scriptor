//! Content hashing utilities — delegates to the canonical implementation in
//! `scriptor-vault` so there is exactly one SHA-256 function for note content
//! across the whole workspace.

pub use scriptor_vault::{content_hash, reading_time_minutes, word_count};
