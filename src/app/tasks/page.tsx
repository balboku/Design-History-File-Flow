import { AppShell, EmptyPanel, SectionCard, StatusPill } from '@/components/app-shell'
import { getTaskBoardData } from '@/lib/frontend-data'
import { formatProjectPhase, formatTaskStatus } from '@/lib/ui-labels'

export default async function TasksPage() {
  const tasks = await getTaskBoardData()

  return (
    <AppShell
      eyebrow="RD 執行總覽"
      title="開發任務"
      description="跨專案檢視所有研發任務，直接看出哪些工作正在偷跑未來階段，哪些任務仍被文件上傳或 QA 釋出狀態卡住。"
    >
      <SectionCard
        title="任務流"
        subtitle="任務的規劃階段與專案當前階段會並列顯示，支援風險放行，同時不隱藏風險。"
      >
        {tasks.length === 0 ? (
          <EmptyPanel title="尚未建立任務" body="可從專案詳情頁建立第一批任務，這裡就會自動匯總。" />
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
                        label={formatTaskStatus(task.status)}
                        tone={
                          task.status === 'Done'
                            ? 'good'
                            : task.status === 'InProgress'
                              ? 'warn'
                              : 'neutral'
                        }
                      />
                      <StatusPill
                        label={`規劃階段：${formatProjectPhase(task.plannedPhase)}`}
                        tone={
                          task.plannedPhase !== task.project.currentPhase ? 'warn' : 'neutral'
                        }
                      />
                      <StatusPill
                        label={`缺檔文件 ${missingFiles} 項`}
                        tone={missingFiles > 0 ? 'critical' : 'good'}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10, color: '#5d4a31' }}>
                    專案階段：{formatProjectPhase(task.project.currentPhase)} · 指派給：
                    {task.assignee?.name ?? ' 尚未指派'}
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
