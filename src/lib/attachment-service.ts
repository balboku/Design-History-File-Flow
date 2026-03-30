import { prisma } from './prisma'
import { recordAudit, AuditActions } from './audit-log-service'

export interface CreateAttachmentInput {
  taskId: string
  fileName: string
  storagePath: string
  mimeType?: string
  fileSizeBytes?: number
  uploadedById?: string
}

export interface AttachmentInfo {
  id: string
  fileName: string
  mimeType?: string
  fileSizeBytes?: number
  createdAt: Date
  uploader?: { name: string } | null
}

/**
 * 建立一個任務的參考附件（非正式交付物）。
 * 附件不需要經過 QA 審核，僅作為研發過程中的輔助資料。
 */
export async function createAttachment(input: CreateAttachmentInput): Promise<AttachmentInfo> {
  const attachment = await prisma.attachment.create({
    data: {
      taskId: input.taskId,
      fileName: input.fileName,
      storagePath: input.storagePath,
      mimeType: input.mimeType ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      uploadedById: input.uploadedById ?? null,
    },
    include: {
      uploader: {
        select: { name: true },
      },
    },
  })

  await recordAudit({
    action: 'attachment.upload',
    entityType: 'Attachment',
    entityId: attachment.id,
    actorId: input.uploadedById,
    detail: {
      taskId: input.taskId,
      fileName: input.fileName,
    },
  })

  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType ?? undefined,
    fileSizeBytes: attachment.fileSizeBytes ?? undefined,
    createdAt: attachment.createdAt,
    uploader: attachment.uploader,
  }
}

/**
 * 取得任務的所有參考附件。
 */
export async function getTaskAttachments(taskId: string): Promise<AttachmentInfo[]> {
  const attachments = await prisma.attachment.findMany({
    where: { taskId },
    include: {
      uploader: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return attachments.map((a) => ({
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType ?? undefined,
    fileSizeBytes: a.fileSizeBytes ?? undefined,
    createdAt: a.createdAt,
    uploader: a.uploader,
  }))
}

/**
 * 刪除一個參考附件。
 */
export async function deleteAttachment(attachmentId: string, actorId?: string): Promise<void> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  })

  if (!attachment) {
    throw new Error(`Attachment not found: ${attachmentId}`)
  }

  await prisma.attachment.delete({
    where: { id: attachmentId },
  })

  await recordAudit({
    action: 'attachment.delete',
    entityType: 'Attachment',
    entityId: attachmentId,
    actorId,
    detail: {
      taskId: attachment.taskId,
      fileName: attachment.fileName,
    },
  })
}
