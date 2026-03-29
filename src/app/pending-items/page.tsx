import type { CSSProperties } from 'react'
import Link from 'next/link'
import { PendingItemStatus } from '@prisma/client'
import { redirect } from 'next/navigation'

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
  const params = await searchParams
  const projectId = params.projectId?.trim() ?? ''
  const status = parseStatus(params.status)
  const notice = params.notice
  const error = params.error

  const items = projectId ? await listProjectPendingItems(projectId, status) : []

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
      const message = err instanceof Error ? err.message : String(err)
      redirect(
        buildPageUrl({
          projectId: formProjectId,
          status: formStatus || undefined,
          error: message,
        }),
      )
    }
  }

  const openCount = items.filter((item) => item.status === PendingItemStatus.Open).length
  const resolvedCount = items.filter((item) => item.status === PendingItemStatus.Resolved).length

  return (
    <main
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '36px 20px 96px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 24,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 28,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontSize: 12,
              color: '#7b6142',
            }}
          >
            Soft Gate Ops
          </p>
          <h1 style={{ margin: '10px 0 8px', fontSize: 'clamp(2.2rem, 5vw, 3.8rem)' }}>
            Pending Items
          </h1>
          <p style={{ margin: 0, maxWidth: 700, lineHeight: 1.6, color: '#4b3a27' }}>
            Review exceptions created by conditional phase promotion, keep work-at-risk
            visible, and close items only when the linked deliverable reaches
            <code style={{ marginLeft: 4 }}>Released</code>.
          </p>
        </div>
        <Link
          href="/"
          style={{
            color: '#5b4328',
            textDecoration: 'none',
            border: '1px solid rgba(75, 56, 34, 0.18)',
            borderRadius: 999,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.42)',
          }}
        >
          Back Home
        </Link>
      </div>

      <section
        style={{
          background: 'rgba(255,255,255,0.58)',
          border: '1px solid rgba(75, 56, 34, 0.16)',
          borderRadius: 24,
          padding: 24,
          boxShadow: '0 20px 50px rgba(71, 49, 24, 0.08)',
        }}
      >
        <form
          method="GET"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(180px, 220px) auto',
            gap: 12,
          }}
        >
          <input
            type="text"
            name="projectId"
            defaultValue={projectId}
            placeholder="輸入 Project ID"
            style={inputStyle}
          />
          <select name="status" defaultValue={status ?? ''} style={inputStyle}>
            <option value="">全部狀態</option>
            <option value={PendingItemStatus.Open}>Open</option>
            <option value={PendingItemStatus.Resolved}>Resolved</option>
          </select>
          <button type="submit" style={primaryButtonStyle}>
            查詢遺留項
          </button>
        </form>

        {(notice || error) && (
          <div
            style={{
              marginTop: 16,
              borderRadius: 18,
              padding: '14px 16px',
              background: notice ? 'rgba(73, 122, 78, 0.12)' : 'rgba(149, 58, 52, 0.12)',
              color: notice ? '#244a28' : '#7b2f28',
              border: `1px solid ${notice ? 'rgba(73, 122, 78, 0.18)' : 'rgba(149, 58, 52, 0.18)'}`,
            }}
          >
            {notice ?? error}
          </div>
        )}
      </section>

      {projectId ? (
        <section style={{ marginTop: 24 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 22,
            }}
          >
            <StatCard label="Project" value={projectId} />
            <StatCard label="Total" value={String(items.length)} />
            <StatCard label="Open" value={String(openCount)} accent="#8a3b2f" />
            <StatCard label="Resolved" value={String(resolvedCount)} accent="#315f3a" />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 16,
            }}
          >
            {items.length === 0 ? (
              <EmptyState />
            ) : (
              items.map((item) => {
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
                      <div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                          <Badge
                            label={item.status}
                            tone={item.status === PendingItemStatus.Open ? 'warning' : 'success'}
                          />
                          <Badge
                            label={`Deliverable ${item.deliverable.status}`}
                            tone={item.deliverable.status === 'Released' ? 'success' : 'neutral'}
                          />
                          <Badge label={`Phase ${item.deliverable.phase}`} tone="neutral" />
                        </div>
                        <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>{item.title}</h2>
                        <p style={{ margin: 0, color: '#5e4b35', lineHeight: 1.6 }}>
                          {item.detail ?? '此遺留項沒有額外描述。'}
                        </p>
                      </div>

                      <form action={resolvePendingItemForm}>
                        <input type="hidden" name="pendingItemId" value={item.id} />
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="status" value={status ?? ''} />
                        <button
                          type="submit"
                          disabled={!canResolve}
                          style={{
                            ...primaryButtonStyle,
                            opacity: canResolve ? 1 : 0.45,
                            cursor: canResolve ? 'pointer' : 'not-allowed',
                            minWidth: 168,
                          }}
                        >
                          Mark Resolved
                        </button>
                      </form>
                    </div>

                    <dl
                      style={{
                        margin: '18px 0 0',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 12,
                      }}
                    >
                      <MetaItem label="Pending Item ID" value={item.id} />
                      <MetaItem
                        label="Deliverable"
                        value={`${item.deliverable.code} · ${item.deliverable.title}`}
                      />
                      <MetaItem
                        label="Source Transition"
                        value={
                          item.sourceTransition
                            ? `${item.sourceTransition.fromPhase} → ${item.sourceTransition.toPhase}`
                            : 'N/A'
                        }
                      />
                      <MetaItem
                        label="Resolved At"
                        value={
                          item.resolvedAt
                            ? new Intl.DateTimeFormat('zh-TW', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              }).format(item.resolvedAt)
                            : '尚未結案'
                        }
                      />
                    </dl>
                  </article>
                )
              })
            )}
          </div>
        </section>
      ) : (
        <section style={{ marginTop: 24 }}>
          <EmptyState message="先輸入 Project ID，再查看該專案的遺留項。" />
        </section>
      )}
    </main>
  )
}

