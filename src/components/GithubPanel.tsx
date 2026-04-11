import { CodeEditor } from '../CodeEditor'
import { ErrorBoundary } from '../ErrorBoundary'
import type {
  AiAssistResult,
  AiFlowMode,
  FileMode,
  GithubBranch,
  GithubBranchOption,
  GithubFileOption,
  GithubPullRequest,
  GithubRepo,
  JiraIssue,
  StagedFileChange,
} from '../types'

export type GithubPanelProps = {
  githubConnected: boolean
  loadingGithubRepos: boolean
  onConnectGithub: () => void
  selectedRepo: string
  onSelectedRepoChange: (value: string) => void
  availableRepos: GithubRepo[]
  selectedBranch: string
  onSelectedBranchChange: (value: string) => void
  loadingGithubBranches: boolean
  availableBranches: GithubBranchOption[]
  aiPrompt: string
  onAiPromptChange: (value: string) => void
  aiLoadingTask: string
  aiFlowMode: AiFlowMode
  onAiFlowModeChange: (mode: AiFlowMode) => void
  runSelectedAiFlow: () => void
  currentAiModeLabel: string
  aiSnapshotSummary: string
  planApproved: boolean
  aiPlanText: string
  onAiPlanTextChange: (value: string) => void
  handleReviewPlan: () => void
  handleApprovePlan: () => void
  aiResult: AiAssistResult | null
  approvedPlanText: string
  handleImplementChanges: () => void
  onSetBranchDraftName: (value: string) => void
  applyAiTicketDraft: () => void
  aiError: string | null
  selectedIssue: JiraIssue | null
  getDefaultBranchName: (issueKey: string) => string
  branchDraftName: string
  creatingBranch: boolean
  onBranchDraftNameChange: (value: string) => void
  handleCreateBranch: () => void
  branchCreateError: string | null
  branchCreateSuccess: string | null
  fileMode: FileMode
  onFileModeChange: (value: FileMode) => void
  selectedFile: string
  onSelectedFileChange: (value: string) => void
  editorFilePath: string
  onEditorFilePathChange: (value: string) => void
  selectedFileContent: string
  editorFileContent: string
  onEditorFileContentChange: (value: string) => void
  isCommitting: boolean
  loadingGithubFiles: boolean
  availableFiles: GithubFileOption[]
  handleStageFileChange: () => void
  stagedChanges: StagedFileChange[]
  handleUnstageFileChange: (path: string) => void
  commitMessage: string
  onCommitMessageChange: (value: string) => void
  handleCommitAndPush: () => void
  commitError: string | null
  commitSuccess: string | null
  githubApiError: string | null
  selectedFileUrl: string
  autoLinkedBranch: GithubBranch | null
  githubPullRequests: GithubPullRequest[]
  reposChecked: string[]
}

