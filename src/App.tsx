import { useCallback, useEffect, useState } from 'react'
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

function App() {
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState('all')

  const assigneeOptions = Array.from(new Set(issues.map((issue) => issue.assignee))).sort(
    (a, b) => a.localeCompare(b),
  )

  const filteredIssues =
    assigneeFilter === 'all'
      ? issues
      : issues.filter((issue) => issue.assignee === assigneeFilter)

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/issues', { cache: 'no-store' })
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

  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

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

          return (
            <li key={issue.id} className="issue-card">
              <a href={issue.url} target="_blank" rel="noreferrer" className="issue-link">
                <strong>{issue.key}</strong>
              </a>
              <h2>{issue.summary}</h2>
              <p>
                <span>{issue.status}</span>
                <span>{issue.type}</span>
                <span>{issue.priority}</span>
              </p>
              <p>
                Assignee: {issue.assignee} | Updated: {updatedText}
              </p>
            </li>
          )
        })}
      </ul>
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
      {renderContent()}
    </main>
  )
}

export default App
