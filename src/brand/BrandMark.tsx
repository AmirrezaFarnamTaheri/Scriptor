import { BRAND_NAME } from './identity'
import originalBrandMark from '../../docs/brand/app-icon.svg?raw'

const themedBrandMark = originalBrandMark
  .replace('<svg ', '<svg aria-hidden="true" focusable="false" ')
  .replace(
    '<defs>',
    `<defs>
    <style>
      #bgGrad stop:nth-child(1) { stop-color: var(--surface-raised, #050814); }
      #bgGrad stop:nth-child(2) { stop-color: color-mix(in srgb, var(--surface-raised, #0b172a) 82%, var(--primary, #0d9488)); }
      #bgGrad stop:nth-child(3) { stop-color: color-mix(in srgb, var(--surface-raised, #072a2e) 62%, var(--primary-strong, #0f766e)); }
      #borderGrad stop { stop-color: var(--primary, #14b8a6); }
      #tileBaseGrad stop:first-child { stop-color: var(--primary, #0d9488); }
      #tileBaseGrad stop:last-child { stop-color: color-mix(in srgb, var(--primary-strong, #032f30) 58%, black); }
      #tileTopGrad stop:first-child { stop-color: color-mix(in srgb, var(--primary, #14b8a6) 82%, white); }
      #tileTopGrad stop:last-child { stop-color: var(--primary-strong, #0f766e); }
      #dotGrid circle { fill: var(--primary, #2dd4bf); }
    </style>`,
  )

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-label={BRAND_NAME}
      className={className ?? 'brand-mark'}
      role="img"
      dangerouslySetInnerHTML={{ __html: themedBrandMark }}
    />
  )
}

export function BrandWordmark() {
  return <span className="brand-wordmark">{BRAND_NAME}</span>
}
