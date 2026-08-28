use std::path::PathBuf;

use scriptor_export_runner::{ExportJobInput, default_export_directory};
use scriptor_indexer::{
    IndexCache, backlinks_for_path, health_diagnostics_json, health_report_json,
    incremental_note_index_with_cache, incremental_notes_index_with_cache, list_note_summaries,
    open_cache_for_session, query_focused_graph, rebuild_index, search_notes,
};
use scriptor_ipc::{
    NoteSummary, RpcMethod, RpcPayload, RpcRequest, RpcResponse, RpcResult, SearchHit,
};
use scriptor_native_git::git_status;
use scriptor_vault::{
    PluginState, RelativeVaultPath, SaveNoteOptions, VaultSession, VaultWatcher, load_plugin_state,
    load_vault_config, open_vault, read_note, rename_apply_staged, rollback_save_note,
    save_note_with_options,
};

use crate::command_gateway;
use crate::export_job::ExportJobRunner;
use crate::index_job::IndexRebuildJob;

#[derive(Default)]
pub struct DaemonState {
    pub(crate) session: Option<VaultSession>,
    pub(crate) index_cache: Option<IndexCache>,
    pub(crate) config_generation: u64,
    pub(crate) index_rebuild: IndexRebuildJob,
    pub(crate) export_job: ExportJobRunner,
    pub(crate) vault_watcher: Option<VaultWatcher>,
    pub(crate) watcher_generation: u64,
    pub(crate) endpoint_nonce: Option<String>,
    pub(crate) plugin_state: PluginState,
}

impl DaemonState {
    pub fn wait_index_rebuild(&self) {
        self.index_rebuild.wait();
    }

    pub fn session(&self) -> Option<&VaultSession> {
        self.session.as_ref()
    }

    pub fn index_cache(&self) -> Option<&IndexCache> {
        self.index_cache.as_ref()
    }

    #[cfg(test)]
    pub fn refresh_index_cache(&mut self) -> Result<(), String> {
        let session = self.require_session()?.clone();
        self.index_cache =
            Some(open_cache_for_session(&session).map_err(|error| error.to_string())?);
        Ok(())
    }

    pub fn clear_vault_watcher(&mut self) {
        self.vault_watcher = None;
    }

    /// Invalidates callbacks from the current watcher before a vault session is
    /// replaced or a new watcher is started. A watcher callback runs outside
    /// the daemon-state mutex, so dropping its handle alone cannot prove that
    /// an already queued callback belongs to the current vault.
    pub fn invalidate_vault_watcher(&mut self) -> u64 {
        self.clear_vault_watcher();
        self.watcher_generation = self.watcher_generation.saturating_add(1);
        self.watcher_generation
    }

    pub(crate) fn can_install_vault_watcher(
        &self,
        generation: u64,
        root: &scriptor_vault::VaultRoot,
    ) -> bool {
        self.watcher_generation == generation
            && self
                .session()
                .is_some_and(|session| session.root.root() == root.root())
    }

    pub fn set_vault_watcher(&mut self, watcher: VaultWatcher) {
        self.vault_watcher = Some(watcher);
    }

    pub fn wait_export_job(&self) {
        self.export_job.wait();
    }

    pub fn export_progress_snapshot(&self) -> crate::export_job::ExportProgressReport {
        self.export_job.progress_snapshot()
    }

