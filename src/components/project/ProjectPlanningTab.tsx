'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ProjectPhase, Role } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { MetricCard, SectionCard, EmptyPanel } from '@/components/app-shell'
import { ProjectGantt } from '@/components/project-gantt'
import { KanbanBoard } from '@/components/project/KanbanBoard'
import type { KanbanTask } from '@/components/project/TaskCard'
import { PHASE_ORDER } from '@/lib/phase-service'
import { createTaskAction, updateTaskAction } from '@/actions/task-actions'
import { createDeliverableAction } from '@/actions/deliverable-actions'
import { formatProjectPhase, formatDateShort } from '@/lib/ui-labels'

interface LookupUser {
  id: string
  name: string
  role: Role
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
  deliverableLinks: {
    deliverable: {
      id: string
      code: string
      title: string
      status: string
      fileRevisions: { id: string }[]
    }
  }[]
}

interface Deliverable {
  id: string
  code: string
  title: string
  status: string
}

interface Project {
  id: string
  code: string
  name: string
  currentPhase: ProjectPhase
  tasks: Task[]
  deliverables: Deliverable[]
}

interface Props {
  project: Project
  lookupUsers: LookupUser[]
}

export function ProjectPlanningTab({ project, lookupUsers }: Props) {
  const router = useRouter()
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [deliverableDialogOpen, setDeliverableDialogOpen] = useState(false)
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null)

  const rdUsers = lookupUsers.filter((u) => u.role === Role.RD)
  const qaUsers = lookupUsers.filter((u) => u.role === Role.QA || u.role === Role.ADMIN)
  const doneTasks = project.tasks.filter((t) => t.status === 'Done').length
  const atRiskTasks = project.tasks.filter(
    (t) =>
      PHASE_ORDER.indexOf(t.plannedPhase) > PHASE_ORDER.indexOf(project.currentPhase) &&
      t.status !== 'Done',
  ).length

  const toDate = (d: Date | string | null | undefined): Date | null => {
    if (!d) return null
    if (typeof d === 'string') return new Date(d)
    return d
  }

  // Cast Task[] to KanbanTask[] (compatible shape after frontend-data.ts update)
  const kanbanTasks: KanbanTask[] = project.tasks as KanbanTask[]

  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-[14px] font-medium text-slate-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
  const darkInputClass = "w-full rounded-xl border border-white/16 bg-white/10 px-4 py-3 text-[14px] font-medium text-[#fff7ec] placeholder-white/40 transition-colors focus:border-white/40 focus:bg-white/15 focus:outline-none"

  return (
    <div className="flex flex-col gap-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-6">
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
        <MetricCard label="文件空殼" value={String(project.deliverables.length)} />
      </div>

      {/* Gantt */}
      <SectionCard
        title="專案甘特圖"
        subtitle="視覺化檢視開發任務的排程與進度狀態。點擊任務條可編輯詳細資訊。"
      >
        <ProjectGantt
          tasks={project.tasks}
          onTaskClick={(taskId) => {
            const task = project.tasks.find((t) => t.id === taskId)
            if (task) setSelectedTaskForEdit(task as Task)
          }}
        />
      </SectionCard>

      {/* Kanban Board */}
      <SectionCard
        title="開發任務看板"
        subtitle="拖曳任務卡片以更新進度。移往「已完成」時，如文件尚未上傳，系統將引導您先完成上傳。"
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
            建立開發任務
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
          <div className="ml-auto hidden sm:block rounded-xl border border-slate-200/60 bg-slate-50/50 px-4 py-2 text-[12px] font-medium text-slate-500">
            每個任務必須至少綁定一份文件空殼，以確保工作有完整可追溯性。
          </div>
        </div>

        {project.tasks.length === 0 ? (
          <EmptyPanel
            title="尚無任務"
            body="點擊「建立開發任務」以建立第一筆可追溯的 RD 任務。"
          />
        ) : (
          <KanbanBoard projectId={project.id} tasks={kanbanTasks} lookupUsers={lookupUsers} />
        )}
      </SectionCard>

      {/* ─── Create Task Dialog ───────────────────────────────────────────────── */}
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
                }
              }}
              className="flex flex-col gap-4"
            >
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
                <option value="">稍後再指派 RD</option>
                {rdUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select name="createdById" defaultValue="" className={darkInputClass}>
                <option value="">由系統 / 目前使用者建立</option>
                {lookupUsers.map((u) => (
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
                {project.deliverables.length === 0 && (
                  <p className="text-[12px] text-orange-300">尚無文件空殼。請先點擊「新增文件空殼」後再建立任務。</p>
                )}
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

      {/* ─── Create Deliverable Dialog ────────────────────────────────────────── */}
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
                }
              }}
              className="flex flex-col gap-4"
            >
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
                <option value="">稍後再指定 QA 負責人</option>
                {qaUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select name="actorId" defaultValue="" className={darkInputClass} required>
                <option value="" disabled>操作者（建立人）</option>
                {lookupUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-bold text-[rgba(218,245,250,0.7)]">預計交件日</label>
                <input type="date" name="targetDate" className={darkInputClass} />
              </div>
              <label className="flex items-center gap-3 text-[14px] font-medium text-[rgba(218,245,250,0.85)]">
                <input type="checkbox" name="isRequired" value="true" defaultChecked className="h-4 w-4 rounded" />
                納入階段關卡審查（IS0 13485 Required）
              </label>
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

      {/* ─── Edit Task Dialog (from Gantt or Kanban) ─────────────────────────── */}
      {selectedTaskForEdit && (
        <dialog
          open
          className="fixed inset-0 z-[90] flex h-full w-full items-center justify-center m-0 bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTaskForEdit(null)
          }}
        >
          <div className="w-full max-w-[500px] rounded-[20px] bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <h2 className="m-0 text-[18px] font-bold text-slate-800 mb-4">編輯任務 · {selectedTaskForEdit.code}</h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const title = formData.get('title') as string
                const description = formData.get('description') as string | null
                const assigneeId = formData.get('assigneeId') as string | null
                const plannedStartDate = formData.get('plannedStartDate') as string | null
                const targetDate = formData.get('targetDate') as string | null

                const res = await updateTaskAction({
                  taskId: selectedTaskForEdit.id,
                  title: title || undefined,
                  description: description || null,
                  assigneeId: assigneeId || null,
                  plannedStartDate: plannedStartDate || null,
                  targetDate: targetDate || null,
                })

                if (res.success) {
                  setSelectedTaskForEdit(null)
                  router.refresh()
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="title" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  標題
                </label>
                <input
                  id="title"
                  type="text"
                  name="title"
                  defaultValue={selectedTaskForEdit.title}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  描述
                </label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={selectedTaskForEdit.description || ''}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none resize-none"
                />
              </div>

              <div>
                <label htmlFor="assigneeId" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  負責人
                </label>
                <select
                  id="assigneeId"
                  name="assigneeId"
                  defaultValue={selectedTaskForEdit.assigneeId || ''}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                >
                  <option value="">未指派</option>
                  {rdUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="plannedStartDate" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    預計開始
                  </label>
                  <input
                    id="plannedStartDate"
                    type="date"
                    name="plannedStartDate"
                    defaultValue={
                      selectedTaskForEdit.plannedStartDate
                        ? new Date(selectedTaskForEdit.plannedStartDate).toISOString().split('T')[0]
                        : ''
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="targetDate" className="block text-[12px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    目標完成
                  </label>
                  <input
                    id="targetDate"
                    type="date"
                    name="targetDate"
                    defaultValue={
                      selectedTaskForEdit.targetDate
                        ? new Date(selectedTaskForEdit.targetDate).toISOString().split('T')[0]
                        : ''
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTaskForEdit(null)}
                  className="rounded-lg px-4 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-600"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </div>
  )
}
