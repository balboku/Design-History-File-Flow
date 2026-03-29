'use server'

import { ChangeRequestStatus } from '@prisma/client'

import {
  createChangeRequest,
  transitionChangeRequest,
} from '@/lib/change-request-service'

export interface CreateChangeRequestActionInput {
  code: string
  title: string
  description?: string
  impactAnalysis?: string
  projectId?: string | null
  requesterId?: string | null
  deliverableIds?: string[]
  partComponentIds?: string[]
}

export type CreateChangeRequestActionResult = {
  success: true
  data: Awaited<ReturnType<typeof createChangeRequest>>['changeRequest']
} | {
  success: false
  error: string
}

export async function createChangeRequestAction(
  input: CreateChangeRequestActionInput,
): Promise<CreateChangeRequestActionResult> {
  try {
    const result = await createChangeRequest(input)
    return { success: true, data: result.changeRequest }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface TransitionChangeRequestActionInput {
  changeRequestId: string
  nextStatus: ChangeRequestStatus
  actedById?: string | null
}

export type TransitionChangeRequestActionResult = {
  success: true
  data: Awaited<ReturnType<typeof transitionChangeRequest>>['changeRequest']
} | {
  success: false
  error: string
}

export async function transitionChangeRequestAction(
  input: TransitionChangeRequestActionInput,
): Promise<TransitionChangeRequestActionResult> {
  try {
    const result = await transitionChangeRequest(input)
    return { success: true, data: result.changeRequest }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
