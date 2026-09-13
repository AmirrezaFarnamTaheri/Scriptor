import { memo, useMemo } from 'react'
import {
  AlignCenter,
  Archive,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  BookOpen,
  CheckCircle2,
  Code2,
  Columns,
  Eye,
  FileBox,
  Focus,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Languages,
  Link,
  ListTree,
  MoreHorizontal,
  Palette,
  PanelRight,
  Rows,
  Sparkles,
  SpellCheck,
  StickyNote,
  Table,
  Target,
  Terminal,
} from 'lucide-react'
import type { EditorTransformAction, TypographyAction } from '@scriptor/editor'

import { CustomizableToolbar, type ToolbarTool } from './CustomizableToolbar'
import { INSERT_TOOLS, TYPOGRAPHY_LABELS } from './toolbar-catalog'
import { InlineEditorAssist } from './InlineEditorAssist'
import { TypographyMenu } from '../TypographyMenu'
import { InsertMenu } from '../InsertMenu'
import { useI18n } from '../../lib/i18n'

export interface EditorFormatToolbarProps {
  toolbarExtras?: ToolbarTool[]
  activePath: string | null
  editorSurfaceMode: 'source' | 'split' | 'rendered'
  onEditorSurfaceModeChange?: (mode: 'source' | 'split' | 'rendered') => void
  handleApplyEditorTransform: (action: EditorTransformAction) => void
  onToggleToc?: () => void
  onOpenFrontmatter?: () => void
  handleApplyEditorTypography: (action: TypographyAction) => void
  handleInsertSnippet: (content: string) => void
  onOrganizeActive?: () => void
  onOpenWritingTargets?: () => void
  onOpenCheatsheet?: () => void
  stickiesVisible: boolean
  setStickiesVisible: (value: boolean) => void
  vimMode: boolean
  setVimMode: (updater: (value: boolean) => boolean) => void
  editorMode: 'codemirror' | 'monaco'
  toggleEditorMode: () => void
  editorThemeSyncedToApp: boolean
  editorTheme: 'light' | 'dark'
  toggleEditorTheme: () => void
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
  renameActiveNote: () => void
  insertSnippet: (content: string) => void
  splitPreview?: boolean
  showSplitPreview: boolean
  setSplitPreview?: (updater: (value: boolean) => boolean) => void
  showEditorAssist?: boolean
  brokenLinkCount: number
  citationCount: number
  onOpenPublishCenter?: () => void
}

