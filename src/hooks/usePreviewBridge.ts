import { useMemo } from 'react'

import type { MarkdownPreviewProps } from '@scriptor/renderer'

type PreviewBridgeOptions = Pick<
  MarkdownPreviewProps,
  'fetchNote' | 'readVaultText' | 'executeDql' | 'runCodeChunk' | 'postProcessHtml' | 'renderPlantUmlLocal'
>

export function usePreviewBridge({
  nativeReady,
  previewFetchNote,
  previewReadVaultText,
  executeDql,
  runCodeChunk,
  previewPostProcess,
  previewPlantUmlLocal,
}: {
  nativeReady: boolean
  previewFetchNote: NonNullable<PreviewBridgeOptions['fetchNote']>
  previewReadVaultText: NonNullable<PreviewBridgeOptions['readVaultText']>
  executeDql: NonNullable<PreviewBridgeOptions['executeDql']>
  runCodeChunk: NonNullable<PreviewBridgeOptions['runCodeChunk']>
  previewPostProcess: NonNullable<PreviewBridgeOptions['postProcessHtml']>
  previewPlantUmlLocal: NonNullable<PreviewBridgeOptions['renderPlantUmlLocal']>
}): PreviewBridgeOptions {
  return useMemo(
    () => ({
      fetchNote: nativeReady ? previewFetchNote : undefined,
      readVaultText: nativeReady ? previewReadVaultText : undefined,
      executeDql: nativeReady ? executeDql : undefined,
      runCodeChunk: nativeReady ? runCodeChunk : undefined,
      postProcessHtml: (html: string) => {
        if (
          import.meta.env.VITE_E2E_MODE === 'true' &&
          window.sessionStorage.getItem('e2e:preview-postprocess-failure') === '1'
        ) {
          throw new Error('E2E renderer extension failure')
        }
        return previewPostProcess(html)
      },
      renderPlantUmlLocal: nativeReady ? previewPlantUmlLocal : undefined,
    }),
    [
      executeDql,
      nativeReady,
      previewFetchNote,
      previewPlantUmlLocal,
      previewPostProcess,
      previewReadVaultText,
      runCodeChunk,
    ],
  )
}
