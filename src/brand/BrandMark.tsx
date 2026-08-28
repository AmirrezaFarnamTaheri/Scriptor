import { BRAND_NAME } from './identity'

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-label={BRAND_NAME}
      className={className ?? 'brand-mark'}
      role="img"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{BRAND_NAME}</title>
      <rect fill="var(--surface-raised)" height="30" rx="8" stroke="var(--border)" width="30" x="1" y="1" />
      <path
        d="M21.75 7.5H12a4.5 4.5 0 0 0 0 9h8a2.5 2.5 0 1 1 0 5h-9.75"
        fill="none"
        stroke="var(--primary)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path d="M10 7.5h5M17 24.5h5" fill="none" stroke="var(--ink-strong)" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

export function BrandWordmark() {
  return <span className="brand-wordmark">{BRAND_NAME}</span>
}
