import type { CanvasRenderWorkerRequest, CanvasRenderWorkerResponse } from '../workers/canvas-render.worker'

let worker: Worker | null = null
let nextId = 0
const REQUEST_TIMEOUT_MS = 20_000

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/canvas-render.worker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export function svgToDataUrlInWorker(svg: string): Promise<string> {
  const id = `canvas-render-${nextId++}`
  const instance = getWorker()

  return new Promise((resolve, reject) => {
    function settle() {
      window.clearTimeout(timeoutId)
      instance.removeEventListener('message', onMessage)
      instance.removeEventListener('error', onError)
    }
    function onMessage(event: MessageEvent<CanvasRenderWorkerResponse>) {
      if (event.data.id !== id) return
      settle()
      resolve(event.data.dataUrl)
    }
    function onError(event: ErrorEvent) {
      settle()
      reject(event.error ?? new Error(event.message))
    }
    const timeoutId = window.setTimeout(() => {
      settle()
      reject(new Error('canvas render worker timed out'))
    }, REQUEST_TIMEOUT_MS)
    instance.addEventListener('message', onMessage)
    instance.addEventListener('error', onError)
    const payload: CanvasRenderWorkerRequest = { id, svg }
    instance.postMessage(payload)
  })
}
