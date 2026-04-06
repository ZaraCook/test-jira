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

function App() {
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState('all')

  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)
  const [linksLoading, setLinksLoading] = useState(false)
  const [linksError, setLinksError] = useState<string | null>(null)
  const [githubBranches, setGithubBranches] = useState<GithubBranch[]>([])
  const [githubPullRequests, setGithubPullRequests] = useState<GithubPullRequest[]>([])
  const [reposChecked, setReposChecked] = useState<string[]>([])

  const assigneeOptions = useMemo(
    () =>
      Array.from(new Set(issues.map((issue) => issue.assignee))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [issues],
  )

  const filteredIssues =
    assigneeFilter === 'all'
      ? issues
      : issues.filter((issue) => issue.assignee === assigneeFilter)

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

  const fetchIssueLinks = useCallback(async (issue: JiraIssue) => {
    try {
      setSelectedIssue(issue)
      setLinksLoading(true)
      setLinksError(null)
      setGithubBranches([])
      setGithubPullRequests([])
      setReposChecked([])

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

      setGithubBranches(payload.github?.branches || [])
      setGithubPullRequests(payload.github?.pullRequests || [])
      setReposChecked(payload.github?.reposChecked || [])
    } catch (err) {
      setLinksError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLinksLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

  const closeDetails = () => {
    setSelectedIssue(null)
    setLinksError(null)
    setGithubBranches([])
    setGithubPullRequests([])
    setReposChecked([])
    setLinksLoading(false)
  }

  const renderContent = () => {
    if (loading) {
      return <p>Loading your Jira issues...</p>
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
      return <p>No issues found for your current Jira query.</p>
    }

    if (filteredIssues.length === 0) {
      return <p>No issues match the selected assignee.</p>
    }

    return (
      <ul className="issues-list">
        {filteredIssues.map((issue) => {
          const updatedText = issue.updated
            ? new Date(issue.updated).toLocaleString()
            : 'Unknown'

          const isSelected = selectedIssue?.key === issue.key

          return (
            <li
              key={issue.id}
              className={`issue-card ${isSelected ? 'issue-card-selected' : ''}`}
              onClick={() => void fetchIssueLinks(issue)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  void fetchIssueLinks(issue)
                }
              }}
            >
              <div className="issue-card-top">
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="issue-link"
                  onClick={(event) => event.stopPropagation()}
                >
                  <strong>{issue.key}</strong>
                </a>
              </div>

              <h2>{issue.summary}</h2>

              <p className="issue-tags">
                <span>{issue.status}</span>
                <span>{issue.type}</span>
                <span>{issue.priority}</span>
              </p>

              <p>
                Assignee: {issue.assignee} | Updated: {updatedText}
              </p>

              <button
                type="button"
                className="details-btn"
                onClick={(event) => {
                  event.stopPropagation()
                  void fetchIssueLinks(issue)
                }}
              >
                View linked GitHub info
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  const renderDetailsPanel = () => {
    if (!selectedIssue) {
      return (
        <aside className="details-panel">
          <h2>Issue details</h2>
          <p>Click an issue to see linked GitHub branches and pull requests.</p>
        </aside>
      )
    }

    return (
      <aside className="details-panel">
        <div className="details-header">
          <div>
            <h2>{selectedIssue.key}</h2>
            <p>{selectedIssue.summary}</p>
          </div>
          <button type="button" className="close-btn" onClick={closeDetails}>
            Close
          </button>
        </div>

        <p>
          <a href={selectedIssue.url} target="_blank" rel="noreferrer">
            Open in Jira
          </a>
        </p>

        {linksLoading && <p>Loading linked GitHub info...</p>}

        {linksError && (
          <div className="error-box">
            <p>Could not load linked GitHub info.</p>
            <p>{linksError}</p>
          </div>
        )}

        {!linksLoading && !linksError && (
          <>
            <section className="details-section">
              <h3>Linked pull requests</h3>
              {githubPullRequests.length === 0 ? (
                <p>No matching pull requests found.</p>
              ) : (
                <ul>
                  {githubPullRequests.map((pr) => (
                    <li key={`${pr.repo}-${pr.number}`}>
                      <a href={pr.url} target="_blank" rel="noreferrer">
                        {pr.repo} · PR #{pr.number} · {pr.title}
                      </a>
                      <div>State: {pr.state}</div>
                      <div>Branch: {pr.branch || 'Unknown'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="details-section">
              <h3>Linked branches</h3>
              {githubBranches.length === 0 ? (
                <p>No matching branches found.</p>
              ) : (
                <ul>
                  {githubBranches.map((branch) => (
                    <li key={`${branch.repo}-${branch.name}`}>
                      <a href={branch.url} target="_blank" rel="noreferrer">
                        {branch.repo} · {branch.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="details-section">
              <h3>Repositories checked</h3>
              {reposChecked.length === 0 ? (
                <p>No repositories configured.</p>
              ) : (
                <ul>
                  {reposChecked.map((repo) => (
                    <li key={repo}>{repo}</li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </aside>
    )
  }

  return (
    <main className="app-shell">
      <header>
        <h1>My Jira Issues</h1>
        <p>{loading ? 'Loading...' : `${filteredIssues.length} shown of ${total} total`}</p>

        <div className="filters-row">
          <label htmlFor="assignee-filter">Assignee</label>
          <select
            id="assignee-filter"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            disabled={loading || !!error || issues.length === 0}
          >
            <option value="all">All assignees</option>
            {assigneeOptions.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
        </div>

        <button type="button" onClick={() => void fetchIssues()} className="refresh-btn">
          Refresh
        </button>
      </header>

      <div className="content-layout">
        <section className="issues-column">{renderContent()}</section>
        {renderDetailsPanel()}
      </div>
    </main>
  )
}

export default App