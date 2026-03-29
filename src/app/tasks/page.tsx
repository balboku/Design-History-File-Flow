import { AppShell, EmptyPanel, SectionCard, StatusPill } from '@/components/app-shell'
import { getTaskBoardData } from '@/lib/frontend-data'

export default async function TasksPage() {
  const tasks = await getTaskBoardData()

  return (
    <AppShell
      eyebrow="Execution Board"
      title="Tasks"
      description="A cross-project view of engineering execution, showing which work is ahead of the formal phase and which deliverables are still blocking completion."
    >
      <SectionCard
        title="Task Stream"
        subtitle="Planned phase versus current project phase is visible here to support work-at-risk without hiding it."
      >
        {tasks.length === 0 ? (
          <EmptyPanel title="No tasks yet" body="Create tasks from a project detail page to populate the execution board." />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {tasks.map((task) => {
              const missingFiles = task.deliverableLinks.filter(
                (link) => link.deliverable.fileRevisions.length === 0,
              ).length

              return (
                <div
                  key={task.id}
                  style={{
                    borderRadius: 22,
                    padding: 18,
                    background: 'rgba(255,248,239,0.72)',
                    border: '1px solid rgba(73, 52, 27, 0.12)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#896945', fontSize: 12 }}>
                        {task.project.code} · {task.code}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{task.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <StatusPill
                        label={task.status}
                        tone={
                          task.status === 'Done'
                            ? 'good'
                            : task.status === 'InProgress'
                              ? 'warn'
                              : 'neutral'
                        }
                      />
                      <StatusPill
                        label={`Planned ${task.plannedPhase}`}
                        tone={
                          task.plannedPhase !== task.project.currentPhase ? 'warn' : 'neutral'
                        }
                      />
                      <StatusPill
                        label={`${missingFiles} deliverables missing files`}
                        tone={missingFiles > 0 ? 'critical' : 'good'}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10, color: '#5d4a31' }}>
                    Project phase: {task.project.currentPhase} · Assignee:{' '}
                    {task.assignee?.name ?? 'Unassigned'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </AppShell>
  )
}
