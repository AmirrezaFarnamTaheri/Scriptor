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

export const LOCALE_MAP: Record<string, { dic: string; aff?: string }> = {
  'en-US': { dic: '/dictionaries/en_US.dic' },
  'en-GB': { dic: '/dictionaries/en_GB.dic' },
  de: { dic: '/dictionaries/de_DE.dic' },
  fr: { dic: '/dictionaries/fr.dic' },
  es: { dic: '/dictionaries/es_ES.dic' },
  pt: { dic: '/dictionaries/pt_PT.dic' },
  it: { dic: '/dictionaries/it_IT.dic' },
  nl: { dic: '/dictionaries/nl_NL.dic' },
  ru: { dic: '/dictionaries/ru_RU.dic' },
  ar: { dic: '/dictionaries/ar.dic' },
  fa: { dic: '/dictionaries/fa_IR.dic' },
}

export const SUPPORTED_LOCALES = Object.keys(LOCALE_MAP)

const dictionariesByLocale = new Map<string, Set<string>>()
const loadPromisesByLocale = new Map<string, Promise<Set<string>>>()
let activeLocale = 'en-US'

export async function loadHunspellLocale(locale: string): Promise<Set<string>> {
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
  activeLocale = locale
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
