'use client'

import { useState } from 'react'
import { DeliverableStatus, ChangeRequestStatus, Role } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { updateDeliverableStatusAction } from '@/actions/deliverable-actions'
import { transitionChangeRequestAction } from '@/actions/change-request-actions'
import { formatDateTimeZh } from '@/lib/ui-labels'
import { SectionCard } from '@/components/app-shell'
import type { ReviewInboxData } from '@/lib/review-inbox-service'

interface Props {
  inboxData: ReviewInboxData
  currentUser: { id: string; name: string; role: Role }
}

export function ReviewInbox({ inboxData, currentUser }: Props) {
  const router = useRouter()
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set())

  // Only QA and ADMIN should see this section
  if (currentUser.role !== Role.QA && currentUser.role !== Role.ADMIN) {
    return null
  }

  const handleDeliverableAction = async (id: string, deliverableId: string, projectId: string, nextStatus: DeliverableStatus) => {
    setSubmittingIds((prev) => new Set(prev).add(id))
    try {
      await updateDeliverableStatusAction({
        deliverableId,
        status: nextStatus,
        actedById: currentUser.id,
      })
      router.refresh()
    } finally {
      // Allow visual completion before removing loading state
      setTimeout(() => {
        setSubmittingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 500)
    }
  }

  const handleChangeRequestAction = async (id: string, nextStatus: ChangeRequestStatus) => {
    setSubmittingIds((prev) => new Set(prev).add(id))
    try {
      await transitionChangeRequestAction({
        changeRequestId: id,
        nextStatus,
        actedById: currentUser.id,
      })
      router.refresh()
    } finally {
      setTimeout(() => {
        setSubmittingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 500)
    }
  }

  const totalPending = inboxData.deliverables.length + inboxData.changeRequests.length

  if (totalPending === 0) {
    return (
      <SectionCard title="待辦審核收件匣" subtitle="目前沒有需要品保或法規審批的項目。">
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-[14px] font-medium text-slate-400">
          無待辦審核項目
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="待辦審核收件匣"
      subtitle={`共有 ${totalPending} 件需要品保審查的專案合規任務。您可以直接在此一鍵放行或退回。`}
      tone="dark"
    >
      <div className="flex flex-col gap-4">
        {/* Deliverables */}
        {inboxData.deliverables.map((d) => {
          const isSubmitting = submittingIds.has(d.id)
          return (
            <div key={d.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200/20 bg-white/5 p-5 backdrop-blur-sm transition-all hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[11px] font-bold tracking-widest text-blue-200 uppercase">
                    文件審查
                  </span>
                  <span className="text-[12px] text-slate-400">
                    {d.projectCode} · {d.code}
                  </span>
                </div>
                <h4 className="m-0 text-[16px] font-bold text-white mb-1">
                  {d.title}
                </h4>
                <div className="flex items-center gap-2 text-[13px] text-slate-300">
                  {d.latestRevisionFileName ? (
                    <a
                      href={`/api/projects/${d.projectId}/deliverables/${d.id}/revisions/${d.latestRevisionId}/download`}
                      className="inline-flex items-center gap-1 font-medium text-blue-300 hover:text-blue-200 hover:underline"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      下載版次預覽
                    </a>
                  ) : (
                    <span className="text-slate-500">無檔案可預覽</span>
                  )}
                  {d.submittedAt && (
                    <span className="hidden sm:inline">· {formatDateTimeZh(d.submittedAt)} 送審</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeliverableAction(d.id, d.id, d.projectId, DeliverableStatus.Draft)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-[13px] font-bold text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors"
                >
                  退回草稿
                </button>
                <button
                  onClick={() => handleDeliverableAction(d.id, d.id, d.projectId, DeliverableStatus.Released)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-[13px] font-bold text-emerald-900 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? '處理中' : '核准釋出'}
                </button>
              </div>
            </div>
          )
        })}

        {/* Change Requests */}
        {inboxData.changeRequests.map((cr) => {
          const isSubmitting = submittingIds.has(cr.id)
          return (
            <div key={cr.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200/20 bg-amber-500/5 p-5 backdrop-blur-sm transition-all hover:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold tracking-widest text-amber-300 uppercase">
                    變更單簽核
                  </span>
                  <span className="text-[12px] text-slate-400">
                    {cr.projectCode ?? '跨專案'} · {cr.code}
                  </span>
                </div>
                <h4 className="m-0 text-[16px] font-bold text-white mb-2">
                  {cr.title}
                </h4>
                <div className="text-[13px] text-slate-300 line-clamp-1 mb-1">
                  <span className="font-bold text-slate-400 mr-2">影響摘要</span>
                  {cr.impactSummary ?? '未填寫摘要'}
                </div>
                <div className="text-[12px] text-slate-400">
                  {cr.requesterName} 提出
                  {cr.submittedAt && ` · ${formatDateTimeZh(cr.submittedAt)} 送審`}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleChangeRequestAction(cr.id, ChangeRequestStatus.Rejected)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-[13px] font-bold text-slate-300 border border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-colors"
                >
                  駁回變更
                </button>
                <button
                  onClick={() => handleChangeRequestAction(cr.id, ChangeRequestStatus.Approved)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-[13px] font-bold text-emerald-900 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? '處理中' : '審核通過'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
