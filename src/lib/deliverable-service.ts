import {
  ApprovalDecision,
  ChangeRequestStatus,
  DeliverableStatus,
  ProjectPhase,
} from '@prisma/client'

import { recordAudit, AuditActions } from './audit-log-service'
import { syncPendingItems } from './pending-item-service'
import { prisma } from './prisma'

export const FILE_UPLOAD_ERROR =
  'Please choose a file to upload before logging a revision.'
export const LOCKED_DELIVERABLE_CHANGE_REQUEST_ERROR =
  'Locked deliverables require a linked Change Request before a new revision can be uploaded.'
export const LOCKED_DELIVERABLE_STATUS_CHANGE_ERROR =
  'Locked deliverables cannot be directly unlocked. Create a Change Request and upload a new revision instead.'
export const LOCKED_DELIVERABLE_APPROVED_CHANGE_REQUEST_ERROR =
  'Locked deliverables require an approved Change Request before a new revision can be uploaded.'
export const LOCKED_DELIVERABLE_CHANGE_REQUEST_LINK_ERROR =
  'The linked Change Request must explicitly reference this deliverable before a new revision can be uploaded.'
export const INVALID_STATUS_TRANSITION_ERROR =
  'Invalid deliverable status transition.'
export const DELIVERABLE_REVIEW_DECISION_ACTOR_REQUIRED_ERROR =
  'Review decisions that release or return a deliverable must record the acting QA reviewer.'
export const DELIVERABLE_RELEASE_REQUIRES_REVISION_ERROR =
  'Deliverables need at least one uploaded revision before QA can release them.'

/**
 * 合法的狀態轉換路徑。Draft → InReview → Released 為主線。
 * Locked 只能由系統（設計移轉）設定，不能手動跳轉。
 * Released → Draft 是被禁止的——需透過 CR 流程。
 */
const DELIVERABLE_STATUS_TRANSITIONS: Record<DeliverableStatus, DeliverableStatus[]> = {
  Draft: [DeliverableStatus.InReview],
  InReview: [DeliverableStatus.Draft, DeliverableStatus.Released],
  Released: [], // Released 不能再手動變更
  Locked: [],   // Locked 不能手動解鎖
}

const APPROVED_CHANGE_REQUEST_STATUSES: ChangeRequestStatus[] = [
  ChangeRequestStatus.Approved,
  ChangeRequestStatus.Active,
  ChangeRequestStatus.Implemented,
  ChangeRequestStatus.Closed,
]
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const REVISION_STORAGE_ROOT = path.join(process.cwd(), 'storage', 'revisions')

function sanitizeSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')

  return normalized || 'item'
}

function buildRevisionStoragePath(input: {
  projectCode: string
  deliverableCode: string
  revisionNumber: number
  fileName: string
}): string {
  const safeProjectCode = sanitizeSegment(input.projectCode)
  const safeDeliverableCode = sanitizeSegment(input.deliverableCode)
  const baseName = path.basename(input.fileName)
  const extension = path.extname(baseName)
  const baseWithoutExtension = extension ? baseName.slice(0, -extension.length) : baseName
  const safeBaseName = sanitizeSegment(baseWithoutExtension)
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '')
  const fileName = `r${String(input.revisionNumber).padStart(3, '0')}-${safeBaseName}${safeExtension}`

  return path.join('storage', 'revisions', safeProjectCode, safeDeliverableCode, fileName)
}

function resolveManagedStoragePath(storagePath: string): string {
  const absoluteRoot = path.resolve(REVISION_STORAGE_ROOT)
  const absolutePath = path.isAbsolute(storagePath)
    ? path.resolve(storagePath)
    : path.resolve(process.cwd(), storagePath)

  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error('Stored file path is outside the managed revision storage root.')
  }

  return absolutePath
}

export interface CreateDeliverableInput {
  projectId: string
  code: string
  title: string
  description?: string
  phase: ProjectPhase
  ownerId?: string | null
  isRequired?: boolean
  actorId: string
  targetDate?: Date | null
}

