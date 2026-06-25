use std::path::PathBuf;

use scriptor_export_runner::{default_export_directory, run_export_job, ExportJobInput};
use scriptor_indexer::{
    backlinks_for_path, health_diagnostics_json, health_report_json, incremental_note_index,
    incremental_notes_index, list_note_summaries, open_cache_for_session, query_focused_graph,
    rebuild_index, search_notes,
};
use scriptor_ipc::{
    NoteSummary, RpcMethod, RpcPayload, RpcRequest, RpcResponse, RpcResult, SearchHit,
};
use scriptor_native_git::git_status;
use scriptor_vault::{
    open_vault, read_note, rename_apply, save_note_with_options, RelativeVaultPath, SaveNoteOptions,
    VaultSession,
};

pub struct DaemonState {
    session: Option<VaultSession>,
    config_generation: u64,
}

impl Default for DaemonState {
    fn default() -> Self {
        Self {
            session: None,
            config_generation: 0,
        }
    }
}

impl DaemonState {
    pub fn handle(&mut self, request: RpcRequest) -> RpcResponse {
        let id = request.id;
        let result = match request.method {
            RpcMethod::Ping => Ok(RpcPayload::Pong {
                version: env!("CARGO_PKG_VERSION").to_string(),
            }),
            RpcMethod::ReloadConfig => {
                self.config_generation = self.config_generation.saturating_add(1);
                Ok(RpcPayload::Unit)
            }
            RpcMethod::OpenVault { path } => self.open_vault(path),
            RpcMethod::ListNotes => self.list_notes(),
            RpcMethod::SearchNotes { query, limit } => self.search_notes(query, limit),
            RpcMethod::ReadNote { path } => self.read_note(path),
            RpcMethod::RebuildIndex => self.rebuild_index(),
            RpcMethod::HealthReport => self.health_report(),
            RpcMethod::HealthDiagnostics => self.health_diagnostics(),
            RpcMethod::GitStatus => self.git_status(),
            RpcMethod::Backlinks { path } => self.backlinks(path),
            RpcMethod::GraphSummary { path, depth } => self.graph_summary(path, depth),
            RpcMethod::SaveNote {
                path,
                markdown,
                expected_content_hash,
                dry_run,
            } => self.save_note(path, markdown, expected_content_hash, dry_run),
            RpcMethod::UpdateNoteIndex { path } => self.update_note_index(path),
            RpcMethod::RenameNoteApply {
                from_path,
                to_path,
                update_links,
            } => self.rename_note_apply(from_path, to_path, update_links),
            RpcMethod::ExportRunNote {
                note_path,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            } => self.export_run_note(note_path, format, dry_run, extra_pandoc_args, output_subdirectory),
            RpcMethod::ExportRunMarkdown {
                note_path,
                source_markdown,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            } => self.export_run_markdown(
                note_path,
                source_markdown,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            ),
        };

        RpcResponse {
            id,
            result: match result {
                Ok(payload) => RpcResult::Ok(payload),
                Err(message) => RpcResult::Err(message),
            },
        }
    }

    fn require_session(&self) -> Result<&VaultSession, String> {
        self.session
            .as_ref()
            .ok_or_else(|| "no vault is open; call OpenVault first".to_string())
    }

    fn open_vault(&mut self, path: String) -> Result<RpcPayload, String> {
        let session = open_vault(PathBuf::from(path)).map_err(|error| error.to_string())?;
        rebuild_index(&session, &[]).map_err(|error| error.to_string())?;
        let payload = RpcPayload::VaultOpened {
            vault_id: session.descriptor.id.clone(),
            name: session.descriptor.name.clone(),
            root_path: session.descriptor.root_path.clone(),
        };
        self.session = Some(session);
        Ok(payload)
    }

