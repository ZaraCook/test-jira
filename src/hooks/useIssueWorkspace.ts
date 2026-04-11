import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadIssueDetails, loadIssues, loadIssueTransitions, updateIssue } from '../api/jiraApi'
import type { JiraIssue, JiraIssueDetails, JiraTransition } from '../types'
import { getFormattedFieldEntries } from '../utils/fields'

export function useIssueWorkspace() {
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [searchText, setSearchText] = useState('')

  const [selectedIssue, setSelectedIssue] = useState<JiraIssue | null>(null)
  const [selectedIssueDetails, setSelectedIssueDetails] = useState<JiraIssueDetails | null>(null)
  const [issueDetailsLoading, setIssueDetailsLoading] = useState(false)
  const [issueDetailsError, setIssueDetailsError] = useState<string | null>(null)

  const [fieldSearch, setFieldSearch] = useState('')
  const [ticketDraftSummary, setTicketDraftSummary] = useState('')
  const [ticketDraftDescription, setTicketDraftDescription] = useState('')
  const [isEditingTicket, setIsEditingTicket] = useState(false)
  const [ticketTransitions, setTicketTransitions] = useState<JiraTransition[]>([])
  const [selectedTransitionId, setSelectedTransitionId] = useState('')
  const [savingTicket, setSavingTicket] = useState(false)
  const [ticketSaveError, setTicketSaveError] = useState<string | null>(null)
  const [ticketSaveSuccess, setTicketSaveSuccess] = useState<string | null>(null)

  const assigneeOptions = useMemo(
    () => Array.from(new Set(issues.map((issue) => issue.assignee))).sort((a, b) => a.localeCompare(b)),
    [issues],
  )

  const filteredIssues = useMemo(() => {
    const assigneeFiltered =
      assigneeFilter === 'all' ? issues : issues.filter((issue) => issue.assignee === assigneeFilter)

    const normalizedSearch = searchText.trim().toLowerCase()

    if (!normalizedSearch) {
      return assigneeFiltered
    }

    return assigneeFiltered.filter((issue) => {
      return (
        issue.key.toLowerCase().includes(normalizedSearch) ||
        issue.summary.toLowerCase().includes(normalizedSearch) ||
        issue.status.toLowerCase().includes(normalizedSearch) ||
        issue.assignee.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [issues, assigneeFilter, searchText])

  const formattedFieldEntries = useMemo(() => {
    return getFormattedFieldEntries(selectedIssueDetails, fieldSearch)
  }, [selectedIssueDetails, fieldSearch])

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const payload = await loadIssues()
      setIssues(payload.issues)
      setTotal(payload.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchIssueDetails = useCallback(async (issueKey: string) => {
    try {
      setIssueDetailsLoading(true)
      setIssueDetailsError(null)
      setSelectedIssueDetails(null)
      const payload = await loadIssueDetails(issueKey)
      setSelectedIssueDetails(payload.issue)
    } catch (err) {
      setIssueDetailsError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIssueDetailsLoading(false)
    }
  }, [])

  const fetchIssueTransitions = useCallback(async (issueKey: string) => {
    try {
      setTicketTransitions([])
      const payload = await loadIssueTransitions(issueKey)
      setTicketTransitions(payload.transitions || [])
    } catch {
      setTicketTransitions([])
    }
  }, [])

  const saveTicket = useCallback(
    async (options: { refreshIssueLinks: (issue: JiraIssue) => Promise<void> }) => {
      if (!selectedIssue || !isEditingTicket) {
        return
      }

      try {
        setSavingTicket(true)
        setTicketSaveError(null)
        setTicketSaveSuccess(null)

        await updateIssue(selectedIssue.key, {
          summary: ticketDraftSummary,
          description: ticketDraftDescription,
          transitionId: selectedTransitionId || undefined,
        })

        setSelectedTransitionId('')
        setIsEditingTicket(false)
        setTicketSaveSuccess('Ticket updated successfully in Jira.')

        await Promise.all([
          fetchIssueDetails(selectedIssue.key),
          fetchIssues(),
          options.refreshIssueLinks(selectedIssue),
          fetchIssueTransitions(selectedIssue.key),
        ])
      } catch (err) {
        setTicketSaveError(err instanceof Error ? err.message : 'Unknown error while saving ticket')
      } finally {
        setSavingTicket(false)
      }
    },
    [
      fetchIssueDetails,
      fetchIssueTransitions,
      fetchIssues,
      isEditingTicket,
      selectedIssue,
      selectedTransitionId,
      ticketDraftDescription,
      ticketDraftSummary,
    ],
  )

  const handleStartEditTicket = useCallback(() => {
    setTicketSaveError(null)
    setTicketSaveSuccess(null)
    setIsEditingTicket(true)
  }, [])

  const handleCancelEditTicket = useCallback(() => {
    if (selectedIssueDetails) {
      setTicketDraftSummary(selectedIssueDetails.summary || '')
      setTicketDraftDescription(selectedIssueDetails.description || '')
    }

    setSelectedTransitionId('')
    setTicketSaveError(null)
    setTicketSaveSuccess(null)
    setIsEditingTicket(false)
  }, [selectedIssueDetails])

  const resetIssueWorkspace = useCallback(() => {
    setSelectedIssue(null)
    setSelectedIssueDetails(null)
    setIssueDetailsError(null)
    setIssueDetailsLoading(false)
    setFieldSearch('')
    setTicketDraftSummary('')
    setTicketDraftDescription('')
    setIsEditingTicket(false)
    setTicketTransitions([])
    setSelectedTransitionId('')
    setTicketSaveError(null)
    setTicketSaveSuccess(null)
  }, [])

  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

  useEffect(() => {
    if (!selectedIssueDetails) {
      return
    }

    setTicketDraftSummary(selectedIssueDetails.summary || '')
    setTicketDraftDescription(selectedIssueDetails.description || '')
    setIsEditingTicket(false)
  }, [selectedIssueDetails])

  return {
    issues,
    total,
    loading,
    error,
    assigneeFilter,
    setAssigneeFilter,
    searchText,
    setSearchText,
    assigneeOptions,
    filteredIssues,
    selectedIssue,
    setSelectedIssue,
    selectedIssueDetails,
    issueDetailsLoading,
    issueDetailsError,
    fieldSearch,
    setFieldSearch,
    formattedFieldEntries,
    ticketDraftSummary,
    setTicketDraftSummary,
    ticketDraftDescription,
    setTicketDraftDescription,
    isEditingTicket,
    ticketTransitions,
    selectedTransitionId,
    setSelectedTransitionId,
    savingTicket,
    ticketSaveError,
    setTicketSaveError,
    ticketSaveSuccess,
    setTicketSaveSuccess,
    fetchIssues,
    fetchIssueDetails,
    fetchIssueTransitions,
    saveTicket,
    handleStartEditTicket,
    handleCancelEditTicket,
    resetIssueWorkspace,
  }
}
