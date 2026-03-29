import { PendingItemStatus, DeliverableStatus } from '@prisma/client'

import { prisma } from './prisma'

export const PENDING_ITEM_RESOLUTION_ERROR = '綁定文件尚未 Released，無法結案遺留項'

export interface PendingItemSummary {
  id: string
  projectId: string
  deliverableId: string
  sourceTransitionId: string | null
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
  sourceTransition: {
    id: string
    fromPhase: string
    toPhase: string
    wasOverride: boolean
    createdAt: Date
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

  const toResolve = pendingItems
    .filter(
      (item) =>
        item.status === PendingItemStatus.Open &&
        item.deliverable.status === DeliverableStatus.Released,
    )
    .map((item) => item.id)

  const toReopen = pendingItems
    .filter(
      (item) =>
        item.status === PendingItemStatus.Resolved &&
        item.deliverable.status !== DeliverableStatus.Released,
    )
    .map((item) => item.id)

  if (toResolve.length > 0) {
    await prisma.pendingItem.updateMany({
      where: { id: { in: toResolve } },
      data: {
        status: PendingItemStatus.Resolved,
        resolvedAt: new Date(),
      },
    })
  }

  if (toReopen.length > 0) {
    await prisma.pendingItem.updateMany({
      where: { id: { in: toReopen } },
      data: {
        status: PendingItemStatus.Open,
        resolvedAt: null,
      },
    })
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
      sourceTransition: {
        select: {
          id: true,
          fromPhase: true,
          toPhase: true,
          wasOverride: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  })

  return items
}

export async function resolvePendingItem(
  pendingItemId: string,
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
      sourceTransition: {
        select: {
          id: true,
          fromPhase: true,
          toPhase: true,
          wasOverride: true,
          createdAt: true,
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

  return prisma.pendingItem.update({
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
      sourceTransition: {
        select: {
          id: true,
          fromPhase: true,
          toPhase: true,
          wasOverride: true,
          createdAt: true,
        },
      },
    },
  })
}
