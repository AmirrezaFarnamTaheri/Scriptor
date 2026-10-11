import { useState } from 'react'
import { exportPdfLicenses } from '../bridge/commands/export'

export function OfflinePdfNotices() {
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try { setText(await exportPdfLicenses()) }
    catch (failure) { setError(String(failure)) }
    finally { setBusy(false) }
  }
  return <details className="offline-pdf-notices">
    <summary>Offline PDF fonts and third-party notices</summary>
    <p>Uses bundled fonts and an in-process Typst compiler. Typesetting finishes the current document before controls unlock. Markdown source, local PNG/JPEG images and tables are supported; raw HTML, executable chunks and bibliography processing are not run.</p>
    <button type="button" className="toolbar-button" disabled={busy} onClick={() => void load()}>{busy ? 'Loading notices…' : 'Read redistribution notices'}</button>
    {error ? <p role="alert">{error}</p> : null}
    {text ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 320, overflow: 'auto' }}>{text}</pre> : null}
  </details>
}
