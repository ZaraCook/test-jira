import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config({ path: '.env' })

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

function getAiConfig() {
  const model = (process.env.AI_MODEL || 'Qwen/Qwen2.5-Coder-32B-Instruct').trim()
  const apiKey = (process.env.AI_API_KEY || '').trim()

  if (!apiKey.trim()) {
    return null
  }

  return {
    model,
    apiKey,
    baseUrl: 'https://router.huggingface.co/v1',
  }
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') {
    return null
  }

  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1])
    } catch {
      // fall through
    }
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(candidate)
    } catch {
      return null
    }
  }

  return null
}

function normalizeAiResponse(payload, fallbackText) {
  const safe = payload && typeof payload === 'object' ? payload : {}

  const branchSuggestions = Array.isArray(safe.branchSuggestions)
    ? safe.branchSuggestions.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : []

  const fixPlan = Array.isArray(safe.fixPlan)
    ? safe.fixPlan.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10)
    : []

  const planSteps = Array.isArray(safe.planSteps)
    ? safe.planSteps.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 10)
    : []

  const implementationChanges = Array.isArray(safe.implementationChanges)
    ? safe.implementationChanges
        .map((item) => ({
          path: typeof item?.path === 'string' ? item.path.trim() : '',
          action: ['create', 'update', 'delete'].includes(String(item?.action || '').toLowerCase())
            ? String(item.action).toLowerCase()
            : 'update',
          content: typeof item?.content === 'string' ? item.content : '',
          reason: typeof item?.reason === 'string' ? item.reason.trim() : '',
        }))
        .filter((item) => item.path)
        .slice(0, 20)
    : []

  return {
    ticketExplanation:
      typeof safe.ticketExplanation === 'string' && safe.ticketExplanation.trim()
        ? safe.ticketExplanation.trim()
        : fallbackText,
    updatedSummary:
      typeof safe.updatedSummary === 'string' && safe.updatedSummary.trim()
        ? safe.updatedSummary.trim()
        : '',
    updatedDescription:
      typeof safe.updatedDescription === 'string' && safe.updatedDescription.trim()
        ? safe.updatedDescription.trim()
        : '',
    ticketUpdateReasoning:
      typeof safe.ticketUpdateReasoning === 'string' && safe.ticketUpdateReasoning.trim()
        ? safe.ticketUpdateReasoning.trim()
        : '',
    branchSuggestions,
    fixPlan,
    planSteps: planSteps.length > 0 ? planSteps : fixPlan,
    planSummary:
      typeof safe.planSummary === 'string' && safe.planSummary.trim() ? safe.planSummary.trim() : '',
    reviewNotes:
      typeof safe.reviewNotes === 'string' && safe.reviewNotes.trim() ? safe.reviewNotes.trim() : '',
    implementationSummary:
      typeof safe.implementationSummary === 'string' && safe.implementationSummary.trim()
        ? safe.implementationSummary.trim()
        : '',
    implementationChanges,
  }
}

function enforceSnapshotConsistency(aiResult, snapshot) {
  if (!aiResult || !snapshot) {
    return aiResult
  }

  const totalFiles = Number(snapshot.fileCount || 0)
  const readableFiles = Number(snapshot.readableFileCount || 0)

  if (totalFiles <= 0) {
    return aiResult
  }

  const contradictionPattern = /\bempty\b|\b0\s+files?\b/i
  const snapshotSummary = `Repository snapshot shows ${totalFiles} file(s) on this branch (${readableFiles} readable text/code file(s)).`

  const next = { ...aiResult }

  if (typeof next.ticketExplanation === 'string' && contradictionPattern.test(next.ticketExplanation)) {
    next.ticketExplanation = `${snapshotSummary} ${next.ticketExplanation}`.trim()
  }

  if (typeof next.ticketUpdateReasoning === 'string' && contradictionPattern.test(next.ticketUpdateReasoning)) {
    next.ticketUpdateReasoning = `${snapshotSummary} ${next.ticketUpdateReasoning}`.trim()
  }

  return next
}

