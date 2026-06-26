import { useEffect, useRef } from 'react'

import { subscribeDaemonConfigReloaded, type DaemonConfigReloadedEvent } from '../bridge/daemonEvents'

export function useDaemonConfigEvents(handler: (event: DaemonConfigReloadedEvent) => void) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    let active = true
    let unlisten: (() => void) | undefined

    void subscribeDaemonConfigReloaded((event) => handlerRef.current(event)).then((dispose) => {
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
