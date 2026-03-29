import type { Prisma } from '@prisma/client'

import { prisma } from './prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  action: string
  entityType: string
  entityId: string
  actorId?: string | null
  detail?: Record<string, unknown> | string | null
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * 寫入稽核紀錄。可在一般呼叫或 Prisma 交易中使用。
 *
 * @param entry   稽核事件 payload
 * @param tx      選填。傳入 Prisma 交易 client 使紀錄與業務邏輯共用同一交易。
 */
export async function recordAudit(
  entry: AuditEntry,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma
  const detail =
    entry.detail == null
      ? null
      : typeof entry.detail === 'string'
        ? entry.detail
        : JSON.stringify(entry.detail)

  await client.auditLog.create({
    data: {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorId: entry.actorId ?? null,
      detail,
    },
  })
}

// ─── Predefined actions ───────────────────────────────────────────────────────

export const AuditActions = {
  PROJECT_CREATE: 'project.create',
  TASK_CREATE: 'task.create',
  TASK_START: 'task.start',
  TASK_COMPLETE: 'task.complete',
  DELIVERABLE_CREATE: 'deliverable.create',
  DELIVERABLE_STATUS_CHANGE: 'deliverable.statusChange',
  FILE_REVISION_UPLOAD: 'fileRevision.upload',
  PHASE_ADVANCE: 'phase.advance',
  PHASE_OVERRIDE: 'phase.override',
  PENDING_ITEM_RESOLVE: 'pendingItem.resolve',
  CHANGE_REQUEST_CREATE: 'changeRequest.create',
  CHANGE_REQUEST_TRANSITION: 'changeRequest.transition',
} as const
