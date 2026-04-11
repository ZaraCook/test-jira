import './App.css'
import { GithubPanel } from './components/GithubPanel'
import { useJiraWorkspace } from './hooks/useJiraWorkspace'
import { IssueBrowserPage } from './pages/IssueBrowserPage'
import { TicketWorkspacePage } from './pages/TicketWorkspacePage'

function App() {
  const { selectedIssue, issueBrowserProps, githubPanelProps, ticketWorkspaceProps } = useJiraWorkspace()

  return (
    <main className="jira-app-shell">
      {selectedIssue && ticketWorkspaceProps ? (
        <TicketWorkspacePage
          {...ticketWorkspaceProps}
          githubPanel={<GithubPanel {...githubPanelProps} />}
        />
      ) : (
        <IssueBrowserPage {...issueBrowserProps} />
      )}
    </main>
  )
}

export default App
