'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ProjectPhase, Role } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { MetricCard, SectionCard, StatusPill, EmptyPanel } from '@/components/app-shell'
import { ProjectGantt } from '@/components/project-gantt'
import { PHASE_ORDER } from '@/lib/phase-service'
import { createTaskAction, startTaskAction, completeTaskAction } from '@/actions/task-actions'
import { createDeliverableAction } from '@/actions/deliverable-actions'
import { formatProjectPhase, formatTaskStatus, formatDateShort } from '@/lib/ui-labels'

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

  return (
    <div className="flex flex-col gap-5">
      {/* Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        <MetricCard label="當前階段" value={formatProjectPhase(project.currentPhase)} />
        <MetricCard
          label="已完成任務"
          value={`${doneTasks}/${project.tasks.length}`}
          accent="var(--app-accent)"
        />
        <MetricCard
          label="At-Risk 任務"
          value={String(atRiskTasks)}
          hint="超前或落後專案當前階段的進行中任務"
          accent={atRiskTasks > 0 ? 'var(--app-danger)' : 'var(--app-success)'}
        />
        <MetricCard label="已釋出文件" value="–" accent="var(--app-success)" />
        <MetricCard label="文件空殼" value={String(project.deliverables.length)} />
      </div>

      {/* Gantt */}
      <SectionCard
        title="專案甘特圖"
        subtitle="視覺化檢視開發任務的排程與進度狀態。"
      >
        <ProjectGantt tasks={project.tasks} />
      </SectionCard>

      {/* Task List + Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 18 }}>
        <SectionCard
          title="開發任務"
          subtitle="任務允許先於專案當前階段啟動，系統只提示風險，不會把 RD 的實際工作直接鎖死。"
        >
          {project.tasks.length === 0 ? (
            <EmptyPanel
              title="尚無任務"
              body="點擊右側「+ 建立開發任務」建立第一筆可追溯的 RD 任務。"
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {project.tasks.map((task) => {
                const isOverdue =
                  !!task.targetDate &&
                  new Date(task.targetDate as string) < new Date() &&
                  task.status !== 'Done'
                return (
                  <div
                    key={task.id}
                    style={{
                      borderRadius: 20,
                      padding: 16,
                      background: 'rgba(255,255,255,0.54)',
                    }}
                  >
                    {isOverdue && (
                      <div style={{ marginBottom: 8 }}>
                        <StatusPill label="已延遲" tone="critical" />
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: '#896945' }}>{task.code}</div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{task.title}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <StatusPill
                          label={formatTaskStatus(task.status as any)}
                          tone={
                            task.status === 'Done'
                              ? 'good'
                              : task.status === 'InProgress'
                                ? 'warn'
                                : 'neutral'
                          }
                        />
                        <StatusPill
                          label={`預計階段 ${formatProjectPhase(task.plannedPhase)}`}
                          tone={task.plannedPhase !== project.currentPhase ? 'warn' : 'neutral'}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        color: '#65513a',
                        lineHeight: 1.6,
                        fontSize: 14,
                      }}
                    >
                      {task.description ?? '尚未填寫任務描述。'}
                    </div>
                    {(task.plannedStartDate || task.targetDate) && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 13,
                          color: '#7a5c38',
                          fontFamily: 'monospace',
                        }}
                      >
                        ⌚ {formatDateShort(toDate(task.plannedStartDate))} →{' '}
                        {formatDateShort(toDate(task.targetDate))}
                      </div>
                    )}
                    <div style={{ marginTop: 10, color: '#5b452c', fontSize: 13 }}>
                      綁定文件：
                      {task.deliverableLinks.map((l) => l.deliverable.code).join(', ')}
                    </div>
                    <div style={{ marginTop: 6, color: '#5b452c', fontSize: 13 }}>
                      指派給：{task.assignee?.name ?? '未指派'}
                    </div>
                    {task.status === 'Todo' ? (
                      <form
                        action={async (formData: FormData) => {
                          const res = await startTaskAction(String(formData.get('taskId') ?? ''))
                          if (!res.success) {
                            router.push(`?tab=planning&error=${encodeURIComponent(res.error)}`)
                          } else {
                            router.refresh()
                          }
                        }}
                        style={{ marginTop: 12 }}
                      >
                        <input type="hidden" name="taskId" value={task.id} />
                        <button type="submit" style={buttonStyle}>
                          開始執行
                        </button>
                      </form>
                    ) : task.status === 'InProgress' ? (
                      <form
                        action={async (formData: FormData) => {
                          const res = await completeTaskAction(String(formData.get('taskId') ?? ''))
                          if (!res.success) {
                            router.push(`?tab=planning&error=${encodeURIComponent(res.error)}`)
                          } else {
                            router.refresh()
                          }
                        }}
                        style={{ marginTop: 12 }}
                      >
                        <input type="hidden" name="taskId" value={task.id} />
                        <button type="submit" style={buttonStyle}>
                          標記完成
                        </button>
                      </form>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button
            type="button"
            onClick={() => setTaskDialogOpen(true)}
            style={primaryButtonStyle}
          >
            + 建立開發任務
          </button>
          <button
            type="button"
            onClick={() => setDeliverableDialogOpen(true)}
            style={primaryButtonStyle}
          >
            + 新增文件空殼
          </button>
          <div
            style={{
              borderRadius: 22,
              padding: 16,
              background: 'rgba(255,255,255,0.54)',
              fontSize: 13,
              color: '#6d5942',
              lineHeight: 1.6,
            }}
          >
            <strong>Task-Deliverable 綁定原則</strong>
            <br />
            每個任務必須至少綁定一個文件空殼，以確保 RD 的工作與法規產出有完整可追溯性。
          </div>
        </div>
      </div>

      {/* Create Task Dialog */}
      {taskDialogOpen && (
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
            if (e.target === e.currentTarget) setTaskDialogOpen(false)
          }}
        >
          <div
            style={{
              borderRadius: 28,
              padding: 32,
              background:
                'linear-gradient(135deg, rgba(10,73,90,0.97), rgba(8,58,72,0.95))',
              border: '1px solid rgba(203,241,248,0.12)',
              boxShadow: '0 32px 80px rgba(3,33,44,0.4)',
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              color: '#f2fbfc',
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
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f2fbfc' }}>
                建立開發任務
              </h3>
              <button
                type="button"
                onClick={() => setTaskDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: 'rgba(218,245,250,0.7)',
                  padding: '4px 8px',
                  borderRadius: 8,
                }}
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData: FormData) => {
                await createTaskAction({
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
                router.refresh()
              }}
              style={{ display: 'grid', gap: 12 }}
            >
              <input name="code" placeholder="任務代碼" style={inputStyleDark} required />
              <input name="title" placeholder="任務名稱" style={inputStyleDark} required />
              <textarea
                name="description"
                placeholder="任務描述"
                style={{ ...inputStyleDark, minHeight: 88, resize: 'vertical' }}
              />
              <select
                name="plannedPhase"
                defaultValue={project.currentPhase}
                style={inputStyleDark}
              >
                {Object.values(ProjectPhase).map((phase) => (
                  <option key={phase} value={phase}>
                    {formatProjectPhase(phase)}
                  </option>
                ))}
              </select>
              <select name="assigneeId" defaultValue="" style={inputStyleDark}>
                <option value="">稍後再指派 RD</option>
                {rdUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select name="createdById" defaultValue="" style={inputStyleDark}>
                <option value="">由系統 / 目前使用者建立</option>
                {lookupUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <label style={{ fontSize: 13, color: 'rgba(218,245,250,0.7)' }}>
                預計開始日
              </label>
              <input type="date" name="plannedStartDate" style={inputStyleDark} />
              <label style={{ fontSize: 13, color: 'rgba(218,245,250,0.7)' }}>
                預計完成日
              </label>
              <input type="date" name="targetDate" style={inputStyleDark} />
              <select
                name="deliverableIds"
                multiple
                defaultValue={project.deliverables.slice(0, 2).map((d) => d.id)}
                style={{ ...inputStyleDark, minHeight: 120 }}
              >
                {project.deliverables.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.title}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                onClick={() => setTaskDialogOpen(false)}
                style={buttonStyleLight}
              >
                建立可追溯任務
              </button>
            </form>
          </div>
        </dialog>
      )}

      {/* Create Deliverable Dialog */}
      {deliverableDialogOpen && (
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
            if (e.target === e.currentTarget) setDeliverableDialogOpen(false)
          }}
        >
          <div
            style={{
              borderRadius: 28,
              padding: 32,
              background:
                'linear-gradient(135deg, rgba(10,73,90,0.97), rgba(8,58,72,0.95))',
              border: '1px solid rgba(203,241,248,0.12)',
              boxShadow: '0 32px 80px rgba(3,33,44,0.4)',
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              color: '#f2fbfc',
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
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f2fbfc' }}>
                新增文件空殼
              </h3>
              <button
                type="button"
                onClick={() => setDeliverableDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: 'rgba(218,245,250,0.7)',
                  padding: '4px 8px',
                  borderRadius: 8,
                }}
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData: FormData) => {
                await createDeliverableAction({
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
                router.refresh()
              }}
              style={{ display: 'grid', gap: 12 }}
            >
              <input name="code" placeholder="文件代碼" style={inputStyleDark} required />
              <input name="title" placeholder="文件名稱" style={inputStyleDark} required />
              <textarea
                name="description"
                placeholder="文件說明"
                style={{ ...inputStyleDark, minHeight: 88, resize: 'vertical' }}
              />
              <select
                name="phase"
                defaultValue={project.currentPhase}
                style={inputStyleDark}
              >
                {Object.values(ProjectPhase).map((phase) => (
                  <option key={phase} value={phase}>
                    {formatProjectPhase(phase)}
                  </option>
                ))}
              </select>
              <select name="ownerId" defaultValue="" style={inputStyleDark}>
                <option value="">稍後再指定 QA 負責人</option>
                {qaUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select name="actorId" defaultValue="" style={inputStyleDark}>
                <option value="">操作者 (建立人)</option>
                {lookupUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <label style={{ fontSize: 13, color: 'rgba(218,245,250,0.7)' }}>
                預計交件日
              </label>
              <input type="date" name="targetDate" style={inputStyleDark} />
              <label
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  color: '#fff7ec',
                  fontSize: 14,
                }}
              >
                <input type="checkbox" name="isRequired" value="true" defaultChecked />
                納入關卡審查
              </label>
              <button
                type="submit"
                onClick={() => setDeliverableDialogOpen(false)}
                style={buttonStyleLight}
              >
                建立文件空殼
              </button>
            </form>
          </div>
        </dialog>
      )}
    </div>
  )
}

const inputStyleDark: CSSProperties = {
  width: '100%',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255, 244, 228, 0.1)',
  padding: '14px 16px',
  fontSize: 15,
  color: '#fff7ec',
  boxSizing: 'border-box',
}

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 18,
  padding: '16px 20px',
  background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary-strong))',
  color: '#f5fbfc',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
  width: '100%',
  boxShadow: '0 14px 30px rgba(11, 99, 120, 0.22)',
}

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '12px 18px',
  background: '#6b4927',
  color: '#fff7ee',
  fontWeight: 700,
  cursor: 'pointer',
}

const buttonStyleLight: CSSProperties = {
  border: 0,
  borderRadius: 16,
  padding: '14px 18px',
  background: '#fff4df',
  color: '#442e17',
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
}
