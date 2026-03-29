import type { CSSProperties } from 'react'
import { DeliverableStatus, ProjectPhase, Role } from '@prisma/client'
import { redirect } from 'next/navigation'

import {
  advancePhaseAction,
} from '@/actions/phase-actions'
import {
  createTaskAction,
  completeTaskAction,
} from '@/actions/task-actions'
import {
  createDeliverableAction,
  updateDeliverableStatusAction,
} from '@/actions/deliverable-actions'
import {
  ActionLink,
  AppShell,
  EmptyPanel,
  MetricCard,
  SectionCard,
  StatusPill,
} from '@/components/app-shell'
import { getProjectDetail, getWorkspaceLookupData } from '@/lib/frontend-data'

type Params = Promise<{ projectId: string }>
type SearchParams = Promise<{ notice?: string; error?: string }>

function buildUrl(projectId: string, params: { notice?: string; error?: string }) {
  const search = new URLSearchParams()
  if (params.notice) search.set('notice', params.notice)
  if (params.error) search.set('error', params.error)
  const query = search.toString()
  return query ? `/projects/${projectId}?${query}` : `/projects/${projectId}`
}

function formatFileSize(value: number | null) {
  if (!value || value <= 0) {
    return 'Unknown size'
  }

  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { projectId } = await params
  const [urlState, data, lookup] = await Promise.all([
    searchParams,
    getProjectDetail(projectId),
    getWorkspaceLookupData(),
  ])

  if (!data) {
    return (
      <AppShell
        eyebrow="Project Detail"
        title="Project Not Found"
        description="The requested project record does not exist."
        actions={<ActionLink href="/projects" label="Back to Projects" />}
      >
        <EmptyPanel
          title="Missing project"
          body="Double-check the project id or return to the portfolio board."
        />
      </AppShell>
    )
  }

  const { project, gate } = data

  async function createTaskForm(formData: FormData) {
    'use server'

    const result = await createTaskAction({
      projectId,
      code: String(formData.get('code') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      assigneeId: String(formData.get('assigneeId') ?? '') || undefined,
      createdById: String(formData.get('createdById') ?? '') || undefined,
      plannedPhase: String(formData.get('plannedPhase') ?? ProjectPhase.Planning) as ProjectPhase,
      deliverableIds: formData.getAll('deliverableIds').map(String),
    })

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `Task ${result.data.code} created` }))
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  async function completeTaskForm(formData: FormData) {
    'use server'

    const taskId = String(formData.get('taskId') ?? '')
    const result = await completeTaskAction(taskId)

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `Task ${result.data.id.slice(0, 8)} completed` }))
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  async function advanceProject(formData: FormData) {
    'use server'

    const forceOverride = formData.get('forceOverride') === 'true'
    const result = await advancePhaseAction({
      projectId,
      forceOverride,
      overriddenById: forceOverride
        ? String(formData.get('overriddenById') ?? '') || undefined
        : undefined,
      rationale: forceOverride
        ? String(formData.get('rationale') ?? '') || undefined
        : undefined,
    })

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `Phase result: ${result.outcome}` }))
    }

    redirect(buildUrl(projectId, { error: result.message }))
  }

  async function createDeliverableForm(formData: FormData) {
    'use server'

    const result = await createDeliverableAction({
      projectId,
      code: String(formData.get('code') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      phase: String(formData.get('phase') ?? project.currentPhase) as ProjectPhase,
      ownerId: String(formData.get('ownerId') ?? '') || undefined,
      isRequired: formData.get('isRequired') === 'true',
    })

    if (result.success) {
      redirect(buildUrl(projectId, { notice: `Deliverable ${result.data.code} created` }))
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  async function updateDeliverableStatusForm(formData: FormData) {
    'use server'

    const result = await updateDeliverableStatusAction({
      deliverableId: String(formData.get('deliverableId') ?? ''),
      status: String(formData.get('status') ?? DeliverableStatus.Draft) as DeliverableStatus,
    })

    if (result.success) {
      redirect(
        buildUrl(projectId, {
          notice: `Deliverable ${result.data.code} moved to ${result.data.status}`,
        }),
      )
    }

    redirect(buildUrl(projectId, { error: result.error }))
  }

  const doneTasks = project.tasks.filter((task) => task.status === 'Done').length
  const releasedDeliverables = project.deliverables.filter(
    (deliverable) => deliverable.status === 'Released',
  ).length
  const openPendingItems = project.pendingItems.filter((item) => item.status === 'Open').length
  const rdUsers = lookup.users.filter((user) => user.role === Role.RD)
  const qaUsers = lookup.users.filter((user) => user.role === Role.QA || user.role === Role.ADMIN)

  return (
    <AppShell
      eyebrow={project.code}
      title={project.name}
      description={
        project.description ??
        'Project workbench with execution, deliverables, phase gate posture, pending-item control, and change visibility.'
      }
      actions={<ActionLink href="/projects" label="Back to Projects" tone="secondary" />}
    >
      {(urlState.notice || urlState.error) && (
        <div
          style={{
            marginBottom: 18,
            borderRadius: 20,
            padding: '14px 16px',
            background: urlState.notice
              ? 'rgba(72, 131, 82, 0.12)'
              : 'rgba(149, 58, 52, 0.12)',
            color: urlState.notice ? '#2d6637' : '#8a2f2c',
            border: `1px solid ${
              urlState.notice ? 'rgba(72, 131, 82, 0.18)' : 'rgba(149, 58, 52, 0.18)'
            }`,
          }}
        >
          {urlState.notice ?? urlState.error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <MetricCard label="Current Phase" value={project.currentPhase} />
        <MetricCard
          label="Tasks Done"
          value={`${doneTasks}/${project.tasks.length}`}
          accent="#8a4e22"
        />
        <MetricCard
          label="Released Deliverables"
          value={`${releasedDeliverables}/${project.deliverables.length}`}
          accent="#315f3a"
        />
        <MetricCard
          label="Open Pending Items"
          value={String(openPendingItems)}
          accent={openPendingItems > 0 ? '#8a2f2c' : '#315f3a'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.05fr 0.95fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <SectionCard
          title="Phase Gate Control"
          subtitle="Review whether the next phase can be reached normally, or whether you are about to take a managed exception."
        >
          {gate?.canAdvance ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <StatusPill label={`Next phase: ${gate.nextPhase}`} tone="good" />
              </div>
              <form action={advanceProject}>
                <button type="submit" style={buttonStyle}>
                  Advance Phase
                </button>
              </form>
            </>
          ) : gate ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <StatusPill
                  label={gate.isHardGate ? 'Hard Gate' : 'Soft Gate Warning'}
                  tone={gate.isHardGate ? 'critical' : 'warn'}
                />
                <StatusPill label={`${gate.issues.length} issue(s)`} tone="neutral" />
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                {gate.issues.map((issue) => (
                  <div
                    key={`${issue.deliverableId}-${issue.reason}`}
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      background: 'rgba(255,255,255,0.52)',
                    }}
                  >
                    <strong>{issue.deliverableCode}</strong> · {issue.deliverableTitle}
                    <div style={{ color: '#6b563f', marginTop: 6 }}>{issue.reason}</div>
                  </div>
                ))}
              </div>
              {!gate.isHardGate ? (
                <form action={advanceProject} style={{ display: 'grid', gap: 10 }}>
                  <input type="hidden" name="forceOverride" value="true" />
                  <select name="overriddenById" defaultValue="" style={inputStyle}>
                    <option value="">Select approver</option>
                    {lookup.users
                      .filter((user) => user.role === Role.PM || user.role === Role.ADMIN)
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} · {user.role}
                        </option>
                      ))}
                  </select>
                  <textarea
                    name="rationale"
                    placeholder="Override rationale"
                    style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }}
                  />
                  <button type="submit" style={buttonStyle}>
                    Proceed With Exceptions
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <EmptyPanel
              title="Gate unavailable"
              body="The gate could not be evaluated for this project."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Create Task"
          subtitle="Phase-independent task planning means engineers can start future-phase work without waiting for formal promotion."
          tone="dark"
        >
          <form action={createTaskForm} style={{ display: 'grid', gap: 10 }}>
            <input name="code" placeholder="Task code" style={inputStyleDark} />
            <input name="title" placeholder="Task title" style={inputStyleDark} />
            <textarea
              name="description"
              placeholder="Task description"
              style={{ ...inputStyleDark, minHeight: 88, resize: 'vertical' }}
            />
            <select name="plannedPhase" defaultValue={project.currentPhase} style={inputStyleDark}>
              {Object.values(ProjectPhase).map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
            <select name="assigneeId" defaultValue="" style={inputStyleDark}>
              <option value="">Assign RD later</option>
              {rdUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select name="createdById" defaultValue="" style={inputStyleDark}>
              <option value="">Created by system / current user</option>
              {lookup.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.role}
                </option>
              ))}
            </select>
            <select
              name="deliverableIds"
              multiple
              defaultValue={project.deliverables.slice(0, 2).map((deliverable) => deliverable.id)}
              style={{ ...inputStyleDark, minHeight: 150 }}
            >
              {project.deliverables.map((deliverable) => (
                <option key={deliverable.id} value={deliverable.id}>
                  {deliverable.code} · {deliverable.title}
                </option>
              ))}
            </select>
            <button type="submit" style={buttonStyleLight}>
              Create Traceable Task
            </button>
          </form>
        </SectionCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <SectionCard
          title="Tasks"
          subtitle="Execution work with planned phase versus current project phase kept intentionally separate."
        >
          {project.tasks.length === 0 ? (
            <EmptyPanel title="No tasks yet" body="Create the first task from the panel on the right." />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {project.tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: 'rgba(255,255,255,0.54)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: '#896945' }}>{task.code}</div>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{task.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <StatusPill
                        label={task.status}
                        tone={
                          task.status === 'Done'
                            ? 'good'
                            : task.status === 'InProgress'
                              ? 'warn'
                              : 'neutral'
                        }
                      />
                      <StatusPill
                        label={`Planned ${task.plannedPhase}`}
                        tone={task.plannedPhase !== project.currentPhase ? 'warn' : 'neutral'}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10, color: '#65513a', lineHeight: 1.6 }}>
                    {task.description ?? 'No task description.'}
                  </div>
                  <div style={{ marginTop: 10, color: '#5b452c' }}>
                    Deliverables:{' '}
                    {task.deliverableLinks.map((link) => link.deliverable.code).join(', ')}
                  </div>
                  <div style={{ marginTop: 8, color: '#5b452c' }}>
                    Assignee: {task.assignee?.name ?? 'Unassigned'}
                  </div>
                  {task.status !== 'Done' ? (
                    <form action={completeTaskForm} style={{ marginTop: 12 }}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button type="submit" style={buttonStyle}>
                        Mark Done
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Create Deliverable"
          subtitle="Add the next compliance output placeholder, assign QA ownership, and define which phase gate it belongs to."
          tone="dark"
        >
          <form action={createDeliverableForm} style={{ display: 'grid', gap: 10 }}>
            <input name="code" placeholder="Deliverable code" style={inputStyleDark} />
            <input name="title" placeholder="Deliverable title" style={inputStyleDark} />
            <textarea
              name="description"
              placeholder="Deliverable description"
              style={{ ...inputStyleDark, minHeight: 88, resize: 'vertical' }}
            />
            <select name="phase" defaultValue={project.currentPhase} style={inputStyleDark}>
              {Object.values(ProjectPhase).map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
            <select name="ownerId" defaultValue="" style={inputStyleDark}>
              <option value="">Assign QA owner later</option>
              {qaUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.role}
                </option>
              ))}
            </select>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#fff7ec' }}>
              <input type="checkbox" name="isRequired" value="true" defaultChecked />
              Required for gate review
            </label>
            <button type="submit" style={buttonStyleLight}>
              Create Deliverable
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard
        title="Deliverables"
        subtitle="Manage file revisions, QA release state, and the items that are still carrying work-at-risk debt."
      >
        {project.deliverables.length === 0 ? (
          <EmptyPanel
            title="No deliverables yet"
            body="Create the first placeholder from the panel above to start linking tasks and revisions."
          />
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {project.deliverables.map((deliverable) => (
              <div
                key={deliverable.id}
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: 'rgba(255,255,255,0.56)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: '#896945' }}>{deliverable.code}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{deliverable.title}</div>
                    <div style={{ marginTop: 8, color: '#5b452c' }}>
                      Owner: {deliverable.owner?.name ?? 'Unassigned'} · Revisions:{' '}
                      {deliverable.fileRevisions.length} · Pending links: {deliverable.pendingItems.length}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusPill
                      label={deliverable.status}
                      tone={
                        deliverable.status === 'Released'
                          ? 'good'
                          : deliverable.status === 'Locked'
                            ? 'critical'
                            : 'warn'
                      }
                    />
                    <StatusPill label={deliverable.phase} tone="neutral" />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={fieldLabelStyle}>Stored revisions</div>
                  {deliverable.fileRevisions.length === 0 ? (
                    <div
                      style={{
                        marginTop: 8,
                        borderRadius: 18,
                        padding: 14,
                        background: 'rgba(255,255,255,0.46)',
                        color: '#6d5942',
                      }}
                    >
                      No uploaded files yet.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      {deliverable.fileRevisions.map((revision) => (
                        <a
                          key={revision.id}
                          href={`/api/file-revisions/${revision.id}/download`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            borderRadius: 18,
                            padding: '12px 14px',
                            background: 'rgba(255,255,255,0.66)',
                            textDecoration: 'none',
                            color: '#3d2f1d',
                          }}
                        >
                          <span>
                            r{revision.revisionNumber} · {revision.fileName}
                          </span>
                          <span style={{ color: '#6a543b', fontSize: 14 }}>
                            {formatFileSize(revision.fileSizeBytes)} ·{' '}
                            {new Intl.DateTimeFormat('zh-TW', {
                              dateStyle: 'medium',
                            }).format(revision.createdAt)}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 280px',
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  <form
                    action={`/api/projects/${projectId}/deliverables/${deliverable.id}/revisions`}
                    method="POST"
                    encType="multipart/form-data"
                    style={{ display: 'grid', gap: 10 }}
                  >
                    <div style={fieldLabelStyle}>Log file revision</div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                      }}
                    >
                      <input name="file" type="file" style={inputStyle} />
                      <input
                        name="revisionNumber"
                        type="number"
                        min="1"
                        placeholder="Revision number (optional)"
                        style={inputStyle}
                      />
                      <select name="uploadedById" defaultValue="" style={inputStyle}>
                        <option value="">Uploader</option>
                        {lookup.users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} · {user.role}
                          </option>
                        ))}
                      </select>
                      <select name="changeRequestId" defaultValue="" style={inputStyle}>
                        <option value="">Link change request later</option>
                        {project.changeRequests.map((changeRequest) => (
                          <option key={changeRequest.id} value={changeRequest.id}>
                            {changeRequest.code} · {changeRequest.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      name="changeSummary"
                      placeholder="Revision summary"
                      style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                    />
                    <button type="submit" style={buttonStyle}>
                      Upload Revision
                    </button>
                    <div style={{ color: '#6c573f', lineHeight: 1.5 }}>
                      Locked deliverables require a linked change request before a new file can be uploaded.
                    </div>
                  </form>

                  <form action={updateDeliverableStatusForm} style={{ display: 'grid', gap: 10 }}>
                    <input type="hidden" name="deliverableId" value={deliverable.id} />
                    <div style={fieldLabelStyle}>QA status control</div>
                    <button
                      type="submit"
                      name="status"
                      value={DeliverableStatus.Draft}
                      style={secondaryButtonStyle}
                    >
                      Set Draft
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value={DeliverableStatus.Released}
                      style={buttonStyle}
                    >
                      Set Released
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value={DeliverableStatus.Locked}
                      style={criticalButtonStyle}
                    >
                      Lock Deliverable
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Pending Items, Audit, and Changes"
        subtitle="Every conditional go remains visible until it is explicitly closed, and post-transfer changes stay attached to the project record."
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {project.pendingItems.length === 0 ? (
              <EmptyPanel
                title="No pending items"
                body="This project currently has no open or historical carryovers."
              />
            ) : (
              project.pendingItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: 'rgba(255,255,255,0.54)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>{item.title}</strong>
                    <StatusPill
                      label={item.status}
                      tone={item.status === 'Resolved' ? 'good' : 'critical'}
                    />
                  </div>
                  <div style={{ marginTop: 8, color: '#5f4a34' }}>
                    {item.deliverable.code} · {item.deliverable.title}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {project.phaseTransitions.map((transition) => (
              <div
                key={transition.id}
                style={{
                  borderRadius: 20,
                  padding: 16,
                  background: 'rgba(255,255,255,0.54)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <strong>
                    {transition.fromPhase} → {transition.toPhase}
                  </strong>
                  <StatusPill
                    label={transition.wasOverride ? 'Override' : 'Normal'}
                    tone={transition.wasOverride ? 'warn' : 'good'}
                  />
                </div>
                <div style={{ marginTop: 8, color: '#5f4a34' }}>
                  Triggered by {transition.triggeredBy?.name ?? 'System'} ·{' '}
                  {new Intl.DateTimeFormat('zh-TW', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(transition.createdAt)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {project.changeRequests.length === 0 ? (
              <EmptyPanel
                title="No change requests"
                body="Post-transfer change control will appear here once the first CR is logged."
              />
            ) : (
              project.changeRequests.map((changeRequest) => (
                <div
                  key={changeRequest.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: 'rgba(255,255,255,0.54)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>
                      {changeRequest.code} · {changeRequest.title}
                    </strong>
                    <StatusPill
                      label={changeRequest.status}
                      tone={
                        changeRequest.status === 'Approved' || changeRequest.status === 'Implemented'
                          ? 'good'
                          : changeRequest.status === 'Rejected'
                            ? 'critical'
                            : 'warn'
                      }
                    />
                  </div>
                  <div style={{ marginTop: 8, color: '#5f4a34' }}>
                    Requester: {changeRequest.requester?.name ?? 'Unassigned'}
                  </div>
                  <div style={{ marginTop: 8, color: '#5f4a34' }}>
                    Linked deliverables:{' '}
                    {changeRequest.deliverableLinks.length > 0
                      ? changeRequest.deliverableLinks
                          .map((link) => link.deliverable.code)
                          .join(', ')
                      : 'None'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>
    </AppShell>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(73, 52, 27, 0.18)',
  background: 'rgba(255,255,255,0.76)',
  padding: '14px 16px',
  fontSize: 15,
  color: '#2f2418',
  boxSizing: 'border-box',
}

const inputStyleDark: CSSProperties = {
  ...inputStyle,
  background: 'rgba(255, 244, 228, 0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  color: '#fff7ec',
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#8c6e4f',
}

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#6b4927',
  color: '#fff7ee',
  fontWeight: 700,
}

const buttonStyleLight: CSSProperties = {
  ...buttonStyle,
  background: '#fff4df',
  color: '#442e17',
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: 'rgba(255, 248, 239, 0.88)',
  color: '#4d351c',
}

const criticalButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: '#8a2f2c',
  color: '#fff5f3',
}
