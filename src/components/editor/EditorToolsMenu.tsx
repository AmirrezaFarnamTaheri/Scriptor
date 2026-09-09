import { useId, useRef, useState } from 'react'
import {
  AlignCenter,
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Code2,
  Focus,
  Languages,
  MoreHorizontal,
  Palette,
  Sparkles,
  SpellCheck,
  StickyNote,
  Target,
  Terminal,
  Eye,
} from 'lucide-react'

import type { EditorThemeId } from '@scriptor/editor'
import { ToolbarPopover } from '../ToolbarPopover'

interface EditorToolsMenuProps {
  activePath: string | null
  onOrganizeActive: () => void
  onOpenWritingTargets: () => void
  onOpenCheatsheet: () => void
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
    icon: React.ReactNode,
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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        Tools <ChevronDown size={14} aria-hidden="true" />
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
            <CheckCircle2 size={14} aria-hidden="true" /> Mark note organized
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => closeAfter(props.onOpenWritingTargets)}>
            <Target size={14} aria-hidden="true" /> Writing targets
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" onClick={() => closeAfter(props.onOpenCheatsheet)}>
            <BookOpen size={14} aria-hidden="true" /> Markdown cheatsheet
          </button>
        </li>
        {checkboxItem('stickies', props.stickiesVisible, 'Show sticky notes', <StickyNote size={14} aria-hidden="true" />, props.onToggleStickies)}
        <li role="separator" className="toolbar-menu-separator" />
        {checkboxItem(
          'monaco',
          props.editorMode === 'monaco',
          'Use Monaco editor',
          <Code2 size={14} aria-hidden="true" />,
          props.onToggleEditorMode,
        )}
        {checkboxItem(
          'vim',
          props.vimMode,
          'Vim keybindings',
          <Terminal size={14} aria-hidden="true" />,
          props.onToggleVim,
          props.editorMode === 'monaco',
        )}
        {checkboxItem('spellcheck', props.spellcheck, 'Spellcheck', <SpellCheck size={14} aria-hidden="true" />, props.onToggleSpellcheck)}
        {checkboxItem('wysiwyg', props.wysiwyg, 'Visual Markdown', <Eye size={14} aria-hidden="true" />, props.onToggleWysiwyg)}
        {checkboxItem('typewriter', props.typewriter, 'Typewriter mode', <AlignCenter size={14} aria-hidden="true" />, props.onToggleTypewriter)}
        {checkboxItem('focus', props.distractionFree, 'Focus mode', <Focus size={14} aria-hidden="true" />, props.onToggleDistractionFree)}
        {checkboxItem('language-tool', props.languageTool, 'LanguageTool grammar', <Languages size={14} aria-hidden="true" />, props.onToggleLanguageTool)}
        <li role="none">
          <button type="button" role="menuitem" onClick={() => closeAfter(props.onToggleEditorTheme)}>
            <Palette size={14} aria-hidden="true" />
            Editor theme: {props.editorThemeSyncedToApp ? 'Auto' : props.editorTheme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </li>
        <li role="separator" className="toolbar-menu-separator" />
        <li role="none">
          <button type="button" role="menuitem" disabled={!props.activePath} onClick={() => closeAfter(props.onRenameActiveNote)}>
            <Archive size={14} aria-hidden="true" /> Rename note
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" disabled={!props.activePath} onClick={() => closeAfter(props.onInsertAiSummaryPrompt)}>
            <Sparkles size={14} aria-hidden="true" /> Insert AI summary prompt
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" disabled={!props.activePath} onClick={() => closeAfter(props.onInsertRule)}>
            <MoreHorizontal size={14} aria-hidden="true" /> Insert horizontal rule
          </button>
        </li>
      </ToolbarPopover>
    </div>
  )
}
