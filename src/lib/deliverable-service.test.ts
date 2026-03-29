import {
  ApprovalDecision,
  ChangeRequestStatus,
  DeliverableStatus,
} from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, recordAuditMock, syncPendingItemsMock } = vi.hoisted(() => ({
  prismaMock: {
    approval: {
      create: vi.fn(),
    },
    changeRequest: {
      findUnique: vi.fn(),
    },
    deliverablePlaceholder: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
  recordAuditMock: vi.fn(),
  syncPendingItemsMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/audit-log-service', () => ({
  recordAudit: recordAuditMock,
  AuditActions: {
    DELIVERABLE_STATUS_CHANGE: 'deliverable.statusChange',
    FILE_REVISION_UPLOAD: 'fileRevision.upload',
  },
}))

vi.mock('@/lib/pending-item-service', () => ({
  syncPendingItems: syncPendingItemsMock,
}))

import {
  createFileRevision,
  DELIVERABLE_REVIEW_DECISION_ACTOR_REQUIRED_ERROR,
  LOCKED_DELIVERABLE_CHANGE_REQUEST_LINK_ERROR,
  updateDeliverableStatus,
} from './deliverable-service'

describe('deliverable-service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('requires a reviewer when QA makes a release decision', async () => {
    prismaMock.deliverablePlaceholder.findUnique.mockResolvedValue({
      id: 'del-1',
      projectId: 'project-1',
      code: 'DEL-001',
      status: DeliverableStatus.InReview,
      fileRevisions: [{ id: 'rev-1' }],
    })

    await expect(
      updateDeliverableStatus({
        deliverableId: 'del-1',
        status: DeliverableStatus.Released,
      }),
    ).rejects.toThrow(DELIVERABLE_REVIEW_DECISION_ACTOR_REQUIRED_ERROR)
  })

  it('creates an approval record when QA releases a deliverable', async () => {
    prismaMock.deliverablePlaceholder.findUnique.mockResolvedValue({
      id: 'del-1',
      projectId: 'project-1',
      code: 'DEL-001',
      status: DeliverableStatus.InReview,
      fileRevisions: [{ id: 'rev-9' }],
    })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'qa-1' })
    prismaMock.deliverablePlaceholder.update.mockResolvedValue({
      id: 'del-1',
      projectId: 'project-1',
      code: 'DEL-001',
      status: DeliverableStatus.Released,
      lockedAt: null,
    })

    const result = await updateDeliverableStatus({
      deliverableId: 'del-1',
      status: DeliverableStatus.Released,
      actedById: 'qa-1',
      comment: 'Evidence complete and approved.',
    })

    expect(result.deliverable.status).toBe(DeliverableStatus.Released)
    expect(prismaMock.approval.create).toHaveBeenCalledWith({
      data: {
        actorId: 'qa-1',
        comment: 'Evidence complete and approved.',
        decision: ApprovalDecision.Approved,
        deliverableId: 'del-1',
        fileRevisionId: 'rev-9',
      },
    })
    expect(syncPendingItemsMock).toHaveBeenCalledWith('project-1')
    expect(recordAuditMock).toHaveBeenCalledTimes(1)
  })

  it('rejects locked-deliverable revisions when the change request is not linked to that deliverable', async () => {
    prismaMock.deliverablePlaceholder.findUnique.mockResolvedValue({
      id: 'del-1',
      projectId: 'project-1',
      status: DeliverableStatus.Locked,
      code: 'DEL-001',
      project: {
        code: 'P-001',
      },
    })
    prismaMock.changeRequest.findUnique.mockResolvedValue({
      id: 'cr-1',
      projectId: 'project-1',
      status: ChangeRequestStatus.Approved,
      deliverableLinks: [],
    })

    await expect(
      createFileRevision({
        deliverableId: 'del-1',
        fileName: 'updated-packet.pdf',
        storagePath: 'storage/revisions/P-001/DEL-001/r002-updated-packet.pdf',
        changeRequestId: 'cr-1',
      }),
    ).rejects.toThrow(LOCKED_DELIVERABLE_CHANGE_REQUEST_LINK_ERROR)
  })
})