export const EditorFormatToolbar = memo(function EditorFormatToolbar({
  toolbarExtras,
  activePath,
  editorSurfaceMode,
  onEditorSurfaceModeChange,
  handleApplyEditorTransform,
  onToggleToc,
  onOpenFrontmatter,
  handleApplyEditorTypography,
  handleInsertSnippet,
  onOrganizeActive,
  onOpenWritingTargets,
  onOpenCheatsheet,
  stickiesVisible,
  setStickiesVisible,
  vimMode,
  setVimMode,
  editorMode,
  toggleEditorMode,
  editorThemeSyncedToApp,
  editorTheme,
  toggleEditorTheme,
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
  renameActiveNote,
  insertSnippet,
  splitPreview,
  showSplitPreview,
  setSplitPreview,
  showEditorAssist = true,
  brokenLinkCount,
  citationCount,
  onOpenPublishCenter,
}: EditorFormatToolbarProps) {
  const { t } = useI18n()

  const extras = useMemo(() => toolbarExtras ?? [
    ...INSERT_TOOLS.map((item) => ({
      id: `extra:insert:${item.id}`,
      label: item.label,
      node: (
        <button
          type="button"
          disabled={!activePath}
          title={item.label}
          onClick={() => handleInsertSnippet(item.content)}
        >
          {item.label}
        </button>
      ),
    })),
    ...Object.entries(TYPOGRAPHY_LABELS).map(([action, labelKey]) => {
      const label = t(labelKey)
      return {
        id: `extra:typography:${action}`,
        label,
        node: (
          <button
            type="button"
            disabled={!activePath}
            title={label}
            onClick={() => handleApplyEditorTypography(action as TypographyAction)}
          >
            {label}
          </button>
        ),
      }
    }),
  ], [activePath, handleApplyEditorTypography, handleInsertSnippet, t, toolbarExtras])

  return (
    <div className="editor-toolbar-wrapper">
      <CustomizableToolbar extras={extras}>
        <div className="format-group" aria-label={t('editor.toolbar.viewMode')}>
          {(
            [
              [t('editor.view.source'), 'source'],
              [t('editor.view.split'), 'split'],
              [t('editor.view.preview'), 'rendered'],
            ] as const
          ).map(([label, mode]) => (
            <button
              type="button"
              key={mode}
              className={editorSurfaceMode === mode ? 'active' : undefined}
              aria-pressed={editorSurfaceMode === mode}
              onClick={() => onEditorSurfaceModeChange?.(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="format-group" aria-label={t('editor.toolbar.structure')}>
          <button key="heading-1" type="button" disabled={!activePath} title={t('editor.transforms.heading1')} onClick={() => handleApplyEditorTransform('h1')}>
            <Heading1 />
          </button>
          <button key="heading-2" type="button" disabled={!activePath} title={t('editor.transforms.heading2')} onClick={() => handleApplyEditorTransform('h2')}>
            <Heading2 />
          </button>
          <button key="heading-3" type="button" disabled={!activePath} title={t('editor.transforms.heading3')} onClick={() => handleApplyEditorTransform('h3')}>
            <Heading3 />
          </button>
          <button key="outline" type="button" disabled={!activePath} title={t('editor.transforms.toc')} onClick={onToggleToc}>
            <ListTree />
          </button>
          <button key="frontmatter" type="button" disabled={!activePath} title={t('editor.transforms.frontmatter')} onClick={onOpenFrontmatter}>
            <FileBox />
          </button>
          <button key="move-section-up" type="button" disabled={!activePath} title={t('editor.transforms.moveSectionUp')} onClick={() => handleApplyEditorTransform('move-section-up')}>
            <ArrowUpToLine />
          </button>
          <button key="move-section-down" type="button" disabled={!activePath} title={t('editor.transforms.moveSectionDown')} onClick={() => handleApplyEditorTransform('move-section-down')}>
            <ArrowDownToLine />
          </button>
        </div>

        <div className="format-group" aria-label={t('editor.toolbar.styleAndInsert')}>
          <button key="bold" type="button" disabled={!activePath} title={t('editor.transforms.bold')} onClick={() => handleApplyEditorTransform('bold')}>
            <Bold />
          </button>
          <button key="italic" type="button" disabled={!activePath} title={t('editor.transforms.italic')} onClick={() => handleApplyEditorTransform('italic')}>
            <Italic />
          </button>
          <button key="link" type="button" disabled={!activePath} title={t('editor.transforms.link')} onClick={() => handleApplyEditorTransform('link')}>
            <Link />
          </button>
          <TypographyMenu key="typography" disabled={!activePath} onSelect={handleApplyEditorTypography} />
          <button key="table" type="button" disabled={!activePath} title={t('editor.transforms.insertTable')} onClick={() => handleApplyEditorTransform('table')}>
            <Table />
          </button>
          <button key="table-add-row" type="button" disabled={!activePath} title={t('editor.transforms.addRow')} onClick={() => handleApplyEditorTransform('table-add-row')}>
            <Rows />
          </button>
          <button key="table-add-column" type="button" disabled={!activePath} title={t('editor.transforms.addColumn')} onClick={() => handleApplyEditorTransform('table-add-col')}>
            <Columns />
          </button>
          <InsertMenu key="insert" disabled={!activePath} onInsert={handleInsertSnippet} />
        </div>

        <div className="format-group" aria-label={t('editor.toolbar.reviewAndCapture')}>
          <button key="organize-note" type="button" disabled={!activePath} title={t('editor.transforms.markOrganized')} onClick={onOrganizeActive}>
            <CheckCircle2 />
          </button>
          <button key="writing-targets" type="button" title={t('editor.transforms.writingTargets')} onClick={onOpenWritingTargets}>
            <Target />
          </button>
          <button key="cheatsheet" type="button" title={t('editor.transforms.cheatsheet')} aria-label={t('editor.transforms.cheatsheet')} onClick={onOpenCheatsheet}>
            <BookOpen size={16} />
          </button>
          <button key="stickies"
            type="button"
            title={stickiesVisible ? t('editor.toggles.hideStickies') : t('editor.toggles.showStickies')}
            aria-label={stickiesVisible ? t('editor.toggles.hideStickies') : t('editor.toggles.showStickies')}
            aria-pressed={stickiesVisible}
            onClick={() => setStickiesVisible(!stickiesVisible)}
            className={stickiesVisible ? 'active' : undefined}
          >
            <StickyNote size={16} />
          </button>
        </div>

        <div className="format-group" aria-label={t('editor.toolbar.editorMode')}>
          <button key="vim"
            type="button"
            title={vimMode ? t('editor.toggles.disableVim') : t('editor.toggles.enableVim')}
            aria-label={vimMode ? t('editor.toggles.disableVim') : t('editor.toggles.enableVim')}
            aria-pressed={vimMode}
            onClick={() => setVimMode((value) => !value)}
            className={vimMode ? 'active' : undefined}
            disabled={editorMode === 'monaco'}
          >
            <Terminal size={16} />
          </button>
          <button key="editor-engine"
            type="button"
            title={t('editor.toggles.toggleMonaco')}
            aria-label={editorMode === 'monaco' ? t('editor.toggles.switchToCodeMirror') : t('editor.toggles.switchToMonaco')}
            aria-pressed={editorMode === 'monaco'}
            onClick={toggleEditorMode}
            className={editorMode === 'monaco' ? 'active' : undefined}
          >
            <Code2 size={16} />
          </button>
          <button key="editor-theme"
            type="button"
            title={t('editor.toggles.toggleTheme')}
            aria-label={
              editorThemeSyncedToApp
                ? t('editor.toggles.themeAutoPinLight', { current: t(`editor.toggles.theme${editorTheme === 'dark' ? 'Dark' : 'Light'}`) })
                : t('editor.toggles.themePinned', {
                    current: t(`editor.toggles.theme${editorTheme === 'dark' ? 'Dark' : 'Light'}`),
                    other: editorTheme === 'dark' ? t('editor.toggles.themeLight') : t('editor.toggles.themeDark'),
                  })
            }
            aria-pressed={!editorThemeSyncedToApp}
            onClick={toggleEditorTheme}
            className={editorTheme === 'dark' ? 'active' : undefined}
          >
            <Palette size={16} />
          </button>
          <button key="spellcheck"
            type="button"
            title={spellcheck ? t('editor.toggles.disableSpellcheck') : t('editor.toggles.enableSpellcheck')}
            aria-label={spellcheck ? t('editor.toggles.disableSpellcheck') : t('editor.toggles.enableSpellcheck')}
            aria-pressed={spellcheck}
            onClick={() => setSpellcheck((value) => !value)}
            className={spellcheck ? 'active' : undefined}
          >
            <SpellCheck size={16} />
          </button>
          <button key="wysiwyg"
            type="button"
            title={wysiwyg ? t('editor.toggles.disableWysiwyg') : t('editor.toggles.enableWysiwyg')}
            aria-label={wysiwyg ? t('editor.toggles.disableWysiwyg') : t('editor.toggles.enableWysiwyg')}
            aria-pressed={wysiwyg}
            onClick={() => setWysiwyg((value) => !value)}
            className={wysiwyg ? 'active' : undefined}
          >
            <Eye size={16} />
          </button>
          <button key="typewriter"
            type="button"
            title={typewriter ? t('editor.toggles.disableTypewriter') : t('editor.toggles.enableTypewriter')}
            aria-label={typewriter ? t('editor.toggles.disableTypewriter') : t('editor.toggles.enableTypewriter')}
            aria-pressed={typewriter}
            onClick={() => setTypewriter((value) => !value)}
            className={typewriter ? 'active' : undefined}
          >
            <AlignCenter size={16} />
          </button>
          <button key="focus"
            type="button"
            title={distractionFree ? t('editor.toggles.exitFocus') : t('editor.toggles.enterFocus')}
            aria-label={distractionFree ? t('editor.toggles.exitFocus') : t('editor.toggles.enterFocus')}
            aria-pressed={distractionFree}
            onClick={() => setDistractionFree((value) => !value)}
            className={distractionFree ? 'active' : undefined}
          >
            <Focus size={16} />
          </button>
          <button key="grammar"
            type="button"
            title={languageTool ? t('editor.toggles.disableLanguageTool') : t('editor.toggles.enableLanguageTool')}
            aria-label={languageTool ? t('editor.toggles.disableLanguageToolGrammar') : t('editor.toggles.enableLanguageToolGrammar')}
            aria-pressed={languageTool}
            onClick={() => setLanguageTool((value) => !value)}
            className={languageTool ? 'active' : undefined}
          >
            <Languages size={16} />
          </button>
          <button key="rename-note" type="button" onClick={renameActiveNote} disabled={!activePath} title={t('editor.rename.title')} aria-label={t('editor.rename.ariaLabel')}>
            <Archive />
          </button>
          <button key="ai-summary"
            type="button"
            disabled={!activePath}
            title={t('editor.aiSummarize')}
            aria-label={t('editor.aiSummarize')}
            onClick={() => {
              insertSnippet('> [!ai] Summarize the section above.')
            }}
          >
            <Sparkles />
          </button>
          <span className="toolbar-separator" aria-hidden="true" />
          <button key="split-preview"
            type="button"
            className={(splitPreview ?? showSplitPreview) ? 'active' : ''}
            disabled={!activePath}
            title={t('editor.splitToggle')}
            aria-label={t('editor.splitToggle')}
            aria-pressed={splitPreview ?? showSplitPreview}
            onClick={() => {
              if (setSplitPreview) {
                setSplitPreview((value) => !value)
              } else {
                onEditorSurfaceModeChange?.(showSplitPreview ? 'source' : 'split')
              }
            }}
          >
            <PanelRight />
          </button>
          <button key="horizontal-rule" type="button" disabled={!activePath} title={t('editor.insertRule')} aria-label={t('editor.insertRule')} onClick={() => insertSnippet('\n---\n')}>
            <MoreHorizontal />
          </button>
        </div>
      </CustomizableToolbar>
      {showEditorAssist ? (
        <InlineEditorAssist
          activePath={activePath}
          brokenLinkCount={brokenLinkCount}
          citationCount={citationCount}
          onInsertCitation={() => insertSnippet('[@citekey]')}
          onOpenExport={() => onOpenPublishCenter?.()}
        />
      ) : null}
    </div>
  )
})
