/**
 * Read-only GitHub Actions metadata adapter for MAT-022. Does not grant
 * execution, publish artifacts, or promote capability support.
 */
const RUNS_API = 'https://api.github.com/repos/AmirrezaFarnamTaheri/Scriptor/actions/runs/'
const MAX_JOB_PAGES = 10
const PAGE_SIZE = 100
const validId = id => Number.isSafeInteger(id) && id > 0

export function createGithubRunProvider(token, fetcher = fetch) {
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) {
    throw new Error('GitHub token credential is required for workflow metadata inspection')
  }
  const getJson = async url => {
    const response = await fetcher(url, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'error',
    })
    if (!response.ok) throw new Error('GitHub metadata HTTP ' + response.status)
    return response.json()
  }
  return {
    getRun: async id => {
      if (!validId(id)) throw new Error('Invalid workflow run id')
      return getJson(RUNS_API + id)
    },
    getJobs: async id => {
      if (!validId(id)) throw new Error('Invalid workflow run id')
      const jobs = []
      for (let page = 1; page <= MAX_JOB_PAGES; page++) {
        const response = await getJson(RUNS_API + id + '/jobs?per_page=' + PAGE_SIZE + '&page=' + page)
        if (!Array.isArray(response?.jobs)) throw new Error('Malformed GitHub workflow job list')
        jobs.push(...response.jobs)
        if (response.jobs.length < PAGE_SIZE) return { jobs }
      }
      throw new Error('Too many GitHub workflow job pages; cannot verify complete evidence')
    },
  }
}
