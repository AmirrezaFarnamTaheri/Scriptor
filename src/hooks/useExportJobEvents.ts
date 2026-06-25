import { useEffect, useRef } from 'react'

import { subscribeExportEvents } from '../bridge/exportEvents'
import type { ExportJobFailedEvent, ExportJobFinishedEvent, ExportJobProgressEvent } from '../types/vault'

export function useExportJobEvents(handlers: {
  onFinished: (event: ExportJobFinishedEvent) => void
  onFailed: (event: ExportJobFailedEvent) => void
  onProgress?: (event: ExportJobProgressEvent) => void
}) {
  const finishedRef = useRef(handlers.onFinished)
  const failedRef = useRef(handlers.onFailed)
  const progressRef = useRef(handlers.onProgress)

  useEffect(() => {
    finishedRef.current = handlers.onFinished
  }, [handlers.onFinished])

  useEffect(() => {
    failedRef.current = handlers.onFailed
  }, [handlers.onFailed])

  useEffect(() => {
    progressRef.current = handlers.onProgress
  }, [handlers.onProgress])

  useEffect(() => {
    let active = true
    let unlisten: (() => void) | undefined

    void subscribeExportEvents({
      onFinished: (event) => finishedRef.current(event),
      onFailed: (event) => failedRef.current(event),
      onProgress: (event) => progressRef.current?.(event),
    }).then((dispose) => {
      if (!active) {
        dispose()
        return
      }
      unlisten = dispose
    })

    return () => {
      active = false
      unlisten?.()
    }
  }, [])
}
