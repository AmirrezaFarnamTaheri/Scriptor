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
    <p>Works offline with bundled fonts. Text, tables and local PNG/JPEG images are included; raw HTML, code chunks and citations are not processed.</p>
    <button type="button" className="toolbar-button" disabled={busy} onClick={() => void load()}>{busy ? 'Loading notices…' : 'Read redistribution notices'}</button>
    {error ? <p role="alert">{error}</p> : null}
    {text ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 320, overflow: 'auto' }}>{text}</pre> : null}
  </details>
}
