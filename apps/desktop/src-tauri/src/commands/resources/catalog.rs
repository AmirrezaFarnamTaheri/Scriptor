use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TargetKind {
    Registry,
    Cli,
    Ide,
    Extension,
    Universal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SupportLevel {
    Native,
    Compatible,
    InventoryOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceRootRole {
    Primary,
    Compatibility,
}

impl ResourceRootRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Primary => "primary",
            Self::Compatibility => "compatibility",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResourceRootDefinition {
    pub relative_path: &'static str,
    pub scope: &'static str,
    pub role: ResourceRootRole,
}

#[derive(Debug, Clone)]
pub struct TargetDefinition {
    pub id: &'static str,
    pub label: &'static str,
    pub kind: TargetKind,
    pub support_level: SupportLevel,
    pub executable_candidates: &'static [&'static str],
    pub version_args: &'static [&'static str],
    pub extension_ids: &'static [&'static str],
    pub resource_roots: &'static [ResourceRootDefinition],
    pub capability_note: &'static str,
    pub documentation_url: Option<&'static str>,
}

const fn primary(relative_path: &'static str, scope: &'static str) -> ResourceRootDefinition {
    ResourceRootDefinition {
        relative_path,
        scope,
        role: ResourceRootRole::Primary,
    }
}

const fn compatibility(relative_path: &'static str, scope: &'static str) -> ResourceRootDefinition {
    ResourceRootDefinition {
        relative_path,
        scope,
        role: ResourceRootRole::Compatibility,
    }
}

const EMPTY_ROOTS: &[ResourceRootDefinition] = &[];
const UNIVERSAL_ROOTS: &[ResourceRootDefinition] = &[primary(".agents/skills", "user")];
const CLAUDE_ROOTS: &[ResourceRootDefinition] = &[primary(".claude/skills", "user")];
const CODEX_ROOTS: &[ResourceRootDefinition] = &[primary(".agents/skills", "user")];
const COPILOT_ROOTS: &[ResourceRootDefinition] = &[
    primary(".copilot/skills", "user"),
    compatibility(".claude/skills", "user_compatibility"),
    compatibility(".agents/skills", "user_compatibility"),
];
const CURSOR_ROOTS: &[ResourceRootDefinition] = &[
    primary(".cursor/skills", "user"),
    compatibility(".agents/skills", "user_compatibility"),
    compatibility(".claude/skills", "user_compatibility"),
    compatibility(".codex/skills", "user_legacy_compatibility"),
];
const WINDSURF_ROOTS: &[ResourceRootDefinition] = &[
    primary(".codeium/windsurf/skills", "user"),
    compatibility(".agents/skills", "user_compatibility"),
    compatibility(".claude/skills", "user_optional_compatibility"),
];
const GEMINI_ROOTS: &[ResourceRootDefinition] = &[
    primary(".gemini/skills", "user"),
    compatibility(".agents/skills", "user_alias"),
];
const OPENCODE_ROOTS: &[ResourceRootDefinition] = &[
    primary(".config/opencode/skills", "user"),
    compatibility(".claude/skills", "user_compatibility"),
    compatibility(".agents/skills", "user_compatibility"),
];
const AMP_ROOTS: &[ResourceRootDefinition] = &[
    primary(".config/agents/skills", "user"),
    compatibility(".claude/skills", "user_compatibility"),
];

const NO_EXECUTABLES: &[&str] = &[];
const VERSION_FLAG: &[&str] = &["--version"];
const NO_EXTENSIONS: &[&str] = &[];

