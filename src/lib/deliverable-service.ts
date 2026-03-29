import { DeliverableStatus, ProjectPhase } from '@prisma/client'

import { syncPendingItems } from './pending-item-service'
import { prisma } from './prisma'

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
    select: { id: true, projectId: true },
  })

  if (!deliverable) {
    throw new Error(`Deliverable not found: ${input.deliverableId}`)
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
      select: { id: true },
    })

    if (!request) {
      throw new Error(`Change request not found: ${input.changeRequestId}`)
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
