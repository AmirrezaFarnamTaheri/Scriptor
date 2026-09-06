pub mod capabilities;
pub mod error;
#[cfg(feature = "wasmtime-backend")]
pub mod executor;

pub use capabilities::PluginCapabilities;
#[cfg(feature = "wasmtime-backend")]
use wasmtime::{Config, Engine, Store};

pub use error::WasmRuntimeError;

const MAX_PLUGIN_BYTES: usize = 16 * 1024 * 1024;
#[cfg(feature = "wasmtime-backend")]
const MAX_PLUGIN_FUEL: u64 = 10_000_000;
#[cfg(feature = "wasmtime-backend")]
const MAX_PLUGIN_WALL_TIME: std::time::Duration = std::time::Duration::from_secs(5);

/// Represents a loaded WASM plugin instance with its granted capabilities.
pub struct PluginInstance {
    pub name: String,
    pub capabilities: PluginCapabilities,
    pub wasm_bytes: Vec<u8>,
}

/// Stub WASM plugin runtime.
///
/// When compiled with the `wasmtime-backend` feature, this delegates to wasmtime.
/// Otherwise it provides the interface without a real WASM executor, allowing
/// the crate to compile and be depended upon in CI without requiring wasmtime.
pub struct WasmPluginRuntime {
    plugins: Vec<PluginInstance>,
}

impl WasmPluginRuntime {
    pub fn new() -> Self {
        Self {
            plugins: Vec::new(),
        }
    }

    /// Load a WASM plugin from raw bytes with the given capabilities.
    pub fn load_plugin(
        &mut self,
        name: &str,
        wasm_bytes: &[u8],
        capabilities: PluginCapabilities,
    ) -> Result<usize, WasmRuntimeError> {
        Self::validate_wasm_header(wasm_bytes)?;
        if wasm_bytes.len() > MAX_PLUGIN_BYTES {
            return Err(WasmRuntimeError::Load(format!(
                "plugin is too large: {} bytes exceeds {MAX_PLUGIN_BYTES}",
                wasm_bytes.len()
            )));
        }
        #[cfg(feature = "wasmtime-backend")]
        {
            let engine = Self::sandbox_engine()?;
            crate::executor::compile(&engine, wasm_bytes)?;
        }
        let instance = PluginInstance {
            name: name.to_string(),
            capabilities,
            wasm_bytes: wasm_bytes.to_vec(),
        };
        let idx = self.plugins.len();
        self.plugins.push(instance);
        Ok(idx)
    }

    /// Invoke `host_read_note` on a loaded plugin instance.
    pub fn host_read_note(
        &self,
        plugin_idx: usize,
        _path: &str,
    ) -> Result<String, WasmRuntimeError> {
        let plugin = self.get_plugin(plugin_idx)?;
        plugin.capabilities.check("read_notes")?;
        // Stub: in a real runtime, this calls into the WASM guest
        Err(WasmRuntimeError::NotImplemented(
            "WASM runtime stub — compile with wasmtime-backend for execution".into(),
        ))
    }

    /// Invoke `host_write_note` on a loaded plugin instance.
    pub fn host_write_note(
        &self,
        plugin_idx: usize,
        _path: &str,
        _content: &str,
    ) -> Result<(), WasmRuntimeError> {
        let plugin = self.get_plugin(plugin_idx)?;
        plugin.capabilities.check("write_notes")?;
        Err(WasmRuntimeError::NotImplemented(
            "WASM runtime stub — compile with wasmtime-backend for execution".into(),
        ))
    }

    /// Invoke `host_search` on a loaded plugin instance.
    pub fn host_search(
        &self,
        plugin_idx: usize,
        _query: &str,
        _limit: usize,
    ) -> Result<String, WasmRuntimeError> {
        let plugin = self.get_plugin(plugin_idx)?;
        plugin.capabilities.check("search")?;
        Err(WasmRuntimeError::NotImplemented(
            "WASM runtime stub — compile with wasmtime-backend for execution".into(),
        ))
    }

    /// Invoke `host_log` on a loaded plugin instance (always allowed).
    pub fn host_log(
        &self,
        plugin_idx: usize,
        _level: &str,
        _message: &str,
    ) -> Result<(), WasmRuntimeError> {
        let _plugin = self.get_plugin(plugin_idx)?;
        // Log is always allowed; in a real runtime this writes to the daemon log
        Ok(())
    }

