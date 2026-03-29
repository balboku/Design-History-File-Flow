import { ChangeRequestStatus } from '@prisma/client'

import { prisma } from './prisma'

export interface CreateChangeRequestInput {
  code: string
  title: string
  description?: string
  impactAnalysis?: string
  projectId?: string | null
  requesterId?: string | null
  deliverableIds?: string[]
  partComponentIds?: string[]
  status?: ChangeRequestStatus
}

export interface CreateChangeRequestResult {
  changeRequest: {
    id: string
    code: string
    title: string
    status: ChangeRequestStatus
    projectId: string | null
  }
}

export async function createChangeRequest(
  input: CreateChangeRequestInput,
): Promise<CreateChangeRequestResult> {
  const code = input.code.trim()
  const title = input.title.trim()
  const deliverableIds = [...new Set(input.deliverableIds ?? [])]
  const partComponentIds = [...new Set(input.partComponentIds ?? [])]

  if (!code) {
    throw new Error('Change request code is required.')
  }

  if (!title) {
    throw new Error('Change request title is required.')
  }

  if (!input.projectId && deliverableIds.length === 0 && partComponentIds.length === 0) {
    throw new Error('Change request must be linked to a project, deliverable, or part.')
  }

  if (input.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true },
    })

    if (!project) {
      throw new Error(`Project not found: ${input.projectId}`)
    }
  }

  if (input.requesterId) {
    const requester = await prisma.user.findUnique({
      where: { id: input.requesterId },
      select: { id: true },
    })

    if (!requester) {
      throw new Error(`Requester not found: ${input.requesterId}`)
    }
  }

  const deliverables = deliverableIds.length
    ? await prisma.deliverablePlaceholder.findMany({
        where: { id: { in: deliverableIds } },
        select: { id: true, projectId: true },
      })
    : []

  if (deliverables.length !== deliverableIds.length) {
    throw new Error('One or more linked deliverables were not found.')
  }

  const projectIdsFromDeliverables = [...new Set(deliverables.map((item) => item.projectId))]

  if (projectIdsFromDeliverables.length > 1) {
    throw new Error('All deliverables in one change request must belong to the same project.')
  }

  const resolvedProjectId = input.projectId ?? projectIdsFromDeliverables[0] ?? null

  if (
    resolvedProjectId &&
    projectIdsFromDeliverables[0] &&
    projectIdsFromDeliverables[0] !== resolvedProjectId
  ) {
    throw new Error('Linked deliverables do not belong to the selected project.')
  }

  if (partComponentIds.length > 0) {
    const parts = await prisma.partComponent.findMany({
      where: { id: { in: partComponentIds } },
      select: { id: true },
    })

    if (parts.length !== partComponentIds.length) {
      throw new Error('One or more linked parts were not found.')
    }
  }

  const changeRequest = await prisma.changeRequest.create({
    data: {
      projectId: resolvedProjectId,
      code,
      title,
      description: input.description?.trim() || null,
      impactAnalysis: input.impactAnalysis?.trim() || null,
      requesterId: input.requesterId ?? null,
      status: input.status ?? ChangeRequestStatus.Draft,
      deliverableLinks: {
        create: deliverableIds.map((deliverableId) => ({
          deliverableId,
        })),
      },
      partLinks: {
        create: partComponentIds.map((partComponentId) => ({
          partComponentId,
        })),
      },
    },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      projectId: true,
    },
  })

  return { changeRequest }
}
