use std::fs;
use std::path::Path;

use chrono::{Datelike, Local, NaiveDate};
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::atomic_write;
use crate::path::{RelativeVaultPath, VaultRoot};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DailyNoteConfig {
    #[serde(default = "default_daily_directory")]
    pub directory: String,
    #[serde(default = "default_daily_filename")]
    pub filename_format: String,
    #[serde(default = "default_daily_title")]
    pub title_format: String,
    #[serde(default)]
    pub template_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExportConfig {
    #[serde(default = "default_bibliography_path")]
    pub bibliography_path: String,
    #[serde(default = "default_csl_style_path")]
    pub csl_style_path: String,
    #[serde(default)]
    pub export_on_save: ExportOnSaveConfig,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExportOnSaveConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WritingTargetsConfig {
    #[serde(default = "default_daily_word_target")]
    pub daily_words: u32,
    #[serde(default)]
    pub history_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphGroupRule {
    pub tag_prefix: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpVaultConfig {
    #[serde(default = "default_mcp_mode")]
    pub mode: String,
    #[serde(default)]
    pub disabled: bool,
}

fn default_mcp_mode() -> String {
    "read-only".into()
}

impl Default for McpVaultConfig {
    fn default() -> Self {
        Self {
            mode: default_mcp_mode(),
            disabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct InboxConfig {
    #[serde(default = "default_inbox_enabled")]
    pub enabled: bool,
    #[serde(default = "default_inbox_period")]
    pub period: String,
    #[serde(default)]
    pub new_note_directory: Option<String>,
}

fn default_inbox_enabled() -> bool {
    true
}

fn default_inbox_period() -> String {
    "all".into()
}

impl Default for InboxConfig {
    fn default() -> Self {
        Self {
            enabled: default_inbox_enabled(),
            period: default_inbox_period(),
            new_note_directory: None,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkflowConfig {
    #[serde(default)]
    pub auto_advance_inbox_after_organize: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NoteTypesConfig {
    #[serde(default = "default_note_types_directory")]
    pub directory: String,
}

fn default_note_types_directory() -> String {
    "type".into()
}

impl Default for NoteTypesConfig {
    fn default() -> Self {
        Self {
            directory: default_note_types_directory(),
        }
    }
}

/// A named, persisted snapshot of graph filter state.
///
/// Mirrors the frontend `SavedGraphView` (`src/types/vault.ts`). Every field
/// carries a serde default so a partially-written entry degrades
/// gracefully instead of failing the entire `VaultConfig` deserialization, and
/// a config written by the frontend round-trips losslessly through Rust.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SavedView {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depth: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modified_within_days: Option<u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cluster_ids: Vec<String>,
}

/// Tectonic-backed LaTeX compilation settings. Mirrors `latex?` in `VaultConfig` (TS).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct LatexConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub tectonic_path: Option<String>,
    #[serde(default = "default_latex_output_directory")]
    pub output_directory: String,
    #[serde(default)]
    pub extra_flags: Vec<String>,
    #[serde(default)]
    pub compile_on_save: bool,
}

fn default_latex_output_directory() -> String {
    ".scriptor/latex".into()
}

/// Google Calendar / Tasks sync settings. Mirrors `calendar_sync?` in TS.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct CalendarSyncConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub google_client_id: Option<String>,
    #[serde(default)]
    pub google_calendar_id: Option<String>,
    #[serde(default)]
    pub google_task_list_id: Option<String>,
    #[serde(default = "default_calendar_lookahead_days")]
    pub lookahead_days: u32,
    #[serde(default)]
    pub show_events_in_tasks: bool,
    #[serde(default)]
    pub push_vault_tasks: bool,
    #[serde(default)]
    pub capture_note_path: Option<String>,
}

fn default_calendar_lookahead_days() -> u32 {
    14
}

/// Prose / wikilink autosuggest tuning. Mirrors `autosuggest?` in TS.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutosuggestConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_autosuggest_min_chars")]
    pub min_chars: u32,
    #[serde(default = "default_autosuggest_max_results")]
    pub max_results: u32,
    #[serde(default = "default_true")]
    pub cross_document: bool,
    #[serde(default = "default_true")]
    pub wikilinks: bool,
    #[serde(default = "default_true")]
    pub tags: bool,
    #[serde(default = "default_true")]
    pub headings: bool,
    #[serde(default = "default_autosuggest_debounce_ms")]
    pub debounce_ms: u32,
}

fn default_true() -> bool {
    true
}

fn default_autosuggest_min_chars() -> u32 {
    2
}

fn default_autosuggest_max_results() -> u32 {
    8
}

fn default_autosuggest_debounce_ms() -> u32 {
    120
}

impl Default for AutosuggestConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            min_chars: default_autosuggest_min_chars(),
            max_results: default_autosuggest_max_results(),
            cross_document: true,
            wikilinks: true,
            tags: true,
            headings: true,
            debounce_ms: default_autosuggest_debounce_ms(),
        }
    }
}

/// A user-defined callout type. Mirrors an entry of `custom_callouts?` in TS.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CustomCallout {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub accent_color: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Reading-list workflow settings. Mirrors `reading_list?` in TS.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReadingListConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_reading_list_status_key")]
    pub status_key: String,
}

fn default_reading_list_status_key() -> String {
    "status".into()
}

impl Default for ReadingListConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            status_key: default_reading_list_status_key(),
        }
    }
}

