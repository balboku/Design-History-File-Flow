import { AppShell, EmptyPanel, SectionCard, StatusPill } from '@/components/app-shell'
import { getPhaseGateBoardData } from '@/lib/frontend-data'

export default async function PhaseGatesPage() {
  const items = await getPhaseGateBoardData()

  return (
    <AppShell
      eyebrow="Gate Review"
      title="Phase Gates"
      description="See which projects can advance cleanly, which ones need exceptions, and which programs are blocked by the final hard gate."
    >
      <SectionCard
        title="Gate Status by Project"
        subtitle="This board shows the same decision posture a PM would need before pushing phase progression."
      >
        {items.length === 0 ? (
          <EmptyPanel title="No projects to evaluate" body="Create projects first, then this board will evaluate each gate." />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {items.map(({ project, gate }) => {
              const canAdvance = 'canAdvance' in gate && gate.canAdvance
              const issueCount = 'issues' in gate ? gate.issues.length : 0
              const isHardGate =
                'canAdvance' in gate && !gate.canAdvance ? gate.isHardGate : false

              return (
                <a
                  key={project.id}
                  href={`/projects/${project.id}`}
                  style={{
                    textDecoration: 'none',
                    color: '#2f2418',
                    borderRadius: 22,
                    padding: 18,
                    background: 'rgba(255,248,239,0.72)',
                    border: '1px solid rgba(73, 52, 27, 0.12)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: '#896945', fontSize: 12 }}>{project.code}</div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{project.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <StatusPill label={project.currentPhase} tone="neutral" />
                      <StatusPill
                        label={
                          canAdvance
                            ? 'Ready to advance'
                            : 'error' in gate
                              ? 'Evaluation error'
                              : isHardGate
                                ? 'Hard gate blocked'
                                : 'Warning / override needed'
                        }
                        tone={
                          canAdvance
                            ? 'good'
                            : 'error' in gate || isHardGate
                              ? 'critical'
                              : 'warn'
                        }
                      />
                      {!canAdvance && !('error' in gate) ? (
                        <StatusPill label={`${issueCount} issue(s)`} tone="neutral" />
                      ) : null}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </SectionCard>
    </AppShell>
  )
}
