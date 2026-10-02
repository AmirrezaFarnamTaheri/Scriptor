import { assetLink } from './researchStudio.ts'

export type MediaKind = 'reader' | 'image' | 'audio'
const images = new Map([['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['gif', 'image/gif'], ['webp', 'image/webp'], ['bmp', 'image/bmp']])
const audio = new Map([['mp3', 'audio/mpeg'], ['wav', 'audio/wav'], ['ogg', 'audio/ogg'], ['flac', 'audio/flac']])
const extension = (path: string) => path.split('.').at(-1)?.toLowerCase() ?? ''

export function mediaKind(path: string): MediaKind | null {
  try { assetLink(path) } catch { return null }
  const suffix = extension(path)
  if (suffix === 'pdf' || suffix === 'epub') return 'reader'
  if (images.has(suffix)) return 'image'
  if (audio.has(suffix)) return 'audio'
  return null
}

export function validatedMediaType(path: string, bytes: Uint8Array): string {
  if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('Media previews must be 32 MiB or smaller.')
  const suffix = extension(path)
  const kind = mediaKind(path)
  const mime = images.get(suffix) ?? audio.get(suffix)
  if (!mime || kind === null) throw new Error('This media format is not supported for preview.')
  const starts = (prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte)
  const textAt = (offset: number, text: string) => [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0))
  const matches = suffix === 'png' ? starts([137, 80, 78, 71, 13, 10, 26, 10])
    : suffix === 'jpg' || suffix === 'jpeg' ? starts([255, 216, 255])
    : suffix === 'gif' ? textAt(0, 'GIF87a') || textAt(0, 'GIF89a')
    : suffix === 'webp' ? textAt(0, 'RIFF') && textAt(8, 'WEBP')
    : suffix === 'bmp' ? textAt(0, 'BM')
    : suffix === 'wav' ? textAt(0, 'RIFF') && textAt(8, 'WAVE')
    : suffix === 'ogg' ? textAt(0, 'OggS')
    : suffix === 'flac' ? textAt(0, 'fLaC')
    : textAt(0, 'ID3') || (bytes[0] === 255 && (bytes[1] & 224) === 224)
  if (!matches) throw new Error('The media bytes do not match the file extension.')
  return mime
}
