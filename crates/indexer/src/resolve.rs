//! Compatibility re-export of the vault-owned wikilink resolver.
//!
//! Resolution semantics are shared by indexing, linting, rename flows, and
//! graph/backlink materialization so ambiguity cannot be interpreted
//! differently by neighboring subsystems.

pub use scriptor_vault::{
    WikilinkIndex, WikilinkResolution, WikilinkResolutionKind, resolve_wikilink_target,
    resolve_wikilink_target_with_aliases,
};
