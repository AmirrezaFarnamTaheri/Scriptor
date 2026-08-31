import {
  expectArray,
  expectBoolean,
  expectNumber,
  expectRecord,
  expectString,
  expectStringArray,
  parseArrayOf,
  parseJsonUnknown,
} from '../lib/runtimeSchema'
import type {
  BacklinkHit,
  ExportJobOutput,
  GraphQueryOutput,
  NoteIndexSummary,
  RebuildSummary,
  RenameNoteApplyOutput,
  SaveNoteOutput,
  SearchHit,
  VaultConfig,
  VaultHealthDiagnostics,
  VaultHealthReport,
} from './vault'

function parseHealthRecord(value: unknown, context: string): VaultHealthReport {
  const record = expectRecord(value, context)
  const cacheStatus = expectString(record, 'cache_status', context)
  if (!['fresh', 'stale', 'rebuilding'].includes(cacheStatus)) {
    throw new Error(`${context}.cache_status: unsupported value`)
  }
  return {
    vault_id: expectString(record, 'vault_id', context),
    broken_links: expectNumber(record, 'broken_links', context),
    orphan_assets: expectNumber(record, 'orphan_assets', context),
    duplicate_titles: expectNumber(record, 'duplicate_titles', context),
    invalid_frontmatter: expectNumber(record, 'invalid_frontmatter', context),
    unresolved_citations: expectNumber(record, 'unresolved_citations', context),
    indexed_notes: expectNumber(record, 'indexed_notes', context),
    total_words: expectNumber(record, 'total_words', context),
    slow_exports: expectNumber(record, 'slow_exports', context),
    cache_status: cacheStatus as VaultHealthReport['cache_status'],
  }
}

export function parseVaultHealthReport(payload: string, context = 'vault health'): VaultHealthReport {
  return parseHealthRecord(parseJsonUnknown(payload, context), context)
}

export function parseVaultHealthDiagnostics(payload: string): VaultHealthDiagnostics {
  const context = 'vault diagnostics'
  const record = expectRecord(parseJsonUnknown(payload, context), context)
  const issues = expectArray(record.issues, `${context}.issues`).map((value, index) => {
    const issueContext = `${context}.issues[${index}]`
    const issue = expectRecord(value, issueContext)
    const line = issue.line
    if (line !== null && (typeof line !== 'number' || !Number.isFinite(line))) {
      throw new Error(`${issueContext}.line: expected number or null`)
    }
    return {
      kind: expectString(issue, 'kind', issueContext),
      path: expectString(issue, 'path', issueContext),
      detail: expectString(issue, 'detail', issueContext),
      line: line as number | null,
    }
  })
  return { summary: parseHealthRecord(record.summary, `${context}.summary`), issues }
}

export function parseRebuildSummary(payload: string): RebuildSummary {
  const context = 'rebuild summary'
  const record = expectRecord(parseJsonUnknown(payload, context), context)
  return {
    indexed_notes: expectNumber(record, 'indexed_notes', context),
    skipped_notes: expectNumber(record, 'skipped_notes', context),
    links_written: expectNumber(record, 'links_written', context),
    cache_status: parseHealthRecord(record.health, `${context}.health`).cache_status,
    health: parseHealthRecord(record.health, `${context}.health`),
  }
}

export function parseSearchHits(payload: string): SearchHit[] {
  return parseArrayOf(payload, 'search hits', (value, context) => {
    const record = expectRecord(value, context)
    return {
      note_id: expectString(record, 'note_id', context),
      path: expectString(record, 'path', context),
      title: expectString(record, 'title', context),
      snippet: expectString(record, 'snippet', context),
    }
  })
}

export function parseNoteIndexSummaries(payload: string): NoteIndexSummary[] {
  return parseArrayOf(payload, 'note summaries', (value, context) => {
    const record = expectRecord(value, context)
    const noteType = record.note_type
    if (noteType !== null && typeof noteType !== 'string') {
      throw new Error(`${context}.note_type: expected string or null`)
    }
    return {
      path: expectString(record, 'path', context),
      title: expectString(record, 'title', context),
      modified_at: expectString(record, 'modified_at', context),
      note_type: noteType as string | null,
      organized: expectBoolean(record, 'organized', context),
      archived: expectBoolean(record, 'archived', context),
      tags: expectStringArray(record.tags, `${context}.tags`),
    }
  })
}

