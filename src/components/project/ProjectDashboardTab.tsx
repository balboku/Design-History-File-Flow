'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ProjectPhase, Role } from '@prisma/client'
import { useRouter } from 'next/navigation'
import {
  MetricCard,
  SectionCard,
  StatusPill,
  EmptyPanel,
} from '@/components/app-shell'
import { ProjectGantt } from '@/components/project-gantt'
import { PHASE_ORDER } from '@/lib/phase-service'
import { advancePhaseAction } from '@/actions/phase-actions'
import { createTaskAction } from '@/actions/task-actions'
import { createDeliverableAction } from '@/actions/deliverable-actions'
import { ComplianceDebtRadar } from '@/components/project/ComplianceDebtRadar'
import { KanbanBoard } from '@/components/project/KanbanBoard'
import type { KanbanTask } from '@/components/project/TaskCard'
import {
  formatProjectPhase,
  formatTaskStatus,
  formatPendingItemStatus,
  formatDateTimeZh,
  formatRole,
} from '@/lib/ui-labels'

interface PhaseGate {
  canAdvance: boolean
  nextPhase?: ProjectPhase
  isHardGate?: boolean
  issues?: {
    deliverableId: string
    deliverableCode: string
    deliverableTitle: string
    reason: string
  }[]
}

interface LookupUser {
  id: string
  name: string
  role: Role
}

interface Transition {
  id: string
  fromPhase: ProjectPhase
  toPhase: ProjectPhase
  createdAt: Date
  overrideDecision?: {
    approver?: { name?: string } | null
    [key: string]: unknown
  } | null
  triggeredBy?: { name?: string } | null
}

interface PendingItem {
  id: string
  title: string
  status: string
  deliverable: { code: string; title: string }
}

interface Task {
  id: string
  code: string
  title: string
  description?: string | null
  status: string
  plannedPhase: ProjectPhase
  assigneeId?: string | null
  plannedStartDate?: Date | string | null
  targetDate?: Date | string | null
  assignee?: { name?: string } | null
  deliverableLinks: { deliverable: { code: string } }[]
}

interface Deliverable {
  id: string
  code: string
  title: string
  status: string
  isRequired?: boolean
  targetDate?: Date | string | null
  fileRevisions?: { id: string }[]
}

interface Project {
  id: string
  code: string
  name: string
  currentPhase: ProjectPhase
  tasks: Task[]
  pendingItems: PendingItem[]
  phaseTransitions: Transition[]
  deliverables: Deliverable[]
}

interface Props {
  project: Project
  gate: PhaseGate | null
  lookupUsers: LookupUser[]
}

