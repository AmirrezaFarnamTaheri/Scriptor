use std::fs;
use std::path::Path;

use chrono::{Datelike, Local, NaiveDate};
use serde::{Deserialize, Serialize};

use crate::error::VaultError;

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkflowConfig {
    #[serde(default)]
    pub auto_advance_inbox_after_organize: bool,
}

impl Default for WorkflowConfig {
    fn default() -> Self {
        Self {
            auto_advance_inbox_after_organize: false,
        }
    }
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CanvasConfig {
    #[serde(default)]
    pub crdt_enabled: bool,
}

impl Default for CanvasConfig {
    fn default() -> Self {
        Self { crdt_enabled: false }
    }
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

impl Default for ExportOnSaveConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            profile_id: None,
        }
    }
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
    fs::write(&path, payload).map_err(|source| VaultError::io(&path, source))?;
    Ok(())
}

pub fn plan_daily_note(vault_root: &Path, date: Option<NaiveDate>) -> Result<DailyNotePlan, VaultError> {
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
        let template_path = vault_root.join(template_rel);
        if template_path.exists() {
            let template = fs::read_to_string(&template_path)
                .map_err(|source| VaultError::io(&template_path, source))?;
            apply_template_tokens(&template, &title, date)
        } else {
            default_daily_markdown(&title)
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

pub fn load_vault_template(vault_root: &Path, templates_directory: &str, template_rel: &str) -> Result<String, VaultError> {
    let relative = template_rel.trim_start_matches('/');
    let path = if relative.contains('/') {
        vault_root.join(relative)
    } else {
        vault_root.join(templates_directory.trim_end_matches('/')).join(relative)
    };
    if !path.exists() {
        return Err(VaultError::NoteNotFound(path.display().to_string()));
    }
    fs::read_to_string(&path).map_err(|source| VaultError::io(&path, source))
}

pub fn build_note_markdown(title: &str, note_type: Option<&str>, template_body: Option<&str>) -> String {
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
        let plan = plan_daily_note(dir.path(), Some(NaiveDate::from_ymd_opt(2026, 6, 20).unwrap()))?;
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
        let plan = plan_daily_note(dir.path(), Some(NaiveDate::from_ymd_opt(2026, 1, 5).unwrap()))?;
        assert_eq!(plan.path, "journal/2026-01-05.md");
        assert_eq!(plan.title, "Journal 2026-01-05");
        Ok(())
    }
}
