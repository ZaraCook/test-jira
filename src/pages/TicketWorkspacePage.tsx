import type { ReactNode } from 'react'
import type { FormattedFieldEntry, GithubBranch, JiraIssue, JiraIssueDetails, JiraTransition } from '../types'

export type TicketWorkspacePageProps = {
  selectedIssue: JiraIssue
  selectedIssueDetails: JiraIssueDetails | null
  issueDetailsLoading: boolean
  issueDetailsError: string | null
  linksLoading: boolean
  linksError: string | null
  githubBranches: GithubBranch[]
  fieldSearch: string
  formattedFieldEntries: FormattedFieldEntry[]
  ticketDraftSummary: string
  ticketDraftDescription: string
  isEditingTicket: boolean
  savingTicket: boolean
  ticketTransitions: JiraTransition[]
  selectedTransitionId: string
  ticketSaveError: string | null
  ticketSaveSuccess: string | null
  githubPanel: ReactNode
  onBackToIssues: () => void
  onStartEditTicket: () => void
  onSummaryChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onTransitionChange: (value: string) => void
  onSaveTicket: () => void
  onCancelEditTicket: () => void
  onFieldSearchChange: (value: string) => void
}

export function TicketWorkspacePage({
  selectedIssue,
  selectedIssueDetails,
  issueDetailsLoading,
  issueDetailsError,
  linksLoading,
  linksError,
  githubBranches,
  fieldSearch,
  formattedFieldEntries,
  ticketDraftSummary,
  ticketDraftDescription,
  isEditingTicket,
  savingTicket,
  ticketTransitions,
  selectedTransitionId,
  ticketSaveError,
  ticketSaveSuccess,
  githubPanel,
  onBackToIssues,
  onStartEditTicket,
  onSummaryChange,
  onDescriptionChange,
  onTransitionChange,
  onSaveTicket,
  onCancelEditTicket,
  onFieldSearchChange,
}: TicketWorkspacePageProps) {
  return (
    <section className="details-workspace full-workspace-view">
      <div className="workspace-header">
        <div>
          <div className="workspace-issue-key">{selectedIssue.key}</div>
          <h2>{selectedIssue.summary}</h2>
        </div>
        <div className="workspace-actions">
          <button type="button" className="close-btn" onClick={onBackToIssues}>
            Back to issues
          </button>
          <a href={selectedIssue.url} target="_blank" rel="noreferrer" className="secondary-link">
            Open in Jira
          </a>
        </div>
      </div>

      {issueDetailsLoading && <p className="empty-state">Loading full issue details...</p>}

      {issueDetailsError && (
        <div className="error-box">
          <p>Could not load issue details.</p>
          <p>{issueDetailsError}</p>
        </div>
      )}

      {!issueDetailsLoading && !issueDetailsError && selectedIssueDetails && (
        <div className="workspace-split">
          <section className="ticket-side">
            <div className="panel-section">
              <div className="section-title-row">
                <h3>Edit ticket</h3>
                {!isEditingTicket && (
                  <button type="button" className="refresh-btn" onClick={onStartEditTicket}>
                    Edit ticket
                  </button>
                )}
              </div>
              <div className="github-controls">
                <label>
                  Summary
                  <input
                    type="text"
                    className="search-input"
                    value={ticketDraftSummary}
                    onChange={(event) => onSummaryChange(event.target.value)}
                    disabled={!isEditingTicket || savingTicket}
                  />
                </label>

                <label>
                  Description
                  <textarea
                    className="ticket-textarea"
                    value={ticketDraftDescription}
                    onChange={(event) => onDescriptionChange(event.target.value)}
                    disabled={!isEditingTicket || savingTicket}
                    rows={7}
                  />
                </label>
              </div>

              {isEditingTicket && (
                <div className="workspace-actions">
                  <button type="button" className="refresh-btn" onClick={onSaveTicket} disabled={savingTicket}>
                    {savingTicket ? 'Saving...' : 'Save to Jira'}
                  </button>
                  <button type="button" className="close-btn" onClick={onCancelEditTicket} disabled={savingTicket}>
                    Cancel
                  </button>
                </div>
              )}

              {ticketSaveError && <p className="error-inline">{ticketSaveError}</p>}
              {ticketSaveSuccess && <p className="success-inline">{ticketSaveSuccess}</p>}
            </div>

            <div className="panel-section">
              <h3>Ticket details</h3>
              <div className="jira-property-shell">
                <div className="jira-property-row">
                  <span className="detail-label">Status</span>
                  {isEditingTicket ? (
                    <select
                      value={selectedTransitionId}
                      onChange={(event) => onTransitionChange(event.target.value)}
                      disabled={savingTicket || ticketTransitions.length === 0}
                    >
                      <option value="">Keep current ({selectedIssueDetails.status})</option>
                      {ticketTransitions.map((transition) => (
                        <option key={transition.id} value={transition.id}>
                          {transition.toStatus || transition.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`status-pill status-${selectedIssueDetails.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {selectedIssueDetails.status}
                    </span>
                  )}
                </div>
                <div className="jira-property-row">
                  <span className="detail-label">Type</span>
                  <span className="detail-value">{selectedIssueDetails.type}</span>
                </div>
                <div className="jira-property-row">
                  <span className="detail-label">Priority</span>
                  <span className="detail-value">{selectedIssueDetails.priority}</span>
                </div>
                <div className="jira-property-row">
                  <span className="detail-label">Assignee</span>
                  <span className="detail-value">{selectedIssueDetails.assignee}</span>
                </div>
                <div className="jira-property-row">
                  <span className="detail-label">Reporter</span>
                  <span className="detail-value">{selectedIssueDetails.reporter}</span>
                </div>
                <div className="jira-property-row">
                  <span className="detail-label">Creator</span>
                  <span className="detail-value">{selectedIssueDetails.creator}</span>
                </div>
                <div className="jira-property-row">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">
                    {selectedIssueDetails.created ? new Date(selectedIssueDetails.created).toLocaleString() : 'Unknown'}
                  </span>
                </div>
                <div className="jira-property-row">
                  <span className="detail-label">Updated</span>
                  <span className="detail-value">
                    {selectedIssueDetails.updated ? new Date(selectedIssueDetails.updated).toLocaleString() : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel-section">
              <h3>Description</h3>
              <pre className="issue-description">{selectedIssueDetails.description || 'No description provided.'}</pre>
            </div>

            <div className="panel-section">
              <h3>Context</h3>
              <div className="tag-row">
                <span className="tag-chip">Labels: {selectedIssueDetails.labels.length || 0}</span>
                <span className="tag-chip">Components: {selectedIssueDetails.components.length || 0}</span>
                <span className="tag-chip">Fix versions: {selectedIssueDetails.fixVersions.length || 0}</span>
              </div>

              {selectedIssueDetails.labels.length > 0 && (
                <div className="tag-row">
                  {selectedIssueDetails.labels.map((label) => (
                    <span key={label} className="tag-pill">
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {selectedIssueDetails.components.length > 0 && (
                <div className="tag-row">
                  {selectedIssueDetails.components.map((component) => (
                    <span key={component} className="tag-pill tag-pill-accent">
                      {component}
                    </span>
                  ))}
                </div>
              )}

              {selectedIssueDetails.fixVersions.length > 0 && (
                <div className="tag-row">
                  {selectedIssueDetails.fixVersions.map((version) => (
                    <span key={version} className="tag-pill tag-pill-muted">
                      {version}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-section">
              <h3>Linked branches</h3>
              {linksLoading ? (
                <p className="empty-state">Loading linked GitHub info...</p>
              ) : linksError ? (
                <div className="error-box">
                  <p>Could not load linked GitHub info.</p>
                  <p>{linksError}</p>
                </div>
              ) : githubBranches.length === 0 ? (
                <p className="empty-state">No matching branches found.</p>
              ) : (
                <ul className="detail-list">
                  {githubBranches.map((branch) => (
                    <li key={`${branch.repo}-${branch.name}`} className="detail-card">
                      <a href={branch.url} target="_blank" rel="noreferrer">
                        {branch.name}
                      </a>
                      <div className="detail-subtext">{branch.repo}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel-section">
              <h3>All Jira fields</h3>
              <div className="field-toolbar">
                <input
                  type="text"
                  className="search-input field-search"
                  placeholder="Search fields or values"
                  value={fieldSearch}
                  onChange={(event) => onFieldSearchChange(event.target.value)}
                />
                <span className="field-count">{formattedFieldEntries.length} fields</span>
              </div>

              {formattedFieldEntries.length === 0 ? (
                <p className="empty-state">No fields match your search.</p>
              ) : (
                <div className="field-accordion-list">
                  {formattedFieldEntries.map((entry) => (
                    <details key={entry.key} className="field-accordion-item">
                      <summary>
                        <span className="field-key">{entry.label}</span>
                        <span className="field-meta">{entry.key} · {entry.fieldType}</span>
                        <span className="field-preview">{entry.preview || 'No value'}</span>
                      </summary>
                      <pre className="field-value-viewer">
                        <code>{entry.valueText}</code>
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </section>

          {githubPanel}
        </div>
      )}
    </section>
  )
}
