import { DeliverableStatus, ProjectPhase } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, syncPendingItemsMock } = vi.hoisted(() => ({
  prismaMock: {
    deliverablePlaceholder: {
      findMany: vi.fn(),
    },
    pendingItem: {
      findMany: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
  syncPendingItemsMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/audit-log-service', () => ({
  recordAudit: vi.fn(),
  AuditActions: {
    PHASE_ADVANCE: 'phase.advance',
    PHASE_OVERRIDE: 'phase.override',
  },
}))

vi.mock('@/lib/pending-item-service', () => ({
  syncPendingItems: syncPendingItemsMock,
}))

import { evaluatePhaseGate } from './phase-service'

describe('phase-service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('surfaces soft-gate issues for incomplete deliverables in the current phase', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      code: 'P-001',
      currentPhase: ProjectPhase.DesignInput,
    })
    prismaMock.deliverablePlaceholder.findMany.mockResolvedValue([
      {
        id: 'del-1',
        code: 'DI-001',
        title: 'Design Input Package',
        status: DeliverableStatus.Draft,
        phase: ProjectPhase.DesignInput,
      },
    ])

    const result = await evaluatePhaseGate('project-1')

    expect(result).toEqual({
      canAdvance: false,
      isHardGate: false,
      issues: [
        {
          currentStatus: DeliverableStatus.Draft,
          deliverableCode: 'DI-001',
          deliverableId: 'del-1',
          deliverableTitle: 'Design Input Package',
          reason: '文件尚在草稿狀態，未完成',
        },
      ],
    })
    expect(syncPendingItemsMock).toHaveBeenCalledWith('project-1')
  })

  it('enforces hard gate correctly when entering PostMarket', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      code: 'P-001',
      currentPhase: ProjectPhase.DesignTransfer,
    })
    
    // Simulate some unfinished deliverable across all prior phases
    prismaMock.deliverablePlaceholder.findMany.mockResolvedValue([
      {
        id: 'del-1',
        code: 'DI-001', // From earlier phase
        title: 'Design Input Package',
        status: DeliverableStatus.Draft,
        phase: ProjectPhase.DesignInput,
      },
    ])
    
    // Hard gates also check pending items
    prismaMock.pendingItem.findMany.mockResolvedValue([])

    const result = await evaluatePhaseGate('project-1')

    expect(result).toEqual({
      canAdvance: false,
      isHardGate: true,
      issues: [
        {
          currentStatus: DeliverableStatus.Draft,
          deliverableCode: 'DI-001',
          deliverableId: 'del-1',
          deliverableTitle: 'Design Input Package',
          reason: '文件尚在草稿狀態，未完成',
        },
      ],
    })
  })
})
