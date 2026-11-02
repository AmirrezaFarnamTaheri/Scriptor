/** Read-only, bounded, no-token-to-CDN adapter for source-bound Actions ZIPs. */
const API = 'https://api.github.com/repos/AmirrezaFarnamTaheri/Scriptor/actions/'
const validId = id => Number.isSafeInteger(id) && id > 0
const headers = token => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})
function approvedRedirect(location) {
  try {
    const url = new URL(location)
    const hostname = url.hostname.toLowerCase()
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (hostname.endsWith('.blob.core.windows.net') ||
        hostname.endsWith('.actions.githubusercontent.com') ||
        hostname === 'objects.githubusercontent.com')
  } catch {
    return false
  }
}

export function createGithubArtifactProvider(token, fetcher = fetch) {
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) {
    throw new Error('GitHub token credential required for artifact verification')
  }
  const authHeaders = headers(token)
  const getJson = async (url) => {
    const response = await fetcher(url, { headers: authHeaders, redirect: 'error' })
    if (!response.ok) throw new Error(`GitHub artifact API HTTP ${response.status}`)
    return response.json()
  }
  return {
    getRun: async id => {
      if (!validId(id)) throw new Error('Invalid workflow run id')
      return getJson(API + 'runs/' + id)
    },
    getArtifact: async id => {
      if (!validId(id)) throw new Error('Invalid artifact id')
      return getJson(API + 'artifacts/' + id)
    },
    downloadArchive: async function* (id) {
      if (!validId(id)) throw new Error('Invalid artifact id')
      const initial = await fetcher(API + 'artifacts/' + id + '/zip', {
        headers: authHeaders, redirect: 'manual',
      })
      if (initial.status !== 302) {
        throw new Error(`GitHub download HTTP ${initial.status}; expected artifact redirect`)
      }
      const location = initial.headers.get('location')
      if (!approvedRedirect(location)) throw new Error('Untrusted artifact redirect')
      // GitHub gives a time-limited signed URL. Never carry our bearer token to
      // the artifact storage host, even if it is allowed by the HTTP client.
      const downloaded = await fetcher(location, {
        headers: { Accept: 'application/zip' },
        redirect: 'error', credentials: 'omit', referrerPolicy: 'no-referrer',
      })
      if (!downloaded.ok) throw new Error(`Artifact archive HTTP ${downloaded.status}`)
      if (!downloaded.body) throw new Error('Empty artifact archive body')
      for await (const chunk of downloaded.body) yield chunk
    },
  }
}
