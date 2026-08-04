import { useMemo, useState } from 'react'
import type { CommandResult, McpMode, McpToolDescriptor } from '@scriptor/core'
import { Server, Sparkles } from 'lucide-react'

import type { DraftPatch } from '@scriptor/mcp'
import { McpDraftDiffEditor } from './editor/McpDraftDiffEditor'
import { MCP_RECIPES } from '../lib/mcpRecipes'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import type { PanelPresentation } from '../hooks/usePanelPresentation'
import { useI18n } from '../lib/i18n'

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
  { id: 'recipes', labelKey: 'mcp.tabRecipes' },
  { id: 'tools', labelKey: 'mcp.tabTools' },
  { id: 'drafts', labelKey: 'mcp.tabDrafts' },
  { id: 'audit', labelKey: 'mcp.tabAudit' },
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
  const { t } = useI18n()
  const [tab, setTab] = useState<McpTab>('recipes')
  const [selectedTool, setSelectedTool] = useState(tools[0]?.name ?? 'mcp.search')
  const [inputJson, setInputJson] = useState(TOOL_DEFAULTS['mcp.search'])
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)
  const [draftBefore, setDraftBefore] = useState<Record<string, string>>({})

  const effectiveTool = useMemo(
    () => tools.find((tool) => tool.name === selectedTool) ?? tools[0],
    [selectedTool, tools],
  )

  const noToolsState = (
    <div className="plugin-empty-graphic">
      <Server aria-hidden="true" size={32} className="text-muted" />
      <p>{t('mcp.noToolsRegistered')}</p>
    </div>
  )

  return (
    <UnifiedPanelShell
      title={t('mcp.title')}
      subtitle={t('mcp.subtitle')}
      icon={<Sparkles size={18} />}
      ariaLabel={t('mcp.title')}
      onClose={onClose}
      presentation={presentation}
      className="mcp-panel knowledge-filters-panel"
      wide
      tabs={TABS.map((entry) => ({ id: entry.id, label: t(entry.labelKey) }))}
      activeTab={tab}
      onTabChange={(next) => setTab(next as McpTab)}
      headerActions={
        <button type="button" className="toolbar-button" onClick={onResetPermissions}>
          {t('mcp.resetVaultMcp')}
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
            {t('mcp.generateWithAi')}
          </button>
        ) : null}
      </div>

      {mode === 'off' ? (
        <div className="plugin-empty-graphic">
          <Server aria-hidden="true" size={32} className="text-muted" />
          <p>{t('mcp.disabledMessage')}</p>
          <button type="button" className="primary-button" onClick={() => onModeChange('read-only')}>
            {t('mcp.enableReadOnly')}
          </button>
        </div>
      ) : (
        <>
          {tab === 'recipes' ? (
            tools.length === 0 ? noToolsState : (
              <section className="mcp-recipes" aria-label={t('mcp.guidedAutomationRecipes')}>
                <p className="health-subtitle">{t('mcp.recipesDescription')}</p>
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
            )
          ) : null}

          {tab === 'tools' ? (
            tools.length === 0 ? noToolsState : (
              <>
                <div className="mcp-tool-playground">
                  <label>
                    <span>{t('mcp.tool')}</span>
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
                    <span>{t('mcp.inputJson')}</span>
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
                    {t('mcp.invokeTool')}
                  </button>
                </div>

                {lastResult ? (
                  <pre className="mcp-result" aria-live="polite">
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                ) : null}
              </>
            )
          ) : null}

          {tab === 'drafts' ? (
            <section className="mcp-drafts">
              <h3>{t('mcp.pendingDrafts', { count: drafts.length })}</h3>
              {drafts.length === 0 ? (
                <p className="empty-state">{t('mcp.noPendingDrafts')}</p>
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
                          {expandedDraftId === draft.id ? t('mcp.hideDiff') : t('mcp.reviewDiff')}
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
                          {t('mcp.approve')}
                        </button>
                        <button type="button" className="toolbar-button" onClick={() => onRejectDraft(draft.id)}>
                          {t('mcp.reject')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {mode !== 'write-approved' && drafts.length > 0 ? (
                <p className="mcp-hint">{t('mcp.switchToWriteApproved')}</p>
              ) : null}
            </section>
          ) : null}

          {tab === 'audit' ? (
            <section className="mcp-audit">
              {audit.length === 0 ? (
                <p className="empty-state">{t('mcp.noToolCalls')}</p>
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
