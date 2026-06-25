import { BRAND_NAME } from './identity'

export function BrandMark({ className }: { className?: string }) {
  return <img className={className ?? 'brand-mark'} src="/brand-mark.svg" alt="Scriptor" />
}

export function BrandWordmark() {
  return <span className="brand-wordmark">{BRAND_NAME}</span>
}