    /// Compile and run the plugin export `run() -> i32` on wasmtime.
    /// Capability-gated host calls are wired via
    /// [`executor::link_plugin_imports`]; a guest that violates its grants
    /// receives -1 from the host call, not a trap.
    #[cfg(feature = "wasmtime-backend")]
    pub fn invoke_entry(
        &self,
        plugin_idx: usize,
        host_state: crate::executor::PluginHostState,
    ) -> Result<i32, WasmRuntimeError> {
        let plugin = self.get_plugin(plugin_idx)?;
        let engine = Self::sandbox_engine()?;
        let module = crate::executor::compile(&engine, &plugin.wasm_bytes)?;
        let mut host_state = host_state;
        // Load-time grants are authoritative. Callers may provide note/search
        // data, but may never widen a plugin's granted capabilities.
        host_state.capabilities = plugin.capabilities.clone();
        let mut store = Store::new(&engine, host_state);
        store.limiter(|state| &mut state.limits);
        store.set_fuel(MAX_PLUGIN_FUEL).map_err(|error| {
            WasmRuntimeError::Runtime(format!("failed to configure plugin fuel: {error}"))
        })?;
        store.set_epoch_deadline(1);

        // Host imports resolve the guest memory from the caller exports, so
        // the linker needs no memory up front; the guest must export one
        // named "memory" and it is verified after instantiation.
        let linker = crate::executor::link_plugin_imports(&engine, &mut store);
        let instance = linker.instantiate(&mut store, &module).map_err(|error| {
            WasmRuntimeError::Runtime(format!("plugin instantiate failed: {error}"))
        })?;
        if instance.get_memory(&mut store, "memory").is_none() {
            return Err(WasmRuntimeError::Load(
                "plugin does not export a 'memory' linear memory".to_string(),
            ));
        }

        let run = instance
            .get_typed_func::<(), i32>(&mut store, "run")
            .map_err(|error| {
                WasmRuntimeError::Runtime(format!("plugin does not export 'run() -> i32': {error}"))
            })?;

        let (cancel_deadline, deadline_cancelled) = std::sync::mpsc::channel();
        let deadline_engine = engine.clone();
        let deadline = std::thread::spawn(move || {
            if deadline_cancelled
                .recv_timeout(MAX_PLUGIN_WALL_TIME)
                .is_err()
            {
                deadline_engine.increment_epoch();
            }
        });
        let result = run
            .call(&mut store, ())
            .map_err(|error| WasmRuntimeError::Runtime(format!("plugin run trapped: {error}")));
        let _ = cancel_deadline.send(());
        let _ = deadline.join();
        result
    }

    #[cfg(feature = "wasmtime-backend")]
    fn sandbox_engine() -> Result<Engine, WasmRuntimeError> {
        let mut config = Config::new();
        config.consume_fuel(true);
        config.epoch_interruption(true);
        Engine::new(&config).map_err(|error| {
            WasmRuntimeError::Runtime(format!("failed to build sandbox engine: {error}"))
        })
    }

    pub fn plugin_count(&self) -> usize {
        self.plugins.len()
    }

    pub fn get_plugin(&self, idx: usize) -> Result<&PluginInstance, WasmRuntimeError> {
        self.plugins
            .get(idx)
            .ok_or_else(|| WasmRuntimeError::Load(format!("plugin index {idx} not found")))
    }

    fn validate_wasm_header(bytes: &[u8]) -> Result<(), WasmRuntimeError> {
        if bytes.len() < 8 {
            return Err(WasmRuntimeError::Load(
                "too small to contain a WASM header and version".into(),
            ));
        }
        // Core WebAssembly binary preamble: magic + version 1.
        if bytes[0..4] != [0x00, 0x61, 0x73, 0x6D] {
            return Err(WasmRuntimeError::Load("invalid WASM magic number".into()));
        }
        if bytes[4..8] != [0x01, 0x00, 0x00, 0x00] {
            return Err(WasmRuntimeError::Load(
                "unsupported WASM binary version".into(),
            ));
        }
        Ok(())
    }
}

