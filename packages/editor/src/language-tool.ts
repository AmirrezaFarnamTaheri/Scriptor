/** Optional LanguageTool HTTP client (Wave 5 deferral — enabled when server URL is configured). */
export interface LanguageToolMatch {
  message: string
  offset: number
  length: number
  ruleId: string
}

export async function checkLanguageTool(
  text: string,
  endpoint = 'https://api.languagetool.org/v2/check',
  language = 'en-US',
): Promise<LanguageToolMatch[]> {
  const body = new URLSearchParams({ text, language })
  const response = await fetch(endpoint, { method: 'POST', body })
  if (!response.ok) {
    throw new Error(`LanguageTool request failed: ${response.status}`)
  }
  const payload = (await response.json()) as {
    matches?: Array<{ message: string; offset: number; length: number; rule: { id: string } }>
  }
  return (payload.matches ?? []).map((match) => ({
    message: match.message,
    offset: match.offset,
    length: match.length,
    ruleId: match.rule.id,
  }))
}
