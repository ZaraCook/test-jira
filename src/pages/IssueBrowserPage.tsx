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
  const preferredStatusOrder = ['Backlog', 'To Do', 'Open', 'In Progress', 'In Review', 'Code Review', 'Testing', 'Done', 'Resolved', 'Closed']

  const issueSummary = [
    { label: 'Shown', value: filteredIssues.length },
    { label: 'Total', value: total },
    { label: 'Assignees', value: assigneeOptions.length },
  ]

  const issuesByStatus = filteredIssues.reduce<Record<string, JiraIssue[]>>((acc, issue) => {
    const status = issue.status || 'Unknown'
    if (!acc[status]) {
      acc[status] = []
    }
    acc[status].push(issue)
    return acc
  }, {})

  const orderedStatuses = [
    ...preferredStatusOrder.filter((status) => issuesByStatus[status]),
    ...Object.keys(issuesByStatus)
      .filter((status) => !preferredStatusOrder.includes(status))
      .sort((a, b) => a.localeCompare(b)),
  ]

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
      <div className="jira-board">
        {orderedStatuses.map((status) => (
          <section key={status} className="jira-column">
            <header className="jira-column-header">
              <span className={`status-pill status-${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>
              <span className="jira-column-count">{issuesByStatus[status].length}</span>
            </header>

            <div className="jira-column-body">
              {issuesByStatus[status].map((issue) => {
                const updatedText = issue.updated ? new Date(issue.updated).toLocaleDateString() : 'Unknown'
                const dueDateText = issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : 'No due date'
                const isSelected = selectedIssueKey === issue.key

                return (
                  <button
                    key={issue.id}
                    type="button"
                    className={`jira-card ${isSelected ? 'jira-card-selected' : ''}`}
                    onClick={() => onSelectIssue(issue)}
                  >
                    <div className="jira-card-top">
                      <span className="jira-key">{issue.key}</span>
                      <span className={`issue-badge issue-type-${issue.type.toLowerCase().replace(/\s+/g, '-')}`}>
                        {issue.type}
                      </span>
                    </div>

                    <div className="jira-card-summary">{issue.summary}</div>

                    <div className="jira-card-meta">
                      <span className="priority-pill">{issue.priority}</span>
                      <span className="detail-value jira-card-assignee">{issue.assignee}</span>
                    </div>

                    <div className="jira-card-dates">
                      <span className="jira-card-updated">Updated {updatedText}</span>
                      <span className="jira-card-due">Due {dueDateText}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="issues-dashboard">
      <header className="topbar issues-hero">
        <div className="issues-hero-copy">
          <div className="workspace-issue-key">Issue browser</div>
          <h1>Track work with a clean, fast overview</h1>
          <p>{loading ? 'Loading issues...' : `${filteredIssues.length} visible out of ${total} total tickets.`}</p>
          <div className="workspace-meta-row">
            {issueSummary.map((item) => (
              <span key={item.label} className="field-count">
                {item.label}: {item.value}
              </span>
            ))}
          </div>
        </div>

        <div className="issues-toolbar-card">
          <div className="topbar-actions issues-toolbar">
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
        </div>
      </header>

      <div className="jira-main-layout single-pane-layout">
        <section className="issues-pane">
          <div className="panel-section issues-table-card">{renderIssueList()}</div>
        </section>
      </div>
    </div>
  )
}
