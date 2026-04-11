import type { GithubBranch, GithubPullRequest, GithubRepo, JiraIssue } from '../types'

export function getDefaultBranchName(issueKey: string): string {
  return issueKey.toUpperCase()
}

export function parseRepo(fullName: string): { owner: string; repo: string } | null {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) {
    return null
  }

  return { owner, repo }
}

export function getAvailableRepos(
  githubRepos: GithubRepo[],
  reposChecked: string[],
  githubBranches: GithubBranch[],
  githubPullRequests: GithubPullRequest[],
): GithubRepo[] {
  const linkedRepos = Array.from(
    new Set([
      ...reposChecked,
      ...githubBranches.map((branch) => branch.repo),
      ...githubPullRequests.map((pr) => pr.repo),
    ]),
  )

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

  if (sorted.length === 0 || linkedSet.size === 0) {
    return sorted
  }

  const linkedFirst = sorted.filter((repo) => linkedSet.has(repo.name))
  const remainder = sorted.filter((repo) => !linkedSet.has(repo.name))
  return [...linkedFirst, ...remainder]
}

export function getAutoLinkedBranch(
  githubBranches: GithubBranch[],
  selectedIssue: JiraIssue | null,
): GithubBranch | null {
  if (!selectedIssue) {
    return null
  }

  return (
    githubBranches.find((branch) => branch.name.toLowerCase().includes(selectedIssue.key.toLowerCase())) ||
    githubBranches[0] ||
    null
  )
}
