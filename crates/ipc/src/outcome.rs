//! Canonical boundary outcome algebra shared by IPC-facing Rust code.
//!
//! Only `AbsentOptional` represents a missing value that may safely map to an
//! explicit default. `Invalid` and `Failed` remain typed failures; `Degraded`
//! and `Recovered` preserve the warning/recovery evidence instead of silently
//! returning an apparently clean value.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "kebab-case")]
pub enum BoundaryOutcome<T, W, R> {
    Value { value: T },
    AbsentOptional { value: T },
    Invalid { code: String, message: String },
    Degraded { value: T, warnings: Vec<W> },
    Failed {
        code: String,
        message: String,
        recoverable: bool,
    },
    Recovered { value: T, receipt: R },
}
