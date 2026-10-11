import { VISUAL_MEDIA_ASSET } from './visualMediaFixtures'

/** Opt-in browser fixtures; production reads remain native and vault-scoped. */
export function assetMediaHarness(cmd: string, payload: unknown): { handled: boolean; value?: unknown } {
  if (sessionStorage.getItem('e2e:asset-media') !== '1') return { handled: false }
  if (cmd === 'indexer_asset_usage') return { handled: true, value: {
    source: 'derived-link-index', truncated: false,
    assets: ['assets/pixel.png', 'assets/tone.wav', 'assets/invalid.png', 'assets/active.svg'].map(path => ({
      path, bytes: path === 'assets/pixel.png' ? VISUAL_MEDIA_ASSET.byteLength : path === 'assets/tone.wav' ? 844 : path === 'assets/invalid.png' ? 20 : 128, used_by: [],
    })),
  } }
  if (cmd !== 'reader_read_document') return { handled: false }
  const args = payload as { relPath: string; expectedVaultId?: string }
  const calls = JSON.parse(sessionStorage.getItem('e2e:media-calls') ?? '[]') as unknown[]
  calls.push(args)
  sessionStorage.setItem('e2e:media-calls', JSON.stringify(calls))
  const value = args.relPath.endsWith('invalid.png') ? new TextEncoder().encode('<html>invalid</html>')
    : args.relPath.endsWith('.png') ? Uint8Array.from(atob(VISUAL_MEDIA_ASSET.base64), char => char.charCodeAt(0))
      : wavFixture()
  return { handled: true, value: Array.from(value) }
}

function wavFixture(): Uint8Array {
  const buffer = new ArrayBuffer(44 + 800)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, 800, true)
  return new Uint8Array(buffer)
}
