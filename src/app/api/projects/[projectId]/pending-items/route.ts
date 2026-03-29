import { NextRequest, NextResponse } from 'next/server'
import { PendingItemStatus } from '@prisma/client'

import { listProjectPendingItems } from '@/lib/pending-item-service'

function parsePendingItemStatus(value: string | null): PendingItemStatus | undefined {
  if (!value) return undefined
  if (value === PendingItemStatus.Open || value === PendingItemStatus.Resolved) {
    return value
  }
  return undefined
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params
    const status = parsePendingItemStatus(request.nextUrl.searchParams.get('status'))

    const items = await listProjectPendingItems(projectId, status)
    return NextResponse.json({ success: true, data: items })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
