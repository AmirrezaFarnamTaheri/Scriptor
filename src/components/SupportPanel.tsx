import { useCallback, useState } from 'react'
import { Copy, ExternalLink, Heart, Mail, Star } from 'lucide-react'

import {
  DONATION_WALLETS,
  GITHUB_ISSUES_URL,
  GITHUB_REPO_URL,
  GITHUB_STARS_URL,
  MAINTAINER_EMAIL,
  MAINTAINER_NAME,
} from '../brand/support'
import { writeClipboardText } from '../lib/clipboardText'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'

interface SupportPanelProps {
  onClose: () => void
}

const WALLET_ROWS = [
  { id: 'btc', label: 'Bitcoin', address: DONATION_WALLETS.btc },
  { id: 'eth', label: 'Ethereum', address: DONATION_WALLETS.eth },
  { id: 'tron', label: 'TRON', address: DONATION_WALLETS.tron },
] as const

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function SupportPanel({ onClose }: SupportPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyWallet = useCallback(async (id: string, address: string) => {
    try {
      await writeClipboardText(address)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1800)
    } catch {
      // clipboard unavailable — user can still select manually
    }
  }, [])

  return (
    <UnifiedPanelShell
      title="Support Scriptor"
      subtitle="Independent, local-first software — your help keeps it alive."
      icon={<Heart size={18} />}
      ariaLabel="Support Scriptor"
      onClose={onClose}
      className="support-panel knowledge-filters-panel"
    >
      <div className="support-panel-body">
        <section className="support-actions" aria-label="Primary support actions">
          <button type="button" className="support-action primary" onClick={() => openExternal(GITHUB_STARS_URL)}>
            <Star size={18} />
            <span>
              <strong>Star on GitHub</strong>
              <small>The simplest way to show support</small>
            </span>
            <ExternalLink size={16} aria-hidden />
          </button>
          <button type="button" className="support-action" onClick={() => openExternal(GITHUB_ISSUES_URL)}>
            <ExternalLink size={18} />
            <span>
              <strong>Report an issue</strong>
              <small>Bugs, ideas, and feedback</small>
            </span>
          </button>
          <button type="button" className="support-action" onClick={() => openExternal(`mailto:${MAINTAINER_EMAIL}`)}>
            <Mail size={18} />
            <span>
              <strong>Contact maintainer</strong>
              <small>{MAINTAINER_NAME}</small>
            </span>
          </button>
        </section>

        <p className="support-note">
          Repository:{' '}
          <button type="button" className="support-inline-link" onClick={() => openExternal(GITHUB_REPO_URL)}>
            {GITHUB_REPO_URL.replace('https://', '')}
          </button>
        </p>

        <details className="support-details">
          <summary>Optional crypto donations</summary>
          <p className="health-subtitle">Never required. Copy an address if you would like to contribute.</p>
          <ul className="support-wallet-list">
            {WALLET_ROWS.map((row) => (
              <li key={row.id}>
                <div className="support-wallet-label">
                  <strong>{row.label}</strong>
                  <code>{row.address}</code>
                </div>
                <button
                  type="button"
                  className="toolbar-button support-copy"
                  aria-label={`Copy ${row.label} address`}
                  onClick={() => void copyWallet(row.id, row.address)}
                >
                  <Copy size={14} />
                  {copiedId === row.id ? 'Copied' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>
        </details>

        <footer className="support-footer">
          <small>
            Licensed under AGPL-3.0 for non-commercial use.{' '}
            <button
              type="button"
              className="support-inline-link"
              onClick={() => openExternal(`${GITHUB_REPO_URL}/blob/main/COMMERCIAL-LICENSING.md`)}
            >
              Commercial licensing
            </button>
          </small>
        </footer>
      </div>
    </UnifiedPanelShell>
  )
}
