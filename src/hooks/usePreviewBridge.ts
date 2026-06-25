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
      postProcessHtml: previewPostProcess,
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