export function parseBacklinkHits(payload: string): BacklinkHit[] {
  return parseArrayOf(payload, 'backlinks', (value, context) => {
    const record = expectRecord(value, context)
    return {
      from_path: expectString(record, 'from_path', context),
      from_title: expectString(record, 'from_title', context),
      label: expectString(record, 'label', context),
      kind: expectString(record, 'kind', context),
      line: expectNumber(record, 'line', context),
    }
  })
}

export function parseGraphQueryOutput(payload: string): GraphQueryOutput {
  const context = 'graph query'
  const record = expectRecord(parseJsonUnknown(payload, context), context)
  const nodes = expectArray(record.nodes, `${context}.nodes`).map((value, index) => {
    const nodeContext = `${context}.nodes[${index}]`
    const node = expectRecord(value, nodeContext)
    return {
      id: expectString(node, 'id', nodeContext),
      path: expectString(node, 'path', nodeContext),
      label: expectString(node, 'label', nodeContext),
      unresolved: expectBoolean(node, 'unresolved', nodeContext),
      ...(typeof node.color === 'string' ? { color: node.color } : {}),
    }
  })
  const edges = expectArray(record.edges, `${context}.edges`).map((value, index) => {
    const edgeContext = `${context}.edges[${index}]`
    const edge = expectRecord(value, edgeContext)
    return {
      id: expectString(edge, 'id', edgeContext),
      source: expectString(edge, 'source', edgeContext),
      target: expectString(edge, 'target', edgeContext),
      kind: expectString(edge, 'kind', edgeContext),
    }
  })
  return { nodes, edges }
}

export function parseSaveNoteOutput(payload: string): SaveNoteOutput {
  const context = 'save note output'
  const record = expectRecord(parseJsonUnknown(payload, context), context)
  const metadata = expectRecord(record.metadata, `${context}.metadata`)
  return {
    metadata: {
      id: expectString(metadata, 'id', `${context}.metadata`),
      vault_id: expectString(metadata, 'vault_id', `${context}.metadata`),
      path: expectString(metadata, 'path', `${context}.metadata`),
      title: expectString(metadata, 'title', `${context}.metadata`),
      content_hash: expectString(metadata, 'content_hash', `${context}.metadata`),
      modified_at: expectString(metadata, 'modified_at', `${context}.metadata`),
      word_count: expectNumber(metadata, 'word_count', `${context}.metadata`),
      reading_time_minutes: expectNumber(metadata, 'reading_time_minutes', `${context}.metadata`),
      tags: expectStringArray(metadata.tags, `${context}.metadata.tags`),
    },
    ...(typeof record.previous_content_hash === 'string'
      ? { previous_content_hash: record.previous_content_hash }
      : {}),
    dry_run: expectBoolean(record, 'dry_run', context),
  }
}

export function parseRenameNoteApplyOutput(payload: string): RenameNoteApplyOutput {
  const context = 'rename note output'
  const record = expectRecord(parseJsonUnknown(payload, context), context)
  return {
    from_path: expectString(record, 'from_path', context),
    to_path: expectString(record, 'to_path', context),
    affected_files: expectStringArray(record.affected_files, `${context}.affected_files`),
    link_edits: expectNumber(record, 'link_edits', context),
  }
}

export function parseExportJobOutput(payload: string): ExportJobOutput {
  const context = 'export output'
  const record = expectRecord(parseJsonUnknown(payload, context), context)
  const command = expectStringArray(record.command, `${context}.command`)
  return {
    job_id: expectString(record, 'job_id', context),
    format: expectString(record, 'format', context),
    artifact_path: expectString(record, 'artifact_path', context),
    command,
    stdout: expectString(record, 'stdout', context),
    stderr: expectString(record, 'stderr', context),
    duration_ms: expectNumber(record, 'duration_ms', context),
    dry_run: expectBoolean(record, 'dry_run', context),
  }
}

