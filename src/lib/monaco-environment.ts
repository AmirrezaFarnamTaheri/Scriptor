import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Bind @monaco-editor/react to the locally bundled monaco-editor.
//
// Without this the loader defaults to fetching the AMD build from
// https://cdn.jsdelivr.net at runtime. That download is blocked by the
// packaged app's CSP (`script-src 'self' 'unsafe-inline'`), so the editor
// never mounts outside `tauri dev` — where no CSP header is attached and the
// failure is invisible. It is also a remote-code dependency in a local-first
// product, for a copy of monaco that is already in the bundle.
loader.config({ monaco })

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker: (workerId: string, label: string) => Worker
    }
  }
}

globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  },
}