impl Default for WasmPluginRuntime {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal_wasm() -> Vec<u8> {
        // Minimal valid WASM module header (magic + version 1)
        vec![0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00]
    }

    #[test]
    fn load_plugin_succeeds() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::read_only();
        let idx = runtime
            .load_plugin("test-plugin", &minimal_wasm(), caps)
            .unwrap();
        assert_eq!(idx, 0);
        assert_eq!(runtime.plugin_count(), 1);
    }

    #[test]
    fn invalid_wasm_rejected() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        let err = runtime.load_plugin("bad", &[0x00, 0x01, 0x02], caps);
        assert!(matches!(err, Err(WasmRuntimeError::Load(_))));
    }

    #[test]
    fn capability_denied_for_ungranted_host_fn() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        let idx = runtime
            .load_plugin("restricted", &minimal_wasm(), caps)
            .unwrap();
        let err = runtime.host_read_note(idx, "notes/test.md");
        assert!(matches!(err, Err(WasmRuntimeError::CapabilityDenied(_))));
    }

    #[test]
    fn write_notes_requires_write_capability() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::read_only();
        let idx = runtime
            .load_plugin("reader", &minimal_wasm(), caps)
            .unwrap();
        let err = runtime.host_write_note(idx, "a.md", "content");
        assert!(matches!(err, Err(WasmRuntimeError::CapabilityDenied(_))));
    }

    #[test]
    fn search_requires_search_capability() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        let idx = runtime
            .load_plugin("nosrch", &minimal_wasm(), caps)
            .unwrap();
        let err = runtime.host_search(idx, "query", 10);
        assert!(matches!(err, Err(WasmRuntimeError::CapabilityDenied(_))));
    }

    #[test]
    fn full_access_allows_all_host_fns() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::full_access();
        let idx = runtime.load_plugin("full", &minimal_wasm(), caps).unwrap();
        // All capability checks pass; stub returns NotImplemented error (not CapabilityDenied)
        let read_err = runtime.host_read_note(idx, "a.md").unwrap_err();
        assert!(matches!(read_err, WasmRuntimeError::NotImplemented(_)));
        let write_err = runtime.host_write_note(idx, "a.md", "x").unwrap_err();
        assert!(matches!(write_err, WasmRuntimeError::NotImplemented(_)));
        let search_err = runtime.host_search(idx, "q", 5).unwrap_err();
        assert!(matches!(search_err, WasmRuntimeError::NotImplemented(_)));
    }

    #[test]
    fn too_small_bytes_rejected() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        let err = runtime.load_plugin("tiny", &[0x00, 0x61], caps);
        assert!(matches!(err, Err(WasmRuntimeError::Load(_))));
    }

    #[test]
    fn host_log_always_succeeds() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        let idx = runtime
            .load_plugin("logger", &minimal_wasm(), caps)
            .unwrap();
        runtime.host_log(idx, "info", "hello").unwrap();
    }

    #[test]
    fn get_plugin_out_of_bounds() {
        let runtime = WasmPluginRuntime::new();
        let err = runtime.get_plugin(99);
        assert!(matches!(err, Err(WasmRuntimeError::Load(_))));
    }

    #[test]
    fn load_multiple_plugins() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        runtime
            .load_plugin("a", &minimal_wasm(), caps.clone())
            .unwrap();
        runtime.load_plugin("b", &minimal_wasm(), caps).unwrap();
        assert_eq!(runtime.plugin_count(), 2);
    }

    #[test]
    fn oversized_wasm_bytes_loads() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        // A large, valid custom section must also compile with wasmtime enabled.
        // Zero padding alone is not a valid sequence of WASM sections.
        let mut bytes = vec![0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00];
        bytes.push(0); // custom section
        let mut length = 1_000_001u32; // empty name length plus data
        loop {
            let byte = (length & 0x7f) as u8;
            length >>= 7;
            bytes.push(byte | if length == 0 { 0 } else { 0x80 });
            if length == 0 {
                break;
            }
        }
        bytes.resize(bytes.len() + 1_000_001, 0);
        let idx = runtime.load_plugin("large", &bytes, caps).unwrap();
        assert_eq!(idx, 0);
        assert_eq!(runtime.plugin_count(), 1);
    }

    #[test]
    fn empty_bytes_rejected() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        let err = runtime.load_plugin("empty", &[], caps);
        assert!(matches!(err, Err(WasmRuntimeError::Load(_))));
    }

    #[test]
    fn exact_4_byte_wrong_magic_rejected() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::default();
        let err = runtime.load_plugin("bad4", &[0xDE, 0xAD, 0xBE, 0xEF], caps);
        assert!(matches!(err, Err(WasmRuntimeError::Load(_))));
    }

    #[test]
    fn canvas_capability_enforced() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::read_only();
        let idx = runtime
            .load_plugin("no-canvas", &minimal_wasm(), caps)
            .unwrap();
        let err = runtime
            .get_plugin(idx)
            .unwrap()
            .capabilities
            .check("canvas");
        assert!(matches!(err, Err(WasmRuntimeError::CapabilityDenied(_))));
    }

    #[test]
    fn export_capability_enforced() {
        let mut runtime = WasmPluginRuntime::new();
        let caps = PluginCapabilities::read_only();
        let idx = runtime
            .load_plugin("no-export", &minimal_wasm(), caps)
            .unwrap();
        let err = runtime
            .get_plugin(idx)
            .unwrap()
            .capabilities
            .check("export");
        assert!(matches!(err, Err(WasmRuntimeError::CapabilityDenied(_))));
    }
}

