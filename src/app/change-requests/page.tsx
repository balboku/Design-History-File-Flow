import type { CSSProperties } from 'react'
import { ChangeRequestStatus } from '@prisma/client'
import { redirect } from 'next/navigation'

import { createChangeRequestAction } from '@/actions/change-request-actions'
import {
  ActionLink,
  AppShell,
  EmptyPanel,
  MetricCard,
  SectionCard,
  StatusPill,
} from '@/components/app-shell'
import {
  getChangeRequestBoardData,
  getWorkspaceLookupData,
} from '@/lib/frontend-data'

type SearchParams = Promise<{ notice?: string; error?: string }>

function buildUrl(params: { notice?: string; error?: string }) {
  const search = new URLSearchParams()

  if (params.notice) search.set('notice', params.notice)
  if (params.error) search.set('error', params.error)

  const query = search.toString()
  return query ? `/change-requests?${query}` : '/change-requests'
}

export default async function ChangeRequestsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [urlState, changeRequests, lookup] = await Promise.all([
    searchParams,
    getChangeRequestBoardData(),
    getWorkspaceLookupData(),
  ])

  async function createChangeRequestForm(formData: FormData) {
    'use server'

    const result = await createChangeRequestAction({
      code: String(formData.get('code') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      impactAnalysis: String(formData.get('impactAnalysis') ?? '') || undefined,
      projectId: String(formData.get('projectId') ?? '') || undefined,
      requesterId: String(formData.get('requesterId') ?? '') || undefined,
      status: String(formData.get('status') ?? ChangeRequestStatus.Draft) as ChangeRequestStatus,
      deliverableIds: formData.getAll('deliverableIds').map(String),
      partComponentIds: formData.getAll('partComponentIds').map(String),
    })

    if (result.success) {
      redirect(buildUrl({ notice: `Change request ${result.data.code} created` }))
    }

    redirect(buildUrl({ error: result.error }))
  }

  const approvedCount = changeRequests.filter(
    (item) => item.status === ChangeRequestStatus.Approved || item.status === ChangeRequestStatus.Implemented,
  ).length
  const activeCount = changeRequests.filter(
    (item) =>
      item.status === ChangeRequestStatus.Active ||
      item.status === ChangeRequestStatus.Submitted ||
      item.status === ChangeRequestStatus.InReview,
  ).length

  return (
    <AppShell
      eyebrow="Post-Transfer Control"
      title="Change Requests"
      description="Capture design changes after transfer, tie them to affected projects, deliverables, and parts, and keep impact analysis attached to the record."
      actions={<ActionLink href="/deliverables" label="Open Deliverables" />}
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
        <MetricCard label="Total CRs" value={String(changeRequests.length)} />
        <MetricCard label="Active Review" value={String(activeCount)} accent="#8a4e22" />
        <MetricCard label="Approved / Implemented" value={String(approvedCount)} accent="#315f3a" />
        <MetricCard
          label="Linked Parts"
          value={String(lookup.parts.length)}
          hint="Global reusable part library available for impact tagging"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.95fr 1.05fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <SectionCard
          title="Create Change Request"
          subtitle="At least one of project, deliverable, or part must be linked to keep the request traceable."
          tone="dark"
        >
          <form action={createChangeRequestForm} style={{ display: 'grid', gap: 10 }}>
            <input name="code" placeholder="CR code" style={darkInputStyle} />
            <input name="title" placeholder="CR title" style={darkInputStyle} />
            <textarea
              name="description"
              placeholder="Change description"
              style={{ ...darkInputStyle, minHeight: 90, resize: 'vertical' }}
            />
            <textarea
              name="impactAnalysis"
              placeholder="Impact analysis"
              style={{ ...darkInputStyle, minHeight: 120, resize: 'vertical' }}
            />
            <select name="projectId" defaultValue="" style={darkInputStyle}>
              <option value="">No project selected</option>
              {lookup.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </select>
            <select name="requesterId" defaultValue="" style={darkInputStyle}>
              <option value="">Requester</option>
              {lookup.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.role}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={ChangeRequestStatus.Draft} style={darkInputStyle}>
              {Object.values(ChangeRequestStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              name="deliverableIds"
              multiple
              defaultValue={[]}
              style={{ ...darkInputStyle, minHeight: 140 }}
            >
              {lookup.deliverables.map((deliverable) => (
                <option key={deliverable.id} value={deliverable.id}>
                  {deliverable.projectCode} · {deliverable.code} · {deliverable.title}
                </option>
              ))}
            </select>
            <select
              name="partComponentIds"
              multiple
              defaultValue={[]}
              style={{ ...darkInputStyle, minHeight: 120 }}
            >
              {lookup.parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.partNumber} · {part.name}
                </option>
              ))}
            </select>
            <button type="submit" style={lightButtonStyle}>
              Create Change Request
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Control Notes"
          subtitle="Use CRs to reopen controlled documents after design transfer without losing why the change was accepted."
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={notePanelStyle}>
              A CR can be linked directly to a project, one or more deliverables, or part numbers.
            </div>
            <div style={notePanelStyle}>
              Impact analysis stays embedded in the record so reviewers can understand why the revision happened.
            </div>
            <div style={notePanelStyle}>
              File revisions can later point back to the CR to preserve post-transfer traceability.
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Change Ledger"
        subtitle="Review the current state of every change, who requested it, and which regulated objects are affected."
      >
        {changeRequests.length === 0 ? (
          <EmptyPanel
            title="No change requests yet"
            body="Create the first CR from the panel above to start the post-transfer control log."
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {changeRequests.map((changeRequest) => (
              <div
                key={changeRequest.id}
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: 'rgba(255,248,239,0.72)',
                  border: '1px solid rgba(73, 52, 27, 0.12)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ color: '#896945', fontSize: 12 }}>{changeRequest.code}</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{changeRequest.title}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusPill
                      label={changeRequest.status}
                      tone={
                        changeRequest.status === ChangeRequestStatus.Approved ||
                        changeRequest.status === ChangeRequestStatus.Implemented
                          ? 'good'
                          : changeRequest.status === ChangeRequestStatus.Rejected
                            ? 'critical'
                            : 'warn'
                      }
                    />
                    {changeRequest.project ? (
                      <StatusPill label={changeRequest.project.code} tone="neutral" />
                    ) : null}
                  </div>
                </div>
                <div style={{ color: '#5a4631', lineHeight: 1.6 }}>
                  {changeRequest.description ?? 'No change description yet.'}
                </div>
                <div style={{ marginTop: 10, color: '#5a4631' }}>
                  Requester: {changeRequest.requester?.name ?? 'Unassigned'} · Deliverables:{' '}
                  {changeRequest.deliverableLinks.length > 0
                    ? changeRequest.deliverableLinks
                        .map((link) => `${link.deliverable.project.code}/${link.deliverable.code}`)
                        .join(', ')
                    : 'None'}
                </div>
                <div style={{ marginTop: 8, color: '#5a4631' }}>
                  Parts:{' '}
                  {changeRequest.partLinks.length > 0
                    ? changeRequest.partLinks
                        .map((link) => link.partComponent.partNumber)
                        .join(', ')
                    : 'None'}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  )
}

const baseInputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  padding: '14px 16px',
  fontSize: 15,
  boxSizing: 'border-box',
}

const darkInputStyle: CSSProperties = {
  ...baseInputStyle,
  background: 'rgba(255, 244, 228, 0.12)',
  border: '1px solid rgba(255,255,255,0.16)',
  color: '#fff7ec',
}

const lightButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#fff4df',
  color: '#442e17',
  fontWeight: 700,
}

const notePanelStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  background: 'rgba(255,255,255,0.52)',
  color: '#5b452c',
  lineHeight: 1.6,
}
