//! The only out-of-process entrypoint for desktop offline PDF exports.
//! In-process typesetting is retained for unit tests, never invoked by the
//! desktop Tauri command. Hard memory limits are installed before reading input.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::{MAX_ASSET_BYTES, MAX_MARKDOWN_BYTES, MAX_PDF_BYTES, MAX_TOTAL_ASSET_BYTES, PdfAsset, compile_markdown_pdf};

pub const PDF_WORKER_MARKER: &str = "--scriptor-offline-pdf-worker";
const MAX_REQUEST_BYTES: u64 = 140 * 1024 * 1024;
#[cfg(any(target_os = "linux", windows))]
const HARD_MEMORY_BYTES: usize = 1536 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PdfWorkerRequest {
    pub markdown: String,
    pub title: Option<String>,
    pub assets: Vec<PdfAsset>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PdfWorkerReceipt {
    pub page_count: usize,
    pub warnings: Vec<String>,
    pub sha256: String,
}

#[cfg(target_os = "linux")]
fn install_memory_cap() -> Result<(), String> {
    let limit = libc::rlimit {
        rlim_cur: HARD_MEMORY_BYTES as libc::rlim_t,
        rlim_max: HARD_MEMORY_BYTES as libc::rlim_t,
    };
    // SAFETY: setrlimit is called in the dedicated single-threaded worker,
    // with a fully initialized POSIX rlimit; this cap cannot be raised later.
    let success = unsafe { libc::setrlimit(libc::RLIMIT_AS, &limit) };
    if success != 0 { return Err(format!("Could not set worker address-space hard cap: {}", std::io::Error::last_os_error())); }
    Ok(())
}

#[cfg(windows)]
fn install_memory_cap() -> Result<(), String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_PROCESS_MEMORY,
    };
    use windows_sys::Win32::System::Threading::GetCurrentProcess;
    // SAFETY: Windows Job Object FFI uses zero-initialized repr(C) structures,
    // checked handles, and the current process pseudo-handle.
    unsafe {
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() { return Err(format!("Could not create PDF memory-limited job: {}", std::io::Error::last_os_error())); }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_PROCESS_MEMORY;
        info.ProcessMemoryLimit = HARD_MEMORY_BYTES;
        let configured = SetInformationJobObject(
            job, JobObjectExtendedLimitInformation,
            &info as *const _ as *const std::ffi::c_void,
            std::mem::size_of_val(&info) as u32,
        );
        let assigned = if configured != 0 { AssignProcessToJobObject(job, GetCurrentProcess()) } else { 0 };
        if assigned == 0 {
            let error = std::io::Error::last_os_error();
            CloseHandle(job);
            return Err(format!("Could not enforce worker process memory limit: {error}"));
        }
        // This short-lived worker intentionally owns the Job Object handle for
        // its whole lifetime. Closing the handle here could drop containment.
        Ok(())
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
fn install_memory_cap() -> Result<(), String> {
    // macOS/iOS do not provide a portable, unprivileged, hard per-process
    // memory cap. Refuse a render rather than imply RSS polling is enforceable.
    Err("Hard process memory isolation is unavailable on this OS; PDF export is disabled".into())
}

pub fn run(input: &Path, output: &Path, receipt: &Path) -> Result<(), String> {
    install_memory_cap()?;
    let source = fs::File::open(input).map_err(|error| error.to_string())?;
    if !source.metadata().map_err(|error| error.to_string())?.is_file()
        || source.metadata().map_err(|error| error.to_string())?.len() > MAX_REQUEST_BYTES {
        return Err("PDF worker input is not a bounded regular file".into());
    }
    let bytes = fs::read(input).map_err(|error| error.to_string())?;
    if bytes.len() as u64 > MAX_REQUEST_BYTES { return Err("PDF worker input exceeded its bound".into()); }
    let request: PdfWorkerRequest = serde_json::from_slice(&bytes)
        .map_err(|_| "Invalid PDF worker request")?;
    if request.markdown.len() > MAX_MARKDOWN_BYTES
        || request.assets.len() > 32
        || request.assets.iter().any(|asset| asset.bytes.len() > MAX_ASSET_BYTES)
        || request.assets.iter().try_fold(0usize, |sum, asset| sum.checked_add(asset.bytes.len()))
            .is_none_or(|total| total > MAX_TOTAL_ASSET_BYTES) {
        return Err("PDF worker request exceeds resource budget".into());
    }
    let result = compile_markdown_pdf(&request.markdown, request.title.as_deref(), &request.assets)
        .map_err(|error| error.to_string())?;
    if result.bytes.len() > MAX_PDF_BYTES { return Err("PDF worker output exceeds its bound".into()); }
    let mut output_file = OpenOptions::new().write(true).create_new(true)
        .open(output).map_err(|error| error.to_string())?;
    output_file.write_all(&result.bytes).and_then(|()| output_file.sync_all())
        .map_err(|error| error.to_string())?;
    let proof = PdfWorkerReceipt {
        page_count: result.page_count,
        warnings: result.warnings,
        sha256: hex::encode(Sha256::digest(&result.bytes)),
    };
    let mut receipt_file = OpenOptions::new().write(true).create_new(true)
        .open(receipt).map_err(|error| error.to_string())?;
    receipt_file.write_all(&serde_json::to_vec(&proof).map_err(|error| error.to_string())?)
        .and_then(|()| receipt_file.sync_all()).map_err(|error| error.to_string())?;
    Ok(())
}
