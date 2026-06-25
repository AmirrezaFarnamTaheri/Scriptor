//! OS integration boundaries: platform metadata and safe path helpers.

pub mod error;
pub mod keychain;
pub mod manifest;
pub mod paths;
pub mod platform;

pub use error::BridgeError;
pub use keychain::{keychain_delete, keychain_get, keychain_set};
pub use manifest::{hash_bytes, hash_file, read_manifest, verify_manifest, ReleaseManifest, ReleaseManifestEntry};
pub use paths::{scriptor_data_dir, vault_scriptor_meta_dir};
pub use platform::{detect_system_info, SystemInfo};
