import { useId, useRef, useState, type ReactNode } from 'react'
import {
  AlignCenter,
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileOutput,
  Focus,
  Languages,
  MoreHorizontal,
  Palette,
  Quote,
  Sparkles,
  SpellCheck,
  SlidersHorizontal,
  StickyNote,
  Target,
  Terminal,
  Eye,
} from 'lucide-react'

import type { EditorThemeId } from '@scriptor/editor'
import { useI18n } from '../../lib/i18n'
import { ToolbarPopover } from '../ToolbarPopover'

interface EditorToolsMenuProps {
  activePath: string | null
  onOrganizeActive: () => void
  onOpenWritingTargets: () => void
  onOpenCheatsheet: () => void
  onInsertCitation?: () => void
  onOpenExport?: () => void
  stickiesVisible: boolean
  onToggleStickies: () => void
  editorMode: 'codemirror' | 'monaco'
  onToggleEditorMode: () => void
  editorTheme: EditorThemeId
  editorThemeSyncedToApp: boolean
  onToggleEditorTheme: () => void
  vimMode: boolean
  onToggleVim: () => void
  spellcheck: boolean
  onToggleSpellcheck: () => void
  wysiwyg: boolean
  onToggleWysiwyg: () => void
  typewriter: boolean
  onToggleTypewriter: () => void
  distractionFree: boolean
  onToggleDistractionFree: () => void
  languageTool: boolean
  onToggleLanguageTool: () => void
  onRenameActiveNote: () => void
  onInsertAiSummaryPrompt: () => void
  onInsertRule: () => void
}

export function EditorToolsMenu(props: EditorToolsMenuProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const triggerId = useId()
  const menuId = useId()

  const closeAfter = (action: () => void) => {
    action()
    setOpen(false)
    triggerRef.current?.focus()
  }

  const checkboxItem = (
    key: string,
    checked: boolean,
    label: string,
    icon: ReactNode,
    action: () => void,
    disabled = false,
  ) => (
    <li role="none" key={key}>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => closeAfter(action)}
      >
        {icon}
        <span>{label}</span>
        <span className="toolbar-menu-check" aria-hidden="true">{checked ? '✓' : ''}</span>
      </button>
    </li>
  )

  const themeLabel = props.editorThemeSyncedToApp
    ? t('editorTools.themeAuto')
    : props.editorTheme === 'dark'
      ? t('editorTools.themeDark')
      : t('editorTools.themeLight')

  return (
    <div className="editor-tools-menu">
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={open ? 'active' : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return
          event.preventDefault()
          setOpen(true)
        }}
        aria-label={t('editorTools.trigger')}
        title={t('editorTools.trigger')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        <span className="toolbar-menu-trigger-label">{t('editorTools.tools')}</span>
        <ChevronDown className="toolbar-menu-trigger-chevron" size={14} aria-hidden="true" />
      </button>
      <ToolbarPopover
        open={open}
        id={menuId}
        className="editor-tools-menu-panel"
        triggerRef={triggerRef}
        labelledBy={triggerId}
        onClose={() => setOpen(false)}
      >
        <li role="none">
          <button type="button" role="menuitem" disabled={!props.activePath} onClick={() => closeAfter(props.onOrganizeActive)}>
            <CheckCircle2 size={14} aria-hidden="true" /> {t('editor.transforms.markOrganized')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => closeAfter(props.onOpenWritingTargets)}>
            <Target size={14} aria-hidden="true" /> {t('editor.transforms.writingTargets')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => closeAfter(props.onOpenCheatsheet)}>
            <BookOpen size={14} aria-hidden="true" /> {t('editor.transforms.cheatsheet')}
          </button>
        </li>
        <li role="none">
          <button
            type="button"
            role="menuitem"
            disabled={!props.activePath || !props.onInsertCitation}
            onClick={() => props.onInsertCitation && closeAfter(props.onInsertCitation)}
          >
            <Quote size={14} aria-hidden="true" /> {t('editorTools.insertCitation')}
          </button>
        </li>
        <li role="none">
          <button
            type="button"
            role="menuitem"
            disabled={!props.activePath || !props.onOpenExport}
            onClick={() => props.onOpenExport && closeAfter(props.onOpenExport)}
          >
            <FileOutput size={14} aria-hidden="true" /> {t('editorTools.exportPublish')}
          </button>
        </li>
        {checkboxItem('stickies', props.stickiesVisible, t('editorTools.showStickyNotes'), <StickyNote size={14} aria-hidden="true" />, props.onToggleStickies)}
        <li role="separator" className="toolbar-menu-separator" />
        {checkboxItem(
          'monaco',
          props.editorMode === 'monaco',
          t('editorTools.useMonacoEditor'),
          <Code2 size={14} aria-hidden="true" />,
          props.onToggleEditorMode,
        )}
        {checkboxItem(
          'vim',
          props.vimMode,
          t('editorTools.vimKeybindings'),
          <Terminal size={14} aria-hidden="true" />,
          props.onToggleVim,
          props.editorMode === 'monaco',
        )}
        {checkboxItem('spellcheck', props.spellcheck, t('editorTools.spellcheck'), <SpellCheck size={14} aria-hidden="true" />, props.onToggleSpellcheck)}
        {checkboxItem('wysiwyg', props.wysiwyg, t('editorTools.visualMarkdown'), <Eye size={14} aria-hidden="true" />, props.onToggleWysiwyg)}
        {checkboxItem('typewriter', props.typewriter, t('editorTools.typewriterMode'), <AlignCenter size={14} aria-hidden="true" />, props.onToggleTypewriter)}
        {checkboxItem('focus', props.distractionFree, t('editorTools.focusMode'), <Focus size={14} aria-hidden="true" />, props.onToggleDistractionFree)}
        {checkboxItem('language-tool', props.languageTool, t('editorTools.languageToolGrammar'), <Languages size={14} aria-hidden="true" />, props.onToggleLanguageTool)}
        <li role="none">
          <button type="button" role="menuitem" onClick={() => closeAfter(props.onToggleEditorTheme)}>
            <Palette size={14} aria-hidden="true" />
            {t('editorTools.editorTheme', { theme: themeLabel })}
          </button>
        </li>
        <li role="separator" className="toolbar-menu-separator" />
        <li role="none">
          <button type="button" role="menuitem" disabled={!props.activePath} onClick={() => closeAfter(props.onRenameActiveNote)}>
            <Archive size={14} aria-hidden="true" /> {t('editorTools.renameNote')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" disabled={!props.activePath} onClick={() => closeAfter(props.onInsertAiSummaryPrompt)}>
            <Sparkles size={14} aria-hidden="true" /> {t('editorTools.insertAiSummaryPrompt')}
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" disabled={!props.activePath} onClick={() => closeAfter(props.onInsertRule)}>
            <MoreHorizontal size={14} aria-hidden="true" /> {t('editorTools.insertHorizontalRule')}
          </button>
        </li>
      </ToolbarPopover>
    </div>
  )
}
