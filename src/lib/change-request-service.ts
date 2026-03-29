import { ChangeRequestStatus } from '@prisma/client'

import { recordAudit, AuditActions } from './audit-log-service'
import { prisma } from './prisma'

const CHANGE_REQUEST_WORKFLOW: Record<ChangeRequestStatus, ChangeRequestStatus[]> = {
  Draft: [ChangeRequestStatus.Submitted],
  Active: [ChangeRequestStatus.Implemented],
  Submitted: [ChangeRequestStatus.InReview],
  InReview: [ChangeRequestStatus.Approved, ChangeRequestStatus.Rejected],
  Approved: [ChangeRequestStatus.Active],
  Rejected: [],
  Implemented: [ChangeRequestStatus.Closed],
  Closed: [],
}

export const CHANGE_REQUEST_APPROVAL_ERROR =
  'Approved or rejected change requests must record an approver.'

export const CHANGE_REQUEST_WORKFLOW_ERROR =
  'The requested Change Request status transition is not allowed.'

export interface CreateChangeRequestInput {
  code: string
  title: string
  description?: string
  impactAnalysis?: string
  projectId?: string | null
  requesterId?: string | null
  deliverableIds?: string[]
  partComponentIds?: string[]
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

export interface TransitionChangeRequestInput {
  changeRequestId: string
  nextStatus: ChangeRequestStatus
  actedById?: string | null
}

export interface TransitionChangeRequestResult {
  changeRequest: {
    id: string
    code: string
    status: ChangeRequestStatus
    approverId: string | null
    submittedAt: Date | null
    approvedAt: Date | null
    implementedAt: Date | null
  }
}

export function getAllowedChangeRequestTransitions(
  status: ChangeRequestStatus,
): ChangeRequestStatus[] {
  return CHANGE_REQUEST_WORKFLOW[status] ?? []
}

export async function createChangeRequest(
  input: CreateChangeRequestInput,
): Promise<CreateChangeRequestResult> {
  const code = input.code.trim()
  const title = input.title.trim()
  const impactAnalysis = input.impactAnalysis?.trim()
  const deliverableIds = [...new Set(input.deliverableIds ?? [])]
  const partComponentIds = [...new Set(input.partComponentIds ?? [])]

  if (!code) {
    throw new Error('Change request code is required.')
  }

  if (!title) {
    throw new Error('Change request title is required.')
  }

  if (!impactAnalysis) {
    throw new Error('Impact analysis is required for every change request.')
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
      impactAnalysis,
      requesterId: input.requesterId ?? null,
      status: ChangeRequestStatus.Draft,
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
  await recordAudit({
    action: AuditActions.CHANGE_REQUEST_CREATE,
    entityType: 'ChangeRequest',
    entityId: changeRequest.id,
    actorId: input.requesterId,
    detail: {
      code: changeRequest.code,
      projectId: resolvedProjectId,
      deliverableIds,
      partComponentIds,
    },
  })

  return { changeRequest }
}

export async function transitionChangeRequest(
  input: TransitionChangeRequestInput,
): Promise<TransitionChangeRequestResult> {
  const changeRequest = await prisma.changeRequest.findUnique({
    where: { id: input.changeRequestId },
    select: {
      id: true,
      code: true,
      status: true,
      requesterId: true,
      approverId: true,
      submittedAt: true,
      approvedAt: true,
      implementedAt: true,
    },
  })

  if (!changeRequest) {
    throw new Error(`Change request not found: ${input.changeRequestId}`)
  }

  const allowedTransitions = getAllowedChangeRequestTransitions(changeRequest.status)
  if (!allowedTransitions.includes(input.nextStatus)) {
    throw new Error(
      `${CHANGE_REQUEST_WORKFLOW_ERROR} (${changeRequest.status} -> ${input.nextStatus})`,
    )
  }

  const actedById = input.actedById?.trim() || null

  if (
    (input.nextStatus === ChangeRequestStatus.Approved ||
      input.nextStatus === ChangeRequestStatus.Rejected) &&
    !actedById
  ) {
    throw new Error(CHANGE_REQUEST_APPROVAL_ERROR)
  }

  if (actedById) {
    const actor = await prisma.user.findUnique({
      where: { id: actedById },
      select: { id: true },
    })

    if (!actor) {
      throw new Error(`Change request actor not found: ${actedById}`)
    }
  }

  const now = new Date()

  const updated = await prisma.changeRequest.update({
    where: { id: input.changeRequestId },
    data: {
      status: input.nextStatus,
      submittedAt:
        input.nextStatus === ChangeRequestStatus.Submitted
          ? changeRequest.submittedAt ?? now
          : undefined,
      approverId:
        input.nextStatus === ChangeRequestStatus.Approved ||
        input.nextStatus === ChangeRequestStatus.Rejected
          ? actedById
          : undefined,
      approvedAt:
        input.nextStatus === ChangeRequestStatus.Approved
          ? now
          : undefined,
      implementedAt:
        input.nextStatus === ChangeRequestStatus.Implemented
          ? now
          : undefined,
    },
    select: {
      id: true,
      code: true,
      status: true,
      approverId: true,
      submittedAt: true,
      approvedAt: true,
      implementedAt: true,
    },
  })

  await recordAudit({
    action: AuditActions.CHANGE_REQUEST_TRANSITION,
    entityType: 'ChangeRequest',
    entityId: updated.id,
    actorId: actedById,
    detail: {
      code: updated.code,
      from: changeRequest.status,
      to: updated.status,
    },
  })

  return { changeRequest: updated }
}
