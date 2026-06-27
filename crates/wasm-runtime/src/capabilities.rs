use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCapabilities {
    pub read_notes: bool,
    pub write_notes: bool,
    pub search: bool,
    pub canvas: bool,
    pub export: bool,
    pub network: bool,
    pub subprocess: bool,
}

impl Default for PluginCapabilities {
    fn default() -> Self {
        Self {
            read_notes: false,
            write_notes: false,
            search: false,
            canvas: false,
            export: false,
            network: false,
            subprocess: false,
        }
    }
}

impl PluginCapabilities {
    pub fn read_only() -> Self {
        Self {
            read_notes: true,
            search: true,
            ..Default::default()
        }
    }

    pub fn full_access() -> Self {
        Self {
            read_notes: true,
            write_notes: true,
            search: true,
            canvas: true,
            export: true,
            network: false,
            subprocess: false,
        }
    }

    pub fn check(&self, capability: &str) -> Result<(), crate::error::WasmRuntimeError> {
        let allowed = match capability {
            "read_notes" => self.read_notes,
            "write_notes" => self.write_notes,
            "search" => self.search,
            "canvas" => self.canvas,
            "export" => self.export,
            "network" => self.network,
            "subprocess" => self.subprocess,
            "log" => true,
            "now" => true,
            _ => false,
        };

        if allowed {
            Ok(())
        } else {
            Err(crate::error::WasmRuntimeError::CapabilityDenied(
                capability.to_string(),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_denies_all() {
        let caps = PluginCapabilities::default();
        assert!(caps.check("read_notes").is_err());
        assert!(caps.check("write_notes").is_err());
        assert!(caps.check("search").is_err());
    }

    #[test]
    fn read_only_allows_read_and_search() {
        let caps = PluginCapabilities::read_only();
        assert!(caps.check("read_notes").is_ok());
        assert!(caps.check("search").is_ok());
        assert!(caps.check("write_notes").is_err());
    }

    #[test]
    fn log_and_now_always_allowed() {
        let caps = PluginCapabilities::default();
        assert!(caps.check("log").is_ok());
        assert!(caps.check("now").is_ok());
    }
}
