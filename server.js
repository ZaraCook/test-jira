import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

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
  return content
    .map((node) => adfNodeToText(node))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

function getJiraConfig() {
  const baseUrl = process.env.JIRA_BASE_URL
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN

  if (!baseUrl || !email || !token) {
    return null
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    auth: Buffer.from(`${email}:${token}`).toString('base64'),
  }
}

function plainTextToAdf(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n')

  const paragraphBlocks = normalized.split(/\n{2,}/)
  const content = paragraphBlocks.map((block) => {
    const lines = block.split('\n')
    const paragraphContent = []

    lines.forEach((line, index) => {
      if (line) {
        paragraphContent.push({
          type: 'text',
          text: line,
        })
      }

      if (index < lines.length - 1) {
        paragraphContent.push({ type: 'hardBreak' })
      }
    })

    return {
      type: 'paragraph',
      content: paragraphContent,
    }
  })

  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: [],
    })
  }

  return {
    type: 'doc',
    version: 1,
    content,
  }
}

function toBase64Utf8(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64')
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

app.post('/api/github/repos/:owner/:repo/branches', async (req, res) => {
  const headers = getGithubHeaders()
  const { owner, repo } = req.params
  const branchName = (req.body?.branchName || '').toString().trim()
  const fromBranch = (req.body?.fromBranch || '').toString().trim()

  if (!headers) {
    return res.status(500).json({
      error: 'Missing GitHub env var GITHUB_TOKEN',
    })
  }

  if (!owner || !repo || !branchName) {
    return res.status(400).json({
      error: 'Missing owner, repository name, or new branch name',
    })
  }

  if (/\s/.test(branchName)) {
    return res.status(400).json({
      error: 'Branch name cannot contain spaces',
    })
  }

  try {
    let sourceBranch = fromBranch

    if (!sourceBranch) {
      const repoUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
      const { response: repoResponse, payload: repoPayload } = await fetchGithubJson(repoUrl, headers)

      if (!repoResponse.ok) {
        return res.status(repoResponse.status).json({
          error: 'Failed to resolve repository default branch',
          details: extractGithubErrorMessage(repoPayload, repoResponse.statusText),
        })
      }

      sourceBranch = (repoPayload?.default_branch || '').toString().trim()
    }

    if (!sourceBranch) {
      return res.status(400).json({
        error: 'Could not resolve source branch',
      })
    }

    const sourceBranchUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(sourceBranch)}`
    const { response: branchResponse, payload: branchPayload } = await fetchGithubJson(sourceBranchUrl, headers)

    if (!branchResponse.ok) {
      return res.status(branchResponse.status).json({
        error: 'Failed to resolve source branch SHA',
        details: extractGithubErrorMessage(branchPayload, branchResponse.statusText),
      })
    }

    const sha = branchPayload?.commit?.sha

    if (!sha) {
      return res.status(500).json({
        error: 'Could not resolve source branch commit SHA',
      })
    }

    const createRefUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`
    const createResponse = await fetch(createRefUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    })

    const createText = await createResponse.text()
    let createPayload = null

    if (createText) {
      try {
        createPayload = JSON.parse(createText)
      } catch {
        createPayload = null
      }
    }

    if (!createResponse.ok) {
      return res.status(createResponse.status).json({
        error: 'Failed to create branch',
        details: extractGithubErrorMessage(createPayload, createResponse.statusText),
      })
    }

    return res.status(201).json({
      created: true,
      repo: `${owner}/${repo}`,
      sourceBranch,
      branch: {
        name: branchName,
        url: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branchName)}`,
      },
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create branch',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.post('/api/github/repos/:owner/:repo/commits', async (req, res) => {
  const headers = getGithubHeaders()
  const { owner, repo } = req.params
  const branch = (req.body?.branch || '').toString().trim()
  const message = (req.body?.message || '').toString().trim()
  const changes = Array.isArray(req.body?.changes) ? req.body.changes : []

  if (!headers) {
    return res.status(500).json({
      error: 'Missing GitHub env var GITHUB_TOKEN',
    })
  }

  if (!owner || !repo || !branch || !message) {
    return res.status(400).json({
      error: 'Missing owner, repository, branch, or commit message',
    })
  }

  if (changes.length === 0) {
    return res.status(400).json({
      error: 'No staged changes provided',
    })
  }

  const normalizedChanges = changes
    .map((change) => ({
      path: (change?.path || '').toString().trim(),
      content: (change?.content || '').toString(),
    }))
    .filter((change) => change.path)

  if (normalizedChanges.length === 0) {
    return res.status(400).json({
      error: 'No valid file changes found',
    })
  }

  try {
    const branchUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`
    const { response: branchResponse, payload: branchPayload } = await fetchGithubJson(branchUrl, headers)

    if (!branchResponse.ok) {
      return res.status(branchResponse.status).json({
        error: 'Failed to resolve branch',
        details: extractGithubErrorMessage(branchPayload, branchResponse.statusText),
      })
    }

    const latestSha = branchPayload?.commit?.sha

    if (!latestSha) {
      return res.status(500).json({
        error: 'Failed to resolve latest branch commit SHA',
      })
    }

    const commitUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(latestSha)}`
    const { response: latestCommitResponse, payload: latestCommitPayload } = await fetchGithubJson(commitUrl, headers)

    if (!latestCommitResponse.ok) {
      return res.status(latestCommitResponse.status).json({
        error: 'Failed to resolve latest commit tree',
        details: extractGithubErrorMessage(latestCommitPayload, latestCommitResponse.statusText),
      })
    }

    const baseTreeSha = latestCommitPayload?.tree?.sha

    if (!baseTreeSha) {
      return res.status(500).json({
        error: 'Base tree SHA not found',
      })
    }

    const treeEntries = []

    for (const change of normalizedChanges) {
      const blobUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`
      const blobResponse = await fetch(blobUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: toBase64Utf8(change.content),
          encoding: 'base64',
        }),
      })

      const blobText = await blobResponse.text()
      const blobPayload = blobText ? JSON.parse(blobText) : {}

      if (!blobResponse.ok) {
        return res.status(blobResponse.status).json({
          error: `Failed to create blob for ${change.path}`,
          details: extractGithubErrorMessage(blobPayload, blobResponse.statusText),
        })
      }

      treeEntries.push({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: blobPayload?.sha,
      })
    }

    const createTreeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`
    const treeResponse = await fetch(createTreeUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    })

    const treeText = await treeResponse.text()
    const treePayload = treeText ? JSON.parse(treeText) : {}

    if (!treeResponse.ok) {
      return res.status(treeResponse.status).json({
        error: 'Failed to create git tree',
        details: extractGithubErrorMessage(treePayload, treeResponse.statusText),
      })
    }

    const newTreeSha = treePayload?.sha

    if (!newTreeSha) {
      return res.status(500).json({
        error: 'New tree SHA not found',
      })
    }

    const createCommitUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`
    const createCommitResponse = await fetch(createCommitUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        tree: newTreeSha,
        parents: [latestSha],
      }),
    })

    const createCommitText = await createCommitResponse.text()
    const createCommitPayload = createCommitText ? JSON.parse(createCommitText) : {}

    if (!createCommitResponse.ok) {
      return res.status(createCommitResponse.status).json({
        error: 'Failed to create commit',
        details: extractGithubErrorMessage(createCommitPayload, createCommitResponse.statusText),
      })
    }

    const newCommitSha = createCommitPayload?.sha

    if (!newCommitSha) {
      return res.status(500).json({
        error: 'New commit SHA not found',
      })
    }

    const updateRefUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`
    const updateRefResponse = await fetch(updateRefUrl, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sha: newCommitSha,
        force: false,
      }),
    })

    const updateRefText = await updateRefResponse.text()
    const updateRefPayload = updateRefText ? JSON.parse(updateRefText) : {}

    if (!updateRefResponse.ok) {
      return res.status(updateRefResponse.status).json({
        error: 'Failed to push commit to branch',
        details: extractGithubErrorMessage(updateRefPayload, updateRefResponse.statusText),
      })
    }

    return res.status(201).json({
      committed: true,
      repo: `${owner}/${repo}`,
      branch,
      commit: {
        sha: newCommitSha,
        url: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
        message,
      },
      filesChanged: normalizedChanges.length,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to stage/commit/push changes',
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
  const jira = getJiraConfig()

  if (!issueKey) {
    return res.status(400).json({
      error: 'Missing issue key',
    })
  }

  if (!jira) {
    return res.status(500).json({
      error:
        'Missing Jira env vars. Required: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN',
    })
  }

  const url = new URL(`${jira.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`)
  url.searchParams.set('fields', '*all')

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${jira.auth}`,
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
        url: `${jira.baseUrl}/browse/${issue.key}`,
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

app.get('/api/issues/:issueKey/transitions', async (req, res) => {
  const issueKey = req.params.issueKey
  const jira = getJiraConfig()

  if (!issueKey) {
    return res.status(400).json({
      error: 'Missing issue key',
    })
  }

  if (!jira) {
    return res.status(500).json({
      error:
        'Missing Jira env vars. Required: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN',
    })
  }

  const url = `${jira.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${jira.auth}`,
      },
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) : {}

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Jira transitions request failed: ${response.status} ${response.statusText}`,
        details: text,
      })
    }

    const transitions = (Array.isArray(payload?.transitions) ? payload.transitions : []).map((item) => ({
      id: item?.id || '',
      name: item?.name || '',
      toStatus: item?.to?.name || '',
    }))

    return res.json({
      issueKey,
      transitions,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error while loading Jira transitions',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.patch('/api/issues/:issueKey', async (req, res) => {
  const issueKey = req.params.issueKey
  const jira = getJiraConfig()

  if (!issueKey) {
    return res.status(400).json({
      error: 'Missing issue key',
    })
  }

  if (!jira) {
    return res.status(500).json({
      error:
        'Missing Jira env vars. Required: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN',
    })
  }

  const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : undefined
  const description = typeof req.body?.description === 'string' ? req.body.description : undefined
  const transitionId = typeof req.body?.transitionId === 'string' ? req.body.transitionId.trim() : ''

  const fields = {}

  if (summary !== undefined) {
    fields.summary = summary
  }

  if (description !== undefined) {
    fields.description = plainTextToAdf(description)
  }

  try {
    if (Object.keys(fields).length > 0) {
      const updateUrl = `${jira.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}`
      const updateResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${jira.auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      })

      const updateText = await updateResponse.text()

      if (!updateResponse.ok) {
        return res.status(updateResponse.status).json({
          error: `Failed to update Jira issue: ${updateResponse.status} ${updateResponse.statusText}`,
          details: updateText,
        })
      }
    }

    if (transitionId) {
      const transitionUrl = `${jira.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`
      const transitionResponse = await fetch(transitionUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${jira.auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transition: {
            id: transitionId,
          },
        }),
      })

      const transitionText = await transitionResponse.text()

      if (!transitionResponse.ok) {
        return res.status(transitionResponse.status).json({
          error: `Failed to transition Jira issue: ${transitionResponse.status} ${transitionResponse.statusText}`,
          details: transitionText,
        })
      }
    }

    return res.json({
      updated: true,
      issueKey,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error while updating Jira issue',
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