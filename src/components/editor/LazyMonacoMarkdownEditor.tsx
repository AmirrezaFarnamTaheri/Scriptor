import type { ComponentProps } from 'react'

import '../../lib/monaco-environment'

import { MonacoMarkdownEditor } from './MonacoMarkdownEditor'

type LazyMonacoMarkdownEditorProps = ComponentProps<typeof MonacoMarkdownEditor>

export function LazyMonacoMarkdownEditor(props: LazyMonacoMarkdownEditorProps) {
  if (
    import.meta.env.VITE_E2E_MODE === 'true' &&
    window.sessionStorage.getItem('e2e:editor-render-failure') === '1'
  ) {
    window.sessionStorage.setItem('e2e:editor-render-failure', 'consumed')
    throw new Error('E2E editor render failure')
  }

  return <MonacoMarkdownEditor {...props} />
}