    pub fn handle(&mut self, request: RpcRequest) -> RpcResponse {
        let id = request.id;
        if let Err(error) = crate::capabilities::enforce(&self.plugin_state, &request.method) {
            return RpcResponse {
                id,
                result: RpcResult::Error(error),
            };
        }
        let result = match request.method {
            RpcMethod::Ping => Ok(RpcPayload::Pong {
                version: env!("CARGO_PKG_VERSION").to_string(),
            }),
            RpcMethod::ReloadConfig => self.reload_config(),
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
            RpcMethod::ExportStartNote {
                note_path,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            } => self.export_start_note(
                note_path,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            ),
            RpcMethod::ExportStartMarkdown {
                note_path,
                source_markdown,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            } => self.export_start_markdown(
                note_path,
                source_markdown,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            ),
            RpcMethod::ExportJobStatus => self.export_job_status(),
            RpcMethod::ExportCancel { job_id } => self.export_cancel(job_id),
            RpcMethod::ExportRunNote { .. } | RpcMethod::ExportRunMarkdown { .. } => {
                Err("export run RPC must be dispatched outside the daemon state lock".into())
            }
            RpcMethod::IndexRebuildStatus => self.index_rebuild_status(),
            RpcMethod::SubscribeEvents => {
                Err("SubscribeEvents must be handled by the transport layer".into())
            }
            RpcMethod::ListCommands => {
                let commands: Vec<_> = command_gateway::list_commands()
                    .into_iter()
                    .filter(|command| !command_gateway::requires_desktop_authorization(command))
                    .collect();
                match serde_json::to_string(&commands) {
                    Ok(json) => Ok(RpcPayload::Json { json }),
                    Err(error) => Err(error.to_string()),
                }
            }
            RpcMethod::Invoke {
                command,
                payload_json,
            } => {
                if command_gateway::requires_desktop_authorization(&command) {
                    Err(format!(
                        "command {command} requires desktop authorization and is unavailable over daemon IPC"
                    ))
                } else if command_gateway::is_outside_lock_command(&command) {
                    Err(format!(
                        "command {command} must be dispatched outside the daemon state lock"
                    ))
                } else {
                    match serde_json::from_str::<serde_json::Value>(&payload_json) {
                        Ok(payload) => match command_gateway::dispatch(self, &command, &payload) {
                            Ok(value) => match serde_json::to_string(&value) {
                                Ok(json) => Ok(RpcPayload::Json { json }),
                                Err(error) => Err(error.to_string()),
                            },
                            Err(error) => Err(error),
                        },
                        Err(error) => Err(error.to_string()),
                    }
                }
            }
        };

        RpcResponse {
            id,
            result: match result {
                Ok(payload) => RpcResult::Ok(payload),
                Err(message) => RpcResult::failed(message),
            },
        }
    }

    pub(crate) fn require_session(&self) -> Result<&VaultSession, String> {
        self.session
            .as_ref()
            .ok_or_else(|| "no vault is open; call OpenVault first".to_string())
    }

    pub(crate) fn require_cache(&self) -> Result<&IndexCache, String> {
        self.index_cache
            .as_ref()
            .ok_or_else(|| "no index cache is open; call OpenVault first".to_string())
    }

