import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DeliverableStatus, ProjectPhase } from '@prisma/client'

import { syncPendingItems } from './pending-item-service'
import { prisma } from './prisma'

export const FILE_UPLOAD_ERROR =
  'Please choose a file to upload before logging a revision.'
export const LOCKED_DELIVERABLE_CHANGE_REQUEST_ERROR =
  'Locked deliverables require a linked Change Request before a new revision can be uploaded.'

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

  return { deliverable }
}

export interface CreateFileRevisionInput {
  deliverableId: string
  fileName: string
  storagePath: string
  mimeType?: string
  fileSizeBytes?: number | null
  changeSummary?: string
  uploadedById?: string | null
  changeRequestId?: string | null
  revisionNumber?: number
}

export interface UploadFileRevisionInput {
  deliverableId: string
  file: File
  uploadedById?: string | null
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
      select: { id: true, projectId: true },
    })

    if (!request) {
      throw new Error(`Change request not found: ${input.changeRequestId}`)
    }

    if (request.projectId && request.projectId !== deliverable.projectId) {
      throw new Error('Linked Change Request does not belong to the same project.')
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
  const existing = await prisma.deliverablePlaceholder.findUnique({
    where: { id: input.deliverableId },
    select: {
      id: true,
      projectId: true,
    },
  })

  if (!existing) {
    throw new Error(`Deliverable not found: ${input.deliverableId}`)
  }

  const deliverable = await prisma.deliverablePlaceholder.update({
    where: { id: input.deliverableId },
    data: {
      status: input.status,
      lockedAt: input.status === DeliverableStatus.Locked ? new Date() : null,
    },
    select: {
      id: true,
      projectId: true,
      code: true,
      status: true,
      lockedAt: true,
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
