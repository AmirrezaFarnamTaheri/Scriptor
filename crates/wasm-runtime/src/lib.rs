pub mod capabilities;
pub mod error;

pub use capabilities::PluginCapabilities;
pub use error::WasmRuntimeError;

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
        Err(WasmRuntimeError::Runtime(
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
        Err(WasmRuntimeError::Runtime(
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
        Err(WasmRuntimeError::Runtime(
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

    pub fn plugin_count(&self) -> usize {
        self.plugins.len()
    }

    pub fn get_plugin(&self, idx: usize) -> Result<&PluginInstance, WasmRuntimeError> {
        self.plugins
            .get(idx)
            .ok_or_else(|| WasmRuntimeError::Load(format!("plugin index {idx} not found")))
    }

    fn validate_wasm_header(bytes: &[u8]) -> Result<(), WasmRuntimeError> {
        if bytes.len() < 4 {
            return Err(WasmRuntimeError::Load("too small to be valid WASM".into()));
        }
        // WASM magic number: \0asm
        if bytes[0..4] != [0x00, 0x61, 0x73, 0x6D] {
            return Err(WasmRuntimeError::Load("invalid WASM magic number".into()));
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
        // All capability checks pass; stub returns Runtime error (not CapabilityDenied)
        let read_err = runtime.host_read_note(idx, "a.md").unwrap_err();
        assert!(matches!(read_err, WasmRuntimeError::Runtime(_)));
        let write_err = runtime.host_write_note(idx, "a.md", "x").unwrap_err();
        assert!(matches!(write_err, WasmRuntimeError::Runtime(_)));
        let search_err = runtime.host_search(idx, "q", 5).unwrap_err();
        assert!(matches!(search_err, WasmRuntimeError::Runtime(_)));
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
        // 1MB of WASM (valid header + padding) — should succeed since runtime
        // doesn't impose a size limit beyond header validation
        let mut bytes = vec![0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00];
        bytes.resize(1_000_000, 0x00);
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