export function parseVaultConfig(payload: string): VaultConfig {
  const context = 'vault config'
  const record = expectRecord(parseJsonUnknown(payload, context), context)
  const daily = expectRecord(record.daily_note, `${context}.daily_note`)
  const exportConfig = expectRecord(record.export, `${context}.export`)

  const config: VaultConfig = {
    daily_note: {
      directory: expectString(daily, 'directory', `${context}.daily_note`),
      filename_format: expectString(daily, 'filename_format', `${context}.daily_note`),
      title_format: expectString(daily, 'title_format', `${context}.daily_note`),
      template_path: optionalNullableString(daily.template_path, `${context}.daily_note.template_path`),
    },
    templates_directory: expectString(record, 'templates_directory', context),
    export: {
      bibliography_path: expectString(exportConfig, 'bibliography_path', `${context}.export`),
      csl_style_path: expectString(exportConfig, 'csl_style_path', `${context}.export`),
    },
  }

  if (record.inbox !== undefined) {
    const inbox = expectRecord(record.inbox, `${context}.inbox`)
    const period = expectString(inbox, 'period', `${context}.inbox`)
    if (!['week', 'month', 'quarter', 'all'].includes(period)) {
      throw new Error(`${context}.inbox.period: unsupported value`)
    }
    config.inbox = {
      enabled: expectBoolean(inbox, 'enabled', `${context}.inbox`),
      period: period as NonNullable<VaultConfig['inbox']>['period'],
      new_note_directory: optionalNullableString(
        inbox.new_note_directory,
        `${context}.inbox.new_note_directory`,
      ),
    }
  }

  if (record.workflow !== undefined) {
    const workflow = expectRecord(record.workflow, `${context}.workflow`)
    config.workflow = {
      auto_advance_inbox_after_organize: expectBoolean(
        workflow,
        'auto_advance_inbox_after_organize',
        `${context}.workflow`,
      ),
    }
  }

  if (record.note_types !== undefined) {
    const noteTypes = expectRecord(record.note_types, `${context}.note_types`)
    config.note_types = { directory: expectString(noteTypes, 'directory', `${context}.note_types`) }
  }

  if (exportConfig.export_on_save !== undefined) {
    const exportOnSave = expectRecord(exportConfig.export_on_save, `${context}.export.export_on_save`)
    config.export.export_on_save = {
      enabled: expectBoolean(exportOnSave, 'enabled', `${context}.export.export_on_save`),
      profile_id: optionalNullableString(
        exportOnSave.profile_id,
        `${context}.export.export_on_save.profile_id`,
      ),
    }
  }

  if (record.writing_targets !== undefined) {
    const writingTargets = expectRecord(record.writing_targets, `${context}.writing_targets`)
    config.writing_targets = {
      daily_words: expectNumber(writingTargets, 'daily_words', `${context}.writing_targets`),
      history_path: optionalNullableString(
        writingTargets.history_path,
        `${context}.writing_targets.history_path`,
      ),
    }
  }

  if (record.graph_groups !== undefined) {
    config.graph_groups = expectArray(record.graph_groups, `${context}.graph_groups`).map((value, index) => {
      const groupContext = `${context}.graph_groups[${index}]`
      const group = expectRecord(value, groupContext)
      return {
        tag_prefix: expectString(group, 'tag_prefix', groupContext),
        color: expectString(group, 'color', groupContext),
      }
    })
  }

  if (record.extra_roots !== undefined) {
    config.extra_roots = expectStringArray(record.extra_roots, `${context}.extra_roots`)
  }

  if (record.canvas !== undefined) {
    const canvas = expectRecord(record.canvas, `${context}.canvas`)
    config.canvas = { crdt_enabled: expectBoolean(canvas, 'crdt_enabled', `${context}.canvas`) }
  }

  if (record.semantic !== undefined) {
    const semantic = expectRecord(record.semantic, `${context}.semantic`)
    const provider = expectString(semantic, 'provider', `${context}.semantic`)
    if (!['none', 'ollama', 'openai'].includes(provider)) {
      throw new Error(`${context}.semantic.provider: unsupported value`)
    }
    config.semantic = {
      provider: provider as NonNullable<VaultConfig['semantic']>['provider'],
      base_url: optionalNullableString(semantic.base_url, `${context}.semantic.base_url`),
      model: optionalNullableString(semantic.model, `${context}.semantic.model`),
      dimension:
        semantic.dimension === undefined || semantic.dimension === null
          ? null
          : expectNumber(semantic, 'dimension', `${context}.semantic.dimension`),
    }
  }

  if (record.mcp !== undefined) {
    const mcp = expectRecord(record.mcp, `${context}.mcp`)
    const mode = expectString(mcp, 'mode', `${context}.mcp`)
    if (!['off', 'read-only', 'draft', 'write-approved'].includes(mode)) {
      throw new Error(`${context}.mcp.mode: unsupported value`)
    }
    config.mcp = {
      mode: mode as NonNullable<VaultConfig['mcp']>['mode'],
      ...(mcp.disabled === undefined
        ? {}
        : { disabled: expectBoolean(mcp, 'disabled', `${context}.mcp`) }),
    }
  }

  return config
}

function optionalNullableString(value: unknown, context: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw new Error(`${context}: expected string or null`)
  }
  return value
}
