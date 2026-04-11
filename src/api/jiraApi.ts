import { buildApiErrorMessage } from './http'
import type {
  IssueDetailsResponse,
  IssueLinksResponse,
  IssuesResponse,
  JiraIssue,
  JiraIssueUpdateResponse,
  JiraTransitionsResponse,
} from '../types'

const API_BASE = 'http://localhost:3001/api'

export async function loadIssues(): Promise<IssuesResponse> {
  const response = await fetch(`${API_BASE}/issues`, { cache: 'no-store' })
  const payload = (await response.json()) as IssuesResponse & { error?: string; details?: string }

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(payload.error, payload.details, 'Failed to load Jira issues'))
  }

  return payload
}

export async function loadIssueDetails(issueKey: string): Promise<IssueDetailsResponse> {
  const response = await fetch(`${API_BASE}/issues/${encodeURIComponent(issueKey)}`, { cache: 'no-store' })
  const payload = (await response.json()) as IssueDetailsResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(payload.error, payload.details, 'Failed to load issue details'))
  }

  return payload
}

export async function loadIssueTransitions(issueKey: string): Promise<JiraTransitionsResponse> {
  const response = await fetch(`${API_BASE}/issues/${encodeURIComponent(issueKey)}/transitions`, {
    cache: 'no-store',
  })
  const payload = (await response.json()) as JiraTransitionsResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(payload.error, payload.details, 'Failed to load Jira transitions'))
  }

  return payload
}

export async function loadIssueLinks(issue: JiraIssue): Promise<IssueLinksResponse> {
  const response = await fetch(`${API_BASE}/issues/${encodeURIComponent(issue.key)}/links`, {
    cache: 'no-store',
  })
  const payload = (await response.json()) as IssueLinksResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(payload.error, payload.details, 'Failed to load GitHub links'))
  }

  return payload
}

export async function updateIssue(
  issueKey: string,
  payload: { summary: string; description: string; transitionId?: string },
): Promise<JiraIssueUpdateResponse> {
  const response = await fetch(`${API_BASE}/issues/${encodeURIComponent(issueKey)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json()) as JiraIssueUpdateResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(data.error, data.details, 'Failed to save Jira issue'))
  }

  return data
}