function inferAiTask(promptText, issueSummary) {
  const prompt = `${promptText || ''} ${issueSummary?.summary || ''} ${issueSummary?.description || ''}`.toLowerCase()

  if (/review plan|approve plan|check the plan|plan review/.test(prompt)) {
    return 'review-plan'
  }

  if (/implement changes|implement the changes|apply the plan|build the changes|code the changes/.test(prompt)) {
    return 'implement-changes'
  }

  if (/branch/.test(prompt)) {
    return 'suggest-branches'
  }

  if (/implement|repo|structure|files?|walk me through|entry point|where should/i.test(prompt)) {
    return 'suggest-implementation'
  }

  if (/update|rewrite|draft|edit jira|edit the ticket|improve the ticket|ticket update/.test(prompt)) {
    return 'update-ticket'
  }

  if (/fix plan|how (?:do i|to) fix|start fixing|investigate|first step/.test(prompt)) {
    return 'suggest-fix'
  }

  return 'explain-ticket'
}

function buildRepoSnapshot(repoFiles) {
  const files = Array.isArray(repoFiles)
    ? repoFiles.map((item) => String(item || '').trim()).filter(Boolean)
    : []

  const maxFiles = 250
  const visibleFiles = files.slice(0, maxFiles)
  const omittedCount = Math.max(0, files.length - visibleFiles.length)

  return {
    fileCount: files.length,
    omittedCount,
    files: visibleFiles,
  }
}

const TEXT_FILE_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.css',
  '.editorconfig',
  '.env',
  '.gql',
  '.graphql',
  '.gitignore',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.js',
  '.jsx',
  '.json',
  '.less',
  '.md',
  '.mjs',
  '.py',
  '.rb',
  '.rs',
  '.scss',
  '.sh',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.vue',
  '.yaml',
  '.yml',
])

const BINARY_FILE_EXTENSIONS = new Set([
  '.7z',
  '.avi',
  '.bin',
  '.bmp',
  '.dll',
  '.doc',
  '.docx',
  '.exe',
  '.gif',
  '.ico',
  '.jar',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.psd',
  '.svg',
  '.tar',
  '.tif',
  '.tiff',
  '.woff',
  '.woff2',
  '.xls',
  '.xlsx',
  '.zip',
])

function isLikelyTextFile(filePath) {
  const lowerPath = String(filePath || '').toLowerCase()

  if (!lowerPath) {
    return false
  }

  if (lowerPath.endsWith('readme') || lowerPath.endsWith('license') || lowerPath.endsWith('changelog')) {
    return true
  }

  const extensionMatch = lowerPath.match(/\.[^./\\]+$/)
  const extension = extensionMatch ? extensionMatch[0] : ''

  if (BINARY_FILE_EXTENSIONS.has(extension)) {
    return false
  }

  if (TEXT_FILE_EXTENSIONS.has(extension)) {
    return true
  }

  return !extension
}

function decodeGithubBlobContent(payload) {
  const rawContent = typeof payload?.content === 'string' ? payload.content.replace(/\n/g, '') : ''

  if (!rawContent) {
    return ''
  }

  try {
    return Buffer.from(rawContent, payload?.encoding || 'base64').toString('utf8')
  } catch {
    return ''
  }
}

