#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const docsRoot = join(root, 'docs')
const localeSuffixes = ['de', 'es', 'fa', 'ru', 'zh-CN']
const localePattern = /\.(?:de|es|fa|ru|zh-CN)\.md$/u
const failures = []

function walk(directory) {
  const files = []
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry)
    const rel = relative(root, absolute).replaceAll('\\', '/') 
    if (statSync(absolute).isDirectory()) {
      if (rel === 'docs/_archived' || rel.startsWith('docs/_archived/')) continue
      files.push(...walk(absolute))
      continue
    }
    if (entry.endsWith('.md')) files.push(absolute)
  }
  return files
}

function localePath(source, locale) {
  return source.replace(/\.md$/u, `.${locale}.md`)
}

function fail(file, message) {
  failures.push(`${relative(root, file).replaceAll('\\', '/')}: ${message}`)
}

function checkLanguageNavigation(file, locale) {
  const content = readFileSync(file, 'utf8')
  const labels = ['English', 'فارسی', '简体中文', 'Русский', 'Deutsch', 'Español']
  for (const label of labels) {
    if (!content.includes(label)) fail(file, `language navigation is missing ${label}`)
  }
  const selfMarkers = {
    de: '**Deutsch**',
    es: '**Español**',
    fa: '**فارسی**',
    ru: '**Русский**',
    'zh-CN': '**简体中文**',
  }
  if (!content.includes(selfMarkers[locale])) {
    fail(file, `language navigation does not mark ${locale} as the active locale`)
  }
}

function checkPersianDirection(file) {
  const content = readFileSync(file, 'utf8')
  if (!content.includes('<div dir="ltr" align="center">')) {
    fail(file, 'Persian document must place the language switcher in an explicit LTR container')
  }
  if (!content.includes('<div dir="rtl" lang="fa" align="right">')) {
    fail(file, 'Persian prose must use an explicit RTL Persian container')
  }

  const lines = content.split(/\r?\n/u)
  const dirs = []
  let fence = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!fence) {
      for (const match of line.matchAll(/<div\b[^>]*\bdir="(ltr|rtl)"[^>]*>/gu)) dirs.push(match[1])
      const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/u)
      if (fenceMatch) {
        if (dirs.at(-1) !== 'ltr') {
          fail(file, `fenced code block at line ${index + 1} is not inside an explicit LTR container`)
        }
        fence = fenceMatch[1][0]
      }
      const closeCount = (line.match(/<\/div>/gu) ?? []).length
      for (let count = 0; count < closeCount; count += 1) dirs.pop()
      continue
    }

    if (new RegExp(`^\\s*${fence}{3,}\\s*$`, 'u').test(line)) fence = null
  }
  if (fence) fail(file, 'contains an unclosed fenced code block')
}

const englishDocs = [join(root, 'README.md'), ...walk(docsRoot)]
  .filter((file) => !localePattern.test(file))

for (const source of englishDocs) {
  for (const locale of localeSuffixes) {
    const translated = localePath(source, locale)
    if (!existsSync(translated)) {
      fail(source, `missing ${locale} translation: ${relative(root, translated).replaceAll('\\', '/')}`)
      continue
    }
    checkLanguageNavigation(translated, locale)
    if (locale === 'fa') checkPersianDirection(translated)
  }
}

if (failures.length > 0) {
  console.error(`Documentation localization contract failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Documentation localization contract passed for ${englishDocs.length} active English document(s) across ${localeSuffixes.length} locales.`)
