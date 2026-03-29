import type { CSSProperties } from 'react'
import { ActionLink, AppShell, MetricCard, SectionCard, StatusPill } from '@/components/app-shell'
import { getAppDashboardData, getProjectSummaries } from '@/lib/frontend-data'
import { formatDateTimeZh, formatProjectPhase } from '@/lib/ui-labels'

export default async function HomePage() {
  const [dashboard, projects] = await Promise.all([
    getAppDashboardData(),
    getProjectSummaries(),
  ])

  const highlightedProjects = projects.slice(0, 3)

  return (
    <AppShell
      eyebrow="醫療器材研發管理平台"
      title="讓研發偷跑有軌跡，讓合規放行有依據"
      description="依照 `ui-ux-pro-max` 技能給出的醫療與企業儀表板建議，首頁改成偏信任感、資料密度與無障礙導向的控制台。你可以在同一個介面追蹤開發任務、文件版次、階段關卡、條件式放行與變更管理。"
      actions={<ActionLink href="/projects" label="進入專案總覽" />}
    >
      <div className="app-grid-4" style={{ marginBottom: 22 }}>
        <MetricCard
          label="專案數"
          value={String(dashboard.counts.projectCount)}
          hint="目前納管中的醫療器材研發專案"
        />
        <MetricCard
          label="進行中任務"
          value={String(dashboard.counts.activeTaskCount)}
          hint="待開始與執行中的 RD 任務"
          accent="var(--app-accent)"
        />
        <MetricCard
          label="已發行文件"
          value={String(dashboard.counts.releasedDeliverableCount)}
          hint="已由 QA / 法規完成釋出的文件"
          accent="var(--app-success)"
        />
        <MetricCard
          label="未結遺留項"
          value={String(dashboard.counts.openPendingItemCount)}
          hint="條件式放行後仍需補齊的 action items"
          accent="var(--app-danger)"
        />
      </div>

      <div className="app-grid-2" style={{ marginBottom: 20 }}>
        <SectionCard
          title="推薦介面方向"
          subtitle="根據技能搜尋結果，我採用『信任與權威（Trust & Authority）＋高資訊密度儀表板（Data-Dense Dashboard）＋包容式設計（Inclusive Design）』的混合風格來重塑這套產品。"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={calloutStyle}>
              <strong>視覺語言：</strong> 醫療級藍綠 + 企業級高對比卡片，降低焦慮感，同時保留審查嚴謹度。
            </div>
            <div style={calloutStyle}>
              <strong>資訊結構：</strong> 把「當前階段」「遺留項」「已發行文件」「變更單」放在首頁第一層，符合專案與品質團隊的判讀順序。
            </div>
            <div style={calloutStyle}>
              <strong>無障礙：</strong> 加入 skip link、顯著 focus 樣式、行動優先格線與一致的狀態色票。
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="快速入口"
          subtitle="用最少點擊進入最常用的工作面。"
          tone="dark"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <ActionLink href="/tasks" label="查看開發任務" />
            <ActionLink href="/deliverables" label="查看合規文件" tone="secondary" />
            <ActionLink href="/phase-gates" label="查看階段關卡" tone="secondary" />
            <ActionLink href="/change-requests" label="查看變更管理" tone="secondary" />
            <ActionLink href="/pending-items" label="查看遺留項" tone="secondary" />
          </div>
        </SectionCard>
      </div>

      <div className="app-grid-2" style={{ marginBottom: 22 }}>
        <SectionCard
          title="重點專案"
          subtitle="最近最活躍的專案會顯示在這裡，方便專案經理快速辨識風險與進度。"
        >
          <div style={{ display: 'grid', gap: 14 }}>
            {highlightedProjects.map((project) => (
              <a
                key={project.id}
                href={`/projects/${project.id}`}
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: 'rgba(255,255,255,0.78)',
                  border: '1px solid var(--app-border)',
                  textDecoration: 'none',
                  color: 'var(--app-text)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--app-text-soft)', marginBottom: 6 }}>
                      {project.code}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{project.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusPill label={formatProjectPhase(project.currentPhase)} tone="neutral" />
                    <StatusPill
                      label={`未結遺留 ${project.openPendingItemCount} 項`}
                      tone={project.openPendingItemCount > 0 ? 'critical' : 'good'}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 10,
                    color: 'var(--app-text-soft)',
                    lineHeight: 1.6,
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
                </div>
              </a>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="最近階段異動"
          subtitle="最後六筆階段推進與條件式放行紀錄，方便法規與專案雙方交叉檢視。"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            {dashboard.recentTransitions.map((transition) => (
              <div
                key={transition.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 14,
                  alignItems: 'center',
                  borderRadius: 20,
                  padding: 16,
                  background: 'rgba(255,255,255,0.72)',
                  border: '1px solid var(--app-border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {transition.project.code} · {transition.project.name}
                  </div>
                  <div style={{ color: 'var(--app-text-soft)', marginTop: 4 }}>
                    {formatProjectPhase(transition.fromPhase)} →{' '}
                    {formatProjectPhase(transition.toPhase)}
                  </div>
                </div>
                <StatusPill
                  label={transition.overrideDecision ? '條件式放行' : '正常推進'}
                  tone={transition.overrideDecision ? 'warn' : 'good'}
                />
                <div style={{ color: 'var(--app-text-soft)', fontSize: 13 }}>
                  {formatDateTimeZh(transition.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  )
}

const calloutStyle = {
  borderRadius: 18,
  padding: 16,
  background: 'rgba(255,255,255,0.76)',
  border: '1px solid var(--app-border)',
  lineHeight: 1.7,
  color: 'var(--app-text-soft)',
} satisfies CSSProperties