export function ProjectDashboardTab({ project, gate, lookupUsers }: Props) {
  const router = useRouter()
  const [gateDialogOpen, setGateDialogOpen] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)
  
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false)
  const [deliverableError, setDeliverableError] = useState<string | null>(null)

  const doneTasks = project.tasks.filter((t) => t.status === 'Done').length
  const atRiskTasks = project.tasks.filter(
    (t) =>
      PHASE_ORDER.indexOf(t.plannedPhase) > PHASE_ORDER.indexOf(project.currentPhase) &&
      t.status !== 'Done',
  ).length
  const openPendingItems = project.pendingItems.filter((i) => i.status === 'Open').length

  const pmUsers = lookupUsers.filter((u) => u.role === Role.PM || u.role === Role.ADMIN)
  const rdUsers = lookupUsers.filter((u) => u.role === Role.RD)
  const qaUsers = lookupUsers.filter((u) => u.role === Role.QA || u.role === Role.ADMIN)

  const kanbanTasks: KanbanTask[] = project.tasks as unknown as KanbanTask[]
  const darkInputClass = "w-full rounded-xl border border-white/16 bg-white/10 px-4 py-3 text-[14px] font-medium text-[#fff7ec] placeholder-white/40 transition-colors focus:border-white/40 focus:bg-white/15 focus:outline-none"

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-6">
      {/* 1. Metrics Row (Full Width - Bento Top) */}
      <div className="col-span-12 grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
        <MetricCard label="當前階段" value={formatProjectPhase(project.currentPhase)} />
        <MetricCard
          label="已完成任務"
          value={`${doneTasks}/${project.tasks.length}`}
          accent="var(--app-primary-strong)"
        />
        <MetricCard
          label="At-Risk 任務"
          value={String(atRiskTasks)}
          hint="超前或落後專案當前階段的進行中任務"
          accent={atRiskTasks > 0 ? 'var(--app-danger)' : 'var(--app-text-soft)'}
        />
        <MetricCard label="已釋出文件" value="–" accent="var(--app-primary-strong)" />
        <MetricCard
          label="未結遺留項"
          value={String(openPendingItems)}
          accent={openPendingItems > 0 ? 'var(--app-danger)' : 'var(--app-text-soft)'}
        />
      </div>

      {/* 1b. Compliance Debt Radar */}
      <div className="col-span-12">
        <ComplianceDebtRadar
          deliverables={project.deliverables}
          pendingItems={project.pendingItems}
          currentPhase={project.currentPhase}
          tasks={project.tasks}
          users={lookupUsers}
        />
      </div>

      {/* 2. Primary Middle Row (Gantt Chart 8 Cols + Phase Gate 4 Cols) */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <SectionCard
          title="專案甘特圖"
          subtitle="視覺化檢視開發任務的排程與進度狀態。"
        >
          <ProjectGantt tasks={project.tasks} />
        </SectionCard>
      </div>

      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <SectionCard
          title="階段關卡控制"
          subtitle="優先確認文件與任務，進行正常推進或條件式放行。"
        >
          {gate?.canAdvance ? (
            <div className="flex flex-col h-full rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <StatusPill
                  label={`下一階段準備：${formatProjectPhase(gate.nextPhase!)}`}
                  tone="neutral" // Visual noise reduction: next phase isn't green yet
                />
              </div>
              <p className="mb-6 text-[15px] font-medium text-slate-500 leading-relaxed">
                專案已達標，可正常進入 {formatProjectPhase(gate.nextPhase!)} 階段。
              </p>
              <button
                type="button"
                className="mt-auto w-full rounded-xl bg-slate-800 px-5 py-3.5 text-[15px] font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                onClick={() => setGateDialogOpen(true)}
              >
                推進階段
              </button>
            </div>
          ) : gate ? (
            <div className="flex flex-col h-full rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <StatusPill
                  label={gate.isHardGate ? '硬關卡阻擋' : '軟關卡警示'}
                  tone={gate.isHardGate ? 'critical' : 'warn'}
                />
                <StatusPill
                  label={`問題 ${gate.issues?.length ?? 0} 項`}
                  tone="neutral"
                />
              </div>
              <div className="mb-5 flex flex-col gap-3">
                {gate.issues?.map((issue, i) => (
                  <div
                    key={`${issue.deliverableId}-${i}`}
                    className="flex flex-col rounded-xl border border-slate-200/40 bg-white p-3.5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]"
                  >
                    <div className="text-[13px] font-bold tracking-tight text-slate-800">
                      {issue.deliverableCode}
                    </div>
                    <div className="mt-0.5 text-[14px] font-bold text-slate-600">
                      {issue.deliverableTitle}
                    </div>
                    <div className="mt-2 text-[13px] font-medium leading-relaxed text-slate-500 bg-slate-50 rounded-lg p-2.5">
                      {issue.reason}
                    </div>
                  </div>
                ))}
              </div>
              {!gate.isHardGate ? (
                <button
                  type="button"
                  className="mt-auto w-full rounded-xl bg-orange-50 px-5 py-3.5 text-[15px] font-bold text-orange-700 shadow-sm border border-orange-200/60 transition-all hover:bg-orange-100 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
                  onClick={() => setGateDialogOpen(true)}
                >
                  條件即刻放行
                </button>
              ) : (
                <div className="mt-auto rounded-xl bg-red-50 p-3.5 text-[14px] font-bold text-red-700 border border-red-100">
                  目前為硬關卡，請先補齊所有必須的文件再嘗試推進。
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 text-sm text-slate-500 font-medium">
              儀表板無法結算關卡資訊。
            </div>
          )}
        </SectionCard>
      </div>

      {/* 3. Kanban Board (Full Width Middle Row) */}
      <div className="col-span-12">
        <SectionCard
          title="開發任務看板"
          subtitle="結合規劃與排程。拖曳卡片以更新進度，正式結案前須上傳對應文件。"
        >
          {/* Action Buttons Row */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setTaskDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              建立任務
            </button>
            <button
              type="button"
              onClick={() => setDeliverableDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              新增文件空殼
            </button>
          </div>

          {project.tasks.length === 0 ? (
            <EmptyPanel title="尚無任務" body="點擊「建立任務」開始規劃內容。" />
          ) : (
            <KanbanBoard projectId={project.id} tasks={kanbanTasks} lookupUsers={lookupUsers} />
          )}
        </SectionCard>
      </div>

      {/* 4. Bottom Row: Pending Items (6 cols) & Phase History (6 cols) */}

      <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
        <SectionCard
          title="未結遺留項"
          subtitle="條件式放行後的殘餘風險追蹤"
        >
          {project.pendingItems.length === 0 ? (
            <EmptyPanel title="狀態良好" body="目前沒有任何未結遺留項。" />
          ) : (
            <div className="flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-1">
              {project.pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="m-0 text-[15px] font-bold leading-snug tracking-tight text-slate-800">
                      {item.title}
                    </h4>
                    <span className="shrink-0">
                      <StatusPill
                        label={formatPendingItemStatus(item.status as any)}
                        tone={item.status === 'Resolved' ? 'neutral' : 'critical'} // Noise filter
                      />
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
                      {item.deliverable.code}
                    </span>
                    <span className="truncate">{item.deliverable.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
        <SectionCard
          title="階段異動歷史"
          subtitle="團隊推進決策的稽核軌跡"
        >
          {project.phaseTransitions.length === 0 ? (
            <EmptyPanel
              title="尚無歷史紀錄"
              body="專案尚未完成任何階段轉換。"
            />
          ) : (
            <div className="flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-1">
              {project.phaseTransitions.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[14px] font-bold text-slate-800 tracking-tight">
                      {formatProjectPhase(t.fromPhase)} <span className="text-slate-300 mx-1">→</span>{' '}
                      {formatProjectPhase(t.toPhase)}
                    </div>
                    <StatusPill
                      label={t.overrideDecision ? '條件放行' : '正常推進'}
                      tone={t.overrideDecision ? 'warn' : 'neutral'} // Noise Filter
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12px] font-medium text-slate-500">
                    <span>{t.triggeredBy?.name ?? '系統自動處理'}</span>
                    <span className="text-slate-400">{formatDateTimeZh(t.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 5. Additional Dialogs */}
      {taskDialogOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex h-[100vh] w-[100vw] items-center justify-center m-0 bg-slate-900/50 p-4 sm:p-6 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget) setTaskDialogOpen(false) }}
        >
          <div
            className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[32px] p-7 sm:p-9 text-[#f2fbfc]"
            style={{
              background: 'linear-gradient(135deg, rgba(10,73,90,0.97), rgba(8,58,72,0.95))',
              border: '1px solid rgba(203,241,248,0.12)',
              boxShadow: '0 32px 80px rgba(3,33,44,0.4)',
            }}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="m-0 text-xl font-bold tracking-tight text-[#f2fbfc]">建立開發任務</h3>
                <p className="mt-1 mb-0 text-[14px] text-[rgba(218,245,250,0.7)]">任務必須至少綁定一份文件空殼。</p>
              </div>
              <button
                type="button"
                onClick={() => setTaskDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData: FormData) => {
                setTaskError(null)
                const res = await createTaskAction({
                  projectId: project.id,
                  code: String(formData.get('code') ?? ''),
                  title: String(formData.get('title') ?? ''),
                  description: String(formData.get('description') ?? '') || undefined,
                  assigneeId: String(formData.get('assigneeId') ?? '') || undefined,
                  createdById: String(formData.get('createdById') ?? '') || undefined,
                  plannedPhase: String(formData.get('plannedPhase') ?? ProjectPhase.Planning) as ProjectPhase,
                  deliverableIds: formData.getAll('deliverableIds').map(String),
                  plannedStartDate: String(formData.get('plannedStartDate') ?? '') || null,
                  targetDate: String(formData.get('targetDate') ?? '') || null,
                })
                if (res.success) {
                  setTaskDialogOpen(false)
                  router.refresh()
                } else {
                  setTaskError(res.error || '建立任務失敗，請稍後再試')
                }
              }}
              className="flex flex-col gap-4"
            >
              {taskError && (
                <div className="flex items-center gap-2.5 rounded-lg bg-red-50 px-3.5 py-3 text-[13px] font-bold text-red-700">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {taskError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <input name="code" placeholder="任務代碼（如 DI-001）" className={darkInputClass} required />
                <input name="title" placeholder="任務名稱" className={darkInputClass} required />
              </div>
              <textarea
                name="description"
                placeholder="任務描述"
                className={`${darkInputClass} min-h-[80px] resize-y`}
              />
              <select name="plannedPhase" defaultValue={project.currentPhase} className={darkInputClass}>
                {Object.values(ProjectPhase).map((phase) => (
                  <option key={phase} value={phase}>{formatProjectPhase(phase)}</option>
                ))}
              </select>
              <select name="assigneeId" defaultValue="" className={darkInputClass}>
                <option value="">稍後再指派研發工程師</option>
                {rdUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-[rgba(218,245,250,0.7)]">預計開始日</label>
                  <input type="date" name="plannedStartDate" className={darkInputClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold text-[rgba(218,245,250,0.7)]">預計完成日</label>
                  <input type="date" name="targetDate" className={darkInputClass} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-[rgba(218,245,250,0.7)]">
                  綁定文件空殼 (必選至少一項, 可複選)
                </label>
                <select
                  name="deliverableIds"
                  multiple
                  defaultValue={project.deliverables.slice(0, 1).map((d) => d.id)}
                  className={`${darkInputClass} min-h-[110px]`}
                  required
                >
                  {project.deliverables.map((d) => (
                    <option key={d.id} value={d.id}>{d.code} · {d.title}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-[rgba(255,244,223,0.92)] px-5 py-4 text-[15px] font-bold text-[#442e17] shadow transition-all hover:-translate-y-0.5 hover:bg-white focus:outline-none"
              >
                建立可追溯任務
              </button>
            </form>
          </div>
        </dialog>
      )}

      {deliverableDialogOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex h-[100vh] w-[100vw] items-center justify-center m-0 bg-slate-900/50 p-4 sm:p-6 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget) setDeliverableDialogOpen(false) }}
        >
          <div
            className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-[32px] p-7 sm:p-9 text-[#f2fbfc]"
            style={{
              background: 'linear-gradient(135deg, rgba(10,73,90,0.97), rgba(8,58,72,0.95))',
              border: '1px solid rgba(203,241,248,0.12)',
              boxShadow: '0 32px 80px rgba(3,33,44,0.4)',
            }}
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="m-0 text-xl font-bold tracking-tight text-[#f2fbfc]">新增文件空殼</h3>
                <p className="mt-1 mb-0 text-[14px] text-[rgba(218,245,250,0.7)]">建立後可在 DHF 合規文件頁籤上傳版次與審核。</p>
              </div>
              <button
                type="button"
                onClick={() => setDeliverableDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20 hover:text-white focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData: FormData) => {
                setDeliverableError(null)
                const res = await createDeliverableAction({
                  projectId: project.id,
                  code: String(formData.get('code') ?? ''),
                  title: String(formData.get('title') ?? ''),
                  description: String(formData.get('description') ?? '') || undefined,
                  phase: String(formData.get('phase') ?? project.currentPhase) as ProjectPhase,
                  ownerId: String(formData.get('ownerId') ?? '') || undefined,
                  isRequired: formData.get('isRequired') === 'true',
                  actorId: String(formData.get('actorId') ?? ''),
                  targetDate: String(formData.get('targetDate') ?? '') || null,
                })
                if (res.success) {
                  setDeliverableDialogOpen(false)
                  router.refresh()
                } else {
                  setDeliverableError(res.error || '建立文件空殼失敗，請稍後再試')
                }
              }}
              className="flex flex-col gap-4"
            >
              {deliverableError && (
                <div className="flex items-center gap-2.5 rounded-lg bg-red-50 px-3.5 py-3 text-[13px] font-bold text-red-700">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {deliverableError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <input name="code" placeholder="文件代碼（如 DHF-001）" className={darkInputClass} required />
                <input name="title" placeholder="文件名稱" className={darkInputClass} required />
              </div>
              <textarea
                name="description"
                placeholder="文件說明（選填）"
                className={`${darkInputClass} min-h-[80px] resize-y`}
              />
              <select name="phase" defaultValue={project.currentPhase} className={darkInputClass}>
                {Object.values(ProjectPhase).map((phase) => (
                  <option key={phase} value={phase}>{formatProjectPhase(phase)}</option>
                ))}
              </select>
              <select name="ownerId" defaultValue="" className={darkInputClass}>
                <option value="">稍後再指定品保負責人</option>
                {qaUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select name="actorId" defaultValue="" className={darkInputClass} required>
                <option value="" disabled>操作者（目前帳號）</option>
                {lookupUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-[rgba(218,245,250,0.7)]">預計交件日</label>
                <input type="date" name="targetDate" className={darkInputClass} />
              </div>
              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-[rgba(255,244,223,0.92)] px-5 py-4 text-[15px] font-bold text-[#442e17] shadow transition-all hover:-translate-y-0.5 hover:bg-white focus:outline-none"
              >
                建立文件空殼
              </button>
            </form>
          </div>
        </dialog>
      )}

      {/* 4. Soft UI UX Phase Advance Dialog */}
      {gateDialogOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex h-[100vh] w-[100vw] items-center justify-center m-0 bg-slate-900/40 p-4 sm:p-6 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGateDialogOpen(false)
          }}
        >
          <div className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-[32px] bg-white p-7 sm:p-9 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5">
            <div className="mb-6 flex items-start justify-between relative z-10">
              <div className="w-full">
                <div className="flex w-full items-center justify-between">
                  <h3 className="m-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {gate?.canAdvance ? '階段推進確認' : '風險承諾與條件式放行'}
                  </h3>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    onClick={() => setGateDialogOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-2 mb-0 text-[15px] font-medium leading-relaxed text-slate-500">
                  {gate?.canAdvance
                    ? '全數文件與依賴皆已達標，即將進入下一開發階段。'
                    : '本操作將強制專案進入下一階段。任何未結項目都將轉列為風險遺留項。需填寫風險評估原因供稽核查驗。'}
                </p>
              </div>
            </div>

            <form
              action={async (formData: FormData) => {
                setGateError(null)
                const forceOverride = formData.get('forceOverride') === 'true'
                
                if (forceOverride) {
                  const rationale = String(formData.get('rationale') ?? '').trim()
                  if (!rationale) {
                    setGateError('請填寫風險評估與承擔原因說明')
                    return
                  }
                }
                
                const result = await advancePhaseAction({
                  projectId: project.id,
                  forceOverride,
                  triggeredById: String(formData.get('triggeredById') ?? '') || undefined,
                  overriddenById: forceOverride
                    ? String(formData.get('overriddenById') ?? '') || undefined
                    : undefined,
                  rationale: forceOverride
                    ? String(formData.get('rationale') ?? '').trim() || undefined
                    : undefined,
                })
                const resultAny = result as Record<string, unknown>
                if (resultAny.success === true) {
                  router.refresh()
                  setGateDialogOpen(false)
                } else if (resultAny.success === false) {
                  setGateError((resultAny.message as string) || '操作失敗，請稍後再試')
                } else if (resultAny.kind === 'hard_gate') {
                  setGateError('此為硬關卡，無法強制推進。請先完成所有必要文件。')
                } else if (resultAny.kind === 'warning') {
                  setGateError('請填寫風險承諾與放行資訊，或先完成必要文件。')
                } else {
                  setGateError('操作失敗，請稍後再試')
                }
              }}
              className="flex flex-col gap-6"
            >
              {gateError && (
                <div className="flex items-center gap-2.5 rounded-lg bg-red-50 px-3.5 py-3 text-[13px] font-bold text-red-700">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {gateError}
                </div>
              )}

              <input type="hidden" name="projectId" value={project.id} />
              {gate?.canAdvance ? null : (
                <input type="hidden" name="forceOverride" value="true" />
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[14px] font-bold text-slate-700">執行操作者</label>
                <div className="relative">
                  <select
                    name="triggeredById"
                    defaultValue=""
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-[15px] font-bold text-slate-900 transition-all hover:bg-slate-50 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 cursor-pointer"
                    required
                  >
                    <option value="" disabled>請選擇您的帳號</option>
                    {pmUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({formatRole(u.role)})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                    <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              {gate?.canAdvance ? null : (
                <div className="flex flex-col gap-5 rounded-[24px] border border-orange-200 bg-orange-50/50 p-6 shadow-sm">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between text-[14px] font-bold text-orange-800">
                      放行核准者 (Approver) 
                    </label>
                    <div className="relative">
                      <select
                        name="overriddenById"
                        defaultValue=""
                        className="w-full appearance-none rounded-2xl border border-orange-200 bg-white px-4 py-3.5 text-[15px] font-bold text-slate-900 transition-all hover:bg-orange-50/30 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/20 cursor-pointer"
                        required
                      >
                        <option value="" disabled>請選擇具備核准權限之人員</option>
                        {pmUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({formatRole(u.role)})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                        <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-bold text-orange-800">
                      風險評估與承擔原因說明
                    </label>
                    <textarea
                      name="rationale"
                      placeholder="請清楚說明在條件不可行的情況下，允許推進之緣由（例如預期外風險、高層特准等）..."
                      className="w-full min-h-[140px] resize-y rounded-2xl border border-orange-200 bg-white px-4 py-3.5 text-[15px] font-medium leading-relaxed text-slate-900 placeholder-slate-400 transition-all focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/20"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="mt-2 text-right">
                <button
                  type="submit"
                  className={`w-full rounded-[20px] px-6 py-4 text-[16px] font-bold shadow-md transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4 ${
                    gate?.canAdvance
                      ? 'bg-slate-800 text-white hover:bg-slate-700 focus:ring-slate-400 hover:shadow-lg'
                      : 'bg-[#EA580C] text-white hover:bg-[#C2410C] focus:ring-orange-500/40 hover:shadow-[0_8px_20px_-6px_rgba(234,88,12,0.4)]'
                  }`}
                >
                  {gate?.canAdvance ? '確認並推進至下一階段' : '確認並簽署風險承諾'}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </div>
  )
}
