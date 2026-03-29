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
  plannedStartDate?: Date | string | null
  targetDate?: Date | string | null
  assignee?: { name?: string } | null
  deliverableLinks: { deliverable: { code: string } }[]
}

interface Project {
  id: string
  code: string
  name: string
  currentPhase: ProjectPhase
  tasks: Task[]
  pendingItems: PendingItem[]
  phaseTransitions: Transition[]
}

interface Props {
  project: Project
  gate: PhaseGate | null
  lookupUsers: LookupUser[]
}

export function ProjectDashboardTab({ project, gate, lookupUsers }: Props) {
  const router = useRouter()
  const [gateDialogOpen, setGateDialogOpen] = useState(false)

  const doneTasks = project.tasks.filter((t) => t.status === 'Done').length
  const atRiskTasks = project.tasks.filter(
    (t) =>
      PHASE_ORDER.indexOf(t.plannedPhase) > PHASE_ORDER.indexOf(project.currentPhase) &&
      t.status !== 'Done',
  ).length
  const openPendingItems = project.pendingItems.filter((i) => i.status === 'Open').length

  const pmUsers = lookupUsers.filter((u) => u.role === Role.PM || u.role === Role.ADMIN)

  return (
    <div className="flex flex-col gap-5">
      {/* Metrics Row */}
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
        <MetricCard
          label="未結遺留項"
          value={String(openPendingItems)}
          accent={openPendingItems > 0 ? 'var(--app-danger)' : 'var(--app-success)'}
        />
      </div>

      {/* Phase Gate + Task Quick View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 18 }}>
        {/* Phase Gate */}
        <SectionCard
          title="階段關卡控制"
          subtitle="先確認文件是否齊全，再決定是正常推進，或以條件式放行進入下一階段。"
        >
          {gate?.canAdvance ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <StatusPill
                  label={`下一階段：${formatProjectPhase(gate.nextPhase!)}`}
                  tone="good"
                />
              </div>
              <button
                type="button"
                onClick={() => setGateDialogOpen(true)}
                style={buttonStyle}
              >
                推進階段
              </button>
            </>
          ) : gate ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <StatusPill
                  label={gate.isHardGate ? '硬關卡' : '軟關卡警示'}
                  tone={gate.isHardGate ? 'critical' : 'warn'}
                />
                <StatusPill
                  label={`問題 ${gate.issues?.length ?? 0} 項`}
                  tone="neutral"
                />
              </div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                {gate.issues?.map((issue, i) => (
                  <div
                    key={`${issue.deliverableId}-${i}`}
                    style={{
                      borderRadius: 18,
                      padding: 14,
                      background: 'rgba(255,255,255,0.52)',
                    }}
                  >
                    <strong>{issue.deliverableCode}</strong> · {issue.deliverableTitle}
                    <div style={{ color: '#6b563f', marginTop: 6 }}>{issue.reason}</div>
                  </div>
                ))}
              </div>
              {!gate.isHardGate ? (
                <button
                  type="button"
                  onClick={() => setGateDialogOpen(true)}
                  style={buttonStyle}
                >
                  條件放行並進入下一階段
                </button>
              ) : (
                <div style={{ color: '#6d5942', marginTop: 10 }}>
                  目前為硬關卡，請先補齊所有必須的文件。
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#6d5942', padding: 14 }}>
              無法結算關卡資訊。
            </div>
          )}
        </SectionCard>

        {/* Task Quick View */}
        <SectionCard
          title="開發任務"
          subtitle="任務允許先於專案當前階段啟動。"
        >
          {project.tasks.length === 0 ? (
            <EmptyPanel title="尚無任務" body="在 Planning 頁籤建立任務。" />
          ) : (
            <div style={{ display: 'grid', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
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
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 6,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: '#896945' }}>{task.code}</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{task.title}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                        {isOverdue && <StatusPill label="已延遲" tone="critical" />}
                      </div>
                    </div>
                    <div style={{ color: '#5b452c', fontSize: 13 }}>
                      指派：{task.assignee?.name ?? '未指派'} · 階段：
                      {formatProjectPhase(task.plannedPhase)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Gantt */}
      <div>
        <SectionCard
          title="專案甘特圖"
          subtitle="視覺化檢視開發任務的排程與進度狀態。"
        >
          <ProjectGantt tasks={project.tasks} />
        </SectionCard>
      </div>

      {/* Pending Items + Phase History */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <SectionCard
          title="未結遺留項"
          subtitle="條件式放行後，來自前階段的未結風險。"
        >
          {project.pendingItems.length === 0 ? (
            <EmptyPanel title="沒有遺留項" body="此專案目前沒有未結遺留項。" />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {project.pendingItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: 'rgba(255,255,255,0.54)',
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
                    <strong>{item.title}</strong>
                    <StatusPill
                      label={formatPendingItemStatus(item.status as any)}
                      tone={item.status === 'Resolved' ? 'good' : 'critical'}
                    />
                  </div>
                  <div style={{ marginTop: 6, color: '#5f4a34', fontSize: 13 }}>
                    {item.deliverable.code} · {item.deliverable.title}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="階段異動歷史"
          subtitle="專案階段推進與條件式放行的完整紀錄。"
        >
          {project.phaseTransitions.length === 0 ? (
            <EmptyPanel
              title="尚無階段異動"
              body="尚未進行任何階段推進。"
            />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {project.phaseTransitions.map((t) => (
                <div
                  key={t.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: 'rgba(255,255,255,0.54)',
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
                    <strong>
                      {formatProjectPhase(t.fromPhase)} →{' '}
                      {formatProjectPhase(t.toPhase)}
                    </strong>
                    <StatusPill
                      label={t.overrideDecision ? '條件式放行' : '正常推進'}
                      tone={t.overrideDecision ? 'warn' : 'good'}
                    />
                  </div>
                  <div style={{ marginTop: 6, color: '#5f4a34', fontSize: 13 }}>
                    {t.triggeredBy?.name ?? '系統'} · {formatDateTimeZh(t.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Phase Advance Dialog */}
      {gateDialogOpen && (
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
            if (e.target === e.currentTarget) setGateDialogOpen(false)
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
              maxWidth: 480,
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
                {gate?.canAdvance ? '推進專案階段' : '條件式放行'}
              </h3>
              <button
                type="button"
                onClick={() => setGateDialogOpen(false)}
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
                const forceOverride = formData.get('forceOverride') === 'true'
                await advancePhaseAction({
                  projectId: project.id,
                  forceOverride,
                  triggeredById: String(formData.get('triggeredById') ?? '') || undefined,
                  overriddenById: forceOverride
                    ? String(formData.get('overriddenById') ?? '') || undefined
                    : undefined,
                  rationale: forceOverride
                    ? String(formData.get('rationale') ?? '') || undefined
                    : undefined,
                })
                router.refresh()
              }}
              style={{ display: 'grid', gap: 12 }}
            >
              <input type="hidden" name="projectId" value={project.id} />
              {gate?.canAdvance ? null : (
                <input type="hidden" name="forceOverride" value="true" />
              )}
              <select name="triggeredById" defaultValue="" style={inputStyle} required>
                <option value="">選擇操作者</option>
                {pmUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {formatRole(u.role)}
                  </option>
                ))}
              </select>
              {gate?.canAdvance ? null : (
                <>
                  <select
                    name="overriddenById"
                    defaultValue=""
                    style={inputStyle}
                    required
                  >
                    <option value="">選擇放行核准者</option>
                    {pmUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {formatRole(u.role)}
                      </option>
                    ))}
                  </select>
                  <textarea
                    name="rationale"
                    placeholder="條件式放行原因"
                    style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                  />
                </>
              )}
              <button
                type="submit"
                onClick={() => setGateDialogOpen(false)}
                style={buttonStyle}
              >
                {gate?.canAdvance ? '確認推進' : '條件放行並進入下一階段'}
              </button>
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
