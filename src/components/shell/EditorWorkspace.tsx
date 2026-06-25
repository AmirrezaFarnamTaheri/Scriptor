import type { CSSProperties, PointerEventHandler, RefObject } from 'react'
import {
  Archive,
  CheckCircle2,
  FileText,
  FolderOpen,
  Link,
  MoreHorizontal,
  PanelRight,
  Sparkles,
  X,
} from 'lucide-react'
import {
  MarkdownEditor,
  type EditorAutocompleteContext,
  type EditorThemeId,
  type MarkdownEditorHandle,
  type SnippetCatalogEntry,
  type SnippetVariableContext,
  type TocEntry,
} from '@scriptor/editor'
import type { MonacoCompletionContext } from '../../lib/monaco-completions'

import { MonacoMarkdownEditor } from '../editor/MonacoMarkdownEditor'
import { InlineEditorAssist } from '../editor/InlineEditorAssist'
import { ExternalChangeBanner } from '../ExternalChangeBanner'
import { TocSidebar } from '../TocSidebar'
import { TypographyMenu } from '../TypographyMenu'
import { InsertMenu } from '../InsertMenu'
import { SplitPaneHandle } from '../SplitPaneHandle'
import { MarkdownPreview, type MarkdownPreviewHandle } from '@scriptor/renderer'
import type { ExternalChangeConflict } from '../../types/vault'

interface OpenTab {
  path: string
  title: string
  contentHash: string
  pinned?: boolean
}

interface EditorWorkspaceProps {
  activePath: string | null
  onOpenVault: () => void
  openTabs: OpenTab[]
  isNoteDirty?: boolean
  inboxPaths?: Set<string>
  canReopenClosedTab?: boolean
  onReopenClosedTab?: () => void
  onTogglePinTab?: (path: string) => void
  onOpenTab: (path: string) => void
  onCloseTab: (path: string) => void
  draftMarkdown: string
  updateDraft: (markdown: string) => void
  externalChangeConflict: ExternalChangeConflict | null
  onReloadExternalChange: () => void
  onKeepEditingExternalChange: () => void
  tocOpen: boolean
  onToggleToc: () => void
  tocEntries: TocEntry[]
  visibleEditorLine: number
  onJumpToLine: (line: number) => void
  frontmatterOpen: boolean
  onOpenFrontmatter: () => void
  onOrganizeActive: () => void
  onOpenCheatsheet: () => void
  onOpenWritingTargets: () => void
  editorMode: 'codemirror' | 'monaco'
  toggleEditorMode: () => void
  editorTheme: EditorThemeId
  toggleEditorTheme: () => void
  vimMode: boolean
  setVimMode: (updater: (value: boolean) => boolean) => void
  spellcheck: boolean
  setSpellcheck: (updater: (value: boolean) => boolean) => void
  wysiwyg: boolean
  setWysiwyg: (updater: (value: boolean) => boolean) => void
  typewriter: boolean
  setTypewriter: (updater: (value: boolean) => boolean) => void
  distractionFree: boolean
  setDistractionFree: (updater: (value: boolean) => boolean) => void
  languageTool: boolean
  setLanguageTool: (updater: (value: boolean) => boolean) => void
  stickiesVisible: boolean
  setStickiesVisible: (updater: (value: boolean) => boolean) => void
  splitPreview: boolean
  setSplitPreview: (updater: (value: boolean) => boolean) => void
  showSplitPreview: boolean
  splitEditorWidth: string
  splitDragging: boolean
  onSplitHandlePointerDown: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerMove: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerUp: PointerEventHandler<HTMLDivElement>
  onSplitHandlePointerCancel: PointerEventHandler<HTMLDivElement>
  onSplitHandleDoubleClick: () => void
  editorWorkspaceRef: RefObject<HTMLDivElement | null>
  splitPreviewScrollRef: RefObject<HTMLElement | null>
  previewRef: RefObject<MarkdownPreviewHandle | null>
  editorRef: RefObject<MarkdownEditorHandle | null>
  scrollSyncEnabled: boolean
  handleEditorLine: (line: number) => void
  snippetContext: SnippetVariableContext | undefined
  snippetCatalog: SnippetCatalogEntry[]
  editorAutocompleteContext: EditorAutocompleteContext
  monacoCompletionContext: MonacoCompletionContext
  editorInsertRequest: any
  editorTransformRequest: any
  editorTypographyRequest: any
  scrollToEditorLine: number | null
  saveImageFromClipboard?: (file: File) => Promise<string | null>
  previewProps: {
    fetchNote?: (target: string) => Promise<string | null>
    readVaultText?: (path: string) => Promise<string | null>
    executeDql?: (query: string) => Promise<unknown>
    runCodeChunk?: (language: string, code: string) => Promise<unknown>
    postProcessHtml?: (html: string) => string
    renderPlantUmlLocal?: (source: string) => Promise<string | null>
  }
  insertSnippet: (content: string) => void
  applyEditorTransform: (action: string) => void
  applyEditorTypography: (action: string) => void
  saveActiveNoteNow: () => void
  renameActiveNote: () => void
  isSaving: boolean
  lastSavedAt: string | null
  draftWordCount: number
  wordCountDelta: number
  charCount: number
  readingMinutes: number
  brokenLinkCount?: number
  citationCount?: number
  hasFrontmatter?: boolean
  onOpenPublishCenter?: () => void
  showFormatToolbar?: boolean
  showEditorAssist?: boolean
  showEditorStatus?: boolean
  showLineNumbers?: boolean
  editorSurfaceMode?: 'source' | 'split' | 'rendered'
  onEditorSurfaceModeChange?: (mode: 'source' | 'split' | 'rendered') => void
}

