import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'scriptor:onboarding-complete'

function readComplete(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

export function useOnboarding() {
  const [complete, setComplete] = useState(() => readComplete())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!complete) {
      setOpen(true)
    }
  }, [complete])

  const markComplete = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, 'true')
    setComplete(true)
    setOpen(false)
  }, [])

  const replay = useCallback(() => {
    setOpen(true)
  }, [])

  return {
    onboardingOpen: open,
    setOnboardingOpen: setOpen,
    completeOnboarding: markComplete,
    replayOnboarding: replay,
    onboardingComplete: complete,
  }
}
