import { ActionLink, AppShell, MetricCard, SectionCard, StatusPill } from '@/components/app-shell'
import { getAppDashboardData, getProjectSummaries } from '@/lib/frontend-data'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default async function HomePage() {
  const [dashboard, projects] = await Promise.all([
    getAppDashboardData(),
    getProjectSummaries(),
  ])

  const highlightedProjects = projects.slice(0, 3)

  return (
    <AppShell
      eyebrow="Portfolio Command"
      title="Medical Device Program Frontend"
      description="A full MVP cockpit for regulated product development: portfolio visibility, project detail, task traceability, deliverable readiness, phase gates, and pending-item control in one place."
      actions={<ActionLink href="/projects" label="Open Project Portfolio" />}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <MetricCard
          label="Projects"
          value={String(dashboard.counts.projectCount)}
          hint="Programs currently tracked in the system"
        />
        <MetricCard
          label="Active Tasks"
          value={String(dashboard.counts.activeTaskCount)}
          hint="Todo + in-progress execution work"
          accent="#8a4e22"
        />
        <MetricCard
          label="Released Deliverables"
          value={String(dashboard.counts.releasedDeliverableCount)}
          hint="QA-approved outputs ready for trace review"
          accent="#315f3a"
        />
        <MetricCard
          label="Open Pending Items"
          value={String(dashboard.counts.openPendingItemCount)}
          hint="Carryovers created by conditional go decisions"
          accent="#8a2f2c"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 18,
          marginBottom: 20,
        }}
      >
        <SectionCard
          title="Featured Projects"
          subtitle="A quick look at the most recently active programs and whether they are accumulating open risk."
        >
          <div style={{ display: 'grid', gap: 14 }}>
            {highlightedProjects.map((project) => (
              <a
                key={project.id}
                href={`/projects/${project.id}`}
                style={{
                  borderRadius: 22,
                  padding: 18,
                  background: 'rgba(255,255,255,0.62)',
                  border: '1px solid rgba(73, 52, 27, 0.12)',
                  textDecoration: 'none',
                  color: '#2f2418',
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
                    <div style={{ fontSize: 12, color: '#896945', marginBottom: 6 }}>
                      {project.code}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{project.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusPill label={project.currentPhase} tone="neutral" />
                    <StatusPill
                      label={`${project.openPendingItemCount} open pending`}
                      tone={project.openPendingItemCount > 0 ? 'critical' : 'good'}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 10,
                    color: '#5d4a31',
                  }}
                >
                  <div>{project.doneTaskCount}/{project.taskCount} tasks done</div>
                  <div>
                    {project.releasedDeliverableCount}/{project.deliverableCount} deliverables
                    released
                  </div>
                  <div>Owner: {project.ownerName ?? 'Unassigned'}</div>
                </div>
              </a>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Quick Access"
          subtitle="Jump directly into the main workflow surfaces."
          tone="dark"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <ActionLink href="/tasks" label="Review Task Execution" />
            <ActionLink href="/deliverables" label="Inspect Deliverables" tone="secondary" />
            <ActionLink href="/phase-gates" label="Open Phase Gates" tone="secondary" />
            <ActionLink href="/change-requests" label="Review Change Requests" tone="secondary" />
            <ActionLink href="/pending-items" label="Control Pending Items" tone="secondary" />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Recent Phase Transitions"
        subtitle="Latest promoted phases and override history for compliance review."
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
                background: 'rgba(255,255,255,0.52)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>
                  {transition.project.code} · {transition.project.name}
                </div>
                <div style={{ color: '#63503a', marginTop: 4 }}>
                  {transition.fromPhase} → {transition.toPhase}
                </div>
              </div>
              <StatusPill
                label={transition.wasOverride ? 'Override' : 'Normal Advance'}
                tone={transition.wasOverride ? 'warn' : 'good'}
              />
              <div style={{ color: '#7b6142', fontSize: 13 }}>
                {formatDate(transition.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  )
}