export interface CreateDeliverableResult {
  deliverable: {
    id: string
    projectId: string
    code: string
    title: string
    status: DeliverableStatus
    phase: ProjectPhase
  }
}

export async function createDeliverable(
  input: CreateDeliverableInput,
): Promise<CreateDeliverableResult> {
  const code = input.code.trim()
  const title = input.title.trim()

  if (!input.actorId) {
    throw new Error('操作必須提供使用者 ID (actorId)。')
  }

  if (!code) {
    throw new Error('Deliverable code is required.')
  }

  if (!title) {
    throw new Error('Deliverable title is required.')
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  })

  if (!project) {
    throw new Error(`Project not found: ${input.projectId}`)
  }

  if (input.ownerId) {
    const owner = await prisma.user.findUnique({
      where: { id: input.ownerId },
      select: { id: true },
    })

    if (!owner) {
      throw new Error(`Deliverable owner not found: ${input.ownerId}`)
    }
  }

  const deliverable = await prisma.deliverablePlaceholder.create({
    data: {
      projectId: input.projectId,
      code,
      title,
      description: input.description?.trim() || null,
      phase: input.phase,
      ownerId: input.ownerId ?? null,
      isRequired: input.isRequired ?? true,
      targetDate: input.targetDate ?? null,
    },
    select: {
      id: true,
      projectId: true,
      code: true,
      title: true,
      status: true,
      phase: true,
    },
  })

  await recordAudit({
    action: AuditActions.DELIVERABLE_CREATE,
    entityType: 'DeliverablePlaceholder',
    entityId: deliverable.id,
    actorId: input.actorId,
    detail: {
      code: deliverable.code,
      phase: deliverable.phase,
      projectId: input.projectId,
    },
  })

  return { deliverable }
}

