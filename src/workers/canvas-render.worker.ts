/**
 * Offloads canvas SVG serialization from the main thread.
 */
export interface CanvasRenderWorkerRequest {
  id: string
  svg: string
}

export interface CanvasRenderWorkerResponse {
  id: string
  dataUrl: string
}

self.onmessage = (event: MessageEvent<CanvasRenderWorkerRequest>) => {
  const { id, svg } = event.data
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const reader = new FileReader()
  reader.onload = () => {
    const payload: CanvasRenderWorkerResponse = {
      id,
      dataUrl: String(reader.result ?? ''),
    }
    self.postMessage(payload)
  }
  reader.readAsDataURL(blob)
}
