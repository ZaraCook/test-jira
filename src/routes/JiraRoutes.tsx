import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { GithubPanel } from '../components/GithubPanel'
import { RouteLoadingState } from '../components/RouteLoadingState'
import { useJiraWorkspace } from '../hooks/useJiraWorkspace'
import { IssueBrowserPage } from '../pages/IssueBrowserPage'
import { TicketWorkspacePage } from '../pages/TicketWorkspacePage'

function IssueRouteView({
  workspace,
}: {
  workspace: ReturnType<typeof useJiraWorkspace>
}) {
  const navigate = useNavigate()
  const { issueBrowserProps, selectIssue } = workspace

  return (
    <IssueBrowserPage
      {...issueBrowserProps}
      onSelectIssue={(issue) => {
        selectIssue(issue)
        navigate(`/issue/${encodeURIComponent(issue.key)}`)
      }}
    />
  )
}

function TicketRouteView({
  workspace,
}: {
  workspace: ReturnType<typeof useJiraWorkspace>
}) {
  const navigate = useNavigate()
  const { issueKey } = useParams<{ issueKey: string }>()
  const {
    issues,
    selectedIssue,
    selectIssue,
    clearSelectedIssue,
    ticketWorkspaceProps,
    githubPanelProps,
    issueBrowserProps,
  } = workspace
  const decodedIssueKey = issueKey ? decodeURIComponent(issueKey) : ''

  useEffect(() => {
    if (!issueKey) {
      return
    }

    if (selectedIssue?.key === decodedIssueKey) {
      return
    }

    const match = issues.find((issue) => issue.key === decodedIssueKey)
    if (match) {
      selectIssue(match)
    }
  }, [decodedIssueKey, issueKey, issues, selectedIssue, selectIssue])

  const isCorrectIssueLoaded = !decodedIssueKey || selectedIssue?.key === decodedIssueKey

  if (!isCorrectIssueLoaded) {
    const issueExists = issues.some((issue) => issue.key === decodedIssueKey)

    if (!issueBrowserProps.loading && !issueExists) {
      return <RouteLoadingState title="Issue not found" message={`We could not find a ticket with key ${decodedIssueKey}.`} />
    }

    return <RouteLoadingState title="Loading issue..." message="Fetching ticket details and linked GitHub context." />
  }

  if (!ticketWorkspaceProps) {
    return <RouteLoadingState title="Loading issue..." message="Fetching ticket details and linked GitHub context." />
  }

  return (
    <TicketWorkspacePage
      {...ticketWorkspaceProps}
      onBackToIssues={() => {
        clearSelectedIssue()
        navigate('/issues')
      }}
      githubPanel={<GithubPanel {...githubPanelProps} />}
    />
  )
}

export function JiraRoutes() {
  const workspace = useJiraWorkspace()

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/issues" replace />} />
      <Route path="/issues" element={<IssueRouteView workspace={workspace} />} />
      <Route path="/issue/:issueKey" element={<TicketRouteView workspace={workspace} />} />
      <Route path="*" element={<Navigate to="/issues" replace />} />
    </Routes>
  )
}