pub fn target_catalog() -> Vec<TargetDefinition> {
    vec![
        target(
            "agentstack",
            "AgentStack private registry (beta)",
            TargetKind::Registry,
            SupportLevel::InventoryOnly,
            NO_EXECUTABLES,
            &[],
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "The agentstack.gg registry is a private beta and does not publish a stable local executable or ownership-manifest contract. Scriptor therefore does not guess from the ambiguous `agentstack` command name or write registry state.",
            Some("https://agentstack.gg/access"),
        ),
        target(
            "universal",
            "Universal Agent Skills",
            TargetKind::Universal,
            SupportLevel::Native,
            NO_EXECUTABLES,
            &[],
            NO_EXTENSIONS,
            UNIVERSAL_ROOTS,
            "Vendor-neutral user library at ~/.agents/skills. It is writable without requiring a specific application installation.",
            Some("https://agentskills.io"),
        ),
        target(
            "claude-code",
            "Claude Code",
            TargetKind::Cli,
            SupportLevel::Native,
            &["claude"],
            VERSION_FLAG,
            &["anthropic.claude-code"],
            CLAUDE_ROOTS,
            "Writes global skills to ~/.claude/skills after the Claude executable or official extension is confirmed.",
            Some("https://docs.anthropic.com/en/docs/claude-code"),
        ),
        target(
            "codex",
            "OpenAI Codex",
            TargetKind::Cli,
            SupportLevel::Native,
            &["codex"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            CODEX_ROOTS,
            "Current Codex user skills live in ~/.agents/skills. ~/.codex/config.toml controls enablement but is not a skill directory.",
            Some("https://developers.openai.com/codex/build-skills"),
        ),
        target(
            "vscode",
            "Visual Studio Code",
            TargetKind::Ide,
            SupportLevel::InventoryOnly,
            &["code", "code-insiders"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "The editor installation is inventoried separately. Skill writes require a confirmed GitHub Copilot extension or Copilot CLI target.",
            Some("https://code.visualstudio.com/docs/agent-customization/agent-skills"),
        ),
        target(
            "copilot-chat",
            "GitHub Copilot Chat",
            TargetKind::Extension,
            SupportLevel::Compatible,
            NO_EXECUTABLES,
            &[],
            &["github.copilot-chat", "github.copilot"],
            COPILOT_ROOTS,
            "Writes personal skills to ~/.copilot/skills and inventories the documented ~/.claude/skills and ~/.agents/skills compatibility roots.",
            Some("https://code.visualstudio.com/docs/agent-customization/agent-skills"),
        ),
        target(
            "copilot-cli",
            "GitHub Copilot CLI",
            TargetKind::Cli,
            SupportLevel::Compatible,
            &["copilot", "github-copilot"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            COPILOT_ROOTS,
            "Writes personal skills to ~/.copilot/skills and inventories the documented ~/.agents/skills compatibility root.",
            Some("https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills"),
        ),
        target(
            "cursor",
            "Cursor",
            TargetKind::Ide,
            SupportLevel::Compatible,
            &["cursor", "cursor-agent"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            CURSOR_ROOTS,
            "Writes global skills to ~/.cursor/skills and inventories Cursor's documented Agent Skills compatibility roots.",
            Some("https://cursor.com/docs/skills"),
        ),
        target(
            "windsurf",
            "Windsurf / Devin Desktop Cascade",
            TargetKind::Ide,
            SupportLevel::Compatible,
            &["windsurf"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            WINDSURF_ROOTS,
            "Writes global Cascade skills to ~/.codeium/windsurf/skills and inventories documented cross-agent roots.",
            Some("https://docs.windsurf.com/windsurf/cascade/skills"),
        ),
        target(
            "zed",
            "Zed",
            TargetKind::Ide,
            SupportLevel::Compatible,
            &["zed"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            UNIVERSAL_ROOTS,
            "Zed's global skill root is ~/.agents/skills; project-local skills remain scoped to trusted worktrees.",
            Some("https://zed.dev/docs/ai/skills"),
        ),
        target(
            "jetbrains",
            "JetBrains IDEs / Junie",
            TargetKind::Ide,
            SupportLevel::InventoryOnly,
            &["idea", "pycharm", "webstorm", "rustrover"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Installed IDEs are identified, but no stable cross-product global Agent Skills write contract is assumed.",
            None,
        ),
        target(
            "gemini-cli",
            "Gemini CLI",
            TargetKind::Cli,
            SupportLevel::Compatible,
            &["gemini"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            GEMINI_ROOTS,
            "Writes user skills to ~/.gemini/skills and inventories ~/.agents/skills as the documented alias. The product currently documents an Antigravity transition for some plans.",
            Some("https://geminicli.com/docs/cli/using-agent-skills/"),
        ),
        target(
            "cline",
            "Cline",
            TargetKind::Extension,
            SupportLevel::InventoryOnly,
            NO_EXECUTABLES,
            &[],
            &["saoudrizwan.claude-dev"],
            EMPTY_ROOTS,
            "The exact installed extension is identified; writes remain disabled until a stable first-party Agent Skills contract is verified.",
            None,
        ),
        target(
            "roo-code",
            "Roo Code",
            TargetKind::Extension,
            SupportLevel::InventoryOnly,
            NO_EXECUTABLES,
            &[],
            &["rooveterinaryinc.roo-cline"],
            EMPTY_ROOTS,
            "The exact installed extension is identified; writes remain disabled until a stable first-party Agent Skills contract is verified.",
            None,
        ),
        target(
            "continue",
            "Continue",
            TargetKind::Extension,
            SupportLevel::InventoryOnly,
            NO_EXECUTABLES,
            &[],
            &["continue.continue"],
            EMPTY_ROOTS,
            "The exact installed extension is identified; Scriptor does not translate Agent Skills into Continue-specific configuration implicitly.",
            None,
        ),
        target(
            "opencode",
            "OpenCode",
            TargetKind::Cli,
            SupportLevel::Compatible,
            &["opencode"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            OPENCODE_ROOTS,
            "Writes global skills to ~/.config/opencode/skills and inventories documented Claude- and agent-compatible global roots.",
            Some("https://opencode.ai/docs/skills"),
        ),
        target(
            "aider",
            "Aider",
            TargetKind::Cli,
            SupportLevel::InventoryOnly,
            &["aider"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Executable identity is recorded; no Agent Skills write mapping is inferred from prompt or convention files.",
            None,
        ),
        target(
            "goose",
            "Goose",
            TargetKind::Cli,
            SupportLevel::InventoryOnly,
            &["goose"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Executable identity is recorded; no unverified global skill root is written.",
            None,
        ),
        target(
            "kiro",
            "Kiro",
            TargetKind::Ide,
            SupportLevel::InventoryOnly,
            &["kiro", "kiro-cli"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Application identity is recorded; compatibility files are not treated as a native Agent Skills store.",
            None,
        ),
        target(
            "trae",
            "Trae",
            TargetKind::Ide,
            SupportLevel::InventoryOnly,
            &["trae"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Application and extension metadata are inventoried without assuming a writable Agent Skills location.",
            None,
        ),
        target(
            "antigravity",
            "Antigravity",
            TargetKind::Ide,
            SupportLevel::InventoryOnly,
            &["antigravity"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Detected as a transition target. Writes remain disabled until its first-party skill discovery and migration contract is stable.",
            None,
        ),
        target(
            "amp",
            "Amp",
            TargetKind::Cli,
            SupportLevel::Compatible,
            &["amp"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            AMP_ROOTS,
            "Writes global skills to ~/.config/agents/skills and inventories Amp's documented Claude compatibility root.",
            Some("https://ampcode.com/news/agent-skills"),
        ),
        target(
            "droid",
            "Factory Droid",
            TargetKind::Cli,
            SupportLevel::InventoryOnly,
            &["droid"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Executable identity is recorded; no write root is enabled without a verified first-party contract.",
            None,
        ),
        target(
            "qwen-code",
            "Qwen Code",
            TargetKind::Cli,
            SupportLevel::InventoryOnly,
            &["qwen", "qwen-code"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Executable identity is recorded; no write root is enabled without a verified first-party contract.",
            None,
        ),
        target(
            "amazon-q",
            "Amazon Q Developer CLI",
            TargetKind::Cli,
            SupportLevel::InventoryOnly,
            &["q"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
            "Executable identity is recorded; Agent Skills are not mapped onto Amazon Q configuration implicitly.",
            None,
        ),
    ]
}

#[allow(clippy::too_many_arguments)]
fn target(
    id: &'static str,
    label: &'static str,
    kind: TargetKind,
    support_level: SupportLevel,
    executable_candidates: &'static [&'static str],
    version_args: &'static [&'static str],
    extension_ids: &'static [&'static str],
    resource_roots: &'static [ResourceRootDefinition],
    capability_note: &'static str,
    documentation_url: Option<&'static str>,
) -> TargetDefinition {
    TargetDefinition {
        id,
        label,
        kind,
        support_level,
        executable_candidates,
        version_args,
        extension_ids,
        resource_roots,
        capability_note,
        documentation_url,
    }
}
