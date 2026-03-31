import {
  ChangeRequestStatus,
  DeliverableStatus,
  PendingItemStatus,
  ProjectPhase,
  Role,
  TaskStatus,
} from '@prisma/client'

export const roleLabels: Record<Role, string> = {
  PM: '專案經理',
  RD: '研發工程',
  QA: '品保法規',
  ADMIN: '系統管理',
}

export const projectPhaseLabels: Record<ProjectPhase, string> = {
  Concept: '概念',
  Planning: '規劃',
  DesignInput: '設計輸入',
  DesignOutput: '設計輸出',
  Verification: '驗證',
  Validation: '確效',
  DesignTransfer: '設計移轉 (量產準備)',
  PostMarket: '上市後',
}

export const deliverableStatusLabels: Record<DeliverableStatus, string> = {
  Draft: '草稿',
  InReview: '審查中',
  Released: '已發行',
  Locked: '已上鎖',
}

export const taskStatusLabels: Record<TaskStatus, string> = {
  Todo: '待開始',
  InProgress: '進行中',
  Done: '已完成',
}

export const pendingItemStatusLabels: Record<PendingItemStatus, string> = {
  Open: '待補齊項目',
  Resolved: '已補結案',
}

export const changeRequestStatusLabels: Record<ChangeRequestStatus, string> = {
  Draft: '草稿',
  Active: '進行中',
  Submitted: '已送出',
  InReview: '審查中',
  Approved: '已核准',
  Rejected: '已拒絕',
  Implemented: '已實施',
  Closed: '已結案',
}

export function formatRole(role: Role | string) {
  return roleLabels[role as Role] ?? String(role)
}

export function formatProjectPhase(phase: ProjectPhase | string) {
  return projectPhaseLabels[phase as ProjectPhase] ?? String(phase)
}

export function formatDeliverableStatus(status: DeliverableStatus | string) {
  return deliverableStatusLabels[status as DeliverableStatus] ?? String(status)
}

export function formatTaskStatus(status: TaskStatus | string) {
  return taskStatusLabels[status as TaskStatus] ?? String(status)
}

export function formatPendingItemStatus(status: PendingItemStatus | string) {
  return pendingItemStatusLabels[status as PendingItemStatus] ?? String(status)
}

export function formatChangeRequestStatus(status: ChangeRequestStatus | string) {
  return changeRequestStatusLabels[status as ChangeRequestStatus] ?? String(status)
}

export function formatAdvanceOutcome(outcome: 'advanced' | 'forced' | 'warning') {
  switch (outcome) {
    case 'advanced':
      return '正常放行'
    case 'forced':
      return '特准放行 (條件式通過)'
    case 'warning':
      return '需檢視警示'
  }
}

export function formatDateZh(date: Date) {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
  }).format(date)
}

export function formatDateTimeZh(date: Date) {
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/**
 * 判斷是否逾期：targetDate 存在、早於今天、且任務/文件尚未完成。
 */
export function isOverdue(targetDate: Date | null | undefined, isCompleted: boolean): boolean {
  if (!targetDate || isCompleted) return false
  return new Date(targetDate) < new Date()
}

/**
 * 格式化日期為 yyyy/MM/dd 格式（用於顯示任務日期區間）
 */
export function formatDateShort(date: Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
}
