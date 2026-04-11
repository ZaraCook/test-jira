import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createGithubBranch,
  createGithubCommit,
  loadGithubBranches,
  loadGithubFileContent,
  loadGithubFiles,
  loadGithubRepos,
} from '../api/githubApi'
import { loadIssueLinks } from '../api/jiraApi'
import type {
  FileMode,
  GithubBranch,
  GithubBranchOption,
  GithubFileOption,
  GithubPullRequest,
  GithubRepo,
  JiraIssue,
  StagedFileChange,
} from '../types'
import { getAutoLinkedBranch, getAvailableRepos, parseRepo } from '../utils/github'

type UseGithubWorkspaceParams = {
  selectedIssue: JiraIssue | null
}

export function useGithubWorkspace({ selectedIssue }: UseGithubWorkspaceParams) {
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

  const availableRepos = useMemo(() => {
    return getAvailableRepos(githubRepos, reposChecked, githubBranches, githubPullRequests)
  }, [githubRepos, reposChecked, githubBranches, githubPullRequests])

  const availableBranches = repoBranches
  const availableFiles = branchFiles

  const autoLinkedBranch = useMemo(() => {
    return getAutoLinkedBranch(githubBranches, selectedIssue)
  }, [githubBranches, selectedIssue])

  const fetchGithubRepos = useCallback(async () => {
    setLoadingGithubRepos(true)
    setGithubApiError(null)

    try {
      const payload = await loadGithubRepos()
      const nextRepos = payload.repos || []
      setGithubRepos(nextRepos)

      if (nextRepos.length === 0) {
        setSelectedRepo('')
        return
      }

      const preferredRepo =
        githubBranches[0]?.repo || githubPullRequests[0]?.repo || reposChecked[0] || nextRepos[0]?.name || ''

      const hasPreferred = nextRepos.some((repo) => repo.name === preferredRepo)
      setSelectedRepo(hasPreferred ? preferredRepo : nextRepos[0]?.name || '')
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

  const fetchIssueLinks = useCallback(async (issue: JiraIssue) => {
    try {
      setLinksLoading(true)
      setLinksError(null)
      setGithubBranches([])
      setGithubPullRequests([])
      setReposChecked([])
      setSelectedRepo('')
      setSelectedBranch('')
      setSelectedFile('')

      const payload = await loadIssueLinks(issue)
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

      const payload = await createGithubBranch(parsed, {
        branchName: branchDraftName.trim(),
        fromBranch: selectedBranch || undefined,
      })

      const newBranch = payload.branch?.name || branchDraftName.trim()
      setRepoBranches((prev) => {
        const exists = prev.some((branch) => branch.name === newBranch)
        if (exists) {
          return prev
        }

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
  }, [branchDraftName, selectedBranch, selectedRepo])

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

      const payload = await createGithubCommit(parsed, {
        branch: selectedBranch,
        message: trimmedMessage,
        changes: stagedChanges,
      })

      setCommitSuccess(`Committed ${payload.filesChanged} file(s) to ${selectedBranch}.`)
      setStagedChanges([])
      setCommitMessage('')
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Unknown error while committing changes')
    } finally {
      setIsCommitting(false)
    }
  }, [commitMessage, selectedBranch, selectedRepo, stagedChanges])

  const mergeStagedChanges = useCallback((changes: StagedFileChange[]) => {
    setStagedChanges((prev) => {
      const merged = [...prev]

      for (const change of changes) {
        const existingIndex = merged.findIndex((item) => item.path === change.path)
        if (existingIndex >= 0) {
          merged[existingIndex] = change
        } else {
          merged.push(change)
        }
      }

      return merged
    })
  }, [])

  const resetGithubWorkspace = useCallback(() => {
    setLinksError(null)
    setLinksLoading(false)
    setGithubBranches([])
    setGithubPullRequests([])
    setReposChecked([])
    setGithubApiError(null)
    setSelectedRepo('')
    setSelectedBranch('')
    setSelectedFile('')
    setSelectedFileContent('')
    setSelectedFileUrl('')
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
  }, [])

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

    const loadBranchesForRepo = async () => {
      setLoadingGithubBranches(true)
      setGithubApiError(null)

      try {
        const payload = await loadGithubBranches(parsed)
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

    void loadBranchesForRepo()
  }, [githubConnected, githubBranches, selectedBranch, selectedRepo])

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

    const loadFilesForBranch = async () => {
      setLoadingGithubFiles(true)
      setGithubApiError(null)

      try {
        const payload = await loadGithubFiles(parsed, selectedBranch)
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

    void loadFilesForBranch()
  }, [githubConnected, selectedBranch, selectedFile, selectedRepo])

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

    const loadSelectedFile = async () => {
      setGithubApiError(null)

      try {
        const payload = await loadGithubFileContent(parsed, selectedBranch, selectedFile)
        setSelectedFileContent(payload.file?.content || '')
        setSelectedFileUrl(payload.file?.htmlUrl || '')
      } catch (err) {
        setGithubApiError(err instanceof Error ? err.message : 'Unknown GitHub error')
        setSelectedFileContent('')
        setSelectedFileUrl('')
      }
    }

    void loadSelectedFile()
  }, [githubConnected, selectedBranch, selectedFile, selectedRepo])

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

  return {
    linksLoading,
    linksError,
    githubBranches,
    githubPullRequests,
    reposChecked,
    githubConnected,
    githubApiError,
    loadingGithubRepos,
    loadingGithubBranches,
    loadingGithubFiles,
    selectedRepo,
    setSelectedRepo,
    selectedBranch,
    setSelectedBranch,
    selectedFile,
    setSelectedFile,
    selectedFileContent,
    selectedFileUrl,
    availableRepos,
    availableBranches,
    availableFiles,
    autoLinkedBranch,
    branchDraftName,
    setBranchDraftName,
    creatingBranch,
    branchCreateError,
    branchCreateSuccess,
    fileMode,
    setFileMode,
    editorFilePath,
    setEditorFilePath,
    editorFileContent,
    setEditorFileContent,
    commitMessage,
    setCommitMessage,
    commitError,
    commitSuccess,
    isCommitting,
    stagedChanges,
    connectGithub,
    fetchIssueLinks,
    handleCreateBranch,
    handleStageFileChange,
    handleUnstageFileChange,
    handleCommitAndPush,
    mergeStagedChanges,
    resetGithubWorkspace,
  }
}