#[cfg(all(test, feature = "wasmtime-backend"))]
mod executor_tests {
    use super::*;
    use crate::executor::PluginHostState;

    /// A plugin that exports memory + run() -> i32 and logs a line.
    const RUN_PLUGIN: &str = r#"
        (module
            (import "scriptor" "host_log" (func $log (param i32 i32 i32) (result i32)))
            (memory (export "memory") 1)
            (data (i32.const 0) "plugin started")
            (func (export "run") (result i32)
                (drop (call $log (i32.const 2) (i32.const 0) (i32.const 14)))
                (i32.const 0)
            )
        )
    "#;

    #[test]
    fn invoke_entry_runs_plugin_and_collects_logs() {
        let mut runtime = WasmPluginRuntime::new();
        let wasm = wat::parse_str(RUN_PLUGIN).unwrap();
        let idx = runtime
            .load_plugin("logger", &wasm, PluginCapabilities::default())
            .unwrap();

        let host_state =
            PluginHostState::new(PluginCapabilities::default(), String::new(), String::new());
        let exit = runtime.invoke_entry(idx, host_state).unwrap();
        assert_eq!(exit, 0);
    }

    #[test]
    fn invoke_entry_rejects_plugin_without_memory() {
        let mut runtime = WasmPluginRuntime::new();
        // No memory export, no run export.
        const NO_MEMORY: &str = r#"
            (module
                (func (export "run") (result i32) (i32.const 0))
            )
        "#;
        let wasm = wat::parse_str(NO_MEMORY).unwrap();
        let idx = runtime
            .load_plugin("no-memory", &wasm, PluginCapabilities::default())
            .unwrap();
        let host_state =
            PluginHostState::new(PluginCapabilities::default(), String::new(), String::new());
        let error = runtime.invoke_entry(idx, host_state).unwrap_err();
        assert!(error.to_string().contains("memory"), "got: {error}");
    }

    #[test]
    fn host_read_note_requires_capability() {
        let mut runtime = WasmPluginRuntime::new();
        // A guest whose run() calls host_read_note; capability denied -> -1,
        // and the guest propagates it as its own exit code.
        const READER: &str = r#"
            (module
                (import "scriptor" "host_read_note" (func $read (result i32)))
                (memory (export "memory") 1)
                (func (export "run") (result i32) (call $read))
            )
        "#;
        let wasm = wat::parse_str(READER).unwrap();
        let idx = runtime
            .load_plugin("reader", &wasm, PluginCapabilities::default())
            .unwrap();
        let host_state = PluginHostState::new(
            PluginCapabilities::default(),
            "secret body".to_string(),
            String::new(),
        );
        // run() returns the host -1 as its own exit code.
        let exit = runtime.invoke_entry(idx, host_state).unwrap();
        assert_eq!(exit, -1, "denied capability must surface as -1");
    }
}
