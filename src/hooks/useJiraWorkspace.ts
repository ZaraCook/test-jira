import { useCallback } from 'react'
import type { GithubPanelProps } from '../components/GithubPanel'
import { useAiWorkspace } from './useAiWorkspace'
import { useGithubWorkspace } from './useGithubWorkspace'
import { useIssueWorkspace } from './useIssueWorkspace'
import type { IssueBrowserPageProps } from '../pages/IssueBrowserPage'
import type { TicketWorkspacePageProps } from '../pages/TicketWorkspacePage'
import type { JiraIssue } from '../types'
import { getDefaultBranchName } from '../utils/github'

type JiraWorkspaceState = {
  selectedIssue: JiraIssue | null
  issueBrowserProps: IssueBrowserPageProps
  githubPanelProps: GithubPanelProps
  ticketWorkspaceProps: Omit<TicketWorkspacePageProps, 'githubPanel'> | null
}

export function useJiraWorkspace(): JiraWorkspaceState {
  const issue = useIssueWorkspace()
  const github = useGithubWorkspace({ selectedIssue: issue.selectedIssue })

  const ai = useAiWorkspace({
    selectedIssueDetails: issue.selectedIssueDetails,
    selectedRepo: github.selectedRepo,
    selectedBranch: github.selectedBranch,
    availableBranches: github.availableBranches,
    onImplementationChanges: github.mergeStagedChanges,
    onImplementationEditorUpdate: (path, content) => {
      github.setEditorFilePath(path)
      github.setEditorFileContent(content)
      github.setFileMode('new')
      github.setSelectedFile('')
    },
  })

  const handleSelectIssue = useCallback(
    (nextIssue: JiraIssue) => {
      issue.setSelectedIssue(nextIssue)
      ai.resetAiState()
      github.setBranchDraftName(getDefaultBranchName(nextIssue.key))
      issue.setTicketSaveError(null)
      issue.setTicketSaveSuccess(null)
      void issue.fetchIssueDetails(nextIssue.key)
      void issue.fetchIssueTransitions(nextIssue.key)
      void github.fetchIssueLinks(nextIssue)
    },
    [ai, github, issue],
  )

  const applyAiTicketDraft = useCallback(() => {
    if (!ai.aiResult) {
      return
    }

    if (ai.aiResult.updatedSummary) {
      issue.setTicketDraftSummary(ai.aiResult.updatedSummary)
    }

    if (ai.aiResult.updatedDescription) {
      issue.setTicketDraftDescription(ai.aiResult.updatedDescription)
    }

    issue.handleStartEditTicket()
  }, [ai.aiResult, issue])

  const closeDetails = useCallback(() => {
    issue.resetIssueWorkspace()
    github.resetGithubWorkspace()
    ai.resetAiState()
  }, [ai, github, issue])

  const issueBrowserProps: IssueBrowserPageProps = {
    loading: issue.loading,
    error: issue.error,
    filteredIssues: issue.filteredIssues,
    total: issue.total,
    searchText: issue.searchText,
    assigneeFilter: issue.assigneeFilter,
    issuesCount: issue.issues.length,
    assigneeOptions: issue.assigneeOptions,
    selectedIssueKey: null,
    onSearchTextChange: issue.setSearchText,
    onAssigneeFilterChange: issue.setAssigneeFilter,
    onRefresh: () => void issue.fetchIssues(),
    onSelectIssue: handleSelectIssue,
  }

  const githubPanelProps: GithubPanelProps = {
    githubConnected: github.githubConnected,
    loadingGithubRepos: github.loadingGithubRepos,
    onConnectGithub: () => void github.connectGithub(),
    selectedRepo: github.selectedRepo,
    onSelectedRepoChange: github.setSelectedRepo,
    availableRepos: github.availableRepos,
    selectedBranch: github.selectedBranch,
    onSelectedBranchChange: github.setSelectedBranch,
    loadingGithubBranches: github.loadingGithubBranches,
    availableBranches: github.availableBranches,
    aiPrompt: ai.aiPrompt,
    onAiPromptChange: ai.setAiPrompt,
    aiLoadingTask: ai.aiLoadingTask,
    aiFlowMode: ai.aiFlowMode,
    onAiFlowModeChange: ai.setAiFlowMode,
    runSelectedAiFlow: ai.runSelectedAiFlow,
    currentAiModeLabel: ai.currentAiMode.label,
    aiSnapshotSummary: ai.aiSnapshotSummary,
    planApproved: ai.planApproved,
    aiPlanText: ai.aiPlanText,
    onAiPlanTextChange: (value) => {
      ai.setAiPlanText(value)
      ai.setApprovedPlanText('')
      ai.setPlanApproved(false)
    },
    handleReviewPlan: ai.handleReviewPlan,
    handleApprovePlan: ai.handleApprovePlan,
    aiResult: ai.aiResult,
    approvedPlanText: ai.approvedPlanText,
    handleImplementChanges: ai.handleImplementChanges,
    onSetBranchDraftName: github.setBranchDraftName,
    applyAiTicketDraft,
    aiError: ai.aiError,
    selectedIssue: issue.selectedIssue,
    getDefaultBranchName,
    branchDraftName: github.branchDraftName,
    creatingBranch: github.creatingBranch,
    onBranchDraftNameChange: github.setBranchDraftName,
    handleCreateBranch: () => void github.handleCreateBranch(),
    branchCreateError: github.branchCreateError,
    branchCreateSuccess: github.branchCreateSuccess,
    fileMode: github.fileMode,
    onFileModeChange: github.setFileMode,
    selectedFile: github.selectedFile,
    onSelectedFileChange: github.setSelectedFile,
    editorFilePath: github.editorFilePath,
    onEditorFilePathChange: github.setEditorFilePath,
    selectedFileContent: github.selectedFileContent,
    editorFileContent: github.editorFileContent,
    onEditorFileContentChange: github.setEditorFileContent,
    isCommitting: github.isCommitting,
    loadingGithubFiles: github.loadingGithubFiles,
    availableFiles: github.availableFiles,
    handleStageFileChange: github.handleStageFileChange,
    stagedChanges: github.stagedChanges,
    handleUnstageFileChange: github.handleUnstageFileChange,
    commitMessage: github.commitMessage,
    onCommitMessageChange: github.setCommitMessage,
    handleCommitAndPush: () => void github.handleCommitAndPush(),
    commitError: github.commitError,
    commitSuccess: github.commitSuccess,
    githubApiError: github.githubApiError,
    selectedFileUrl: github.selectedFileUrl,
    autoLinkedBranch: github.autoLinkedBranch,
    githubPullRequests: github.githubPullRequests,
    reposChecked: github.reposChecked,
  }

  const ticketWorkspaceProps: Omit<TicketWorkspacePageProps, 'githubPanel'> | null = issue.selectedIssue
    ? {
        selectedIssue: issue.selectedIssue,
        selectedIssueDetails: issue.selectedIssueDetails,
        issueDetailsLoading: issue.issueDetailsLoading,
        issueDetailsError: issue.issueDetailsError,
        linksLoading: github.linksLoading,
        linksError: github.linksError,
        githubBranches: github.githubBranches,
        fieldSearch: issue.fieldSearch,
        formattedFieldEntries: issue.formattedFieldEntries,
        ticketDraftSummary: issue.ticketDraftSummary,
        ticketDraftDescription: issue.ticketDraftDescription,
        isEditingTicket: issue.isEditingTicket,
        savingTicket: issue.savingTicket,
        ticketTransitions: issue.ticketTransitions,
        selectedTransitionId: issue.selectedTransitionId,
        ticketSaveError: issue.ticketSaveError,
        ticketSaveSuccess: issue.ticketSaveSuccess,
        onBackToIssues: closeDetails,
        onStartEditTicket: issue.handleStartEditTicket,
        onSummaryChange: issue.setTicketDraftSummary,
        onDescriptionChange: issue.setTicketDraftDescription,
        onTransitionChange: issue.setSelectedTransitionId,
        onSaveTicket: () => void issue.saveTicket({ refreshIssueLinks: github.fetchIssueLinks }),
        onCancelEditTicket: issue.handleCancelEditTicket,
        onFieldSearchChange: issue.setFieldSearch,
      }
    : null

  return {
    selectedIssue: issue.selectedIssue,
    issueBrowserProps,
    githubPanelProps,
    ticketWorkspaceProps,
  }
}
