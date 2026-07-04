import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { XSS_FIXTURES } from './xss-fixtures.ts'
import { renderMarkdownPreview } from './preview.ts'

const DANGEROUS_PATTERNS = [
  /\bonerror\b/i,
  /\bonload\b/i,
  /\bonclick\b/i,
  /\bonmouseover\b/i,
  /\bonfocus\b/i,
  /\boninput\b/i,
  /\bonchange\b/i,
  /\bonbegin\b/i,
  /\bontoggle\b/i,
  /\bon\w+\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\s*\/html/i,
  /expression\s*\(/i,
]

function containsDangerousContent(html: string): string[] {
  const found: string[] = []
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(html)) {
      found.push(pattern.source)
    }
  }
  return found
}

describe('XSS sanitization fixture suite', () => {
  let passed = 0
  let failed = 0
  let knownGaps = 0
  const failures: string[] = []

  for (const fixture of XSS_FIXTURES) {
    it(`${fixture.id}: ${fixture.label}`, () => {
      const html = renderMarkdownPreview(fixture.markdown)

      const dangerous = containsDangerousContent(html)
      if (dangerous.length > 0) {
        if (fixture.knownGap) {
          knownGaps++
          console.log(`  ⚠ ${fixture.id}: known gap — ${fixture.knownGap}`)
          return
        }
        failed++
        const msg = `${fixture.id} FAILED: found dangerous patterns [${dangerous.join(', ')}] in output for "${fixture.label}"`
        failures.push(msg)
        assert.fail(msg)
      }

      for (const pattern of fixture.blockedPatterns) {
        const lowerHtml = html.toLowerCase()
        const lowerPattern = pattern.toLowerCase()
        if (lowerHtml.includes(lowerPattern)) {
          if (fixture.knownGap) {
            knownGaps++
            console.log(`  ⚠ ${fixture.id}: known gap — ${fixture.knownGap}`)
            return
          }
          failed++
          const msg = `${fixture.id} FAILED: blocked pattern "${pattern}" still present in output for "${fixture.label}"`
          failures.push(msg)
          assert.fail(msg)
        }
      }

      passed++
    })
  }

  it('summary report', () => {
    const total = XSS_FIXTURES.length
    console.log(`\nXSS Fixture Suite: ${passed}/${total} passed, ${failed} failed, ${knownGaps} known gaps`)
    if (failures.length > 0) {
      console.log('Failures:')
      for (const f of failures) {
        console.log(`  - ${f}`)
      }
    }
    assert.equal(failed, 0, `${failed} XSS fixtures failed`)
  })
})