export interface CreateFileRevisionInput {
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

export interface UploadFileRevisionInput {
  deliverableId: string
  file: File
  uploadedById: string
  changeRequestId?: string | null
  changeSummary?: string
  revisionNumber?: number
}

export interface CreateFileRevisionResult {
  revision: {
    id: string
    deliverableId: string
    revisionNumber: number
    fileName: string
    storagePath: string
    createdAt: Date
  }
}

export async function createFileRevision(
  input: CreateFileRevisionInput,
): Promise<CreateFileRevisionResult> {
  const fileName = input.fileName.trim()
  const storagePath = input.storagePath.trim()

  if (!input.uploadedById) {
    throw new Error('必須提供操作者 ID (uploadedById)。')
  }

  if (!fileName) {
    throw new Error('File name is required.')
  }

  if (!storagePath) {
    throw new Error('Storage path is required.')
  }

  const deliverable = await prisma.deliverablePlaceholder.findUnique({
    where: { id: input.deliverableId },
    select: {
      id: true,
      projectId: true,
      status: true,
      code: true,
      project: {
        select: {
          code: true,
        },
      },
    },
  })

  if (!deliverable) {
    throw new Error(`Deliverable not found: ${input.deliverableId}`)
  }

  if (deliverable.status === DeliverableStatus.Locked && !input.changeRequestId) {
    throw new Error(LOCKED_DELIVERABLE_CHANGE_REQUEST_ERROR)
  }

  if (input.uploadedById) {
    const uploader = await prisma.user.findUnique({
      where: { id: input.uploadedById },
      select: { id: true },
    })

    if (!uploader) {
      throw new Error(`Uploader not found: ${input.uploadedById}`)
    }
  }

  if (input.changeRequestId) {
    const request = await prisma.changeRequest.findUnique({
      where: { id: input.changeRequestId },
      select: {
        id: true,
        projectId: true,
        status: true,
        deliverableLinks: {
          where: {
            deliverableId: input.deliverableId,
          },
          select: {
            id: true,
          },
        },
      },
    })

    if (!request) {
      throw new Error(`Change request not found: ${input.changeRequestId}`)
    }

    if (request.projectId && request.projectId !== deliverable.projectId) {
      throw new Error('Linked Change Request does not belong to the same project.')
    }

    if (request.deliverableLinks.length === 0) {
      throw new Error(LOCKED_DELIVERABLE_CHANGE_REQUEST_LINK_ERROR)
    }

    if (
      deliverable.status === DeliverableStatus.Locked &&
      !APPROVED_CHANGE_REQUEST_STATUSES.includes(request.status)
    ) {
      throw new Error(LOCKED_DELIVERABLE_APPROVED_CHANGE_REQUEST_ERROR)
    }
  }

  const revisionNumber =
    input.revisionNumber ??
    ((await prisma.fileRevision.aggregate({
      where: { deliverableId: input.deliverableId },
      _max: { revisionNumber: true },
    }))._max.revisionNumber ?? 0) + 1

  const revision = await prisma.fileRevision.create({
    data: {
      deliverableId: input.deliverableId,
      revisionNumber,
      fileName,
      storagePath,
      mimeType: input.mimeType?.trim() || null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      changeSummary: input.changeSummary?.trim() || null,
      uploadedById: input.uploadedById ?? null,
      changeRequestId: input.changeRequestId ?? null,
    },
    select: {
      id: true,
      deliverableId: true,
      revisionNumber: true,
      fileName: true,
      storagePath: true,
      createdAt: true,
    },
  })
  await recordAudit({
    action: AuditActions.FILE_REVISION_UPLOAD,
    entityType: 'FileRevision',
    entityId: revision.id,
    actorId: input.uploadedById,
    detail: {
      deliverableId: input.deliverableId,
      revisionNumber: revision.revisionNumber,
      fileName: revision.fileName,
      changeRequestId: input.changeRequestId ?? null,
    },
  })

  await syncPendingItems(deliverable.projectId)

  return { revision }
}

export async function createUploadedFileRevision(
  input: UploadFileRevisionInput,
): Promise<CreateFileRevisionResult> {
  if (!(input.file instanceof File) || input.file.size === 0) {
    throw new Error(FILE_UPLOAD_ERROR)
  }

  const deliverable = await prisma.deliverablePlaceholder.findUnique({
    where: { id: input.deliverableId },
    select: {
      id: true,
      code: true,
      projectId: true,
      project: {
        select: {
          code: true,
        },
      },
    },
  })

  if (!deliverable) {
    throw new Error(`Deliverable not found: ${input.deliverableId}`)
  }

  const revisionNumber =
    input.revisionNumber ??
    ((await prisma.fileRevision.aggregate({
      where: { deliverableId: input.deliverableId },
      _max: { revisionNumber: true },
    }))._max.revisionNumber ?? 0) + 1

  const fileName = input.file.name?.trim() || `revision-${revisionNumber}.bin`
  const storagePath = buildRevisionStoragePath({
    projectCode: deliverable.project.code,
    deliverableCode: deliverable.code,
    revisionNumber,
    fileName,
  })
  const absoluteStoragePath = resolveManagedStoragePath(storagePath)

  await mkdir(path.dirname(absoluteStoragePath), { recursive: true })
  await writeFile(absoluteStoragePath, Buffer.from(await input.file.arrayBuffer()))

  try {
    return await createFileRevision({
      deliverableId: input.deliverableId,
      fileName,
      storagePath,
      mimeType: input.file.type || undefined,
      fileSizeBytes: input.file.size,
      uploadedById: input.uploadedById,
      changeRequestId: input.changeRequestId,
      changeSummary: input.changeSummary,
      revisionNumber,
    })
  } catch (error) {
    await unlink(absoluteStoragePath).catch(() => undefined)
    throw error
  }
}

export interface UpdateDeliverableStatusInput {
  deliverableId: string
  status: DeliverableStatus
  actedById: string
  comment?: string
}

export interface UpdateDeliverableStatusResult {
  deliverable: {
    id: string
    projectId: string
    code: string
    status: DeliverableStatus
    lockedAt: Date | null
  }
}

export async function updateDeliverableStatus(
  input: UpdateDeliverableStatusInput,
): Promise<UpdateDeliverableStatusResult> {
  if (!input.actedById) {
    throw new Error('必須提供操作者 ID (actedById)。')
  }

  const existing = await prisma.deliverablePlaceholder.findUnique({
    where: { id: input.deliverableId },
    select: {
      id: true,
      projectId: true,
      code: true,
      status: true,
      fileRevisions: {
        select: {
          id: true,
        },
        orderBy: {
          revisionNumber: 'desc',
        },
        take: 1,
      },
    },
  })

  if (!existing) {
    throw new Error(`Deliverable not found: ${input.deliverableId}`)
  }

  // Locked → anything is blocked (use CR flow)
  if (existing.status === DeliverableStatus.Locked && input.status !== DeliverableStatus.Locked) {
    throw new Error(LOCKED_DELIVERABLE_STATUS_CHANGE_ERROR)
  }

  // Enforce valid transitions
  const allowedTargets = DELIVERABLE_STATUS_TRANSITIONS[existing.status]
  if (!allowedTargets.includes(input.status) && input.status !== existing.status) {
    throw new Error(
      `${INVALID_STATUS_TRANSITION_ERROR} (${existing.status} → ${input.status})`,
    )
  }

  const actedById = input.actedById?.trim() || null
  const decisionComment = input.comment?.trim() || null
  const latestRevision = existing.fileRevisions[0] ?? null
  const isReviewDecision =
    existing.status === DeliverableStatus.InReview &&
    (input.status === DeliverableStatus.Released || input.status === DeliverableStatus.Draft)

  if (isReviewDecision && !actedById) {
    throw new Error(DELIVERABLE_REVIEW_DECISION_ACTOR_REQUIRED_ERROR)
  }

  if (actedById) {
    const reviewer = await prisma.user.findUnique({
      where: { id: actedById },
      select: { id: true },
    })

    if (!reviewer) {
      throw new Error(`Deliverable reviewer not found: ${actedById}`)
    }
  }

  if (input.status === DeliverableStatus.Released && !latestRevision) {
    throw new Error(DELIVERABLE_RELEASE_REQUIRES_REVISION_ERROR)
  }

  const deliverable = await prisma.deliverablePlaceholder.update({
    where: { id: input.deliverableId },
    data: {
      status: input.status,
      lockedAt: input.status === DeliverableStatus.Locked ? new Date() : undefined,
    },
    select: {
      id: true,
      projectId: true,
      code: true,
      status: true,
      lockedAt: true,
    },
  })

  if (isReviewDecision) {
    await prisma.approval.create({
      data: {
        deliverableId: existing.id,
        fileRevisionId: latestRevision?.id ?? null,
        actorId: actedById,
        decision:
          input.status === DeliverableStatus.Released
            ? ApprovalDecision.Approved
            : ApprovalDecision.Rejected,
        comment: decisionComment,
      },
    })
  }

  await recordAudit({
    action: AuditActions.DELIVERABLE_STATUS_CHANGE,
    entityType: 'DeliverablePlaceholder',
    entityId: deliverable.id,
    actorId: actedById,
    detail: {
      code: deliverable.code,
      from: existing.status,
      to: deliverable.status,
      decisionComment,
    },
  })

  await syncPendingItems(existing.projectId)

  return { deliverable }
}

export interface DownloadableFileRevision {
  id: string
  fileName: string
  mimeType: string | null
  fileSizeBytes: number | null
  content: Buffer
}

export async function getStoredFileRevision(
  revisionId: string,
): Promise<DownloadableFileRevision> {
  const revision = await prisma.fileRevision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSizeBytes: true,
      storagePath: true,
    },
  })

  if (!revision) {
    throw new Error(`File revision not found: ${revisionId}`)
  }

  const absoluteStoragePath = resolveManagedStoragePath(revision.storagePath)
  const content = await readFile(absoluteStoragePath)

  return {
    id: revision.id,
    fileName: revision.fileName,
    mimeType: revision.mimeType,
    fileSizeBytes: revision.fileSizeBytes,
    content,
  }
}
