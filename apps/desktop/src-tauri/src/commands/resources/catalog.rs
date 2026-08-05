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

#[derive(Debug, Clone)]
pub struct ResourceRootDefinition {
    pub relative_path: &'static str,
    pub scope: &'static str,
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
}

const EMPTY_ROOTS: &[ResourceRootDefinition] = &[];
const UNIVERSAL_ROOTS: &[ResourceRootDefinition] = &[ResourceRootDefinition {
    relative_path: ".agents/skills",
    scope: "user",
}];
const CLAUDE_ROOTS: &[ResourceRootDefinition] = &[ResourceRootDefinition {
    relative_path: ".claude/skills",
    scope: "user",
}];
const CODEX_ROOTS: &[ResourceRootDefinition] = &[ResourceRootDefinition {
    relative_path: ".codex/skills",
    scope: "user",
}];
const COPILOT_ROOTS: &[ResourceRootDefinition] = &[
    ResourceRootDefinition {
        relative_path: ".copilot/skills",
        scope: "user",
    },
    ResourceRootDefinition {
        relative_path: ".claude/skills",
        scope: "user_compatibility",
    },
    ResourceRootDefinition {
        relative_path: ".agents/skills",
        scope: "user_compatibility",
    },
];
const WINDSURF_ROOTS: &[ResourceRootDefinition] = &[
    ResourceRootDefinition {
        relative_path: ".codeium/windsurf/skills",
        scope: "user",
    },
    ResourceRootDefinition {
        relative_path: ".agents/skills",
        scope: "user_compatibility",
    },
    ResourceRootDefinition {
        relative_path: ".claude/skills",
        scope: "user_compatibility",
    },
];
const GEMINI_ROOTS: &[ResourceRootDefinition] = &[ResourceRootDefinition {
    relative_path: ".gemini/skills",
    scope: "user",
}];
const OPENCODE_ROOTS: &[ResourceRootDefinition] = &[
    ResourceRootDefinition {
        relative_path: ".config/opencode/skills",
        scope: "user",
    },
    ResourceRootDefinition {
        relative_path: ".agents/skills",
        scope: "user_compatibility",
    },
    ResourceRootDefinition {
        relative_path: ".claude/skills",
        scope: "user_compatibility",
    },
];

const NO_EXECUTABLES: &[&str] = &[];
const VERSION_FLAG: &[&str] = &["--version"];
const NO_EXTENSIONS: &[&str] = &[];

pub fn target_catalog() -> Vec<TargetDefinition> {
    vec![
        target(
            "agentstack",
            "AgentStack registry",
            TargetKind::Registry,
            SupportLevel::Native,
            &["agentstack"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
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
        ),
        target(
            "vscode",
            "Visual Studio Code",
            TargetKind::Ide,
            SupportLevel::Compatible,
            &["code", "code-insiders"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            COPILOT_ROOTS,
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
        ),
        target(
            "cursor",
            "Cursor",
            TargetKind::Ide,
            SupportLevel::InventoryOnly,
            &["cursor", "cursor-agent"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
        ),
        target(
            "windsurf",
            "Windsurf",
            TargetKind::Ide,
            SupportLevel::Compatible,
            &["windsurf"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            WINDSURF_ROOTS,
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
        ),
        target(
            "amp",
            "Amp",
            TargetKind::Cli,
            SupportLevel::InventoryOnly,
            &["amp"],
            VERSION_FLAG,
            NO_EXTENSIONS,
            EMPTY_ROOTS,
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
    }
}
