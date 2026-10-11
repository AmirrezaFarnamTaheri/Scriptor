import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native'
import { authorizeSensitiveOperation } from './authorization'
import { parseZoteroItems, parseReferenceUsage, type ZoteroReference, type ReferenceUsageReport } from '../../lib/referenceDesk'
import { parseCaptureExtraction, type CaptureExtraction } from '../../lib/captureReviewer'
export type { ReferenceUsageReport } from '../../lib/referenceDesk'

export type { CaptureExtraction } from '../../lib/captureReviewer'
export async function captureExtractPreview(url:string):Promise<CaptureExtraction>{
  requireNative()
  const authorizationToken=await authorizeSensitiveOperation('web_clip',url)
  const payload:unknown=await invoke('capture_extract_preview',{url,authorizationToken})
  return parseCaptureExtraction(payload)
}
export async function zoteroImportPreview(apiKey:string,start=0):Promise<{items:ZoteroReference[];nextStart:number|null}>{
  requireNative()
  const authorizationToken=await authorizeSensitiveOperation('zotero_read','Zotero user library preview')
  const payload:unknown=await invoke('zotero_import_preview',{apiKey,start,authorizationToken})
  if(!payload||typeof payload!=='object'||!('items'in payload))throw new Error('Invalid Zotero preview')
  const next='nextStart'in payload?payload.nextStart:null
  if(next!==null&&(typeof next!=='number'||!Number.isSafeInteger(next)||next<0||next>10100||next%100!==0))throw new Error('Invalid Zotero pagination')
  return {items:parseZoteroItems(payload.items),nextStart:next as number|null}
}
export async function referenceUsagePreview(expectedVaultId:string):Promise<ReferenceUsageReport>{
  requireNative()
  const payload:unknown=await invoke('reference_usage_preview',{expectedVaultId})
  return parseReferenceUsage(payload)
}
