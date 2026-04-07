import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type JiraIssue = {
  id: string
  key: string
  summary: string
  status: string
  type: string
  priority: string
  assignee: string
  updated: string | null
  url: string
}

type IssuesResponse = {
  total: number
  issues: JiraIssue[]
}

type JiraIssueDetails = {
  id: string
  key: string
  summary: string
  status: string
  type: string
  priority: string
  assignee: string
  reporter: string
  creator: string
  created: string | null
  updated: string | null
  labels: string[]
  components: string[]
  fixVersions: string[]
  description: string
  url: string
  rawFields: Record<string, unknown>
}

type IssueDetailsResponse = {
  issue: JiraIssueDetails
  error?: string
  details?: string
}

type GithubBranch = {
  name: string
  url: string
  repo: string
}

type GithubPullRequest = {
  number: number
  title: string
  state: string
  url: string
  repo: string
  branch: string
}

type IssueLinksResponse = {
  issueKey: string
  github: {
    enabled: boolean
    branches: GithubBranch[]
    pullRequests: GithubPullRequest[]
    reposChecked: string[]
  }
  error?: string
  details?: string
}

type GithubRepo = {
  name: string
  defaultBranch: string
  url: string
  private: boolean
}

type GithubBranchOption = {
  name: string
  url: string
}

type GithubFileOption = {
  path: string
}

type GithubFileContent = {
  path: string
  content: string
  htmlUrl: string
}

type GithubReposResponse = {
  enabled: boolean
  repos: GithubRepo[]
  error?: string
  details?: string
}

type GithubRepoBranchesResponse = {
  enabled: boolean
  repo: string
  branches: GithubBranchOption[]
  error?: string
  details?: string
}

type GithubRepoFilesResponse = {
  enabled: boolean
  repo: string
  branch: string
  files: GithubFileOption[]
  error?: string
  details?: string
}

type GithubRepoFileResponse = {
  enabled: boolean
  repo: string
  branch: string
  file: GithubFileContent
  error?: string
  details?: string
}

