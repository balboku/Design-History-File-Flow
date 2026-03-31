import { Role } from '@prisma/client'
import { ActionLink, AppShell, MetricCard, SectionCard, StatusPill } from '@/components/app-shell'
import { getAppDashboardData, getProjectSummaries, getWorkspaceLookupData } from '@/lib/frontend-data'
import { getReviewInboxData } from '@/lib/review-inbox-service'
import { ReviewInbox } from '@/components/ReviewInbox'
import { formatDateTimeZh, formatProjectPhase } from '@/lib/ui-labels'

export default async function HomePage() {
  const [dashboard, projects, inboxData, lookup] = await Promise.all([
    getAppDashboardData(),
    getProjectSummaries(),
    getReviewInboxData(),
    getWorkspaceLookupData(),
  ])

  // NOTE: Fake current user - get first QA or ADMIN user from lookup
  const qaOrAdminUser = lookup.users.find((u) => u.role === Role.QA || u.role === Role.ADMIN)
  // Fallback to the first user if no QA/ADMIN exists during testing
  const currentUser = qaOrAdminUser ?? lookup.users[0]

  const highlightedProjects = projects.slice(0, 3)

  return (
    <AppShell
      eyebrow="醫療器材研發管理平台"
      title="專案與合規管理總覽"
      description="集中追蹤開發任務、文件版次、階段關卡與變更管理，確保研發流程符合醫療器材品質管理規範。"
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
          hint="待開始與執行中的研發任務"
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

      {currentUser && (
        <ReviewInbox inboxData={inboxData} currentUser={currentUser} />
      )}

      <div className="app-grid-2" style={{ marginBottom: 20 }}>
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
      </div>

      <div className="app-grid-2" style={{ marginBottom: 22 }}>
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
