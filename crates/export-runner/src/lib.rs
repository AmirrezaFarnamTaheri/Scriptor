//! Export runner: Pandoc discovery, explicit args, and isolated export jobs.

pub mod allowlist;
pub mod args;
pub mod cancel;
pub mod diagram;
pub mod diagram_preprocess;
pub mod error;
pub mod job;
pub mod log;
pub mod pandoc;
pub mod theme;
pub mod validate;

pub use cancel::{ExportCancelSlot, cancel_active_export, new_cancel_slot};

pub use args::ExportFormat;
pub use error::ExportError;
pub use job::{
    ExportJobInput, ExportJobOutput, ExportProgressCallback, default_export_directory,
    run_export_job, run_export_job_with_cancel,
};
pub use log::{
    ExportJobLogEntry, SLOW_EXPORT_THRESHOLD_MS, count_slow_exports, export_logs_dir,
    log_entry_from_output, read_export_logs, write_export_log,
};
pub use pandoc::{
    PandocDiscovery, discover_pandoc, discover_pandoc_with_trusted_hash, sha256_file,
    verify_binary_hash,
};
pub use validate::{ArtifactValidation, validate_export_artifact};
