import { renderMarkdownPreview } from './preview'
import type { PreviewPipelineOptions } from './pipeline'

export interface PreviewWorkerRequest {
  id: number
  markdown: string
  options?: PreviewPipelineOptions
}

export interface PreviewWorkerResponse {
  id: number
  html?: string
  error?: string
}

self.onmessage = (event: MessageEvent<PreviewWorkerRequest>) => {
  const { id, markdown, options } = event.data
  try {
    const html = renderMarkdownPreview(markdown, options)
    const response: PreviewWorkerResponse = { id, html }
    self.postMessage(response)
  } catch (error) {
    const response: PreviewWorkerResponse = {
      id,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}