export function EditorWorkspace(props: EditorWorkspaceProps) {
  const {
    activePath,
    onOpenVault,
    openTabs,
    isNoteDirty = false,
    inboxPaths,
    canReopenClosedTab = false,
    onReopenClosedTab,
    onTogglePinTab,
    onOpenTab,
    onCloseTab,
    draftMarkdown,
    updateDraft,
    externalChangeConflict,
    onReloadExternalChange,
    onKeepEditingExternalChange,
    tocOpen,
    onToggleToc,
    tocEntries,
    visibleEditorLine,
    onJumpToLine,
    onOpenFrontmatter,
    onOrganizeActive,
    onOpenCheatsheet,
    onOpenWritingTargets,
    editorMode,
    toggleEditorMode,
    editorTheme,
    toggleEditorTheme,
    vimMode,
    setVimMode,
    spellcheck,
    setSpellcheck,
    wysiwyg,
    setWysiwyg,
    typewriter,
    setTypewriter,
    distractionFree,
    setDistractionFree,
    languageTool,
    setLanguageTool,
    stickiesVisible,
    setStickiesVisible,
    splitPreview,
    setSplitPreview,
    showSplitPreview,
    splitEditorWidth,
    splitDragging,
    onSplitHandlePointerDown,
    onSplitHandlePointerMove,
    onSplitHandlePointerUp,
    onSplitHandlePointerCancel,
    onSplitHandleDoubleClick,
    editorWorkspaceRef,
    splitPreviewScrollRef,
    previewRef,
    editorRef,
    scrollSyncEnabled,
    handleEditorLine,
    snippetContext,
    snippetCatalog,
    editorAutocompleteContext,
    monacoCompletionContext,
    editorInsertRequest,
    editorTransformRequest,
    editorTypographyRequest,
    scrollToEditorLine,
    saveImageFromClipboard,
    previewProps,
    insertSnippet,
    applyEditorTransform,
    applyEditorTypography,
    saveActiveNoteNow,
    renameActiveNote,
    isSaving,
    lastSavedAt,
    draftWordCount,
    wordCountDelta,
    charCount,
    readingMinutes,
    brokenLinkCount = 0,
    citationCount = 0,
    hasFrontmatter = false,
    onOpenPublishCenter,
    showFormatToolbar = true,
    showEditorAssist = true,
    showEditorStatus = true,
    showLineNumbers = true,
    editorSurfaceMode = 'source',
    onEditorSurfaceModeChange,
  } = props

  return (
    <section className="editor-panel" aria-label="Editor">
      <div className="tabs-row" role="tablist" aria-label="Open notes">
        {canReopenClosedTab && onReopenClosedTab ? (
          <button type="button" className="tab-reopen" onClick={onReopenClosedTab} title="Reopen closed tab">
            ↺
          </button>
        ) : null}
        {openTabs.length === 0 ? (
          <span className="empty-tab">No note open</span>
        ) : (
          openTabs.map((tab) => (
            <button
              type="button"
              className={`tab${tab.path === activePath ? ' active' : ''}${tab.path === activePath && isNoteDirty ? ' tab-dirty' : ''}${tab.pinned ? ' tab-pinned' : ''}`}
              role="tab"
              aria-selected={tab.path === activePath}
              key={tab.path}
              onClick={() => onOpenTab(tab.path)}
            >
              <FileText />
              <span>{tab.title}</span>
              {inboxPaths?.has(tab.path) ? (
                <span className="tab-lifecycle inbox" title="In inbox">
                  inbox
                </span>
              ) : null}
              {tab.path === activePath && isNoteDirty ? (
                <span className="tab-dirty-dot" aria-label="Unsaved changes" title="Unsaved changes" />
              ) : null}
              {onTogglePinTab ? (
                <span
                  role="button"
                  tabIndex={0}
                  className={`tab-pin${tab.pinned ? ' active' : ''}`}
                  aria-label={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                  title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                  onClick={(event) => {
                    event.stopPropagation()
                    onTogglePinTab(tab.path)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      event.stopPropagation()
                      onTogglePinTab(tab.path)
                    }
                  }}
                >
                  •
                </span>
              ) : null}
              <X
                onClick={(event) => {
                  event.stopPropagation()
                  onCloseTab(tab.path)
                }}
              />
            </button>
          ))
        )}
      </div>

      {showFormatToolbar ? (
      <div className="format-row editor-toolbar" aria-label="Markdown tools">
        <div className="format-group" aria-label="View mode">
          {(
            [
              ['Source', 'source'],
              ['Split', 'split'],
              ['Preview', 'rendered'],
            ] as const
          ).map(([label, mode]) => (
            <button
              type="button"
              key={mode}
              className={editorSurfaceMode === mode ? 'active' : undefined}
              onClick={() => onEditorSurfaceModeChange?.(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="format-group" aria-label="Structure">
          {(
            [
              ['H1', 'h1'],
              ['H2', 'h2'],
              ['H3', 'h3'],
            ] as const
          ).map(([tool, action]) => (
            <button type="button" key={tool} disabled={!activePath} onClick={() => applyEditorTransform(action)}>
              {tool}
            </button>
          ))}
          <button type="button" disabled={!activePath} onClick={onToggleToc}>
            TOC
          </button>
          <button type="button" disabled={!activePath} onClick={onOpenFrontmatter}>
            FM
          </button>
          <button type="button" disabled={!activePath} onClick={() => applyEditorTransform('move-section-up')}>
            §↑
          </button>
          <button type="button" disabled={!activePath} onClick={() => applyEditorTransform('move-section-down')}>
            §↓
          </button>
        </div>

        <div className="format-group" aria-label="Style and insert">
          <button type="button" disabled={!activePath} onClick={() => applyEditorTransform('bold')}>
            B
          </button>
          <button type="button" disabled={!activePath} onClick={() => applyEditorTransform('italic')}>
            I
          </button>
          <button type="button" disabled={!activePath} onClick={() => applyEditorTransform('link')}>
            <Link />
          </button>
          <TypographyMenu disabled={!activePath} onSelect={(action) => applyEditorTypography(action)} />
          <button type="button" disabled={!activePath} onClick={() => applyEditorTransform('table')}>
            Table
          </button>
          <button type="button" disabled={!activePath} onClick={() => applyEditorTransform('table-add-row')}>
            +Row
          </button>
          <button type="button" disabled={!activePath} onClick={() => applyEditorTransform('table-add-col')}>
            +Col
          </button>
          <InsertMenu disabled={!activePath} onInsert={insertSnippet} />
        </div>

        <div className="format-group" aria-label="Review and capture">
          <button type="button" disabled={!activePath} title="Mark note organized (inbox triage)" onClick={onOrganizeActive}>
            <CheckCircle2 />
          </button>
          <button type="button" onClick={onOpenWritingTargets}>
            Targets
          </button>
          <button type="button" onClick={onOpenCheatsheet}>
            Cheatsheet
          </button>
          <button type="button" onClick={() => setStickiesVisible((value) => !value)} className={stickiesVisible ? 'active' : undefined}>
            Stickies
          </button>
        </div>

        <div className="format-group" aria-label="Editor mode">
          <button type="button" onClick={() => setVimMode((value) => !value)} className={vimMode ? 'active' : undefined} disabled={editorMode === 'monaco'}>
            Vim
          </button>
        <button type="button" onClick={toggleEditorMode} className={editorMode === 'monaco' ? 'active' : undefined} title="Toggle Monaco editor">
          Monaco
        </button>
        <button type="button" onClick={toggleEditorTheme} className={editorTheme === 'dark' ? 'active' : undefined} title="Toggle editor theme">
          Theme
        </button>
        <button type="button" onClick={() => setSpellcheck((value) => !value)} className={spellcheck ? 'active' : undefined}>
          Spell
        </button>
        <button type="button" onClick={() => setWysiwyg((value) => !value)} className={wysiwyg ? 'active' : undefined}>
          WYSIWYG
        </button>
        <button type="button" onClick={() => setTypewriter((value) => !value)} className={typewriter ? 'active' : undefined}>
          Typewriter
        </button>
        <button type="button" onClick={() => setDistractionFree((value) => !value)} className={distractionFree ? 'active' : undefined}>
          Focus
        </button>
        <button type="button" onClick={() => setLanguageTool((value) => !value)} className={languageTool ? 'active' : undefined}>
          LT
        </button>
        <button type="button" onClick={renameActiveNote} disabled={!activePath}>
          <Archive />
        </button>
        <button
          type="button"
          disabled={!activePath}
          onClick={() => {
            insertSnippet('> [!ai] Summarize the section above.')
          }}
        >
          <Sparkles />
        </button>
        <span />
        <button
          type="button"
          className={splitPreview ? 'active' : ''}
          disabled={!activePath}
          title="Toggle split preview"
          aria-pressed={splitPreview}
          onClick={() => setSplitPreview((value) => !value)}
        >
          <PanelRight />
        </button>
        <button type="button" disabled={!activePath} title="Insert horizontal rule" onClick={() => insertSnippet('\n---\n')}>
          <MoreHorizontal />
        </button>
        </div>

        {showEditorAssist ? (
        <InlineEditorAssist
          activePath={activePath}
          hasFrontmatter={hasFrontmatter}
          brokenLinkCount={brokenLinkCount}
          citationCount={citationCount}
          onInsertWikilink={() => insertSnippet('[[Note Title]]')}
          onInsertCitation={() => insertSnippet('[@citekey]')}
          onOpenFrontmatter={onOpenFrontmatter}
          onOpenExport={() => onOpenPublishCenter?.()}
        />
        ) : null}
      </div>
      ) : null}

      {externalChangeConflict ? (
        <ExternalChangeBanner
          conflict={externalChangeConflict}
          onReload={onReloadExternalChange}
          onKeepEditing={onKeepEditingExternalChange}
        />
      ) : null}

      <div
        className={`editor-workspace ${showSplitPreview ? 'is-split' : ''}`}
        ref={editorWorkspaceRef}
        style={showSplitPreview ? ({ '--split-editor-width': splitEditorWidth } as CSSProperties) : undefined}
      >
        <article
          className="editor-surface codemirror-host editor-pane"
          aria-label="Markdown editor"
          data-line-numbers={showLineNumbers ? 'true' : 'false'}
        >
          {tocOpen && activePath ? (
            <TocSidebar
              entries={tocEntries}
              activeLine={visibleEditorLine}
              onSelect={onJumpToLine}
              onClose={onToggleToc}
            />
          ) : null}
          {activePath ? (
            editorMode === 'monaco' ? (
              <MonacoMarkdownEditor
                key={activePath}
                notePath={activePath}
                value={draftMarkdown}
                onChange={updateDraft}
                insertRequest={editorInsertRequest}
                scrollToLine={scrollToEditorLine}
                editorTheme={editorTheme}
                typewriter={typewriter}
                distractionFree={distractionFree}
                showLineNumbers={showLineNumbers}
                completionContext={monacoCompletionContext}
                className="markdown-editor monaco-editor-host"
              />
            ) : (
              <MarkdownEditor
                ref={editorRef}
                key={activePath}
                value={draftMarkdown}
                onChange={updateDraft}
                scrollToLine={scrollToEditorLine}
                insertRequest={editorInsertRequest}
                transformRequest={editorTransformRequest}
                typographyRequest={editorTypographyRequest}
                scrollSyncEnabled={scrollSyncEnabled}
                onVisibleLineChange={handleEditorLine}
                snippetContext={snippetContext}
                snippetCatalog={snippetCatalog}
                autocompleteContext={editorAutocompleteContext}
                vimMode={vimMode}
                spellcheck={spellcheck}
                wysiwyg={wysiwyg}
                typewriter={typewriter}
                distractionFree={distractionFree}
                languageTool={languageTool}
                editorTheme={editorTheme}
                onVimSave={saveActiveNoteNow}
                saveImageFromClipboard={saveImageFromClipboard}
                showLineNumbers={showLineNumbers}
                className="markdown-editor"
              />
            )
          ) : (
            <div className="editor-empty">
              <p>Select a note from the vault or open a folder to start writing.</p>
              <button type="button" className="primary-button" onClick={onOpenVault}>
                <FolderOpen />
                Open Vault
              </button>
            </div>
          )}
        </article>
        {showSplitPreview ? (
          <>
            <SplitPaneHandle
              dragging={splitDragging}
              onPointerDown={onSplitHandlePointerDown}
              onPointerMove={onSplitHandlePointerMove}
              onPointerUp={onSplitHandlePointerUp}
              onPointerCancel={onSplitHandlePointerCancel}
              onDoubleClick={onSplitHandleDoubleClick}
            />
            <aside className="editor-preview-pane" aria-label="Split Markdown preview" ref={splitPreviewScrollRef}>
              <MarkdownPreview
                ref={previewRef}
                markdown={draftMarkdown}
                className="markdown-preview"
                basePath={activePath}
                fetchNote={previewProps.fetchNote}
                readVaultText={previewProps.readVaultText}
                executeDql={previewProps.executeDql as any}
                runCodeChunk={previewProps.runCodeChunk as any}
                postProcessHtml={previewProps.postProcessHtml}
                renderPlantUmlLocal={previewProps.renderPlantUmlLocal}
              />
            </aside>
          </>
        ) : null}
      </div>

      {showEditorStatus ? (
      <footer className="editor-status">
        <span>
          {draftWordCount.toLocaleString()} words
          {wordCountDelta !== 0 ? (
            <small className="word-count-delta">
              {' '}
              ({wordCountDelta > 0 ? '+' : ''}
              {wordCountDelta})
            </small>
          ) : null}
        </span>
        <span>{charCount.toLocaleString()} characters</span>
        <span>{readingMinutes > 0 ? `${readingMinutes} min read` : '— min read'}</span>
        <span>{isSaving ? 'Saving...' : lastSavedAt ? `Saved ${lastSavedAt}` : 'Markdown'}</span>
        <CheckCircle2 />
      </footer>
      ) : null}
    </section>
  )
}
