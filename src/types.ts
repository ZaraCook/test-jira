export type JiraIssue = {
  id: string
  key: string
  summary: string
  status: string
  type: string
  priority: string
  assignee: string
  dueDate: string | null
  updated: string | null
  url: string
}

export type IssuesResponse = {
  total: number
  issues: JiraIssue[]
}

export type JiraIssueDetails = {
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
  dueDate: string | null
  updated: string | null
  labels: string[]
  components: string[]
  fixVersions: string[]
  description: string
  url: string
  rawFields: Record<string, unknown>
}

export type IssueDetailsResponse = {
  issue: JiraIssueDetails
  error?: string
  details?: string
}

export type JiraTransition = {
  id: string
  name: string
  toStatus: string
}

export type JiraTransitionsResponse = {
  issueKey: string
  transitions: JiraTransition[]
  error?: string
  details?: string
}

export type JiraIssueUpdateResponse = {
  updated: boolean
  issueKey: string
  error?: string
  details?: string
}

export type GithubBranch = {
  name: string
  url: string
  repo: string
}

export type GithubPullRequest = {
  number: number
  title: string
  state: string
  url: string
  repo: string
  branch: string
}

export type IssueLinksResponse = {
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

export type GithubRepo = {
  name: string
  defaultBranch: string
  url: string
  private: boolean
}

export type GithubBranchOption = {
  name: string
  url: string
}

export type GithubFileOption = {
  path: string
}

export type GithubFileContent = {
  path: string
  content: string
  htmlUrl: string
}

export type GithubReposResponse = {
  enabled: boolean
  repos: GithubRepo[]
  error?: string
  details?: string
}

export type GithubRepoBranchesResponse = {
  enabled: boolean
  repo: string
  branches: GithubBranchOption[]
  error?: string
  details?: string
}

export type GithubRepoFilesResponse = {
  enabled: boolean
  repo: string
  branch: string
  files: GithubFileOption[]
  error?: string
  details?: string
}

export type GithubRepoFileResponse = {
  enabled: boolean
  repo: string
  branch: string
  file: GithubFileContent
  error?: string
  details?: string
}

export type GithubCreateBranchResponse = {
  created: boolean
  repo: string
  sourceBranch: string
  branch: {
    name: string
    url: string
  }
  error?: string
  details?: string
}

export type GithubCommitResponse = {
  committed: boolean
  repo: string
  branch: string
  commit: {
    sha: string
    url: string
    message: string
  }
  filesChanged: number
  error?: string
  details?: string
}

export type AiAssistResult = {
  ticketExplanation: string
  updatedSummary: string
  updatedDescription: string
  ticketUpdateReasoning: string
  branchSuggestions: string[]
  fixPlan: string[]
  planSteps: string[]
  planSummary: string
  reviewNotes: string
  implementationSummary: string
  implementationChanges: AiImplementationChange[]
}

export type AiImplementationChange = {
  path: string
  action: 'create' | 'update' | 'delete'
  content: string
  reason: string
}

export type AiAssistResponse = {
  provider: string
  model: string
  task: string
  repoSnapshot?: {
    repo: string
    branch: string
    fileCount: number
    omittedCount: number
    truncated: boolean
    readableFileCount: number
  }
  result: AiAssistResult
  error?: string
  details?: string
}

export type AiFlowMode = 'explain-ticket' | 'read-repo' | 'suggest-plan' | 'edit-plan' | 'implement-plan'

export type StagedFileChange = {
  path: string
  content: string
}

export type FileMode = 'existing' | 'new'

export type FormattedFieldEntry = {
  key: string
  label: string
  valueText: string
  preview: string
  fieldType: string
}
