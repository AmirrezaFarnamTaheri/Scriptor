use std::path::{Component, Path};
use std::time::Duration;

use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebouncedEvent, Debouncer, new_debouncer};
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::path::VaultRoot;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VaultWatchEvent {
    pub path: String,
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VaultWatchBatch {
    Events(Vec<VaultWatchEvent>),
    RescanRequired { reason: String },
}

pub struct VaultWatcher {
    _debouncer: Debouncer<RecommendedWatcher>,
}

impl VaultWatcher {
    pub fn start(
        root: &VaultRoot,
        debounce_ms: u64,
        mut on_batch: impl FnMut(VaultWatchBatch) + Send + 'static,
    ) -> Result<Self, VaultError> {
        let root_path = root.root().to_path_buf();
        let mut debouncer = new_debouncer(
            Duration::from_millis(debounce_ms),
            move |result: Result<Vec<DebouncedEvent>, notify_debouncer_mini::notify::Error>| {
                let events = match result {
                    Ok(events) => events,
                    Err(error) => {
                        on_batch(VaultWatchBatch::RescanRequired {
                            reason: error.to_string(),
                        });
                        return;
                    }
                };

                let batch: Vec<_> = events
                    .into_iter()
                    .filter_map(|DebouncedEvent { path, .. }| {
                        parse_watch_path(&root_path, path.as_path())
                    })
                    .collect();

                if !batch.is_empty() {
                    on_batch(VaultWatchBatch::Events(batch));
                }
            },
        )
        .map_err(|error| VaultError::InvalidConfig {
            message: error.to_string(),
        })?;

        debouncer
            .watcher()
            .watch(root.root(), RecursiveMode::Recursive)
            .map_err(|error| VaultError::InvalidConfig {
                message: error.to_string(),
            })?;

        Ok(Self {
            _debouncer: debouncer,
        })
    }
}

fn parse_watch_path(root: &Path, absolute: &Path) -> Option<VaultWatchEvent> {
    if let Some(file_name) = absolute.file_name().and_then(|name| name.to_str())
        && file_name.starts_with(".scriptor-")
        && file_name.ends_with(".tmp")
    {
        return None;
    }

    let relative = vault_relative_path(root, absolute)?;
    if !relative.ends_with(".md") || relative.starts_with(".scriptor/") {
        return None;
    }

    Some(VaultWatchEvent {
        path: relative,
        kind: "changed".into(),
    })
}

fn vault_relative_path(root: &Path, absolute: &Path) -> Option<String> {
    let relative = absolute.strip_prefix(root).ok()?;
    let mut parts = Vec::new();
    for component in relative.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_string_lossy().into_owned()),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    if parts.is_empty() {
        return None;
    }
    Some(parts.join("/"))
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    #[test]
    fn parses_note_paths_under_root() {
        let root = PathBuf::from("/vault");
        let note = PathBuf::from("/vault/notes/hello.md");
        assert_eq!(
            parse_watch_path(&root, &note),
            Some(VaultWatchEvent {
                path: "notes/hello.md".into(),
                kind: "changed".into(),
            })
        );
    }

    #[test]
    fn ignores_internal_scriptor_notes_and_temp_writes() {
        let root = PathBuf::from("/vault");
        assert!(parse_watch_path(&root, &root.join(".scriptor/cache.sqlite")).is_none());
        assert!(parse_watch_path(&root, &root.join("notes/.scriptor-abc.tmp")).is_none());
        assert!(parse_watch_path(&root, &root.join("assets/logo.png")).is_none());
    }
}
