import type { CSSProperties } from 'react'
import { ProjectPhase } from '@prisma/client'
import { redirect } from 'next/navigation'

import { createProjectAction } from '@/actions/project-actions'
import {
  ActionLink,
  AppShell,
  EmptyPanel,
  MetricCard,
  SectionCard,
  StatusPill,
} from '@/components/app-shell'
import { getProjectSummaries, getWorkspaceLookupData } from '@/lib/frontend-data'
import { formatDateZh, formatProjectPhase, formatRole } from '@/lib/ui-labels'

type SearchParams = Promise<{ notice?: string; error?: string }>

function buildUrl(params: { notice?: string; error?: string }) {
  const search = new URLSearchParams()

  if (params.notice) search.set('notice', params.notice)
  if (params.error) search.set('error', params.error)

  const query = search.toString()
  return query ? `/projects?${query}` : '/projects'
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const [projects, lookup, urlState] = await Promise.all([
    getProjectSummaries(),
    getWorkspaceLookupData(),
    searchParams,
  ])

  async function createProjectForm(formData: FormData) {
    'use server'

    const result = await createProjectAction({
      code: String(formData.get('code') ?? ''),
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      currentPhase: String(formData.get('currentPhase') ?? ProjectPhase.Concept) as ProjectPhase,
      ownerId: String(formData.get('ownerId') ?? '') || undefined,
      targetEndDate: String(formData.get('targetEndDate') ?? '') || null,
    })

    if (result.success) {
      redirect(buildUrl({ notice: `已建立專案 ${result.data.code}` }))
    }

    redirect(buildUrl({ error: result.error }))
  }

  const openPendingProjects = projects.filter((project) => project.openPendingItemCount > 0).length
  const portfolioDoneRate = projects.length
    ? `${projects.reduce((sum, project) => sum + project.doneTaskCount, 0)}/${projects.reduce((sum, project) => sum + project.taskCount, 0)}`
    : '0/0'
  const ownerOptions = lookup.users.filter(
    (user) => user.role === 'PM' || user.role === 'ADMIN',
  )

  return (
    <AppShell
      eyebrow="專案總覽"
      title="專案組合"
      description="從這裡建立新專案、查看每個產品的階段、進度與遺留項，讓專案經理在不犧牲合規軌跡的前提下維持團隊節奏。"
      actions={<ActionLink href="/change-requests" label="查看變更管理" />}
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
            border: `1px solid ${urlState.notice ? 'rgba(72, 131, 82, 0.18)' : 'rgba(149, 58, 52, 0.18)'}`,
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
        <MetricCard label="專案總數" value={String(projects.length)} />
        <MetricCard
          label="有遺留項的專案"
          value={String(openPendingProjects)}
          accent="var(--app-danger)"
        />
        <MetricCard
          label="任務完成總覽"
          value={portfolioDoneRate}
          accent="var(--app-accent)"
        />
        <MetricCard
          label="風險較低專案"
          value={String(projects.length - openPendingProjects)}
          accent="var(--app-success)"
        />
      </div>

      <div
        className="app-grid-2"
        style={{ marginBottom: 18 }}
      >
        <SectionCard
          title="專案卡片"
          subtitle="每張卡片同時顯示研發進度、文件釋出狀態與軟關卡累積的遺留風險。"
        >
          {projects.length === 0 ? (
            <EmptyPanel
              title="尚未建立任何專案"
              body="可從右側表單直接建立第一個受設計管制管理的專案。"
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 18,
              }}
            >
              {projects.map((project) => (
                <a
                  key={project.id}
                  href={`/projects/${project.id}`}
                  style={{
                    textDecoration: 'none',
                    color: '#2f2418',
                    borderRadius: 26,
                    padding: 22,
                    background: 'rgba(255,255,255,0.68)',
                    border: '1px solid rgba(73, 52, 27, 0.12)',
                    boxShadow: '0 18px 40px rgba(57, 37, 16, 0.08)',
                  }}
                >
                  <div style={{ color: '#896945', fontSize: 12, marginBottom: 8 }}>
                    {project.code}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>
                    {project.name}
                  </div>
                  <p style={{ margin: '0 0 14px', lineHeight: 1.55, color: '#5d4a31' }}>
                    {project.description ?? '尚未填寫專案描述。'}
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    <StatusPill label={formatProjectPhase(project.currentPhase)} tone="neutral" />
                    <StatusPill
                      label={`遺留 ${project.openPendingItemCount} 項`}
                      tone={project.openPendingItemCount > 0 ? 'critical' : 'good'}
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                      color: '#4f3e29',
                    }}
                  >
                    <div>
                      任務完成 <strong>{project.doneTaskCount}</strong> / {project.taskCount}
                    </div>
                    <div>
                      文件釋出 <strong>{project.releasedDeliverableCount}</strong> /{' '}
                      {project.deliverableCount}
                    </div>
                    <div>負責人：{project.ownerName ?? '尚未指派'}</div>
                    <div>
                      建立於：{formatDateZh(project.createdAt)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="建立專案"
          subtitle="直接在專案總覽新增受法規控管的產品專案，不必切換頁面。"
          tone="dark"
        >
          <form action={createProjectForm} style={{ display: 'grid', gap: 10 }}>
            <input name="code" placeholder="專案代碼" style={darkInputStyle} />
            <input name="name" placeholder="專案名稱" style={darkInputStyle} />
            <textarea
              name="description"
              placeholder="專案摘要"
              style={{ ...darkInputStyle, minHeight: 100, resize: 'vertical' }}
            />
            <select name="currentPhase" defaultValue={ProjectPhase.Concept} style={darkInputStyle}>
              {Object.values(ProjectPhase).map((phase) => (
                <option key={phase} value={phase}>
                  {formatProjectPhase(phase)}
                </option>
              ))}
            </select>
            <select name="ownerId" defaultValue="" style={darkInputStyle}>
              <option value="">稍後再指派專案經理</option>
              {ownerOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {formatRole(user.role)}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 13, color: 'rgba(255,244,228,0.7)', marginBottom: -4 }}>預計完成日 (targetEndDate)</label>
            <input
              type="date"
              name="targetEndDate"
              style={darkInputStyle}
            />
            <button type="submit" style={lightButtonStyle}>
              建立專案
            </button>
          </form>
        </SectionCard>
      </div>
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
