import { useEffect, useRef } from 'react'

import {
  subscribeDaemonConfigReloaded,
  subscribeDaemonResyncRequired,
  type DaemonConfigReloadedEvent,
} from '../bridge/daemonEvents'

export function useDaemonConfigEvents(
  handler: (event: DaemonConfigReloadedEvent) => void,
  onResyncRequired?: (reason: string) => void,
) {
  const handlerRef = useRef(handler)
  const resyncRef = useRef(onResyncRequired)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    resyncRef.current = onResyncRequired
  }, [onResyncRequired])

  useEffect(() => {
    let active = true
    const unlisten: Array<() => void> = []

    void Promise.all([
      subscribeDaemonConfigReloaded((event) => handlerRef.current(event)),
      subscribeDaemonResyncRequired((event) => resyncRef.current?.(event.reason)),
    ]).then((dispose) => {
      if (!active) {
        for (const stop of dispose) stop()
        return
      }
      unlisten.push(...dispose)
    })

    return () => {
      active = false
      for (const stop of unlisten) stop()
    }
  }, [])
}
