'use server'

import { DeliverableStatus, ProjectPhase } from '@prisma/client'

import {
  createDeliverable,
  createFileRevision,
  updateDeliverableStatus,
} from '@/lib/deliverable-service'

export interface CreateDeliverableActionInput {
  projectId: string
  code: string
  title: string
  description?: string
  phase: ProjectPhase
  ownerId?: string | null
  isRequired?: boolean
  actorId: string
}

export type CreateDeliverableActionResult = {
  success: true
  data: Awaited<ReturnType<typeof createDeliverable>>['deliverable']
} | {
  success: false
  error: string
}

export async function createDeliverableAction(
  input: CreateDeliverableActionInput,
): Promise<CreateDeliverableActionResult> {
  try {
    const result = await createDeliverable(input)
    return { success: true, data: result.deliverable }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface CreateFileRevisionActionInput {
  deliverableId: string
  fileName: string
  storagePath: string
  mimeType?: string
  fileSizeBytes?: number | null
  changeSummary?: string
  uploadedById: string
  changeRequestId?: string | null
  revisionNumber?: number
}

export type CreateFileRevisionActionResult = {
  success: true
  data: Awaited<ReturnType<typeof createFileRevision>>['revision']
} | {
  success: false
  error: string
}

export async function createFileRevisionAction(
  input: CreateFileRevisionActionInput,
): Promise<CreateFileRevisionActionResult> {
  try {
    const result = await createFileRevision(input)
    return { success: true, data: result.revision }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export interface UpdateDeliverableStatusActionInput {
  deliverableId: string
  status: DeliverableStatus
  actedById: string
  comment?: string
}

export type UpdateDeliverableStatusActionResult = {
  success: true
  data: Awaited<ReturnType<typeof updateDeliverableStatus>>['deliverable']
} | {
  success: false
  error: string
}

export async function updateDeliverableStatusAction(
  input: UpdateDeliverableStatusActionInput,
): Promise<UpdateDeliverableStatusActionResult> {
  try {
    const result = await updateDeliverableStatus(input)
    return { success: true, data: result.deliverable }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
