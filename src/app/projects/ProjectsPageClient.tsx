'use client'

import { useState } from 'react'
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
import { formatDateZh, formatProjectPhase, formatRole } from '@/lib/ui-labels'
import type { Role } from '@prisma/client'

type SearchParams = { notice?: string; error?: string }

interface ProjectSummary {
  id: string
  code: string
  name: string
  description?: string | null
  currentPhase: ProjectPhase
  createdAt: Date
  ownerName?: string | null
  taskCount: number
  doneTaskCount: number
  deliverableCount: number
  releasedDeliverableCount: number
  openPendingItemCount: number
}

interface UserLookup {
  id: string
  name: string
  role: Role
}

function buildUrl(params: { notice?: string; error?: string }) {
  const search = new URLSearchParams()
  if (params.notice) search.set('notice', params.notice)
  if (params.error) search.set('error', params.error)
  const query = search.toString()
  return query ? `/projects?${query}` : '/projects'
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

function CreateProjectDialog({
  isOpen,
  onClose,
  ownerOptions,
}: {
  isOpen: boolean
  onClose: () => void
  ownerOptions: UserLookup[]
}) {
  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const result = await createProjectAction({
      code: String(formData.get('code') ?? ''),
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      currentPhase: String(formData.get('currentPhase') ?? ProjectPhase.Concept) as ProjectPhase,
      ownerId: String(formData.get('ownerId') ?? '') || undefined,
      targetEndDate: String(formData.get('targetEndDate') ?? '') || null,
      templateType: String(formData.get('templateType') ?? 'None') as 'None' | 'Standard' | 'SaMD',
    })

    if (result.success) {
      const tmplNote = result.deliverableCount > 0 ? `，已自動建立 ${result.deliverableCount} 份文件空殼` : ''
      redirect(buildUrl({ notice: `已建立專案 ${result.data.code}${tmplNote}` }))
    }

    redirect(buildUrl({ error: result.error }))
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex h-[100vh] w-[100vw] items-center justify-center m-0 bg-slate-900/50 p-4 sm:p-6 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-[32px] p-7 sm:p-9 text-[#f2fbfc]"
        style={{
          background: 'linear-gradient(135deg, rgba(10,73,90,0.97), rgba(8,58,72,0.95))',
          border: '1px solid rgba(203,241,248,0.12)',
          boxShadow: '0 32px 80px rgba(3,33,44,0.4)',
        }}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="m-0 text-xl font-bold tracking-tight text-[#f2fbfc]">建立新專案</h3>
            <p className="mt-1 mb-0 text-[14px] text-[rgba(218,245,250,0.7)]">直接在專案總覽新增受法規控管的產品專案。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white focus:outline-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
          <input name="code" placeholder="專案代碼" style={darkInputStyle} required />
          <input name="name" placeholder="專案名稱" style={darkInputStyle} required />
          <textarea
            name="description"
            placeholder="專案摘要"
            style={{ ...darkInputStyle, minHeight: 100, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'rgba(255,244,228,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              文件範本（自動建立文件空殼）
            </label>
            <select name="templateType" defaultValue="Standard" style={darkInputStyle}>
              <option value="None">不使用範本（手動建立）</option>
              <option value="Standard">Standard — 硬體&amp;組合器材（8 份）</option>
              <option value="SaMD">SaMD — 醫療軟體 IEC 62304（10 份）</option>
            </select>
            <div style={{ fontSize: 12, color: 'rgba(255,244,228,0.5)', lineHeight: 1.5 }}>
              依選擇範本自動建立對應階段的文件空殼，建立後可自由新增或刪除。
            </div>
          </div>

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
          <label style={{ fontSize: 13, color: 'rgba(255,244,228,0.7)', marginBottom: -4 }}>預計完成日</label>
          <input type="date" name="targetEndDate" style={darkInputStyle} />
          <button type="submit" style={lightButtonStyle}>
            建立專案
          </button>
        </form>
      </div>
    </dialog>
  )
}

export function ProjectsPageClient({
  projects,
  urlState,
  ownerOptions,
  portfolioDoneRate,
  openPendingProjects,
}: {
  projects: ProjectSummary[]
  urlState: SearchParams
  ownerOptions: UserLookup[]
  portfolioDoneRate: string
  openPendingProjects: number
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <CreateProjectDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        ownerOptions={ownerOptions}
      />

      <AppShell
        eyebrow="專案總覽"
        title="專案組合"
        description="從這裡建立新專案、查看每個產品的階段、進度與遺留項，讓專案經理在不犧牲合規軌跡的前提下維持團隊節奏。"
        actions={
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              建立新專案
            </button>
            <ActionLink href="/change-requests" label="查看變更管理" />
          </div>
        }
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

        <SectionCard
          title="專案卡片"
          subtitle="每張卡片同時顯示研發進度、文件釋出狀態與軟關卡累積的遺留風險。"
        >
          {projects.length === 0 ? (
            <EmptyPanel
              title="尚未建立任何專案"
              body="點擊「建立新專案」按鈕開始建立受設計管制管理的專案。"
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
      </AppShell>
    </>
  )
}
