import { useCallback, useState } from 'react'

export interface TextPromptRequest {
  title: string
  label: string
  defaultValue: string
  submitLabel?: string
}

interface PendingPrompt extends TextPromptRequest {
  resolve: (value: string | null) => void
}

export function useTextPrompt() {
  const [pending, setPending] = useState<PendingPrompt | null>(null)

  const promptText = useCallback((request: TextPromptRequest) => {
    return new Promise<string | null>((resolve) => {
      setPending({ ...request, resolve })
    })
  }, [])

  const submitPrompt = useCallback(
    (value: string) => {
      pending?.resolve(value)
      setPending(null)
    },
    [pending],
  )

  const cancelPrompt = useCallback(() => {
    pending?.resolve(null)
    setPending(null)
  }, [pending])

  return {
    promptRequest: pending,
    promptText,
    submitPrompt,
    cancelPrompt,
  }
}
