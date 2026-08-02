import { useCallback, useState } from 'react'
import type { EditorThemeId } from '@scriptor/editor'

import type { AppTheme } from './useAppTheme'

import { usePersistedBoolean } from './usePersistedBoolean'
import { usePersistedString } from './usePersistedString'

function readEditorMode(): 'codemirror' | 'monaco' {
  try {
    return window.localStorage.getItem('scriptor:editor-mode') === 'monaco' ? 'monaco' : 'codemirror'
  } catch {
    return 'codemirror'
  }
}

function readEditorThemeOverride(): EditorThemeId | null {
  try {
    const stored = window.localStorage.getItem('scriptor:editor-theme')
    return stored === 'dark' || stored === 'light' ? stored : null
  } catch {
    return null
  }
}

function defaultEditorTheme(appTheme: AppTheme): EditorThemeId {
  return appTheme === 'light' ? 'light' : 'dark'
}

export function useEditorPreferences(appTheme: AppTheme) {
  const [splitPreview, setSplitPreview] = usePersistedBoolean('scriptor:split-preview', false)
  const [vimMode, setVimMode] = usePersistedBoolean('scriptor:vim-mode', false)
  const [spellcheck, setSpellcheck] = usePersistedBoolean('scriptor:spellcheck', false)
  const [spellcheckLocale, setSpellcheckLocale] = usePersistedString('scriptor:spellcheck-locale', 'en-US')
  const [languageToolEndpoint, setLanguageToolEndpoint] = usePersistedString(
    'scriptor:languagetool-endpoint',
    'http://localhost:8010/v2/check',
  )
  const [wysiwyg, setWysiwyg] = usePersistedBoolean('scriptor:wysiwyg', false)
  const [typewriter, setTypewriter] = usePersistedBoolean('scriptor:typewriter', false)
  const [distractionFree, setDistractionFree] = usePersistedBoolean('scriptor:distraction-free', false)
  const [languageTool, setLanguageTool] = usePersistedBoolean('scriptor:language-tool', false)

  const [hibernateGraph, setHibernateGraph] = usePersistedBoolean('scriptor:hibernate-graph', false)
  const [hibernateMcp, setHibernateMcp] = usePersistedBoolean('scriptor:hibernate-mcp', false)
  const [hibernateWatcher, setHibernateWatcher] = usePersistedBoolean('scriptor:hibernate-watcher', false)
  const [hibernateSpellcheck, setHibernateSpellcheck] = usePersistedBoolean('scriptor:hibernate-spellcheck', false)
  const [hibernateGit, setHibernateGit] = usePersistedBoolean('scriptor:hibernate-git', false)

  const [editorMode, setEditorMode] = useState<'codemirror' | 'monaco'>(readEditorMode)
  const [editorThemeOverride, setEditorThemeOverride] = useState<EditorThemeId | null>(
    readEditorThemeOverride,
  )
  const editorTheme = editorThemeOverride ?? defaultEditorTheme(appTheme)

  const toggleEditorMode = useCallback(() => {
    setEditorMode((current) => {
      const next = current === 'codemirror' ? 'monaco' : 'codemirror'
      try {
        window.localStorage.setItem('scriptor:editor-mode', next)
      } catch {
        // Browser storage is an enhancement; in-memory state still updates.
      }
      return next
    })
  }, [])

  const toggleEditorTheme = useCallback(() => {
    const next = editorTheme === 'light' ? 'dark' : 'light'
    setEditorThemeOverride(next)
    try {
      window.localStorage.setItem('scriptor:editor-theme', next)
    } catch {
      // Browser storage is an enhancement; in-memory state still updates.
    }
  }, [editorTheme])

  return {
    distractionFree,
    editorMode,
    editorTheme,
    hibernateGit,
    hibernateGraph,
    hibernateMcp,
    hibernateSpellcheck,
    hibernateWatcher,
    languageTool,
    languageToolEndpoint,
    setDistractionFree,
    setHibernateGit,
    setHibernateGraph,
    setHibernateMcp,
    setHibernateSpellcheck,
    setHibernateWatcher,
    setLanguageTool,
    setLanguageToolEndpoint,
    setSpellcheck,
    setSpellcheckLocale,
    setSplitPreview,
    setTypewriter,
    setVimMode,
    setWysiwyg,
    spellcheck,
    spellcheckLocale,
    splitPreview,
    toggleEditorMode,
    toggleEditorTheme,
    typewriter,
    vimMode,
    wysiwyg,
  }
}
