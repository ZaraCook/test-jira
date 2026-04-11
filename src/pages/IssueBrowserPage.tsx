import type { JiraIssue } from '../types'

export type IssueBrowserPageProps = {
  loading: boolean
  error: string | null
  filteredIssues: JiraIssue[]
  total: number
  searchText: string
  assigneeFilter: string
  issuesCount: number
  assigneeOptions: string[]
  selectedIssueKey: string | null
  onSearchTextChange: (value: string) => void
  onAssigneeFilterChange: (value: string) => void
  onRefresh: () => void
  onSelectIssue: (issue: JiraIssue) => void
}

export function IssueBrowserPage({
  loading,
  error,
  filteredIssues,
  total,
  searchText,
  assigneeFilter,
  issuesCount,
  assigneeOptions,
  selectedIssueKey,
  onSearchTextChange,
  onAssigneeFilterChange,
  onRefresh,
  onSelectIssue,
}: IssueBrowserPageProps) {
  const renderIssueList = () => {
    if (loading) {
      return <p className="empty-state">Loading your Jira issues...</p>
    }

    if (error) {
      return (
        <div className="error-box">
          <p>Could not load issues.</p>
          <p>{error}</p>
          <button type="button" onClick={onRefresh} className="refresh-btn">
            Retry
          </button>
        </div>
      )
    }

    if (issuesCount === 0) {
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
          const updatedText = issue.updated ? new Date(issue.updated).toLocaleString() : 'Unknown'

          const isSelected = selectedIssueKey === issue.key

          return (
            <button
              key={issue.id}
              type="button"
              className={`jira-row ${isSelected ? 'jira-row-selected' : ''}`}
              onClick={() => onSelectIssue(issue)}
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
            onChange={(event) => onSearchTextChange(event.target.value)}
            className="search-input"
          />

          <select
            value={assigneeFilter}
            onChange={(event) => onAssigneeFilterChange(event.target.value)}
            disabled={loading || !!error || issuesCount === 0}
            className="filter-select"
          >
            <option value="all">All assignees</option>
            {assigneeOptions.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>

          <button type="button" onClick={onRefresh} className="refresh-btn">
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