function App() {
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [searchText, setSearchText] = useState('')

  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)
  const [selectedIssueDetails, setSelectedIssueDetails] = useState<JiraIssueDetails | null>(null)
  const [issueDetailsLoading, setIssueDetailsLoading] = useState(false)
  const [issueDetailsError, setIssueDetailsError] = useState<string | null>(null)
  const [linksLoading, setLinksLoading] = useState(false)
  const [linksError, setLinksError] = useState<string | null>(null)
  const [githubBranches, setGithubBranches] = useState<GithubBranch[]>([])
  const [githubPullRequests, setGithubPullRequests] = useState<GithubPullRequest[]>([])
  const [reposChecked, setReposChecked] = useState<string[]>([])

  const [githubConnected, setGithubConnected] = useState(false)
  const [githubApiError, setGithubApiError] = useState<string | null>(null)
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([])
  const [repoBranches, setRepoBranches] = useState<GithubBranchOption[]>([])
  const [branchFiles, setBranchFiles] = useState<GithubFileOption[]>([])
  const [selectedFileContent, setSelectedFileContent] = useState('')
  const [selectedFileUrl, setSelectedFileUrl] = useState('')
  const [loadingGithubRepos, setLoadingGithubRepos] = useState(false)
  const [loadingGithubBranches, setLoadingGithubBranches] = useState(false)
  const [loadingGithubFiles, setLoadingGithubFiles] = useState(false)
  const [loadingGithubFileContent, setLoadingGithubFileContent] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedFile, setSelectedFile] = useState('')
  const [fieldSearch, setFieldSearch] = useState('')

  const assigneeOptions = useMemo(
    () =>
      Array.from(new Set(issues.map((issue) => issue.assignee))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [issues],
  )

  const filteredIssues = useMemo(() => {
    const assigneeFiltered =
      assigneeFilter === 'all'
        ? issues
        : issues.filter((issue) => issue.assignee === assigneeFilter)

    const normalizedSearch = searchText.trim().toLowerCase()

    if (!normalizedSearch) return assigneeFiltered

    return assigneeFiltered.filter((issue) => {
      return (
        issue.key.toLowerCase().includes(normalizedSearch) ||
        issue.summary.toLowerCase().includes(normalizedSearch) ||
        issue.status.toLowerCase().includes(normalizedSearch) ||
        issue.assignee.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [issues, assigneeFilter, searchText])

  const linkedRepos = useMemo(
    () =>
      Array.from(
        new Set([
          ...reposChecked,
          ...githubBranches.map((branch) => branch.repo),
          ...githubPullRequests.map((pr) => pr.repo),
        ]),
      ),
    [reposChecked, githubBranches, githubPullRequests],
  )

  const availableRepos = useMemo(() => {
    const linkedSet = new Set(linkedRepos)
    const repoMap = new Map(githubRepos.map((repo) => [repo.name, repo]))

    for (const name of linkedRepos) {
      if (!repoMap.has(name)) {
        repoMap.set(name, {
          name,
          defaultBranch: '',
          url: `https://github.com/${name}`,
          private: false,
        })
      }
    }

    const sorted = [...repoMap.values()].sort((a, b) => a.name.localeCompare(b.name))

    if (sorted.length === 0) {
      return []
    }

    if (linkedSet.size === 0) {
      return sorted
    }

    const linkedFirst = sorted.filter((repo) => linkedSet.has(repo.name))
    const remainder = sorted.filter((repo) => !linkedSet.has(repo.name))
    return [...linkedFirst, ...remainder]
  }, [githubRepos, linkedRepos])

  const availableBranches = repoBranches
  const availableFiles = branchFiles

  const stringifyFieldValue = useCallback((value: unknown): string => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'

    if (typeof value === 'string') {
      return value.trim() ? value : '(empty string)'
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [])

  const formattedFieldEntries = useMemo(() => {
    if (!selectedIssueDetails) {
      return []
    }

    const search = fieldSearch.trim().toLowerCase()

    return Object.entries(selectedIssueDetails.rawFields)
      .map(([key, value]) => {
        const valueText = stringifyFieldValue(value)
        const compactPreview = valueText.replace(/\s+/g, ' ').trim()
        const preview = compactPreview.length > 140 ? `${compactPreview.slice(0, 140)}...` : compactPreview

        return {
          key,
          valueText,
          preview,
        }
      })
      .filter((entry) => {
        if (!search) return true
        return entry.key.toLowerCase().includes(search) || entry.preview.toLowerCase().includes(search)
      })
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [fieldSearch, selectedIssueDetails, stringifyFieldValue])

  const autoLinkedBranch = useMemo(() => {
    if (!selectedIssue) return null

    return (
      githubBranches.find((branch) => branch.name.toLowerCase().includes(selectedIssue.key.toLowerCase())) ||
      githubBranches[0] ||
      null
    )
  }, [githubBranches, selectedIssue])

  const parseRepo = useCallback((fullName: string) => {
    const [owner, repo] = fullName.split('/')
    if (!owner || !repo) {
      return null
    }

    return { owner, repo }
  }, [])

  const fetchGithubRepos = useCallback(async () => {
    setLoadingGithubRepos(true)
    setGithubApiError(null)

    try {
      const response = await fetch('http://localhost:3001/api/github/repos', {
        cache: 'no-store',
      })

      const payload = (await response.json()) as GithubReposResponse

      if (!response.ok) {
        const detailText = payload.details ? ` (${payload.details})` : ''
        throw new Error((payload.error || 'Failed to load GitHub repositories') + detailText)
      }

      const nextRepos = payload.repos || []
      setGithubRepos(nextRepos)

      if (nextRepos.length === 0) {
        setSelectedRepo('')
        return
      }

      const preferredRepo =
        githubBranches[0]?.repo || githubPullRequests[0]?.repo || reposChecked[0] || nextRepos[0]?.name || ''

      const hasPreferred = nextRepos.some((repo) => repo.name === preferredRepo)
      const fallbackRepo = nextRepos[0]?.name || ''
      setSelectedRepo(hasPreferred ? preferredRepo : fallbackRepo)
    } catch (err) {
      setGithubApiError(err instanceof Error ? err.message : 'Unknown GitHub error')
      setGithubRepos([])
      setSelectedRepo('')
      setSelectedBranch('')
      setSelectedFile('')
      setSelectedFileContent('')
      setSelectedFileUrl('')
    } finally {
      setLoadingGithubRepos(false)
    }
  }, [githubBranches, githubPullRequests, reposChecked])

  const connectGithub = useCallback(async () => {
    if (githubConnected) {
      setGithubConnected(false)
      setGithubApiError(null)
      setGithubRepos([])
      setRepoBranches([])
      setBranchFiles([])
      setSelectedRepo('')
      setSelectedBranch('')
      setSelectedFile('')
      setSelectedFileContent('')
      setSelectedFileUrl('')
      return
    }

    setGithubConnected(true)
    await fetchGithubRepos()
  }, [fetchGithubRepos, githubConnected])

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('http://localhost:3001/api/issues', {
        cache: 'no-store',
      })

      const payload = (await response.json()) as IssuesResponse & {
        error?: string
        details?: string
      }

      if (!response.ok) {
        const detailText = payload.details ? ` (${payload.details})` : ''
        throw new Error((payload.error || 'Failed to load Jira issues') + detailText)
      }

      setIssues(payload.issues)
      setTotal(payload.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchIssueDetails = useCallback(async (issueKey: string) => {
    try {
      setIssueDetailsLoading(true)
      setIssueDetailsError(null)
      setSelectedIssueDetails(null)

      const response = await fetch(`http://localhost:3001/api/issues/${encodeURIComponent(issueKey)}`, {
        cache: 'no-store',
      })

      const payload = (await response.json()) as IssueDetailsResponse

      if (!response.ok) {
        const detailText = payload.details ? ` (${payload.details})` : ''
        throw new Error((payload.error || 'Failed to load issue details') + detailText)
      }

      setSelectedIssueDetails(payload.issue)
    } catch (err) {
      setIssueDetailsError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIssueDetailsLoading(false)
    }
  }, [])

  const fetchIssueLinks = useCallback(async (issue: JiraIssue) => {
    try {
      setSelectedIssue(issue)
      setLinksLoading(true)
      setLinksError(null)
      setGithubBranches([])
      setGithubPullRequests([])
      setReposChecked([])
      setSelectedRepo('')
      setSelectedBranch('')
      setSelectedFile('')

      const response = await fetch(
        `http://localhost:3001/api/issues/${encodeURIComponent(issue.key)}/links`,
        {
          cache: 'no-store',
        },
      )

      const payload = (await response.json()) as IssueLinksResponse

      if (!response.ok) {
        const detailText = payload.details ? ` (${payload.details})` : ''
        throw new Error((payload.error || 'Failed to load GitHub links') + detailText)
      }

      const nextBranches = payload.github?.branches || []
      const nextPrs = payload.github?.pullRequests || []
      const nextRepos = payload.github?.reposChecked || []

      setGithubBranches(nextBranches)
      setGithubPullRequests(nextPrs)
      setReposChecked(nextRepos)

      const preferredRepo = nextBranches[0]?.repo || nextPrs[0]?.repo || nextRepos[0] || ''
      setSelectedRepo(preferredRepo)
      setSelectedBranch(nextBranches[0]?.name || nextPrs[0]?.branch || '')
      setSelectedFile('')
      setSelectedFileContent('')
      setSelectedFileUrl('')
    } catch (err) {
      setLinksError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLinksLoading(false)
    }
  }, [])

  const handleSelectIssue = useCallback(
    (issue: JiraIssue) => {
      setSelectedIssue(issue)
      void fetchIssueDetails(issue.key)
      void fetchIssueLinks(issue)
    },
    [fetchIssueDetails, fetchIssueLinks],
  )

  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

  useEffect(() => {
    if (!githubConnected || availableRepos.length === 0) {
      return
    }

    const exists = availableRepos.some((repo) => repo.name === selectedRepo)
    if (!exists) {
      setSelectedRepo(availableRepos[0]?.name || '')
    }
  }, [availableRepos, githubConnected, selectedRepo])

  useEffect(() => {
    if (!githubConnected || !selectedRepo) {
      setRepoBranches([])
      setSelectedBranch('')
      return
    }

    const parsed = parseRepo(selectedRepo)
    if (!parsed) {
      setRepoBranches([])
      setSelectedBranch('')
      return
    }

    const loadBranches = async () => {
      setLoadingGithubBranches(true)
      setGithubApiError(null)

      try {
        const response = await fetch(
          `http://localhost:3001/api/github/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/branches`,
          { cache: 'no-store' },
        )

        const payload = (await response.json()) as GithubRepoBranchesResponse

        if (!response.ok) {
          const detailText = payload.details ? ` (${payload.details})` : ''
          throw new Error((payload.error || 'Failed to load branches') + detailText)
        }

        const nextBranches = payload.branches || []
        setRepoBranches(nextBranches)

        const preferredBranch =
          githubBranches.find((branch) => branch.repo === selectedRepo)?.name || nextBranches[0]?.name || ''

        const hasBranch = nextBranches.some((branch) => branch.name === selectedBranch)
        setSelectedBranch(hasBranch ? selectedBranch : preferredBranch)
      } catch (err) {
        setGithubApiError(err instanceof Error ? err.message : 'Unknown GitHub error')
        setRepoBranches([])
        setSelectedBranch('')
      } finally {
        setLoadingGithubBranches(false)
      }
    }

    void loadBranches()
  }, [githubConnected, githubBranches, parseRepo, selectedBranch, selectedRepo])

  useEffect(() => {
    if (!githubConnected || !selectedRepo || !selectedBranch) {
      setBranchFiles([])
      setSelectedFile('')
      setSelectedFileContent('')
      setSelectedFileUrl('')
      return
    }

    const parsed = parseRepo(selectedRepo)
    if (!parsed) {
      setBranchFiles([])
      setSelectedFile('')
      setSelectedFileContent('')
      setSelectedFileUrl('')
      return
    }

    const loadFiles = async () => {
      setLoadingGithubFiles(true)
      setGithubApiError(null)

      try {
        const response = await fetch(
          `http://localhost:3001/api/github/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/files?branch=${encodeURIComponent(selectedBranch)}`,
          { cache: 'no-store' },
        )

        const payload = (await response.json()) as GithubRepoFilesResponse

        if (!response.ok) {
          const detailText = payload.details ? ` (${payload.details})` : ''
          throw new Error((payload.error || 'Failed to load files') + detailText)
        }

        const nextFiles = payload.files || []
        setBranchFiles(nextFiles)

        const hasFile = nextFiles.some((file) => file.path === selectedFile)
        setSelectedFile(hasFile ? selectedFile : nextFiles[0]?.path || '')
      } catch (err) {
        setGithubApiError(err instanceof Error ? err.message : 'Unknown GitHub error')
        setBranchFiles([])
        setSelectedFile('')
        setSelectedFileContent('')
        setSelectedFileUrl('')
      } finally {
        setLoadingGithubFiles(false)
      }
    }

    void loadFiles()
  }, [githubConnected, parseRepo, selectedBranch, selectedFile, selectedRepo])

  useEffect(() => {
    if (!githubConnected || !selectedRepo || !selectedBranch || !selectedFile) {
      setSelectedFileContent('')
      setSelectedFileUrl('')
      return
    }

    const parsed = parseRepo(selectedRepo)
    if (!parsed) {
      setSelectedFileContent('')
      setSelectedFileUrl('')
      return
    }

    const loadFileContent = async () => {
      setLoadingGithubFileContent(true)
      setGithubApiError(null)

      try {
        const response = await fetch(
          `http://localhost:3001/api/github/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/file?branch=${encodeURIComponent(selectedBranch)}&path=${encodeURIComponent(selectedFile)}`,
          { cache: 'no-store' },
        )

        const payload = (await response.json()) as GithubRepoFileResponse

        if (!response.ok) {
          const detailText = payload.details ? ` (${payload.details})` : ''
          throw new Error((payload.error || 'Failed to load file content') + detailText)
        }

        setSelectedFileContent(payload.file?.content || '')
        setSelectedFileUrl(payload.file?.htmlUrl || '')
      } catch (err) {
        setGithubApiError(err instanceof Error ? err.message : 'Unknown GitHub error')
        setSelectedFileContent('')
        setSelectedFileUrl('')
      } finally {
        setLoadingGithubFileContent(false)
      }
    }

    void loadFileContent()
  }, [githubConnected, parseRepo, selectedBranch, selectedFile, selectedRepo])

  const closeDetails = () => {
    setSelectedIssue(null)
    setSelectedIssueDetails(null)
    setIssueDetailsError(null)
    setIssueDetailsLoading(false)
    setLinksError(null)
    setGithubBranches([])
    setGithubPullRequests([])
    setReposChecked([])
    setGithubApiError(null)
    setLinksLoading(false)
    setSelectedRepo('')
    setSelectedBranch('')
    setSelectedFile('')
    setSelectedFileContent('')
    setSelectedFileUrl('')
    setFieldSearch('')
  }

  const renderIssueList = () => {
    if (loading) {
      return <p className="empty-state">Loading your Jira issues...</p>
    }

    if (error) {
      return (
        <div className="error-box">
          <p>Could not load issues.</p>
          <p>{error}</p>
          <button type="button" onClick={() => void fetchIssues()} className="refresh-btn">
            Retry
          </button>
        </div>
      )
    }

    if (issues.length === 0) {
      return <p className="empty-state">No issues found for your current Jira query.</p>
    }

    if (filteredIssues.length === 0) {
      return <p className="empty-state">No issues match the current filters.</p>
    }

    return (
      <div className="jira-list">
        <div className="jira-list-header">
          <div>Type</div>
          <div>Key</div>
          <div>Summary</div>
          <div>Status</div>
          <div>Assignee</div>
          <div>Updated</div>
        </div>

        {filteredIssues.map((issue) => {
          const updatedText = issue.updated
            ? new Date(issue.updated).toLocaleString()
            : 'Unknown'

          const isSelected = selectedIssue?.key === issue.key

          return (
            <button
              key={issue.id}
              type="button"
              className={`jira-row ${isSelected ? 'jira-row-selected' : ''}`}
              onClick={() => handleSelectIssue(issue)}
            >
              <div>
                <span className={`issue-badge issue-type-${issue.type.toLowerCase().replace(/\s+/g, '-')}`}>
                  {issue.type}
                </span>
              </div>
              <div className="jira-key">{issue.key}</div>
              <div className="jira-summary-cell">
                <div className="jira-summary">{issue.summary}</div>
                <div className="jira-meta-inline">
                  <span className={`status-pill status-${issue.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {issue.status}
                  </span>
                  <span className="priority-pill">{issue.priority}</span>
                </div>
              </div>
              <div>{issue.status}</div>
              <div>{issue.assignee}</div>
              <div>{updatedText}</div>
            </button>
          )
        })}
      </div>
    )
  }

  const renderGithubPanel = () => {
    return (
      <section className="github-side">
        <div className="panel-section">
          <div className="section-title-row">
            <h3>GitHub</h3>
            <button
              type="button"
              className={`connect-btn ${githubConnected ? 'connect-btn-connected' : ''}`}
              onClick={() => void connectGithub()}
              disabled={loadingGithubRepos}
            >
              {loadingGithubRepos ? 'Connecting...' : githubConnected ? 'Disconnect GitHub' : 'Connect GitHub'}
            </button>
          </div>

          <div className="github-controls">
            <label>
              Repository
              <select
                value={selectedRepo}
                onChange={(event) => setSelectedRepo(event.target.value)}
                disabled={!githubConnected}
              >
                <option value="">Select repo</option>
                {availableRepos.map((repo) => (
                  <option key={repo.name} value={repo.name}>
                    {repo.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Branch
              <select
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                disabled={!githubConnected || !selectedRepo || loadingGithubBranches}
              >
                <option value="">Select branch</option>
                {availableBranches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              File
              <select
                value={selectedFile}
                onChange={(event) => setSelectedFile(event.target.value)}
                disabled={!githubConnected || !selectedBranch || loadingGithubFiles}
              >
                <option value="">Select file</option>
                {availableFiles.map((file) => (
                  <option key={file.path} value={file.path}>
                    {file.path}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {githubApiError && <p className="empty-state">{githubApiError}</p>}

          {githubConnected && !loadingGithubRepos && availableRepos.length === 0 && !githubApiError && (
            <p className="empty-state">
              No repositories were returned by GitHub. Check token permissions or set GITHUB_REPOS.
            </p>
          )}

          {selectedFileUrl && (
            <div className="workspace-actions">
              <a href={selectedFileUrl} target="_blank" rel="noreferrer" className="secondary-link">
                Open selected file on GitHub
              </a>
            </div>
          )}

          {autoLinkedBranch && (
            <div className="linked-branch-banner">
              Automatically linked branch:
              <a href={autoLinkedBranch.url} target="_blank" rel="noreferrer">
                {autoLinkedBranch.repo} / {autoLinkedBranch.name}
              </a>
            </div>
          )}

          <div className="github-file-window">
            <div className="github-file-header">
              <span>{selectedRepo || 'No repo selected'}</span>
              <span>{selectedBranch || 'No branch selected'}</span>
              <span>{selectedFile || 'No file selected'}</span>
            </div>
            <pre className="code-viewer">
              <code>
                {githubConnected
                  ? loadingGithubFileContent
                    ? '// Loading file content...'
                    : selectedFileContent || '// No file content available'
                  : '// Connect GitHub to browse repository, branch, and file'}
              </code>
            </pre>
          </div>
        </div>

        <div className="panel-section">
          <h3>Linked pull requests</h3>
          {githubPullRequests.length === 0 ? (
            <p className="empty-state">No matching pull requests found.</p>
          ) : (
            <ul className="detail-list">
              {githubPullRequests.map((pr) => (
                <li key={`${pr.repo}-${pr.number}`} className="detail-card">
                  <a href={pr.url} target="_blank" rel="noreferrer">
                    {pr.title}
                  </a>
                  <div className="detail-subtext">
                    {pr.repo} · PR #{pr.number} · {pr.state} · {pr.branch || 'Unknown branch'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel-section">
          <h3>Repositories checked</h3>
          {reposChecked.length === 0 ? (
            <p className="empty-state">No repositories configured.</p>
          ) : (
            <ul className="detail-list">
              {reposChecked.map((repo) => (
                <li key={repo} className="detail-card muted-card">
                  {repo}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    )
  }

  const renderIssueBrowser = () => {
    return (
      <>
        <header className="topbar">
          <div>
            <h1>Issues</h1>
            <p>{loading ? 'Loading...' : `${filteredIssues.length} shown of ${total} total`}</p>
          </div>

          <div className="topbar-actions">
            <input
              type="text"
              placeholder="Search issues"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="search-input"
            />

            <select
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              disabled={loading || !!error || issues.length === 0}
              className="filter-select"
            >
              <option value="all">All assignees</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => void fetchIssues()} className="refresh-btn">
              Refresh
            </button>
          </div>
        </header>

        <div className="jira-main-layout single-pane-layout">
          <section className="issues-pane">{renderIssueList()}</section>
        </div>
      </>
    )
  }

  const renderTicketWorkspace = () => {
    if (!selectedIssue) {
      return null
    }

    return (
      <section className="details-workspace full-workspace-view">
        <div className="workspace-header">
          <div>
            <div className="workspace-issue-key">{selectedIssue.key}</div>
            <h2>{selectedIssue.summary}</h2>
          </div>
          <div className="workspace-actions">
            <button type="button" className="close-btn" onClick={closeDetails}>
              Back to issues
            </button>
            <a href={selectedIssue.url} target="_blank" rel="noreferrer" className="secondary-link">
              Open in Jira
            </a>
          </div>
        </div>

        {issueDetailsLoading && <p className="empty-state">Loading full issue details...</p>}

        {issueDetailsError && (
          <div className="error-box">
            <p>Could not load issue details.</p>
            <p>{issueDetailsError}</p>
          </div>
        )}

        {!issueDetailsLoading && !issueDetailsError && selectedIssueDetails && (
          <div className="workspace-split">
            <section className="ticket-side">
              <div className="panel-section">
                <h3>Ticket details</h3>
                <div className="issue-detail-grid">
                  <div>
                    <span className="detail-label">Status</span>
                    <span className={`status-pill status-${selectedIssueDetails.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {selectedIssueDetails.status}
                    </span>
                  </div>
                  <div>
                    <span className="detail-label">Type</span>
                    <span className="detail-value">{selectedIssueDetails.type}</span>
                  </div>
                  <div>
                    <span className="detail-label">Priority</span>
                    <span className="detail-value">{selectedIssueDetails.priority}</span>
                  </div>
                  <div>
                    <span className="detail-label">Assignee</span>
                    <span className="detail-value">{selectedIssueDetails.assignee}</span>
                  </div>
                  <div>
                    <span className="detail-label">Reporter</span>
                    <span className="detail-value">{selectedIssueDetails.reporter}</span>
                  </div>
                  <div>
                    <span className="detail-label">Creator</span>
                    <span className="detail-value">{selectedIssueDetails.creator}</span>
                  </div>
                  <div>
                    <span className="detail-label">Created</span>
                    <span className="detail-value">
                      {selectedIssueDetails.created
                        ? new Date(selectedIssueDetails.created).toLocaleString()
                        : 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="detail-label">Updated</span>
                    <span className="detail-value">
                      {selectedIssueDetails.updated
                        ? new Date(selectedIssueDetails.updated).toLocaleString()
                        : 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <h3>Description</h3>
                <pre className="issue-description">{selectedIssueDetails.description || 'No description provided.'}</pre>
              </div>

              <div className="panel-section">
                <h3>Context</h3>
                <div className="tag-row">
                  <span className="tag-chip">Labels: {selectedIssueDetails.labels.length || 0}</span>
                  <span className="tag-chip">Components: {selectedIssueDetails.components.length || 0}</span>
                  <span className="tag-chip">Fix versions: {selectedIssueDetails.fixVersions.length || 0}</span>
                </div>

                {selectedIssueDetails.labels.length > 0 && (
                  <div className="tag-row">
                    {selectedIssueDetails.labels.map((label) => (
                      <span key={label} className="tag-pill">
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {selectedIssueDetails.components.length > 0 && (
                  <div className="tag-row">
                    {selectedIssueDetails.components.map((component) => (
                      <span key={component} className="tag-pill tag-pill-accent">
                        {component}
                      </span>
                    ))}
                  </div>
                )}

                {selectedIssueDetails.fixVersions.length > 0 && (
                  <div className="tag-row">
                    {selectedIssueDetails.fixVersions.map((version) => (
                      <span key={version} className="tag-pill tag-pill-muted">
                        {version}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel-section">
                <h3>Linked branches</h3>
                {linksLoading ? (
                  <p className="empty-state">Loading linked GitHub info...</p>
                ) : linksError ? (
                  <div className="error-box">
                    <p>Could not load linked GitHub info.</p>
                    <p>{linksError}</p>
                  </div>
                ) : githubBranches.length === 0 ? (
                  <p className="empty-state">No matching branches found.</p>
                ) : (
                  <ul className="detail-list">
                    {githubBranches.map((branch) => (
                      <li key={`${branch.repo}-${branch.name}`} className="detail-card">
                        <a href={branch.url} target="_blank" rel="noreferrer">
                          {branch.name}
                        </a>
                        <div className="detail-subtext">{branch.repo}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="panel-section">
                <h3>All Jira fields</h3>
                <div className="field-toolbar">
                  <input
                    type="text"
                    className="search-input field-search"
                    placeholder="Search fields or values"
                    value={fieldSearch}
                    onChange={(event) => setFieldSearch(event.target.value)}
                  />
                  <span className="field-count">{formattedFieldEntries.length} fields</span>
                </div>

                {formattedFieldEntries.length === 0 ? (
                  <p className="empty-state">No fields match your search.</p>
                ) : (
                  <div className="field-accordion-list">
                    {formattedFieldEntries.map((entry) => (
                      <details key={entry.key} className="field-accordion-item">
                        <summary>
                          <span className="field-key">{entry.key}</span>
                          <span className="field-preview">{entry.preview || 'No value'}</span>
                        </summary>
                        <pre className="field-value-viewer">
                          <code>{entry.valueText}</code>
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {renderGithubPanel()}
          </div>
        )}
      </section>
    )
  }

  return <main className="jira-app-shell">{selectedIssue ? renderTicketWorkspace() : renderIssueBrowser()}</main>
}

export default App