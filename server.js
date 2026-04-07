import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

app.use(cors())

function buildBoundedJql(rawJql) {
  const fallback = 'assignee = currentUser() ORDER BY updated DESC'

  if (!rawJql || !rawJql.trim()) {
    return fallback
  }

  const jql = rawJql.trim()
  const hasRestriction =
    /\bassignee\b|\breporter\b|\bcreator\b|\bstatus\b|\bupdated\b|\bcreated\b|\bissuekey\b|\bfilter\b|\bsprint\b|\bproject\s*=|\bproject\s+in\b/i.test(
      jql,
    )

  if (hasRestriction) {
    return jql
  }

  return fallback
}

function adfNodeToText(node) {
  if (!node || typeof node !== 'object') {
    return ''
  }

  if (node.type === 'text') {
    return node.text || ''
  }

  const children = Array.isArray(node.content)
    ? node.content.map((child) => adfNodeToText(child)).join('')
    : ''

  if (node.type === 'paragraph') {
    return `${children}\n\n`
  }

  if (node.type === 'hardBreak') {
    return '\n'
  }

  if (node.type === 'listItem') {
    const itemText = children.trim()
    return itemText ? `- ${itemText}\n` : ''
  }

  return children
}

function jiraDescriptionToPlainText(description) {
  if (!description || typeof description !== 'object') {
    return ''
  }

  const content = Array.isArray(description.content) ? description.content : []
  return content.map((node) => adfNodeToText(node)).join('').trim()
}

function parseGithubRepo(rawRepo) {
  const value = (rawRepo || '').trim()

  if (!value) {
    return null
  }

  // Accept either owner/repo or full GitHub repo URLs.
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value)
      const host = parsed.hostname.toLowerCase()

      if (!host.endsWith('github.com')) {
        return null
      }

      const [owner, repo] = parsed.pathname
        .split('/')
        .filter(Boolean)
        .slice(0, 2)

      if (!owner || !repo) {
        return null
      }

      return {
        owner,
        repo: repo.replace(/\.git$/i, ''),
        fullName: `${owner}/${repo.replace(/\.git$/i, '')}`,
      }
    } catch {
      return null
    }
  }

  const [owner, repo] = value.split('/').map((part) => part.trim())

  if (!owner || !repo) {
    return null
  }

  return {
    owner,
    repo: repo.replace(/\.git$/i, ''),
    fullName: `${owner}/${repo.replace(/\.git$/i, '')}`,
  }
}

function getGithubRepos() {
  const raw = process.env.GITHUB_REPOS || ''
  return raw
    .split(',')
    .map((entry) => parseGithubRepo(entry))
    .filter(Boolean)
}

function getGithubHeaders() {
  const token = process.env.GITHUB_TOKEN

  if (!token) {
    return null
  }

  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function extractGithubErrorMessage(payload, fallback) {
  if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
    return payload.message
  }

  return fallback
}

async function fetchGithubJson(url, headers) {
  const response = await fetch(url, { headers })
  const text = await response.text()

  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  return { response, payload, text }
}

async function fetchAllGithubRepos(headers) {
  const perPage = 100
  const maxPages = Number(process.env.GITHUB_MAX_REPO_PAGES || 5)
  const all = []

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`
    const { response, payload } = await fetchGithubJson(url, headers)

    if (!response.ok) {
      const message = extractGithubErrorMessage(payload, 'Failed to load repositories')
      const error = new Error(message)
      // @ts-ignore
      error.status = response.status
      throw error
    }

    const batch = Array.isArray(payload) ? payload : []
    all.push(...batch)

    if (batch.length < perPage) {
      break
    }
  }

  return all
}

async function fetchGithubRepoMetadata(owner, repo, headers) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  const { response, payload } = await fetchGithubJson(url, headers)

  if (!response.ok) {
    return null
  }

  return {
    name: payload?.full_name || `${owner}/${repo}`,
    defaultBranch: payload?.default_branch || '',
    url: payload?.html_url || `https://github.com/${owner}/${repo}`,
    private: Boolean(payload?.private),
  }
}

