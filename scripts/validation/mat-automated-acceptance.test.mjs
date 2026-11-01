import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const doc = (path) => readFileSync(resolve(root, path), 'utf8')
const policy = () => doc('docs/MAT-AUTOMATED-ACCEPTANCE.md')

test('MAT-001–024: all workstreams retain substantive implementation checklists', () => {
  const backlog = doc('tasks/plans/2026-10-27-product-maturation-backlog.md')
  const ids = [...backlog.matchAll(/^- \[ \] \*\*MAT-(\d{3})\s+—/gm)].map((match) => match[1])
  assert.deepEqual(ids, Array.from({ length: 24 }, (_, index) => String(index + 1).padStart(3, '0')))
})

test('MAT automation policy removes human/project installation gates but keeps native consent and release integrity', () => {
  const text = policy()
  assert.match(text, /real-world installation/i)
  assert.match(text, /human approval\/sign-off/i)
  assert.match(text, /no manual or physical acceptance gate/i)
  assert.match(text, /in-product user consent or authorization/i)
  assert.match(text, /indeterminate-effect handling/i)
  assert.match(text, /immutable tags/i)
  assert.match(text, /partial PR is not completion/i)
})

test('MAT policy is linked from authoritative verification, backlog, capability ledger and design docs', () => {
  for (const path of [
    'tasks/plans/2026-10-27-product-maturation-backlog.md',
    'tasks/plans/2026-10-30-mat-006-024-acceptance-register.md',
    'docs/VERIFICATION.md',
    'docs/CAPABILITY-MATURITY.md',
  ]) assert.match(doc(path), /MAT-AUTOMATED-ACCEPTANCE\.md/, path)
  assert.match(doc('DESIGN.md'), /automated 200% zoom/i)
})

test('MAT automated acceptance is published in five navigable localizations with Persian RTL', () => {
  const languages = { de: 'Deutsch', es: 'Español', fa: 'فارسی', ru: 'Русский', 'zh-CN': '简体中文' }
  const labels = ['English', 'فارسی', '简体中文', 'Русский', 'Deutsch', 'Español']
  for (const [locale, label] of Object.entries(languages)) {
    const text = doc(`docs/MAT-AUTOMATED-ACCEPTANCE.${locale}.md`)
    for (const name of labels) assert.ok(text.includes(name), `Missing ${name} in ${locale} navigation`)
    assert.ok(text.includes(`**${label}**`), `Missing active ${locale} locale marker`)
    if (locale === 'fa') {
      assert.ok(text.includes('<div dir="ltr" align="center">'))
      assert.ok(text.includes('<div dir="rtl" lang="fa" align="right">'))
    }
  }
})
