import { useCallback, useEffect, useState } from 'react'
import { requestAiAssist as requestAiAssistApi } from '../api/aiApi'
import type { AiAssistResult, AiFlowMode, GithubBranchOption, JiraIssueDetails, StagedFileChange } from '../types'
import { buildPlanText, getAiModeConfig, normalizeAiResult } from '../utils/ai'

type UseAiWorkspaceParams = {
  selectedIssueDetails: JiraIssueDetails | null
  selectedRepo: string
  selectedBranch: string
  availableBranches: GithubBranchOption[]
  onImplementationChanges: (changes: StagedFileChange[]) => void
  onImplementationEditorUpdate: (path: string, content: string) => void
}

export function useAiWorkspace({
  selectedIssueDetails,
  selectedRepo,
  selectedBranch,
  availableBranches,
  onImplementationChanges,
  onImplementationEditorUpdate,
}: UseAiWorkspaceParams) {
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoadingTask, setAiLoadingTask] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<AiAssistResult | null>(null)
  const [aiPlanText, setAiPlanText] = useState('')
  const [approvedPlanText, setApprovedPlanText] = useState('')
  const [planApproved, setPlanApproved] = useState(false)
  const [aiFlowMode, setAiFlowMode] = useState<AiFlowMode>('read-repo')
  const [aiSnapshotSummary, setAiSnapshotSummary] = useState('')

  const currentAiMode = getAiModeConfig(aiFlowMode)

  const resetAiState = useCallback(() => {
    setAiPrompt('')
    setAiLoadingTask('')
    setAiError(null)
    setAiResult(null)
    setAiPlanText('')
    setApprovedPlanText('')
    setPlanApproved(false)
    setAiFlowMode('read-repo')
    setAiSnapshotSummary('')
  }, [])

  const requestAiAssist = useCallback(
    async ({
      task,
      userExplanation,
      planDraft,
      approvedPlan,
    }: {
      task:
        | 'auto'
        | 'explain-ticket'
        | 'update-ticket'
        | 'suggest-branches'
        | 'suggest-fix'
        | 'suggest-implementation'
        | 'review-plan'
        | 'implement-changes'
      userExplanation?: string
      planDraft?: string
      approvedPlan?: string
    }) => {
      if (!selectedIssueDetails) {
        setAiError('Select an issue before using the AI assistant.')
        return
      }

      try {
        setAiLoadingTask(task)
        setAiError(null)

        const payload = await requestAiAssistApi({
          task,
          userExplanation: userExplanation ?? aiPrompt,
          planDraft,
          approvedPlan,
          repo: selectedRepo,
          branch: selectedBranch,
          existingBranches: availableBranches.map((item) => item.name),
          issue: {
            key: selectedIssueDetails.key,
            summary: selectedIssueDetails.summary,
            description: selectedIssueDetails.description,
            status: selectedIssueDetails.status,
            type: selectedIssueDetails.type,
            priority: selectedIssueDetails.priority,
            assignee: selectedIssueDetails.assignee,
            labels: selectedIssueDetails.labels,
            components: selectedIssueDetails.components,
          },
        })

        const normalizedResult = normalizeAiResult(payload.result)
        setAiResult(normalizedResult)
        setAiPlanText(buildPlanText(normalizedResult))
        setApprovedPlanText('')
        setPlanApproved(false)

        if (payload.repoSnapshot) {
          const snapshot = payload.repoSnapshot
          setAiSnapshotSummary(
            `Scanned ${snapshot.readableFileCount} readable file(s) from ${snapshot.repo} @ ${snapshot.branch}.`,
          )
        } else {
          setAiSnapshotSummary('')
        }

        if (task === 'implement-changes' && normalizedResult && Array.isArray(normalizedResult.implementationChanges)) {
          const nextChanges = normalizedResult.implementationChanges
            .filter((change) => change.action !== 'delete' && change.path)
            .map((change) => ({ path: change.path, content: change.content }))

          if (nextChanges.length > 0) {
            onImplementationChanges(nextChanges)
            onImplementationEditorUpdate(nextChanges[0].path, nextChanges[0].content)
          }
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'Unknown AI assistant error')
      } finally {
        setAiLoadingTask('')
      }
    },
    [
      aiPrompt,
      availableBranches,
      onImplementationChanges,
      onImplementationEditorUpdate,
      selectedBranch,
      selectedIssueDetails,
      selectedRepo,
    ],
  )

  const runSelectedAiFlow = useCallback(() => {
    if (aiFlowMode === 'edit-plan' && !aiPlanText.trim()) {
      setAiError('Write or generate a plan before asking AI to edit it.')
      return
    }

    if (aiFlowMode === 'implement-plan' && !approvedPlanText.trim()) {
      setAiError('Approve a plan before asking AI to implement it.')
      return
    }

    const modeConfig = getAiModeConfig(aiFlowMode)

    void requestAiAssist({
      task: modeConfig.task,
      userExplanation: aiPrompt.trim() || modeConfig.prompt,
      planDraft: aiFlowMode === 'edit-plan' ? aiPlanText : undefined,
      approvedPlan: aiFlowMode === 'implement-plan' ? approvedPlanText : undefined,
    })
  }, [aiFlowMode, aiPlanText, aiPrompt, approvedPlanText, requestAiAssist])

  const handleReviewPlan = useCallback(() => {
    if (!aiPlanText.trim()) {
      setAiError('Write or generate a plan before reviewing it.')
      return
    }

    void requestAiAssist({
      task: 'review-plan',
      userExplanation: 'Review this plan and improve it for implementation.',
      planDraft: aiPlanText,
    })
  }, [aiPlanText, requestAiAssist])

  const handleApprovePlan = useCallback(() => {
    const trimmedPlan = aiPlanText.trim()

    if (!trimmedPlan) {
      setAiError('Write or generate a plan before approving it.')
      return
    }

    setApprovedPlanText(trimmedPlan)
    setPlanApproved(true)
    setAiError(null)
  }, [aiPlanText])

  const handleImplementChanges = useCallback(() => {
    if (!planApproved || !approvedPlanText.trim()) {
      setAiError('Approve a plan before asking AI to implement changes.')
      return
    }

    void requestAiAssist({
      task: 'implement-changes',
      userExplanation: aiPrompt,
      approvedPlan: approvedPlanText,
    })
  }, [aiPrompt, approvedPlanText, planApproved, requestAiAssist])

  useEffect(() => {
    setAiPlanText(buildPlanText(aiResult))
    setApprovedPlanText('')
    setPlanApproved(false)
  }, [aiResult])

  return {
    aiPrompt,
    setAiPrompt,
    aiLoadingTask,
    aiError,
    setAiError,
    aiResult,
    setAiResult,
    aiPlanText,
    setAiPlanText,
    approvedPlanText,
    setApprovedPlanText,
    planApproved,
    setPlanApproved,
    aiFlowMode,
    setAiFlowMode,
    aiSnapshotSummary,
    setAiSnapshotSummary,
    currentAiMode,
    resetAiState,
    runSelectedAiFlow,
    handleReviewPlan,
    handleApprovePlan,
    handleImplementChanges,
  }
}
