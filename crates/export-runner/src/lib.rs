//! Export runner: Pandoc discovery, explicit args, and isolated export jobs.

pub mod args;
pub mod cancel;
pub mod diagram_preprocess;
pub mod error;
pub mod job;
pub mod log;
pub mod pandoc;
pub mod theme;
pub mod validate;

pub use cancel::{cancel_active_export, new_cancel_slot, ExportCancelSlot};

pub use args::ExportFormat;
pub use error::ExportError;
pub use job::{
    default_export_directory, run_export_job, run_export_job_with_cancel, ExportJobInput, ExportJobOutput,
    ExportProgressCallback,
};
pub use log::{
    count_slow_exports, export_logs_dir, log_entry_from_output, read_export_logs, write_export_log,
    ExportJobLogEntry, SLOW_EXPORT_THRESHOLD_MS,
};
pub use validate::{validate_export_artifact, ArtifactValidation};
pub use pandoc::{discover_pandoc, PandocDiscovery};