/// Accessibility preferences. Mirrors `accessibility?` in TS.
///
/// `font_scale` is a float, so this struct (and therefore `VaultConfig`) derives
/// `PartialEq` but not `Eq`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AccessibilityConfig {
    #[serde(default)]
    pub reduced_motion: bool,
    #[serde(default)]
    pub high_contrast: bool,
    #[serde(default = "default_font_scale")]
    pub font_scale: f32,
    #[serde(default = "default_true")]
    pub live_regions: bool,
    #[serde(default = "default_focus_outline")]
    pub focus_outline: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_outline_color: Option<String>,
}

fn default_font_scale() -> f32 {
    1.0
}

fn default_focus_outline() -> String {
    "default".into()
}

impl Default for AccessibilityConfig {
    fn default() -> Self {
        Self {
            reduced_motion: false,
            high_contrast: false,
            font_scale: default_font_scale(),
            live_regions: true,
            focus_outline: default_focus_outline(),
            focus_outline_color: None,
        }
    }
}

/// Per-vault feature flags. Mirrors `features?` in TS.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct FeaturesConfig {
    #[serde(default)]
    pub latex: bool,
    #[serde(default)]
    pub calendar: bool,
    #[serde(default)]
    pub reading_list: bool,
    #[serde(default)]
    pub relationship_matrix: bool,
    #[serde(default)]
    pub automation_recorder: bool,
    #[serde(default)]
    pub link_decay: bool,
    #[serde(default)]
    pub footnote_manager: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultConfig {
    #[serde(default)]
    pub daily_note: DailyNoteConfig,
    #[serde(default = "default_templates_directory")]
    pub templates_directory: String,
    #[serde(default)]
    pub export: ExportConfig,
    #[serde(default)]
    pub writing_targets: WritingTargetsConfig,
    #[serde(default)]
    pub graph_groups: Vec<GraphGroupRule>,
    #[serde(default)]
    pub extra_roots: Vec<String>,
    #[serde(default)]
    pub canvas: CanvasConfig,
    #[serde(default)]
    pub mcp: McpVaultConfig,
    #[serde(default)]
    pub inbox: InboxConfig,
    #[serde(default)]
    pub workflow: WorkflowConfig,
    #[serde(default)]
    pub note_types: NoteTypesConfig,
    #[serde(default)]
    pub saved_views: Vec<SavedView>,
    #[serde(default)]
    pub trusted_binaries: Option<TrustedBinaries>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latex: Option<LatexConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub calendar_sync: Option<CalendarSyncConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub autosuggest: Option<AutosuggestConfig>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub custom_callouts: Vec<CustomCallout>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reading_list: Option<ReadingListConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accessibility: Option<AccessibilityConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub features: Option<FeaturesConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub semantic: Option<SemanticConfig>,
}

