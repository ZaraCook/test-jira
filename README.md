# Jira + GitHub Context Viewer

This app shows Jira issues and lets you:

- browse real GitHub repositories, branches, and files
- create new GitHub branches from the selected repository
- edit Jira issue summary/description/status and save changes to Jira

## Setup

1. Install dependencies.
2. Copy `.env.example` to `.env`.
3. Fill in Jira and GitHub values.
4. Run the app.

```bash
npm install
npm run dev
```

Frontend runs on Vite, backend API proxy runs on port `3001` by default.

## Required environment variables

- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`
- `GITHUB_TOKEN`

## Optional environment variables

- `JIRA_JQL`
- `JIRA_MAX_RESULTS`
- `GITHUB_REPOS`
- `GITHUB_MAX_REPO_PAGES`
- `GITHUB_MAX_FILES_PER_BRANCH`

## GitHub token permissions

Use a token that can read and create branches in repositories you want to use.

- Fine-grained token: `Contents: Read and Write`, `Metadata: Read`
- Classic token: `repo` scope for private repos (or public-only access for public repos)

## Jira edit capabilities

Ticket updates use Jira REST APIs to:

- update `summary`
- update `description`
- transition status through available Jira transitions