export function GithubPanel({
  githubConnected,
  loadingGithubRepos,
  onConnectGithub,
  selectedRepo,
  onSelectedRepoChange,
  availableRepos,
  selectedBranch,
  onSelectedBranchChange,
  loadingGithubBranches,
  availableBranches,
  aiPrompt,
  onAiPromptChange,
  aiLoadingTask,
  aiFlowMode,
  onAiFlowModeChange,
  runSelectedAiFlow,
  currentAiModeLabel,
  aiSnapshotSummary,
  planApproved,
  aiPlanText,
  onAiPlanTextChange,
  handleReviewPlan,
  handleApprovePlan,
  aiResult,
  approvedPlanText,
  handleImplementChanges,
  onSetBranchDraftName,
  applyAiTicketDraft,
  aiError,
  selectedIssue,
  getDefaultBranchName,
  branchDraftName,
  creatingBranch,
  onBranchDraftNameChange,
  handleCreateBranch,
  branchCreateError,
  branchCreateSuccess,
  fileMode,
  onFileModeChange,
  selectedFile,
  onSelectedFileChange,
  editorFilePath,
  onEditorFilePathChange,
  selectedFileContent,
  editorFileContent,
  onEditorFileContentChange,
  isCommitting,
  loadingGithubFiles,
  availableFiles,
  handleStageFileChange,
  stagedChanges,
  handleUnstageFileChange,
  commitMessage,
  onCommitMessageChange,
  handleCommitAndPush,
  commitError,
  commitSuccess,
  githubApiError,
  selectedFileUrl,
  autoLinkedBranch,
  githubPullRequests,
  reposChecked,
}: GithubPanelProps) {
  const onModeSelect = (mode: AiFlowMode, prompt: string) => {
    onAiFlowModeChange(mode)
    onAiPromptChange(prompt)
  }

  const selectCapability = (mode: AiFlowMode, prompt: string) => {
    onModeSelect(mode, prompt)
  }

  return (
    <section className="github-side">
      <div className="panel-section">
        <div className="section-title-row">
          <h3>1. Connect repository</h3>
          <button
            type="button"
            className={`connect-btn ${githubConnected ? 'connect-btn-connected' : ''}`}
            onClick={onConnectGithub}
            disabled={loadingGithubRepos}
          >
            {loadingGithubRepos ? 'Connecting...' : githubConnected ? 'Disconnect GitHub' : 'Connect GitHub'}
          </button>
        </div>
        <p className="field-meta">Choose the repository and working branch for this ticket.</p>

        <div className="github-controls">
          <label>
            Repository
            <select value={selectedRepo} onChange={(event) => onSelectedRepoChange(event.target.value)} disabled={!githubConnected}>
              <option value="">Select repo</option>
              {availableRepos.map((repo) => (
                <option key={repo.name} value={repo.name}>
                  {repo.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Branch
            <select
              value={selectedBranch}
              onChange={(event) => onSelectedBranchChange(event.target.value)}
              disabled={!githubConnected || !selectedRepo || loadingGithubBranches}
            >
              <option value="">Select branch</option>
              {availableBranches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="panel-section ai-workspace-section">
        <div className="section-title-row">
          <h3>2. Plan with AI</h3>
          <span className="field-meta">Uses the selected repo and branch</span>
        </div>

        <div className="ai-capability-grid">
          <button
            type="button"
            className="ai-capability-card"
            onClick={() =>
              selectCapability(
                'explain-ticket',
                'Explain this ticket clearly for both developers and project managers, including risks, assumptions, and expected outcome.',
              )
            }
          >
            <span className="ai-capability-title">Explain ticket</span>
            <span className="ai-capability-desc">Break down scope, business context, and technical intent.</span>
          </button>

          <button
            type="button"
            className="ai-capability-card"
            onClick={() =>
              selectCapability(
                'read-repo',
                'Read this repository and tell me exactly where to start: which files to inspect first, what to change, and why.',
              )
            }
          >
            <span className="ai-capability-title">Read repo and locate files</span>
            <span className="ai-capability-desc">Identify entry points, target files, and implementation order.</span>
          </button>

          <button
            type="button"
            className="ai-capability-card"
            onClick={() =>
              selectCapability(
                'suggest-plan',
                'Suggest a full implementation plan, including branch naming, files to create/update, and validation steps.',
              )
            }
          >
            <span className="ai-capability-title">Suggest implementation plan</span>
            <span className="ai-capability-desc">Generate a practical step-by-step plan with file-level guidance.</span>
          </button>

          <button
            type="button"
            className="ai-capability-card"
            onClick={() =>
              selectCapability(
                'implement-plan',
                'Implement the approved plan. Create new files when needed, update existing files, and prepare staged changes.',
              )
            }
          >
            <span className="ai-capability-title">Implement and prepare changes</span>
            <span className="ai-capability-desc">Generate concrete file changes ready to stage, commit, and push.</span>
          </button>
        </div>

        <div className="github-controls">
          <label>
            AI instruction
            <textarea
              className="ticket-textarea"
              rows={4}
              placeholder="Example: Read the repo and tell me which files to start in, then suggest an implementation approach."
              value={aiPrompt}
              onChange={(event) => onAiPromptChange(event.target.value)}
              disabled={!!aiLoadingTask || !githubConnected || !selectedRepo || !selectedBranch}
            />
          </label>
        </div>

        <div className="ai-mode-row">
          <button
            type="button"
            className={`ai-mode-pill ${aiFlowMode === 'explain-ticket' ? 'ai-mode-pill-active' : ''}`}
            onClick={() => onModeSelect('explain-ticket', 'Explain this Jira ticket in plain English.')}
          >
            Explain
          </button>

          <button
            type="button"
            className={`ai-mode-pill ${aiFlowMode === 'read-repo' ? 'ai-mode-pill-active' : ''}`}
            onClick={() => onModeSelect('read-repo', 'Read the repository structure and branch files, then suggest how to implement this ticket.')}
          >
            Read repo
          </button>

          <button
            type="button"
            className={`ai-mode-pill ${aiFlowMode === 'suggest-plan' ? 'ai-mode-pill-active' : ''}`}
            onClick={() => onModeSelect('suggest-plan', 'Suggest a step-by-step plan to implement this ticket.')}
          >
            Plan
          </button>

          <button
            type="button"
            className={`ai-mode-pill ${aiFlowMode === 'edit-plan' ? 'ai-mode-pill-active' : ''}`}
            onClick={() => onModeSelect('edit-plan', 'Review this draft implementation plan and improve it before approval.')}
          >
            Review plan
          </button>

          <button
            type="button"
            className={`ai-mode-pill ${aiFlowMode === 'implement-plan' ? 'ai-mode-pill-active' : ''}`}
            onClick={() => onModeSelect('implement-plan', 'Implement the approved plan using the repository contents.')}
          >
            Implement
          </button>
        </div>

        <div className="workspace-actions ai-actions-inline">
          <button
            type="button"
            className="refresh-btn"
            onClick={runSelectedAiFlow}
            disabled={!!aiLoadingTask || !githubConnected || !selectedRepo || !selectedBranch}
          >
            {aiLoadingTask ? 'Thinking...' : 'Run selected AI mode'}
          </button>

          <span className="field-meta ai-current-mode">Current mode: {currentAiModeLabel}</span>
        </div>

        {aiSnapshotSummary && <p className="field-meta">{aiSnapshotSummary}</p>}

          {aiFlowMode === 'edit-plan' && (
            <div className="plan-review-card">
              <div className="section-title-row">
                <h4>Plan review</h4>
                <span className="field-meta">{planApproved ? 'Approved' : 'Draft'}</span>
              </div>

              <label>
                Editable plan
                <textarea
                  className="ticket-textarea plan-textarea"
                  rows={8}
                  placeholder="Generate a plan, review it, then edit it here before approving it."
                  value={aiPlanText}
                  onChange={(event) => onAiPlanTextChange(event.target.value)}
                  disabled={!!aiLoadingTask || !githubConnected || !selectedRepo || !selectedBranch}
                />
              </label>

              <div className="workspace-actions ai-actions-stack">
                <button
                  type="button"
                  className="refresh-btn"
                  onClick={handleReviewPlan}
                  disabled={!!aiLoadingTask || !githubConnected || !selectedRepo || !selectedBranch || !aiPlanText.trim()}
                >
                  {aiLoadingTask === 'review-plan' ? 'Reviewing...' : 'Review plan'}
                </button>

                <button
                  type="button"
                  className="refresh-btn"
                  onClick={handleApprovePlan}
                  disabled={!!aiLoadingTask || !githubConnected || !selectedRepo || !selectedBranch || !aiPlanText.trim()}
                >
                  {planApproved ? 'Plan approved' : 'Approve plan'}
                </button>
              </div>

              {approvedPlanText && <p className="field-meta">Approved plan ready for implementation.</p>}
              {aiResult?.planSummary && <p className="field-meta">{aiResult.planSummary}</p>}
              {aiResult?.reviewNotes && <p className="field-meta">{aiResult.reviewNotes}</p>}
            </div>
          )}

          {aiFlowMode === 'implement-plan' && (
            <div className="plan-review-card">
              <div className="section-title-row">
                <h4>Implement plan</h4>
                <span className="field-meta">Uses approved plan text</span>
              </div>
              <p className="field-meta">
                {approvedPlanText.trim()
                  ? 'Approved plan ready. Click Ask AI to generate implementation changes.'
                  : 'Approve a plan in Edit plan before implementing changes.'}
              </p>
              <div className="workspace-actions ai-actions-stack">
                <button
                  type="button"
                  className="refresh-btn"
                  onClick={handleImplementChanges}
                  disabled={
                    !!aiLoadingTask ||
                    !githubConnected ||
                    !selectedRepo ||
                    !selectedBranch ||
                    !approvedPlanText.trim()
                  }
                >
                  {aiLoadingTask === 'implement-changes' ? 'Implementing...' : 'Implement changes with AI'}
                </button>
              </div>
            </div>
          )}

        <div className="ai-helper-row">
          <button
            type="button"
            className="ai-helper-chip"
            onClick={() => onAiPromptChange('Explain this ticket in plain English for both engineers and project managers.')}
          >
            Explain for team
          </button>
          <button
            type="button"
            className="ai-helper-chip"
            onClick={() => onAiPromptChange('Read the repo and tell me exactly which files to look at first and where to start implementation.')}
          >
            Find start files
          </button>
          <button
            type="button"
            className="ai-helper-chip"
            onClick={() => onAiPromptChange('Suggest branch names and a clean implementation sequence for this ticket.')}
          >
            Branch + plan
          </button>
          <button
            type="button"
            className="ai-helper-chip"
            onClick={() => onAiPromptChange('Generate implementation changes, including creating files if needed, and prepare everything to stage.')}
          >
            Generate full fix
          </button>
        </div>

          <div className="workspace-actions ai-actions-stack">
            {Array.isArray(aiResult?.branchSuggestions) && aiResult.branchSuggestions.length > 0 && (
              <div className="ai-suggestion-box">
                <div className="detail-subtext">Branch suggestions</div>
                <div className="ai-suggestion-list">
                  {aiResult.branchSuggestions.map((branchName) => (
                    <button
                      key={branchName}
                      type="button"
                      className="ai-suggestion-pill"
                      onClick={() => onSetBranchDraftName(branchName)}
                    >
                      {branchName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(aiResult?.updatedSummary || aiResult?.updatedDescription) && (
              <button type="button" className="refresh-btn" onClick={applyAiTicketDraft}>
                Use AI ticket draft
              </button>
            )}
          </div>

          {aiError && <p className="error-inline">{aiError}</p>}

          {aiResult?.ticketExplanation && (
            <div className="field-accordion-list">
              <details className="field-accordion-item" open>
                <summary>
                  <span className="field-key">Ticket explanation</span>
                  <span className="field-meta">AI generated</span>
                </summary>
                <pre className="field-value-viewer">
                  <code>{aiResult.ticketExplanation}</code>
                </pre>
              </details>
            </div>
          )}

          {aiResult?.ticketUpdateReasoning && <p className="field-meta">{aiResult.ticketUpdateReasoning}</p>}

          {aiFlowMode === 'edit-plan' && Array.isArray(aiResult?.planSteps) && aiResult.planSteps.length > 0 && (
            <div className="field-accordion-list">
              <details className="field-accordion-item" open>
                <summary>
                  <span className="field-key">Suggested fix plan</span>
                  <span className="field-meta">AI generated</span>
                </summary>
                <ul className="detail-list">
                  {aiResult.planSteps.map((step) => (
                    <li key={step} className="detail-card">
                      {step}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          {aiFlowMode === 'implement-plan' && aiResult?.implementationSummary && <p className="field-meta">{aiResult.implementationSummary}</p>}

          {aiFlowMode === 'implement-plan' && Array.isArray(aiResult?.implementationChanges) && aiResult.implementationChanges.length > 0 && (
            <div className="field-accordion-list">
              <details className="field-accordion-item" open>
                <summary>
                  <span className="field-key">AI implementation changes</span>
                  <span className="field-meta">Ready to stage</span>
                </summary>
                <ul className="detail-list">
                  {aiResult.implementationChanges.map((change) => (
                    <li key={`${change.action}-${change.path}`} className="detail-card">
                      <div className="detail-subtext">
                        {change.action.toUpperCase()} · {change.path}
                      </div>
                      {change.reason && <div className="field-meta">{change.reason}</div>}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
      </div>

      <div className="panel-section branch-create-section">
          <h3>3. Create branch</h3>
          <div className="github-controls">
            <label>
              New branch name
              <input
                type="text"
                className="search-input"
                placeholder={selectedIssue ? getDefaultBranchName(selectedIssue.key) : 'SCRUM-20'}
                value={branchDraftName}
                onChange={(event) => onBranchDraftNameChange(event.target.value)}
                disabled={!githubConnected || !selectedRepo || creatingBranch}
              />
            </label>
          </div>
          <p className="field-meta">Base branch: {selectedBranch || 'Select a branch above'}</p>
          <p className="field-meta">Branch name should match the Jira issue key, and you can edit it before creating the branch.</p>
          <button
            type="button"
            className="refresh-btn"
            onClick={handleCreateBranch}
            disabled={!githubConnected || !selectedRepo || creatingBranch || !branchDraftName.trim()}
          >
            {creatingBranch ? 'Creating branch...' : 'Create branch'}
          </button>

          {branchCreateError && <p className="error-inline">{branchCreateError}</p>}
          {branchCreateSuccess && <p className="success-inline">{branchCreateSuccess}</p>}
      </div>

      <div className="panel-section branch-create-section">
          <h3>4. Stage changes and push</h3>
          <div className="github-controls github-form-grid">
            <label>
              File action
              <select
                value={fileMode}
                onChange={(event) => {
                  const nextMode = event.target.value as FileMode
                  onFileModeChange(nextMode)

                  if (nextMode === 'existing') {
                    onEditorFilePathChange(selectedFile || '')
                    onEditorFileContentChange(selectedFileContent || '')
                    return
                  }

                  onSelectedFileChange('')
                  onEditorFilePathChange('')
                  onEditorFileContentChange('')
                }}
                disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
              >
                <option value="existing">Existing file</option>
                <option value="new">New file</option>
              </select>
            </label>

            {fileMode === 'existing' ? (
              <label>
                File
                <select
                  value={selectedFile}
                  onChange={(event) => {
                    const nextFile = event.target.value
                    onSelectedFileChange(nextFile)
                    onEditorFilePathChange(nextFile)
                    onEditorFileContentChange('')
                  }}
                  disabled={!githubConnected || !selectedBranch || loadingGithubFiles || isCommitting}
                >
                  <option value="">Select a file</option>
                  {availableFiles.map((file) => (
                    <option key={file.path} value={file.path}>
                      {file.path}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                New file path
                <input
                  type="text"
                  className="search-input"
                  placeholder="src/new-file.ts"
                  value={editorFilePath}
                  onChange={(event) => onEditorFilePathChange(event.target.value)}
                  disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
                />
              </label>
            )}

          </div>

            <div className="github-editor-card">
              <label>
                File content
                <ErrorBoundary
                  fallback={
                    <textarea
                      className="ticket-textarea"
                      rows={8}
                      value={editorFileContent}
                      onChange={(event) => onEditorFileContentChange(event.target.value)}
                      disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
                    />
                  }
                >
                  <div className="github-editor-shell">
                    <CodeEditor
                      value={editorFileContent}
                      onChange={(value) => onEditorFileContentChange(value)}
                      disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
                      fileName={fileMode === 'existing' ? selectedFile : editorFilePath}
                    />
                  </div>
                </ErrorBoundary>
              </label>

              {fileMode === 'existing' && selectedFile && <p className="field-meta">Editing existing file: {selectedFile}</p>}

              {fileMode === 'new' && <p className="field-meta">Create a new file by entering a path and content.</p>}

              <div className="workspace-actions">
                <button
                  type="button"
                  className="refresh-btn"
                  onClick={handleStageFileChange}
                  disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting || !editorFilePath.trim()}
                >
                  Stage file change
                </button>
              </div>
            </div>

          {stagedChanges.length > 0 && (
            <ul className="detail-list">
              {stagedChanges.map((change) => (
                <li key={change.path} className="detail-card">
                  <div className="detail-subtext">{change.path}</div>
                  <div className="workspace-actions">
                    <button
                      type="button"
                      className="close-btn"
                      onClick={() => handleUnstageFileChange(change.path)}
                      disabled={isCommitting}
                    >
                      Unstage
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="github-controls github-form-grid">
            <label>
              Commit message
              <input
                type="text"
                className="search-input"
                placeholder="feat: update issue flow"
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
                disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting}
              />
            </label>
          </div>

          <div className="workspace-actions workspace-actions--stacked">
            <button
              type="button"
              className="refresh-btn"
              onClick={handleCommitAndPush}
              disabled={!githubConnected || !selectedRepo || !selectedBranch || isCommitting || stagedChanges.length === 0}
            >
              {isCommitting ? 'Committing and pushing...' : 'Commit and push'}
            </button>
          </div>

          {commitError && <p className="error-inline">{commitError}</p>}
          {commitSuccess && <p className="success-inline">{commitSuccess}</p>}
      </div>

        {githubApiError && <p className="empty-state">{githubApiError}</p>}

        {githubConnected && !loadingGithubRepos && availableRepos.length === 0 && !githubApiError && (
          <p className="empty-state">
            No repositories were returned by GitHub. Check token permissions or set GITHUB_REPOS.
          </p>
        )}

        {selectedFileUrl && (
          <div className="workspace-actions">
            <a href={selectedFileUrl} target="_blank" rel="noreferrer" className="secondary-link">
              Open selected file on GitHub
            </a>
          </div>
        )}

        {autoLinkedBranch && (
          <div className="linked-branch-banner">
            Automatically linked branch:
            <a href={autoLinkedBranch.url} target="_blank" rel="noreferrer">
              {autoLinkedBranch.repo} / {autoLinkedBranch.name}
            </a>
          </div>
        )}
      <div className="panel-section">
        <h3>5. Linked pull requests</h3>
        {githubPullRequests.length === 0 ? (
          <p className="empty-state">No matching pull requests found.</p>
        ) : (
          <ul className="detail-list">
            {githubPullRequests.map((pr) => (
              <li key={`${pr.repo}-${pr.number}`} className="detail-card">
                <a href={pr.url} target="_blank" rel="noreferrer">
                  {pr.title}
                </a>
                <div className="detail-subtext">
                  {pr.repo} · PR #{pr.number} · {pr.state} · {pr.branch || 'Unknown branch'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel-section">
        <h3>Repositories checked</h3>
        {reposChecked.length === 0 ? (
          <p className="empty-state">No repositories configured.</p>
        ) : (
          <ul className="detail-list">
            {reposChecked.map((repo) => (
              <li key={repo} className="detail-card muted-card">
                {repo}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
