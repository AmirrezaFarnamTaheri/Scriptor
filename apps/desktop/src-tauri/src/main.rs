// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// mimalloc: reduces Windows CRT heap lock contention during concurrent
// SQLite queries, regex link parsing, and background indexing.
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

fn main() {
    const PDF_WORKER: &str = "--scriptor-offline-pdf-worker";
    let mut args = std::env::args_os();
    let _ = args.next();
    if args.next().as_deref() == Some(std::ffi::OsStr::new(PDF_WORKER)) {
        let params: Vec<_> = args.collect();
        let result = if let [input, pdf, receipt] = params.as_slice() {
            scriptor_export_runner::inprocess_pdf::worker::run(
                std::path::Path::new(input),
                std::path::Path::new(pdf),
                std::path::Path::new(receipt),
            )
        } else {
            Err("Offline PDF worker requires exactly three private file paths".into())
        };
        match result {
            Ok(()) => std::process::exit(0),
            Err(error) => {
                eprintln!("Offline PDF worker refused export: {error}");
                std::process::exit(1);
            }
        }
    }
    scriptor_desktop_lib::run();
}
