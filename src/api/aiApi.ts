import { buildApiErrorMessage } from './http'
import type { AiAssistResponse, JiraIssueDetails } from '../types'

const API_BASE = 'http://localhost:3001/api'

type AssistTask =
  | 'auto'
  | 'explain-ticket'
  | 'update-ticket'
  | 'suggest-branches'
  | 'suggest-fix'
  | 'suggest-implementation'
  | 'review-plan'
  | 'implement-changes'

export async function requestAiAssist(payload: {
  task: AssistTask
  userExplanation?: string
  planDraft?: string
  approvedPlan?: string
  repo: string
  branch: string
  existingBranches: string[]
  issue: Pick<
    JiraIssueDetails,
    'key' | 'summary' | 'description' | 'status' | 'type' | 'priority' | 'assignee' | 'labels' | 'components'
  >
}): Promise<AiAssistResponse> {
  const response = await fetch(`${API_BASE}/ai/assist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json()) as AiAssistResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(data.error, data.details, 'AI assistant request failed'))
  }

  if (!data.result) {
    throw new Error('AI assistant did not return a result')
  }

  return data
}
