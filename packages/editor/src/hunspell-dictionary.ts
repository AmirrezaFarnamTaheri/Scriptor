/** Parse Hunspell `.dic` word lists (affix flags ignored; base words only). */
export function parseHunspellDic(text: string): Set<string> {
  const lines = text.split(/\r?\n/)
  const words = new Set<string>()
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim()
    if (!line || line.startsWith('#')) continue
    const token = line.split('/')[0]?.trim()
    if (token && /^[A-Za-z][A-Za-z'-]*$/.test(token)) {
      words.add(token.toLowerCase())
    }
  }
  return words
}

/**
 * Locale → Hunspell `.dic` asset map.
 *
 * Honesty rule: every entry here MUST have its asset present under
 * `public/dictionaries/` — `scripts/validation/dictionary-asset-contracts.test.mjs`
 * fails the build otherwise. To add a locale: drop `<locale>.dic` into
 * `public/dictionaries/`, then add the entry. Selecting a locale without a
 * shipped asset silently yields an empty word set (spellcheck does nothing),
 * so unshipped locales must never be advertised.
 */
export const LOCALE_MAP: Record<string, { dic: string; aff?: string }> = {
  'en-US': { dic: '/dictionaries/en_US.dic' },
}

export const SUPPORTED_LOCALES = Object.keys(LOCALE_MAP)
export const DEFAULT_HUNSPELL_LOCALE = 'en-US'

export function resolveHunspellLocale(locale: string): string {
  return Object.hasOwn(LOCALE_MAP, locale) ? locale : DEFAULT_HUNSPELL_LOCALE
}

const dictionariesByLocale = new Map<string, Set<string>>()
const loadPromisesByLocale = new Map<string, Promise<Set<string>>>()
let activeLocale = DEFAULT_HUNSPELL_LOCALE

export async function loadHunspellLocale(locale: string): Promise<Set<string>> {
  locale = resolveHunspellLocale(locale)
  const existing = dictionariesByLocale.get(locale)
  if (existing) return existing

  const pending = loadPromisesByLocale.get(locale)
  if (pending) return pending

  const entry = LOCALE_MAP[locale]
  if (!entry) return new Set<string>()

  const promise = fetch(entry.dic)
    .then((response) => {
      if (!response.ok) throw new Error(`dictionary fetch failed: ${response.status}`)
      return response.text()
    })
    .then((text) => {
      const words = parseHunspellDic(text)
      dictionariesByLocale.set(locale, words)
      return words
    })
    .catch(() => {
      const empty = new Set<string>()
      dictionariesByLocale.set(locale, empty)
      return empty
    })

  loadPromisesByLocale.set(locale, promise)
  return promise
}

export function setActiveHunspellLocale(locale: string): void {
  activeLocale = resolveHunspellLocale(locale)
}

export function getActiveHunspellLocale(): string {
  return activeLocale
}

export async function loadHunspellDictionary(_url = '/dictionaries/en_US.dic'): Promise<Set<string>> {
  return loadHunspellLocale(activeLocale)
}

export function getHunspellDictionary(): Set<string> | null {
  return dictionariesByLocale.get(activeLocale) ?? null
}
