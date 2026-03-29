import { PendingItemStatus, DeliverableStatus } from '@prisma/client'

import { recordAudit, AuditActions } from './audit-log-service'
import { prisma } from './prisma'

export const PENDING_ITEM_RESOLUTION_ERROR = '綁定文件尚未 Released，無法結案遺留項'

export interface PendingItemSummary {
  id: string
  projectId: string
  deliverableId: string
  sourceOverrideId: string | null
  title: string
  detail: string | null
  status: PendingItemStatus
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
  deliverable: {
    id: string
    code: string
    title: string
    phase: string
    status: DeliverableStatus
  }
  sourceOverride: {
    id: string
    transition: {
      fromPhase: string
      toPhase: string
      createdAt: Date
    }
  } | null
}

export async function syncPendingItems(projectId: string): Promise<void> {
  const pendingItems = await prisma.pendingItem.findMany({
    where: { projectId },
    include: {
      deliverable: {
        select: {
          status: true,
        },
      },
    },
  })

  const toResolve = pendingItems.filter(
    (item) =>
      item.status === PendingItemStatus.Open &&
      item.deliverable.status === DeliverableStatus.Released,
  )

  const toReopen = pendingItems.filter(
    (item) =>
      item.status === PendingItemStatus.Resolved &&
      item.deliverable.status !== DeliverableStatus.Released,
  )

  if (toResolve.length > 0) {
    await prisma.pendingItem.updateMany({
      where: { id: { in: toResolve.map((i) => i.id) } },
      data: {
        status: PendingItemStatus.Resolved,
        resolvedAt: new Date(),
      },
    })
    
    for (const item of toResolve) {
      await recordAudit({
        action: AuditActions.PENDING_ITEM_AUTO_RESOLVE,
        entityType: 'PendingItem',
        entityId: item.id,
        detail: {
          title: item.title,
          deliverableId: item.deliverableId,
          reason: 'Deliverable was Release -> Auto Resolved',
        },
      })
    }
  }

  if (toReopen.length > 0) {
    await prisma.pendingItem.updateMany({
      where: { id: { in: toReopen.map((i) => i.id) } },
      data: {
        status: PendingItemStatus.Open,
        resolvedAt: null,
      },
    })
    
    for (const item of toReopen) {
      await recordAudit({
        action: AuditActions.PENDING_ITEM_AUTO_REOPEN,
        entityType: 'PendingItem',
        entityId: item.id,
        detail: {
          title: item.title,
          deliverableId: item.deliverableId,
          reason: 'Deliverable was Revoked/Modified -> Auto Reopened',
        },
      })
    }
  }
}

export async function listProjectPendingItems(
  projectId: string,
  status?: PendingItemStatus,
): Promise<PendingItemSummary[]> {
  await syncPendingItems(projectId)

  const items = await prisma.pendingItem.findMany({
    where: {
      projectId,
      ...(status ? { status } : {}),
    },
    include: {
      deliverable: {
        select: {
          id: true,
          code: true,
          title: true,
          phase: true,
          status: true,
        },
      },
      sourceOverride: {
        select: {
          id: true,
          transition: {
            select: {
              fromPhase: true,
              toPhase: true,
              createdAt: true,
            }
          }
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  })

  return items
}

export async function resolvePendingItem(
  pendingItemId: string,
  actorId: string,
): Promise<PendingItemSummary> {
  const item = await prisma.pendingItem.findUnique({
    where: { id: pendingItemId },
    include: {
      deliverable: {
        select: {
          id: true,
          code: true,
          title: true,
          phase: true,
          status: true,
        },
      },
      sourceOverride: {
        select: {
          id: true,
          transition: {
            select: {
              fromPhase: true,
              toPhase: true,
              createdAt: true,
            }
          }
        },
      },
    },
  })

  if (!item) {
    throw new Error(`Pending item not found: ${pendingItemId}`)
  }

  if (item.deliverable.status !== DeliverableStatus.Released) {
    throw new Error(PENDING_ITEM_RESOLUTION_ERROR)
  }

  const resolved = await prisma.pendingItem.update({
    where: { id: pendingItemId },
    data: {
      status: PendingItemStatus.Resolved,
      resolvedAt: new Date(),
    },
    include: {
      deliverable: {
        select: {
          id: true,
          code: true,
          title: true,
          phase: true,
          status: true,
        },
      },
      sourceOverride: {
        select: {
          id: true,
          transition: {
            select: {
              fromPhase: true,
              toPhase: true,
              createdAt: true,
            }
          }
        },
      },
    },
  })

  await recordAudit({
    action: AuditActions.PENDING_ITEM_RESOLVE,
    entityType: 'PendingItem',
    entityId: resolved.id,
    actorId,
    detail: {
      title: resolved.title,
      deliverableId: resolved.deliverableId,
    },
  })

  return resolved
}
