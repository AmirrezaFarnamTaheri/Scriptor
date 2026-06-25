import { useMemo, useState } from 'react'
import type { McpMode, McpToolDescriptor } from '@scriptor/core'
import type { CommandResult } from '@scriptor/core'
import { Sparkles } from 'lucide-react'

import type { DraftPatch } from '@scriptor/mcp'
import { McpDraftDiffEditor } from './editor/McpDraftDiffEditor'
import { MCP_RECIPES } from '../lib/mcpRecipes'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import type { PanelPresentation } from '../hooks/usePanelPresentation'

const MODES: McpMode[] = ['off', 'read-only', 'draft', 'write-approved']

type McpTab = 'recipes' | 'tools' | 'drafts' | 'audit'

interface McpPanelProps {
  mode: McpMode
  tools: McpToolDescriptor[]
  audit: Array<{ id: string; toolName: string; outcome: string; requestedAt: string; mode: McpMode }>
  drafts: DraftPatch[]
  lastResult: CommandResult | null
  activePath: string | null
  editorTheme?: 'light' | 'dark'
  presentation?: PanelPresentation
  onClose: () => void
  onModeChange: (mode: McpMode) => void
  onResetPermissions: () => void
  readNoteContent: (path: string) => Promise<string>
  onInvoke: (toolName: string, input: unknown) => void
  onApproveDraft: (patchId: string) => void
  onRejectDraft: (patchId: string) => void
  aiEnabled?: boolean
  onGenerateDraft?: () => void
}

const TOOL_DEFAULTS: Record<string, string> = {
  'mcp.search': '{\n  "query": "Research",\n  "limit": 10\n}',
  'mcp.readNote': '{\n  "path": "Research Plan.md"\n}',
  'mcp.inspectBacklinks': '{\n  "path": "Research Plan.md"\n}',
  'mcp.inspectBrokenLinks': '{}',
  'mcp.inspectExportProfiles': '{}',
  'mcp.inspectOutline': '{\n  "path": "Research Plan.md"\n}',
  'mcp.listTags': '{\n  "prefix": "draft",\n  "limit": 20\n}',
  'mcp.searchByTag': '{\n  "tag": "research",\n  "limit": 25\n}',
  'mcp.exportGraph': '{\n  "focusPath": "Research Plan.md",\n  "depth": 2\n}',
  'mcp.inspectGraphSummary': '{}',
  'mcp.proposePatch': '{\n  "path": "Research Plan.md",\n  "proposedMarkdown": "# Updated",\n  "summary": "Assistant draft"\n}',
  'mcp.proposeTagPatch': '{\n  "path": "Research Plan.md",\n  "add": ["research"],\n  "summary": "Tag note for research"\n}',
}

const TABS = [
  { id: 'recipes', label: 'Recipes' },
  { id: 'tools', label: 'Tools' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'audit', label: 'Audit' },
] as const

