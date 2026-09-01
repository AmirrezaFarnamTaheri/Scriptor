// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// mimalloc: reduces Windows CRT heap lock contention during concurrent
// SQLite queries, regex link parsing, and background indexing.
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

fn main() {
    scriptor_desktop_lib::run();
}
