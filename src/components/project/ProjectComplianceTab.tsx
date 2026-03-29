"use client";

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DeliverableStatus, ProjectPhase, Role } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { SectionCard, StatusPill, EmptyPanel } from '@/components/app-shell'
import {
  formatDeliverableStatus,
  formatProjectPhase,
  formatChangeRequestStatus,
  formatRole,
} from '@/lib/ui-labels'
import { updateDeliverableStatusAction } from '@/actions/deliverable-actions'

interface FileRevision {
  id: string
  revisionNumber: number
  fileName: string
  fileSizeBytes: number | null
  createdAt: Date
}

interface Deliverable {
  id: string
  code: string
  title: string
  description?: string | null
  status: DeliverableStatus
  phase: ProjectPhase
  owner?: { name?: string } | null
  fileRevisions: FileRevision[]
  pendingItems: { id: string; status: string }[]
}

interface ChangeRequest {
  id: string
  code: string
  title: string
  status: string
  requester?: { name?: string } | null
  deliverableLinks: { deliverable: { code: string } }[]
}

interface Project {
  id: string
  code: string
  deliverables: Deliverable[]
  changeRequests: ChangeRequest[]
}

interface Props {
  project: Project
  lookupUsers: { id: string; name: string; role: Role }[]
}

function formatFileSize(value: number | null) {
  if (!value || value <= 0) return '大小未知'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function ProjectComplianceTab({ project, lookupUsers }: Props) {
  const router = useRouter()
  const qaUsers = lookupUsers.filter((u) => u.role === Role.QA || u.role === Role.ADMIN)

  return (
    <div className="flex flex-col gap-5">
      {/* Deliverables List */}
      <SectionCard
        title="合規文件"
        subtitle="集中管理檔案版次、QA 釋出狀態，以及因條件式放行而留下的風險債務。"
      >
        {project.deliverables.length === 0 ? (
          <EmptyPanel
            title="尚無文件空殼"
            body="先在 Planning 頁籤建立第一份文件。"
          />
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            {project.deliverables.map((deliverable) => (
              <DeliverableCard
                key={deliverable.id}
                deliverable={deliverable}
                projectId={project.id}
                qaUsers={qaUsers}
                changeRequests={project.changeRequests}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Change Requests */}
      <SectionCard
        title="變更單"
        subtitle="設計移轉後的變更控制，每次變更都會留下 Impact Analysis 軌跡。"
      >
        {project.changeRequests.length === 0 ? (
          <EmptyPanel
            title="沒有變更單"
            body="第一張 CR 建立後，設計移轉後的變更控制就會顯示在這裡。"
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {project.changeRequests.map((cr) => (
              <div
                key={cr.id}
                style={{
                  borderRadius: 20,
                  padding: 18,
                  background: 'rgba(255,255,255,0.56)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: '#896945' }}>{cr.code}</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{cr.title}</div>
                  </div>
                  <StatusPill
                    label={formatChangeRequestStatus(cr.status as any)}
                    tone={
                      cr.status === 'Approved' || cr.status === 'Implemented'
                        ? 'good'
                        : cr.status === 'Rejected'
                          ? 'critical'
                          : 'warn'
                    }
                  />
                </div>
                <div style={{ marginTop: 10, color: '#5f4a34' }}>
                  提出者：{cr.requester?.name ?? '未指派'}
                </div>
                <div style={{ marginTop: 6, color: '#5f4a34' }}>
                  關聯文件：
                  {cr.deliverableLinks.length > 0
                    ? cr.deliverableLinks.map((l) => l.deliverable.code).join(', ')
                    : '無'}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

interface DeliverableCardProps {
  deliverable: Deliverable
  projectId: string
  qaUsers: { id: string; name: string; role: Role }[]
  changeRequests: ChangeRequest[]
}

function DeliverableCard({
  deliverable,
  projectId,
  qaUsers,
  changeRequests,
}: DeliverableCardProps) {
  const router = useRouter()
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)

  return (
    <div
      style={{
        borderRadius: 22,
        padding: 18,
        background: 'rgba(255,255,255,0.56)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#896945' }}>{deliverable.code}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{deliverable.title}</div>
          <div style={{ marginTop: 8, color: '#5b452c' }}>
            負責人：{deliverable.owner?.name ?? '未指派'} · 版次：{deliverable.fileRevisions.length} · 關聯遺留項：{deliverable.pendingItems.length}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill
            label={formatDeliverableStatus(deliverable.status)}
            tone={
              deliverable.status === 'Released'
                ? 'good'
                : deliverable.status === 'Locked'
                  ? 'critical'
                  : deliverable.status === 'InReview'
                    ? 'neutral'
                    : 'warn'
            }
          />
          <StatusPill
            label={formatProjectPhase(deliverable.phase)}
            tone="neutral"
          />
        </div>
      </div>

      {/* File Revisions */}
      <div style={{ marginBottom: 14 }}>
        <div style={fieldLabelStyle}>已登記版次</div>
        {deliverable.fileRevisions.length === 0 ? (
          <div
            style={{
              marginTop: 8,
              borderRadius: 18,
              padding: 14,
              background: 'rgba(255,255,255,0.46)',
              color: '#6d5942',
            }}
          >
            尚未上傳任何檔案。
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {deliverable.fileRevisions.map((rev) => (
              <a
                key={rev.id}
                href={`/api/file-revisions/${rev.id}/download`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  borderRadius: 18,
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.66)',
                  textDecoration: 'none',
                  color: '#3d2f1d',
                }}
              >
                <span>
                  r{rev.revisionNumber} · {rev.fileName}
                </span>
                <span style={{ color: '#6a543b', fontSize: 14 }}>
                  {formatFileSize(rev.fileSizeBytes)} ·{' '}
                  {new Intl.DateTimeFormat('zh-TW', {
                    dateStyle: 'medium',
                  }).format(rev.createdAt)}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* File Upload + QA Status Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* File Upload */}
        <form
          action={`/api/projects/${projectId}/deliverables/${deliverable.id}/revisions`}
          method="POST"
          encType="multipart/form-data"
          style={{ display: 'grid', gap: 10 }}
        >
          <div style={fieldLabelStyle}>登記檔案版次</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <input name="file" type="file" style={inputStyle} />
            <input
              name="revisionNumber"
              type="number"
              min="1"
              placeholder="版次號（可選）"
              style={inputStyle}
            />
            <select name="uploadedById" defaultValue="" style={inputStyle}>
              <option value="">上傳者</option>
              {qaUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {formatRole(u.role)}
                </option>
              ))}
            </select>
            <select name="changeRequestId" defaultValue="" style={inputStyle}>
              <option value="">稍後再關聯變更單</option>
              {changeRequests.map((cr) => (
                <option key={cr.id} value={cr.id}>
                  {cr.code} · {cr.title}
                </option>
              ))}
            </select>
          </div>
          <textarea
            name="changeSummary"
            placeholder="此次版更摘要"
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
          />
          <button type="submit" style={buttonStyle}>
            上傳版次
          </button>
          <div
            style={{
              color: '#6c573f',
              lineHeight: 1.5,
              fontSize: 13,
            }}
          >
            若文件已鎖定，必須先關聯變更單，才能上傳新的檔案版次。
          </div>
        </form>

        {/* QA Status Control */}
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={fieldLabelStyle}>QA 狀態控制</div>
          {deliverable.status === DeliverableStatus.Draft ||
          deliverable.status === DeliverableStatus.InReview ? (
            <button
              type="button"
              onClick={() => setStatusDialogOpen(true)}
              style={buttonStyle}
            >
              變更狀態
            </button>
          ) : deliverable.status === DeliverableStatus.Released ? (
            <div style={{ color: '#6c573f', lineHeight: 1.5, fontSize: 13 }}>
              文件已釋出，狀態不可手動變更。如需修改，請透過變更單流程建立新版次。
            </div>
          ) : (
            <div style={{ color: '#6c573f', lineHeight: 1.5, fontSize: 13 }}>
              文件已鎖定。如需修改，需建立變更單並經核准後上傳新版次。
            </div>
          )}
        </div>
      </div>

      {/* QA Status Change Dialog */}
      {statusDialogOpen && (
        <dialog
          open
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.45)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            margin: 0,
            padding: 0,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatusDialogOpen(false)
          }}
        >
          <div
            style={{
              borderRadius: 28,
              padding: 32,
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(242,249,251,0.95))',
              border: '1px solid var(--app-border)',
              boxShadow: '0 32px 80px rgba(3,33,44,0.3)',
              width: '100%',
              maxWidth: 440,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                {deliverable.code} — 變更 QA 狀態
              </h3>
              <button
                type="button"
                onClick={() => setStatusDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#6d5942',
                  padding: '4px 8px',
                  borderRadius: 8,
                }}
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData: FormData) => {
                await updateDeliverableStatusAction({
                  deliverableId: deliverable.id,
                  status: String(formData.get('status') ?? '') as DeliverableStatus,
                  actedById: String(formData.get('actedById') ?? ''),
                  comment: String(formData.get('comment') ?? '') || undefined,
                })
                router.refresh()
              }}
              style={{ display: 'grid', gap: 12 }}
            >
              <select name="actedById" defaultValue="" style={inputStyle} required>
                <option value="">QA 審查 / 核准者</option>
                {qaUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {formatRole(u.role)}
                  </option>
                ))}
              </select>
              <textarea
                name="comment"
                placeholder="審查備註 / 核准說明"
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              />

              {deliverable.status === DeliverableStatus.Draft && (
                <button
                  type="submit"
                  name="status"
                  value={DeliverableStatus.InReview}
                  onClick={() => setStatusDialogOpen(false)}
                  style={buttonStyle}
                >
                  送出審查
                </button>
              )}

              {deliverable.status === DeliverableStatus.InReview && (
                <>
                  <button
                    type="submit"
                    name="status"
                    value={DeliverableStatus.Released}
                    onClick={() => setStatusDialogOpen(false)}
                    style={buttonStyle}
                  >
                    核准釋出
                  </button>
                  <button
                    type="submit"
                    name="status"
                    value={DeliverableStatus.Draft}
                    onClick={() => setStatusDialogOpen(false)}
                    style={secondaryButtonStyle}
                  >
                    退回草稿
                  </button>
                </>
              )}
            </form>
          </div>
        </dialog>
      )}
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(73, 52, 27, 0.18)',
  background: 'rgba(255,255,255,0.76)',
  padding: '14px 16px',
  fontSize: 15,
  color: '#2f2418',
  boxSizing: 'border-box',
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#8c6e4f',
  marginBottom: 6,
}

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#6b4927',
  color: '#fff7ee',
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: 'rgba(255, 248, 239, 0.88)',
  color: '#4d351c',
}
