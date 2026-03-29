import type { CSSProperties } from 'react'
import { ChangeRequestStatus, Role } from '@prisma/client'
import { redirect } from 'next/navigation'

import {
  createChangeRequestAction,
  transitionChangeRequestAction,
} from '@/actions/change-request-actions'
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
import { getAllowedChangeRequestTransitions } from '@/lib/change-request-service'
import {
  formatChangeRequestStatus,
  formatDateTimeZh,
  formatRole,
} from '@/lib/ui-labels'

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
      redirect(buildUrl({ notice: `已建立變更單 ${result.data.code}` }))
    }

    redirect(buildUrl({ error: result.error }))
  }

  async function transitionChangeRequestForm(formData: FormData) {
    'use server'

    const result = await transitionChangeRequestAction({
      changeRequestId: String(formData.get('changeRequestId') ?? ''),
      nextStatus: String(formData.get('nextStatus') ?? ChangeRequestStatus.Draft) as ChangeRequestStatus,
      actedById: String(formData.get('actedById') ?? '') || undefined,
    })

    if (result.success) {
      redirect(
        buildUrl({
          notice: `變更單 ${result.data.code} 已更新為 ${formatChangeRequestStatus(result.data.status)}`,
        }),
      )
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
  const approverOptions = lookup.users.filter((user) => user.role !== Role.RD)

  return (
    <AppShell
      eyebrow="設計變更管理"
      title="變更單管理"
      description="設計移轉後的變更都應回到變更單流程中管理，並明確連結受影響的專案、文件與料件。"
      actions={<ActionLink href="/deliverables" label="查看文件空殼" />}
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
        <MetricCard label="變更單總數" value={String(changeRequests.length)} />
        <MetricCard label="審查中 / 進行中" value={String(activeCount)} accent="var(--app-accent)" />
        <MetricCard label="已核准 / 已實施" value={String(approvedCount)} accent="var(--app-success)" />
        <MetricCard
          label="可連結料件"
          value={String(lookup.parts.length)}
          hint="全域共用 Part/Component 庫"
        />
      </div>

      <div
        className="app-grid-2"
        style={{ marginBottom: 18 }}
      >
        <SectionCard
          title="建立變更單"
          subtitle="至少要連結專案、文件或料件其中一種，才能保有完整的設計變更追溯。"
          tone="dark"
        >
          <form action={createChangeRequestForm} style={{ display: 'grid', gap: 10 }}>
            <input name="code" placeholder="CR 編號" style={darkInputStyle} />
            <input name="title" placeholder="變更單名稱" style={darkInputStyle} />
            <textarea
              name="description"
              placeholder="變更內容說明"
              style={{ ...darkInputStyle, minHeight: 90, resize: 'vertical' }}
            />
            <textarea
              name="impactAnalysis"
              placeholder="影響評估"
              required
              style={{ ...darkInputStyle, minHeight: 120, resize: 'vertical' }}
            />
            <select name="projectId" defaultValue="" style={darkInputStyle}>
              <option value="">尚未指定專案</option>
              {lookup.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} · {project.name}
                </option>
              ))}
            </select>
            <select name="requesterId" defaultValue="" style={darkInputStyle}>
              <option value="">提出人</option>
              {lookup.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {formatRole(user.role)}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={ChangeRequestStatus.Draft} style={darkInputStyle}>
              {Object.values(ChangeRequestStatus).map((status) => (
                <option key={status} value={status}>
                  {formatChangeRequestStatus(status)}
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
              建立變更單
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="設計原則"
          subtitle="變更單（Change Request）不只是表單，而是設計移轉後唯一合法的變更入口。"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={notePanelStyle}>
              每張變更單可直接連結專案、單一或多個文件，或受影響料號。
            </div>
            <div style={notePanelStyle}>
              影響評估會與變更單一起保存，讓審查人能理解為什麼需要升版。
            </div>
            <div style={notePanelStyle}>
              後續檔案版次也可回指該變更單，補齊設計移轉後的追溯鏈。
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="變更紀錄"
        subtitle="檢視每一張變更單的狀態、提出人與受影響的受管制物件。"
      >
        {changeRequests.length === 0 ? (
          <EmptyPanel
            title="尚未建立變更單"
            body="可從左側表單建立第一張變更單，開始移轉後變更管理。"
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {changeRequests.map((changeRequest) => (
              <div
                key={changeRequest.id}
                className="rounded-[22px] border border-[rgba(73,52,27,0.12)] bg-[rgba(255,248,239,0.72)] p-[18px] shadow-[0_12px_28px_rgba(57,37,16,0.06)]"
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
                      label={formatChangeRequestStatus(changeRequest.status)}
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
                  {changeRequest.description ?? '尚未填寫變更內容。'}
                </div>
                <div style={{ marginTop: 8, color: '#5a4631' }}>
                  影響評估：{changeRequest.impactAnalysis ?? '尚未填寫'}
                </div>
                <div style={{ marginTop: 10, color: '#5a4631' }}>
                  提出人：{changeRequest.requester?.name ?? '尚未指派'} · 影響文件：
                  {changeRequest.deliverableLinks.length > 0
                    ? changeRequest.deliverableLinks
                        .map((link) => `${link.deliverable.project.code}/${link.deliverable.code}`)
                        .join(', ')
                    : '無'}
                </div>
                <div style={{ marginTop: 8, color: '#5a4631' }}>
                  影響料件：
                  {changeRequest.partLinks.length > 0
                    ? changeRequest.partLinks
                        .map((link) => link.partComponent.partNumber)
                        .join(', ')
                    : '無'}
                </div>
                <div style={{ marginTop: 8, color: '#5a4631', lineHeight: 1.7 }}>
                  送審：{changeRequest.submittedAt ? formatDateTimeZh(changeRequest.submittedAt) : '尚未送審'} ·
                  核准：{changeRequest.approvedAt ? formatDateTimeZh(changeRequest.approvedAt) : '尚未核准'} ·
                  實施：{changeRequest.implementedAt ? formatDateTimeZh(changeRequest.implementedAt) : '尚未實施'}
                </div>
                <div style={{ marginTop: 8, color: '#5a4631' }}>
                  審查 / 核准者：{changeRequest.approver?.name ?? '尚未指定'}
                </div>
                {getAllowedChangeRequestTransitions(changeRequest.status).length > 0 ? (
                  <form
                    action={transitionChangeRequestForm}
                    className="mt-4 grid gap-3 rounded-[18px] border border-[rgba(73,52,27,0.1)] bg-[rgba(255,255,255,0.48)] p-4"
                  >
                    <input type="hidden" name="changeRequestId" value={changeRequest.id} />
                    {getAllowedChangeRequestTransitions(changeRequest.status).some(
                      (status) =>
                        status === ChangeRequestStatus.Approved ||
                        status === ChangeRequestStatus.Rejected,
                    ) ? (
                      <select name="actedById" defaultValue="" style={baseInputStyle}>
                        <option value="">選擇審查 / 核准者</option>
                        {approverOptions.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} · {formatRole(user.role)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {getAllowedChangeRequestTransitions(changeRequest.status).map((status) => (
                        <button
                          key={status}
                          type="submit"
                          name="nextStatus"
                          value={status}
                          className="rounded-full border border-[var(--app-border)] bg-white/80 px-4 py-2 font-bold text-[var(--app-primary-strong)] transition hover:-translate-y-0.5 hover:bg-white"
                        >
                          轉為{formatChangeRequestStatus(status)}
                        </button>
                      ))}
                    </div>
                  </form>
                ) : null}
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