    fn list_notes(&self) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = open_cache_for_session(session).map_err(|error| error.to_string())?;
        let notes = list_note_summaries(&cache, &session.descriptor.id)
            .map_err(|error| error.to_string())?
            .into_iter()
            .map(|entry| NoteSummary {
                path: entry.path,
                title: entry.title,
            })
            .collect();
        Ok(RpcPayload::NoteList { notes })
    }

    fn search_notes(&self, query: String, limit: u32) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = open_cache_for_session(session).map_err(|error| error.to_string())?;
        let hits = search_notes(&cache, &session.descriptor.id, query.trim(), limit)
            .map_err(|error| error.to_string())?
            .into_iter()
            .map(|entry| SearchHit {
                path: entry.path,
                title: entry.title,
                snippet: entry.snippet,
            })
            .collect();
        Ok(RpcPayload::SearchHits { hits })
    }

    fn read_note(&self, path: String) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let note_path = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
        let document = read_note(&session.descriptor.id, &session.root, &note_path)
            .map_err(|error| error.to_string())?;
        Ok(RpcPayload::NoteDocument {
            path,
            title: document.metadata.title,
            markdown: document.markdown,
        })
    }

    fn rebuild_index(&self) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let summary = rebuild_index(session, &[]).map_err(|error| error.to_string())?;
        Ok(RpcPayload::RebuildSummary {
            indexed_notes: summary.indexed_notes,
            skipped_notes: summary.skipped_notes,
            links_written: summary.links_written,
        })
    }

    fn health_report(&self) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = open_cache_for_session(session).map_err(|error| error.to_string())?;
        let json = health_report_json(&cache, session).map_err(|error| error.to_string())?;
        Ok(RpcPayload::HealthReport { json })
    }

    fn health_diagnostics(&self) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = open_cache_for_session(session).map_err(|error| error.to_string())?;
        let json = health_diagnostics_json(&cache, session).map_err(|error| error.to_string())?;
        Ok(RpcPayload::HealthDiagnostics { json })
    }

    fn git_status(&self) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let status = git_status(session.root.root()).map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&status).map_err(|error| error.to_string())?;
        Ok(RpcPayload::GitStatus { json })
    }

    fn backlinks(&self, path: String) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = open_cache_for_session(session).map_err(|error| error.to_string())?;
        let hits = backlinks_for_path(&cache, session, &path)
            .map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&hits).map_err(|error| error.to_string())?;
        Ok(RpcPayload::Backlinks { path, json })
    }

    fn graph_summary(&self, path: Option<String>, depth: u32) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = open_cache_for_session(session).map_err(|error| error.to_string())?;
        let graph = query_focused_graph(
            &cache,
            session,
            path.as_deref(),
            depth.max(1),
            &[],
        )
        .map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&graph).map_err(|error| error.to_string())?;
        Ok(RpcPayload::GraphSummary { json })
    }

    fn save_note(
        &self,
        path: String,
        markdown: String,
        expected_content_hash: Option<String>,
        dry_run: bool,
    ) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let note_path = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
        let output = save_note_with_options(
            &session.descriptor.id,
            &session.root,
            &note_path,
            &markdown,
            expected_content_hash.as_deref(),
            SaveNoteOptions { dry_run },
        )
        .map_err(|error| error.to_string())?;
        if !dry_run {
            incremental_note_index(session, &path, &[]).map_err(|error| error.to_string())?;
        }
        let json = serde_json::to_string(&output).map_err(|error| error.to_string())?;
        Ok(RpcPayload::NoteSaved { json })
    }

    fn update_note_index(&self, path: String) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        incremental_note_index(session, &path, &[]).map_err(|error| error.to_string())?;
        Ok(RpcPayload::Unit)
    }

    fn rename_note_apply(
        &self,
        from_path: String,
        to_path: String,
        update_links: bool,
    ) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let from = RelativeVaultPath::parse(&from_path).map_err(|error| error.to_string())?;
        let to = RelativeVaultPath::parse(&to_path).map_err(|error| error.to_string())?;
        let output = rename_apply(
            &session.descriptor.id,
            &session.root,
            &from,
            &to,
            update_links,
        )
        .map_err(|error| error.to_string())?;
        incremental_notes_index(session, &output.affected_files, &[])
            .map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&output).map_err(|error| error.to_string())?;
        Ok(RpcPayload::RenameApplied { json })
    }

    fn export_run_note(
        &self,
        note_path: String,
        format: String,
        dry_run: bool,
        extra_pandoc_args: Vec<String>,
        output_subdirectory: Option<String>,
    ) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let relative = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
        let note = read_note(&session.descriptor.id, &session.root, &relative)
            .map_err(|error| error.to_string())?;
        let stem = note_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("note");
        let output_directory = match output_subdirectory {
            Some(subdir) => session.root.root().join(subdir),
            None => default_export_directory(session.root.root()),
        };
        let input = ExportJobInput {
            format,
            source_markdown: note.markdown,
            output_directory: output_directory.display().to_string(),
            source_stem: stem.to_string(),
            title: Some(note.metadata.title),
            dry_run,
            extra_pandoc_args,
            vault_root: session.root.root().display().to_string(),
            job_id: None,
            preserve_temp_on_failure: false,
        };
        let output = run_export_job(input).map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&output).map_err(|error| error.to_string())?;
        Ok(RpcPayload::ExportResult { json })
    }

    fn export_run_markdown(
        &self,
        note_path: String,
        source_markdown: String,
        format: String,
        dry_run: bool,
        extra_pandoc_args: Vec<String>,
        output_subdirectory: Option<String>,
    ) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let stem = note_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("note");
        let output_directory = match output_subdirectory {
            Some(subdir) => session.root.root().join(subdir),
            None => default_export_directory(session.root.root()),
        };
        let input = ExportJobInput {
            format,
            source_markdown,
            output_directory: output_directory.display().to_string(),
            source_stem: stem.to_string(),
            title: None,
            dry_run,
            extra_pandoc_args,
            vault_root: session.root.root().display().to_string(),
            job_id: None,
            preserve_temp_on_failure: false,
        };
        let output = run_export_job(input).map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&output).map_err(|error| error.to_string())?;
        Ok(RpcPayload::ExportResult { json })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use scriptor_ipc::RpcMethod;
    use tempfile::tempdir;

    #[test]
    fn ping_returns_version() {
        let mut state = DaemonState::default();
        let response = state.handle(RpcRequest {
            id: 1,
            method: RpcMethod::Ping,
        });
        match response.result {
            RpcResult::Ok(RpcPayload::Pong { version }) => assert!(!version.is_empty()),
            other => panic!("unexpected response: {other:?}"),
        }
    }

    #[test]
    fn open_vault_lists_notes() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        let open = state.handle(RpcRequest {
            id: 2,
            method: RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        });
        assert!(matches!(open.result, RpcResult::Ok(RpcPayload::VaultOpened { .. })));

        let list = state.handle(RpcRequest {
            id: 3,
            method: RpcMethod::ListNotes,
        });
        match list.result {
            RpcResult::Ok(RpcPayload::NoteList { notes }) => assert!(!notes.is_empty()),
            other => panic!("unexpected response: {other:?}"),
        }
    }

    #[test]
    fn save_note_updates_index() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        let open = state.handle(RpcRequest {
            id: 4,
            method: RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        });
        assert!(matches!(open.result, RpcResult::Ok(RpcPayload::VaultOpened { .. })));

        let save = state.handle(RpcRequest {
            id: 5,
            method: RpcMethod::SaveNote {
                path: "alpha.md".into(),
                markdown: "# Alpha\n\nUpdated body\n".into(),
                expected_content_hash: None,
                dry_run: false,
            },
        });
        match save.result {
            RpcResult::Ok(RpcPayload::NoteSaved { json }) => assert!(json.contains("content_hash")),
            other => panic!("unexpected response: {other:?}"),
        }
    }

    #[test]
    fn rename_note_apply_moves_file() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        state.handle(RpcRequest {
            id: 6,
            method: RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        });

        let rename = state.handle(RpcRequest {
            id: 7,
            method: RpcMethod::RenameNoteApply {
                from_path: "alpha.md".into(),
                to_path: "beta.md".into(),
                update_links: false,
            },
        });
        match rename.result {
            RpcResult::Ok(RpcPayload::RenameApplied { json }) => assert!(json.contains("beta.md")),
            other => panic!("unexpected response: {other:?}"),
        }
        assert!(!dir.path().join("alpha.md").exists());
        assert!(dir.path().join("beta.md").exists());
    }

    #[test]
    fn export_run_note_dry_run() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        state.handle(RpcRequest {
            id: 8,
            method: RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        });

        let export = state.handle(RpcRequest {
            id: 9,
            method: RpcMethod::ExportRunNote {
                note_path: "alpha.md".into(),
                format: "html".into(),
                dry_run: true,
                extra_pandoc_args: vec![],
                output_subdirectory: None,
            },
        });
        match export.result {
            RpcResult::Ok(RpcPayload::ExportResult { json }) => assert!(json.contains("dry_run")),
            RpcResult::Err(message) if message.contains("pandoc") => {}
            other => panic!("unexpected response: {other:?}"),
        }
    }
}
