import { buildApiErrorMessage } from './http'
import type {
  GithubCommitResponse,
  GithubCreateBranchResponse,
  GithubRepoBranchesResponse,
  GithubRepoFileResponse,
  GithubRepoFilesResponse,
  GithubReposResponse,
  StagedFileChange,
} from '../types'

const API_BASE = 'http://localhost:3001/api'

type ParsedRepo = { owner: string; repo: string }

function repoPath(repo: ParsedRepo): string {
  return `${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`
}

export async function loadGithubRepos(): Promise<GithubReposResponse> {
  const response = await fetch(`${API_BASE}/github/repos`, { cache: 'no-store' })
  const payload = (await response.json()) as GithubReposResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(payload.error, payload.details, 'Failed to load GitHub repositories'))
  }

  return payload
}

export async function loadGithubBranches(repo: ParsedRepo): Promise<GithubRepoBranchesResponse> {
  const response = await fetch(`${API_BASE}/github/repos/${repoPath(repo)}/branches`, { cache: 'no-store' })
  const payload = (await response.json()) as GithubRepoBranchesResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(payload.error, payload.details, 'Failed to load branches'))
  }

  return payload
}

export async function loadGithubFiles(repo: ParsedRepo, branch: string): Promise<GithubRepoFilesResponse> {
  const response = await fetch(
    `${API_BASE}/github/repos/${repoPath(repo)}/files?branch=${encodeURIComponent(branch)}`,
    { cache: 'no-store' },
  )
  const payload = (await response.json()) as GithubRepoFilesResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(payload.error, payload.details, 'Failed to load files'))
  }

  return payload
}

export async function loadGithubFileContent(
  repo: ParsedRepo,
  branch: string,
  path: string,
): Promise<GithubRepoFileResponse> {
  const response = await fetch(
    `${API_BASE}/github/repos/${repoPath(repo)}/file?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`,
    { cache: 'no-store' },
  )
  const payload = (await response.json()) as GithubRepoFileResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(payload.error, payload.details, 'Failed to load file content'))
  }

  return payload
}

export async function createGithubBranch(
  repo: ParsedRepo,
  payload: { branchName: string; fromBranch?: string },
): Promise<GithubCreateBranchResponse> {
  const response = await fetch(`${API_BASE}/github/repos/${repoPath(repo)}/branches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json()) as GithubCreateBranchResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(data.error, data.details, 'Failed to create branch'))
  }

  return data
}

export async function createGithubCommit(
  repo: ParsedRepo,
  payload: { branch: string; message: string; changes: StagedFileChange[] },
): Promise<GithubCommitResponse> {
  const response = await fetch(`${API_BASE}/github/repos/${repoPath(repo)}/commits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json()) as GithubCommitResponse

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(data.error, data.details, 'Failed to commit and push changes'))
  }

  return data
}
