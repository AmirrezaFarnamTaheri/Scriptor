import type { CanvasRenderWorkerRequest, CanvasRenderWorkerResponse } from '../workers/canvas-render.worker'

let worker: Worker | null = null
let nextId = 0

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
    const onMessage = (event: MessageEvent<CanvasRenderWorkerResponse>) => {
      if (event.data.id !== id) return
      instance.removeEventListener('message', onMessage)
      instance.removeEventListener('error', onError)
      resolve(event.data.dataUrl)
    }
    const onError = (event: ErrorEvent) => {
      instance.removeEventListener('message', onMessage)
      instance.removeEventListener('error', onError)
      reject(event.error ?? new Error(event.message))
    }
    instance.addEventListener('message', onMessage)
    instance.addEventListener('error', onError)
    const payload: CanvasRenderWorkerRequest = { id, svg }
    instance.postMessage(payload)
  })
}
