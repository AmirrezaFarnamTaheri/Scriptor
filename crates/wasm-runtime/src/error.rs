use thiserror::Error;

#[derive(Debug, Error)]
pub enum WasmRuntimeError {
    #[error("plugin load error: {0}")]
    Load(String),
    #[error("runtime error: {0}")]
    Runtime(String),
    #[error("capability denied: {0}")]
    CapabilityDenied(String),
    #[error("not implemented: {0}")]
    NotImplemented(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}
