//! OS integration boundaries: observability, process execution, platform metadata,
//! release manifests, keychain access, and safe application paths.

pub mod error;
pub mod keychain;
pub mod manifest;
pub mod observability;
pub mod paths;
pub mod platform;
pub mod process;

pub use error::BridgeError;
pub use keychain::{keychain_delete, keychain_get, keychain_set};
pub use manifest::{
    ReleaseManifest, ReleaseManifestEntry, hash_bytes, hash_file, read_manifest, verify_manifest,
};
pub use paths::{scriptor_data_dir, vault_scriptor_meta_dir};
pub use platform::{SystemInfo, detect_system_info};
pub use process::{NetworkPolicy, ProcessReceipt, ProcessSpec, run_process};
