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
import { getProjectSummaries, getWorkspaceLookupData } from '@/lib/frontend-data'
import {
  formatDateTimeZh,
  formatDeliverableStatus,
  formatPendingItemStatus,
  formatProjectPhase,
} from '@/lib/ui-labels'
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
  const [params, projects, lookup] = await Promise.all([
    searchParams,
    getProjectSummaries(),
    getWorkspaceLookupData(),
  ])
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
    const actorId = String(formData.get('actorId') ?? '')

    try {
      if (!actorId) {
        throw new Error('請選擇操作者。')
      }
      await resolvePendingItem(pendingItemId, actorId)
      redirect(
        buildPageUrl({
          projectId: formProjectId,
          status: formStatus || undefined,
          notice: '遺留項已成功結案',
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
      eyebrow="條件式放行追蹤"
      title="遺留項管理"
      description="每一次條件式放行都會留下遺留項。這裡用來確認哪些例外仍未補齊，以及哪些項目已因文件已釋出而可以正式結案。"
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
          title="查詢條件"
          subtitle="選擇專案後，可查看該專案所有未結與歷史遺留項。"
        >
          <form method="GET" style={{ display: 'grid', gap: 10 }}>
            <select name="projectId" defaultValue={projectId} style={inputStyle}>
              <option value="">選擇專案</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={status ?? ''} style={inputStyle}>
              <option value="">全部狀態</option>
              <option value={PendingItemStatus.Open}>未結案</option>
              <option value={PendingItemStatus.Resolved}>已補齊</option>
            </select>
            <button type="submit" style={primaryButtonStyle}>
              載入遺留項
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="規則說明"
          subtitle="軟關卡讓團隊能前進，但每個例外都必須留下可追蹤的稽核痕跡。"
          tone="dark"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={darkPanelStyle}>
              `未結案` 代表這筆條件式放行的風險仍在，綁定文件還沒有完整釋出。
            </div>
            <div style={darkPanelStyle}>
              `已補齊` 代表對應文件已達 `已釋出`，遺留項可以正式結案。
            </div>
            <div style={darkPanelStyle}>
              到了 `設計移轉` 這道最終硬關卡，只要還有未結遺留項，就不允許放行。
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
              label="專案"
              value={selectedProject?.code ?? projectId.slice(0, 8)}
              hint={selectedProject?.name ?? '已選專案'}
            />
            <MetricCard label="總數" value={String(items.length)} />
            <MetricCard label="未結案" value={String(openCount)} accent="var(--app-danger)" />
            <MetricCard label="已補齊" value={String(resolvedCount)} accent="var(--app-success)" />
          </div>

          <SectionCard
            title="遺留項台帳"
            subtitle="每張卡片都會標示例外狀態、文件是否可結案，以及是哪一次階段異動產生的。"
          >
            {items.length === 0 ? (
              <EmptyPanel
                title="查無符合條件的遺留項"
                body="此專案在目前篩選條件下沒有對應的遺留項。"
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
                              label={formatPendingItemStatus(item.status)}
                              tone={
                                item.status === PendingItemStatus.Open ? 'critical' : 'good'
                              }
                            />
                            <StatusPill
                              label={`文件：${formatDeliverableStatus(item.deliverable.status)}`}
                              tone={
                                item.deliverable.status === 'Released' ? 'good' : 'warn'
                              }
                            />
                            <StatusPill label={formatProjectPhase(item.deliverable.phase)} tone="neutral" />
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
                              文件：{item.deliverable.code} · {item.deliverable.title}
                            </div>
                            <div>
                              來源關卡：{' '}
                              {item.sourceOverride?.transition
                                ? `${formatProjectPhase(item.sourceOverride.transition.fromPhase)} → ${formatProjectPhase(item.sourceOverride.transition.toPhase)}`
                                : '未知'}
                            </div>
                            <div>
                              建立時間：{formatDateTimeZh(item.createdAt)}
                            </div>
                          </div>
                        </div>

                        <form action={resolvePendingItemForm} style={{ minWidth: 210 }}>
                          <input type="hidden" name="pendingItemId" value={item.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="status" value={status ?? ''} />
                          <select
                            name="actorId"
                            defaultValue=""
                            style={{ ...inputStyle, marginBottom: 10, width: '100%' }}
                            required
                          >
                            <option value="">選擇結案負責人</option>
                            {lookup.users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.role})
                              </option>
                            ))}
                          </select>
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
                            標記為已補齊
                          </button>
                          <p
                            style={{
                              margin: '10px 0 0',
                              color: '#6e5a43',
                              lineHeight: 1.5,
                            }}
                          >
                            {canResolve
                              ? '綁定文件已釋出，可以將此遺留項結案。'
                              : '請先讓綁定文件達到已釋出，再將此遺留項結案。'}
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
          title="先選擇專案"
          subtitle="選定專案後，才能看到該專案所有條件式放行造成的遺留項與補齊情況。"
        >
          <EmptyPanel
            title="尚未指定專案"
            body="請從上方查詢條件選擇專案後，再載入遺留項台帳。"
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
