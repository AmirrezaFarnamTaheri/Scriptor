//! Wasmtime executor: capability-gated host imports for loaded plugins.
//!
//! Security model: a plugin can only reach host calls granted at load
//! time. Every host call re-checks the capability and returns -1 to the
//! guest when denied - denial is an error, not a panic. Network and
//! subprocess capabilities exist in the struct but are deliberately NOT
//! wired to any host import: a plugin cannot reach the network or spawn
//! processes in this runtime (residual risk in the capability ledger).

use wasmtime::{Engine, Store, StoreLimits, StoreLimitsBuilder};

use crate::capabilities::PluginCapabilities;
use crate::error::WasmRuntimeError;

/// Host state shared with guest imports for one plugin instance.
const MAX_HOST_CALL_BYTES: usize = 1024 * 1024;
const MAX_HOST_RETURN_BYTES: usize = 4 * 1024 * 1024;
const MAX_LOG_LINE_BYTES: usize = 64 * 1024;
const MAX_LOG_LINES: usize = 1024;

pub struct PluginHostState {
    pub capabilities: PluginCapabilities,
    /// Note content the guest may read; the host pre-loads it so the
    /// guest can never traverse arbitrary paths.
    pub note_body: String,
    pub search_results_json: String,
    /// Written by the last successful host_write_note; the host persists
    /// it after the guest returns (the guest never touches disk).
    pub pending_write: Option<(String, String)>,
    pub log_lines: Vec<(String, String)>,
    pub(crate) limits: StoreLimits,
}

impl PluginHostState {
    pub fn new(
        capabilities: PluginCapabilities,
        note_body: String,
        search_results_json: String,
    ) -> Self {
        Self {
            capabilities,
            note_body,
            search_results_json,
            pending_write: None,
            log_lines: Vec::new(),
            limits: StoreLimitsBuilder::new()
                .memory_size(64 * 1024 * 1024)
                .instances(1)
                .memories(1)
                .tables(4)
                .table_elements(65_536)
                .trap_on_grow_failure(true)
                .build(),
        }
    }
}

/// Compile the plugin module for the shared engine.
pub fn compile(engine: &Engine, wasm_bytes: &[u8]) -> Result<wasmtime::Module, WasmRuntimeError> {
    wasmtime::Module::from_binary(engine, wasm_bytes)
        .map_err(|error| WasmRuntimeError::Load(format!("wasm compile failed: {error}")))
}

/// Build the capability-gated import set. Host fns resolve the guest memory
/// from the caller exports, so no memory needs to be defined up front.
/// Denied capabilities return -1 instead of trapping, so a misbehaving guest
/// degrades gracefully.
pub fn link_plugin_imports(
    engine: &Engine,
    _store: &mut Store<PluginHostState>,
) -> wasmtime::Linker<PluginHostState> {
    let mut linker: wasmtime::Linker<PluginHostState> = wasmtime::Linker::new(engine);

    linker
        .func_wrap(
            "scriptor",
            "host_read_note",
            move |mut caller: wasmtime::Caller<PluginHostState>| -> i32 {
                // Copy out of host state before taking the mutable caller borrow.
                let bytes = {
                    let state = caller.data();
                    if state.capabilities.check("read_notes").is_err()
                        || state.note_body.len() > MAX_HOST_RETURN_BYTES
                    {
                        return -1;
                    }
                    state.note_body.as_bytes().to_vec()
                };
                let memory = match caller
                    .get_export("memory")
                    .and_then(|export| export.into_memory())
                {
                    Some(memory) => memory,
                    None => return -1,
                };
                if bytes.len() > memory.data_size(&caller) {
                    return -1;
                }
                let _ = memory.write(&mut caller, 0, &bytes);
                bytes.len() as i32
            },
        )
        .unwrap();

    linker
        .func_wrap(
            "scriptor",
            "host_write_note",
            move |mut caller: wasmtime::Caller<PluginHostState>, ptr: i32, len: i32| -> i32 {
                // Validate the capability and read guest memory before mutating
                // host state; the two borrows must not overlap.
                let content = {
                    let state = caller.data();
                    if state.capabilities.check("write_notes").is_err()
                        || ptr < 0
                        || len <= 0
                        || len as usize > MAX_HOST_CALL_BYTES
                    {
                        return -1;
                    }
                    let memory = match caller
                        .get_export("memory")
                        .and_then(|export| export.into_memory())
                    {
                        Some(memory) => memory,
                        None => return -1,
                    };
                    let mut buffer = vec![0u8; len as usize];
                    if memory.read(&caller, ptr as usize, &mut buffer).is_err() {
                        return -1;
                    }
                    match String::from_utf8(buffer) {
                        Ok(content) => content,
                        Err(_) => return -1,
                    }
                };
                caller.data_mut().pending_write = Some(("plugin-write.md".to_string(), content));
                0
            },
        )
        .unwrap();

    linker
        .func_wrap(
            "scriptor",
            "host_search",
            move |mut caller: wasmtime::Caller<PluginHostState>| -> i32 {
                let bytes = {
                    let state = caller.data();
                    if state.capabilities.check("search").is_err()
                        || state.search_results_json.len() > MAX_HOST_RETURN_BYTES
                    {
                        return -1;
                    }
                    state.search_results_json.as_bytes().to_vec()
                };
                let memory = match caller
                    .get_export("memory")
                    .and_then(|export| export.into_memory())
                {
                    Some(memory) => memory,
                    None => return -1,
                };
                if bytes.len() > memory.data_size(&caller) {
                    return -1;
                }
                let _ = memory.write(&mut caller, 0, &bytes);
                bytes.len() as i32
            },
        )
        .unwrap();

    linker
        .func_wrap(
            "scriptor",
            "host_log",
            move |mut caller: wasmtime::Caller<PluginHostState>,
                  level: i32,
                  ptr: i32,
                  len: i32|
                  -> i32 {
                // Read the guest log line first, then push into host state.
                if ptr < 0
                    || len < 0
                    || len as usize > MAX_LOG_LINE_BYTES
                    || caller.data().log_lines.len() >= MAX_LOG_LINES
                {
                    return -1;
                }
                let line = {
                    let memory = match caller
                        .get_export("memory")
                        .and_then(|export| export.into_memory())
                    {
                        Some(memory) => memory,
                        None => return -1,
                    };
                    let mut buffer = vec![0u8; len as usize];
                    if memory
                        .read(&caller, ptr.max(0) as usize, &mut buffer)
                        .is_err()
                    {
                        return -1;
                    }
                    let level = match level {
                        0 => "error",
                        1 => "warn",
                        _ => "info",
                    };
                    (
                        level.to_string(),
                        String::from_utf8_lossy(&buffer).to_string(),
                    )
                };
                caller.data_mut().log_lines.push(line);
                0
            },
        )
        .unwrap();

    linker
}
