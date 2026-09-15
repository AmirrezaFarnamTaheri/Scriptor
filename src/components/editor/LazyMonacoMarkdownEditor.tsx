import { forwardRef, type ComponentProps } from 'react'
import type { MarkdownEditorHandle } from '@scriptor/editor/pure'

import '../../lib/monaco-environment'

import { MonacoMarkdownEditor } from './MonacoMarkdownEditor'

type LazyMonacoMarkdownEditorProps = ComponentProps<typeof MonacoMarkdownEditor>

export const LazyMonacoMarkdownEditor = forwardRef<MarkdownEditorHandle, LazyMonacoMarkdownEditorProps>(
  function LazyMonacoMarkdownEditor(props, ref) {
    if (
      import.meta.env.VITE_E2E_MODE === 'true' &&
      window.sessionStorage.getItem('e2e:editor-render-failure') === '1'
    ) {
      throw new Error('E2E editor render failure')
    }

    return <MonacoMarkdownEditor ref={ref} {...props} />
  },
)
