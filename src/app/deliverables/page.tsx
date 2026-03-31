import { AppShell, EmptyPanel, SectionCard, StatusPill } from '@/components/app-shell'
import { getDeliverableBoardData } from '@/lib/frontend-data'
import {
  formatDeliverableStatus,
  formatProjectPhase,
} from '@/lib/ui-labels'

function formatFileSize(value: number | null) {
  if (!value || value <= 0) {
    return '大小未知'
  }

  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export default async function DeliverablesPage() {
  const deliverables = await getDeliverableBoardData()

  return (
    <AppShell
      eyebrow="合規文件總覽"
      title="文件空殼總覽"
      description="集中查看每個文件空殼的狀態、上傳版次、綁定任務與遺留項，讓品保與專案經理能快速掌握證據是否齊全。"
    >
      <SectionCard
        title="文件註冊表"
        subtitle="每一列都會顯示文件是否已有版次、是否已釋出，以及是否仍掛著遺留項。"
      >
        {deliverables.length === 0 ? (
          <EmptyPanel title="尚未建立文件空殼" body="可先到專案頁建立文件空殼，這裡會自動匯總。" />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {deliverables.map((deliverable) => (
              <div
                key={deliverable.id}
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
                      {deliverable.project.code} · {deliverable.code}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{deliverable.title}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <StatusPill
                      label={formatDeliverableStatus(deliverable.status)}
                      tone={
                        deliverable.status === 'Released'
                          ? 'good'
                          : deliverable.status === 'Locked'
                            ? 'critical'
                            : 'warn'
                      }
                    />
                    <StatusPill label={formatProjectPhase(deliverable.phase)} tone="neutral" />
                    <StatusPill
                      label={`遺留 ${deliverable.pendingItems.length} 項`}
                      tone={deliverable.pendingItems.length > 0 ? 'critical' : 'good'}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 10, color: '#5d4a31' }}>
                  版次：{deliverable.fileRevisions.length} · 綁定任務：
                  {deliverable.taskLinks.length} · 品保負責：
                  {deliverable.owner?.name ?? '尚未指派'}
                </div>
                {deliverable.fileRevisions[0] ? (
                  <a
                    href={`/api/file-revisions/${deliverable.fileRevisions[0].id}/download`}
                    style={{
                      display: 'inline-flex',
                      marginTop: 12,
                      color: '#5a4329',
                      textDecoration: 'none',
                      fontWeight: 700,
                    }}
                  >
                    下載最新版 · r{deliverable.fileRevisions[0].revisionNumber} ·{' '}
                    {formatFileSize(deliverable.fileRevisions[0].fileSizeBytes)}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </AppShell>
  )
}
