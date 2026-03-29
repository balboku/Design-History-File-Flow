import type { CSSProperties } from 'react'
import { PendingItemStatus } from '@prisma/client'
import { redirect } from 'next/navigation'

import {
  AppShell,
  EmptyPanel,
  MetricCard,
  SectionCard,
  StatusPill,
} from '@/components/app-shell'
import { getProjectSummaries } from '@/lib/frontend-data'
import {
  listProjectPendingItems,
  resolvePendingItem,
} from '@/lib/pending-item-service'

type SearchParams = Promise<{
  projectId?: string
  status?: string
  notice?: string
  error?: string
}>

function buildPageUrl(params: {
  projectId?: string
  status?: string
  notice?: string
  error?: string
}) {
  const search = new URLSearchParams()

  if (params.projectId) search.set('projectId', params.projectId)
  if (params.status) search.set('status', params.status)
  if (params.notice) search.set('notice', params.notice)
  if (params.error) search.set('error', params.error)

  const query = search.toString()
  return query ? `/pending-items?${query}` : '/pending-items'
}

function parseStatus(value?: string): PendingItemStatus | undefined {
  if (value === PendingItemStatus.Open || value === PendingItemStatus.Resolved) {
    return value
  }

  return undefined
}

export default async function PendingItemsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [params, projects] = await Promise.all([searchParams, getProjectSummaries()])
  const projectId = params.projectId?.trim() ?? ''
  const status = parseStatus(params.status)
  const notice = params.notice
  const error = params.error
  const items = projectId ? await listProjectPendingItems(projectId, status) : []
  const selectedProject = projects.find((project) => project.id === projectId) ?? null

  async function resolvePendingItemForm(formData: FormData) {
    'use server'

    const pendingItemId = String(formData.get('pendingItemId') ?? '')
    const formProjectId = String(formData.get('projectId') ?? '')
    const formStatus = String(formData.get('status') ?? '')

    try {
      await resolvePendingItem(pendingItemId)
      redirect(
        buildPageUrl({
          projectId: formProjectId,
          status: formStatus || undefined,
          notice: 'Pending item 已成功結案',
        }),
      )
    } catch (err) {
      redirect(
        buildPageUrl({
          projectId: formProjectId,
          status: formStatus || undefined,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    }
  }

  const openCount = items.filter((item) => item.status === PendingItemStatus.Open).length
  const resolvedCount = items.filter((item) => item.status === PendingItemStatus.Resolved).length

  return (
    <AppShell
      eyebrow="Soft Gate Ops"
      title="Pending Items"
      description="Review every controlled exception created by phase override decisions, close the carryover when the linked deliverable is truly released, and keep the audit trail visible."
    >
      {(notice || error) && (
        <div
          style={{
            marginBottom: 18,
            borderRadius: 20,
            padding: '14px 16px',
            background: notice ? 'rgba(72, 131, 82, 0.12)' : 'rgba(149, 58, 52, 0.12)',
            color: notice ? '#2d6637' : '#8a2f2c',
            border: `1px solid ${notice ? 'rgba(72, 131, 82, 0.18)' : 'rgba(149, 58, 52, 0.18)'}`,
          }}
        >
          {notice ?? error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <SectionCard
          title="Pending Query"
          subtitle="Pick a project to inspect open exceptions and historical carryovers."
        >
          <form method="GET" style={{ display: 'grid', gap: 10 }}>
            <select name="projectId" defaultValue={projectId} style={inputStyle}>
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={status ?? ''} style={inputStyle}>
              <option value="">All statuses</option>
              <option value={PendingItemStatus.Open}>Open</option>
              <option value={PendingItemStatus.Resolved}>Resolved</option>
            </select>
            <button type="submit" style={primaryButtonStyle}>
              Load Pending Items
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="What This Means"
          subtitle="Soft gates keep teams moving, but unresolved exceptions remain visible until QA catches up."
          tone="dark"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={darkPanelStyle}>
              `Open` means the override debt is still active and the deliverable is not fully released.
            </div>
            <div style={darkPanelStyle}>
              `Resolved` means the linked deliverable has reached `Released` and the exception can be closed.
            </div>
            <div style={darkPanelStyle}>
              The final `DesignTransfer` gate still blocks if any open carryovers remain.
            </div>
          </div>
        </SectionCard>
      </div>

      {projectId ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 16,
              marginBottom: 22,
            }}
          >
            <MetricCard
              label="Project"
              value={selectedProject?.code ?? projectId.slice(0, 8)}
              hint={selectedProject?.name ?? 'Selected project'}
            />
            <MetricCard label="Total Items" value={String(items.length)} />
            <MetricCard label="Open" value={String(openCount)} accent="#8a2f2c" />
            <MetricCard label="Resolved" value={String(resolvedCount)} accent="#315f3a" />
          </div>

          <SectionCard
            title="Carryover Ledger"
            subtitle="Each card shows the exception state, linked deliverable readiness, and whether the item is eligible to close."
          >
            {items.length === 0 ? (
              <EmptyPanel
                title="No pending items found"
                body="This project currently has no matching pending items for the selected filter."
              />
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {items.map((item) => {
                  const canResolve =
                    item.status === PendingItemStatus.Open &&
                    item.deliverable.status === 'Released'

                  return (
                    <article
                      key={item.id}
                      style={{
                        background: 'rgba(255,255,255,0.7)',
                        border: '1px solid rgba(75, 56, 34, 0.14)',
                        borderRadius: 22,
                        padding: 22,
                        boxShadow: '0 14px 30px rgba(58, 37, 15, 0.06)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 16,
                          flexWrap: 'wrap',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ maxWidth: 760 }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              flexWrap: 'wrap',
                              marginBottom: 12,
                            }}
                          >
                            <StatusPill
                              label={item.status}
                              tone={
                                item.status === PendingItemStatus.Open ? 'critical' : 'good'
                              }
                            />
                            <StatusPill
                              label={`Deliverable ${item.deliverable.status}`}
                              tone={
                                item.deliverable.status === 'Released' ? 'good' : 'warn'
                              }
                            />
                            <StatusPill label={`Phase ${item.deliverable.phase}`} tone="neutral" />
                          </div>
                          <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>{item.title}</h2>
                          <p style={{ margin: 0, color: '#5e4b35', lineHeight: 1.6 }}>
                            {item.detail ?? '此遺留項沒有額外描述。'}
                          </p>
                          <div
                            style={{
                              marginTop: 14,
                              display: 'grid',
                              gap: 6,
                              color: '#5a4631',
                            }}
                          >
                            <div>
                              Deliverable: {item.deliverable.code} · {item.deliverable.title}
                            </div>
                            <div>
                              Triggered by:{' '}
                              {item.sourceTransition
                                ? `${item.sourceTransition.fromPhase} → ${item.sourceTransition.toPhase}`
                                : 'Unknown transition'}
                            </div>
                            <div>
                              Created:{' '}
                              {new Intl.DateTimeFormat('zh-TW', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(item.createdAt)}
                            </div>
                          </div>
                        </div>

                        <form action={resolvePendingItemForm} style={{ minWidth: 210 }}>
                          <input type="hidden" name="pendingItemId" value={item.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="status" value={status ?? ''} />
                          <button
                            type="submit"
                            disabled={!canResolve}
                            style={{
                              ...primaryButtonStyle,
                              width: '100%',
                              opacity: canResolve ? 1 : 0.45,
                              cursor: canResolve ? 'pointer' : 'not-allowed',
                            }}
                          >
                            Mark Resolved
                          </button>
                          <p
                            style={{
                              margin: '10px 0 0',
                              color: '#6e5a43',
                              lineHeight: 1.5,
                            }}
                          >
                            {canResolve
                              ? 'The linked deliverable is released and can close this item.'
                              : 'Release the linked deliverable before resolving this carryover.'}
                          </p>
                        </form>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard
          title="Select A Project"
          subtitle="Choose a project to see pending-item history, resolution eligibility, and override residue."
        >
          <EmptyPanel
            title="No project selected"
            body="Use the query panel above to load a project-specific pending-item ledger."
          />
        </SectionCard>
      )}
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

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#6b4927',
  color: '#fff7ee',
  fontWeight: 700,
}

const darkPanelStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  background: 'rgba(255, 244, 228, 0.12)',
  color: 'rgba(255, 241, 222, 0.84)',
}