async function fetchGithubRepoSnapshot(owner, repo, branch, headers) {
  const maxFiles = Number(process.env.GITHUB_MAX_SNAPSHOT_FILES || 250)
  const maxCharsPerFile = Number(process.env.GITHUB_MAX_SNAPSHOT_FILE_CHARS || 12000)
  const maxTotalChars = Number(process.env.GITHUB_MAX_SNAPSHOT_TOTAL_CHARS || 200000)

  const branchUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`
  const { response: branchResponse, payload: branchPayload } = await fetchGithubJson(branchUrl, headers)

  if (!branchResponse.ok) {
    throw new Error(extractGithubErrorMessage(branchPayload, branchResponse.statusText))
  }

  const treeSha = branchPayload?.commit?.commit?.tree?.sha

  if (!treeSha) {
    throw new Error('Branch tree SHA not found')
  }

  const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`
  const { response: treeResponse, payload: treePayload } = await fetchGithubJson(treeUrl, headers)

  if (!treeResponse.ok) {
    throw new Error(extractGithubErrorMessage(treePayload, treeResponse.statusText))
  }

  const tree = Array.isArray(treePayload?.tree) ? treePayload.tree : []
  const blobs = tree
    .filter((item) => item?.type === 'blob' && typeof item?.path === 'string')
    .map((item) => ({
      path: item.path,
      sha: item.sha,
      size: Number(item.size || 0),
    }))
    .sort((a, b) => a.path.localeCompare(b.path))

  const files = []
  let totalContentChars = 0
  let omittedCount = 0

  for (const blob of blobs) {
    if (files.length >= maxFiles || totalContentChars >= maxTotalChars) {
      omittedCount += 1
      continue
    }

    if (!isLikelyTextFile(blob.path)) {
      files.push({
        path: blob.path,
        content: '',
        readable: false,
        skippedReason: 'binary-or-unsupported-file-type',
      })
      continue
    }

    const blobUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(blob.sha)}`
    const { response: blobResponse, payload: blobPayload } = await fetchGithubJson(blobUrl, headers)

    if (!blobResponse.ok) {
      files.push({
        path: blob.path,
        content: '',
        readable: false,
        skippedReason: extractGithubErrorMessage(blobPayload, blobResponse.statusText),
      })
      continue
    }

    const decodedContent = decodeGithubBlobContent(blobPayload)
    const trimmedContent = decodedContent.slice(0, maxCharsPerFile)
    const truncated = decodedContent.length > trimmedContent.length

    totalContentChars += trimmedContent.length
    files.push({
      path: blob.path,
      content: trimmedContent,
      readable: true,
      truncated,
      size: blob.size,
    })
  }

  return {
    repo: `${owner}/${repo}`,
    branch,
    fileCount: blobs.length,
    omittedCount,
    truncated: omittedCount > 0 || totalContentChars >= maxTotalChars,
    files,
  }
}

function formatRepoSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.files)) {
    return 'Repository snapshot unavailable.'
  }

  const sections = []

  for (const file of snapshot.files) {
    if (!file?.path) {
      continue
    }

    sections.push([
      `File: ${file.path}`,
      file.readable === false
        ? `[Skipped ${file.skippedReason || 'unreadable file'}]`
        : file.content || '[Empty file]',
      file.truncated ? '[Content truncated]' : '',
    ].filter(Boolean).join('\n'))
  }

  if (snapshot.omittedCount > 0) {
    sections.push(`Omitted files: ${snapshot.omittedCount}`)
  }

  return sections.join('\n\n---\n\n')
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

app.post('/api/ai/assist', async (req, res) => {
  const ai = getAiConfig()
  const githubHeaders = getGithubHeaders()

  if (!ai) {
    return res.status(500).json({
      error: 'Missing AI provider credentials. Set AI_API_KEY in .env.',
    })
  }

  if (!githubHeaders) {
    return res.status(500).json({
      error: 'Missing GitHub env var GITHUB_TOKEN',
    })
  }

  const task = (req.body?.task || '').toString().trim()
  const userExplanation = (req.body?.userExplanation || '').toString().trim()
  const planDraft = (req.body?.planDraft || '').toString().trim()
  const approvedPlan = (req.body?.approvedPlan || '').toString().trim()
  const issue = req.body?.issue && typeof req.body.issue === 'object' ? req.body.issue : null
  const repo = (req.body?.repo || '').toString().trim()
  const branch = (req.body?.branch || '').toString().trim()
  const existingBranches = Array.isArray(req.body?.existingBranches)
    ? req.body.existingBranches.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 100)
    : []

  if (!issue || !issue.key) {
    return res.status(400).json({
      error: 'Missing issue payload',
    })
  }

  const issueSummary = {
    key: String(issue.key || ''),
    summary: String(issue.summary || ''),
    description: String(issue.description || ''),
    status: String(issue.status || ''),
    type: String(issue.type || ''),
    priority: String(issue.priority || ''),
    assignee: String(issue.assignee || ''),
    labels: Array.isArray(issue.labels) ? issue.labels.map((item) => String(item || '')).slice(0, 50) : [],
    components: Array.isArray(issue.components)
      ? issue.components.map((item) => String(item || '')).slice(0, 50)
      : [],
  }

  const parsedRepo = parseGithubRepo(repo)

  if (!parsedRepo || !branch) {
    return res.status(400).json({
      error: 'Select a repository and branch before asking AI to review code or implement changes.',
    })
  }

  let repoSnapshot = buildRepoSnapshot(req.body?.repoFiles)

  try {
    repoSnapshot = await fetchGithubRepoSnapshot(parsedRepo.owner, parsedRepo.repo, branch, githubHeaders)
  } catch (snapshotError) {
    return res.status(500).json({
      error: 'Failed to load repository snapshot',
      details: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
    })
  }

  const taskInstructions = {
    'explain-ticket':
      'Explain the Jira issue in plain language for engineers and product stakeholders. Mention the likely problem, expected behavior, risk, and what done looks like.',
    'update-ticket':
      'Use the user explanation to propose improved Jira summary and description. Keep changes concrete and actionable.',
    'suggest-branches':
      'Suggest practical Git branch names for implementing this issue. Follow branch naming conventions and include the issue key in names.',
    'suggest-fix':
      'Suggest how to start fixing this issue with an ordered action plan including investigation, coding, testing, and rollout checks.',
    'review-plan':
      'Review the draft implementation plan. Improve the wording, identify missing steps or risks, and return a refined plan that is ready for approval.',
    'suggest-implementation':
      'Use the repository file contents and branch context to suggest a practical implementation plan. Identify likely entry points, files to inspect first, and a step-by-step approach to make the change safely.',
    'implement-changes':
      'Use the approved plan and the repository snapshot to implement the change. Return concrete file edits with file paths, full replacement content, and a short reason for each file change.',
  }

  const resolvedTask = task === 'auto' || !task || !taskInstructions[task] ? inferAiTask(userExplanation, issueSummary) : task

  if (!taskInstructions[resolvedTask]) {
    return res.status(400).json({
      error:
        'Unsupported task. Supported: explain-ticket, update-ticket, suggest-branches, suggest-fix, review-plan, suggest-implementation, implement-changes',
    })
  }

  const systemPrompt = [
    'You are an AI engineering assistant for Jira and GitHub workflows.',
    'Always return valid JSON only with this shape:',
    '{',
    '  "ticketExplanation": string,',
    '  "updatedSummary": string,',
    '  "updatedDescription": string,',
    '  "ticketUpdateReasoning": string,',
    '  "branchSuggestions": string[],',
    '  "fixPlan": string[],',
    '  "planSteps": string[],',
    '  "planSummary": string,',
    '  "reviewNotes": string,',
    '  "implementationSummary": string,',
    '  "implementationChanges": [{ "path": string, "action": "create" | "update" | "delete", "content": string, "reason": string }]',
    '}',
    'Fill only fields relevant to the task; use empty strings or empty arrays otherwise.',
    'Do not include markdown or code fences.',
  ].join('\n')

  const repoFilePreview = formatRepoSnapshot(repoSnapshot)

  const userPrompt = [
    `Task: ${resolvedTask}`,
    `Instruction: ${taskInstructions[resolvedTask]}`,
    '',
    'Issue context:',
    JSON.stringify(issueSummary, null, 2),
    '',
    `Selected repository: ${repo || 'N/A'}`,
    `Selected branch: ${branch || 'N/A'}`,
    `Existing branch names: ${existingBranches.join(', ') || 'N/A'}`,
    `Repository file count: ${repoSnapshot.fileCount}`,
    repoSnapshot.omittedCount > 0 ? `Omitted files: ${repoSnapshot.omittedCount}` : '',
    '',
    'Repository snapshot with file contents:',
    repoFilePreview,
    '',
    `User explanation: ${userExplanation || 'N/A'}`,
    '',
    `Draft plan: ${planDraft || 'N/A'}`,
    `Approved plan: ${approvedPlan || 'N/A'}`,
  ].join('\n')

  try {
    const headers = {
      Authorization: `Bearer ${ai.apiKey}`,
      'Content-Type': 'application/json',
    }

    const response = await fetch(`${ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    const text = await response.text()
    let payload = null

    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'LLM request failed',
        details: extractGithubErrorMessage(payload, response.statusText) || text,
      })
    }

    const content = payload?.choices?.[0]?.message?.content
    const parsed = extractJsonObject(typeof content === 'string' ? content : '')
    const normalized = normalizeAiResponse(parsed, typeof content === 'string' ? content.trim() : '')
    const snapshotSummary = {
      repo: repoSnapshot.repo,
      branch: repoSnapshot.branch,
      fileCount: repoSnapshot.fileCount,
      omittedCount: repoSnapshot.omittedCount,
      truncated: repoSnapshot.truncated,
      readableFileCount: Array.isArray(repoSnapshot.files)
        ? repoSnapshot.files.filter((file) => file?.readable !== false).length
        : 0,
    }

    const consistentResult = enforceSnapshotConsistency(normalized, snapshotSummary)

    return res.json({
      model: ai.model,
      task: resolvedTask,
      repoSnapshot: snapshotSummary,
      result: consistentResult,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error while calling LLM provider',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.listen(port, () => {
  console.log(`Jira API proxy running on http://localhost:${port}`)
})