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