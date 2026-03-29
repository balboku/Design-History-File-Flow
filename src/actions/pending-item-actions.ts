'use server'

import { PendingItemStatus } from '@prisma/client'

import {
  listProjectPendingItems,
  resolvePendingItem,
  PENDING_ITEM_RESOLUTION_ERROR,
} from '@/lib/pending-item-service'

export type ListProjectPendingItemsActionResult = {
  success: true
  data: Awaited<ReturnType<typeof listProjectPendingItems>>
} | {
  success: false
  error: string
}

export async function listProjectPendingItemsAction(
  projectId: string,
  status?: PendingItemStatus,
): Promise<ListProjectPendingItemsActionResult> {
  try {
    const items = await listProjectPendingItems(projectId, status)
    return { success: true, data: items }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export type ResolvePendingItemActionResult = {
  success: true
  data: Awaited<ReturnType<typeof resolvePendingItem>>
} | {
  success: false
  error: string
  isDeliverableNotReleasedError?: boolean
}

export async function resolvePendingItemAction(
  pendingItemId: string,
  actorId: string,
): Promise<ResolvePendingItemActionResult> {
  try {
    const item = await resolvePendingItem(pendingItemId, actorId)
    return { success: true, data: item }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: message,
      isDeliverableNotReleasedError: message === PENDING_ITEM_RESOLUTION_ERROR,
    }
  }
}