async function fetchConfiguredGithubRepos(headers) {
  const configured = getGithubRepos()

  if (configured.length === 0) {
    return []
  }

  const results = []

  for (const repoInfo of configured) {
    try {
      const metadata = await fetchGithubRepoMetadata(
        repoInfo.owner,
        repoInfo.repo,
        headers,
      )

      if (metadata) {
        results.push(metadata)
      } else {
        results.push({
          name: repoInfo.fullName,
          defaultBranch: '',
          url: `https://github.com/${repoInfo.fullName}`,
          private: false,
        })
      }
    } catch {
      results.push({
        name: repoInfo.fullName,
        defaultBranch: '',
        url: `https://github.com/${repoInfo.fullName}`,
        private: false,
      })
    }
  }

  return results
}

async function fetchGithubBranchesForRepo(owner, repo, issueKey, headers) {
  const perPage = process.env.GITHUB_MAX_BRANCHES_PER_REPO || '100'
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${encodeURIComponent(perPage)}`

  const response = await fetch(url, { headers })

  if (!response.ok) {
    return []
  }

  const branches = await response.json()

  return (branches || [])
    .filter((branch) =>
      branch?.name?.toLowerCase().includes(issueKey.toLowerCase()),
    )
    .map((branch) => ({
      name: branch.name,
      url: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branch.name)}`,
      repo: `${owner}/${repo}`,
    }))
}

