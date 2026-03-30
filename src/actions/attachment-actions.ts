'use server'

import { createAttachment, getTaskAttachments, deleteAttachment } from '@/lib/attachment-service'

// ─── Create Attachment ─────────────────────────────────────────────────────

export interface CreateAttachmentActionInput {
  taskId: string
  fileName: string
  storagePath: string
  mimeType?: string
  fileSizeBytes?: number
  uploadedById?: string
}

export type CreateAttachmentActionResult = {
  success: true
  data: { id: string; fileName: string }
} | {
  success: false
  error: string
}

export async function createAttachmentAction(
  input: CreateAttachmentActionInput
): Promise<CreateAttachmentActionResult> {
  try {
    const result = await createAttachment(input)
    return { success: true, data: { id: result.id, fileName: result.fileName } }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ─── Get Task Attachments ──────────────────────────────────────────────────

export type GetTaskAttachmentsActionResult = {
  success: true
  data: Array<{
    id: string
    fileName: string
    mimeType?: string
    fileSizeBytes?: number
    createdAt: Date
    uploader?: { name: string } | null
  }>
} | {
  success: false
  error: string
}

export async function getTaskAttachmentsAction(
  taskId: string
): Promise<GetTaskAttachmentsActionResult> {
  try {
    const attachments = await getTaskAttachments(taskId)
    return { success: true, data: attachments }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

// ─── Delete Attachment ────────────────────────────────────────────────────

export type DeleteAttachmentActionResult = {
  success: true
} | {
  success: false
  error: string
}

export async function deleteAttachmentAction(
  attachmentId: string,
  actorId?: string
): Promise<DeleteAttachmentActionResult> {
  try {
    await deleteAttachment(attachmentId, actorId)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
