import { useCallback, useState } from 'react'

import type { MobilePane } from '../components/shell/MobileWorkspaceNav'

export type WorkspaceMode = 'writing' | 'knowledge' | 'publish' | 'review' | 'automation'

const STORAGE_KEY = 'scriptor:workspace-mode'

function readInitialMode(): WorkspaceMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (
      raw === 'writing' ||
      raw === 'knowledge' ||
      raw === 'publish' ||
      raw === 'review' ||
      raw === 'automation'
    ) {
      return raw
    }
  } catch {
    // ignore storage failures
  }
  return 'writing'
}

export function useWorkspaceMode() {
  const [mode, setModeState] = useState<WorkspaceMode>(() => readInitialMode())

  const setMode = useCallback((next: WorkspaceMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage failures
    }
  }, [])

  return { mode, setMode }
}

export const WORKSPACE_MODE_LABELS: Record<WorkspaceMode, string> = {
  writing: 'Writing',
  knowledge: 'Knowledge',
  publish: 'Publish',
  review: 'Review',
  automation: 'Automation',
}

const MOBILE_PANE_KEY = 'scriptor:mobile-pane'

function readMobilePane(defaultPane: MobilePane): MobilePane {
  try {
    const raw = window.localStorage.getItem(MOBILE_PANE_KEY)
    if (raw === 'vault' || raw === 'editor' || raw === 'inspector' || raw === 'command') {
      return raw
    }
  } catch {
    // ignore storage failures
  }
  return defaultPane
}

export function usePersistedMobilePane(defaultPane: MobilePane = 'editor') {
  const [mobilePane, setMobilePaneState] = useState<MobilePane>(() => readMobilePane(defaultPane))

  const setMobilePane = useCallback((next: MobilePane) => {
    setMobilePaneState(next)
    try {
      window.localStorage.setItem(MOBILE_PANE_KEY, next)
    } catch {
      // ignore storage failures
    }
  }, [])

  return { mobilePane, setMobilePane }
}
