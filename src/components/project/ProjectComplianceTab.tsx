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
  const currentUserRole = lookupUsers[0]?.role // 現實中應從 session 獲取
  const qaUsers = lookupUsers.filter((u) => u.role === Role.QA || u.role === Role.ADMIN)
  const canRelease = currentUserRole === Role.QA || currentUserRole === Role.ADMIN

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-6">
      {/* Deliverables List */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
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
            <div className="flex flex-col gap-6">
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
      </div>

      {/* Change Requests */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
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
            <div className="flex flex-col gap-3">
              {project.changeRequests.map((cr) => (
                <div
                  key={cr.id}
                  className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
                        {cr.code}
                      </span>
                      <h4 className="mt-1 m-0 text-lg font-bold tracking-tight text-slate-800">
                        {cr.title}
                      </h4>
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
                  <div className="mt-3 text-[13px] font-medium text-slate-500">
                    提出者：{cr.requester?.name ?? '未指派'}
                  </div>
                  <div className="mt-1 text-[13px] font-medium text-slate-500">
                    關聯文件：
                    <span className="text-slate-700 mx-1">
                      {cr.deliverableLinks.length > 0
                        ? cr.deliverableLinks.map((l) => l.deliverable.code).join(', ')
                        : '無'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
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

  // Soft UI Input Styles
  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-[14px] font-medium text-slate-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"

  return (
    <div className="flex flex-col rounded-[24px] border border-slate-200/60 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{deliverable.code}</div>
            <h3 className="m-0 mt-1 text-2xl font-bold tracking-tight text-slate-800">{deliverable.title}</h3>
            <div className="mt-2 text-[14px] font-medium text-slate-500 flex flex-wrap items-center gap-2">
              <span>負責人：{deliverable.owner?.name ?? '未指派'}</span>
              <span className="text-slate-300">|</span>
              <span>版次：{deliverable.fileRevisions.length}</span>
              <span className="text-slate-300">|</span>
              <span className={deliverable.pendingItems.length > 0 ? "text-orange-600 font-bold" : ""}>關聯遺留項：{deliverable.pendingItems.length}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill
              label={formatDeliverableStatus(deliverable.status)}
              tone={
                deliverable.status === 'Released'
                  ? 'neutral' 
                  : deliverable.status === 'Locked'
                    ? 'critical'
                    : deliverable.status === 'InReview'
                      ? 'warn'
                      : 'neutral'
              }
            />
            <StatusPill
              label={formatProjectPhase(deliverable.phase)}
              tone="neutral"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 p-6 gap-8">
        {/* Left Col: File Revisions & Upload Form */}
        <div className="flex flex-col gap-6">
          {/* File Revisions */}
          <div>
            <div className="mb-3 text-[12px] font-bold tracking-[0.12em] uppercase text-slate-400">已登記檔案 (依版次遞增)</div>
            {deliverable.fileRevisions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm font-medium text-slate-500 text-center">
                尚未上傳任何檔案。
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {deliverable.fileRevisions.map((rev) => (
                  <a
                    key={rev.id}
                    href={`/api/file-revisions/${rev.id}/download`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white p-3.5 text-slate-800 text-decoration-none shadow-sm transition-all hover:border-blue-200 hover:shadow-md hover:bg-blue-50/20"
                  >
                    <span className="font-bold text-[14px]">
                      r{rev.revisionNumber} · <span className="text-blue-600 hover:underline">{rev.fileName}</span>
                    </span>
                    <span className="text-[13px] font-medium text-slate-500">
                      {formatFileSize(rev.fileSizeBytes)} ·{' '}
                      {new Intl.DateTimeFormat('zh-TW', {
                        dateStyle: 'medium',
                      }).format(rev.createdAt)}
                    </span>
                  </a>
                ))}
              </div>
            )}
            
            {(deliverable.status === DeliverableStatus.Draft || deliverable.status === DeliverableStatus.InReview) && deliverable.fileRevisions.length > 0 && (
              <p className="mt-3 text-[13px] text-slate-500 leading-relaxed border-l-2 border-slate-300 pl-3">
                * DHF 文件具有不可竄改性，已登記的檔案只能供下載。若要修改內容，請直接在下方<strong className="text-slate-700">選擇新檔案並上傳新版次</strong>，系統會自動遞增追蹤版本號。
              </p>
            )}
          </div>

          <hr className="border-t border-slate-100" />

          {/* File Upload Form */}
          <form
            action={`/api/projects/${projectId}/deliverables/${deliverable.id}/revisions`}
            method="POST"
            encType="multipart/form-data"
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-slate-400">上傳新檔案 / 新版次</div>
            </div>

            {/* Styled File Input Container */}
            <div className="grid grid-cols-1 gap-3">
              <div className="relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-5 hover:bg-slate-100 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                <div className="text-center px-4">
                  <span className="text-[14px] font-bold text-slate-600 border px-3 py-1.5 rounded-lg bg-white shadow-sm inline-block mb-1">點擊選擇檔案上傳</span>
                </div>
                {/* opacity-0 makes the native ugly button invisible, but absolute inset-0 stretches it so clicking anywhere triggers it */}
                <input 
                  name="file" 
                  type="file" 
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0" 
                  title="選擇檔案以建立新版次"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <input
                  name="revisionNumber"
                  type="number"
                  min="1"
                  placeholder="自訂版次號 (預設為自動遞增)"
                  className={inputClass}
                />
                <select name="uploadedById" defaultValue="" className={inputClass} required>
                  <option value="" disabled>選擇上傳者身份</option>
                  {qaUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({formatRole(u.role)})
                    </option>
                  ))}
                </select>
              </div>

              {(deliverable.status === DeliverableStatus.Released || deliverable.status === DeliverableStatus.Locked) && (
                <div className="flex flex-col gap-2 mt-2">
                   <div className="text-[13px] font-bold text-orange-600 bg-orange-50 p-3 rounded-xl border border-orange-100">
                     文件已鎖定或釋出。必須先關聯變更單 (Change Request)，才能發布新的版次。
                   </div>
                  <select name="changeRequestId" defaultValue="" className={inputClass} required>
                    <option value="" disabled>必須選擇關聯的變更單</option>
                    {changeRequests.map((cr) => (
                      <option key={cr.id} value={cr.id}>
                        {cr.code} · {cr.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <textarea
                name="changeSummary"
                placeholder="此次上傳/版更的備註說明..."
                className={`${inputClass} min-h-[80px] resize-y`}
              />
              <button 
                type="submit" 
                className="mt-1 w-full rounded-xl bg-slate-800 px-5 py-3.5 text-[15px] font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                確認登記新版次
              </button>
            </div>
          </form>
        </div>

        {/* Right Col: QA Status Control */}
        <div className="flex flex-col gap-3 border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-8">
          <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-slate-400 mb-2">QA 狀態流轉控制</div>
          
          <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-5">
            <h4 className="m-0 text-[15px] font-bold text-slate-800 mb-4">目前狀態：{formatDeliverableStatus(deliverable.status)}</h4>
            
            {deliverable.status === DeliverableStatus.Draft ||
            deliverable.status === DeliverableStatus.InReview ? (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-[13px] text-slate-500 mb-2">
                  檔案版次已上傳就緒後，請將狀態推進為「審查中」，核准後方可「正式釋出」。
                </p>
                <button
                  type="button"
                  onClick={() => setStatusDialogOpen(true)}
                  className="w-full rounded-xl bg-slate-200 px-5 py-3.5 text-[14px] font-bold text-slate-700 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                >
                  展開狀態控制面板
                </button>
              </div>
            ) : deliverable.status === DeliverableStatus.Released ? (
              <div className="text-[13px] text-slate-500 leading-relaxed">
                文件已由 QA 簽署並<strong className="text-slate-700">正式釋出</strong>，狀態不可任意退回草稿。若因規格更動需重新修改文件，必須透過變更流程重新上傳新檔案。
              </div>
            ) : (
              <div className="text-[13px] text-slate-500 leading-relaxed">
                文件已鎖定 (Locked)。如需修改，需先建立變更單 (Change Request)，方可上傳新版次進行解鎖。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QA Status Change Dialog */}
      {statusDialogOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex h-[100vh] w-[100vw] items-center justify-center m-0 bg-slate-900/40 p-4 sm:p-6 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatusDialogOpen(false)
          }}
        >
          <div className="relative w-full max-w-[480px] rounded-[32px] bg-white p-7 sm:p-9 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="m-0 text-xl font-bold tracking-tight text-slate-900">
                  {deliverable.code}
                </h3>
                <p className="mt-1 mb-0 text-slate-500 text-[15px] font-medium">調整合規文件的生命週期狀態。</p>
              </div>
              <button
                type="button"
                onClick={() => setStatusDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 focus:outline-none"
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
                setStatusDialogOpen(false)
              }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-slate-700">操作專員</label>
                <select name="actedById" defaultValue="" className={inputClass} required>
                  <option value="" disabled>請選擇審核者帳號</option>
                  {qaUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({formatRole(u.role)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-bold text-slate-700">操作備註 (選填)</label>
                <textarea
                  name="comment"
                  placeholder="送審理由或退回備註..."
                  className={`${inputClass} min-h-[90px] resize-y`}
                />
              </div>

              <div className="mt-2 grid grid-cols-1 gap-3">
                {deliverable.status === DeliverableStatus.Draft && (
                  <button
                    type="submit"
                    name="status"
                    value={DeliverableStatus.InReview}
                    className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-[15px] font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none"
                  >
                    送出進入審查 (In Review)
                  </button>
                )}

                {deliverable.status === DeliverableStatus.InReview && (
                  <>
                    <button
                      type="submit"
                      name="status"
                      value={DeliverableStatus.Released}
                      disabled={!canRelease}
                      title={!canRelease ? '只有 QA 或 ADMIN 角色可以釋出文件' : '簽署並正式釋出'}
                      className={`w-full rounded-xl px-5 py-3.5 text-[15px] font-bold shadow-md transition-all focus:outline-none ${
                        canRelease
                          ? 'bg-slate-800 text-white hover:-translate-y-0.5 hover:bg-slate-700'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                      }`}
                    >
                      簽署並正式釋出 (Release)
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value={DeliverableStatus.Draft}
                      className="w-full rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[15px] font-bold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none"
                    >
                      退回草稿重修 (Draft)
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </dialog>
      )}
    </div>
  )
}
