import type { AiAssistResult, AiFlowMode } from '../types'

export type AiModeConfig = {
  label: string
  task: 'explain-ticket' | 'suggest-implementation' | 'suggest-fix' | 'review-plan' | 'implement-changes'
  prompt: string
}

export function getAiModeConfig(mode: AiFlowMode): AiModeConfig {
  switch (mode) {
    case 'explain-ticket':
      return {
        label: 'Explain ticket',
        task: 'explain-ticket',
        prompt: 'Explain this Jira ticket in plain English.',
      }
    case 'read-repo':
      return {
        label: 'Read repo',
        task: 'suggest-implementation',
        prompt: 'Read the repository structure and branch files, then suggest how to implement this ticket.',
      }
    case 'suggest-plan':
      return {
        label: 'Suggest plan',
        task: 'suggest-fix',
        prompt: 'Suggest a step-by-step plan to implement this ticket.',
      }
    case 'edit-plan':
      return {
        label: 'Edit plan',
        task: 'review-plan',
        prompt: 'Review this draft implementation plan and improve it before approval.',
      }
    case 'implement-plan':
      return {
        label: 'Implement plan',
        task: 'implement-changes',
        prompt: 'Implement the approved plan using the repository contents.',
      }
  }
}

export function buildPlanText(result: AiAssistResult | null): string {
  if (!result) {
    return ''
  }

  const sourceSteps = Array.isArray(result.planSteps) && result.planSteps.length > 0 ? result.planSteps : result.fixPlan

  if (sourceSteps.length > 0) {
    return sourceSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')
  }

  return result.planSummary || result.ticketExplanation || ''
}

export function normalizeAiResult(result: AiAssistResult | null): AiAssistResult | null {
  if (!result) {
    return null
  }

  return {
    ticketExplanation: result.ticketExplanation || '',
    updatedSummary: result.updatedSummary || '',
    updatedDescription: result.updatedDescription || '',
    ticketUpdateReasoning: result.ticketUpdateReasoning || '',
    branchSuggestions: Array.isArray(result.branchSuggestions) ? result.branchSuggestions : [],
    fixPlan: Array.isArray(result.fixPlan) ? result.fixPlan : [],
    planSteps: Array.isArray(result.planSteps) ? result.planSteps : [],
    planSummary: result.planSummary || '',
    reviewNotes: result.reviewNotes || '',
    implementationSummary: result.implementationSummary || '',
    implementationChanges: Array.isArray(result.implementationChanges) ? result.implementationChanges : [],
  }
}
