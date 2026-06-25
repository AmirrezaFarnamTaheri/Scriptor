import { DiffEditor, type BeforeMount, type DiffOnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useEffect, useRef } from 'react'

import { monacoThemeForEditor, registerScriptorMonacoThemes } from '../../lib/monaco-themes'

interface McpDraftDiffEditorProps {
  before: string
  after: string
  editorTheme?: 'light' | 'dark'
  className?: string
}

export function McpDraftDiffEditor({
  before,
  after,
  editorTheme = 'dark',
  className,
}: McpDraftDiffEditorProps) {
  const diffRef = useRef<MonacoEditor.IStandaloneDiffEditor | null>(null)

  useEffect(() => {
    return () => {
      diffRef.current = null
    }
  }, [])

  const beforeMount: BeforeMount = (monaco) => {
    registerScriptorMonacoThemes(monaco)
  }

  const onMount: DiffOnMount = (editor) => {
    diffRef.current = editor
  }

  return (
    <div className={className ?? 'mcp-draft-diff-editor'}>
      <DiffEditor
        height={280}
        language="markdown"
        theme={monacoThemeForEditor(editorTheme)}
        original={before}
        modified={after}
        beforeMount={beforeMount}
        onMount={onMount}
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          fontFamily: 'var(--mono)',
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
        }}
      />
    </div>
  )
}