export function McpPanel({
  mode,
  tools,
  audit,
  drafts,
  lastResult,
  activePath,
  editorTheme = 'dark',
  presentation = 'modal',
  onClose,
  onModeChange,
  onResetPermissions,
  readNoteContent,
  onInvoke,
  onApproveDraft,
  onRejectDraft,
  aiEnabled = false,
  onGenerateDraft,
}: McpPanelProps) {
  const [tab, setTab] = useState<McpTab>('recipes')
  const [selectedTool, setSelectedTool] = useState(tools[0]?.name ?? 'mcp.search')
  const [inputJson, setInputJson] = useState(TOOL_DEFAULTS['mcp.search'])
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)
  const [draftBefore, setDraftBefore] = useState<Record<string, string>>({})

  const effectiveTool = useMemo(
    () => tools.find((tool) => tool.name === selectedTool) ?? tools[0],
    [selectedTool, tools],
  )

  return (
    <UnifiedPanelShell
      title="MCP automation"
      subtitle="Permissioned tools with audit logging and draft approval gates."
      icon={<Sparkles size={18} />}
      ariaLabel="MCP automation"
      onClose={onClose}
      presentation={presentation}
      className="mcp-panel knowledge-filters-panel"
      wide
      tabs={TABS.map((entry) => ({ id: entry.id, label: entry.label }))}
      activeTab={tab}
      onTabChange={(next) => setTab(next as McpTab)}
      headerActions={
        <button type="button" className="toolbar-button" onClick={onResetPermissions}>
          Reset vault MCP
        </button>
      }
    >
      <div className="mcp-mode-row">
        {MODES.map((entry) => (
          <button
            type="button"
            key={entry}
            className={mode === entry ? 'toolbar-button active' : 'toolbar-button'}
            onClick={() => onModeChange(entry)}
          >
            {entry}
          </button>
        ))}
        {aiEnabled && activePath && onGenerateDraft ? (
          <button type="button" className="toolbar-button" onClick={onGenerateDraft}>
            <Sparkles size={14} />
            Generate with AI
          </button>
        ) : null}
      </div>

      {mode === 'off' ? (
        <p className="empty-state">MCP is disabled for this vault. Select a mode to expose tools.</p>
      ) : (
        <>
          {tab === 'recipes' ? (
            <section className="mcp-recipes" aria-label="Guided automation recipes">
              <p className="health-subtitle">
                One-click workflows that pre-fill tool inputs. Review results before approving any drafts.
              </p>
              <div className="mcp-recipe-grid">
                {MCP_RECIPES.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    className="mcp-recipe-card"
                    onClick={() => {
                      setSelectedTool(recipe.toolName)
                      setInputJson(JSON.stringify(recipe.buildInput({ activePath }), null, 2))
                      onInvoke(recipe.toolName, recipe.buildInput({ activePath }))
                      setTab('tools')
                    }}
                  >
                    <strong>{recipe.label}</strong>
                    <span>{recipe.description}</span>
                    {recipe.modeHint ? <em>{recipe.modeHint}</em> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {tab === 'tools' ? (
            <>
              <div className="mcp-tool-playground">
                <label>
                  <span>Tool</span>
                  <select
                    value={effectiveTool?.name ?? ''}
                    onChange={(event) => {
                      const name = event.target.value
                      setSelectedTool(name)
                      setInputJson(TOOL_DEFAULTS[name] ?? '{}')
                    }}
                  >
                    {tools.map((tool) => (
                      <option key={tool.name} value={tool.name}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Input JSON</span>
                  <textarea rows={6} value={inputJson} onChange={(event) => setInputJson(event.target.value)} />
                </label>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!effectiveTool}
                  onClick={() => {
                    try {
                      const parsed = inputJson.trim() ? JSON.parse(inputJson) : {}
                      if (effectiveTool?.name === 'mcp.proposePatch' && activePath && !('path' in parsed)) {
                        parsed.path = activePath
                      }
                      onInvoke(effectiveTool!.name, parsed)
                    } catch {
                      onInvoke(effectiveTool!.name, { parseError: true })
                    }
                  }}
                >
                  Invoke tool
                </button>
              </div>

              {lastResult ? (
                <pre className="mcp-result" aria-live="polite">
                  {JSON.stringify(lastResult, null, 2)}
                </pre>
              ) : null}
            </>
          ) : null}

          {tab === 'drafts' ? (
            <section className="mcp-drafts">
              <h3>Pending drafts ({drafts.length})</h3>
              {drafts.length === 0 ? (
                <p className="empty-state">No pending draft patches.</p>
              ) : (
                <ul>
                  {drafts.map((draft) => (
                    <li key={draft.id}>
                      <div>
                        <strong>{draft.notePath}</strong>
                        <p>{draft.summary}</p>
                        <button
                          type="button"
                          className="toolbar-button"
                          onClick={() => {
                            const next = expandedDraftId === draft.id ? null : draft.id
                            setExpandedDraftId(next)
                            if (next && !draftBefore[draft.id] && draft.operation !== 'create') {
                              void readNoteContent(draft.notePath).then((markdown) => {
                                setDraftBefore((current) => ({ ...current, [draft.id]: markdown }))
                              })
                            }
                          }}
                        >
                          {expandedDraftId === draft.id ? 'Hide diff' : 'Review diff'}
                        </button>
                        {expandedDraftId === draft.id ? (
                          <McpDraftDiffEditor
                            before={draftBefore[draft.id] ?? ''}
                            after={draft.proposedMarkdown}
                            editorTheme={editorTheme}
                          />
                        ) : null}
                      </div>
                      <div className="rename-actions">
                        <button
                          type="button"
                          className="toolbar-button"
                          disabled={mode !== 'write-approved'}
                          onClick={() => onApproveDraft(draft.id)}
                        >
                          Approve
                        </button>
                        <button type="button" className="toolbar-button" onClick={() => onRejectDraft(draft.id)}>
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {mode !== 'write-approved' && drafts.length > 0 ? (
                <p className="mcp-hint">Switch to write-approved mode to apply drafts to the vault.</p>
              ) : null}
            </section>
          ) : null}

          {tab === 'audit' ? (
            <section className="mcp-audit">
              {audit.length === 0 ? (
                <p className="empty-state">No tool calls yet.</p>
              ) : (
                <ul>
                  {audit.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.toolName}</span>
                      <small>{entry.outcome}</small>
                      <small>{entry.mode}</small>
                      <time>{new Date(entry.requestedAt).toLocaleTimeString()}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}
    </UnifiedPanelShell>
  )
}