function StatCard({
  label,
  value,
  accent = '#67462a',
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 20,
        background: 'rgba(255,255,255,0.56)',
        border: '1px solid rgba(75, 56, 34, 0.12)',
      }}
    >
      <div style={{ color: '#7b6142', fontSize: 13, marginBottom: 8 }}>{label}</div>
      <div
        style={{
          color: accent,
          fontSize: 28,
          fontWeight: 700,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Badge({
  label,
  tone,
}: {
  label: string
  tone: 'warning' | 'success' | 'neutral'
}) {
  const styles =
    tone === 'warning'
      ? { background: 'rgba(144, 66, 38, 0.12)', color: '#8f4022' }
      : tone === 'success'
        ? { background: 'rgba(53, 109, 62, 0.12)', color: '#2d6637' }
        : { background: 'rgba(101, 84, 55, 0.12)', color: '#5d4b30' }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        ...styles,
      }}
    >
      {label}
    </span>
  )
}

function MetaItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: 'rgba(113, 91, 59, 0.06)',
      }}
    >
      <dt style={{ fontSize: 12, color: '#7b6142', marginBottom: 6 }}>{label}</dt>
      <dd style={{ margin: 0, color: '#3f3121', overflowWrap: 'anywhere' }}>{value}</dd>
    </div>
  )
}

function EmptyState({
  message = '沒有符合條件的 Pending Items。',
}: {
  message?: string
}) {
  return (
    <div
      style={{
        padding: '42px 24px',
        textAlign: 'center',
        borderRadius: 24,
        background: 'rgba(255,255,255,0.5)',
        border: '1px dashed rgba(75, 56, 34, 0.18)',
        color: '#6e5639',
      }}
    >
      {message}
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(75, 56, 34, 0.18)',
  background: 'rgba(255,255,255,0.78)',
  padding: '14px 16px',
  fontSize: 16,
  color: '#2d2418',
  boxSizing: 'border-box',
}

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#67462a',
  color: '#fff8ee',
  fontSize: 15,
  fontWeight: 700,
}
