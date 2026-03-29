import { ChangeRequestStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, recordAuditMock } = vi.hoisted(() => ({
  prismaMock: {
    changeRequest: {
      create: vi.fn(),
    },
    deliverablePlaceholder: {
      findMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
    partComponent: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
  recordAuditMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/audit-log-service', () => ({
  recordAudit: recordAuditMock,
  AuditActions: {
    CHANGE_REQUEST_CREATE: 'changeRequest.create',
    CHANGE_REQUEST_TRANSITION: 'changeRequest.transition',
  },
}))

import { createChangeRequest } from './change-request-service'

describe('change-request-service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('requires an impact analysis summary', async () => {
    await expect(
      createChangeRequest({
        code: 'CR-001',
        title: 'Update labeling pack',
        projectId: 'project-1',
        impactAnalysis: {
          summary: '   ',
        },
      }),
    ).rejects.toThrow('Impact analysis is required for every change request.')
  })

  it('creates a change request with structured impact analysis', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1' })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'qa-1' })
    prismaMock.deliverablePlaceholder.findMany.mockResolvedValue([{ id: 'del-1', projectId: 'project-1' }])
    prismaMock.changeRequest.create.mockResolvedValue({
      id: 'cr-1',
      code: 'CR-001',
      title: 'Update labeling pack',
      status: ChangeRequestStatus.Draft,
      projectId: 'project-1',
    })

    const result = await createChangeRequest({
      code: 'CR-001',
      title: 'Update labeling pack',
      projectId: 'project-1',
      requesterId: 'qa-1',
      deliverableIds: ['del-1'],
      impactAnalysis: {
        summary: 'Revise the labeling evidence set before transfer.',
        regulatoryImpact: 'Labeling references in the DHF need a refreshed approval trail.',
        documentationImpact: 'The IFU and release checklist both need new revisions.',
      },
    })

    expect(result.changeRequest.projectId).toBe('project-1')
    expect(prismaMock.changeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          impactAnalysis: {
            create: expect.objectContaining({
              summary: 'Revise the labeling evidence set before transfer.',
              regulatoryImpact: 'Labeling references in the DHF need a refreshed approval trail.',
              documentationImpact: 'The IFU and release checklist both need new revisions.',
            }),
          },
        }),
      }),
    )
    expect(recordAuditMock).toHaveBeenCalledTimes(1)
  })
})
