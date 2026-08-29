// GENERATED from contracts/operations.json. Do not edit by hand.
export const OPERATION_CATALOG = {
  "schema": "scriptor.operation-catalog.v1",
  "schemaVersion": 1,
  "boundaryOutcomes": {
    "value": "Operation completed with authoritative value.",
    "absent-optional": "Optional state is absent and may map to an explicit default/empty value.",
    "invalid": "Input or persisted state is malformed; return a typed error and never silently default.",
    "degraded": "Operation returned useful partial state with explicit warnings.",
    "failed": "Operation failed with a structured code/message/recoverability contract.",
    "recovered": "Operation completed after recovery and emits a recovery receipt."
  },
  "operations": [
    {
      "name": "cli.Backlinks",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Backlinks",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.BenchCanvasHitTest",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::BenchCanvasHitTest",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.BenchCanvasSnapshot",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::BenchCanvasSnapshot",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.BenchScan",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::BenchScan",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.BenchSearch",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::BenchSearch",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.CanvasHitTest",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::CanvasHitTest",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.CanvasListDocuments",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::CanvasListDocuments",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.CanvasLoadDocument",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::CanvasLoadDocument",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.CanvasQuery",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::CanvasQuery",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.CanvasSaveDocument",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::CanvasSaveDocument",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.CanvasSnapshot",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::CanvasSnapshot",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.CanvasTemplateDryRun",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::CanvasTemplateDryRun",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.CanvasTemplates",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::CanvasTemplates",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Clip",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Clip",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Completions",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Completions",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Daemon",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Daemon",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Doctor",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Doctor",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Export",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Export",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.ExportDiscover",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::ExportDiscover",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.GenerateVault",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::GenerateVault",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.GitCommit",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::GitCommit",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.GitPull",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::GitPull",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.GitPush",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::GitPush",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.GitResolveConflict",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::GitResolveConflict",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.GitStatus",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::GitStatus",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Graph",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Graph",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Grep",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Grep",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Health",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Health",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.HealthDiagnostics",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::HealthDiagnostics",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Lint",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Lint",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Note",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Note",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Open",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Open",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Outline",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Outline",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.PdfTranslate",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::PdfTranslate",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Publish",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Publish",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Read",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Read",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.RebuildIndex",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::RebuildIndex",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.RenameApply",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::RenameApply",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.RenameDryRun",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::RenameDryRun",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Scan",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Scan",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Search",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Search",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.SystemInfo",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::SystemInfo",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.TextBundleExport",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::TextBundleExport",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.TraverseGraph",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::TraverseGraph",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "cli.Tui",
      "surface": "cli",
      "owner": "crates/cli/src/command_line.rs",
      "authorizationClass": "local-user",
      "mutationClass": "command-defined",
      "scope": null,
      "schemaKind": "clap-rust",
      "inputType": "Commands::Tui",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.Backlinks",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::Backlinks",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.ExportCancel",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ExportCancel",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.ExportJobStatus",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ExportJobStatus",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.ExportRunMarkdown",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ExportRunMarkdown",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.ExportRunNote",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ExportRunNote",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.ExportStartMarkdown",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ExportStartMarkdown",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.ExportStartNote",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ExportStartNote",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.GitStatus",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::GitStatus",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.GraphSummary",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::GraphSummary",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.HealthDiagnostics",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::HealthDiagnostics",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.HealthReport",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::HealthReport",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.IndexRebuildStatus",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::IndexRebuildStatus",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.Invoke",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "capability-filtered",
      "mutationClass": "privileged-dispatch",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::Invoke",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.ListCommands",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ListCommands",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.ListNotes",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ListNotes",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.OpenVault",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::OpenVault",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.Ping",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::Ping",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.ReadNote",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ReadNote",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.RebuildIndex",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::RebuildIndex",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.ReloadConfig",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::ReloadConfig",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.RenameNoteApply",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::RenameNoteApply",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.SaveNote",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::SaveNote",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.SearchNotes",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "read-only",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::SearchNotes",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "rpc.SubscribeEvents",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::SubscribeEvents",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "rpc.UpdateNoteIndex",
      "surface": "daemon-rpc",
      "owner": "crates/ipc/src/lib.rs",
      "authorizationClass": "local-ipc",
      "mutationClass": "local-mutation",
      "scope": null,
      "schemaKind": "typed-rust",
      "inputType": "RpcMethod::UpdateNoteIndex",
      "maxInputBytes": 2097152,
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "mcp.createNote",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "draft",
      "mutationClass": "draft-proposal",
      "scope": "note.create",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "markdown": {
            "type": "string",
            "maxLength": 2097152
          },
          "summary": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          }
        },
        "required": [
          "path",
          "markdown",
          "summary"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "invalid",
        "failed"
      ]
    },
    {
      "name": "mcp.deleteNote",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "draft",
      "mutationClass": "draft-proposal",
      "scope": "note.delete",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "summary": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          }
        },
        "required": [
          "path",
          "summary"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "invalid",
        "failed"
      ]
    },
    {
      "name": "mcp.exportGraph",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "graph.query",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "focusPath": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "depth": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3
          }
        },
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.getGraphNeighbors",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "graph.neighbors",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "depth": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3
          }
        },
        "required": [
          "path"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.inspectBacklinks",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "graph.backlinks",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          }
        },
        "required": [
          "path"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.inspectBrokenLinks",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "vault.health",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.inspectExportProfiles",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "export.run",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.inspectGraphSummary",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "graph.summary",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.inspectOutline",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "note.read",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          }
        },
        "required": [
          "path"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.listTags",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "indexer.listTags",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "prefix": {
            "type": "string",
            "maxLength": 200
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10000
          }
        },
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.listTasks",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "indexer.listTasks",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "status": {
            "type": "string",
            "enum": [
              "open",
              "done",
              "all"
            ]
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10000
          }
        },
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.moveNote",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "draft",
      "mutationClass": "draft-proposal",
      "scope": "note.rename",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "from": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "to": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "summary": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "updateLinks": {
            "type": "boolean"
          }
        },
        "required": [
          "from",
          "to",
          "summary"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "invalid",
        "failed"
      ]
    },
    {
      "name": "mcp.proposePatch",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "draft",
      "mutationClass": "draft-proposal",
      "scope": "mcp.proposePatch",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "proposedMarkdown": {
            "type": "string",
            "maxLength": 2097152
          },
          "summary": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "baseContentHash": {
            "type": "string",
            "maxLength": 256
          }
        },
        "required": [
          "path",
          "proposedMarkdown",
          "summary"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "invalid",
        "failed"
      ]
    },
    {
      "name": "mcp.proposeTagPatch",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "draft",
      "mutationClass": "draft-proposal",
      "scope": "mcp.proposeTagPatch",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "add": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 200
            },
            "maxItems": 100
          },
          "remove": {
            "type": "array",
            "items": {
              "type": "string",
              "maxLength": 200
            },
            "maxItems": 100
          },
          "summary": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2000
          },
          "baseContentHash": {
            "type": "string",
            "maxLength": 256
          }
        },
        "required": [
          "path",
          "summary"
        ],
        "additionalProperties": false,
        "anyOf": [
          {
            "required": [
              "add"
            ]
          },
          {
            "required": [
              "remove"
            ]
          }
        ]
      },
      "outcomePolicy": [
        "value",
        "invalid",
        "failed"
      ]
    },
    {
      "name": "mcp.readNote",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "note.read",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          }
        },
        "required": [
          "path"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.renderMarkdown",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "export.render",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "markdown": {
            "type": "string",
            "maxLength": 2097152
          },
          "theme": {
            "type": "string",
            "enum": [
              "default",
              "grace"
            ]
          }
        },
        "required": [
          "markdown"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.resolveCitation",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "indexer.resolveCitation",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          }
        },
        "required": [
          "key"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.search",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "mcp.search",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 500
          }
        },
        "required": [
          "query"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.searchByTag",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "indexer.notesForTag",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "tag": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10000
          }
        },
        "required": [
          "tag"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.semanticSearch",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "indexer.semanticSearch",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "minLength": 1,
            "maxLength": 1000
          },
          "limit": {
            "type": "integer",
            "minimum": 1,
            "maximum": 500
          }
        },
        "required": [
          "query"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.traverseGraph",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "graph.traverse",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {
          "focusPath": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          },
          "depth": {
            "type": "integer",
            "minimum": 1,
            "maximum": 5
          }
        },
        "required": [
          "focusPath"
        ],
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "mcp.vaultHealth",
      "surface": "mcp",
      "owner": "packages/mcp/src/tool-contracts.ts",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": "vault.health",
      "schemaKind": "json-schema",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "ai_provider_delete_api_key",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "keychain_delete",
      "authorizationVariant": "KeychainDelete",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "ai_provider_has_api_key",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "ai_provider_propose_draft",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "ai_network_request",
      "authorizationVariant": "AiNetworkRequest",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "ai_provider_set_api_key",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "keychain_write",
      "authorizationVariant": "KeychainWrite",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "authorize_sensitive_operation",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/authorization.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "canvas_apply_template",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "canvas_hit_test",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "canvas_list_documents",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "canvas_list_templates",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "canvas_load_document",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "canvas_query_blocks",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "canvas_render_svg",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "canvas_restore_template",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "canvas_save_document",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "canvas_snapshot",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "canvas_template_dry_run",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/canvas.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "code_chunk_run",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/code_chunk.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "code_execution",
      "authorizationVariant": "CodeExecution",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "copy_text_to_clipboard",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_backlinks",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_endpoint",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_export_cancel",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_export_job_status",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_export_run_markdown",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_export_run_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_export_start_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_git_status",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_graph",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_health_diagnostics",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_health_report",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_list_note_summaries",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_open_vault",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_ping",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_rebuild_index",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_reload_config",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_rename_apply",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_save_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_search",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "daemon_start",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "daemon_control",
      "authorizationVariant": "DaemonControl",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "daemon_update_note_index",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/daemon.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "diagnostics_append_event",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "diagnostics_export_support_bundle",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "export_cancel",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/export.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "export_discover",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/export.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "export_run_markdown",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/export.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "export_run_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/export.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "export_start_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/export.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "git_apply_merged_conflict_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "apply_git_conflict",
      "authorizationVariant": "ApplyGitConflict",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "git_commit_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "git_pull_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "git_pull",
      "authorizationVariant": "GitPull",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "git_push_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "git_push",
      "authorizationVariant": "GitPush",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "git_read_conflict_markers_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "git_resolve_conflict_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "apply_git_conflict",
      "authorizationVariant": "ApplyGitConflict",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "git_show_head_file_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "git_show_merge_base_file_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "git_status_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/git.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "google_calendar_complete_task",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_task_write",
      "authorizationVariant": "GoogleTaskWrite",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_calendar_create_task",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_task_write",
      "authorizationVariant": "GoogleTaskWrite",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_calendar_delete_task",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_task_write",
      "authorizationVariant": "GoogleTaskWrite",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_calendar_disconnect",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_calendar_disconnect",
      "authorizationVariant": "GoogleCalendarDisconnect",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_calendar_get_authed_email",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "google_calendar_list_events",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "google_calendar_list_tasks",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "google_calendar_start_auth",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_calendar_auth",
      "authorizationVariant": "GoogleCalendarAuth",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_gmail_get_message",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "google_gmail_disconnect",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_gmail_disconnect",
      "authorizationVariant": "GoogleGmailDisconnect",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_gmail_list_messages",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "google_gmail_modify_message",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_gmail_write",
      "authorizationVariant": "GoogleGmailWrite",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_gmail_send_message",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_gmail_send",
      "authorizationVariant": "GoogleGmailSend",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_gmail_start_auth",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_gmail_auth",
      "authorizationVariant": "GoogleGmailAuth",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "google_gmail_trash_message",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/google_calendar.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "google_gmail_write",
      "authorizationVariant": "GoogleGmailWrite",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "health_check",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_apply_filesystem_changes",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "indexer_backlinks",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_batch_note_meta",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_evaluate_view",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_execute_dql",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_graph",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_health_diagnostics",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_kanban_board",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_kanban_move_card",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "indexer_list_bibliography",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_list_dead_ends",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_list_inbox",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_list_note_summaries",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_list_orphans",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_list_recent_files",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_list_tags",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_list_unresolved_targets",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_notes_for_tag",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_query_tasks",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_rebuild",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "indexer_record_recent_access",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "indexer_resolve_wikilink",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_search",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_sync_note_tasks",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "indexer_traverse_graph",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "indexer_update_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "indexer_update_task",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/indexer.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "latex_cancel_compile",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/latex.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "latex_compile",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/latex.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "latex_compilation",
      "authorizationVariant": "LatexCompilation",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "latex_discover_tectonic",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/latex.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "pdf_translate",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/export.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "pdf_translation",
      "authorizationVariant": "PdfTranslation",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "plantuml_render",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "plant_uml_execution",
      "authorizationVariant": "PlantUmlExecution",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "plugin_state_get",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/plugin_state.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "plugin_state_set_enabled",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/plugin_state.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "reader_load_annotations",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/reader.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "reader_read_document",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/reader.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "reader_save_annotations",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/reader.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "resource_apply_plan",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/resources/mod.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "resource_sync",
      "authorizationVariant": "ResourceSync",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "resource_create_dedup_plan",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/resources/mod.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "resource_create_plan",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/resources/mod.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "resource_inventory",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/resources/mod.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "set_headless_engine",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "system_info",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/system.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_append_activity_log",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_append_stats_history",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_build_note_markdown",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_create_backup",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/backup.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "create_backup",
      "authorizationVariant": "CreateBackup",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_delete_backup",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/backup.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "delete_backup",
      "authorizationVariant": "DeleteBackup",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_delete_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "delete_note",
      "authorizationVariant": "DeleteNote",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_detect_obsidian",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_export_audit_log",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_frontmatter_set",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_health",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_import_obsidian",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "import_vault",
      "authorizationVariant": "ImportVault",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_lint_fix",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "apply_bulk_fix",
      "authorizationVariant": "ApplyBulkFix",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_list_backups",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/backup.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_list_note_history",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_list_recent_notes",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_list_view_notes",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_load_config",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_load_snippets",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_load_template",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_open",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_plan_daily_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_publish_apply_starlight",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/publish.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "publish_site",
      "authorizationVariant": "PublishSite",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_publish_plan_starlight",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/publish.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_read_activity_log",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_read_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_read_note_history_revision",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_read_stats_history",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_read_workspace_session",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_record_recent_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_rename_apply",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_rename_block_apply",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_rename_block_dry_run",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_rename_dry_run",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_rename_section_apply",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_rename_section_dry_run",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_rename_tag_apply",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_rename_tag_dry_run",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_restore_backup",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/backup.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "restore_backup",
      "authorizationVariant": "RestoreBackup",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_restore_note_history_revision",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/history.rs",
      "authorizationClass": "brokered-sensitive",
      "mutationClass": "sensitive-mutation",
      "scope": "restore_history",
      "authorizationVariant": "RestoreHistory",
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_save_asset",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_save_config_cmd",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_save_note",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_save_snippets",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_save_workspace_session",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    },
    {
      "name": "vault_scan",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "read-only",
      "mutationClass": "read-only",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "degraded",
        "failed"
      ]
    },
    {
      "name": "vault_textbundle_export",
      "surface": "tauri",
      "owner": "apps/desktop/src-tauri/src/commands/vault.rs",
      "authorizationClass": "local-mutation",
      "mutationClass": "local-mutation",
      "scope": null,
      "authorizationVariant": null,
      "schemaKind": "native-rust",
      "outcomePolicy": [
        "value",
        "absent-optional",
        "invalid",
        "degraded",
        "failed",
        "recovered"
      ]
    }
  ],
  "protocols": {
    "mcp": {
      "canonicalSurface": "packages/mcp TypeScript stdio server",
      "currentSpecVersion": "2026-07-28",
      "implementedWireVersions": [
        "2025-03-26",
        "2024-11-05"
      ]
    },
    "trustedAutomationStdio": {
      "canonicalSurface": "crates/daemon automation-stdio",
      "maxInputBytes": 4194304,
      "isMcp": false
    }
  }
} as const

export type OperationCatalog = typeof OPERATION_CATALOG
export type OperationCatalogEntry = OperationCatalog['operations'][number]
export type OperationSurface = OperationCatalogEntry['surface']
export type BoundaryOutcomeStatus = keyof OperationCatalog['boundaryOutcomes']