    fn reload_config(&mut self) -> Result<RpcPayload, String> {
        self.config_generation = self.config_generation.saturating_add(1);
        let session = self.require_session()?;
        let config = load_vault_config(session.root.root()).map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&config).map_err(|error| error.to_string())?;
        Ok(RpcPayload::ConfigReloaded {
            json,
            generation: self.config_generation,
        })
    }

    pub(crate) fn open_vault_invoke(
        &mut self,
        path: String,
    ) -> Result<scriptor_vault::OpenVaultOutput, String> {
        // Invalidate before changing `session` or `index_cache`: a callback
        // from the old watcher can otherwise capture the newly installed
        // session and apply old-vault paths to the new index.
        self.invalidate_vault_watcher();
        self.index_rebuild.wait();
        self.index_cache = None;
        self.session = None;
        let mut session = open_vault(PathBuf::from(path)).map_err(|error| error.to_string())?;
        self.plugin_state =
            load_plugin_state(session.root.root()).map_err(|error| error.to_string())?;
        let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
        if !session.pending_reindex_paths.is_empty() {
            let paths = session.pending_reindex_paths.clone();
            incremental_notes_index_with_cache(&session, &cache, &paths, &[])
                .map_err(|error| error.to_string())?;
            session.pending_reindex_paths.clear();
        }
        let output = scriptor_vault::open_vault_output(&session);
        self.session = Some(session.clone());
        self.index_cache = Some(cache);
        self.index_rebuild.spawn(session);
        Ok(output)
    }

    fn open_vault(&mut self, path: String) -> Result<RpcPayload, String> {
        let output = self.open_vault_invoke(path)?;
        Ok(RpcPayload::VaultOpened {
            vault_id: output.vault.id.clone(),
            name: output.vault.name.clone(),
            root_path: output.vault.root_path.clone(),
        })
    }

    fn index_rebuild_status(&self) -> Result<RpcPayload, String> {
        let report = self.index_rebuild.progress_snapshot();
        let json = serde_json::to_string(&report).map_err(|error| error.to_string())?;
        Ok(RpcPayload::IndexRebuildStatus { json })
    }

    fn list_notes(&self) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = self.require_cache()?;
        let notes = list_note_summaries(cache, &session.descriptor.id)
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
        let cache = self.require_cache()?;
        let hits = search_notes(cache, &session.descriptor.id, query.trim(), limit)
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
        self.index_rebuild.wait();
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
        let cache = self.require_cache()?;
        let json = health_report_json(cache, session).map_err(|error| error.to_string())?;
        Ok(RpcPayload::HealthReport { json })
    }

    fn health_diagnostics(&self) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = self.require_cache()?;
        let json = health_diagnostics_json(cache, session).map_err(|error| error.to_string())?;
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
        let cache = self.require_cache()?;
        let hits = backlinks_for_path(cache, session, &path).map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&hits).map_err(|error| error.to_string())?;
        Ok(RpcPayload::Backlinks { path, json })
    }

    fn graph_summary(&self, path: Option<String>, depth: u32) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        let cache = self.require_cache()?;
        let graph = query_focused_graph(cache, session, path.as_deref(), depth.max(1), &[])
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
        if !dry_run
            && let Err(error) =
                incremental_note_index_with_cache(session, self.require_cache()?, &path, &[])
        {
            if let Err(rollback_error) = rollback_save_note(
                &session.descriptor.id,
                &session.root,
                &note_path,
                output.previous_content_hash.as_deref(),
            ) {
                return Err(format!(
                    "index update failed: {error}; disk rollback failed: {rollback_error}"
                ));
            }
            return Err(error.to_string());
        }
        let json = serde_json::to_string(&output).map_err(|error| error.to_string())?;
        Ok(RpcPayload::NoteSaved { json })
    }

    fn update_note_index(&self, path: String) -> Result<RpcPayload, String> {
        let session = self.require_session()?;
        incremental_note_index_with_cache(session, self.require_cache()?, &path, &[])
            .map_err(|error| error.to_string())?;
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
        let (output, staged) = rename_apply_staged(
            &session.descriptor.id,
            &session.root,
            &from,
            &to,
            update_links,
        )
        .map_err(|error| error.to_string())?;
        if let Err(error) = incremental_notes_index_with_cache(
            session,
            self.require_cache()?,
            &output.affected_files,
            &[],
        ) {
            let _ = staged.abort();
            return Err(error.to_string());
        }
        staged.commit().map_err(|error| error.to_string())?;
        let json = serde_json::to_string(&output).map_err(|error| error.to_string())?;
        Ok(RpcPayload::RenameApplied { json })
    }

    fn export_job_status(&self) -> Result<RpcPayload, String> {
        let report = self.export_job.progress_snapshot();
        let json = serde_json::to_string(&report).map_err(|error| error.to_string())?;
        Ok(RpcPayload::ExportJobStatus { json })
    }

    fn export_cancel(&self, job_id: Option<String>) -> Result<RpcPayload, String> {
        self.export_job
            .cancel(job_id.as_deref())
            .map(|_cancelled| RpcPayload::Unit)
            .map_err(|error| error.to_string())
    }

    pub fn prepare_export_input(&self, method: &RpcMethod) -> Result<ExportJobInput, String> {
        match method {
            RpcMethod::ExportRunNote {
                note_path,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            } => self.build_export_note_input(
                note_path,
                format,
                *dry_run,
                extra_pandoc_args,
                output_subdirectory,
                None,
            ),
            RpcMethod::ExportRunMarkdown {
                note_path,
                source_markdown,
                format,
                dry_run,
                extra_pandoc_args,
                output_subdirectory,
            } => self.build_export_markdown_input(
                note_path,
                source_markdown,
                format,
                *dry_run,
                extra_pandoc_args,
                output_subdirectory,
                None,
            ),
            _ => Err("not an export RPC".into()),
        }
    }

    fn export_start_note(
        &self,
        note_path: String,
        format: String,
        dry_run: bool,
        extra_pandoc_args: Vec<String>,
        output_subdirectory: Option<String>,
    ) -> Result<RpcPayload, String> {
        let input = self.build_export_note_input(
            &note_path,
            &format,
            dry_run,
            &extra_pandoc_args,
            &output_subdirectory,
            None,
        )?;
        let job_id = self.export_job.start(input)?;
        Ok(RpcPayload::ExportStarted { job_id })
    }

    fn export_start_markdown(
        &self,
        note_path: String,
        source_markdown: String,
        format: String,
        dry_run: bool,
        extra_pandoc_args: Vec<String>,
        output_subdirectory: Option<String>,
    ) -> Result<RpcPayload, String> {
        let input = self.build_export_markdown_input(
            &note_path,
            &source_markdown,
            &format,
            dry_run,
            &extra_pandoc_args,
            &output_subdirectory,
            None,
        )?;
        let job_id = self.export_job.start(input)?;
        Ok(RpcPayload::ExportStarted { job_id })
    }

    fn build_export_note_input(
        &self,
        note_path: &str,
        format: &str,
        dry_run: bool,
        extra_pandoc_args: &[String],
        output_subdirectory: &Option<String>,
        job_id: Option<String>,
    ) -> Result<ExportJobInput, String> {
        let session = self.require_session()?;
        let relative = RelativeVaultPath::parse(note_path).map_err(|error| error.to_string())?;
        let note = read_note(&session.descriptor.id, &session.root, &relative)
            .map_err(|error| error.to_string())?;
        let stem = note_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("note");
        let output_directory = match output_subdirectory {
            Some(subdir) => {
                let _validated = RelativeVaultPath::parse(subdir)
                    .map_err(|error| format!("invalid output_subdirectory: {error}"))?;
                session.root.root().join(subdir)
            }
            None => default_export_directory(session.root.root()),
        };
        Ok(ExportJobInput {
            format: format.to_string(),
            source_markdown: note.markdown,
            output_directory: output_directory.display().to_string(),
            source_stem: stem.to_string(),
            title: Some(note.metadata.title),
            dry_run,
            extra_pandoc_args: extra_pandoc_args.to_vec(),
            vault_root: session.root.root().display().to_string(),
            job_id,
            preserve_temp_on_failure: false,
            trusted_pandoc_hash: None,
            redact_secrets: false,
        })
    }

    // Mirrors the RPC wire shape of ExportStartMarkdown one-to-one.
    #[allow(clippy::too_many_arguments)]
    fn build_export_markdown_input(
        &self,
        note_path: &str,
        source_markdown: &str,
        format: &str,
        dry_run: bool,
        extra_pandoc_args: &[String],
        output_subdirectory: &Option<String>,
        job_id: Option<String>,
    ) -> Result<ExportJobInput, String> {
        let session = self.require_session()?;
        let stem = note_path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or("note");
        let output_directory = match output_subdirectory {
            Some(subdir) => {
                let _validated = RelativeVaultPath::parse(subdir)
                    .map_err(|error| format!("invalid output_subdirectory: {error}"))?;
                session.root.root().join(subdir)
            }
            None => default_export_directory(session.root.root()),
        };
        Ok(ExportJobInput {
            format: format.to_string(),
            source_markdown: source_markdown.to_string(),
            output_directory: output_directory.display().to_string(),
            source_stem: stem.to_string(),
            title: None,
            dry_run,
            extra_pandoc_args: extra_pandoc_args.to_vec(),
            vault_root: session.root.root().display().to_string(),
            job_id,
            preserve_temp_on_failure: false,
            trusted_pandoc_hash: None,
            redact_secrets: false,
        })
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
        let response = state.handle(RpcRequest::new(1, RpcMethod::Ping));
        match response.result {
            RpcResult::Ok(RpcPayload::Pong { version }) => assert!(!version.is_empty()),
            other => panic!("unexpected response: {other:?}"),
        }
    }

    #[test]
    fn invoke_rejects_operations_that_require_desktop_authorization() {
        let mut state = DaemonState::default();
        let response = state.handle(RpcRequest::new(
            2,
            RpcMethod::Invoke {
                command: "git_push_cmd".into(),
                payload_json: "{}".into(),
            },
        ));
        assert!(matches!(
            response.result,
            RpcResult::Error(error) if error.to_string().contains("desktop authorization")
        ));
    }

    #[test]
    fn list_commands_excludes_operations_that_require_desktop_authorization() {
        let mut state = DaemonState::default();
        let response = state.handle(RpcRequest::new(3, RpcMethod::ListCommands));
        let RpcResult::Ok(RpcPayload::Json { json }) = response.result else {
            panic!("expected command list response");
        };
        let commands: Vec<String> = serde_json::from_str(&json).expect("command list json");
        assert!(
            commands
                .iter()
                .all(|command| !command_gateway::requires_desktop_authorization(command))
        );
        assert!(commands.iter().any(|command| command == "vault_save_note"));
    }

    #[test]
    fn vault_swap_invalidates_existing_watcher_generation() {
        let first = tempdir().expect("first vault");
        let second = tempdir().expect("second vault");
        let mut state = DaemonState::default();

        state
            .open_vault_invoke(first.path().display().to_string())
            .expect("open first vault");
        let first_generation = state.watcher_generation;
        let first_root = state.session().expect("first session").root.clone();
        assert!(state.can_install_vault_watcher(first_generation, &first_root));

        state
            .open_vault_invoke(second.path().display().to_string())
            .expect("open second vault");
        assert!(
            !state.can_install_vault_watcher(first_generation, &first_root),
            "a watcher prepared for the old vault must not install after the swap"
        );
    }

    #[test]
    fn open_vault_lists_notes() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        let open = state.handle(RpcRequest::new(
            2,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        assert!(matches!(
            open.result,
            RpcResult::Ok(RpcPayload::VaultOpened { .. })
        ));
        state.wait_index_rebuild();

        let list = state.handle(RpcRequest::new(3, RpcMethod::ListNotes));
        match list.result {
            RpcResult::Ok(RpcPayload::NoteList { notes }) => assert!(!notes.is_empty()),
            other => panic!("unexpected response: {other:?}"),
        }
    }

    #[test]
    fn search_reuses_session_index_cache_pool() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        state.handle(RpcRequest::new(
            40,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        state.wait_index_rebuild();

        let baseline = state.index_cache().expect("session cache").clone();
        for offset in 0..100 {
            let response = state.handle(RpcRequest::new(
                100 + offset,
                RpcMethod::SearchNotes {
                    query: "Alpha".into(),
                    limit: 5,
                },
            ));
            assert!(matches!(
                response.result,
                RpcResult::Ok(RpcPayload::SearchHits { .. })
            ));
        }

        let after = state.index_cache().expect("session cache");
        assert!(
            baseline.shares_pool_with(after),
            "expected 100 search RPCs to reuse the same pooled IndexCache"
        );
    }

    #[test]
    fn save_note_rolls_back_disk_on_index_failure() {
        use scriptor_indexer::db::default_cache_path;
        use scriptor_vault::read_note;

        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        state.handle(RpcRequest::new(
            20,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        state.wait_index_rebuild();

        let cache_path = default_cache_path(dir.path());
        for path in [
            cache_path.clone(),
            PathBuf::from(format!("{}-wal", cache_path.display())),
            PathBuf::from(format!("{}-shm", cache_path.display())),
        ] {
            if !path.exists() {
                continue;
            }
            let mut permissions = std::fs::metadata(&path)
                .expect("cache metadata")
                .permissions();
            permissions.set_readonly(true);
            std::fs::set_permissions(&path, permissions).expect("set readonly");
        }
        // Privileged users (e.g. root in CI containers) bypass read-only file
        // permissions, so the injected index failure never happens; skip there.
        if std::fs::OpenOptions::new()
            .append(true)
            .open(&cache_path)
            .is_ok()
        {
            eprintln!("skipping: read-only cache does not block writes in this environment");
            return;
        }
        state.refresh_index_cache().expect("refresh index cache");

        let save = state.handle(RpcRequest::new(
            21,
            RpcMethod::SaveNote {
                path: "alpha.md".into(),
                markdown: "# Alpha\n\nUpdated body\n".into(),
                expected_content_hash: None,
                dry_run: false,
            },
        ));
        assert!(matches!(save.result, RpcResult::Error(_)));

        let session = state.session().expect("session");
        let document = read_note(
            &session.descriptor.id,
            &session.root,
            &RelativeVaultPath::parse("alpha.md").unwrap(),
        )
        .expect("read note");
        assert!(
            document.markdown.contains("Body"),
            "disk should roll back to pre-save content, got: {}",
            document.markdown
        );
        assert!(
            !document.markdown.contains("Updated body"),
            "failed save should not leave updated markdown on disk"
        );

        for path in [
            cache_path.clone(),
            cache_path.with_extension("sqlite-wal"),
            cache_path.with_extension("sqlite-shm"),
        ] {
            if !path.exists() {
                continue;
            }
            let mut permissions = std::fs::metadata(&path)
                .expect("cache metadata")
                .permissions();
            #[allow(clippy::permissions_set_readonly_false)]
            permissions.set_readonly(false);
            let _ = std::fs::set_permissions(&path, permissions);
        }
    }

    #[test]
    fn save_note_updates_index() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        let open = state.handle(RpcRequest::new(
            4,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        assert!(matches!(
            open.result,
            RpcResult::Ok(RpcPayload::VaultOpened { .. })
        ));
        state.wait_index_rebuild();

        let save = state.handle(RpcRequest::new(
            5,
            RpcMethod::SaveNote {
                path: "alpha.md".into(),
                markdown: "# Alpha\n\nUpdated body\n".into(),
                expected_content_hash: None,
                dry_run: false,
            },
        ));
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
        state.handle(RpcRequest::new(
            6,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        state.wait_index_rebuild();

        let rename = state.handle(RpcRequest::new(
            7,
            RpcMethod::RenameNoteApply {
                from_path: "alpha.md".into(),
                to_path: "beta.md".into(),
                update_links: false,
            },
        ));
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
        state.handle(RpcRequest::new(
            8,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        state.wait_index_rebuild();

        let export = state.handle(RpcRequest::new(
            9,
            RpcMethod::ExportStartNote {
                note_path: "alpha.md".into(),
                format: "html".into(),
                dry_run: true,
                extra_pandoc_args: vec![],
                output_subdirectory: None,
            },
        ));
        match export.result {
            RpcResult::Ok(RpcPayload::ExportStarted { job_id }) => assert!(!job_id.is_empty()),
            RpcResult::Error(error) if error.to_string().contains("pandoc") => {}
            other => panic!("unexpected response: {other:?}"),
        }
        state.wait_export_job();
        let report = state.export_progress_snapshot();
        assert!(report.event_index >= 3);
    }

    #[test]
    fn export_start_returns_immediately_while_job_runs() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");
        let mut state = DaemonState::default();
        state.handle(RpcRequest::new(
            12,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        state.wait_index_rebuild();

        let started = std::time::Instant::now();
        let response = state.handle(RpcRequest::new(
            13,
            RpcMethod::ExportStartNote {
                note_path: "alpha.md".into(),
                format: "html".into(),
                dry_run: true,
                extra_pandoc_args: vec![],
                output_subdirectory: None,
            },
        ));
        assert!(started.elapsed().as_millis() < 200);
        assert!(matches!(
            response.result,
            RpcResult::Ok(RpcPayload::ExportStarted { .. })
        ));
        state.wait_export_job();
    }

    #[test]
    fn open_vault_returns_before_index_finishes_with_progress_events() {
        let dir = tempdir().expect("tempdir");
        for index in 0..12 {
            std::fs::write(
                dir.path().join(format!("note-{index}.md")),
                format!("# Note {index}\n\nBody\n"),
            )
            .expect("write");
        }

        let mut state = DaemonState::default();
        let open = state.handle(RpcRequest::new(
            10,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        assert!(matches!(
            open.result,
            RpcResult::Ok(RpcPayload::VaultOpened { .. })
        ));

        let mut max_events = 0u32;
        for _ in 0..200 {
            let status = state.handle(RpcRequest::new(11, RpcMethod::IndexRebuildStatus));
            match status.result {
                RpcResult::Ok(RpcPayload::IndexRebuildStatus { json }) => {
                    let report: scriptor_indexer::RebuildProgressReport =
                        serde_json::from_str(&json).expect("progress json");
                    max_events = max_events.max(report.event_index);
                    if report.status == scriptor_indexer::RebuildStatus::Complete {
                        assert!(
                            max_events >= 3,
                            "expected >=3 progress events, got {max_events}"
                        );
                        return;
                    }
                }
                other => panic!("unexpected response: {other:?}"),
            }
            std::thread::sleep(std::time::Duration::from_millis(5));
        }

        panic!("index rebuild did not complete in time; max_events={max_events}");
    }

    #[test]
    fn ping_p95_stays_fast_during_large_vault_rebuild() {
        use scriptor_indexer::{RebuildProgressReport, RebuildStatus};
        use std::time::Instant;

        const NOTE_COUNT: usize = 100;
        const P95_BUDGET_MS: u128 = 10;
        const MIN_PINGS: usize = 20;

        let dir = tempdir().expect("tempdir");
        for index in 0..NOTE_COUNT {
            std::fs::write(
                dir.path().join(format!("note-{index:04}.md")),
                format!("# Note {index}\n\nBody paragraph.\n"),
            )
            .expect("write");
        }

        let mut state = DaemonState::default();
        let open = state.handle(RpcRequest::new(
            70,
            RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            },
        ));
        assert!(matches!(
            open.result,
            RpcResult::Ok(RpcPayload::VaultOpened { .. })
        ));

        let mut latencies = Vec::new();
        let deadline = Instant::now() + std::time::Duration::from_secs(15);
        while Instant::now() < deadline {
            let start = Instant::now();
            let response = state.handle(RpcRequest::new(
                80 + latencies.len() as u64,
                RpcMethod::Ping,
            ));
            assert!(matches!(
                response.result,
                RpcResult::Ok(RpcPayload::Pong { .. })
            ));
            latencies.push(start.elapsed());
            std::thread::sleep(std::time::Duration::from_millis(2));

            if latencies.len() % 10 == 0 {
                let status = state.handle(RpcRequest::new(
                    200 + latencies.len() as u64,
                    RpcMethod::IndexRebuildStatus,
                ));
                if let RpcResult::Ok(RpcPayload::IndexRebuildStatus { json }) = status.result
                    && let Ok(report) = serde_json::from_str::<RebuildProgressReport>(&json)
                    && report.status == RebuildStatus::Complete
                    && latencies.len() >= MIN_PINGS
                {
                    break;
                }
            }
        }

        assert!(
            latencies.len() >= MIN_PINGS,
            "expected at least {MIN_PINGS} pings during rebuild, got {}",
            latencies.len()
        );
        latencies.sort();
        let p95_index = ((latencies.len() as f64) * 0.95).ceil() as usize - 1;
        let p95 = latencies[p95_index.min(latencies.len() - 1)];
        assert!(
            p95.as_millis() < P95_BUDGET_MS,
            "ping p95 {:?} exceeded {P95_BUDGET_MS}ms during large vault rebuild (n={})",
            p95,
            latencies.len()
        );

        state.wait_index_rebuild();
    }
}
