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

let hunspellWords: Set<string> | null = null
let loadPromise: Promise<Set<string>> | null = null

export async function loadHunspellDictionary(url = '/dictionaries/en_US.dic'): Promise<Set<string>> {
  if (hunspellWords) return hunspellWords
  if (!loadPromise) {
    loadPromise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`dictionary fetch failed: ${response.status}`)
        return response.text()
      })
      .then((text) => {
        hunspellWords = parseHunspellDic(text)
        return hunspellWords
      })
      .catch(() => {
        hunspellWords = new Set()
        return hunspellWords
      })
  }
  return loadPromise
}

export function getHunspellDictionary(): Set<string> | null {
  return hunspellWords
}
