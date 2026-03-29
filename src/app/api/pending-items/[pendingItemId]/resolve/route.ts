import { NextResponse } from 'next/server'

import {
  resolvePendingItem,
  PENDING_ITEM_RESOLUTION_ERROR,
} from '@/lib/pending-item-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ pendingItemId: string }> },
) {
  try {
    const { pendingItemId } = await context.params
    const body = await _request.json().catch(() => ({}))
    const item = await resolvePendingItem(pendingItemId, body.actorId || 'system')
    return NextResponse.json({ success: true, data: item })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message === PENDING_ITEM_RESOLUTION_ERROR ? 409 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
