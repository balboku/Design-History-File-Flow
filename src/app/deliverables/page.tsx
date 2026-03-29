import { AppShell, EmptyPanel, SectionCard, StatusPill } from '@/components/app-shell'
import { getDeliverableBoardData } from '@/lib/frontend-data'

function formatFileSize(value: number | null) {
  if (!value || value <= 0) {
    return 'Unknown size'
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
      eyebrow="Compliance Outputs"
      title="Deliverables"
      description="Track the placeholder outputs that prove regulated work happened: file coverage, current status, linked tasks, and carryover risk."
    >
      <SectionCard
        title="Deliverable Registry"
        subtitle="Each row shows whether evidence exists, whether QA has released it, and whether it still anchors a pending item."
      >
        {deliverables.length === 0 ? (
          <EmptyPanel title="No deliverables yet" body="Create deliverable placeholders in the database to populate this registry." />
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
                      label={deliverable.status}
                      tone={
                        deliverable.status === 'Released'
                          ? 'good'
                          : deliverable.status === 'Locked'
                            ? 'critical'
                            : 'warn'
                      }
                    />
                    <StatusPill label={deliverable.phase} tone="neutral" />
                    <StatusPill
                      label={`${deliverable.pendingItems.length} pending`}
                      tone={deliverable.pendingItems.length > 0 ? 'critical' : 'good'}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 10, color: '#5d4a31' }}>
                  Revisions: {deliverable.fileRevisions.length} · Linked tasks:{' '}
                  {deliverable.taskLinks.length} · Owner: {deliverable.owner?.name ?? 'Unassigned'}
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
                    Download latest revision · r{deliverable.fileRevisions[0].revisionNumber} ·{' '}
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