/// Semantic (embedding) search configuration. Opt-in: an absent section (or
/// `provider: "none"`) keeps search keyword-only. API keys never live in
/// this file — the OpenAI key is supplied per request from the OS keychain.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SemanticConfig {
    /// `"ollama"` (local server) or `"openai"`; `"none"` disables the feature.
    pub provider: String,
    /// Ollama base URL, e.g. `http://localhost:11434`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    /// Embedding model id, e.g. `nomic-embed-text` or `text-embedding-3-small`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// Embedding dimension; must match the model output (e.g. 768 for
    /// nomic-embed-text, 1536 for text-embedding-3-small).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dimension: Option<usize>,
}

#[cfg(test)]
mod semantic_config_tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn semantic_section_round_trips() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let config = VaultConfig {
            semantic: Some(SemanticConfig {
                provider: "ollama".into(),
                base_url: Some("http://localhost:11434".into()),
                model: Some("nomic-embed-text".into()),
                dimension: Some(768),
            }),
            ..VaultConfig::default()
        };
        save_vault_config(dir.path(), &config)?;
        let loaded = load_vault_config(dir.path())?;
        let semantic = loaded.semantic.expect("semantic section");
        assert_eq!(semantic.provider, "ollama");
        assert_eq!(semantic.base_url.as_deref(), Some("http://localhost:11434"));
        assert_eq!(semantic.model.as_deref(), Some("nomic-embed-text"));
        assert_eq!(semantic.dimension, Some(768));
        Ok(())
    }

    #[test]
    fn semantic_section_is_optional() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let config = VaultConfig::default();
        save_vault_config(dir.path(), &config)?;
        let loaded = load_vault_config(dir.path())?;
        assert!(loaded.semantic.is_none());
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TrustedBinaries {
    #[serde(default)]
    pub pandoc_hash: Option<String>,
    #[serde(default)]
    pub pdf2zh_hash: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct CanvasConfig {
    #[serde(default)]
    pub crdt_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DailyNotePlan {
    pub path: String,
    pub title: String,
    pub markdown: String,
}

fn default_daily_directory() -> String {
    "daily".into()
}

fn default_daily_filename() -> String {
    "{iso}".into()
}

fn default_daily_title() -> String {
    "{iso}".into()
}

fn default_templates_directory() -> String {
    ".scriptor/templates".into()
}

fn default_bibliography_path() -> String {
    "references.bib".into()
}

fn default_csl_style_path() -> String {
    "apa-lite.csl".into()
}

fn default_daily_word_target() -> u32 {
    500
}

impl Default for WritingTargetsConfig {
    fn default() -> Self {
        Self {
            daily_words: default_daily_word_target(),
            history_path: Some(".scriptor/stats-history.json".into()),
        }
    }
}

impl Default for ExportConfig {
    fn default() -> Self {
        Self {
            bibliography_path: default_bibliography_path(),
            csl_style_path: default_csl_style_path(),
            export_on_save: ExportOnSaveConfig::default(),
        }
    }
}

impl Default for DailyNoteConfig {
    fn default() -> Self {
        Self {
            directory: default_daily_directory(),
            filename_format: default_daily_filename(),
            title_format: default_daily_title(),
            template_path: None,
        }
    }
}

impl Default for VaultConfig {
    fn default() -> Self {
        Self {
            daily_note: DailyNoteConfig::default(),
            templates_directory: default_templates_directory(),
            export: ExportConfig::default(),
            writing_targets: WritingTargetsConfig::default(),
            graph_groups: Vec::new(),
            extra_roots: Vec::new(),
            canvas: CanvasConfig::default(),
            mcp: McpVaultConfig::default(),
            inbox: InboxConfig::default(),
            workflow: WorkflowConfig::default(),
            note_types: NoteTypesConfig::default(),
            saved_views: Vec::new(),
            trusted_binaries: None,
            latex: None,
            calendar_sync: None,
            autosuggest: None,
            custom_callouts: Vec::new(),
            reading_list: None,
            accessibility: None,
            features: None,
            semantic: None,
        }
    }
}

pub fn config_path(vault_root: &Path) -> std::path::PathBuf {
    vault_root.join(".scriptor").join("config.json")
}

pub fn load_vault_config(vault_root: &Path) -> Result<VaultConfig, VaultError> {
    let path = config_path(vault_root);
    if !path.exists() {
        return Ok(VaultConfig::default());
    }

    let raw = fs::read_to_string(&path).map_err(|source| VaultError::io(&path, source))?;
    let config = serde_json::from_str(&raw).map_err(|error| VaultError::InvalidConfig {
        message: error.to_string(),
    })?;
    Ok(config)
}

pub fn save_vault_config(vault_root: &Path, config: &VaultConfig) -> Result<(), VaultError> {
    let dir = vault_root.join(".scriptor");
    fs::create_dir_all(&dir).map_err(|source| VaultError::io(&dir, source))?;
    let path = config_path(vault_root);
    let payload = serde_json::to_string_pretty(config)?;
    atomic_write(&path, payload.as_bytes())?;
    Ok(())
}

pub fn plan_daily_note(
    vault_root: &Path,
    date: Option<NaiveDate>,
) -> Result<DailyNotePlan, VaultError> {
    let config = load_vault_config(vault_root)?;
    let date = date.unwrap_or_else(|| Local::now().date_naive());
    let stem = apply_date_tokens(&config.daily_note.filename_format, date);
    let title = apply_date_tokens(&config.daily_note.title_format, date);
    let path = format!(
        "{}/{}.md",
        config.daily_note.directory.trim_end_matches('/'),
        stem
    );

    let markdown = if let Some(template_rel) = &config.daily_note.template_path {
        match load_vault_template(vault_root, &config.templates_directory, template_rel) {
            Ok(template) => apply_template_tokens(&template, &title, date),
            Err(VaultError::NoteNotFound(_)) => default_daily_markdown(&title),
            Err(error) => return Err(error),
        }
    } else {
        default_daily_markdown(&title)
    };

    Ok(DailyNotePlan {
        path,
        title,
        markdown,
    })
}

pub fn load_vault_template(
    vault_root: &Path,
    templates_directory: &str,
    template_rel: &str,
) -> Result<String, VaultError> {
    let trimmed = template_rel.trim_start_matches('/');
    let raw = if trimmed.contains('/') {
        trimmed.to_string()
    } else {
        let dir = templates_directory.trim_matches('/');
        if dir.is_empty() {
            trimmed.to_string()
        } else {
            format!("{dir}/{trimmed}")
        }
    };
    // Route through the same traversal-rejecting resolution used for note reads:
    // RelativeVaultPath rejects `..`, absolute paths, and backslashes, and
    // resolve_relative additionally guards against symlink escapes.
    let relative = RelativeVaultPath::parse(&raw)?;
    let root = VaultRoot::open(vault_root)?;
    let path = root.resolve_relative(&relative)?;
    if !path.exists() {
        return Err(VaultError::NoteNotFound(relative.to_string()));
    }
    fs::read_to_string(&path).map_err(|source| VaultError::io(&path, source))
}

pub fn build_note_markdown(
    title: &str,
    note_type: Option<&str>,
    template_body: Option<&str>,
) -> String {
    let mut frontmatter = String::from("---\n");
    if let Some(kind) = note_type.filter(|value| !value.is_empty() && *value != "Type") {
        frontmatter.push_str(&format!("type: {kind}\n"));
    }
    frontmatter.push_str("_organized: false\n---\n\n");
    let heading = format!("# {title}\n\n");
    match template_body.filter(|body| !body.trim().is_empty()) {
        Some(body) => format!("{frontmatter}{heading}{body}\n"),
        None => format!("{frontmatter}{heading}"),
    }
}

pub fn preview_daily_tokens(format: &str, date: NaiveDate) -> String {
    apply_date_tokens(format, date)
}

fn apply_date_tokens(format: &str, date: NaiveDate) -> String {
    format
        .replace("{iso}", &date.format("%Y-%m-%d").to_string())
        .replace("{year}", &date.year().to_string())
        .replace("{month}", &format!("{:02}", date.month()))
        .replace("{day}", &format!("{:02}", date.day()))
        .replace("{weekday}", &date.format("%A").to_string())
}

fn apply_template_tokens(template: &str, title: &str, date: NaiveDate) -> String {
    apply_date_tokens(template, date)
        .replace("{title}", title)
        .replace("{{title}}", title)
        .replace("{{date}}", &date.format("%Y-%m-%d").to_string())
}

fn default_daily_markdown(title: &str) -> String {
    format!("# {title}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn default_config_uses_daily_folder() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let plan = plan_daily_note(
            dir.path(),
            Some(NaiveDate::from_ymd_opt(2026, 6, 20).unwrap()),
        )?;
        assert_eq!(plan.path, "daily/2026-06-20.md");
        assert!(plan.markdown.contains("# 2026-06-20"));
        Ok(())
    }

    #[test]
    fn default_export_config_uses_references_bib() {
        let config = VaultConfig::default();
        assert_eq!(config.export.bibliography_path, "references.bib");
        assert_eq!(config.export.csl_style_path, "apa-lite.csl");
    }

    #[test]
    fn load_vault_template_reads_template_inside_vault() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let templates = dir.path().join(".scriptor/templates");
        std::fs::create_dir_all(&templates)?;
        std::fs::write(templates.join("meeting.md"), "# Meeting\n")?;
        std::fs::write(dir.path().join("top-level.md"), "# Top\n")?;

        let body = load_vault_template(dir.path(), ".scriptor/templates", "meeting.md")?;
        assert_eq!(body, "# Meeting\n");
        let body = load_vault_template(dir.path(), ".scriptor/templates", "/meeting.md")?;
        assert_eq!(body, "# Meeting\n");
        let body = load_vault_template(
            dir.path(),
            ".scriptor/templates",
            ".scriptor/templates/meeting.md",
        )?;
        assert_eq!(body, "# Meeting\n");
        Ok(())
    }

    #[test]
    fn load_vault_template_rejects_traversal() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let outside = dir.path().join("secret.txt");
        std::fs::write(&outside, "secret")?;
        let vault = dir.path().join("vault");
        std::fs::create_dir_all(&vault)?;

        assert!(load_vault_template(&vault, ".scriptor/templates", "../secret.txt").is_err());
        assert!(load_vault_template(&vault, ".scriptor/templates", "a/../../secret.txt").is_err());
        assert!(load_vault_template(&vault, ".scriptor/templates", "/../secret.txt").is_err());
        assert!(load_vault_template(&vault, "..", "secret.txt").is_err());
        Ok(())
    }

    #[test]
    fn persisted_config_overrides_daily_path() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let config = VaultConfig {
            daily_note: DailyNoteConfig {
                directory: "journal".into(),
                filename_format: "{year}-{month}-{day}".into(),
                title_format: "Journal {iso}".into(),
                template_path: None,
            },
            ..VaultConfig::default()
        };
        save_vault_config(dir.path(), &config)?;
        let plan = plan_daily_note(
            dir.path(),
            Some(NaiveDate::from_ymd_opt(2026, 1, 5).unwrap()),
        )?;
        assert_eq!(plan.path, "journal/2026-01-05.md");
        assert_eq!(plan.title, "Journal 2026-01-05");
        Ok(())
    }
}
