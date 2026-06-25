use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub family: String,
    pub locale: Option<String>,
}

pub fn detect_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        family: std::env::consts::FAMILY.into(),
        locale: std::env::var("LANG")
            .ok()
            .or_else(|| std::env::var("LC_ALL").ok()),
    }
}
