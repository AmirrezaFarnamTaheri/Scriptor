import { useCallback, useMemo, useState } from 'react'
import type { CommandResult, McpMode, McpToolDescriptor } from '@scriptor/core'
import { AlertTriangle, Check, Copy, LockKeyhole, Server, ShieldCheck, Sparkles } from 'lucide-react'

import type { DraftPatch } from '@scriptor/mcp'
import { McpDraftDiffEditor } from './editor/McpDraftDiffEditor'
import { MCP_RECIPES } from '../lib/mcpRecipes'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import type { PanelPresentation } from '../hooks/usePanelPresentation'
import { writeClipboardText } from '../lib/clipboardText'
import { useI18n } from '../lib/i18n'
import { ResourceSyncPanel } from './ResourceSyncPanel'
import '../styles/components/mcp-panel.css'

const MODES: McpMode[] = ['off', 'read-only', 'draft', 'write-approved']

const MODE_META: Record<McpMode, { labelKey: string; descriptionKey: string; risk: string }> = {
  off: {
    labelKey: 'mcp.modeOff',
    descriptionKey: 'mcp.modeOffDescription',
    risk: 'off',
  },
  'read-only': {
    labelKey: 'mcp.modeReadOnly',
    descriptionKey: 'mcp.modeReadOnlyDescription',
    risk: 'read',
  },
  draft: {
    labelKey: 'mcp.modeDraft',
    descriptionKey: 'mcp.modeDraftDescription',
    risk: 'draft',
  },
  'write-approved': {
    labelKey: 'mcp.modeWriteApproved',
    descriptionKey: 'mcp.modeWriteApprovedDescription',
    risk: 'write',
  },
}

type McpTab = 'recipes' | 'tools' | 'drafts' | 'audit' | 'sharing'

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

/** Renders permission-scoped MCP automation plus local resource sharing and sync. */
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
  const [resultCopied, setResultCopied] = useState(false)

  // Pretty-printed once so the visible text and the copied text are byte-identical.
  const resultText = useMemo(() => (lastResult ? JSON.stringify(lastResult, null, 2) : ''), [lastResult])

  const copyResult = useCallback(async () => {
    if (!resultText) return
    try {
      await writeClipboardText(resultText)
      setResultCopied(true)
      window.setTimeout(() => setResultCopied((current) => (current ? false : current)), 1800)
    } catch {
      // Clipboard unavailable — the result is still selectable in the box below.
    }
  }, [resultText])

  const effectiveTool = useMemo(
    () => tools.find((tool) => tool.name === selectedTool) ?? tools[0],
    [selectedTool, tools],
  )

  const modeIds = useMemo(() => MODES.map((entry) => `mcp-mode-${entry}`), [])

  /**
   * Arrow/Home/End navigation for the authorization radiogroup.
   *
   * A one-of-N choice belongs in a radiogroup, not a row of independent toggle
   * buttons: as `aria-pressed` toggles a screen reader announced four unrelated
   * switches rather than one setting with a current value. Mirrors the inspector
   * preset row, which is the same shape of control.
   */
  const handleModeKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Arrow from the focused radio, not from the stored value. Roving tabindex
    // normally keeps the two identical, but keying off focus means the control
    // still behaves predictably if they ever drift apart.
    const focusedIndex = modeIds.findIndex((id) => document.activeElement?.id === id)
    const current = focusedIndex >= 0 ? focusedIndex : MODES.indexOf(mode)
    if (current < 0) return
    let next = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % MODES.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (current - 1 + MODES.length) % MODES.length
    } else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = MODES.length - 1
    if (next === -1) return
    event.preventDefault()
    const target = MODES[next]
    if (!target) return
    onModeChange(target)
    document.getElementById(modeIds[next] ?? '')?.focus()
  }

  const noToolsState = (
    <div className="plugin-empty-graphic">
      <Server aria-hidden="true" size={32} className="text-muted" />
      <p>{t('mcp.noToolsRegistered')}</p>
    </div>
  )

  return (
    <UnifiedPanelShell
      title={t('mcp.title')}
      subtitle={t('mcp.authorizationSubtitle')}
      icon={<Sparkles size={18} />}
      ariaLabel={t('mcp.title')}
      helpTopic="mcp"
      onClose={onClose}
      presentation={presentation}
      className="mcp-panel knowledge-filters-panel"
      wide
      tabs={[
        ...TABS.map((entry) => ({ id: entry.id, label: t(entry.labelKey) })),
        { id: 'sharing', label: t('mcp.tabSharing') },
      ]}
      activeTab={tab}
      onTabChange={(next) => setTab(next as McpTab)}
    >
      {tab !== 'sharing' ? (
        <section className="mcp-authorization" aria-labelledby="mcp-authorization-heading">
          <div className="mcp-authorization-heading">
            <div>
              <h3 id="mcp-authorization-heading">{t('mcp.authorizationHeading')}</h3>
              <p className="health-subtitle">{t('mcp.authorizationScope')}</p>
            </div>
          </div>
          {/* The current level is stated by the checked radio below, which is how a
              radiogroup is meant to report a one-of-N value. A "Current: …" badge
              here repeated that fact in the same viewport, and the role it carried
              was the only thing making the summary readable — now redundant. */}
          <div
            className="mcp-mode-row"
            role="radiogroup"
            aria-label={t('mcp.authorizationLevelAria')}
            onKeyDown={handleModeKeys}
          >
            {MODES.map((entry, index) => {
              const meta = MODE_META[entry]
              const checked = mode === entry
              return (
                <button
                  type="button"
                  role="radio"
                  id={modeIds[index]}
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  key={entry}
                  className={checked ? 'mcp-mode-option active' : 'mcp-mode-option'}
                  data-risk={meta.risk}
                  onClick={() => onModeChange(entry)}
                >
                  <span className="mcp-mode-option-icon" aria-hidden="true">
                    {entry === 'off' ? <LockKeyhole size={15} /> : entry === 'write-approved' ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
                  </span>
                  <span className="mcp-mode-option-copy">
                    <span className="mcp-mode-option-header">
                      <strong>{t(meta.labelKey)}</strong>
                      <span className="mcp-mode-indicator" aria-hidden="true">
                        <span className="mcp-mode-indicator-dot" />
                      </span>
                    </span>
                    <small>{t(meta.descriptionKey)}</small>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mcp-mode-actions">
            {aiEnabled && activePath && onGenerateDraft ? (
              <button type="button" className="toolbar-button" onClick={onGenerateDraft}>
                <Sparkles size={14} />
                {t('mcp.generateWithAi')}
              </button>
            ) : null}
            <details className="mcp-administration-details">
              <summary>{t('mcp.administration')}</summary>
              <p className="health-subtitle">{t('mcp.administrationDescription')}</p>
              <button type="button" className="toolbar-button danger-button" onClick={onResetPermissions}>
                {t('mcp.resetActiveVaultAuthorization')}
              </button>
            </details>
          </div>
        </section>
      ) : null}

      {tab === 'sharing' ? (
        <ResourceSyncPanel />
      ) : mode === 'off' ? (
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
                  <div className="mcp-result-block">
                    <div className="mcp-result-actions">
                      <span className="health-subtitle">Result</span>
                      {/* A tool result is JSON the user usually needs verbatim, so it
                          gets a copy control rather than being selected by hand. */}
                      <button
                        type="button"
                        className="toolbar-button"
                        aria-label="Copy tool result as JSON"
                        onClick={() => void copyResult()}
                      >
                        {resultCopied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                        {resultCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="mcp-result" aria-live="polite">
                      {resultText}
                    </pre>
                  </div>
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
                          className="primary-button"
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
