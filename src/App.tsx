import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { CodeEditor } from './CodeEditor'
import { ErrorBoundary } from './ErrorBoundary'

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

type JiraTransition = {
  id: string
  name: string
  toStatus: string
}

type JiraTransitionsResponse = {
  issueKey: string
  transitions: JiraTransition[]
  error?: string
  details?: string
}

type JiraIssueUpdateResponse = {
  updated: boolean
  issueKey: string
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

type GithubCreateBranchResponse = {
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

type GithubCommitResponse = {
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

type StagedFileChange = {
  path: string
  content: string
}

type FileMode = 'existing' | 'new'

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
  const [selectedRepo, setSelectedRepo] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedFile, setSelectedFile] = useState('')
  const [fieldSearch, setFieldSearch] = useState('')
  const [ticketDraftSummary, setTicketDraftSummary] = useState('')
  const [ticketDraftDescription, setTicketDraftDescription] = useState('')
  const [isEditingTicket, setIsEditingTicket] = useState(false)
  const [ticketTransitions, setTicketTransitions] = useState<JiraTransition[]>([])
  const [selectedTransitionId, setSelectedTransitionId] = useState('')
  const [savingTicket, setSavingTicket] = useState(false)
  const [ticketSaveError, setTicketSaveError] = useState<string | null>(null)
  const [ticketSaveSuccess, setTicketSaveSuccess] = useState<string | null>(null)
  const [branchDraftName, setBranchDraftName] = useState('')
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [branchCreateError, setBranchCreateError] = useState<string | null>(null)
  const [branchCreateSuccess, setBranchCreateSuccess] = useState<string | null>(null)
  const [stagedChanges, setStagedChanges] = useState<StagedFileChange[]>([])
  const [fileMode, setFileMode] = useState<FileMode>('existing')
  const [editorFilePath, setEditorFilePath] = useState('')
  const [editorFileContent, setEditorFileContent] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [commitError, setCommitError] = useState<string | null>(null)
  const [commitSuccess, setCommitSuccess] = useState<string | null>(null)
  const [isCommitting, setIsCommitting] = useState(false)

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

  const friendlyFieldLabel = useCallback((key: string): string => {
    if (/^customfield_\d+$/i.test(key)) {
      return `Custom Field (${key.replace(/customfield_/i, '')})`
    }

    return key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }, [])

  const summarizeFieldValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return 'Not set'

    if (typeof value === 'string') {
      return value.trim() || 'Not set'
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return 'None'

      const compact = value
        .slice(0, 4)
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') {
            return item.name
          }
          return JSON.stringify(item)
        })
        .join(', ')

      return value.length > 4 ? `${compact} +${value.length - 4} more` : compact
    }

    if (typeof value === 'object') {
      const namedValue = value as { name?: string; value?: string; displayName?: string }
      if (namedValue.displayName) return namedValue.displayName
      if (namedValue.name) return namedValue.name
      if (namedValue.value) return namedValue.value
      return 'Structured value'
    }

    return 'Value available'
  }, [])

  const detectFieldType = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return 'empty'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') return 'object'
    return typeof value
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
          label: friendlyFieldLabel(key),
          valueText,
          preview: preview || summarizeFieldValue(value),
          fieldType: detectFieldType(value),
        }
      })
      .filter((entry) => {
        if (!search) return true
        return (
          entry.key.toLowerCase().includes(search) ||
          entry.label.toLowerCase().includes(search) ||
          entry.preview.toLowerCase().includes(search)
        )
      })
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [
    detectFieldType,
    fieldSearch,
    friendlyFieldLabel,
    selectedIssueDetails,
    stringifyFieldValue,
    summarizeFieldValue,
  ])

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

  const fetchIssueTransitions = useCallback(async (issueKey: string) => {
    try {
      setTicketTransitions([])

      const response = await fetch(`http://localhost:3001/api/issues/${encodeURIComponent(issueKey)}/transitions`, {
        cache: 'no-store',
      })

      const payload = (await response.json()) as JiraTransitionsResponse

      if (!response.ok) {
        const detailText = payload.details ? ` (${payload.details})` : ''
        throw new Error((payload.error || 'Failed to load Jira transitions') + detailText)
      }

      setTicketTransitions(payload.transitions || [])
    } catch {
      setTicketTransitions([])
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
      setIsEditingTicket(false)
      setTicketSaveError(null)
      setTicketSaveSuccess(null)
      setBranchCreateError(null)
      setBranchCreateSuccess(null)
      void fetchIssueDetails(issue.key)
      void fetchIssueTransitions(issue.key)
      void fetchIssueLinks(issue)
    },
    [fetchIssueDetails, fetchIssueLinks, fetchIssueTransitions],
  )

  const handleSaveTicket = useCallback(async () => {
    if (!selectedIssue || !isEditingTicket) {
      return
    }

    try {
      setSavingTicket(true)
      setTicketSaveError(null)
      setTicketSaveSuccess(null)

      const response = await fetch(`http://localhost:3001/api/issues/${encodeURIComponent(selectedIssue.key)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: ticketDraftSummary,
          description: ticketDraftDescription,
          transitionId: selectedTransitionId || undefined,
        }),
      })

      const payload = (await response.json()) as JiraIssueUpdateResponse

      if (!response.ok) {
        const detailText = payload.details ? ` (${payload.details})` : ''
        throw new Error((payload.error || 'Failed to save Jira issue') + detailText)
      }

      setSelectedTransitionId('')
      setIsEditingTicket(false)
      setTicketSaveSuccess('Ticket updated successfully in Jira.')
      await Promise.all([
        fetchIssueDetails(selectedIssue.key),
        fetchIssues(),
        fetchIssueLinks(selectedIssue),
        fetchIssueTransitions(selectedIssue.key),
      ])
    } catch (err) {
      setTicketSaveError(err instanceof Error ? err.message : 'Unknown error while saving ticket')
    } finally {
      setSavingTicket(false)
    }
  }, [
    fetchIssueDetails,
    fetchIssueLinks,
    fetchIssueTransitions,
    fetchIssues,
    selectedIssue,
    isEditingTicket,
    selectedTransitionId,
    ticketDraftDescription,
    ticketDraftSummary,
  ])

  const handleStartEditTicket = useCallback(() => {
    setTicketSaveError(null)
    setTicketSaveSuccess(null)
    setIsEditingTicket(true)
  }, [])

  const handleCancelEditTicket = useCallback(() => {
    if (selectedIssueDetails) {
      setTicketDraftSummary(selectedIssueDetails.summary || '')
      setTicketDraftDescription(selectedIssueDetails.description || '')
    }

    setSelectedTransitionId('')
    setTicketSaveError(null)
    setTicketSaveSuccess(null)
    setIsEditingTicket(false)
  }, [selectedIssueDetails])

  const handleCreateBranch = useCallback(async () => {
    if (!selectedRepo || !branchDraftName.trim()) {
      setBranchCreateError('Select a repository and enter a branch name.')
      return
    }

    const parsed = parseRepo(selectedRepo)
    if (!parsed) {
      setBranchCreateError('Invalid repository format. Expected owner/repo.')
      return
    }

    try {
      setCreatingBranch(true)
      setBranchCreateError(null)
      setBranchCreateSuccess(null)

      const response = await fetch(
        `http://localhost:3001/api/github/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/branches`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branchName: branchDraftName.trim(),
            fromBranch: selectedBranch || undefined,
          }),
        },
      )

      const payload = (await response.json()) as GithubCreateBranchResponse

      if (!response.ok) {
        const detailText = payload.details ? ` (${payload.details})` : ''
        throw new Error((payload.error || 'Failed to create branch') + detailText)
      }

      const newBranch = payload.branch?.name || branchDraftName.trim()

      setRepoBranches((prev) => {
        const exists = prev.some((branch) => branch.name === newBranch)
        if (exists) return prev

        return [
          ...prev,
          {
            name: newBranch,
            url: payload.branch?.url || `https://github.com/${selectedRepo}/tree/${encodeURIComponent(newBranch)}`,
          },
        ].sort((a, b) => a.name.localeCompare(b.name))
      })

      setSelectedBranch(newBranch)
      setBranchDraftName('')
      setBranchCreateSuccess(`Created ${newBranch} from ${payload.sourceBranch}.`)
    } catch (err) {
      setBranchCreateError(err instanceof Error ? err.message : 'Unknown error while creating branch')
    } finally {
      setCreatingBranch(false)
    }
  }, [branchDraftName, parseRepo, selectedBranch, selectedRepo])

  const handleStageFileChange = useCallback(() => {
    const path = editorFilePath.trim()

    if (!path) {
      setCommitError('File path is required to stage a change.')
      return
    }

    setCommitError(null)
    setCommitSuccess(null)

    setStagedChanges((prev) => {
      const next = [...prev]
      const existingIndex = next.findIndex((item) => item.path === path)
      const change = { path, content: editorFileContent }

      if (existingIndex >= 0) {
        next[existingIndex] = change
      } else {
        next.push(change)
      }

      return next
    })
  }, [editorFileContent, editorFilePath])

  const handleUnstageFileChange = useCallback((path: string) => {
    setStagedChanges((prev) => prev.filter((item) => item.path !== path))
  }, [])

  const handleCommitAndPush = useCallback(async () => {
    if (!selectedRepo || !selectedBranch) {
      setCommitError('Select a repository and branch before committing.')
      return
    }

    if (stagedChanges.length === 0) {
      setCommitError('No staged changes to commit.')
      return
    }

    const parsed = parseRepo(selectedRepo)
    if (!parsed) {
      setCommitError('Invalid repository format. Expected owner/repo.')
      return
    }

    const trimmedMessage = commitMessage.trim()
    if (!trimmedMessage) {
      setCommitError('Commit message is required.')
      return
    }

    try {
      setIsCommitting(true)
      setCommitError(null)
      setCommitSuccess(null)

      const response = await fetch(
        `http://localhost:3001/api/github/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/commits`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branch: selectedBranch,
            message: trimmedMessage,
            changes: stagedChanges,
          }),
        },
      )

      const payload = (await response.json()) as GithubCommitResponse

      if (!response.ok) {
        const detailText = payload.details ? ` (${payload.details})` : ''
        throw new Error((payload.error || 'Failed to commit and push changes') + detailText)
      }

      setCommitSuccess(`Committed ${payload.filesChanged} file(s) to ${selectedBranch}.`)
      setStagedChanges([])
      setCommitMessage('')
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Unknown error while committing changes')
    } finally {
      setIsCommitting(false)
    }
  }, [
    commitMessage,
    editorFilePath,
    parseRepo,
    selectedBranch,
    selectedFile,
    selectedRepo,
    stagedChanges,
  ])

  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

  useEffect(() => {
    if (!selectedIssueDetails) {
      return
    }

    setTicketDraftSummary(selectedIssueDetails.summary || '')
    setTicketDraftDescription(selectedIssueDetails.description || '')
    setIsEditingTicket(false)
  }, [selectedIssueDetails])

  useEffect(() => {
    if (fileMode === 'existing') {
      setEditorFilePath(selectedFile || '')
      setEditorFileContent(selectedFileContent || '')
      return
    }

    if (!editorFilePath) {
      setEditorFileContent('')
    }
  }, [editorFilePath, fileMode, selectedFile, selectedFileContent])

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
    setTicketDraftSummary('')
    setTicketDraftDescription('')
    setIsEditingTicket(false)
    setTicketTransitions([])
    setSelectedTransitionId('')
    setTicketSaveError(null)
    setTicketSaveSuccess(null)
    setBranchDraftName('')
    setBranchCreateError(null)
    setBranchCreateSuccess(null)
    setStagedChanges([])
    setFileMode('existing')
    setEditorFilePath('')
    setEditorFileContent('')
    setCommitMessage('')
    setCommitError(null)
    setCommitSuccess(null)
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

          </div>

          <div className="panel-section branch-create-section">
            <h3>Create branch</h3>
            <div className="github-controls">
              <label>
                New branch name
                <input
                  type="text"
                  className="search-input"
                  placeholder={selectedIssue ? `feature/${selectedIssue.key.toLowerCase()}-change` : 'feature/new-branch'}
                  value={branchDraftName}
                  onChange={(event) => setBranchDraftName(event.target.value)}
                  disabled={!githubConnected || !selectedRepo || creatingBranch}
                />
              </label>
            </div>
            <button
              type="button"
              className="refresh-btn"
              onClick={() => void handleCreateBranch()}
              disabled={!githubConnected || !selectedRepo || creatingBranch || !branchDraftName.trim()}
            >
              {creatingBranch ? 'Creating branch...' : 'Create branch'}
            </button>

            {branchCreateError && <p className="error-inline">{branchCreateError}</p>}
            {branchCreateSuccess && <p className="success-inline">{branchCreateSuccess}</p>}
          </div>

          <div className="panel-section branch-create-section">
            <h3>Edit files and push</h3>
            <div className="github-controls">
              <label>
                File action
                <select
                  value={fileMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as FileMode
                    setFileMode(nextMode)

                    if (nextMode === 'existing') {
                      setEditorFilePath(selectedFile || '')
                      setEditorFileContent(selectedFileContent || '')
                      return
                    }

                    setSelectedFile('')
                    setEditorFilePath('')
                    setEditorFileContent('')
                  }}
                  disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
                >
                  <option value="existing">Existing file</option>
                  <option value="new">New file</option>
                </select>
              </label>

              {fileMode === 'existing' ? (
                <label>
                  File
                  <select
                    value={selectedFile}
                    onChange={(event) => {
                      const nextFile = event.target.value
                      setSelectedFile(nextFile)
                      setEditorFilePath(nextFile)
                      setEditorFileContent('')
                    }}
                    disabled={!githubConnected || !selectedBranch || loadingGithubFiles || isCommitting}
                  >
                    <option value="">Select a file</option>
                    {availableFiles.map((file) => (
                      <option key={file.path} value={file.path}>
                        {file.path}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  New file path
                  <input
                    type="text"
                    className="search-input"
                    placeholder="src/new-file.ts"
                    value={editorFilePath}
                    onChange={(event) => setEditorFilePath(event.target.value)}
                    disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
                  />
                </label>
              )}

              <label>
                File content
                <ErrorBoundary
                  fallback={
                    <textarea
                      className="ticket-textarea"
                      rows={8}
                      value={editorFileContent}
                      onChange={(event) => setEditorFileContent(event.target.value)}
                      disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
                    />
                  }
                >
                  <CodeEditor
                    value={editorFileContent}
                    onChange={(value) => setEditorFileContent(value)}
                    disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
                    fileName={fileMode === 'existing' ? selectedFile : editorFilePath}
                  />
                </ErrorBoundary>
              </label>
            </div>

            {fileMode === 'existing' && selectedFile && (
              <p className="field-meta">Editing existing file: {selectedFile}</p>
            )}

            {fileMode === 'new' && <p className="field-meta">Create a new file by entering a path and content.</p>}

            <div className="workspace-actions">
              <button
                type="button"
                className="refresh-btn"
                onClick={handleStageFileChange}
                disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting || !editorFilePath.trim()}
              >
                Stage file change
              </button>
            </div>

            {stagedChanges.length > 0 && (
              <ul className="detail-list">
                {stagedChanges.map((change) => (
                  <li key={change.path} className="detail-card">
                    <div className="detail-subtext">{change.path}</div>
                    <div className="workspace-actions">
                      <button
                        type="button"
                        className="close-btn"
                        onClick={() => handleUnstageFileChange(change.path)}
                        disabled={isCommitting}
                      >
                        Unstage
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="github-controls">
              <label>
                Commit message
                <input
                  type="text"
                  className="search-input"
                  placeholder="feat: update issue flow"
                  value={commitMessage}
                  onChange={(event) => setCommitMessage(event.target.value)}
                  disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
                />
              </label>
            </div>

            <div className="workspace-actions">
              <button
                type="button"
                className="refresh-btn"
                onClick={() => void handleCommitAndPush()}
                disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting || stagedChanges.length === 0}
              >
                {isCommitting ? 'Committing and pushing...' : 'Commit and push'}
              </button>
            </div>

            {commitError && <p className="error-inline">{commitError}</p>}
            {commitSuccess && <p className="success-inline">{commitSuccess}</p>}
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
                <div className="section-title-row">
                  <h3>Edit ticket</h3>
                  {!isEditingTicket && (
                    <button type="button" className="refresh-btn" onClick={handleStartEditTicket}>
                      Edit ticket
                    </button>
                  )}
                </div>
                <div className="github-controls">
                  <label>
                    Summary
                    <input
                      type="text"
                      className="search-input"
                      value={ticketDraftSummary}
                      onChange={(event) => setTicketDraftSummary(event.target.value)}
                      disabled={!isEditingTicket || savingTicket}
                    />
                  </label>

                  <label>
                    Description
                    <textarea
                      className="ticket-textarea"
                      value={ticketDraftDescription}
                      onChange={(event) => setTicketDraftDescription(event.target.value)}
                      disabled={!isEditingTicket || savingTicket}
                      rows={7}
                    />
                  </label>

                </div>

                {isEditingTicket && (
                  <div className="workspace-actions">
                    <button type="button" className="refresh-btn" onClick={() => void handleSaveTicket()} disabled={savingTicket}>
                      {savingTicket ? 'Saving...' : 'Save to Jira'}
                    </button>
                    <button type="button" className="close-btn" onClick={handleCancelEditTicket} disabled={savingTicket}>
                      Cancel
                    </button>
                  </div>
                )}

                {ticketSaveError && <p className="error-inline">{ticketSaveError}</p>}
                {ticketSaveSuccess && <p className="success-inline">{ticketSaveSuccess}</p>}
              </div>

              <div className="panel-section">
                <h3>Ticket details</h3>
                <div className="jira-property-shell">
                  <div className="jira-property-row">
                    <span className="detail-label">Status</span>
                    {isEditingTicket ? (
                      <select
                        value={selectedTransitionId}
                        onChange={(event) => setSelectedTransitionId(event.target.value)}
                        disabled={savingTicket || ticketTransitions.length === 0}
                      >
                        <option value="">Keep current ({selectedIssueDetails.status})</option>
                        {ticketTransitions.map((transition) => (
                          <option key={transition.id} value={transition.id}>
                            {transition.toStatus || transition.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`status-pill status-${selectedIssueDetails.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {selectedIssueDetails.status}
                      </span>
                    )}
                  </div>
                  <div className="jira-property-row">
                    <span className="detail-label">Type</span>
                    <span className="detail-value">{selectedIssueDetails.type}</span>
                  </div>
                  <div className="jira-property-row">
                    <span className="detail-label">Priority</span>
                    <span className="detail-value">{selectedIssueDetails.priority}</span>
                  </div>
                  <div className="jira-property-row">
                    <span className="detail-label">Assignee</span>
                    <span className="detail-value">{selectedIssueDetails.assignee}</span>
                  </div>
                  <div className="jira-property-row">
                    <span className="detail-label">Reporter</span>
                    <span className="detail-value">{selectedIssueDetails.reporter}</span>
                  </div>
                  <div className="jira-property-row">
                    <span className="detail-label">Creator</span>
                    <span className="detail-value">{selectedIssueDetails.creator}</span>
                  </div>
                  <div className="jira-property-row">
                    <span className="detail-label">Created</span>
                    <span className="detail-value">
                      {selectedIssueDetails.created
                        ? new Date(selectedIssueDetails.created).toLocaleString()
                        : 'Unknown'}
                    </span>
                  </div>
                  <div className="jira-property-row">
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
                          <span className="field-key">{entry.label}</span>
                          <span className="field-meta">{entry.key} · {entry.fieldType}</span>
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