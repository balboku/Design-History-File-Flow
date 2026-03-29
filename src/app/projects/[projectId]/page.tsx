import type { CSSProperties } from 'react'
import { ProjectPhase } from '@prisma/client'
import Link from 'next/link'

import {
  ActionLink,
  AppShell,
  EmptyPanel,
} from '@/components/app-shell'
import { ProjectPlanningTab } from '@/components/project/ProjectPlanningTab'
import { ProjectDashboardTab } from '@/components/project/ProjectDashboardTab'
import { ProjectComplianceTab } from '@/components/project/ProjectComplianceTab'
import { getProjectDetail, getWorkspaceLookupData } from '@/lib/frontend-data'

type Params = Promise<{ projectId: string }>
type SearchParams = Promise<{ tab?: string; notice?: string; error?: string }>

function buildUrl(projectId: string, params: { notice?: string; error?: string; tab?: string }) {
  const search = new URLSearchParams()
  if (params.tab) search.set('tab', params.tab)
  if (params.notice) search.set('notice', params.notice)
  if (params.error) search.set('error', params.error)
  const query = search.toString()
  return query ? `/projects/${projectId}?${query}` : `/projects/${projectId}`
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { projectId } = await params
  const urlState = await searchParams
  const data = await getProjectDetail(projectId)
  const lookup = await getWorkspaceLookupData()

  if (!data) {
    return (
      <AppShell
        eyebrow="專案詳情"
        title="找不到此專案"
        description="系統中不存在你要查看的專案紀錄。"
        actions={<ActionLink href="/projects" label="返回專案總覽" />}
      >
        <EmptyPanel
          title="專案不存在"
          body="請重新確認專案 ID，或回到專案總覽重新選擇。"
        />
      </AppShell>
    )
  }

  const { project, gate } = data
  const activeTab = urlState.tab ?? 'dashboard'

  const tabs = [
    { id: 'planning', label: '規劃', href: buildUrl(projectId, { tab: 'planning' }) },
    { id: 'dashboard', label: '執行監控', href: buildUrl(projectId, { tab: 'dashboard' }) },
    { id: 'compliance', label: 'DHF 合規文件', href: buildUrl(projectId, { tab: 'compliance' }) },
  ]

  return (
    <AppShell
      eyebrow={project.code}
      title={project.name}
      description={
        project.description ??
        '這是專案主工作台，可直接操作階段推進、任務、文件、遺留項與變更單。'
      }
      actions={<ActionLink href="/projects" label="返回專案總覽" tone="secondary" />}
    >
      {/* Notice / Error Banner */}
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

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 22,
          flexWrap: 'wrap',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <Link
              key={tab.id}
              href={tab.href}
              style={{
                borderRadius: 20,
                padding: '12px 22px',
                textDecoration: 'none',
                fontWeight: isActive ? 700 : 500,
                fontSize: 15,
                transition: 'all 0.15s ease',
                background: isActive
                  ? 'linear-gradient(135deg, var(--app-primary), var(--app-primary-strong))'
                  : 'rgba(255,255,255,0.76)',
                color: isActive
                  ? '#f5fbfc'
                  : 'var(--app-primary-strong)',
                border: isActive
                  ? '1px solid rgba(5, 86, 103, 0.2)'
                  : '1px solid var(--app-border)',
                boxShadow: isActive
                  ? '0 14px 30px rgba(11, 99, 120, 0.22)'
                  : '0 4px 12px rgba(8,41,54,0.06)',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'planning' && (
        <ProjectPlanningTab
          project={project}
          lookupUsers={lookup.users}
        />
      )}

      {activeTab === 'dashboard' && (
        <ProjectDashboardTab
          project={project}
          gate={gate}
          lookupUsers={lookup.users}
        />
      )}

      {activeTab === 'compliance' && (
        <ProjectComplianceTab
          project={project}
          lookupUsers={lookup.users}
        />
      )}
    </AppShell>
  )
}
