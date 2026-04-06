import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config()

const app = express()
const port = process.env.PORT || 3001

app.use(cors())

function buildBoundedJql(rawJql) {
  const fallback = 'assignee = currentUser() ORDER BY updated DESC'

  if (!rawJql || !rawJql.trim()) {
    return fallback
  }

  const jql = rawJql.trim()
  const hasRestriction =
    /\bassignee\b|\breporter\b|\bcreator\b|\bstatus\b|\bupdated\b|\bcreated\b|\bissuekey\b|\bfilter\b|\bsprint\b|\bproject\s*=|\bproject\s+in\b/i.test(
      jql,
    )

  if (hasRestriction) {
    return jql
  }

  // Jira rejects unbounded queries on this API; scope to the current user.
  return fallback
}

app.get('/api/issues', async (_req, res) => {
  console.log('Received request for /api/issues')

  const baseUrl = process.env.JIRA_BASE_URL
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN
  const jql = buildBoundedJql(process.env.JIRA_JQL)

  if (!baseUrl || !email || !token) {
    return res.status(500).json({
      error:
        'Missing Jira env vars. Required: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN',
    })
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  const url = new URL(`${cleanBaseUrl}/rest/api/3/search/jql`)
  url.searchParams.set('jql', jql)
  url.searchParams.set('maxResults', process.env.JIRA_MAX_RESULTS || '1000')
  url.searchParams.set(
    'fields',
    'summary,status,issuetype,priority,assignee,updated',
  )

  console.log('Calling Jira URL:', url.toString())

  const auth = Buffer.from(`${email}:${token}`).toString('base64')

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
    })

    const responseText = await response.text()

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Jira request failed: ${response.status} ${response.statusText}`,
        details: responseText,
      })
    }

    const data = JSON.parse(responseText)

    const issues = (data.issues || []).map((issue) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields?.summary || 'No summary',
      status: issue.fields?.status?.name || 'Unknown',
      type: issue.fields?.issuetype?.name || 'Unknown',
      priority: issue.fields?.priority?.name || 'None',
      assignee: issue.fields?.assignee?.displayName || 'Unassigned',
      updated: issue.fields?.updated || null,
      url: `${cleanBaseUrl}/browse/${issue.key}`,
    }))

    return res.json({
      total: data.total || issues.length,
      issues,
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error while calling Jira',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.listen(port, () => {
  console.log(`Jira API proxy running on http://localhost:${port}`)
})