async function fetchGithubPullRequestsForRepo(owner, repo, issueKey, headers) {
  const perPage = process.env.GITHUB_MAX_PRS_PER_REPO || '30'
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&per_page=${encodeURIComponent(perPage)}&sort=updated&direction=desc`

  const response = await fetch(url, { headers })

  if (!response.ok) {
    return []
  }

  const pulls = await response.json()

  return (pulls || [])
    .filter((pr) => {
      const key = issueKey.toLowerCase()
      const title = pr?.title?.toLowerCase() || ''
      const body = pr?.body?.toLowerCase() || ''
      const headRef = pr?.head?.ref?.toLowerCase() || ''

      return (
        title.includes(key) ||
        body.includes(key) ||
        headRef.includes(key)
      )
    })
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      url: pr.html_url,
      repo: `${owner}/${repo}`,
      branch: pr?.head?.ref || '',
    }))
}

async function fetchGithubLinksForIssue(issueKey) {
  const headers = getGithubHeaders()
  const repos = getGithubRepos()

  if (!headers || repos.length === 0) {
    return {
      enabled: false,
      branches: [],
      pullRequests: [],
      reposChecked: [],
    }
  }

  const allBranches = []
  const allPullRequests = []

  for (const repoInfo of repos) {
    try {
      const [branches, pullRequests] = await Promise.all([
        fetchGithubBranchesForRepo(
          repoInfo.owner,
          repoInfo.repo,
          issueKey,
          headers,
        ),
        fetchGithubPullRequestsForRepo(
          repoInfo.owner,
          repoInfo.repo,
          issueKey,
          headers,
        ),
      ])

      allBranches.push(...branches)
      allPullRequests.push(...pullRequests)
    } catch {
      // Ignore per-repo failures so one bad entry does not fail the whole panel.
    }
  }

  return {
    enabled: true,
    branches: allBranches,
    pullRequests: allPullRequests,
    reposChecked: repos.map((repoInfo) => repoInfo.fullName),
  }
}

app.get('/api/github/repos', async (_req, res) => {
  const headers = getGithubHeaders()

  if (!headers) {
    return res.status(500).json({
      error: 'Missing GitHub env var GITHUB_TOKEN',
    })
  }

  try {
    let normalized = []

    try {
      const repos = await fetchAllGithubRepos(headers)
      normalized = repos
        .map((repo) => ({
          name: repo?.full_name || '',
          defaultBranch: repo?.default_branch || '',
          url: repo?.html_url || '',
          private: Boolean(repo?.private),
        }))
        .filter((repo) => repo.name)
    } catch {
      normalized = []
    }

    const configuredRepos = await fetchConfiguredGithubRepos(headers)
    const deduped = new Map()

    for (const repo of [...configuredRepos, ...normalized]) {
      deduped.set(repo.name, repo)
    }

    return res.json({
      enabled: true,
      repos: [...deduped.values()],
    })
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: 'Failed to load GitHub repositories',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/api/github/repos/:owner/:repo/branches', async (req, res) => {
  const headers = getGithubHeaders()
  const { owner, repo } = req.params

  if (!headers) {
    return res.status(500).json({
      error: 'Missing GitHub env var GITHUB_TOKEN',
    })
  }

  if (!owner || !repo) {
    return res.status(400).json({
      error: 'Missing owner or repository name',
    })
  }

  const perPage = process.env.GITHUB_MAX_BRANCHES_PER_REPO || '100'
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${encodeURIComponent(perPage)}`

  try {
    const { response, payload } = await fetchGithubJson(url, headers)

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to load repository branches',
        details: extractGithubErrorMessage(payload, response.statusText),
      })
    }

    const branches = (Array.isArray(payload) ? payload : [])
      .map((branch) => ({
        name: branch?.name || '',
        url: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branch?.name || '')}`,
      }))
      .filter((branch) => branch.name)

    return res.json({
      enabled: true,
      repo: `${owner}/${repo}`,
      branches,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to load repository branches',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/api/github/repos/:owner/:repo/files', async (req, res) => {
  const headers = getGithubHeaders()
  const { owner, repo } = req.params
  const branch = (req.query.branch || '').toString().trim()

  if (!headers) {
    return res.status(500).json({
      error: 'Missing GitHub env var GITHUB_TOKEN',
    })
  }

  if (!owner || !repo || !branch) {
    return res.status(400).json({
      error: 'Missing owner, repository name, or branch',
    })
  }

  const maxFiles = Number(process.env.GITHUB_MAX_FILES_PER_BRANCH || 2000)

  try {
    const branchUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`
    const { response: branchResponse, payload: branchPayload } = await fetchGithubJson(branchUrl, headers)

    if (!branchResponse.ok) {
      return res.status(branchResponse.status).json({
        error: 'Failed to resolve branch',
        details: extractGithubErrorMessage(branchPayload, branchResponse.statusText),
      })
    }

    const treeSha = branchPayload?.commit?.commit?.tree?.sha
    if (!treeSha) {
      return res.status(500).json({
        error: 'Branch tree SHA not found',
      })
    }

    const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`
    const { response, payload } = await fetchGithubJson(treeUrl, headers)

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to load branch files',
        details: extractGithubErrorMessage(payload, response.statusText),
      })
    }

    const tree = Array.isArray(payload?.tree) ? payload.tree : []
    const files = tree
      .filter((item) => item?.type === 'blob' && typeof item?.path === 'string')
      .map((item) => ({ path: item.path }))
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, maxFiles)

    return res.json({
      enabled: true,
      repo: `${owner}/${repo}`,
      branch,
      files,
      truncated: Boolean(payload?.truncated) || files.length === maxFiles,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to load branch files',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/api/github/repos/:owner/:repo/file', async (req, res) => {
  const headers = getGithubHeaders()
  const { owner, repo } = req.params
  const branch = (req.query.branch || '').toString().trim()
  const filePath = (req.query.path || '').toString().trim()

  if (!headers) {
    return res.status(500).json({
      error: 'Missing GitHub env var GITHUB_TOKEN',
    })
  }

  if (!owner || !repo || !branch || !filePath) {
    return res.status(400).json({
      error: 'Missing owner, repository name, branch, or file path',
    })
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`

  try {
    const { response, payload } = await fetchGithubJson(url, headers)

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Failed to load file content',
        details: extractGithubErrorMessage(payload, response.statusText),
      })
    }

    if (Array.isArray(payload)) {
      return res.status(400).json({
        error: 'Selected path points to a directory, not a file',
      })
    }

    const rawContent = typeof payload?.content === 'string' ? payload.content.replace(/\n/g, '') : ''
    const decodedContent = rawContent
      ? Buffer.from(rawContent, payload?.encoding || 'base64').toString('utf8')
      : ''

    return res.json({
      enabled: true,
      repo: `${owner}/${repo}`,
      branch,
      file: {
        path: payload?.path || filePath,
        content: decodedContent,
        htmlUrl: payload?.html_url || `https://github.com/${owner}/${repo}/blob/${encodeURIComponent(branch)}/${filePath}`,
      },
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to load file content',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/api/issues', async (_req, res) => {
  console.log('Received request for /api/issues')

  const baseUrl = process.env.JIRA_BASE_URL
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN
  const jql = buildBoundedJql(process.env.JIRA_JQL)

  if (!baseUrl || !email || !token) {
    return res.status(500).json({
      error:
        'Missing Jira env vars. Required: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN',
    })
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  const url = new URL(`${cleanBaseUrl}/rest/api/3/search/jql`)
  url.searchParams.set('jql', jql)
  url.searchParams.set('maxResults', process.env.JIRA_MAX_RESULTS || '1000')
  url.searchParams.set(
    'fields',
    'summary,status,issuetype,priority,assignee,updated',
  )

  console.log('Calling Jira URL:', url.toString())

  const auth = Buffer.from(`${email}:${token}`).toString('base64')

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
    })

    const responseText = await response.text()

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Jira request failed: ${response.status} ${response.statusText}`,
        details: responseText,
      })
    }

    const data = JSON.parse(responseText)

    const issues = (data.issues || []).map((issue) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields?.summary || 'No summary',
      status: issue.fields?.status?.name || 'Unknown',
      type: issue.fields?.issuetype?.name || 'Unknown',
      priority: issue.fields?.priority?.name || 'None',
      assignee: issue.fields?.assignee?.displayName || 'Unassigned',
      updated: issue.fields?.updated || null,
      url: `${cleanBaseUrl}/browse/${issue.key}`,
    }))

    return res.json({
      total: data.total || issues.length,
      issues,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error while calling Jira',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/api/issues/:issueKey', async (req, res) => {
  const issueKey = req.params.issueKey
  const baseUrl = process.env.JIRA_BASE_URL
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN

  if (!issueKey) {
    return res.status(400).json({
      error: 'Missing issue key',
    })
  }

  if (!baseUrl || !email || !token) {
    return res.status(500).json({
      error:
        'Missing Jira env vars. Required: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN',
    })
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  const url = new URL(`${cleanBaseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`)
  url.searchParams.set('fields', '*all')

  const auth = Buffer.from(`${email}:${token}`).toString('base64')

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
    })

    const responseText = await response.text()

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Jira request failed: ${response.status} ${response.statusText}`,
        details: responseText,
      })
    }

    const issue = JSON.parse(responseText)
    const fields = issue?.fields || {}

    return res.json({
      issue: {
        id: issue.id,
        key: issue.key,
        summary: fields?.summary || 'No summary',
        status: fields?.status?.name || 'Unknown',
        type: fields?.issuetype?.name || 'Unknown',
        priority: fields?.priority?.name || 'None',
        assignee: fields?.assignee?.displayName || 'Unassigned',
        reporter: fields?.reporter?.displayName || 'Unknown',
        creator: fields?.creator?.displayName || 'Unknown',
        created: fields?.created || null,
        updated: fields?.updated || null,
        labels: Array.isArray(fields?.labels) ? fields.labels : [],
        components: Array.isArray(fields?.components)
          ? fields.components.map((item) => item?.name).filter(Boolean)
          : [],
        fixVersions: Array.isArray(fields?.fixVersions)
          ? fields.fixVersions.map((item) => item?.name).filter(Boolean)
          : [],
        description: jiraDescriptionToPlainText(fields?.description),
        url: `${cleanBaseUrl}/browse/${issue.key}`,
        rawFields: fields,
      },
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error while loading Jira issue details',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.get('/api/issues/:issueKey/links', async (req, res) => {
  const issueKey = req.params.issueKey

  if (!issueKey) {
    return res.status(400).json({
      error: 'Missing issue key',
    })
  }

  try {
    const github = await fetchGithubLinksForIssue(issueKey)

    return res.json({
      issueKey,
      github,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error while fetching GitHub links',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.listen(port, () => {
  console.log(`Jira API proxy running on http://localhost:${port}`)
})