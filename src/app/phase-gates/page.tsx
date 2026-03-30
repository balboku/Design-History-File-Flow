import { AppShell, EmptyPanel, SectionCard, StatusPill } from '@/components/app-shell'
import { getPhaseGateBoardData } from '@/lib/frontend-data'
import { formatProjectPhase } from '@/lib/ui-labels'

export default async function PhaseGatesPage() {
  const items = await getPhaseGateBoardData()

  return (
    <AppShell
      eyebrow="階段關卡"
      title="階段關卡盤點"
      description="快速找出哪些專案可正常推進、哪些需要條件式放行，以及哪些專案已被最終硬關卡擋下。"
    >
      <SectionCard
        title="各專案關卡狀態"
        subtitle="各專案當前階段的推進準備度與風險評估狀態。"
      >
        {items.length === 0 ? (
          <EmptyPanel title="目前沒有可評估的專案" body="建立專案後，系統就會自動計算每個階段關卡狀態。" />
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
                      <StatusPill label={formatProjectPhase(project.currentPhase)} tone="neutral" />
                      <StatusPill
                        label={
                          canAdvance
                            ? '可直接推進'
                            : 'error' in gate
                              ? '評估失敗'
                              : isHardGate
                                ? '硬關卡阻擋'
                                : '需警示 / 可條件放行'
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
                        <StatusPill label={`問題 ${issueCount} 項`} tone="neutral" />
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
